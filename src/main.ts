// — Obsidian —
import { Plugin, MarkdownPostProcessorContext, Notice, TFile } from "obsidian";

// — Core —
import { EventBus } from "./EventBus";
import { parseWidgetConfig } from "./utils/config";
import { UmOSSettings, UmOSData, DEFAULT_SETTINGS, DEFAULT_DATA } from "./settings/Settings";
import { UmOSSettingsTab } from "./settings/SettingsTab";

// — Services —
import { PrayerService } from "./religion/prayer/PrayerService";
import { QuranService } from "./religion/quran/QuranService";
import { StatsEngine } from "./stats/StatsEngine";
import { PomodoroService } from "./productivity/pomodoro/PomodoroService";
import { ExamService } from "./productivity/exam/ExamService";
import { FinanceService } from "./finance/FinanceService";
import { WeatherService } from "./weather/WeatherService";
import { GoalsService } from "./productivity/goals/GoalsService";
import { TaskService } from "./productivity/tasks/TaskService";
import { BalanceService } from "./balance/BalanceService";

// — Widgets & Views —
import { PrayerWidget } from "./religion/prayer/PrayerWidget";
import { PrayerStatusBar } from "./religion/prayer/PrayerStatusBar";
import { RamadanWidget } from "./religion/ramadan/RamadanWidget";
import { AyatWidget } from "./religion/quran/AyatWidget";
import { QuranTracker } from "./religion/quran/QuranTracker";
import { StatsWidget } from "./stats/StatsWidget";
import { ScheduleWidget } from "./productivity/schedule/ScheduleWidget";
import { TasksWidget } from "./productivity/tasks/TasksWidget";
import { TasksStatsWidget } from "./productivity/tasks/TasksStatsWidget";
import { TasksKanbanWidget } from "./productivity/tasks/TasksKanbanWidget";
import { PomodoroWidget } from "./productivity/pomodoro/PomodoroWidget";
import { ExamWidget } from "./productivity/exam/ExamWidget";
import { FinanceWidget } from "./finance/FinanceWidget";
import { GoalsWidget } from "./productivity/goals/GoalsWidget";
import { BalanceWidget } from "./balance/BalanceWidget";
import { ContentGallery } from "./content/ContentGallery";
import { ProjectGallery } from "./content/ProjectGallery";
import { DailyNavWidget } from "./daily/DailyNavWidget";
import { WordOfDayWidget } from "./daily/WordOfDay";
import { HabitCalendar } from "./productivity/habits/HabitCalendar";
import { HomeView, HOME_VIEW_TYPE } from "./home/HomeView";

// — Modals, Editors & Handlers —
import { ScheduleEditor } from "./productivity/schedule/ScheduleEditor";
import { QuickCaptureModal } from "./capture/QuickCaptureModal";
import { QuickHubModal } from "./hub/QuickHubModal";
import { GoalModal } from "./productivity/goals/GoalModal";
import { URIHandler } from "./capture/URIHandler";
import { DailyNoteEnhancer } from "./daily/DailyNoteEnhancer";
import { InputWidgetManager } from "./input/InputWidget";
import { FrontmatterHelper } from "./input/FrontmatterHelper";
import { FormatPickerModal } from "./formatting/FormatPickerModal";
import { KanbanBoardWidget, KanbanBoardData } from "./productivity/kanban/KanbanBoardWidget";
import { ColsWidget } from "./layout/ColsWidget";
import { InfoboxWidget } from "./layout/InfoboxWidget";

export default class UmOSPlugin extends Plugin {
	settings: UmOSSettings = { ...DEFAULT_SETTINGS };
	data_store: UmOSData = { ...DEFAULT_DATA };
	eventBus: EventBus = new EventBus();

	private inputWidgetManager: InputWidgetManager | null = null;
	private prayerService: PrayerService | null = null;
	private prayerStatusBar: PrayerStatusBar | null = null;
	private quranService: QuranService | null = null;
	private statsEngine: StatsEngine | null = null;
	private sharedFmHelper: FrontmatterHelper | null = null;
	private statusBarItemEl: HTMLElement | null = null;
	private gifOverlayEl: HTMLElement | null = null;
	private dailyNoteEnhancer: DailyNoteEnhancer | null = null;
	private pomodoroService: PomodoroService | null = null;
	private examService: ExamService | null = null;
	private financeService: FinanceService | null = null;
	private weatherService: WeatherService | null = null;
	private goalsService: GoalsService | null = null;
	private balanceService: BalanceService | null = null;

	async onload(): Promise<void> {
		console.log("umOS: loading plugin...");
		await this.loadSettings();
		this.addSettingTab(new UmOSSettingsTab(this.app, this));

		this.sharedFmHelper = new FrontmatterHelper(this.app, this.eventBus);

		// Input System
		try {
			this.inputWidgetManager = new InputWidgetManager(this);
			this.inputWidgetManager.register();
		} catch (error) {
			console.error("umOS: failed to initialize InputWidgetManager:", error);
		}

		// Prayer — init в фоне, не блокирует загрузку
		try {
			this.prayerService = new PrayerService(this.app, this.eventBus, this.settings);
			this.prayerService.init((id) => this.registerInterval(id))
				.then(() => new Notice("🕌 umOS: время намазов загружено", 3000))
				.catch((error) => console.error("umOS: failed to fetch prayer times:", error));
			if (this.settings.prayerShowStatusBar) {
				this.statusBarItemEl = this.addStatusBarItem();
				this.prayerStatusBar = new PrayerStatusBar(
					this.app, this.statusBarItemEl, this.prayerService, this.eventBus, this.settings
				);
				this.prayerStatusBar.init((id) => this.registerInterval(id));
			}
		} catch (error) {
			console.error("umOS: failed to initialize Prayer module:", error);
		}

		// Quran
		try {
			this.quranService = new QuranService(this.eventBus);
		} catch (error) {
			console.error("umOS: failed to initialize Quran module:", error);
		}

		// Stats
		try {
			this.statsEngine = new StatsEngine(this.app, this.eventBus, this.settings);
			this.statsEngine.init((ref) => this.registerEvent(ref));
		} catch (error) {
			console.error("umOS: failed to initialize Stats module:", error);
		}

		// Quick Capture
		try {
			const uriHandler = new URIHandler(this.app, this.settings);
			uriHandler.register((action, handler) => {
				this.registerObsidianProtocolHandler(action, (params) => {
					handler(params as Record<string, string>);
				});
			});
		} catch (error) {
			console.error("umOS: failed to initialize Quick Capture:", error);
		}

		// Pomodoro
		try {
			this.pomodoroService = new PomodoroService(
				this.eventBus,
				this.settings,
				() => this.data_store.pomodoro,
				async (data) => {
					Object.assign(this.data_store.pomodoro, data);
					await this.saveSettings();
				}
			);
		} catch (error) {
			console.error("umOS: failed to initialize Pomodoro module:", error);
		}

		// Exam
		try {
			this.examService = new ExamService(
				this.eventBus,
				() => this.data_store.exams,
				async (exams) => {
					this.data_store.exams = exams;
					await this.saveSettings();
				}
			);
		} catch (error) {
			console.error("umOS: failed to initialize Exam module:", error);
		}

		// Finance
		try {
			this.financeService = new FinanceService(
				this.eventBus,
				this.settings,
				() => this.data_store.finance,
				async (data) => {
					Object.assign(this.data_store.finance, data);
					await this.saveSettings();
				}
			);
		} catch (error) {
			console.error("umOS: failed to initialize Finance module:", error);
		}

		// Goals
		try {
			this.goalsService = new GoalsService(
				this.app,
				this.eventBus,
				() => this.settings.goals,
				async (goals) => {
					this.settings.goals = goals;
					await this.saveSettings();
				}
			);
		} catch (error) {
			console.error("umOS: failed to initialize Goals module:", error);
		}

		// Balance
		try {
			this.balanceService = new BalanceService(
				this.eventBus,
				() => this.settings,
				() => this.data_store.balance,
				async (data) => {
					Object.assign(this.data_store.balance, data);
					await this.saveSettings();
				}
			);
		} catch (error) {
			console.error("umOS: failed to initialize Balance module:", error);
		}

		// Weather — init в фоне, не блокирует загрузку
		try {
			this.weatherService = new WeatherService(
				this.eventBus,
				this.settings
			);
			this.weatherService.init((id) => this.registerInterval(id))
				.then(() => new Notice("🌤 umOS: погода загружена", 3000))
				.catch((error) => console.error("umOS: failed to fetch weather:", error));
		} catch (error) {
			console.error("umOS: failed to initialize Weather module:", error);
		}

		// Location update handler
		this.eventBus.on("location:updated", () => {
			if (this.prayerService) this.prayerService.refresh();
			if (this.weatherService) this.weatherService.forceFetch();
		});

		// Home View — проверяем, не зарегистрирован ли тип уже (защита от hot-reload)
		try {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const viewRegistry = (this.app as any).viewRegistry;
			const alreadyRegistered = viewRegistry?.views && HOME_VIEW_TYPE in viewRegistry.views;
			if (!alreadyRegistered) {
				this.registerView(HOME_VIEW_TYPE, (leaf) =>
					new HomeView(
						leaf, this.app, this.eventBus, this.settings,
						() => this.data_store, this.prayerService, this.statsEngine,
						() => this.dailyNoteEnhancer ? this.dailyNoteEnhancer.createDailyNote() : Promise.resolve(),
						this.pomodoroService, this.examService, this.financeService, this.weatherService, this.goalsService,
						this.balanceService,
						() => this.saveSettings()
					)
				);
			} else {
				// Обновляем существующие листья новым контекстом
				this.app.workspace.getLeavesOfType(HOME_VIEW_TYPE).forEach(leaf => leaf.detach());
			}
		} catch (error) {
			console.error("umOS: failed to initialize Home View:", error);
		}

		// Daily Note Enhancer
		try {
			this.dailyNoteEnhancer = new DailyNoteEnhancer(
				this.app,
				() => this.settings,
				this.eventBus,
				() => this.data_store
			);
		} catch (error) {
			console.error("umOS: failed to initialize Daily Note Enhancer:", error);
		}

		// Widgets
		try {
			this.registerWidgets();
		} catch (error) {
			console.error("umOS: failed to register widgets:", error);
		}

		// Balance — sync with today's daily note on startup + on frontmatter changes
		this.eventBus.on("frontmatter:changed", (data) => {
			if (!this.balanceService) return;
			const today = this.getTodayNotePath();
			if (!today || data.path !== today) return;
			const todayISO = new Date().toISOString().slice(0, 10);
			this.balanceService.processDailyNoteField(data.property, data.value, todayISO);
		});
		void this.checkTodayDailyNote();

		// Tasks — deadline notifications on startup
		void this.checkDeadlineNotifications();

		// Commands & Ribbon
		try {
			this.registerCommands();
			this.registerRibbonIcons();
		} catch (error) {
			console.error("umOS: failed to register commands:", error);
		}

		// GIF panel — embedded in file-explorer sidebar
		this.initGifOverlay();

		// Apply body classes that drive CSS-only features
		this.applyBodyClasses();

		// Re-insert panel if workspace layout rebuilds (tab drag, pane split, etc.)
		this.registerEvent(
			this.app.workspace.on("layout-change", () => {
				if (this.gifOverlayEl && !this.gifOverlayEl.isConnected) {
					this.placeGifPanel();
				}
			})
		);

		// Refresh GIF + body classes when settings change
		this.eventBus.on("settings:changed", () => {
			this.initGifOverlay();
			this.applyBodyClasses();
		});


		console.log("umOS: plugin loaded.");
	}

	onunload(): void {
		console.log("umOS: plugin unloaded.");
		this.destroyGifOverlay();
		document.body.removeClass("umos-infobox-sticky");
		if (this.inputWidgetManager) { this.inputWidgetManager.destroy(); this.inputWidgetManager = null; }
		if (this.prayerStatusBar) { this.prayerStatusBar.destroy(); this.prayerStatusBar = null; }
		if (this.sharedFmHelper) { this.sharedFmHelper.destroy(); this.sharedFmHelper = null; }
		if (this.pomodoroService) { this.pomodoroService.destroy(); this.pomodoroService = null; }
		if (this.goalsService) { this.goalsService.destroy(); this.goalsService = null; }
		this.examService = null;
		this.financeService = null;
		this.balanceService = null;
		this.weatherService = null;
		this.prayerService = null;
		this.quranService = null;
		this.statsEngine = null;
		this.dailyNoteEnhancer = null;
		this.app.workspace.detachLeavesOfType(HOME_VIEW_TYPE);
		this.eventBus.offAll();
	}

	private async activateHomeView(): Promise<void> {
		try {
			const existing = this.app.workspace.getLeavesOfType(HOME_VIEW_TYPE);
			if (existing.length > 0) {
				this.app.workspace.revealLeaf(existing[0]);
				return;
			}
			const leaf = this.app.workspace.getLeaf("tab");
			await leaf.setViewState({ type: HOME_VIEW_TYPE, active: true });
			this.app.workspace.revealLeaf(leaf);
		} catch (error) {
			console.error("umOS: failed to open Home View:", error);
			new Notice("❌ Не удалось открыть Home");
		}
	}

	/** Проверяет, инициализирован ли сервис, и логирует предупреждение если нет */
	private ensureService<T>(service: T | null, serviceName: string): T | null {
		if (!service) {
			console.warn(`umOS: ${serviceName} is not initialized`);
		}
		return service;
	}

	// ─── Balance / Daily Note ─────────────────────
	private getTodayNotePath(): string | null {
		const fmt = this.settings.dailyNoteFormat || "YYYY-MM-DD";
		const d = new Date();
		const yyyy = String(d.getFullYear());
		const mm   = String(d.getMonth() + 1).padStart(2, "0");
		const dd   = String(d.getDate()).padStart(2, "0");
		const name = fmt.replace("YYYY", yyyy).replace("MM", mm).replace("DD", dd);
		return `${this.settings.dailyNotesPath}/${name}.md`;
	}

	private async checkTodayDailyNote(): Promise<void> {
		if (!this.balanceService) return;
		if (!this.settings.balanceDailyNoteRules?.length) return;
		setTimeout(async () => {
			const path = this.getTodayNotePath();
			if (!path) return;
			const file = this.app.vault.getAbstractFileByPath(path);
			if (!(file instanceof TFile)) return;
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache?.frontmatter) return;
			const todayISO = new Date().toISOString().slice(0, 10);
			for (const rule of this.settings.balanceDailyNoteRules) {
				const val = cache.frontmatter[rule.field];
				if (typeof val === "number" && val > 0) {
					this.balanceService?.processDailyNoteField(rule.field, val, todayISO);
				}
			}
		}, 3000); // wait for metadata cache to be ready
	}

	// ─── Widget Registry ──────────────────────────
	private async checkDeadlineNotifications(): Promise<void> {
		setTimeout(async () => {
			try {
				const taskService = new TaskService(this.app, this);
				const { overdue, dueToday } = await taskService.getUrgentTasks();
				if (overdue.length > 0) {
					new Notice(`⚠️ Просроченных задач: ${overdue.length}`, 8000);
				}
				if (dueToday.length > 0) {
					new Notice(`📅 Задач на сегодня: ${dueToday.length}`, 5000);
				}
			} catch (e) {
				console.error("umOS: error checking deadlines:", e);
			}
		}, 5000);
	}

	private registerWidgets(): void {
		type H = (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => void;
		const handlers: Array<[string, H]> = [
			["prayer-widget", (source, el, ctx) => {
				if (!this.prayerService) return;
				const config = parseWidgetConfig(source);
				const container = el.createDiv({ cls: "umos-widget-container" });
				ctx.addChild(new PrayerWidget(container, {
					show: (config.show as "times" | "next" | "both") || "both",
					style: (config.style as "full" | "compact") || "full",
					showSunrise: config.show_sunrise !== undefined
						? config.show_sunrise === true || config.show_sunrise === "true"
						: this.settings.prayerShowSunrise,
				}, this.app, this.prayerService, this.eventBus, this.settings));
			}],
			["ayat-daily", (source, el, ctx) => {
				if (!this.quranService) return;
				const config = parseWidgetConfig(source);
				const container = el.createDiv({ cls: "umos-widget-container" });
				ctx.addChild(new AyatWidget(container, {
					count: Number(config.count) || this.settings.quranAyatCount,
					language: String(config.language || this.settings.quranTranslation),
					showArabic: config.show_arabic !== undefined
						? config.show_arabic === true || config.show_arabic === "true"
						: this.settings.quranShowArabic,
				}, this.app, this.quranService, this.eventBus, this.settings));
			}],
			["quran-tracker", (source, el, ctx) => {
				const config = parseWidgetConfig(source);
				const container = el.createDiv({ cls: "umos-widget-container" });
				ctx.addChild(new QuranTracker(container, {
					style: (config.style as "grid" | "progress" | "both") || "both",
				}, this.app, this.eventBus,
					() => ({ juzStatus: { ...this.data_store.quran.juzStatus }, completedJuz: [...this.data_store.quran.completedJuz], dailyPages: this.data_store.quran.dailyPages, lastReadDate: this.data_store.quran.lastReadDate, streak: this.data_store.quran.streak, longestStreak: this.data_store.quran.longestStreak }),
					async (data) => {
						if (data.juzStatus !== undefined) this.data_store.quran.juzStatus = data.juzStatus;
						if (data.completedJuz !== undefined) this.data_store.quran.completedJuz = data.completedJuz;
						if (data.dailyPages !== undefined) this.data_store.quran.dailyPages = data.dailyPages;
						if (data.lastReadDate !== undefined) this.data_store.quran.lastReadDate = data.lastReadDate;
						if (data.streak !== undefined) this.data_store.quran.streak = data.streak;
						if (data.longestStreak !== undefined) this.data_store.quran.longestStreak = data.longestStreak;
						await this.saveSettings();
					}));
			}],
			["ramadan-widget", (source, el, ctx) => {
				if (!this.prayerService) return;
				const config = parseWidgetConfig(source);
				const container = el.createDiv({ cls: "umos-widget-container" });
				ctx.addChild(new RamadanWidget(container, {
					style: (config.style as "full" | "compact") || "full",
				}, this.app, this.prayerService, this.eventBus, this.settings,
					() => ({
						fastTracker: { ...this.data_store.ramadan.fastTracker },
						tarawihTracker: { ...this.data_store.ramadan.tarawihTracker },
					}),
					async (data) => {
						if (data.fastTracker !== undefined) this.data_store.ramadan.fastTracker = data.fastTracker;
						if (data.tarawihTracker !== undefined) this.data_store.ramadan.tarawihTracker = data.tarawihTracker;
						await this.saveSettings();
					}));
			}],
			["umos-stats", (source, el, ctx) => {
				if (!this.statsEngine) {
					const container = el.createDiv({ cls: "umos-widget-container umos-error" });
					container.textContent = "❌ StatsEngine не инициализирован";
					return;
				}
				const config = parseWidgetConfig(source);
				let metrics = ["mood", "productivity", "sleep", "prayer_count"];
				if (Array.isArray(config.metrics)) metrics = (config.metrics as string[]).map(String);
				const container = el.createDiv({ cls: "umos-widget-container" });
				ctx.addChild(new StatsWidget(container, { metrics, period: Number(config.period) || 14, chart: (config.chart as "sparkline" | "bar" | "ring" | "none") || "sparkline", compare: config.compare === true || config.compare === "true" }, this.app, this.statsEngine, this.eventBus));
			}],
			["schedule", (source, el, ctx) => {
				const config = parseWidgetConfig(source);
				const container = el.createDiv({ cls: "umos-widget-container" });
				ctx.addChild(new ScheduleWidget(container, { show: (config.show as "current" | "week" | "both") || "current", highlight: config.highlight !== false, countdown: config.countdown !== false }, this.app, this.eventBus, () => this.data_store));
			}],
			["content-gallery", (source, el, ctx) => {
				const config = parseWidgetConfig(source);
				const container = el.createDiv({ cls: "umos-widget-container" });
				ctx.addChild(new ContentGallery(container, {
					style: (config.style as "grid" | "list") || "grid",
				}, this.app, this.eventBus, this.settings));
			}],
			["project-gallery", (source, el, ctx) => {
				const config = parseWidgetConfig(source);
				const container = el.createDiv({ cls: "umos-widget-container" });
				ctx.addChild(new ProjectGallery(container, {
					style: (config.style as "grid" | "list") || "grid",
				}, this.app, this.eventBus, this.settings));
			}],
			["tasks-stats-widget", (source, el, ctx) => {
				const config = parseWidgetConfig(source);
				const container = el.createDiv({ cls: "umos-widget-container" });
				ctx.addChild(new TasksStatsWidget(container, config, this.app, this));
			}],
			["tasks-widget", (source, el, ctx) => {
				const config = parseWidgetConfig(source);
				const container = el.createDiv({ cls: "umos-widget-container" });
				ctx.addChild(new TasksWidget(container, config, this.app, this, ctx.sourcePath));
			}],
			["tasks-kanban", (source, el, ctx) => {
				const config = parseWidgetConfig(source);
				const container = el.createDiv({ cls: "umos-widget-container" });
				ctx.addChild(new TasksKanbanWidget(container, config, this.app, this, ctx.sourcePath));
			}],
			["umos-goals", (_source, el, ctx) => {
				if (!this.goalsService) return;
				const container = el.createDiv({ cls: "umos-widget-container" });
				ctx.addChild(new GoalsWidget(container, this.app, this.eventBus, this.goalsService));
			}],
			["daily-nav", (_source, el, ctx) => {
				const container = el.createDiv({ cls: "umos-widget-container" });
				ctx.addChild(new DailyNavWidget(container, this.app, this.settings,
					async (dateISO) => {
						if (this.dailyNoteEnhancer) {
							await this.dailyNoteEnhancer.createDailyNote(dateISO);
						}
					}
				));
			}],
			["word-of-day", (source, el, ctx) => {
				const config = parseWidgetConfig(source);
				const filePath = ctx.sourcePath;
				const file = this.app.vault.getAbstractFileByPath(filePath);
				if (!(file instanceof TFile) || !this.sharedFmHelper) return;
				const property = typeof config.property === "string" && config.property ? config.property : "word_of_day";
				const placeholder = typeof config.placeholder === "string" && config.placeholder ? config.placeholder : "Нажми, чтобы написать слово дня...";
				const container = el.createDiv({ cls: "umos-widget-container" });
				ctx.addChild(new WordOfDayWidget(container, this.app, file, this.sharedFmHelper, property, placeholder));
			}],
			["pomodoro", (source, el, ctx) => {
				if (!this.pomodoroService) return;
				const config = parseWidgetConfig(source);
				const container = el.createDiv({ cls: "umos-widget-container" });
				ctx.addChild(new PomodoroWidget(container, {
					style: (config.style as "full" | "compact") || "full",
				}, this.eventBus, this.pomodoroService));
			}],
			["exam-tracker", (source, el, ctx) => {
				if (!this.examService) return;
				const config = parseWidgetConfig(source);
				const container = el.createDiv({ cls: "umos-widget-container" });
				ctx.addChild(new ExamWidget(container, {
					show: (config.show as "upcoming" | "all") || "upcoming",
					style: (config.style as "full" | "compact") || "full",
				}, this.app, this.eventBus, this.examService));
			}],
			["balance-tracker", (source, el, ctx) => {
				if (!this.balanceService) return;
				const config = parseWidgetConfig(source);
				const container = el.createDiv({ cls: "umos-widget-container" });
				ctx.addChild(new BalanceWidget(container, {
					style: (config.style as "full" | "compact") || "full",
				}, this.eventBus, this.balanceService));
			}],
			["habit-calendar", (source, el, ctx) => {
				if (!this.statsEngine) return;
				const config = parseWidgetConfig(source);
				const container = el.createDiv({ cls: "umos-widget-container" });
				ctx.addChild(new HabitCalendar(container, {
					habit: typeof config.habit === "string" ? config.habit : "exercise",
					months: Number(config.months) || 3,
				}, this.app, this.eventBus, this.settings, this.statsEngine));
			}],
			["finance-tracker", (source, el, ctx) => {
				if (!this.financeService) return;
				const config = parseWidgetConfig(source);
				const container = el.createDiv({ cls: "umos-widget-container" });
				ctx.addChild(new FinanceWidget(container, {
					month: (config.month as string) || undefined,
					style: (config.style as "full" | "compact") || "full",
				}, this.eventBus, this.financeService, this.settings));
			}],
			["kanban-board", (source, el, ctx) => {
				const config = parseWidgetConfig(source);
				const boardId = String(config.id || "default");
				const container = el.createDiv({ cls: "umos-widget-container" });
				ctx.addChild(new KanbanBoardWidget(
					container,
					boardId,
					() => {
						const stored = this.data_store.kanbanBoards[boardId];
						if (stored) return stored as KanbanBoardData;
						return { columns: [], labels: [] };
					},
					async (d: KanbanBoardData) => {
						this.data_store.kanbanBoards[boardId] = d;
						await this.saveSettings();
					},
					this.app,
					this.eventBus,
				));
			}],
			["cols-umos", (source, el, ctx) => {
				ctx.addChild(new ColsWidget(el, this.app, source, ctx.sourcePath));
			}],
			["info-umos", (source, el, ctx) => {
				ctx.addChild(new InfoboxWidget(el, this.app, source, ctx.sourcePath));
			}],
		];
		for (const [blockName, handler] of handlers) {
			try {
				this.registerMarkdownCodeBlockProcessor(blockName, handler);
			} catch {
				// Уже зарегистрирован (hot-reload) — пропускаем без ошибки
			}
		}
	}

	// ─── Settings ──────────────────────────
	async loadSettings(): Promise<void> {
		try {
			const loaded = await this.loadData() as unknown;
			if (loaded && typeof loaded === "object") {
				const loadedData = loaded as Record<string, unknown>;
				this.settings = { ...DEFAULT_SETTINGS, ...(loadedData.settings as UmOSSettings | undefined) };
				const merged = this.deepMerge(DEFAULT_DATA as unknown as Record<string, unknown>, loadedData);
				this.data_store = merged as unknown as UmOSData;
				this.data_store.settings = this.settings;
			} else {
				this.settings = { ...DEFAULT_SETTINGS };
				this.data_store = { ...DEFAULT_DATA };
			}
		} catch (error) {
			console.warn("umOS: failed to load settings, using defaults:", error);
			this.settings = { ...DEFAULT_SETTINGS };
			this.data_store = { ...DEFAULT_DATA };
		}

		await this.tryLoadFromVaultSync();
		this.migrateSettings();
	}

	private migrateSettings(): void {
		let dirty = false;

		// Migrate goals from data_store.goals → settings.goals
		// Goals may have been stored in the top-level data_store.goals field;
		// the canonical location is settings.goals.
		if (Array.isArray(this.data_store.goals) && this.data_store.goals.length > 0) {
			const existingIds = new Set((this.settings.goals || []).map(g => g.id));
			for (const goal of this.data_store.goals) {
				if (goal && goal.id && !existingIds.has(goal.id)) {
					this.settings.goals.push(goal);
				}
			}
			this.data_store.goals = [];
			dirty = true;
		}

		// Ensure "balance" is in homeVisibleSections
		if (!this.settings.homeVisibleSections.includes("balance")) {
			const idx = this.settings.homeVisibleSections.indexOf("content");
			if (idx !== -1) {
				this.settings.homeVisibleSections.splice(idx, 0, "balance");
			} else {
				this.settings.homeVisibleSections.push("balance");
			}
			dirty = true;
		}

		// Ensure Balance nav card is in homeNavCards
		if (!this.settings.homeNavCards.some(c => c.path.includes("Balance"))) {
			this.settings.homeNavCards.push(
				{ name: "Баланс", path: "05 Dashboards/Balance", icon: "⚖️", color: "#27ae60" }
			);
			dirty = true;
		}

		if (dirty) void this.saveSettings();
	}

	private async tryLoadFromVaultSync(): Promise<void> {
		const syncPath = this.settings.syncDataPath?.trim();
		if (!syncPath) return;
		try {
			const exists = await this.app.vault.adapter.exists(syncPath);
			if (!exists) return;
			const raw = await this.app.vault.adapter.read(syncPath);
			const vaultData = JSON.parse(raw) as Record<string, unknown>;
			const vaultTime = (vaultData.syncedAt as number | undefined) || 0;
			const localTime = this.data_store.syncedAt || 0;
			if (vaultTime > localTime) {
				console.log(`umOS: vault sync is newer (${vaultTime} > ${localTime}), loading from ${syncPath}`);
				this.settings = { ...DEFAULT_SETTINGS, ...(vaultData.settings as UmOSSettings | undefined) };
				const merged = this.deepMerge(DEFAULT_DATA as unknown as Record<string, unknown>, vaultData);
				this.data_store = merged as unknown as UmOSData;
				this.data_store.settings = this.settings;
				await this.saveData(this.data_store);
			}
		} catch (error) {
			console.warn("umOS: failed to read vault sync file, using local data:", error);
		}
	}

	async saveSettings(): Promise<void> {
		try {
			this.data_store.settings = this.settings;
			this.data_store.goals = this.settings.goals;
			this.data_store.syncedAt = Date.now();
			await this.saveData(this.data_store);
			await this.writeSyncFile();
			this.eventBus.emit("settings:changed");
		} catch (error) {
			console.error("umOS: failed to save settings:", error);
			new Notice("❌ Не удалось сохранить настройки");
		}
	}

	private async writeSyncFile(): Promise<void> {
		const syncPath = this.settings.syncDataPath?.trim();
		if (!syncPath) return;
		try {
			const dir = syncPath.includes("/") ? syncPath.substring(0, syncPath.lastIndexOf("/")) : "";
			if (dir && !await this.app.vault.adapter.exists(dir)) {
				await this.app.vault.createFolder(dir);
			}
			await this.app.vault.adapter.write(syncPath, JSON.stringify(this.data_store, null, 2));
		} catch (error) {
			console.error("umOS: failed to write vault sync file:", error);
		}
	}

	private deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
		const output: Record<string, unknown> = { ...target };
		for (const key of Object.keys(source)) {
			const sourceValue = source[key];
			const targetValue = target[key];
			if (
				sourceValue !== null &&
				typeof sourceValue === "object" &&
				!Array.isArray(sourceValue) &&
				targetValue !== null &&
				typeof targetValue === "object" &&
				!Array.isArray(targetValue)
			) {
				output[key] = this.deepMerge(
					targetValue as Record<string, unknown>,
					sourceValue as Record<string, unknown>
				);
			} else {
				output[key] = sourceValue;
			}
		}
		return output;
	}

	// ─── Commands ──────────────────────────
	private registerCommands(): void {
		this.addCommand({
			id: "umos:open-home",
			name: "Открыть Home",
			callback: () => { this.activateHomeView(); },
		});

		this.addCommand({
			id: "umos:quick-hub",
			name: "Быстрый хаб",
			callback: () => { new QuickHubModal(this.app, this, this.financeService).open(); },
		});

		this.addCommand({
			id: "umos:quick-task",
			name: "Быстрая задача",
			callback: () => { new QuickCaptureModal(this.app, this.settings, "task", this).open(); },
		});

		this.addCommand({
			id: "umos:quick-note",
			name: "Быстрая заметка",
			callback: () => { new QuickCaptureModal(this.app, this.settings, "note", this).open(); },
		});

		this.addCommand({
			id: "umos:add-goal",
			name: "Добавить цель",
			callback: () => {
				if (!this.goalsService) {
					new Notice("❌ GoalsService не инициализирован");
					return;
				}
				new GoalModal(this.app, (result) => {
					this.goalsService?.addGoal(result as any);
				}).open();
			},
		});

		this.addCommand({
			id: "umos:create-daily",
			name: "Создать дневную заметку",
			callback: async () => {
				if (this.dailyNoteEnhancer) {
					await this.dailyNoteEnhancer.createDailyNote();
				} else {
					new Notice("❌ DailyNoteEnhancer не инициализирован");
				}
			},
		});

		this.addCommand({
			id: "umos:edit-schedule",
			name: "Редактор расписания",
			callback: () => {
				new ScheduleEditor(this.app, this.data_store, this.eventBus, () => this.saveSettings()).open();
			},
		});

		this.addCommand({
			id: "umos:next-prayer",
			name: "Следующий намаз",
			callback: () => {
				if (!this.prayerService) {
					new Notice("Данные намаза ещё не загружены");
					return;
				}
				const next = this.prayerService.getNextPrayer();
				if (next) {
					const h = Math.floor(next.minutesLeft / 60);
					const m = next.minutesLeft % 60;
					new Notice(`${next.icon} ${next.nameRu} — ${next.time} (через ${h > 0 ? `${h}ч ${m}мин` : `${m}мин`})`);
				} else if (this.prayerService.allPrayersDone()) {
					new Notice("✅ Все намазы на сегодня совершены");
				} else {
					new Notice("🕌 Данные намаза загружаются...");
				}
			},
		});

		this.addCommand({
			id: "umos:format-picker",
			name: "Форматирование текста",
			callback: () => {
				new FormatPickerModal(this.app).open();
			},
		});

		this.addCommand({
			id: "umos:pomodoro-toggle",
			name: "Помодоро: Старт/Пауза",
			callback: () => {
				if (this.pomodoroService) {
					this.pomodoroService.toggle();
				} else {
					new Notice("❌ PomodoroService не инициализирован");
				}
			},
		});

	}

	// ─── GIF panel (sidebar-embedded) ───────────
	initGifOverlay(): void {
		this.destroyGifOverlay();
		const s = this.settings;
		if (!s.gifEnabled || !s.gifPath?.trim()) return;

		const el = document.createElement("div");
		el.className = "umos-gif-panel";
		if (s.gifGlass) el.classList.add("style-glass");
		if (s.gifGlow)  el.classList.add("style-glow");
		const anim = s.gifAnimation ?? "float";
		if (anim !== "none") el.classList.add(`anim-${anim}`);

		const img = document.createElement("img");
		img.src = this.resolveGifPath(s.gifPath.trim());
		img.alt = "";
		img.draggable = false;
		// gifSize controls max-height so very tall GIFs don't eat the whole sidebar
		img.style.maxHeight = `${s.gifSize || 240}px`;

		el.appendChild(img);

		// Разделитель между GIF и деревом файлов
		const divider = document.createElement("div");
		divider.className = "umos-gif-divider";

		const svgSrc = s.gifDividerSvg?.trim() ?? "";
		if (svgSrc) {
			if (/^<svg[\s>]/i.test(svgSrc)) {
				// Инлайн SVG-код
				divider.innerHTML = svgSrc;
				divider.classList.add("style-svg");
			} else {
				// Путь к файлу в хранилище
				const svgFile = this.app.vault.getAbstractFileByPath(svgSrc);
				if (svgFile) {
					const img = document.createElement("img");
					img.src = this.app.vault.getResourcePath(
						svgFile as Parameters<typeof this.app.vault.getResourcePath>[0]
					);
					img.alt = "";
					img.draggable = false;
					divider.appendChild(img);
					divider.classList.add("style-svg");
				}
			}
		}

		el.appendChild(divider);

		this.gifOverlayEl = el;
		this.placeGifPanel();
	}

	/** Insert (or re-insert) the GIF panel before the file-tree scroll container. */
	private placeGifPanel(): void {
		if (!this.gifOverlayEl) return;
		const leaves = this.app.workspace.getLeavesOfType("file-explorer");
		for (const leaf of leaves) {
			const navFiles = leaf.view.containerEl
				.querySelector<HTMLElement>(".nav-files-container");
			if (navFiles?.parentElement) {
				navFiles.parentElement.insertBefore(this.gifOverlayEl, navFiles);
				return;
			}
		}
	}

	private destroyGifOverlay(): void {
		if (this.gifOverlayEl) {
			this.gifOverlayEl.remove();
			this.gifOverlayEl = null;
		}
	}

	/** Применяет / снимает CSS-классы на <body>, управляющие глобальными стилями. */
	private applyBodyClasses(): void {
		const body = document.body;
		body.toggleClass("umos-infobox-sticky", this.settings.infoboxSticky === true);
	}

	private resolveGifPath(pathOrUrl: string): string {
		if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) return pathOrUrl;
		const file = this.app.vault.getAbstractFileByPath(pathOrUrl);
		if (file) return this.app.vault.getResourcePath(file as TFile);
		return pathOrUrl;
	}

	// ─── Ribbon ──────────────────────────
	private registerRibbonIcons(): void {
		this.addRibbonIcon("layout-grid", "umOS: Быстрый хаб", () => { new QuickHubModal(this.app, this, this.financeService).open(); });
		this.addRibbonIcon("home", "umOS: Открыть Home", () => { this.activateHomeView(); });
		this.addRibbonIcon("calendar", "umOS: Дневная заметка", async () => {
			if (this.dailyNoteEnhancer) {
				await this.dailyNoteEnhancer.createDailyNote();
			} else {
				new Notice("❌ DailyNoteEnhancer не инициализирован");
			}
		});
		this.addRibbonIcon("plus-circle", "umOS: Быстрая задача", () => { new QuickCaptureModal(this.app, this.settings, "task", this).open(); });
	}
}


