import { App } from "obsidian";
import { EventBus } from "../../EventBus";
import { BaseWidget } from "../../core/BaseWidget";
import { createElement } from "../../utils/dom";

export interface QuranTrackerConfig {
	style: "grid" | "progress" | "both";
}

interface QuranTrackerData {
	juzStatus: Record<number, "not-started" | "in-progress" | "completed">;
	completedJuz: number[];
	dailyPages: number;
	lastReadDate: string;
	streak: number;
	longestStreak: number;
}

export class QuranTracker extends BaseWidget {
	private obsidianApp: App;
	protected eventBus: EventBus;
	private config: QuranTrackerConfig;
	private getData: () => QuranTrackerData;
	private saveData: (data: Partial<QuranTrackerData>) => Promise<void>;

	constructor(
		containerEl: HTMLElement,
		config: QuranTrackerConfig,
		app: App,
		eventBus: EventBus,
		getData: () => QuranTrackerData,
		saveData: (data: Partial<QuranTrackerData>) => Promise<void>
	) {
		super(containerEl);
		this.obsidianApp = app;
		this.eventBus = eventBus;
		this.config = config;
		this.getData = getData;
		this.saveData = saveData;
	}

	protected render(): void {
		this.containerEl.empty();

		const wrapper = createElement("div", {
			cls: "umos-quran-tracker",
			parent: this.containerEl,
		});

		// Заголовок
		createElement("div", {
			cls: "umos-quran-tracker-title",
			text: "📖 Прогресс чтения Корана",
			parent: wrapper,
		});

		const data = this.getData();

		// Статистика
		if (this.config.style === "progress" || this.config.style === "both") {
			this.renderStats(wrapper, data);
		}

		// Juz Grid
		if (this.config.style === "grid" || this.config.style === "both") {
			this.renderJuzGrid(wrapper, data);
		}
	}

	private renderStats(parent: HTMLElement, data: QuranTrackerData): void {
		const statsRow = createElement("div", {
			cls: "umos-quran-stats-row",
			parent,
		});

		const completedCount = data.completedJuz.length;
		const inProgressCount = Object.values(data.juzStatus).filter(
			(s) => s === "in-progress"
		).length;
		const totalPages = 604;
		const pagesRead = Math.round((completedCount / 30) * totalPages);
		const percent = Math.round((completedCount / 30) * 100);

		// Карточки статистики
		this.renderStatCard(statsRow, "📚", "Завершено", `${completedCount}/30`);
		this.renderStatCard(statsRow, "📖", "В процессе", `${inProgressCount}`);
		this.renderStatCard(statsRow, "📄", "Страниц", `${pagesRead}/${totalPages}`);
		this.renderStatCard(statsRow, "📊", "Прогресс", `${percent}%`);
		this.renderStatCard(statsRow, "🔥", "Серия", `${data.streak} дн.`);

		// Прогресс-бар
		const barContainer = createElement("div", {
			cls: "umos-progress-container umos-quran-progress",
			parent,
		});

		const bar = createElement("div", {
			cls: "umos-progress-bar",
			parent: barContainer,
		});
		bar.style.width = `${percent}%`;
		bar.style.background = "var(--umos-success)";
	}

	private renderStatCard(parent: HTMLElement, icon: string, label: string, value: string): void {
		const card = createElement("div", {
			cls: "umos-quran-stat-card",
			parent,
		});

		createElement("div", {
			cls: "umos-quran-stat-icon",
			text: icon,
			parent: card,
		});

		createElement("div", {
			cls: "umos-quran-stat-value",
			text: value,
			parent: card,
		});

		createElement("div", {
			cls: "umos-quran-stat-label",
			text: label,
			parent: card,
		});
	}

	private renderJuzGrid(parent: HTMLElement, data: QuranTrackerData): void {
		const grid = createElement("div", {
			cls: "umos-quran-juz-grid",
			parent,
		});

		for (let juz = 1; juz <= 30; juz++) {
			const status = data.juzStatus[juz] || "not-started";
			const isCompleted = status === "completed";
			const isInProgress = status === "in-progress";

			const cell = createElement("div", {
				cls: `umos-quran-juz-cell umos-quran-juz-${status}`,
				parent: grid,
				attr: {
					"aria-label": `Джуз ${juz}: ${this.getStatusLabelRu(status)}`,
					tabindex: "0",
					role: "button",
				},
			});

			createElement("span", {
				cls: "umos-quran-juz-number",
				text: String(juz),
				parent: cell,
			});

			if (isCompleted) {
				createElement("span", {
					cls: "umos-quran-juz-check",
					text: "✓",
					parent: cell,
				});
			}

			// Клик — переключение статуса
			this.registerDomEvent(cell, "click", () => {
				this.cycleJuzStatus(juz, data);
			});

			this.registerDomEvent(cell, "keydown", (e: KeyboardEvent) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					this.cycleJuzStatus(juz, data);
				}
			});
		}
	}

	private cycleJuzStatus(juz: number, data: QuranTrackerData): void {
		const current = data.juzStatus[juz] || "not-started";
		let next: "not-started" | "in-progress" | "completed";

		switch (current) {
			case "not-started":
				next = "in-progress";
				break;
			case "in-progress":
				next = "completed";
				break;
			case "completed":
				next = "not-started";
				break;
			default:
				next = "not-started";
		}

		data.juzStatus[juz] = next;

		// Обновляем completedJuz
		data.completedJuz = [];
		for (let i = 1; i <= 30; i++) {
			if (data.juzStatus[i] === "completed") {
				data.completedJuz.push(i);
			}
		}

		this.saveData({
			juzStatus: { ...data.juzStatus },
			completedJuz: [...data.completedJuz],
		});

		this.render();
	}

	private getStatusLabelRu(status: string): string {
		switch (status) {
			case "not-started":
				return "Не начат";
			case "in-progress":
				return "В процессе";
			case "completed":
				return "Завершён";
			default:
				return status;
		}
	}
}