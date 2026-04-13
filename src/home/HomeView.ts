import { App, ItemView, WorkspaceLeaf } from "obsidian";
import { EventBus } from "../EventBus";
import { UmOSSettings, UmOSData } from "../settings/Settings";
import { PrayerService } from "../religion/prayer/PrayerService";
import { StatsEngine } from "../stats/StatsEngine";
import { PomodoroService } from "../productivity/pomodoro/PomodoroService";
import { ExamService } from "../productivity/exam/ExamService";
import { FinanceService } from "../finance/FinanceService";
import { WeatherService } from "../weather/WeatherService";
import { GoalsService } from "../productivity/goals/GoalsService";
import { BalanceService } from "../balance/BalanceService";
import { createElement } from "../utils/dom";
import { HomeViewContext } from "./types";
import { renderHeaderSection, updateClock } from "./sections/header";
import { renderWeatherSection } from "./sections/weather";
import { renderPrayerSection, updatePrayerCountdown } from "./sections/prayer";
import { renderRamadanSection } from "./sections/ramadan";
import { renderNavigationSection } from "./sections/navigation";
import { renderStatsSection } from "./sections/stats";
import { renderTasksSection } from "./sections/tasks";
import { renderDeadlinesSection } from "./sections/deadlines";
import { renderProjectsSection } from "./sections/projects";
import { renderContentSection } from "./sections/content";
import { renderPomodoroSection, updatePomodoroTimer } from "./sections/pomodoro";
import { renderExamsSection } from "./sections/exams";
import { renderFinanceSection } from "./sections/finance";
import { renderFooter } from "./sections/footer";
import { renderGoalsSection } from "./sections/goals";
import { renderBalanceSection } from "./sections/balance";

export const HOME_VIEW_TYPE = "umos-home-view";

export class HomeView extends ItemView {
	private obsidianApp: App;
	private eventBus: EventBus;
	private settings: UmOSSettings;
	private getData: () => UmOSData;
	private prayerService: PrayerService | null;
	private statsEngine: StatsEngine | null;
	private createDailyNoteFn: (() => Promise<void>) | null;
	private pomodoroService: PomodoroService | null;
	private examService: ExamService | null;
	private financeService: FinanceService | null;
	private weatherService: WeatherService | null;
	private goalsService: GoalsService | null;
	private balanceService: BalanceService | null;
	private saveSettingsFn: (() => Promise<void>) | null;
	private clockEl: HTMLElement | null = null;
	private countdownEl: HTMLElement | null = null;
	private pomodoroTimerEl: HTMLElement | null = null;
	private contentContainerEl: HTMLElement | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		app: App,
		eventBus: EventBus,
		settings: UmOSSettings,
		getData: () => UmOSData,
		prayerService: PrayerService | null,
		statsEngine: StatsEngine | null,
		createDailyNoteFn: (() => Promise<void>) | null,
		pomodoroService: PomodoroService | null,
		examService: ExamService | null,
		financeService: FinanceService | null,
		weatherService: WeatherService | null,
		goalsService: GoalsService | null,
		balanceService: BalanceService | null,
		saveSettingsFn: (() => Promise<void>) | null
	) {
		super(leaf);
		this.obsidianApp = app;
		this.eventBus = eventBus;
		this.settings = settings;
		this.getData = getData;
		this.prayerService = prayerService;
		this.statsEngine = statsEngine;
		this.createDailyNoteFn = createDailyNoteFn;
		this.pomodoroService = pomodoroService;
		this.examService = examService;
		this.financeService = financeService;
		this.weatherService = weatherService;
		this.goalsService = goalsService;
		this.balanceService = balanceService;
		this.saveSettingsFn = saveSettingsFn;
	}

	getViewType(): string {
		return HOME_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "umOS Home";
	}

	getIcon(): string {
		return "home";
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.classList.add("umos-home-container");

		this.contentContainerEl = createElement("div", {
			cls: "umos-home",
			parent: container,
		});

		this.render();

		// Clock + countdown every second
		this.registerInterval(
			window.setInterval(() => {
				this.updateClock();
				this.updatePrayerCountdown();
				this.updatePomodoroTimer();
			}, 1000)
		);

		// Full re-render every 5 minutes
		this.registerInterval(
			window.setInterval(() => {
				this.render();
			}, 300000)
		);

		const prayerHandler = () => { this.render(); };
		this.eventBus.on("prayer:updated", prayerHandler);
		this.register(() => { this.eventBus.off("prayer:updated", prayerHandler); });

		const statsHandler = () => { this.render(); };
		this.eventBus.on("stats:recalculated", statsHandler);
		this.register(() => { this.eventBus.off("stats:recalculated", statsHandler); });

		const weatherHandler = () => { this.render(); };
		this.eventBus.on("weather:updated", weatherHandler);
		this.register(() => { this.eventBus.off("weather:updated", weatherHandler); });

		const locationHandler = () => { this.render(); };
		this.eventBus.on("location:updated", locationHandler);
		this.register(() => { this.eventBus.off("location:updated", locationHandler); });

		const financeHandler = () => { this.render(); };
		this.eventBus.on("finance:transaction-added", financeHandler);
		this.eventBus.on("finance:transaction-deleted", financeHandler);
		this.eventBus.on("finance:budget-updated", financeHandler);
		this.register(() => {
			this.eventBus.off("finance:transaction-added", financeHandler);
			this.eventBus.off("finance:transaction-deleted", financeHandler);
			this.eventBus.off("finance:budget-updated", financeHandler);
		});

		const goalsHandler = () => { this.render(); };
		this.eventBus.on("goals:updated", goalsHandler);
		this.register(() => { this.eventBus.off("goals:updated", goalsHandler); });

		const balanceHandler = () => { this.render(); };
		this.eventBus.on("balance:updated", balanceHandler);
		this.register(() => { this.eventBus.off("balance:updated", balanceHandler); });

		const settingsHandler = () => { this.render(); };
		this.eventBus.on("settings:changed", settingsHandler);
		this.register(() => { this.eventBus.off("settings:changed", settingsHandler); });

		const pomodoroHandler = () => { this.render(); };
		this.eventBus.on("pomodoro:state-changed", pomodoroHandler);
		this.register(() => { this.eventBus.off("pomodoro:state-changed", pomodoroHandler); });
	}

	async onClose(): Promise<void> {
		this.contentContainerEl = null;
		this.clockEl = null;
		this.countdownEl = null;
		this.pomodoroTimerEl = null;
	}

	private buildCtx(): HomeViewContext {
		return {
			app: this.obsidianApp,
			eventBus: this.eventBus,
			settings: this.settings,
			getData: this.getData,
			prayerService: this.prayerService,
			statsEngine: this.statsEngine,
			weatherService: this.weatherService,
			financeService: this.financeService,
			examService: this.examService,
			pomodoroService: this.pomodoroService,
			goalsService: this.goalsService,
			balanceService: this.balanceService,
			saveSettings: this.saveSettingsFn,
			createDailyNote: this.createDailyNoteFn,
		};
	}

	private render(): void {
		if (!this.contentContainerEl) return;
		this.contentContainerEl.empty();

		const ctx = this.buildCtx();
		let headerRendered = false;

		for (const sectionId of this.settings.homeVisibleSections) {
			switch (sectionId) {
				case "clock":
				case "greeting":
					if (!headerRendered) {
						this.clockEl = renderHeaderSection(this.contentContainerEl, ctx, this.settings.homeVisibleSections);
						headerRendered = true;
					}
					break;
				case "weather":
					renderWeatherSection(this.contentContainerEl, ctx);
					break;
				case "prayer":
					this.countdownEl = renderPrayerSection(this.contentContainerEl, ctx);
					break;
				case "ramadan":
					if (this.settings.ramadanEnabled) renderRamadanSection(this.contentContainerEl, ctx);
					break;
				case "navigation":
					renderNavigationSection(this.contentContainerEl, ctx);
					break;
				case "stats":
					renderStatsSection(this.contentContainerEl, ctx);
					break;
				case "tasks":
					renderTasksSection(this.contentContainerEl, ctx);
					break;
				case "pomodoro":
					this.pomodoroTimerEl = renderPomodoroSection(this.contentContainerEl, ctx);
					break;
				case "exams":
					renderExamsSection(this.contentContainerEl, ctx);
					break;
				case "deadlines":
					renderDeadlinesSection(this.contentContainerEl, ctx);
					break;
				case "goals":
					renderGoalsSection(this.contentContainerEl, ctx);
					break;
				case "balance":
					renderBalanceSection(this.contentContainerEl, ctx);
					break;
				case "finance":
					renderFinanceSection(this.contentContainerEl, ctx);
					break;
				case "projects":
					renderProjectsSection(this.contentContainerEl, ctx);
					break;
				case "content":
					renderContentSection(this.contentContainerEl, ctx);
					break;
				case "footer":
					renderFooter(this.contentContainerEl, ctx);
					break;
			}
		}

		// Stagger animation
		const sections = this.contentContainerEl.querySelectorAll(".umos-home-section, .umos-home-header, .umos-home-footer");
		sections.forEach((el, i) => {
			(el as HTMLElement).style.setProperty("--section-index", String(i));
		});
	}

	private updateClock(): void {
		if (this.clockEl) {
			updateClock(this.clockEl);
		}
	}

	private updatePrayerCountdown(): void {
		if (this.countdownEl) {
			updatePrayerCountdown(this.countdownEl, this.buildCtx());
		}
	}

	private updatePomodoroTimer(): void {
		if (this.pomodoroTimerEl) {
			updatePomodoroTimer(this.pomodoroTimerEl, this.buildCtx());
		}
	}
}
