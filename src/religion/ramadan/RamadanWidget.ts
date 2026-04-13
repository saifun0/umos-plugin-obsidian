import { App } from "obsidian";
import { EventBus } from "../../EventBus";
import { BaseWidget, EventSubscription } from "../../core/BaseWidget";
import { UmOSSettings } from "../../settings/Settings";
import { PrayerService } from "../prayer/PrayerService";
import { createElement } from "../../utils/dom";
import { getTodayDateString } from "../../utils/date";

export interface RamadanWidgetConfig {
	style: "full" | "compact";
}

interface RamadanData {
	fastTracker: Record<string, boolean>;
	tarawihTracker: Record<string, boolean>;
}

export class RamadanWidget extends BaseWidget {
	private obsidianApp: App;
	private prayerService: PrayerService;
	protected eventBus: EventBus;
	private settings: UmOSSettings;
	private config: RamadanWidgetConfig;
	private getData: () => RamadanData;
	private saveData: (data: Partial<RamadanData>) => Promise<void>;
	private updateIntervalId: number | null = null;
	private selectedDay: number | null = null;

	constructor(
		containerEl: HTMLElement,
		config: RamadanWidgetConfig,
		app: App,
		prayerService: PrayerService,
		eventBus: EventBus,
		settings: UmOSSettings,
		getData: () => RamadanData,
		saveData: (data: Partial<RamadanData>) => Promise<void>
	) {
		super(containerEl);
		this.obsidianApp = app;
		this.prayerService = prayerService;
		this.eventBus = eventBus;
		this.settings = settings;
		this.config = config;
		this.getData = getData;
		this.saveData = saveData;
	}

	protected subscribeToEvents(): EventSubscription[] {
		return [{ event: "prayer:updated", handler: () => this.render() }];
	}

	protected onWidgetLoad(): void {
		this.updateIntervalId = window.setInterval(() => this.render(), 60000);
	}

	protected onWidgetUnload(): void {
		if (this.updateIntervalId !== null) {
			window.clearInterval(this.updateIntervalId);
			this.updateIntervalId = null;
		}
	}

	protected render(): void {
		this.containerEl.empty();

		const wrapper = createElement("div", {
			cls: "umos-ramadan-widget",
			parent: this.containerEl,
		});

		if (!this.prayerService.isRamadan()) {
			this.renderNotRamadan(wrapper);
			return;
		}

		const hijriDay = this.prayerService.getHijriDay();

		this.renderHeader(wrapper, hijriDay);
		this.renderMealCards(wrapper);
		this.renderToggles(wrapper, hijriDay);
		this.renderGrid(wrapper, hijriDay);
		this.renderStats(wrapper);
	}

	private renderNotRamadan(parent: HTMLElement): void {
		const msg = createElement("div", {
			cls: "umos-ramadan-widget-empty",
			parent,
		});
		createElement("span", {
			cls: "umos-ramadan-widget-empty-icon",
			text: "🌙",
			parent: msg,
		});
		createElement("span", {
			text: "Рамадан ещё не начался",
			parent: msg,
		});
	}

	private renderHeader(parent: HTMLElement, hijriDay: number): void {
		const header = createElement("div", {
			cls: "umos-ramadan-header",
			parent,
		});

		createElement("span", {
			cls: "umos-ramadan-header-icon",
			text: "🌙",
			parent: header,
		});

		createElement("span", {
			cls: "umos-ramadan-header-title",
			text: "Рамадан",
			parent: header,
		});

		createElement("span", {
			cls: "umos-ramadan-day-badge",
			text: `День ${hijriDay} из 30`,
			parent: header,
		});
	}

	private renderMealCards(parent: HTMLElement): void {
		const times = this.prayerService.getTimes();
		if (!times) return;

		const mealsRow = createElement("div", {
			cls: "umos-ramadan-meals",
			parent,
		});

		const suhurTime = times.Fajr;
		const iftarTime = times.Maghrib;

		const now = new Date();
		const currentMinutes = now.getHours() * 60 + now.getMinutes();
		const suhurMinutes = this.timeToMinutes(suhurTime);
		const iftarMinutes = this.timeToMinutes(iftarTime);

		// Сухур card
		const suhurActive = currentMinutes < suhurMinutes;
		this.renderMealCard(mealsRow, "🍽️", "Сухур", suhurTime,
			suhurActive ? this.formatCountdown(suhurMinutes - currentMinutes) : null,
			suhurActive
		);

		// Ифтар card
		const iftarActive = currentMinutes >= suhurMinutes && currentMinutes < iftarMinutes;
		this.renderMealCard(mealsRow, "🌅", "Ифтар", iftarTime,
			iftarActive ? this.formatCountdown(iftarMinutes - currentMinutes) : null,
			iftarActive
		);
	}

	private renderMealCard(
		parent: HTMLElement,
		icon: string,
		label: string,
		time: string,
		countdown: string | null,
		active: boolean
	): void {
		const card = createElement("div", {
			cls: `umos-ramadan-meal-card${active ? " umos-ramadan-meal-card--active" : ""}`,
			parent,
		});

		createElement("span", {
			cls: "umos-ramadan-meal-icon",
			text: icon,
			parent: card,
		});

		const info = createElement("div", {
			cls: "umos-ramadan-meal-info",
			parent: card,
		});

		createElement("span", {
			cls: "umos-ramadan-meal-label",
			text: label,
			parent: info,
		});

		createElement("span", {
			cls: "umos-ramadan-meal-time",
			text: time,
			parent: info,
		});

		if (countdown) {
			createElement("div", {
				cls: "umos-ramadan-countdown",
				text: `через ${countdown}`,
				parent: card,
			});
		}
	}

	private renderToggles(parent: HTMLElement, hijriDay: number): void {
		const activeDay = this.selectedDay ?? hijriDay;
		const dateKey = this.getDayDateKey(activeDay, hijriDay);
		if (!dateKey) return;

		const data = this.getData();
		const isToday = activeDay === hijriDay;

		const togglesSection = createElement("div", {
			cls: "umos-ramadan-toggles-section",
			parent,
		});

		// Header with day label
		const togglesHeader = createElement("div", {
			cls: "umos-ramadan-toggles-header",
			parent: togglesSection,
		});

		createElement("span", {
			cls: "umos-ramadan-toggles-day-label",
			text: isToday ? `Сегодня — День ${activeDay}` : `День ${activeDay} (${dateKey})`,
			parent: togglesHeader,
		});

		if (!isToday) {
			const backBtn = createElement("button", {
				cls: "umos-ramadan-toggles-back",
				text: "← Сегодня",
				parent: togglesHeader,
			});
			backBtn.addEventListener("click", () => {
				this.selectedDay = null;
				this.render();
			});
		}

		const togglesRow = createElement("div", {
			cls: "umos-ramadan-toggles",
			parent: togglesSection,
		});

		// Пост toggle
		this.renderToggle(togglesRow, "Пост", "🕌", data.fastTracker[dateKey] || false, async (value) => {
			const updated = { ...data.fastTracker, [dateKey]: value };
			await this.saveData({ fastTracker: updated });
			this.eventBus.emit("ramadan:toggled", { date: dateKey, field: "fasting", value });
			this.render();
		});

		// Таравих toggle
		this.renderToggle(togglesRow, "Таравих", "🤲", data.tarawihTracker[dateKey] || false, async (value) => {
			const updated = { ...data.tarawihTracker, [dateKey]: value };
			await this.saveData({ tarawihTracker: updated });
			this.eventBus.emit("ramadan:toggled", { date: dateKey, field: "tarawih", value });
			this.render();
		});
	}

	private renderToggle(
		parent: HTMLElement,
		label: string,
		icon: string,
		checked: boolean,
		onChange: (value: boolean) => void
	): void {
		const toggle = createElement("div", {
			cls: `umos-ramadan-toggle${checked ? " umos-ramadan-toggle--active" : ""}`,
			parent,
		});

		const checkbox = createElement("input", {
			attr: { type: "checkbox" },
			parent: toggle,
		}) as HTMLInputElement;
		checkbox.checked = checked;
		checkbox.addEventListener("change", () => {
			onChange(checkbox.checked);
		});

		createElement("span", {
			cls: "umos-ramadan-toggle-icon",
			text: icon,
			parent: toggle,
		});

		createElement("span", {
			cls: "umos-ramadan-toggle-label",
			text: label,
			parent: toggle,
		});
	}

	private renderGrid(parent: HTMLElement, currentDay: number): void {
		const data = this.getData();

		const gridSection = createElement("div", {
			cls: "umos-ramadan-grid-section",
			parent,
		});

		createElement("div", {
			cls: "umos-ramadan-grid-title",
			text: "Прогресс месяца",
			parent: gridSection,
		});

		const grid = createElement("div", {
			cls: "umos-ramadan-grid",
			parent: gridSection,
		});

		// We need to map day numbers to dates
		// The grid shows 30 days of Ramadan
		for (let day = 1; day <= 30; day++) {
			const dateKey = this.getDayDateKey(day, currentDay);
			const fasted = dateKey ? (data.fastTracker[dateKey] || false) : false;
			const tarawih = dateKey ? (data.tarawihTracker[dateKey] || false) : false;
			const isFuture = day > currentDay;
			const isToday = day === currentDay;

			let modifierCls = "";
			if (isFuture) {
				modifierCls = " umos-ramadan-day-cell--future";
			} else if (fasted && tarawih) {
				modifierCls = " umos-ramadan-day-cell--both";
			} else if (fasted) {
				modifierCls = " umos-ramadan-day-cell--fasted";
			} else if (tarawih) {
				modifierCls = " umos-ramadan-day-cell--tarawih";
			}

			if (isToday) {
				modifierCls += " umos-ramadan-day-cell--today";
			}

			const isSelected = day === (this.selectedDay ?? currentDay);
			if (isSelected) {
				modifierCls += " umos-ramadan-day-cell--selected";
			}

			const cell = createElement("div", {
				cls: `umos-ramadan-day-cell${modifierCls}`,
				text: String(day),
				parent: grid,
			});

			if (!isFuture) {
				cell.classList.add("umos-ramadan-day-cell--clickable");
				cell.addEventListener("click", () => {
					this.selectedDay = day === currentDay ? null : day;
					this.render();
				});
			}
		}
	}

	/**
	 * Maps a Ramadan day number to a date string key.
	 * Uses current day and today's date to calculate past dates.
	 */
	private getDayDateKey(day: number, currentDay: number): string | null {
		if (day > currentDay) return null;

		const today = new Date();
		const diff = currentDay - day;
		const targetDate = new Date(today);
		targetDate.setDate(targetDate.getDate() - diff);

		const year = targetDate.getFullYear();
		const month = String(targetDate.getMonth() + 1).padStart(2, "0");
		const d = String(targetDate.getDate()).padStart(2, "0");
		return `${year}-${month}-${d}`;
	}

	private renderStats(parent: HTMLElement): void {
		const data = this.getData();
		const fastCount = Object.values(data.fastTracker).filter(Boolean).length;
		const tarawihCount = Object.values(data.tarawihTracker).filter(Boolean).length;

		const stats = createElement("div", {
			cls: "umos-ramadan-stats",
			parent,
		});

		// Fasting progress
		this.renderProgressBar(stats, "Пост", fastCount, 30, "var(--umos-success)");

		// Tarawih progress
		this.renderProgressBar(stats, "Таравих", tarawihCount, 30, "#f39c12");
	}

	private renderProgressBar(
		parent: HTMLElement,
		label: string,
		current: number,
		total: number,
		color: string
	): void {
		const row = createElement("div", {
			cls: "umos-ramadan-progress",
			parent,
		});

		const labelRow = createElement("div", {
			cls: "umos-ramadan-progress-label",
			parent: row,
		});

		createElement("span", { text: label, parent: labelRow });
		createElement("span", {
			text: `${current}/${total}`,
			parent: labelRow,
		});

		const barBg = createElement("div", {
			cls: "umos-ramadan-progress-bar",
			parent: row,
		});

		const fill = createElement("div", {
			cls: "umos-ramadan-progress-fill",
			parent: barBg,
		});
		const pct = total > 0 ? Math.round((current / total) * 100) : 0;
		fill.style.width = `${pct}%`;
		fill.style.backgroundColor = color;
	}

	private timeToMinutes(timeStr: string): number {
		const parts = timeStr.split(":");
		return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
	}

	private formatCountdown(totalMinutes: number): string {
		if (totalMinutes <= 0) return "сейчас";
		const hours = Math.floor(totalMinutes / 60);
		const minutes = totalMinutes % 60;
		if (hours > 0) {
			return `${hours}ч ${minutes}мин`;
		}
		return `${minutes}мин`;
	}
}
