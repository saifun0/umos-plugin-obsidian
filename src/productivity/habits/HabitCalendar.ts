import { App } from "obsidian";
import { EventBus } from "../../EventBus";
import { BaseWidget, EventSubscription } from "../../core/BaseWidget";
import { UmOSSettings } from "../../settings/Settings";
import { StatsEngine } from "../../stats/StatsEngine";
import { createElement, createSvgElement } from "../../utils/dom";
import { formatDate } from "../../utils/date";

export interface HabitCalendarConfig {
	habit: string;
	months: number;
}

export class HabitCalendar extends BaseWidget {
	private obsidianApp: App;
	protected eventBus: EventBus;
	private settings: UmOSSettings;
	private statsEngine: StatsEngine;
	private config: HabitCalendarConfig;

	constructor(
		containerEl: HTMLElement,
		config: HabitCalendarConfig,
		app: App,
		eventBus: EventBus,
		settings: UmOSSettings,
		statsEngine: StatsEngine
	) {
		super(containerEl);
		this.obsidianApp = app;
		this.eventBus = eventBus;
		this.settings = settings;
		this.statsEngine = statsEngine;
		this.config = config;
	}

	protected subscribeToEvents(): EventSubscription[] {
		const rerender = () => this.render();
		return [
			{ event: "habit:toggled", handler: rerender },
			{ event: "stats:recalculated", handler: rerender },
		];
	}

	protected render(): void {
		this.containerEl.empty();

		const wrapper = createElement("div", {
			cls: "umos-habit-calendar",
			parent: this.containerEl,
		});

		// Найти привычку
		const habit = this.settings.habits.find((h) => h.id === this.config.habit);
		const habitName = habit ? `${habit.icon} ${habit.name}` : this.config.habit;
		const habitColor = habit?.color || "var(--umos-success)";

		// Заголовок
		createElement("div", {
			cls: "umos-habit-calendar-title",
			text: `📊 ${habitName}`,
			parent: wrapper,
		});

		// Статистика
		const stats = this.getStats();
		const statsRow = createElement("div", {
			cls: "umos-habit-calendar-stats",
			parent: wrapper,
		});

		this.renderStat(statsRow, "🔥", "Серия", `${stats.currentStreak} дн.`);
		this.renderStat(statsRow, "🏆", "Рекорд", `${stats.longestStreak} дн.`);
		this.renderStat(statsRow, "📊", "Всего", `${stats.totalDays} дн.`);
		this.renderStat(statsRow, "📈", "Процент", `${stats.percent}%`);

		// SVG Contribution Graph
		const svgContainer = createElement("div", {
			cls: "umos-habit-calendar-svg",
			parent: wrapper,
		});

		this.renderContributionGraph(svgContainer, habitColor);
	}

	private renderStat(parent: HTMLElement, icon: string, label: string, value: string): void {
		const card = createElement("div", {
			cls: "umos-habit-calendar-stat",
			parent,
		});
		createElement("div", { cls: "umos-habit-calendar-stat-icon", text: icon, parent: card });
		createElement("div", { cls: "umos-habit-calendar-stat-value", text: value, parent: card });
		createElement("div", { cls: "umos-habit-calendar-stat-label", text: label, parent: card });
	}

	private renderContributionGraph(container: HTMLElement, color: string): void {
		const totalDays = this.config.months * 30;
		const today = new Date();

		// Собираем данные
		const dayData: { date: string; value: boolean }[] = [];
		for (let i = totalDays - 1; i >= 0; i--) {
			const d = new Date(today);
			d.setDate(d.getDate() - i);
			const dateStr = formatDate(d);
			const val = this.statsEngine.getValueForDate(dateStr, this.config.habit);
			dayData.push({ date: dateStr, value: val === 1 });
		}

		// SVG параметры
		const cellSize = 14;
		const cellGap = 3;
		const cellStep = cellSize + cellGap;
		const rows = 7;
		const cols = Math.ceil(dayData.length / 7);
		const labelWidth = 28;
		const headerHeight = 18;
		const width = labelWidth + cols * cellStep + 4;
		const height = headerHeight + rows * cellStep + 4;

		const svg = createSvgElement("svg", {
			viewBox: `0 0 ${width} ${height}`,
			class: "umos-contribution-graph",
			width: String(width),
			height: String(height),
		}, container);

		// Дни недели labels
		const dayLabels = ["Пн", "", "Ср", "", "Пт", "", "Вс"];
		dayLabels.forEach((label, i) => {
			if (!label) return;
			const text = createSvgElement("text", {
				x: "0",
				y: String(headerHeight + i * cellStep + cellSize - 2),
				"font-size": "9",
				fill: "var(--text-faint)",
				"dominant-baseline": "auto",
			}, svg);
			text.textContent = label;
		});

		// Ячейки
		// Первый день — определяем его день недели (0=Вс, 1=Пн...)
		const firstDate = new Date(today);
		firstDate.setDate(firstDate.getDate() - (totalDays - 1));
		const firstDayOfWeek = (firstDate.getDay() + 6) % 7; // Пн=0

		dayData.forEach((day, i) => {
			const adjustedIndex = i + firstDayOfWeek;
			const col = Math.floor(adjustedIndex / 7);
			const row = adjustedIndex % 7;

			const x = labelWidth + col * cellStep;
			const y = headerHeight + row * cellStep;

			let fillColor: string;
			if (day.value) {
				fillColor = color;
			} else {
				fillColor = "var(--background-modifier-border)";
			}

			const rect = createSvgElement("rect", {
				x: String(x),
				y: String(y),
				width: String(cellSize),
				height: String(cellSize),
				rx: "3",
				ry: "3",
				fill: fillColor,
				class: "umos-contribution-cell",
			}, svg);

			// Tooltip
			const d = new Date(day.date + "T00:00:00");
			const dateLabel = d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
			const status = day.value ? "✅" : "❌";

			const title = createSvgElement("title", {}, rect);
			title.textContent = `${dateLabel}: ${status}`;
		});
	}

	private getStats(): {
		currentStreak: number;
		longestStreak: number;
		totalDays: number;
		percent: number;
	} {
		const totalDays = this.config.months * 30;
		const today = new Date();

		let currentStreak = 0;
		let longestStreak = 0;
		let tempStreak = 0;
		let totalDone = 0;

		// Считаем с сегодня назад для currentStreak
		for (let i = 0; i < totalDays; i++) {
			const d = new Date(today);
			d.setDate(d.getDate() - i);
			const dateStr = formatDate(d);
			const val = this.statsEngine.getValueForDate(dateStr, this.config.habit);

			if (val === 1) {
				if (i === currentStreak) currentStreak++;
			}
		}

		// Считаем с начала для longestStreak и totalDone
		for (let i = totalDays - 1; i >= 0; i--) {
			const d = new Date(today);
			d.setDate(d.getDate() - i);
			const dateStr = formatDate(d);
			const val = this.statsEngine.getValueForDate(dateStr, this.config.habit);

			if (val === 1) {
				totalDone++;
				tempStreak++;
				if (tempStreak > longestStreak) longestStreak = tempStreak;
			} else {
				tempStreak = 0;
			}
		}

		const percent = totalDays > 0 ? Math.round((totalDone / totalDays) * 100) : 0;

		return { currentStreak, longestStreak, totalDays: totalDone, percent };
	}
}