import { App, TFile } from "obsidian";
import { EventBus } from "../../EventBus";
import { UmOSSettings, HabitDefinition } from "../../settings/Settings";
import { BaseWidget, EventSubscription } from "../../core/BaseWidget";
import { FrontmatterHelper } from "../../input/FrontmatterHelper";
import { createElement } from "../../utils/dom";
import { getTodayDateString, formatDate } from "../../utils/date";
import { renderRingChart } from "../../stats/Charts";

export interface HabitTrackerConfig {
	date: string;
	style: "grid" | "list";
}

export class HabitTracker extends BaseWidget {
	private obsidianApp: App;
	protected eventBus: EventBus;
	private settings: UmOSSettings;
	private fmHelper: FrontmatterHelper;
	private config: HabitTrackerConfig;
	private habitValues: Map<string, boolean> = new Map();
	private file: TFile | null = null;

	constructor(
		containerEl: HTMLElement,
		config: HabitTrackerConfig,
		app: App,
		eventBus: EventBus,
		settings: UmOSSettings,
		fmHelper: FrontmatterHelper
	) {
		super(containerEl);
		this.obsidianApp = app;
		this.eventBus = eventBus;
		this.settings = settings;
		this.fmHelper = fmHelper;
		this.config = config;
	}

	onload(): void {
		this.resolveFile();
		this.loadValues();
		super.onload();
	}

	protected subscribeToEvents(): EventSubscription[] {
		const fmHandler = (data: { path: string; property: string; value: unknown }) => {
			if (this.file && data.path === this.file.path) {
				const habit = this.settings.habits.find((h) => h.id === data.property);
				if (habit) {
					this.habitValues.set(habit.id, !!data.value);
					this.render();
				}
			}
		};
		return [{ event: "frontmatter:changed", handler: fmHandler }];
	}

	protected onWidgetLoad(): void {
		this.registerEvent(
			this.obsidianApp.metadataCache.on("changed", (changedFile) => {
				if (this.file && changedFile.path === this.file.path) {
					this.loadValues();
					this.render();
				}
			})
		);
	}

	private resolveFile(): void {
		const dateStr = this.config.date === "today" ? getTodayDateString() : this.config.date;
		const format = this.settings.dailyNoteFormat || "YYYY-MM-DD";
		const parts = dateStr.split("-");
		const fileName = parts.length === 3
			? format.replace("YYYY", parts[0]).replace("MM", parts[1]).replace("DD", parts[2])
			: dateStr;
		const filePath = `${this.settings.dailyNotesPath}/${fileName}.md`;
		const file = this.obsidianApp.vault.getAbstractFileByPath(filePath);
		if (file instanceof TFile) {
			this.file = file;
		}
	}

	private loadValues(): void {
		if (!this.file) return;
		for (const habit of this.settings.habits) {
			const val = this.fmHelper.readProperty(this.file, habit.id);
			this.habitValues.set(habit.id, !!val);
		}
	}

	protected render(): void {
		this.containerEl.empty();

		const wrapper = createElement("div", {
			cls: "umos-habits-widget",
			parent: this.containerEl,
		});

		// Заголовок
		const header = createElement("div", {
			cls: "umos-habits-header",
			parent: wrapper,
		});

		createElement("div", {
			cls: "umos-habits-title",
			text: "🔄 Привычки",
			parent: header,
		});

		// Прогресс
		const doneCount = this.getDoneCount();
		const totalCount = this.settings.habits.length;
		const percent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

		createElement("div", {
			cls: "umos-habits-score",
			text: `${doneCount}/${totalCount} (${percent}%)`,
			parent: header,
		});

		if (!this.file) {
			createElement("div", {
				cls: "umos-info-message",
				text: "Дневная заметка не найдена. Создайте её через команду «umOS: Создать дневную заметку».",
				parent: wrapper,
			});
			return;
		}

		// Ring chart + Grid
		const body = createElement("div", {
			cls: "umos-habits-body",
			parent: wrapper,
		});

		// Ring chart
		const ringContainer = createElement("div", {
			cls: "umos-habits-ring",
			parent: body,
		});
		renderRingChart(ringContainer, percent, {
			size: 70,
			strokeWidth: 6,
			color: "var(--umos-success)",
			showPercent: true,
		});

		// Habits grid/list
		const habitsContainer = createElement("div", {
			cls: `umos-habits-items ${this.config.style === "list" ? "umos-habits-items-list" : "umos-habits-items-grid"}`,
			parent: body,
		});

		for (const habit of this.settings.habits) {
			this.renderHabitItem(habitsContainer, habit);
		}
	}

	private renderHabitItem(parent: HTMLElement, habit: HabitDefinition): void {
		const isDone = this.habitValues.get(habit.id) || false;

		const item = createElement("div", {
			cls: `umos-habit-item ${isDone ? "umos-habit-done" : ""}`,
			parent,
		});

		item.style.setProperty("--umos-habit-color", habit.color);

		const toggle = createElement("div", {
			cls: `umos-habit-toggle ${isDone ? "umos-habit-toggle-on" : ""}`,
			parent: item,
			attr: {
				role: "switch",
				"aria-checked": String(isDone),
				"aria-label": habit.name,
				tabindex: "0",
			},
		});

		createElement("span", {
			cls: "umos-habit-toggle-icon",
			text: isDone ? "✓" : habit.icon,
			parent: toggle,
		});

		createElement("span", {
			cls: "umos-habit-name",
			text: habit.name,
			parent: item,
		});

		this.registerDomEvent(item, "click", () => {
			this.toggleHabit(habit);
		});

		this.registerDomEvent(item, "keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				this.toggleHabit(habit);
			}
		});
	}

	private toggleHabit(habit: HabitDefinition): void {
		if (!this.file) return;

		const current = this.habitValues.get(habit.id) || false;
		const newValue = !current;

		this.habitValues.set(habit.id, newValue);
		this.fmHelper.writeProperty(this.file, habit.id, newValue);

		this.eventBus.emit("habit:toggled", {
			habit: habit.id,
			date: this.config.date === "today" ? getTodayDateString() : this.config.date,
			value: newValue,
		});

		this.render();
	}

	private getDoneCount(): number {
		let count = 0;
		for (const habit of this.settings.habits) {
			if (this.habitValues.get(habit.id)) count++;
		}
		return count;
	}
}