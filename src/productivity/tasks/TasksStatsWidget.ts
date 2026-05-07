import { App, EventRef, moment } from 'obsidian';
import UmOSPlugin from '../../main';
import { TaskService } from './TaskService';
import { BaseWidget } from '../../core/BaseWidget';
import type { ITaskQuery } from './Task';

type TasksStatsRangePreset = '7' | '14' | '30' | 'year' | 'custom';

interface TasksStatsDateRange {
	from: string;
	to: string;
	pillLabel: string;
	chartLabel: string;
}

export class TasksStatsWidget extends BaseWidget {
	private app: App;
	private plugin: UmOSPlugin;
	private service: TaskService;
	private config: Record<string, unknown>;
	private renderTimeout: ReturnType<typeof setTimeout> | null = null;
	private rangePreset: TasksStatsRangePreset = '30';
	private customFrom = '';
	private customTo = '';
	private storageKey: string;

	constructor(
		containerEl: HTMLElement,
		config: Record<string, unknown>,
		app: App,
		plugin: UmOSPlugin,
	) {
		super(containerEl);
		this.app = app;
		this.plugin = plugin;
		this.config = config;
		this.service = new TaskService(app, plugin);
		this.storageKey = `umos-tasks-stats-range:${this.hashConfig(config)}`;
		this.loadRangeState();
	}

	protected onWidgetLoad(): void {
		const ref: EventRef = this.app.vault.on('modify', () => {
			if (this.renderTimeout) clearTimeout(this.renderTimeout);
			this.renderTimeout = setTimeout(() => this.render(), 500);
		});
		this.registerEvent(ref);
	}

	protected onWidgetUnload(): void {
		if (this.renderTimeout) clearTimeout(this.renderTimeout);
	}

	protected render(): void {
		void this.renderAsync();
	}

	private async renderAsync(): Promise<void> {
		this.containerEl.empty();

		const range = this.getDateRange();
		const rangeQuery = {
			...this.config,
			dateFrom: range.from,
			dateTo: range.to,
		} as ITaskQuery;
		const extended = await this.service.getExtendedStats(rangeQuery);
		const stats = extended.base;

		const wrapper = this.containerEl.createDiv({ cls: 'umos-tasks-stats' });
		this.renderRangeControls(wrapper);

		if (stats.total === 0) {
			const empty = wrapper.createDiv({ cls: 'umos-tasks-stats-empty' });
			empty.createSpan({ text: 'No tasks found in the selected range' });
			return;
		}

		// ──   ──
		const mainGrid = wrapper.createDiv({ cls: 'umos-tasks-stats-grid' });
		this.createCard(mainGrid, String(stats.done), `/ ${stats.total}`, 'Done', 'done');
		this.createCard(mainGrid, String(stats.pending), 'tasks', 'Active', 'pending');
		this.createCard(mainGrid, String(stats.overdue), 'tasks', 'Overdue', 'overdue');
		this.createCard(mainGrid, `${stats.completionPercentage}%`, '', 'Progress', 'progress');

		// ── Progress- ──
		const progressSection = wrapper.createDiv({ cls: 'umos-tasks-stats-progress' });
		const track = progressSection.createDiv({ cls: 'umos-tasks-stats-progress-track' });
		track.createDiv({
			cls: 'umos-tasks-stats-progress-fill',
			attr: { style: `width: ${stats.completionPercentage}%` },
		});
		progressSection.createDiv({
			cls: 'umos-tasks-stats-progress-label',
			text: `${stats.done} of ${stats.total} tasks done`,
		});

		// ── Secondary  ──
		const strip = wrapper.createDiv({ cls: 'umos-tasks-stats-strip' });
		this.createPill(strip, String(stats.done), range.pillLabel);
		this.createPill(strip, String(extended.activeDays), 'active days');
		this.createPill(strip, `${extended.streak}`, 'streak');
		if (extended.avgCompletionDays !== null) {
			this.createPill(strip, `${extended.avgCompletionDays}d`, 'average');
		}

		// ──   ──
		const donutGrid = wrapper.createDiv({ cls: 'umos-tasks-donut-grid' });
		const tagStats = await this.service.getTagStats(rangeQuery);
		if (tagStats.length > 0) {
			const tagSection = donutGrid.createDiv({ cls: 'umos-tasks-tag-chart-section' });
			tagSection.createDiv({ cls: 'umos-tasks-stats-chart-title', text: 'By tags' });
			this.renderTagDonut(tagSection, tagStats, stats.completionPercentage);
		}

		const statusStats = await this.service.getStatusStats(rangeQuery);
		if (statusStats.length > 0) {
			const statusSection = donutGrid.createDiv({ cls: 'umos-tasks-status-chart-section' });
			statusSection.createDiv({ cls: 'umos-tasks-stats-chart-title', text: 'By status' });
			this.renderStatusDonut(statusSection, statusStats);
		}

		if (donutGrid.children.length === 0) donutGrid.remove();

		// ──  last 30 days ──
		if (extended.dailyCompleted.length > 0) {
			const chartSection = wrapper.createDiv({ cls: 'umos-tasks-stats-chart-section' });
			chartSection.createDiv({ cls: 'umos-tasks-stats-chart-title', text: `Activity ${range.chartLabel}` });

			const chart = chartSection.createDiv({ cls: 'umos-tasks-stats-chart' });
			const maxCount = Math.max(...extended.dailyCompleted.map(d => d.count), 1);

			for (const day of extended.dailyCompleted) {
				const col = chart.createDiv({ cls: 'umos-tasks-stats-bar-col' });
				const heightPct = Math.max((day.count / maxCount) * 100, day.count > 0 ? 5 : 1);
				const bar = col.createDiv({
					cls: `umos-tasks-stats-bar${day.count > 0 ? '' : ' umos-tasks-stats-bar--empty'}`,
					attr: { style: `height: ${heightPct}%` },
				});
				if (day.count > 0) {
					bar.setAttribute('title', `${day.date}: ${day.count}`);
				}
			}
		}
	}

	private renderRangeControls(container: HTMLElement): void {
		const controls = container.createDiv({ cls: 'umos-tasks-stats-range-controls' });
		controls.createSpan({ cls: 'umos-tasks-stats-range-label', text: 'Range' });

		const select = controls.createEl('select', {
			cls: 'umos-tasks-stats-range-select',
			attr: { 'aria-label': 'Stats range tasks' },
		}) as HTMLSelectElement;

		const options: { value: TasksStatsRangePreset; label: string }[] = [
			{ value: '7', label: '7 days' },
			{ value: '14', label: '14 days' },
			{ value: '30', label: '30 days' },
			{ value: 'year', label: 'Year' },
			{ value: 'custom', label: 'Custom' },
		];

		for (const option of options) {
			select.createEl('option', { value: option.value, text: option.label });
		}

		select.value = this.rangePreset;
		select.addEventListener('change', () => {
			this.rangePreset = select.value as TasksStatsRangePreset;
			if (this.rangePreset === 'custom') this.ensureCustomRange();
			this.saveRangeState();
			this.render();
		});

		if (this.rangePreset === 'custom') {
			this.ensureCustomRange();
			const custom = controls.createDiv({ cls: 'umos-tasks-stats-range-custom' });
			const fromInput = custom.createEl('input', {
				cls: 'umos-tasks-stats-range-date',
				attr: { type: 'date', value: this.customFrom, 'aria-label': 'Range start' },
			}) as HTMLInputElement;
			const toInput = custom.createEl('input', {
				cls: 'umos-tasks-stats-range-date',
				attr: { type: 'date', value: this.customTo, 'aria-label': 'Range end' },
			}) as HTMLInputElement;

			fromInput.addEventListener('change', () => {
				this.customFrom = fromInput.value;
				this.saveRangeState();
				this.render();
			});
			toInput.addEventListener('change', () => {
				this.customTo = toInput.value;
				this.saveRangeState();
				this.render();
			});
		}
	}

	private getDateRange(): TasksStatsDateRange {
		const today = moment().startOf('day');
		let from = today.clone().subtract(29, 'days');
		let to = today.clone();
		let pillLabel = 'last 30 days';
		let chartLabel = 'last 30 days';

		if (this.rangePreset === '7') {
			from = today.clone().subtract(6, 'days');
			pillLabel = 'last 7 days';
			chartLabel = 'last 7 days';
		} else if (this.rangePreset === '14') {
			from = today.clone().subtract(13, 'days');
			pillLabel = 'last 14 days';
			chartLabel = 'last 14 days';
		} else if (this.rangePreset === 'year') {
			from = today.clone().subtract(364, 'days');
			pillLabel = 'last year';
			chartLabel = 'last year';
		} else if (this.rangePreset === 'custom') {
			this.ensureCustomRange();
			const customFrom = moment(this.customFrom).startOf('day');
			const customTo = moment(this.customTo).startOf('day');
			if (customFrom.isValid() && customTo.isValid()) {
				from = customFrom.isAfter(customTo) ? customTo : customFrom;
				to = customFrom.isAfter(customTo) ? customFrom : customTo;
			}
			pillLabel = 'in range';
			chartLabel = `${from.format('DD.MM.YYYY')} - ${to.format('DD.MM.YYYY')}`;
		}

		return {
			from: from.format('YYYY-MM-DD'),
			to: to.format('YYYY-MM-DD'),
			pillLabel,
			chartLabel,
		};
	}

	private ensureCustomRange(): void {
		const today = moment().startOf('day');
		if (!this.customFrom) this.customFrom = today.clone().subtract(29, 'days').format('YYYY-MM-DD');
		if (!this.customTo) this.customTo = today.format('YYYY-MM-DD');
	}

	private loadRangeState(): void {
		const configuredPreset = this.normalizeRangePreset(
			this.config.range ?? this.config.period ?? this.config.days ?? this.config.range_days
		);
		if (configuredPreset) this.rangePreset = configuredPreset;

		const configFrom = this.config.dateFrom ?? this.config.date_from;
		const configTo = this.config.dateTo ?? this.config.date_to;
		if (!configuredPreset && (typeof configFrom === 'string' || typeof configTo === 'string')) {
			this.rangePreset = 'custom';
		}
		if (typeof configFrom === 'string') this.customFrom = configFrom;
		if (typeof configTo === 'string') this.customTo = configTo;

		try {
			const raw = window.localStorage.getItem(this.storageKey);
			if (!raw) return;
			const saved = JSON.parse(raw) as Partial<{
				preset: TasksStatsRangePreset;
				customFrom: string;
				customTo: string;
			}>;
			const savedPreset = this.normalizeRangePreset(saved.preset);
			if (savedPreset) this.rangePreset = savedPreset;
			if (typeof saved.customFrom === 'string') this.customFrom = saved.customFrom;
			if (typeof saved.customTo === 'string') this.customTo = saved.customTo;
		} catch {
			// Ignore broken local storage state.
		}
	}

	private saveRangeState(): void {
		try {
			window.localStorage.setItem(this.storageKey, JSON.stringify({
				preset: this.rangePreset,
				customFrom: this.customFrom,
				customTo: this.customTo,
			}));
		} catch {
			// Local storage can be unavailable in restricted environments.
		}
	}

	private normalizeRangePreset(value: unknown): TasksStatsRangePreset | null {
		const raw = String(value ?? '').trim().toLowerCase();
		if (raw === '7' || raw === '7d' || raw === '7days') return '7';
		if (raw === '14' || raw === '14d' || raw === '14days') return '14';
		if (raw === '30' || raw === '30d' || raw === '30days') return '30';
		if (raw === '365' || raw === 'year' || raw === '1y') return 'year';
		if (raw === 'custom') return 'custom';
		return null;
	}

	private hashConfig(config: Record<string, unknown>): string {
		const input = JSON.stringify(config);
		let hash = 0;
		for (let i = 0; i < input.length; i++) {
			hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
		}
		return Math.abs(hash).toString(36);
	}

	private renderTagDonut(
		container: HTMLElement,
		tags: { tag: string; count: number; done: number }[],
		overallPct: number,
	): void {
		const CHART_COLORS = ['#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];
		const cx = 100, cy = 100, r2 = 80, r1 = 50;
		const total = tags.reduce((s, t) => s + t.count, 0);

		const stripPrefix = (tag: string) => tag.replace(/^tasks\//, '');

		const wrap = container.createDiv({ cls: 'umos-tasks-tag-donut-wrap' });

		// Tooltip div
		const tooltip = wrap.createDiv({ cls: 'umos-tasks-tag-tooltip' });
		tooltip.style.display = 'none';

		let activeTooltipPath: Element | null = null;

		// SVG
		const svgNS = 'http://www.w3.org/2000/svg';
		const svg = document.createElementNS(svgNS, 'svg');
		svg.setAttribute('viewBox', '0 0 200 200');
		svg.setAttribute('class', 'umos-tasks-tag-donut-svg');

		const polar = (angle: number, r: number) => ({
			x: cx + r * Math.cos(angle),
			y: cy + r * Math.sin(angle),
		});

		const segmentPath = (a1: number, a2: number): string => {
			const large = a2 - a1 > Math.PI ? 1 : 0;
			const p1 = polar(a1, r2), p2 = polar(a2, r2);
			const p3 = polar(a2, r1), p4 = polar(a1, r1);
			return [
				`M ${p1.x} ${p1.y}`,
				`A ${r2} ${r2} 0 ${large} 1 ${p2.x} ${p2.y}`,
				`L ${p3.x} ${p3.y}`,
				`A ${r1} ${r1} 0 ${large} 0 ${p4.x} ${p4.y}`,
				'Z',
			].join(' ');
		};

		const EXPLODE = 8;
		let activeGroup: SVGGElement | null = null;

		const activate = (g: SVGGElement, midAngle: number, t: { tag: string; count: number }, pct: number) => {
			if (activeGroup && activeGroup !== g) {
				activeGroup.setAttribute('transform', '');
				activeGroup.classList.remove('umos-tasks-tag-segment--active');
			}
			const dx = EXPLODE * Math.cos(midAngle);
			const dy = EXPLODE * Math.sin(midAngle);
			g.setAttribute('transform', `translate(${dx}, ${dy})`);
			g.classList.add('umos-tasks-tag-segment--active');
			tooltip.textContent = `#${stripPrefix(t.tag)} · ${pct}%`;
			tooltip.style.display = 'block';
			activeGroup = g;
			activeTooltipPath = g.querySelector('path');
		};

		const deactivate = () => {
			if (activeGroup) {
				activeGroup.setAttribute('transform', '');
				activeGroup.classList.remove('umos-tasks-tag-segment--active');
				activeGroup = null;
			}
			tooltip.style.display = 'none';
			activeTooltipPath = null;
		};

		let startAngle = -Math.PI / 2;
		const GAP = 0.03;

		tags.forEach((t, i) => {
			const slice = (t.count / total) * (Math.PI * 2);
			const endAngle = startAngle + slice - GAP;
			const color = CHART_COLORS[i % CHART_COLORS.length];
			const pct = Math.round((t.count / total) * 100);
			const midAngle = startAngle + GAP / 2 + (slice - GAP) / 2;

			const g = document.createElementNS(svgNS, 'g');
			g.setAttribute('class', 'umos-tasks-tag-segment');
			svg.appendChild(g);

			const path = document.createElementNS(svgNS, 'path');
			path.setAttribute('d', segmentPath(startAngle + GAP / 2, endAngle));
			path.setAttribute('fill', color);
			g.appendChild(path);

			// Label inside segment (only if slice big enough)
			if (slice > 0.35) {
				const lr = (r1 + r2) / 2;
				const lp = polar(midAngle, lr);

				const txt = document.createElementNS(svgNS, 'text');
				txt.setAttribute('x', String(lp.x));
				txt.setAttribute('y', String(lp.y));
				txt.setAttribute('text-anchor', 'middle');
				txt.setAttribute('dominant-baseline', 'middle');
				txt.setAttribute('class', 'umos-tasks-tag-label');
				txt.setAttribute('pointer-events', 'none');
				txt.textContent = `${pct}%`;
				g.appendChild(txt);
			}

			// Desktop: hover
			g.addEventListener('mouseenter', () => activate(g, midAngle, t, pct));
			g.addEventListener('mouseleave', deactivate);

			// Mobile: tap toggles
			g.addEventListener('touchstart', (e) => {
				e.preventDefault();
				if (activeGroup === g) {
					deactivate();
				} else {
					activate(g, midAngle, t, pct);
				}
			}, { passive: false });

			startAngle += slice;
		});

		// Center text
		const centerPct = document.createElementNS(svgNS, 'text');
		centerPct.setAttribute('x', String(cx));
		centerPct.setAttribute('y', String(cy - 8));
		centerPct.setAttribute('text-anchor', 'middle');
		centerPct.setAttribute('dominant-baseline', 'middle');
		centerPct.setAttribute('class', 'umos-tasks-tag-center-pct');
		centerPct.setAttribute('pointer-events', 'none');
		centerPct.textContent = `${overallPct}%`;
		svg.appendChild(centerPct);

		const centerLabel = document.createElementNS(svgNS, 'text');
		centerLabel.setAttribute('x', String(cx));
		centerLabel.setAttribute('y', String(cy + 12));
		centerLabel.setAttribute('text-anchor', 'middle');
		centerLabel.setAttribute('dominant-baseline', 'middle');
		centerLabel.setAttribute('class', 'umos-tasks-tag-center-label');
		centerLabel.setAttribute('pointer-events', 'none');
		centerLabel.textContent = 'DONE';
		svg.appendChild(centerLabel);

		wrap.appendChild(svg);

		// Hide on outside tap (mobile)
		this.registerDomEvent(document, 'touchstart', (e: TouchEvent) => {
			if (activeTooltipPath && !svg.contains(e.target as Node)) {
				deactivate();
			}
		});
	}

	private renderStatusDonut(
		container: HTMLElement,
		statuses: { status: string; count: number }[],
	): void {
		const STATUS_LABELS: Record<string, string> = {
			todo: 'To Do',
			doing: 'In Progress',
			done: 'Done',
			cancelled: 'Cancelled',
		};
		const STATUS_COLORS: Record<string, string> = {
			todo: '#f59e0b',
			doing: '#7c3aed',
			done: '#27ae60',
			cancelled: '#64748b',
		};
		const cx = 100, cy = 100, r2 = 80, r1 = 50;
		const total = statuses.reduce((sum, status) => sum + status.count, 0);
		if (total === 0) return;

		const wrap = container.createDiv({ cls: 'umos-tasks-tag-donut-wrap' });
		const tooltip = wrap.createDiv({ cls: 'umos-tasks-tag-tooltip' });
		tooltip.style.display = 'none';

		let activeTooltipPath: Element | null = null;

		const svgNS = 'http://www.w3.org/2000/svg';
		const svg = document.createElementNS(svgNS, 'svg');
		svg.setAttribute('viewBox', '0 0 200 200');
		svg.setAttribute('class', 'umos-tasks-tag-donut-svg');

		const polar = (angle: number, r: number) => ({
			x: cx + r * Math.cos(angle),
			y: cy + r * Math.sin(angle),
		});

		const segmentPath = (a1: number, a2: number): string => {
			const large = a2 - a1 > Math.PI ? 1 : 0;
			const p1 = polar(a1, r2), p2 = polar(a2, r2);
			const p3 = polar(a2, r1), p4 = polar(a1, r1);
			return [
				`M ${p1.x} ${p1.y}`,
				`A ${r2} ${r2} 0 ${large} 1 ${p2.x} ${p2.y}`,
				`L ${p3.x} ${p3.y}`,
				`A ${r1} ${r1} 0 ${large} 0 ${p4.x} ${p4.y}`,
				'Z',
			].join(' ');
		};

		const EXPLODE = 8;
		let activeGroup: SVGGElement | null = null;

		const activate = (
			g: SVGGElement,
			midAngle: number,
			status: { status: string; count: number },
			pct: number,
		) => {
			if (activeGroup && activeGroup !== g) {
				activeGroup.setAttribute('transform', '');
				activeGroup.classList.remove('umos-tasks-tag-segment--active');
			}
			const dx = EXPLODE * Math.cos(midAngle);
			const dy = EXPLODE * Math.sin(midAngle);
			g.setAttribute('transform', `translate(${dx}, ${dy})`);
			g.classList.add('umos-tasks-tag-segment--active');
			tooltip.textContent = `${STATUS_LABELS[status.status] ?? status.status} · ${status.count} · ${pct}%`;
			tooltip.style.display = 'block';
			activeGroup = g;
			activeTooltipPath = g.querySelector('path');
		};

		const deactivate = () => {
			if (activeGroup) {
				activeGroup.setAttribute('transform', '');
				activeGroup.classList.remove('umos-tasks-tag-segment--active');
				activeGroup = null;
			}
			tooltip.style.display = 'none';
			activeTooltipPath = null;
		};

		let startAngle = -Math.PI / 2;
		const GAP = 0.03;

		statuses.forEach((status) => {
			const slice = (status.count / total) * (Math.PI * 2);
			const endAngle = startAngle + slice - GAP;
			const color = STATUS_COLORS[status.status] ?? '#94a3b8';
			const pct = Math.round((status.count / total) * 100);
			const midAngle = startAngle + GAP / 2 + (slice - GAP) / 2;

			const g = document.createElementNS(svgNS, 'g');
			g.setAttribute('class', 'umos-tasks-tag-segment');
			svg.appendChild(g);

			const path = document.createElementNS(svgNS, 'path');
			path.setAttribute('d', segmentPath(startAngle + GAP / 2, endAngle));
			path.setAttribute('fill', color);
			g.appendChild(path);

			if (slice > 0.35) {
				const lr = (r1 + r2) / 2;
				const lp = polar(midAngle, lr);

				const txt = document.createElementNS(svgNS, 'text');
				txt.setAttribute('x', String(lp.x));
				txt.setAttribute('y', String(lp.y));
				txt.setAttribute('text-anchor', 'middle');
				txt.setAttribute('dominant-baseline', 'middle');
				txt.setAttribute('class', 'umos-tasks-tag-label');
				txt.setAttribute('pointer-events', 'none');
				txt.textContent = `${pct}%`;
				g.appendChild(txt);
			}

			g.addEventListener('mouseenter', () => activate(g, midAngle, status, pct));
			g.addEventListener('mouseleave', deactivate);

			g.addEventListener('touchstart', (e) => {
				e.preventDefault();
				if (activeGroup === g) {
					deactivate();
				} else {
					activate(g, midAngle, status, pct);
				}
			}, { passive: false });

			startAngle += slice;
		});

		const centerPct = document.createElementNS(svgNS, 'text');
		centerPct.setAttribute('x', String(cx));
		centerPct.setAttribute('y', String(cy - 8));
		centerPct.setAttribute('text-anchor', 'middle');
		centerPct.setAttribute('dominant-baseline', 'middle');
		centerPct.setAttribute('class', 'umos-tasks-tag-center-pct');
		centerPct.setAttribute('pointer-events', 'none');
		centerPct.textContent = String(total);
		svg.appendChild(centerPct);

		const centerLabel = document.createElementNS(svgNS, 'text');
		centerLabel.setAttribute('x', String(cx));
		centerLabel.setAttribute('y', String(cy + 12));
		centerLabel.setAttribute('text-anchor', 'middle');
		centerLabel.setAttribute('dominant-baseline', 'middle');
		centerLabel.setAttribute('class', 'umos-tasks-tag-center-label');
		centerLabel.setAttribute('pointer-events', 'none');
		centerLabel.textContent = 'TASKS';
		svg.appendChild(centerLabel);

		wrap.appendChild(svg);

		this.registerDomEvent(document, 'touchstart', (e: TouchEvent) => {
			if (activeTooltipPath && !svg.contains(e.target as Node)) {
				deactivate();
			}
		});
	}

	private createCard(container: HTMLElement, value: string, sub: string, label: string, variant: string): void {
		const card = container.createDiv({ cls: `umos-tasks-stat-card umos-tasks-stat-card--${variant}` });
		const top = card.createDiv({ cls: 'umos-tasks-stat-top' });
		top.createSpan({ cls: 'umos-tasks-stat-value', text: value });
		if (sub) top.createSpan({ cls: 'umos-tasks-stat-sub', text: sub });
		card.createDiv({ cls: 'umos-tasks-stat-label', text: label });
	}

	private createPill(container: HTMLElement, value: string, label: string): void {
		const pill = container.createDiv({ cls: 'umos-tasks-stat-pill' });
		pill.createSpan({ cls: 'umos-tasks-stat-pill-value', text: value });
		pill.createSpan({ cls: 'umos-tasks-stat-pill-label', text: label });
	}
}
