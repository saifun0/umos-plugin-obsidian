import { App, EventRef } from 'obsidian';
import UmOSPlugin from '../../main';
import { TaskService } from './TaskService';
import { BaseWidget } from '../../core/BaseWidget';

export class TasksStatsWidget extends BaseWidget {
	private app: App;
	private plugin: UmOSPlugin;
	private service: TaskService;
	private config: Record<string, unknown>;
	private renderTimeout: ReturnType<typeof setTimeout> | null = null;

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

		const extended = await this.service.getExtendedStats(this.config);
		const stats = extended.base;

		if (stats.total === 0) {
			const empty = this.containerEl.createDiv({ cls: 'umos-tasks-stats-empty' });
			empty.createSpan({ text: '📭 Задачи не найдены' });
			return;
		}

		const wrapper = this.containerEl.createDiv({ cls: 'umos-tasks-stats' });

		// ── Основные карточки ──
		const mainGrid = wrapper.createDiv({ cls: 'umos-tasks-stats-grid' });
		this.createCard(mainGrid, String(stats.done), `/ ${stats.total}`, 'Выполнено', 'done');
		this.createCard(mainGrid, String(stats.pending), 'задач', 'В работе', 'pending');
		this.createCard(mainGrid, String(stats.overdue), 'задач', 'Просрочено', 'overdue');
		this.createCard(mainGrid, `${stats.completionPercentage}%`, '', 'Прогресс', 'progress');

		// ── Прогресс-бар ──
		const progressSection = wrapper.createDiv({ cls: 'umos-tasks-stats-progress' });
		const track = progressSection.createDiv({ cls: 'umos-tasks-stats-progress-track' });
		track.createDiv({
			cls: 'umos-tasks-stats-progress-fill',
			attr: { style: `width: ${stats.completionPercentage}%` },
		});
		progressSection.createDiv({
			cls: 'umos-tasks-stats-progress-label',
			text: `${stats.done} из ${stats.total} задач выполнено`,
		});

		// ── Вторичная статистика ──
		const strip = wrapper.createDiv({ cls: 'umos-tasks-stats-strip' });
		this.createPill(strip, String(extended.completedLast7), 'за 7 дней');
		this.createPill(strip, String(extended.completedLast30), 'за 30 дней');
		this.createPill(strip, `${extended.streak}`, 'streak');
		if (extended.avgCompletionDays !== null) {
			this.createPill(strip, `${extended.avgCompletionDays}д`, 'среднее');
		}

		// ── Диаграмма тегов ──
		const tagStats = await this.service.getTagStats(this.config);
		if (tagStats.length > 0) {
			const tagSection = wrapper.createDiv({ cls: 'umos-tasks-tag-chart-section' });
			tagSection.createDiv({ cls: 'umos-tasks-stats-chart-title', text: 'По тегам' });
			this.renderTagDonut(tagSection, tagStats, stats.completionPercentage);
		}

		// ── График за 30 дней ──
		if (extended.dailyCompleted.length > 0) {
			const chartSection = wrapper.createDiv({ cls: 'umos-tasks-stats-chart-section' });
			chartSection.createDiv({ cls: 'umos-tasks-stats-chart-title', text: 'Активность за 30 дней' });

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

	private renderTagDonut(
		container: HTMLElement,
		tags: { tag: string; count: number; done: number }[],
		overallPct: number,
	): void {
		const PALETTE = ['#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];
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
			const color = PALETTE[i % PALETTE.length];
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
		centerLabel.textContent = 'ВЫПОЛНЕНО';
		svg.appendChild(centerLabel);

		wrap.appendChild(svg);

		// Hide on outside tap (mobile)
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
