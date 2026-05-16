import { App, ItemView, MarkdownView, TFile, WorkspaceLeaf } from "obsidian";
import { EventBus } from "../EventBus";
import { UmOSSettings, UmOSData } from "../settings/Settings";
import { PrayerService } from "../religion/prayer/PrayerService";
import { StatsEngine } from "../stats/StatsEngine";
import { WeatherService } from "../weather/WeatherService";
import { createElement } from "../utils/dom";
import { HomeViewContext, RecentClosedNote } from "./types";
import { renderHeaderSection, updateClock } from "./sections/header";
import { renderWeatherSection } from "./sections/weather";
import { renderPrayerSection, updatePrayerCountdown } from "./sections/prayer";
import { renderNavigationSection } from "./sections/navigation";
import { renderStatsSection } from "./sections/stats";
import { renderTasksSection } from "./sections/tasks";
import { renderDeadlinesSection } from "./sections/deadlines";
import { renderProjectsSection } from "./sections/projects";
import { renderContentSection } from "./sections/content";
import { renderFooter } from "./sections/footer";
import { renderDesktopHome } from "./DesktopHomeView";
import type UmOSPlugin from "../main";

export const HOME_VIEW_TYPE = "umos-home-view";

type HomeLayout = "desktop" | "mobile";
const DESKTOP_HOME_MIN_WIDTH = 920;
const RECENT_CLOSED_NOTES_LIMIT = 8;
const HOME_PRAYER_FRONTMATTER_KEYS = new Set(["fajr", "dhuhr", "asr", "maghrib", "isha"]);

export class HomeView extends ItemView {
	private obsidianApp: App;
	private eventBus: EventBus;
	private settings: UmOSSettings;
	private getData: () => UmOSData;
	private prayerService: PrayerService | null;
	private statsEngine: StatsEngine | null;
	private createDailyNoteFn: (() => Promise<void>) | null;
	private setPrayerCompletionFn: ((property: string, value: boolean) => Promise<void>) | null;
	private weatherService: WeatherService | null;
	private saveSettingsFn: (() => Promise<void>) | null;
	private plugin: UmOSPlugin;
	private clockEl: HTMLElement | null = null;
	private countdownEl: HTMLElement | null = null;
	private contentContainerEl: HTMLElement | null = null;
	private resizeObserver: ResizeObserver | null = null;
	private currentLayout: HomeLayout | null = null;
	private openMarkdownPaths = new Set<string>();
	private recentClosedNotes: RecentClosedNote[] = [];

	constructor(
		leaf: WorkspaceLeaf,
		app: App,
		eventBus: EventBus,
		settings: UmOSSettings,
		getData: () => UmOSData,
		prayerService: PrayerService | null,
		statsEngine: StatsEngine | null,
		createDailyNoteFn: (() => Promise<void>) | null,
		setPrayerCompletionFn: ((property: string, value: boolean) => Promise<void>) | null,
		weatherService: WeatherService | null,
		saveSettingsFn: (() => Promise<void>) | null,
		plugin: UmOSPlugin
	) {
		super(leaf);
		this.obsidianApp = app;
		this.eventBus = eventBus;
		this.settings = settings;
		this.getData = getData;
		this.prayerService = prayerService;
		this.statsEngine = statsEngine;
		this.createDailyNoteFn = createDailyNoteFn;
		this.setPrayerCompletionFn = setPrayerCompletionFn;
		this.weatherService = weatherService;
		this.saveSettingsFn = saveSettingsFn;
		this.plugin = plugin;
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

		this.openMarkdownPaths = this.collectOpenMarkdownPaths();
		this.render();

		if (typeof ResizeObserver !== "undefined") {
			this.resizeObserver = new ResizeObserver(() => {
				const nextLayout = this.getLayoutForWidth(container.clientWidth);
				if (nextLayout !== this.currentLayout) {
					this.currentLayout = nextLayout;
					this.render();
				}
			});
			this.resizeObserver.observe(container);
			this.register(() => {
				this.resizeObserver?.disconnect();
				this.resizeObserver = null;
			});
		}

		this.registerInterval(
			window.setInterval(() => {
				this.updateClock();
				this.updatePrayerCountdown();
			}, 1000)
		);

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

		const dailyHandler = () => { this.render(); };
		this.eventBus.on("daily:created", dailyHandler);
		this.register(() => { this.eventBus.off("daily:created", dailyHandler); });

		const frontmatterHandler = (data: { path: string; property: string; value: unknown }) => {
			if (HOME_PRAYER_FRONTMATTER_KEYS.has(data.property)) {
				this.render();
			}
		};
		this.eventBus.on("frontmatter:changed", frontmatterHandler);
		this.register(() => { this.eventBus.off("frontmatter:changed", frontmatterHandler); });

		const weatherHandler = () => { this.render(); };
		this.eventBus.on("weather:updated", weatherHandler);
		this.register(() => { this.eventBus.off("weather:updated", weatherHandler); });

		const locationHandler = () => { this.render(); };
		this.eventBus.on("location:updated", locationHandler);
		this.register(() => { this.eventBus.off("location:updated", locationHandler); });

		this.registerEvent(
			this.obsidianApp.workspace.on("layout-change", () => {
				this.handleWorkspaceLayoutChange();
			})
		);

		const settingsHandler = () => { this.render(); };
		this.eventBus.on("settings:changed", settingsHandler);
		this.register(() => { this.eventBus.off("settings:changed", settingsHandler); });

		const tasksChangedHandler = () => { this.render(); };
		this.eventBus.on("tasks:changed", tasksChangedHandler);
		this.register(() => { this.eventBus.off("tasks:changed", tasksChangedHandler); });
	}

	async onClose(): Promise<void> {
		this.resizeObserver?.disconnect();
		this.resizeObserver = null;
		this.currentLayout = null;
		this.contentContainerEl = null;
		this.clockEl = null;
		this.countdownEl = null;
	}

	private collectOpenMarkdownPaths(): Set<string> {
		const paths = new Set<string>();
		this.obsidianApp.workspace.iterateAllLeaves((leaf) => {
			const view = leaf.view;
			if (view instanceof MarkdownView && view.file) {
				paths.add(view.file.path);
			}
		});
		return paths;
	}

	private addRecentClosedNote(path: string): void {
		const file = this.obsidianApp.vault.getAbstractFileByPath(path);
		const fallbackName = path.split("/").pop()?.replace(/\.md$/i, "") || path;
		const name = file instanceof TFile ? file.basename : fallbackName;

		this.recentClosedNotes = [
			{ name, path, closedAt: Date.now() },
			...this.recentClosedNotes.filter((note) => note.path !== path),
		].slice(0, RECENT_CLOSED_NOTES_LIMIT);
	}

	private handleWorkspaceLayoutChange(): void {
		const nextOpenPaths = this.collectOpenMarkdownPaths();
		let changed = false;

		for (const path of this.openMarkdownPaths) {
			if (!nextOpenPaths.has(path)) {
				this.addRecentClosedNote(path);
				changed = true;
			}
		}

		this.openMarkdownPaths = nextOpenPaths;

		if (changed && this.currentLayout === "desktop") {
			this.render();
		}
	}

	private getLayoutForWidth(width: number): HomeLayout {
		return width >= DESKTOP_HOME_MIN_WIDTH ? "desktop" : "mobile";
	}

	private getCurrentLayout(): HomeLayout {
		const containerWidth =
			(this.contentContainerEl?.parentElement as HTMLElement | null)?.clientWidth ??
			this.containerEl.clientWidth;
		return this.getLayoutForWidth(containerWidth);
	}

	private buildCtx(): HomeViewContext {
		return {
			app: this.obsidianApp,
			plugin: this.plugin,
			eventBus: this.eventBus,
			settings: this.settings,
			getData: this.getData,
			prayerService: this.prayerService,
			statsEngine: this.statsEngine,
			weatherService: this.weatherService,
			recentClosedNotes: [...this.recentClosedNotes],
			saveSettings: this.saveSettingsFn,
			createDailyNote: this.createDailyNoteFn,
			setPrayerCompletion: this.setPrayerCompletionFn,
		};
	}

	private render(): void {
		if (!this.contentContainerEl) return;
		this.contentContainerEl.empty();
		this.clockEl = null;
		this.countdownEl = null;

		const ctx = this.buildCtx();
		const layout = this.getCurrentLayout();
		this.currentLayout = layout;
		this.contentContainerEl.classList.toggle("is-desktop", layout === "desktop");
		this.contentContainerEl.classList.toggle("is-mobile", layout === "mobile");

		if (layout === "desktop") {
			const result = renderDesktopHome(this.contentContainerEl, ctx, this.settings.homeVisibleSections);
			this.clockEl = result.clockEl ?? null;
			this.countdownEl = result.countdownEl ?? null;
			this.applySectionAnimationIndexes();
			return;
		}

		this.renderMobile(this.contentContainerEl, ctx);
		this.applySectionAnimationIndexes();
	}

	private renderMobile(parent: HTMLElement, ctx: HomeViewContext): void {
		let headerRendered = false;

		for (const sectionId of this.settings.homeVisibleSections) {
			switch (sectionId) {
				case "clock":
				case "greeting":
					if (!headerRendered) {
						this.clockEl = renderHeaderSection(parent, ctx, this.settings.homeVisibleSections);
						headerRendered = true;
					}
					break;
				case "weather":
					renderWeatherSection(parent, ctx);
					break;
				case "prayer":
					this.countdownEl = renderPrayerSection(parent, ctx);
					break;
				case "navigation":
					renderNavigationSection(parent, ctx);
					break;
				case "stats":
					renderStatsSection(parent, ctx);
					break;
				case "tasks":
					renderTasksSection(parent, ctx);
					break;
				case "deadlines":
					renderDeadlinesSection(parent, ctx);
					break;
				case "projects":
					renderProjectsSection(parent, ctx);
					break;
				case "content":
					renderContentSection(parent, ctx);
					break;
				case "footer":
					renderFooter(parent, ctx);
					break;
			}
		}
	}

	private applySectionAnimationIndexes(): void {
		if (!this.contentContainerEl) return;
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
}
