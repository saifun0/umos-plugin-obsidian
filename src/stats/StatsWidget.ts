import { App, moment } from "obsidian";
import { StatsEngine } from "./StatsEngine";
import { EventBus } from "../EventBus";
import { BaseWidget, EventSubscription } from "../core/BaseWidget";
import { createElement } from "../utils/dom";
import { renderSparkline, getTrend, getTrendIcon, getTrendClass } from "./Charts";
import { formatDate } from "../utils/date";
import type { UmOSSettings } from "../settings/Settings";

export interface StatsWidgetConfig {
	metrics?: string[];
	period?: number;
	range?: string;
	dateFrom?: string;
	dateTo?: string;
	chart: "sparkline" | "bar" | "ring" | "none";
	compare: boolean;
}

type StatsRangePreset = "7" | "14" | "30" | "year" | "custom";

interface StatsDateRange {
	from: string;
	to: string;
	days: number;
	label: string;
}

const METRIC_LABELS: Record<string, string> = {
	mood: "😊 Mood",
	productivity: "⚡ Productivity",
	sleep: "😴 Sleep",
	prayer_count: "🕌 Prayers",
};

const METRIC_COLORS: Record<string, string> = {
	mood: "#f39c12",
	productivity: "#3498db",
	sleep: "#9b59b6",
	prayer_count: "#27ae60",
};

export class StatsWidget extends BaseWidget {
	private obsidianApp: App;
	private statsEngine: StatsEngine;
	protected eventBus: EventBus;
	private config: StatsWidgetConfig;
	private settings: UmOSSettings;
	private rangePreset: StatsRangePreset = "14";
	private customFrom = "";
	private customTo = "";
	private storageKey: string;

	constructor(
		containerEl: HTMLElement,
		config: StatsWidgetConfig,
		app: App,
		statsEngine: StatsEngine,
		eventBus: EventBus,
		settings: UmOSSettings
	) {
		super(containerEl);
		this.obsidianApp = app;
		this.statsEngine = statsEngine;
		this.eventBus = eventBus;
		this.config = config;
		this.settings = settings;
		this.storageKey = `umos-stats-range:${this.hashConfig(config)}`;
		this.applyInitialRangeFromConfig();
		this.loadRangeState();
	}

	protected subscribeToEvents(): EventSubscription[] {
		const rerender = () => this.render();
		return [
			{ event: "stats:recalculated", handler: rerender },
			{ event: "frontmatter:changed", handler: rerender },
			{ event: "settings:changed", handler: rerender },
		];
	}

	protected render(): void {
		this.containerEl.empty();
		const range = this.getDateRange();
		const metrics = this.resolveMetrics();

		const wrapper = createElement("div", {
			cls: "umos-stats-widget",
			parent: this.containerEl,
		});

		createElement("div", {
			cls: "umos-stats-title",
			text: "📊 Stats",
			parent: wrapper,
		});

		this.renderRangeControls(wrapper);

		const subtitle = range.label;
		createElement("div", {
			cls: "umos-stats-subtitle",
			text: subtitle,
			parent: wrapper,
		});

		//
		const cardsGrid = createElement("div", {
			cls: "umos-stats-cards",
			parent: wrapper,
		});

		if (metrics.length === 0) {
			createElement("div", {
				cls: "umos-stats-empty",
				text: "No metrics enabled for stats",
				parent: cardsGrid,
			});
			return;
		}

		for (const metric of metrics) {
			this.renderMetricCard(cardsGrid, metric, range);
		}

		//   ( prayer_count  )
		if (metrics.includes("prayer_count")) {
			this.renderPrayerTable(wrapper, range);
		}
	}

	private renderRangeControls(parent: HTMLElement): void {
		const controls = createElement("div", { cls: "umos-stats-range-controls", parent });
		createElement("span", { cls: "umos-stats-range-label", text: "Range", parent: controls });

		const select = controls.createEl("select", {
			cls: "umos-stats-range-select",
			attr: { "aria-label": "Stats range" },
		}) as HTMLSelectElement;

		const options: { value: StatsRangePreset; label: string }[] = [
			{ value: "7", label: "7 days" },
			{ value: "14", label: "14 days" },
			{ value: "30", label: "30 days" },
			{ value: "year", label: "Year" },
			{ value: "custom", label: "Custom" },
		];

		for (const option of options) {
			select.createEl("option", { value: option.value, text: option.label });
		}

		select.value = this.rangePreset;
		select.addEventListener("change", () => {
			this.rangePreset = select.value as StatsRangePreset;
			if (this.rangePreset === "custom") this.ensureCustomRange();
			this.saveRangeState();
			this.render();
		});

		if (this.rangePreset === "custom") {
			this.ensureCustomRange();
			const custom = createElement("div", { cls: "umos-stats-range-custom", parent: controls });
			const fromInput = custom.createEl("input", {
				cls: "umos-stats-range-date",
				attr: { type: "date", value: this.customFrom, "aria-label": "Range start" },
			}) as HTMLInputElement;
			const toInput = custom.createEl("input", {
				cls: "umos-stats-range-date",
				attr: { type: "date", value: this.customTo, "aria-label": "Range end" },
			}) as HTMLInputElement;

			fromInput.addEventListener("change", () => {
				this.customFrom = fromInput.value;
				this.saveRangeState();
				this.render();
			});
			toInput.addEventListener("change", () => {
				this.customTo = toInput.value;
				this.saveRangeState();
				this.render();
			});
		}
	}

	private getDateRange(): StatsDateRange {
		const today = moment().startOf("day");
		let from = today.clone().subtract(13, "days");
		let to = today.clone();
		let label = "Last 14 days";

		if (this.rangePreset === "7") {
			from = today.clone().subtract(6, "days");
			label = "Last 7 days";
		} else if (this.rangePreset === "30") {
			from = today.clone().subtract(29, "days");
			label = "Last 30 days";
		} else if (this.rangePreset === "year") {
			from = today.clone().subtract(364, "days");
			label = "Last year";
		} else if (this.rangePreset === "custom") {
			this.ensureCustomRange();
			const customFrom = moment(this.customFrom).startOf("day");
			const customTo = moment(this.customTo).startOf("day");
			if (customFrom.isValid() && customTo.isValid()) {
				from = customFrom.isAfter(customTo) ? customTo : customFrom;
				to = customFrom.isAfter(customTo) ? customFrom : customTo;
			}
			label = `${from.format("DD.MM.YYYY")} - ${to.format("DD.MM.YYYY")}`;
		}

		const days = Math.max(to.diff(from, "days") + 1, 1);
		return {
			from: from.format("YYYY-MM-DD"),
			to: to.format("YYYY-MM-DD"),
			days,
			label,
		};
	}

	private getPreviousRange(range: StatsDateRange): StatsDateRange {
		const to = moment(range.from).subtract(1, "day");
		const from = to.clone().subtract(range.days - 1, "days");
		return {
			from: from.format("YYYY-MM-DD"),
			to: to.format("YYYY-MM-DD"),
			days: range.days,
			label: "Previous period",
		};
	}

	private renderMetricCard(parent: HTMLElement, metric: string, range: StatsDateRange): void {
		const result = this.statsEngine.getMetricDataForRange(metric, range.from, range.to);
		const meta = this.getMetricMeta(metric);
		const label = meta.label;
		const color = meta.color;

		const card = createElement("div", {
			cls: "umos-stats-card umos-card",
			parent,
		});

		// Title
		const header = createElement("div", {
			cls: "umos-stats-card-header",
			parent: card,
		});

		createElement("span", {
			cls: "umos-stats-card-label",
			text: label,
			parent: header,
		});

		//
		if (result.data.length >= 2) {
			const trend = getTrend(result.data.map((d) => d.value));
			const trendEl = createElement("span", {
				cls: `umos-stats-card-trend ${getTrendClass(trend.direction)}`,
				text: getTrendIcon(trend.direction),
				parent: header,
			});
		}

		//  (average)
		const valueRow = createElement("div", {
			cls: "umos-stats-card-value-row",
			parent: card,
		});
		createElement("span", {
			cls: "umos-stats-card-avg-label",
			text: "AVG",
			parent: valueRow,
		});
		createElement("span", {
			cls: "umos-stats-card-value",
			text: this.formatMetricValue(metric, result.avg),
			parent: valueRow,
		});

		//
		const details = createElement("div", {
			cls: "umos-stats-card-details",
			parent: card,
		});

		createElement("span", {
			cls: "umos-stats-card-detail",
			text: `min: ${result.min}`,
			parent: details,
		});

		createElement("span", {
			cls: "umos-stats-card-detail",
			text: `max: ${result.max}`,
			parent: details,
		});

		createElement("span", {
			cls: "umos-stats-card-detail",
			text: `streak: ${result.streak}d`,
			parent: details,
		});

		//
		if (this.config.chart !== "none" && result.data.length > 1) {
			const chartContainer = createElement("div", {
				cls: "umos-stats-card-chart",
				parent: card,
			});

			if (this.config.chart === "sparkline" || this.config.chart === "bar") {
				renderSparkline(chartContainer, result.data.map((d) => d.value), {
					width: 200,
					height: 36,
					color,
				});
			}
		}

		// Wed
		if (this.config.compare && result.data.length > 1) {
			const previous = this.getPreviousRange(range);
			const earlier = this.statsEngine.getMetricDataForRange(metric, previous.from, previous.to);

			if (earlier.count > 0) {
				const diff = result.avg - earlier.avg;
				const diffPercent = earlier.avg > 0 ? Math.round((diff / earlier.avg) * 100) : 0;
				const sign = diffPercent >= 0 ? "+" : "";

				createElement("div", {
					cls: `umos-stats-card-compare ${diffPercent >= 0 ? "umos-trend-up" : "umos-trend-down"}`,
					text: `${sign}${diffPercent}% vs previous period`,
					parent: card,
				});
			}
		}
	}

	private resolveMetrics(): string[] {
		if (Array.isArray(this.config.metrics) && this.config.metrics.length > 0) {
			const explicit = this.uniqueMetrics(this.config.metrics.map(String));
			if (!this.isLegacyDefaultMetrics(explicit)) {
				return explicit;
			}
		}

		const metrics: string[] = [];
		if (this.settings.dailySections.ratings) {
			metrics.push("mood", "productivity", "sleep");
		}
		if (this.settings.dailySections.prayers) {
			metrics.push("prayer_count");
		}
		if (this.settings.dailySections.habits) {
			for (const habit of this.settings.habits) {
				metrics.push(habit.id);
			}
		}

		return this.uniqueMetrics(metrics);
	}

	private isLegacyDefaultMetrics(metrics: string[]): boolean {
		const legacy = ["mood", "productivity", "sleep", "prayer_count"];
		return metrics.length === legacy.length && legacy.every(metric => metrics.includes(metric));
	}

	private uniqueMetrics(metrics: string[]): string[] {
		return [...new Set(metrics.map(metric => metric.trim()).filter(Boolean))];
	}

	private getMetricMeta(metric: string): { label: string; color: string; suffix?: string } {
		const habit = this.settings.habits.find(item => item.id === metric);
		if (habit) {
			return {
				label: `${habit.icon} ${habit.name}`,
				color: habit.color || "var(--umos-accent)",
			};
		}

		return {
			label: METRIC_LABELS[metric] || metric,
			color: METRIC_COLORS[metric] || "var(--umos-accent)",
			suffix: metric === "sleep" ? "h" : undefined,
		};
	}

	private formatMetricValue(metric: string, value: number): string {
		if (metric === "prayer_count") return `${value}/5`;
		const meta = this.getMetricMeta(metric);
		return `${value}${meta.suffix || ""}`;
	}

	private applyInitialRangeFromConfig(): void {
		const rawRange = String(this.config.range || "").toLowerCase();
		if (["7", "14", "30", "year", "custom"].includes(rawRange)) {
			this.rangePreset = rawRange as StatsRangePreset;
		} else if (this.config.period) {
			const period = Number(this.config.period);
			if (period <= 7) this.rangePreset = "7";
			else if (period <= 14) this.rangePreset = "14";
			else if (period <= 30) this.rangePreset = "30";
			else this.rangePreset = "year";
		}

		if (this.config.dateFrom) this.customFrom = String(this.config.dateFrom);
		if (this.config.dateTo) this.customTo = String(this.config.dateTo);
	}

	private ensureCustomRange(): void {
		const today = moment().format("YYYY-MM-DD");
		if (!this.customTo) this.customTo = today;
		if (!this.customFrom) this.customFrom = moment(today).subtract(29, "days").format("YYYY-MM-DD");
	}

	private loadRangeState(): void {
		try {
			const raw = localStorage.getItem(this.storageKey);
			if (!raw) return;
			const parsed = JSON.parse(raw) as Partial<{
				preset: StatsRangePreset;
				customFrom: string;
				customTo: string;
			}>;
			if (parsed.preset && ["7", "14", "30", "year", "custom"].includes(parsed.preset)) {
				this.rangePreset = parsed.preset;
			}
			if (typeof parsed.customFrom === "string") this.customFrom = parsed.customFrom;
			if (typeof parsed.customTo === "string") this.customTo = parsed.customTo;
		} catch {
			// ignore stored range errors
		}
	}

	private saveRangeState(): void {
		try {
			localStorage.setItem(this.storageKey, JSON.stringify({
				preset: this.rangePreset,
				customFrom: this.customFrom,
				customTo: this.customTo,
			}));
		} catch {
			// localStorage can be unavailable in restricted environments
		}
	}

	private hashConfig(config: StatsWidgetConfig): string {
		try {
			return btoa(unescape(encodeURIComponent(JSON.stringify({
				metrics: config.metrics,
				chart: config.chart,
				compare: config.compare,
			})))).slice(0, 24);
		} catch {
			return "default";
		}
	}

	private renderPrayerTable(parent: HTMLElement, range: StatsDateRange): void {
		const prayers = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
		const prayerLabels: Record<string, string> = {
			fajr: "Fajr",
			dhuhr: "Dhuhr",
			asr: "Asr",
			maghrib: "Maghrib",
			isha: "Isha",
		};
		const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

		createElement("div", {
			cls: "umos-stats-section-title",
			text: range.days > 14 ? "🕌 Prayers: last 14 days of range" : "🕌 Prayers",
			parent,
		});

		const table = createElement("div", {
			cls: "umos-stats-prayer-table",
			parent,
		});
		table.style.setProperty("--umos-stats-prayer-days", String(Math.min(range.days, 14)));

		// Title:   +  wk
		const headerRow = createElement("div", {
			cls: "umos-stats-prayer-row umos-stats-prayer-header-row",
			parent: table,
		});

		createElement("div", {
			cls: "umos-stats-prayer-cell umos-stats-prayer-label",
			text: "",
			parent: headerRow,
		});

		//      ,    .
		const dates: string[] = [];
		const daysToShow = Math.min(range.days, 14);
		const end = new Date(`${range.to}T00:00:00`);
		for (let i = daysToShow - 1; i >= 0; i--) {
			const d = new Date(end);
			d.setDate(d.getDate() - i);
			dates.push(formatDate(d));
		}

		dates.forEach((dateStr, i) => {
			const d = new Date(dateStr + "T00:00:00");
			const dayIdx = (d.getDay() + 6) % 7; // Monday = 0
			createElement("div", {
				cls: "umos-stats-prayer-cell umos-stats-prayer-day",
				text: dayLabels[dayIdx],
				parent: headerRow,
			});
		});

		// :
		for (const prayer of prayers) {
			const row = createElement("div", {
				cls: "umos-stats-prayer-row",
				parent: table,
			});

			createElement("div", {
				cls: "umos-stats-prayer-cell umos-stats-prayer-label",
				text: prayerLabels[prayer],
				parent: row,
			});

			for (const dateStr of dates) {
				const value = this.statsEngine.getValueForDate(dateStr, prayer);
				const done = value === 1;

				createElement("div", {
					cls: `umos-stats-prayer-cell umos-stats-prayer-status ${done ? "umos-stats-prayer-done" : "umos-stats-prayer-missed"}`,
					text: done ? "✅" : "❌",
					parent: row,
				});
			}
		}
	}
}
