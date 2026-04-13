import { App } from "obsidian";
import { StatsEngine } from "./StatsEngine";
import { EventBus } from "../EventBus";
import { BaseWidget, EventSubscription } from "../core/BaseWidget";
import { createElement } from "../utils/dom";
import { renderSparkline, renderRingChart, renderBarChart, getTrend, getTrendIcon, getTrendClass } from "./Charts";
import { formatDate } from "../utils/date";

export interface StatsWidgetConfig {
	metrics: string[];
	period: number;
	chart: "sparkline" | "bar" | "ring" | "none";
	compare: boolean;
}

const METRIC_LABELS: Record<string, string> = {
	mood: "😊 Настроение",
	productivity: "⚡ Продуктивность",
	sleep: "😴 Сон",
	prayer_count: "🕌 Намазы",
	exercise: "🏋️ Упражнения",
	reading: "📚 Чтение",
	water: "💧 Вода",
	quran: "📖 Коран",
	study: "🎓 Учёба",
};

const METRIC_COLORS: Record<string, string> = {
	mood: "#f39c12",
	productivity: "#3498db",
	sleep: "#9b59b6",
	prayer_count: "#27ae60",
	exercise: "#e74c3c",
	reading: "#1abc9c",
	water: "#2980b9",
	quran: "#27ae60",
	study: "#8e44ad",
};

export class StatsWidget extends BaseWidget {
	private obsidianApp: App;
	private statsEngine: StatsEngine;
	protected eventBus: EventBus;
	private config: StatsWidgetConfig;

	constructor(
		containerEl: HTMLElement,
		config: StatsWidgetConfig,
		app: App,
		statsEngine: StatsEngine,
		eventBus: EventBus
	) {
		super(containerEl);
		this.obsidianApp = app;
		this.statsEngine = statsEngine;
		this.eventBus = eventBus;
		this.config = config;
	}

	protected subscribeToEvents(): EventSubscription[] {
		const rerender = () => this.render();
		return [
			{ event: "stats:recalculated", handler: rerender },
			{ event: "frontmatter:changed", handler: rerender },
		];
	}

	protected render(): void {
		this.containerEl.empty();

		const wrapper = createElement("div", {
			cls: "umos-stats-widget",
			parent: this.containerEl,
		});

		createElement("div", {
			cls: "umos-stats-title",
			text: "📊 Статистика",
			parent: wrapper,
		});

		const subtitle = `Последние ${this.config.period} дней`;
		createElement("div", {
			cls: "umos-stats-subtitle",
			text: subtitle,
			parent: wrapper,
		});

		// Карточки метрик
		const cardsGrid = createElement("div", {
			cls: "umos-stats-cards",
			parent: wrapper,
		});

		for (const metric of this.config.metrics) {
			this.renderMetricCard(cardsGrid, metric);
		}

		// Таблица намазов (если prayer_count в метриках)
		if (this.config.metrics.includes("prayer_count")) {
			this.renderPrayerTable(wrapper);
		}
	}

	private renderMetricCard(parent: HTMLElement, metric: string): void {
		const result = this.statsEngine.getMetricData(metric, this.config.period);
		const label = METRIC_LABELS[metric] || metric;
		const color = METRIC_COLORS[metric] || "var(--umos-accent)";

		const card = createElement("div", {
			cls: "umos-stats-card umos-card",
			parent,
		});

		// Заголовок карточки
		const header = createElement("div", {
			cls: "umos-stats-card-header",
			parent: card,
		});

		createElement("span", {
			cls: "umos-stats-card-label",
			text: label,
			parent: header,
		});

		// Тренд
		if (result.data.length >= 2) {
			const trend = getTrend(result.data.map((d) => d.value));
			const trendEl = createElement("span", {
				cls: `umos-stats-card-trend ${getTrendClass(trend.direction)}`,
				text: getTrendIcon(trend.direction),
				parent: header,
			});
		}

		// Значение (среднее)
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
			text: metric === "prayer_count" ? `${result.avg}/5` : String(result.avg),
			parent: valueRow,
		});

		// Детали
		const details = createElement("div", {
			cls: "umos-stats-card-details",
			parent: card,
		});

		createElement("span", {
			cls: "umos-stats-card-detail",
			text: `мин: ${result.min}`,
			parent: details,
		});

		createElement("span", {
			cls: "umos-stats-card-detail",
			text: `макс: ${result.max}`,
			parent: details,
		});

		createElement("span", {
			cls: "umos-stats-card-detail",
			text: `серия: ${result.streak}д`,
			parent: details,
		});

		// График
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

		// Сравнение
		if (this.config.compare && result.data.length > 1) {
			const halfPeriod = Math.floor(this.config.period / 2);
			const recent = this.statsEngine.getMetricData(metric, halfPeriod);
			const earlier = this.statsEngine.getMetricData(metric, this.config.period);

			if (recent.count > 0 && earlier.count > recent.count) {
				const diff = recent.avg - (earlier.sum - recent.sum) / (earlier.count - recent.count);
				const diffPercent = earlier.avg > 0 ? Math.round((diff / earlier.avg) * 100) : 0;
				const sign = diffPercent >= 0 ? "+" : "";

				createElement("div", {
					cls: `umos-stats-card-compare ${diffPercent >= 0 ? "umos-trend-up" : "umos-trend-down"}`,
					text: `${sign}${diffPercent}% vs предыдущий период`,
					parent: card,
				});
			}
		}
	}

	private renderPrayerTable(parent: HTMLElement): void {
		const prayers = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
		const prayerLabels: Record<string, string> = {
			fajr: "Фаджр",
			dhuhr: "Зухр",
			asr: "Аср",
			maghrib: "Магриб",
			isha: "Иша",
		};
		const dayLabels = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

		createElement("div", {
			cls: "umos-stats-section-title",
			text: "🕌 Намазы за неделю",
			parent,
		});

		const table = createElement("div", {
			cls: "umos-stats-prayer-table",
			parent,
		});

		// Заголовок: пустая ячейка + дни недели
		const headerRow = createElement("div", {
			cls: "umos-stats-prayer-row umos-stats-prayer-header-row",
			parent: table,
		});

		createElement("div", {
			cls: "umos-stats-prayer-cell umos-stats-prayer-label",
			text: "",
			parent: headerRow,
		});

		// Получаем даты последних 7 дней
		const dates: string[] = [];
		const today = new Date();
		for (let i = 6; i >= 0; i--) {
			const d = new Date(today);
			d.setDate(d.getDate() - i);
			dates.push(formatDate(d));
		}

		dates.forEach((dateStr, i) => {
			const d = new Date(dateStr + "T00:00:00");
			const dayIdx = (d.getDay() + 6) % 7; // Понедельник = 0
			createElement("div", {
				cls: "umos-stats-prayer-cell umos-stats-prayer-day",
				text: dayLabels[dayIdx],
				parent: headerRow,
			});
		});

		// Строки: каждый намаз
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