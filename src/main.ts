// — Obsidian —
import { Plugin, Notice, TAbstractFile, TFile, addIcon } from "obsidian";

// — Core —
import { EventBus } from "./EventBus";
import { UmOSSettings, UmOSData, DEFAULT_SETTINGS, DEFAULT_DATA } from "./settings/Settings";
import { UmOSSettingsTab } from "./settings/SettingsTab";
import { createErrorMessage, createElement } from "./utils/dom";
import { WidgetRegistry, createBaseWidgetDefinitions } from "./dashboard/WidgetRegistry";
import { DynamicFrontmatterService } from "./metadata/DynamicFrontmatterService";
import { DashboardStudioModal } from "./dashboard/DashboardStudioModal";
import { ApiRefreshModal } from "./dashboard/ApiRefreshModal";
import { installGlobalDomLocalization, setLanguage, t, uninstallGlobalDomLocalization } from "./i18n";
import { UMOS_ICON_ID, UMOS_LOGO_SVG, UMOS_SYNC_ICON_ID, UMOS_SYNC_ICON_SVG } from "./branding";
import { WelcomeModal } from "./WelcomeModal";

// — Services —
import { PrayerService } from "./religion/prayer/PrayerService";
import { StatsEngine } from "./stats/StatsEngine";
import { WeatherService } from "./weather/WeatherService";
import { TaskService } from "./productivity/tasks/TaskService";

// — Widgets & Views —
import { PrayerWidget } from "./religion/prayer/PrayerWidget";
import { PrayerStatusBar } from "./religion/prayer/PrayerStatusBar";
import { StatsWidget } from "./stats/StatsWidget";
import { WordsOfDayWidget } from "./stats/WordsOfDayWidget";
import { ScheduleWidget } from "./productivity/schedule/ScheduleWidget";
import { TasksWidget } from "./productivity/tasks/TasksWidget";
import { TasksStatsWidget } from "./productivity/tasks/TasksStatsWidget";
import { TasksCompletedWidget } from "./productivity/tasks/TasksCompletedWidget";
import { TaskCalendarView, TASK_CALENDAR_VIEW_TYPE } from "./productivity/tasks/TaskCalendarView";
import { TasksKanbanWidget } from "./productivity/tasks/TasksKanbanWidget";
import { ProgressTableWidget } from "./productivity/progress/ProgressTableWidget";
import { ContentGallery } from "./content/ContentGallery";
import { ImageGalleryView, IMAGE_GALLERY_VIEW_TYPE } from "./content/ImageGalleryView";
import { OmniSearchModal } from "./search/OmniSearchModal";
import { VaultSyncService } from "./sync/VaultSyncService";
import { SyncCenterModal } from "./sync/SyncCenterModal";
import { SyncProgressNotice } from "./sync/SyncProgressNotice";
import { ProjectGallery } from "./content/ProjectGallery";
import { DailyNavWidget } from "./daily/DailyNavWidget";
import { WordOfDayWidget } from "./daily/WordOfDay";
import { DailyReviewWidget } from "./daily/DailyReviewWidget";
import { HomeView, HOME_VIEW_TYPE } from "./home/HomeView";

// — Modals, Editors & Handlers —
import { ScheduleEditor } from "./productivity/schedule/ScheduleEditor";
import { DailyNoteEnhancer } from "./daily/DailyNoteEnhancer";
import { InputWidgetManager } from "./input/InputWidget";
import { FrontmatterHelper } from "./input/FrontmatterHelper";
import { FormatPickerModal } from "./formatting/FormatPickerModal";
import { SlashCommandSuggest } from "./formatting/SlashCommandSuggest";
import { decorateCodeBlocks } from "./formatting/CodeBlockStyler";
import { KanbanBoardWidget, KanbanBoardData } from "./productivity/kanban/KanbanBoardWidget";
import { ColsWidget } from "./layout/ColsWidget";
import { InfoboxWidget } from "./layout/InfoboxWidget";
import { CountdownRingsWidget } from "./time/CountdownRingsWidget";
import { DebugWidget } from "./dashboard/DebugWidget";
import { LauncherModal } from "./layout/LauncherModal";

const PRAYER_FRONTMATTER_KEYS = new Set(["fajr", "dhuhr", "asr", "maghrib", "isha"]);

export default class UmOSPlugin extends Plugin {
	settings: UmOSSettings = { ...DEFAULT_SETTINGS };
	data_store: UmOSData = { ...DEFAULT_DATA };
	eventBus: EventBus = new EventBus();
	widgetRegistry: WidgetRegistry = new WidgetRegistry();

	private inputWidgetManager: InputWidgetManager | null = null;
	private prayerService: PrayerService | null = null;
	private prayerStatusBar: PrayerStatusBar | null = null;
	public statsEngine: StatsEngine | null = null;
	private sharedFmHelper: FrontmatterHelper | null = null;
	private statusBarItemEl: HTMLElement | null = null;
	private gifOverlayEl: HTMLElement | null = null;
	private dailyNoteEnhancer: DailyNoteEnhancer | null = null;
	public dynamicFrontmatterService: DynamicFrontmatterService | null = null;
	private weatherService: WeatherService | null = null;
	public vaultSyncService!: VaultSyncService;
	private vaultSyncStatusBarEl: HTMLElement | null = null;
	private vaultSyncDebounceTimer: number | null = null;

	async onload(): Promise<void> {
		console.log("umOS: loading plugin...");
		await this.loadSettings();
		addIcon(UMOS_ICON_ID, UMOS_LOGO_SVG);
		addIcon(UMOS_SYNC_ICON_ID, UMOS_SYNC_ICON_SVG);
		setLanguage(this.settings.language);
		installGlobalDomLocalization();
		this.cleanupLegacySettingsStyles();
		this.vaultSyncService = new VaultSyncService(this.app, this);
		this.dynamicFrontmatterService = new DynamicFrontmatterService(this.app, this);

		this.sharedFmHelper = new FrontmatterHelper(this.app, this.eventBus);
		this.buildWidgetRegistry();
		this.addSettingTab(new UmOSSettingsTab(this.app, this));

		// Input System
		try {
			this.inputWidgetManager = new InputWidgetManager(this);
			this.inputWidgetManager.register();
			
			const slashSuggest = new SlashCommandSuggest(this.app);
			slashSuggest.setBoardIds(Object.keys(this.data_store.kanbanBoards || {}));
			this.registerEditorSuggest(slashSuggest);
		} catch (error) {
			console.error("umOS: failed to initialize InputWidgetManager:", error);
		}

		// Prayer — init  ,
		try {
			this.prayerService = new PrayerService(this.app, this.eventBus, this.settings);
			this.prayerService.init((id) => this.registerInterval(id))
				.then(() => new Notice(t("🕌 umOS: prayer times loaded"), 3000))
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

		// Stats
		try {
			this.statsEngine = new StatsEngine(this.app, this.eventBus, this.settings);
			this.statsEngine.init((ref) => this.registerEvent(ref));
		} catch (error) {
			console.error("umOS: failed to initialize Stats module:", error);
		}

		// Weather — init  ,
		try {
			this.weatherService = new WeatherService(
				this.eventBus,
				this.settings
			);
			this.weatherService.init((id) => this.registerInterval(id))
				.then(() => new Notice(t("🌤 umOS: weather loaded"), 3000))
				.catch((error) => console.error("umOS: failed to fetch weather:", error));
		} catch (error) {
			console.error("umOS: failed to initialize Weather module:", error);
		}

		// Location update handler
		this.eventBus.on("location:updated", () => {
			if (this.prayerService) this.prayerService.refresh();
			if (this.weatherService) this.weatherService.forceFetch();
		});

		// Home View — ,      (  hot-reload)
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
						(property, value) => this.setTodayPrayerCompletion(property, value),
						this.weatherService,
						() => this.saveSettings(),
						this
					)
				);
			} else {
				//     text
				this.app.workspace.getLeavesOfType(HOME_VIEW_TYPE).forEach(leaf => leaf.detach());
			}
		} catch (error) {
			console.error("umOS: failed to initialize Home View:", error);
		}

		try {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const viewRegistry = (this.app as any).viewRegistry;
			const alreadyRegistered = viewRegistry?.views && TASK_CALENDAR_VIEW_TYPE in viewRegistry.views;
			if (!alreadyRegistered) {
				this.registerView(TASK_CALENDAR_VIEW_TYPE, (leaf) =>
					new TaskCalendarView(leaf, this.app, this)
				);
			} else {
				this.app.workspace.getLeavesOfType(TASK_CALENDAR_VIEW_TYPE).forEach(leaf => leaf.detach());
			}
		} catch (error) {
			console.error("umOS: failed to initialize Task Calendar View:", error);
		}

		try {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const viewRegistry = (this.app as any).viewRegistry;
			const alreadyRegistered = viewRegistry?.views && IMAGE_GALLERY_VIEW_TYPE in viewRegistry.views;
			if (!alreadyRegistered) {
				this.registerView(IMAGE_GALLERY_VIEW_TYPE, (leaf) =>
					new ImageGalleryView(leaf, this.app, this)
				);
			} else {
				this.app.workspace.getLeavesOfType(IMAGE_GALLERY_VIEW_TYPE).forEach(leaf => leaf.detach());
			}
		} catch (error) {
			console.error("umOS: failed to initialize Image Gallery View:", error);
		}


		// Daily Note Enhancer
		try {
			this.dailyNoteEnhancer = new DailyNoteEnhancer(
				this.app,
				() => this.settings,
				this.eventBus,
				() => this.data_store
			);
			this.app.workspace.onLayoutReady(() => {
				void this.ensureTodayDailyNoteIfEnabled();
			});
			this.registerInterval(window.setInterval(() => {
				void this.ensureTodayDailyNoteIfEnabled();
			}, 300000));
		} catch (error) {
			console.error("umOS: failed to initialize Daily Note Enhancer:", error);
		}

		// Widgets
		try {
			this.registerWidgets();
			this.registerMarkdownPostProcessor((el) => {
				decorateCodeBlocks(el);
			});
		} catch (error) {
			console.error("umOS: failed to register widgets:", error);
		}

		// Tasks — deadline notifications on startup
		void this.checkDeadlineNotifications();

		// Commands & Ribbon
		try {
			this.registerCommands();
			this.registerRibbonIcons();
			this.updateVaultSyncStatusBar();
			this.initVaultSyncRuntime();
		} catch (error) {
			console.error("umOS: failed to register commands:", error);
		}
		
		// Dynamic Frontmatter
		this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
			void this.dynamicFrontmatterService?.handleRename(file, oldPath);
		}));

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

		this.registerEvent(
			this.app.workspace.on("css-change", () => {
				this.applyBodyClasses();
			})
		);

		// Refresh GIF + body classes when settings change
		this.eventBus.on("settings:changed", () => {
			setLanguage(this.settings.language);
			this.initGifOverlay();
			this.applyBodyClasses();
			void this.ensureTodayDailyNoteIfEnabled();
		});


		// Welcome screen — first run only
		if (!this.settings.hasSeenWelcome) {
			new WelcomeModal(this.app, this).open();
			this.settings.hasSeenWelcome = true;
			void this.saveSettings();
		}

		console.log("umOS: plugin loaded.");
	}

	onunload(): void {
		console.log("umOS: plugin unloaded.");
		uninstallGlobalDomLocalization();
		this.cleanupLegacySettingsStyles();
		this.destroyGifOverlay();
		document.body.removeClass("umos-infobox-sticky");
		document.body.style.removeProperty("--umos-soft-wide-line-width");
		if (this.inputWidgetManager) { this.inputWidgetManager.destroy(); this.inputWidgetManager = null; }
		if (this.prayerStatusBar) { this.prayerStatusBar.destroy(); this.prayerStatusBar = null; }
		if (this.sharedFmHelper) { this.sharedFmHelper.destroy(); this.sharedFmHelper = null; }
		if (this.vaultSyncDebounceTimer) {
			window.clearTimeout(this.vaultSyncDebounceTimer);
			this.vaultSyncDebounceTimer = null;
		}
		this.prayerService = null;
		this.statsEngine = null;
		this.dailyNoteEnhancer = null;
		this.app.workspace.detachLeavesOfType(HOME_VIEW_TYPE);
		this.app.workspace.detachLeavesOfType(TASK_CALENDAR_VIEW_TYPE);
		this.app.workspace.detachLeavesOfType(IMAGE_GALLERY_VIEW_TYPE);

		this.eventBus.offAll();
	}

	private initVaultSyncRuntime(): void {
		this.vaultSyncStatusBarEl = this.addStatusBarItem();
		this.updateVaultSyncStatusBar();

		if (this.settings.syncOnStartup) {
			this.app.workspace.onLayoutReady(() => {
				void this.runVaultSync("bidirectional", false, "startup");
			});
		}

		if ((this.settings.syncIntervalMinutes ?? 0) > 0) {
			const intervalMs = Math.max(1, this.settings.syncIntervalMinutes) * 60_000;
			this.registerInterval(window.setInterval(() => {
				void this.runVaultSync(this.settings.syncMode, false, "interval");
			}, intervalMs));
		}

		if ((this.settings.syncDebounceSeconds ?? 0) > 0) {
			const schedule = () => this.scheduleDebouncedVaultSync();
			this.registerEvent(this.app.vault.on("create", schedule));
			this.registerEvent(this.app.vault.on("modify", schedule));
			this.registerEvent(this.app.vault.on("delete", schedule));
			this.registerEvent(this.app.vault.on("rename", schedule));
		}
	}

	public updateVaultSyncStatusBar(): void {
		if (!this.vaultSyncStatusBarEl) return;
		const status = this.data_store.sync?.lastStatus ?? "idle";
		const message = this.data_store.sync?.lastMessage || "Vault sync idle";
		this.vaultSyncStatusBarEl.empty();
		this.vaultSyncStatusBarEl.addClass("umos-vault-sync-status");
		this.vaultSyncStatusBarEl.toggleClass("is-running", status === "running");
		this.vaultSyncStatusBarEl.toggleClass("is-failed", status === "failed");
		this.vaultSyncStatusBarEl.toggleClass("is-success", status === "success");
		this.vaultSyncStatusBarEl.setText(status === "running" ? "sync..." : `sync: ${status}`);
		this.vaultSyncStatusBarEl.title = message;
	}

	private scheduleDebouncedVaultSync(): void {
		if (this.vaultSyncService?.isRunning()) return;
		if (this.vaultSyncDebounceTimer) window.clearTimeout(this.vaultSyncDebounceTimer);
		const delay = Math.max(1, this.settings.syncDebounceSeconds || 0) * 1000;
		this.vaultSyncDebounceTimer = window.setTimeout(() => {
			this.vaultSyncDebounceTimer = null;
			void this.runVaultSync(this.settings.syncMode, false, "debounce");
		}, delay);
	}

	private async runVaultSync(mode = this.settings.syncMode, dryRun = false, reason = "manual"): Promise<void> {
		const progressNotice = new SyncProgressNotice(this);
		try {
			await this.vaultSyncService.run({
				mode,
				dryRun,
				reason,
				onProgress: (progress) => progressNotice.update(progress),
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			const cancelled = message.toLowerCase().includes("cancelled");
			progressNotice.update({
				status: cancelled ? "cancelled" : "failed",
				phase: cancelled ? "Cancelled" : "Failed",
				message,
				current: cancelled ? 100 : 0,
				total: 100,
				percent: cancelled ? 100 : 0,
				cancellable: false,
			});
		}
		this.updateVaultSyncStatusBar();
	}

	public async activateHomeView(): Promise<void> {
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
			new Notice("❌ Could not open Home");
		}
	}

	public async activateTaskCalendarView(): Promise<void> {
		try {
			const existing = this.app.workspace.getLeavesOfType(TASK_CALENDAR_VIEW_TYPE);
			if (existing.length > 0) {
				this.app.workspace.revealLeaf(existing[0]);
				return;
			}
			const leaf = this.app.workspace.getLeaf("tab");
			await leaf.setViewState({ type: TASK_CALENDAR_VIEW_TYPE, active: true });
			this.app.workspace.revealLeaf(leaf);
		} catch (error) {
			console.error("umOS: failed to open Task Calendar View:", error);
			new Notice("❌ Could not open Task Calendar");
		}
	}

	public async activateImageGalleryView(): Promise<void> {
		try {
			const existing = this.app.workspace.getLeavesOfType(IMAGE_GALLERY_VIEW_TYPE);
			if (existing.length > 0) {
				this.app.workspace.revealLeaf(existing[0]);
				return;
			}
			const leaf = this.app.workspace.getLeaf("tab");
			await leaf.setViewState({ type: IMAGE_GALLERY_VIEW_TYPE, active: true });
			this.app.workspace.revealLeaf(leaf);
		} catch (error) {
			console.error("umOS: failed to open Image Gallery View:", error);
			new Notice("❌ Could not open Image Gallery");
		}
	}

	public openSyncCenterModal(): void {
		new SyncCenterModal(this).open();
	}

	public openOmniSearchModal(): void {
		new OmniSearchModal(this.app, this).open();
	}

	public async ensureDailyNoteFile(
		dateISO?: string,
		options: { open?: boolean; notify?: boolean } = {},
	): Promise<TFile | null> {
		if (!this.dailyNoteEnhancer) return null;
		return this.dailyNoteEnhancer.ensureDailyNote(dateISO, options);
	}

	private async ensureTodayDailyNoteIfEnabled(): Promise<void> {
		if (!this.settings.dailyAutoCreate || !this.dailyNoteEnhancer) return;
		await this.dailyNoteEnhancer.ensureDailyNote(undefined, { open: false, notify: false });
	}

	private async setTodayPrayerCompletion(property: string, value: boolean): Promise<void> {
		if (!PRAYER_FRONTMATTER_KEYS.has(property)) return;
		if (!this.dailyNoteEnhancer) {
			new Notice("❌ DailyNoteEnhancer is not initialized");
			return;
		}

		const file = await this.dailyNoteEnhancer.ensureDailyNote(undefined, { open: false, notify: false });
		if (!(file instanceof TFile)) {
			new Notice("❌ Could not find or create the daily note");
			return;
		}

		try {
			await this.app.fileManager.processFrontMatter(file, (fm) => {
				fm[property] = value;
			});
			this.eventBus.emit("frontmatter:changed", {
				path: file.path,
				property,
				value,
			});
		} catch (error) {
			console.error(`umOS: failed to update prayer completion [${property}]:`, error);
			new Notice("❌ Could not mark prayer");
		}
	}

	private cleanupLegacySettingsStyles(): void {
		document
			.querySelectorAll(".vertical-tab-content-container.umos-settings-root")
			.forEach((el) => el.classList.remove("umos-settings-root"));
	}

	// ─── Widget Registry ──────────────────────────
	private async checkDeadlineNotifications(): Promise<void> {
		setTimeout(async () => {
			try {
				const taskService = new TaskService(this.app, this);
				const { overdue, dueToday } = await taskService.getUrgentTasks();
				if (overdue.length > 0) {
					new Notice(`⚠️ Overdue tasks: ${overdue.length}`, 8000);
				}
				if (dueToday.length > 0) {
					new Notice(`📅 Tasks due today: ${dueToday.length}`, 5000);
				}
			} catch (e) {
				console.error("umOS: error checking deadlines:", e);
			}
		}, 5000);
	}

	private buildWidgetRegistry(): void {
		this.widgetRegistry = new WidgetRegistry();
		for (const definition of createBaseWidgetDefinitions()) {
			const def = { ...definition };
			switch (def.blockName) {
				case "prayer-widget":
					def.factory = ({ el, ctx, config }) => {
						if (!this.prayerService) return;
						const container = el.createDiv({ cls: "umos-widget-container" });
						ctx.addChild(new PrayerWidget(container, {
							show: (config.show as "times" | "next" | "both") || "both",
							style: (config.style as "full" | "compact") || "full",
							showSunrise: config.show_sunrise !== undefined
								? config.show_sunrise === true || config.show_sunrise === "true"
								: this.settings.prayerShowSunrise,
						}, this.app, this.prayerService, this.eventBus, this.settings));
					};
					break;
				case "umos-stats":
					def.factory = ({ el, ctx, config }) => {
						if (!this.statsEngine) {
							createErrorMessage(el, "StatsEngine is not initialized");
							return;
						}
						const metrics = Array.isArray(config.metrics) ? (config.metrics as string[]).map(String) : undefined;
						const container = el.createDiv({ cls: "umos-widget-container" });
						ctx.addChild(new StatsWidget(container, {
							metrics,
							period: Number(config.period) || undefined,
							range: typeof config.range === "string" ? config.range : undefined,
							dateFrom: typeof config.dateFrom === "string" ? config.dateFrom : typeof config.date_from === "string" ? config.date_from : undefined,
							dateTo: typeof config.dateTo === "string" ? config.dateTo : typeof config.date_to === "string" ? config.date_to : undefined,
							chart: (config.chart as "sparkline" | "bar" | "ring" | "none") || "sparkline",
							compare: config.compare === true || config.compare === "true",
						}, this.app, this.statsEngine, this.eventBus, this.settings));
					};
					break;
				case "words-of-day":
					def.factory = ({ el, ctx, config }) => {
						if (!this.statsEngine) return;
						const container = el.createDiv({ cls: "umos-widget-container" });
						ctx.addChild(new WordsOfDayWidget(container, {
							period: Number(config.period) || 30,
							field: String(config.field || "word_of_day"),
						}, this.statsEngine, this.eventBus));
					};
					break;
				case "schedule":
					def.factory = ({ el, ctx, config }) => {
						const container = el.createDiv({ cls: "umos-widget-container" });
						ctx.addChild(new ScheduleWidget(container, {
							show: (config.show as "current" | "week" | "both") || "current",
							highlight: config.highlight !== false,
							countdown: config.countdown !== false,
							tasks: config.tasks === true || config.tasks === "true",
							taskMode: (config.task_mode as "both" | "due" | "scheduled") || "both",
							taskPath: typeof config.task_path === "string" ? config.task_path : undefined,
						}, this.app, this.eventBus, () => this.data_store));
					};
					break;
				case "content-gallery":
					def.factory = ({ el, ctx, config }) => {
						const container = el.createDiv({ cls: "umos-widget-container" });
						ctx.addChild(new ContentGallery(container, {
							style: (config.style as "grid" | "list") || "grid",
						}, this.app, this.eventBus, this.settings));
					};
					break;
				case "project-gallery":
					def.factory = ({ el, ctx, config }) => {
						const container = el.createDiv({ cls: "umos-widget-container" });
						ctx.addChild(new ProjectGallery(container, {
							style: (config.style as "grid" | "list") || "grid",
						}, this.app, this.eventBus, this.settings));
					};
					break;
				case "tasks-stats-widget":
					def.factory = ({ el, ctx, config }) => {
						const container = el.createDiv({ cls: "umos-widget-container" });
						ctx.addChild(new TasksStatsWidget(container, config, this.app, this));
					};
					break;
				case "tasks-completed-widget":
					def.factory = ({ el, ctx, config }) => {
						const container = el.createDiv({ cls: "umos-widget-container" });
						ctx.addChild(new TasksCompletedWidget(container, config, this.app, this));
					};
					break;
				case "tasks-widget":
					def.factory = ({ el, ctx, config }) => {
						const container = el.createDiv({ cls: "umos-widget-container" });
						ctx.addChild(new TasksWidget(container, config, this.app, this, ctx.sourcePath));
					};
					break;
				case "tasks-kanban":
					def.factory = ({ el, ctx, config }) => {
						const container = el.createDiv({ cls: "umos-widget-container" });
						ctx.addChild(new TasksKanbanWidget(container, config, this.app, this, ctx.sourcePath));
					};
					break;
				case "progress-table":
					def.factory = ({ source, el, ctx }) => {
						const container = el.createDiv({ cls: "umos-widget-container" });
						ctx.addChild(new ProgressTableWidget(container, source, ctx.sourcePath, this, this.eventBus, ctx, el));
					};
					break;
				case "daily-nav":
					def.factory = ({ el, ctx }) => {
						const container = el.createDiv({ cls: "umos-widget-container" });
						ctx.addChild(new DailyNavWidget(container, this.app, this.settings, async (dateISO) => {
							if (this.dailyNoteEnhancer) await this.dailyNoteEnhancer.createDailyNote(dateISO);
						}));
					};
					break;
				case "countdown":
				case "countdown-rings":
					def.factory = ({ el, ctx, config }) => {
						const container = el.createDiv({ cls: "umos-widget-container" });
						ctx.addChild(new CountdownRingsWidget(container, {
							date: typeof config.date === "string" ? config.date : undefined,
							target: typeof config.target === "string" ? config.target : undefined,
							title: typeof config.title === "string" ? config.title : undefined,
							accent: typeof config.accent === "string" ? config.accent : undefined,
							layout: typeof config.layout === "string" ? config.layout as "grid" | "nested" : undefined,
							nested: config.nested === true,
							view: typeof config.view === "string" ? config.view as "full" | "focus" | "minimal" : undefined,
							legend: typeof config.legend === "boolean" ? config.legend : undefined,
							showLegend: typeof config.show_legend === "boolean" ? config.show_legend : undefined,
						}));
					};
					break;
				case "word-of-day":
					def.factory = ({ el, ctx, config }) => {
						const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
						if (!(file instanceof TFile) || !this.sharedFmHelper) return;
						const property = typeof config.property === "string" && config.property ? config.property : "word_of_day";
						const placeholder = typeof config.placeholder === "string" && config.placeholder ? config.placeholder : "Click to write the word of the day...";
						const container = el.createDiv({ cls: "umos-widget-container" });
						ctx.addChild(new WordOfDayWidget(container, this.app, file, this.sharedFmHelper, property, placeholder));
					};
					break;
				case "daily-review":
					def.factory = ({ el, ctx, config }) => {
						const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
						if (!(file instanceof TFile)) return;
						const container = el.createDiv({ cls: "umos-widget-container" });
						ctx.addChild(new DailyReviewWidget(container, this.app, file, this.eventBus, {
							mode: (config.mode as "daily" | "weekly") || "daily",
							title: typeof config.title === "string" ? config.title : undefined,
						}));
					};
					break;
				case "kanban-board":
					def.factory = ({ el, ctx, config }) => {
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
					};
					break;
				case "cols-umos":
					def.factory = ({ source, el, ctx }) => {
						ctx.addChild(new ColsWidget(el, this.app, source, ctx.sourcePath));
					};
					break;
				case "info-umos":
					def.factory = ({ source, el, ctx }) => {
						ctx.addChild(new InfoboxWidget(el, this.app, source, ctx.sourcePath));
					};
					break;
				case "umos-debug":
					def.factory = ({ el, ctx, config }) => {
						const container = el.createDiv({ cls: "umos-widget-container" });
						ctx.addChild(new DebugWidget(container, this.eventBus, {
							show: (config.show as "all" | "events" | "widgets" | "compact") || "all",
							limit: Number(config.limit) || 12,
						}));
					};
					break;
			}
			this.widgetRegistry.register(def);
		}
	}

	private registerWidgets(): void {
		for (const definition of this.widgetRegistry.getRenderable()) {
			try {
				this.registerMarkdownCodeBlockProcessor(definition.blockName, (source, el, ctx) => {
					this.eventBus.recordWidgetRender(definition.blockName);
					const validation = this.widgetRegistry.parseAndValidate(definition.blockName, source);
					if (validation.errors.length > 0 || validation.warnings.length > 0) {
						this.eventBus.recordWidgetConfigInvalid({
							blockName: definition.blockName,
							sourcePath: ctx.sourcePath,
							errors: validation.errors,
							warnings: validation.warnings,
						});
						this.eventBus.emit("widget:config-invalid", {
							blockName: definition.blockName,
							sourcePath: ctx.sourcePath,
							errors: validation.errors,
							warnings: validation.warnings,
						});
					}
					if (validation.errors.length > 0) {
						createErrorMessage(el, validation.errors.join(" "));
						return;
					}
					if (validation.warnings.length > 0) {
						createElement("div", {
							cls: "umos-warning-message",
							text: `⚠️ ${validation.warnings.join(" ")}`,
							parent: el,
						});
					}
					definition.factory?.({ source, el, ctx, config: validation.config });
				});
			} catch {
				//   (hot-reload) —
			}
		}
	}

	// ─── Settings ──────────────────────────
	async loadSettings(): Promise<void> {
		try {
			const loaded = await this.loadData() as unknown;
			if (loaded && typeof loaded === "object") {
				const loadedData = loaded as Record<string, unknown>;
				const loadedSettings = loadedData.settings as Partial<UmOSSettings> | undefined;
				this.settings = { ...DEFAULT_SETTINGS, ...loadedSettings };
				if (loadedSettings && !("language" in loadedSettings)) {
					this.settings.language = "ru";
				}
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

		this.migrateSettings();
	}

	private migrateSettings(): void {
		let dirty = false;
		const removedSections = new Set([
			"pomodoro",
			"goals",
			"finance",
			"balance",
			"ramadan",
			"exams",
			"alerts",
			"quick-capture",
			"vault-health",
		]);
		const filteredSections = this.settings.homeVisibleSections.filter((section) => !removedSections.has(section));
		if (filteredSections.length !== this.settings.homeVisibleSections.length) {
			this.settings.homeVisibleSections = filteredSections;
			dirty = true;
		}

		const removedDashboards = ["Goals", "Pomodoro", "Finance", "Balance", "Quran", "Habits", "Ramadan", "Exams"];
		const filteredCards = this.settings.homeNavCards.filter((card) => !removedDashboards.some((name) => card.path.includes(name)));
		if (filteredCards.length !== this.settings.homeNavCards.length) {
			this.settings.homeNavCards = filteredCards;
			dirty = true;
		}

		const filteredMetrics = this.settings.homeStatsMetrics.filter((metric) => !["exercise", "reading", "water", "quran", "study"].includes(metric));
		if (filteredMetrics.length !== this.settings.homeStatsMetrics.length) {
			this.settings.homeStatsMetrics = filteredMetrics;
			dirty = true;
		}

		if (!Array.isArray(this.settings.habits)) {
			this.settings.habits = [...DEFAULT_SETTINGS.habits];
			dirty = true;
		} else {
			const removedDefaultHabitIds = new Set(["water", "quran", "study"]);
			const filteredHabits = this.settings.habits.filter((habit) => !removedDefaultHabitIds.has(habit.id));
			if (filteredHabits.length !== this.settings.habits.length) {
				this.settings.habits = filteredHabits;
				dirty = true;
			}
		}

		const dailySections = this.settings.dailySections as unknown as Record<string, unknown>;
		const allowedDailySectionKeys = new Set(Object.keys(DEFAULT_SETTINGS.dailySections));
		for (const key of Object.keys(dailySections)) {
			if (!allowedDailySectionKeys.has(key)) {
				delete dailySections[key];
				dirty = true;
			}
		}
		for (const [key, value] of Object.entries(DEFAULT_SETTINGS.dailySections)) {
			if (typeof dailySections[key] !== "boolean") {
				dailySections[key] = value;
				dirty = true;
			}
		}

		const legacySettings = this.settings as unknown as Record<string, unknown>;
		const allowedSettingsKeys = new Set(Object.keys(DEFAULT_SETTINGS));
		for (const key of Object.keys(legacySettings)) {
			if (!allowedSettingsKeys.has(key)) {
				delete legacySettings[key];
				dirty = true;
			}
		}

		const legacyDataStore = this.data_store as unknown as Record<string, unknown>;
		const allowedDataKeys = new Set(Object.keys(DEFAULT_DATA));
		for (const key of Object.keys(legacyDataStore)) {
			if (!allowedDataKeys.has(key)) {
				delete legacyDataStore[key];
				dirty = true;
			}
		}

		if (dirty) void this.saveSettings();
	}

	async saveSettings(): Promise<void> {
		try {
			this.data_store.settings = this.settings;
			this.data_store.syncedAt = Date.now();
			await this.saveData(this.data_store);
			this.eventBus.emit("settings:changed");
		} catch (error) {
			console.error("umOS: failed to save settings:", error);
			new Notice("❌ Could not save settings");
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
			name: "Open Home",
			icon: UMOS_ICON_ID,
			callback: () => { this.activateHomeView(); },
		});

		this.addCommand({
			id: "umos:task-calendar",
			name: "Task Calendar",
			callback: () => { this.activateTaskCalendarView(); },
		});

		this.addCommand({
			id: "umos:image-gallery",
			name: "Image Gallery",
			callback: () => { this.activateImageGalleryView(); },
		});


		this.addCommand({
			id: "umos:omni-search",
			name: "Better Search",
			callback: () => { this.openOmniSearchModal(); },
		});


		this.addCommand({
			id: "umos:sync-center",
			name: "Sync Center",
			callback: () => { this.openSyncCenterModal(); },
		});

		this.addCommand({
			id: "umos:vault-sync",
			name: "Vault Sync",
			callback: () => { void this.runVaultSync(this.settings.syncMode, false, "command"); },
		});

		this.addCommand({
			id: "umos:vault-sync-dry-run",
			name: "Vault Sync Dry Run",
			callback: () => { void this.runVaultSync(this.settings.syncMode, true, "command"); },
		});

		this.addCommand({
			id: "umos:vault-sync-pull",
			name: "Vault Sync Pull",
			callback: () => { void this.runVaultSync("pull", false, "command"); },
		});

		this.addCommand({
			id: "umos:vault-sync-push",
			name: "Vault Sync Push",
			callback: () => { void this.runVaultSync("push", false, "command"); },
		});

		this.addCommand({
			id: "umos-sync-frontmatter",
			name: "Sync Frontmatter with Folders",
			callback: () => {
				void this.dynamicFrontmatterService?.syncAllFiles(true);
			},
		});

		this.addCommand({
			id: "umos:create-daily",
			name: "Create Daily Note",
			callback: async () => {
				if (this.dailyNoteEnhancer) {
					await this.dailyNoteEnhancer.createDailyNote();
				} else {
					new Notice("❌ DailyNoteEnhancer is not initialized");
				}
			},
		});

		this.addCommand({
			id: "umos:edit-schedule",
			name: "Schedule Editor",
			callback: () => {
				new ScheduleEditor(this.app, this.data_store, this.eventBus, () => this.saveSettings()).open();
			},
		});

		this.addCommand({
			id: "umos:dashboard-studio",
			name: "Dashboard Studio",
			callback: () => {
				new DashboardStudioModal(this).open();
			},
		});

		this.addCommand({
			id: "umos:refresh-api-data",
			name: "Force-refresh all API data",
			callback: async () => {
				new Notice("↻ umOS: refreshing API data...", 2000);
				const [weather, prayer] = await Promise.all([
					this.weatherService ? this.weatherService.forceFetch() : Promise.resolve(null),
					this.prayerService ? this.prayerService.refresh() : Promise.resolve(null),
				]);
				new ApiRefreshModal(this.app, { weather, prayer }, {
					city: this.settings.locationCity,
					latitude: this.settings.locationLatitude,
					longitude: this.settings.locationLongitude,
					prayerMethod: this.settings.prayerMethod,
				}).open();
			},
		});

		this.addCommand({
			id: "umos:next-prayer",
			name: "Next prayer",
			callback: () => {
				if (!this.prayerService) {
					new Notice("Prayer data is not loaded yet");
					return;
				}
				const next = this.prayerService.getNextPrayer();
				if (next) {
					const h = Math.floor(next.minutesLeft / 60);
					const m = next.minutesLeft % 60;
					new Notice(`${next.icon} ${next.nameRu} — ${next.time} (in ${h > 0 ? `${h}h ${m}min` : `${m}min`})`);
				} else if (this.prayerService.allPrayersDone()) {
					new Notice("✅ All prayers are completed for today");
				} else {
					new Notice("🕌 Prayer data is loading...");
				}
			},
		});

		this.addCommand({
			id: "umos:format-picker",
			name: "Text Formatting",
			callback: () => {
				const boardIds = Object.keys(this.data_store.kanbanBoards || {});
				new FormatPickerModal(this.app, boardIds).open();
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

		//   GIF
		const divider = document.createElement("div");
		divider.className = "umos-gif-divider";

		const svgSrc = s.gifDividerSvg?.trim() ?? "";
		if (svgSrc) {
			if (/^<svg[\s>]/i.test(svgSrc)) {
				//  SVG-
				divider.innerHTML = svgSrc;
				divider.classList.add("style-svg");
			} else {
				// Path
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

	/**  /  CSS-  <body>,   . */
	private applyBodyClasses(): void {
		const body = document.body;
		body.toggleClass("umos-infobox-sticky", this.settings.infoboxSticky === true);
		const softWideWidth = Number(this.settings.softWideLineWidth) || DEFAULT_SETTINGS.softWideLineWidth;
		body.style.setProperty("--umos-soft-wide-line-width", `${softWideWidth}px`);
	}

	private resolveGifPath(pathOrUrl: string): string {
		if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) return pathOrUrl;
		const file = this.app.vault.getAbstractFileByPath(pathOrUrl);
		if (file) return this.app.vault.getResourcePath(file as TFile);
		return pathOrUrl;
	}

	// ─── Ribbon ──────────────────────────
	private registerRibbonIcons(): void {
		this.addRibbonIcon(UMOS_ICON_ID, "umOS Menu", () => {
			new LauncherModal(this.app, this).open();
		});
	}
}


