import { App, PluginSettingTab, Setting, setIcon } from "obsidian";
import type UmOSPlugin from "../main";
import { setLanguage } from "../i18n";
import { createSection, type SettingsContext } from "./helpers";
import { renderScaffoldSection } from "./sections/scaffold";
import { renderDailyNoteSection } from "./sections/dailyNote";
import { renderLocationSection } from "./sections/location";
import { renderPrayerSection } from "./sections/prayer";
import { renderScheduleSection } from "./sections/schedule";
import { renderContentSection } from "./sections/content";
import { renderHomeSection } from "./sections/home";
import { renderTaskCalendarSection } from "./sections/taskCalendar";
import { renderStatsSection } from "./sections/stats";
import { renderSyncSection } from "./sections/sync";

import { renderProfileSection } from "./sections/profile";
import { renderDemoNoteSection } from "./sections/demoNote";
import { renderDashboardSection, renderDiagnosticsSection } from "./sections/dashboard";
import { renderDebugSection } from "./sections/debug";
import { renderVaultGuideSection } from "./sections/guide";
import { UMOS_ICON_ID } from "../branding";

interface SettingsTabMeta {
	id: string;
	icon: string;
	label: string;
	description: string;
	group: SettingsPageGroupId;
}

const SETTINGS_PAGE_GROUPS = [
	{
		id: "workspace",
		label: "Workspace",
		description: "Personal shell, home surface, and fast capture.",
	},
	{
		id: "planning",
		label: "Planning",
		description: "Tasks, calendar, study, and schedule flow.",
	},
	{
		id: "modules",
		label: "Modules",
		description: "Focused widgets for prayer, location, and content.",
	},
	{
		id: "build",
		label: "Build & Maintain",
		description: "Dashboard building, graph maps, alerts, and diagnostics.",
	},
	{
		id: "data",
		label: "Sync & Data",
		description: "Cloud sync, vault setup, demo notes, and legacy data tools.",
	},
] as const;

type SettingsPageGroupId = typeof SETTINGS_PAGE_GROUPS[number]["id"];

const TABS = [
	{
		id: "general",
		icon: "settings-2",
		label: "General",
		description: "Language, profile, appearance, sidebar GIF, and infobox behavior.",
		group: "workspace",
	},
	{
		id: "home",
		icon: "home",
		label: "Home & Daily",
		description: "Home dashboard, daily note template, habits, and visible metrics.",
		group: "workspace",
	},
	{
		id: "tasks",
		icon: "calendar-check",
		label: "Tasks & Calendar",
		description: "Task calendar sources, default view, week layout, and visible states.",
		group: "planning",
	},
	{
		id: "capture",
		icon: "wand-sparkles",
		label: "Quick Capture",
		description: "Fast forms and command input for capture workflows.",
		group: "workspace",
	},
	{
		id: "prayer",
		icon: "moon",
		label: "Prayer & Location",
		description: "Prayer calculation, status bar display, linked note, and saved locations.",
		group: "modules",
	},
	{
		id: "study",
		icon: "book-open",
		label: "Study",
		description: "Schedule and school grid parameters.",
		group: "planning",
	},
	{
		id: "content",
		icon: "boxes",
		label: "Content Gallery",
		description: "Media/content types, folders, fields, icons, and progress rules.",
		group: "modules",
	},
	{
		id: "dashboard",
		icon: "layout-dashboard",
		label: "Dashboard Studio",
		description: "Dashboard profiles, presets, preview, note generation, and diagnostics.",
		group: "build",
	},

	{
		id: "sync",
		icon: "refresh-cw",
		label: "Sync & Cloud",
		description: "Vault synchronization providers, encryption, autosync, and logs.",
		group: "data",
	},
	{
		id: "vault",
		icon: "database-zap",
		label: "Vault Setup",
		description: "Default vault structure and demo note generation.",
		group: "data",
	},
	{
		id: "guide",
		icon: "book",
		label: "Vault Guide",
		description: "Documentation on vault folders and dynamic frontmatter.",
		group: "data",
	},
	{
		id: "debug",
		icon: "bug",
		label: "Debug Tools",
		description: "Advanced functions, index rebuilding, and system reset.",
		group: "build",
	},
] as const satisfies readonly SettingsTabMeta[];

type TabId = typeof TABS[number]["id"];
type SettingsViewId = TabId | "main";

export class UmOSSettingsTab extends PluginSettingTab {
	plugin: UmOSPlugin;
	private activeView: SettingsViewId = "main";

	constructor(app: App, plugin: UmOSPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		const rootEl = containerEl.createDiv({ cls: "umos-settings-root umos-settings-tab" });

		const ctx: SettingsContext = {
			app: this.app,
			plugin: this.plugin,
			settings: this.plugin.settings,
			data_store: this.plugin.data_store,
			saveSettings: () => this.plugin.saveSettings(),
			display: () => this.display(),
		};

		const pages: Record<TabId, HTMLElement> = {} as Record<TabId, HTMLElement>;
		const groups: Record<TabId, HTMLElement> = {} as Record<TabId, HTMLElement>;
		const mainPage = rootEl.createDiv({ cls: "umos-settings-page umos-settings-main-page" });
		this.renderPageHeader(mainPage, {
			icon: UMOS_ICON_ID,
			label: "Settings",
			description: "Plugin sections and dashboard configuration.",
		});
		const mainContent = mainPage.createDiv({ cls: "umos-settings-page-content" });
		const navEl = mainContent.createDiv({ cls: "umos-settings-nav" });

		for (const group of SETTINGS_PAGE_GROUPS) {
			const groupEl = navEl.createDiv({ cls: "umos-settings-nav-group" });
			groupEl.createEl("h2", { cls: "umos-settings-nav-group-title", text: group.label });
			groupEl.createDiv({ cls: "umos-settings-nav-group-desc", text: group.description });
			const listEl = groupEl.createDiv({ cls: "umos-settings-nav-list" });
			for (const tab of TABS.filter((candidate) => candidate.group === group.id)) {
				this.renderMainPageLink(listEl, tab, pages, mainPage);
			}
		}
		this.renderPluginInfo(mainContent);

		for (const tab of TABS) {
			const pageEl = rootEl.createDiv({ cls: "umos-settings-page umos-settings-detail-page" });
			const headerEl = this.renderPageHeader(pageEl, tab, true);
			headerEl.addEventListener("click", () => this.showView("main", pages, mainPage));

			const groupEl = pageEl.createDiv({ cls: "umos-settings-page-content umos-settings-group" });
			const introEl = groupEl.createDiv({ cls: "umos-settings-group-header" });
			introEl.createEl("p", {
				text: tab.description,
				cls: "umos-settings-group-desc",
			});

			pages[tab.id] = pageEl;
			groups[tab.id] = groupEl;
		}

		this.renderLanguageSetting(groups.general, ctx);
		renderProfileSection(groups.general, ctx);

		renderHomeSection(groups.home, ctx);
		renderDailyNoteSection(groups.home, ctx);
		renderStatsSection(groups.home, ctx);

		renderTaskCalendarSection(groups.tasks, ctx);


		renderPrayerSection(groups.prayer, ctx);
		renderLocationSection(groups.prayer, ctx);

		renderScheduleSection(groups.study, ctx);

		renderContentSection(groups.content, ctx);

		renderDashboardSection(groups.dashboard, ctx);
		renderDiagnosticsSection(groups.dashboard, ctx);



		renderSyncSection(groups.sync, ctx);

		renderScaffoldSection(groups.vault, ctx);
		renderDemoNoteSection(groups.vault, ctx);

		if (groups.guide) renderVaultGuideSection(groups.guide, ctx);
		if (groups.debug) renderDebugSection(groups.debug, ctx);

		this.wrapSettingsSections(rootEl);
		this.showView(this.activeView, pages, mainPage);
	}

	private renderPageHeader(
		containerEl: HTMLElement,
		meta: Pick<SettingsTabMeta, "icon" | "label" | "description">,
		withBackButton = false
	): HTMLElement {
		const headerEl = containerEl.createDiv({ cls: "umos-settings-page-header" });

		if (withBackButton) {
			const backBtn = headerEl.createEl("button", {
				cls: "clickable-icon umos-settings-page-back-button",
				attr: {
					type: "button",
					"aria-label": "Back to settings",
				},
			});
			setIcon(backBtn, "chevron-left");
		}

		const titleWrapperEl = headerEl.createDiv({ cls: "umos-settings-page-title-wrapper" });
		const iconEl = titleWrapperEl.createDiv({ cls: "umos-settings-page-title-icon" });
		setIcon(iconEl, meta.icon);
		titleWrapperEl.createDiv({ cls: "umos-settings-page-title", text: meta.label });

		if (!withBackButton) {
			headerEl.createDiv({ cls: "umos-settings-page-header-desc", text: meta.description });
		}

		return headerEl;
	}

	private renderMainPageLink(
		containerEl: HTMLElement,
		tab: typeof TABS[number],
		pages: Record<TabId, HTMLElement>,
		mainPage: HTMLElement
	): void {
		const setting = new Setting(containerEl)
			.setName(tab.label)
			.setDesc(tab.description)
			.addButton((button) => {
				button.setIcon("chevron-right").onClick(() => {
					this.showView(tab.id, pages, mainPage);
				});
				button.buttonEl.addClass("clickable-icon");
			});

		const iconEl = document.createElement("div");
		iconEl.addClass("umos-settings-page-title-icon");
		setIcon(iconEl, tab.icon);
		setting.nameEl.insertBefore(iconEl, setting.nameEl.firstChild);
		setting.nameEl.addClass("umos-settings-page-title");
		setting.settingEl.addClass("umos-settings-page-title-setting");
		setting.settingEl.addEventListener("click", () => this.showView(tab.id, pages, mainPage));
	}

	private renderPluginInfo(containerEl: HTMLElement): void {
		const manifest = this.plugin.manifest;
		const infoEl = containerEl.createDiv({ cls: "umos-settings-plugin-info" });

		const headerEl = infoEl.createDiv({ cls: "umos-settings-plugin-info-header" });
		const iconEl = headerEl.createDiv({ cls: "umos-settings-plugin-info-icon" });
		setIcon(iconEl, UMOS_ICON_ID);

		const titleEl = headerEl.createDiv({ cls: "umos-settings-plugin-info-title-wrap" });
		titleEl.createDiv({ cls: "umos-settings-plugin-info-title", text: "About plugin" });
		titleEl.createDiv({
			cls: "umos-settings-plugin-info-desc",
			text: manifest.description || "Comprehensive life management system.",
		});

		const gridEl = infoEl.createDiv({ cls: "umos-settings-plugin-info-grid" });
		this.renderPluginInfoItem(gridEl, "Version", manifest.version || "Unknown");
		this.renderPluginInfoItem(gridEl, "Author", manifest.author || "Unknown");
		this.renderPluginInfoItem(gridEl, "Plugin ID", manifest.id || "Unknown");
		this.renderPluginInfoItem(gridEl, "Minimum Obsidian", manifest.minAppVersion || "Unknown");
		this.renderPluginInfoItem(gridEl, "Desktop only", manifest.isDesktopOnly ? "Yes" : "No");
	}

	private renderPluginInfoItem(containerEl: HTMLElement, label: string, value: string): void {
		const itemEl = containerEl.createDiv({ cls: "umos-settings-plugin-info-item" });
		itemEl.createDiv({ cls: "umos-settings-plugin-info-label", text: label });
		itemEl.createDiv({ cls: "umos-settings-plugin-info-value", text: value });
	}

	private showView(
		id: SettingsViewId,
		pages: Record<TabId, HTMLElement>,
		mainPage: HTMLElement
	): void {
		this.activeView = id;
		mainPage.toggleClass("umos-settings-page--hidden", id !== "main");
		mainPage.toggleClass("umos-settings-page--active", id === "main");

		TABS.forEach((tab) => {
			const isActive = tab.id === id;
			pages[tab.id].toggleClass("umos-settings-page--hidden", !isActive);
			pages[tab.id].toggleClass("umos-settings-page--active", isActive);
		});
	}

	private wrapSettingsSections(rootEl: HTMLElement): void {
		rootEl.querySelectorAll<HTMLElement>(".umos-settings-section").forEach((sectionEl) => {
			const headerEl = sectionEl.querySelector<HTMLElement>(":scope > .umos-settings-section-header");
			const contentEls = Array.from(sectionEl.children).filter(
				(child): child is HTMLElement => child instanceof HTMLElement && child !== headerEl
			);

			let currentCard: HTMLElement | null = null;
			for (const childEl of contentEls) {
				if (childEl.hasClass("umos-settings-subheading") || currentCard === null) {
					currentCard = sectionEl.createDiv({ cls: "umos-settings-section-card" });
				}

				currentCard.appendChild(childEl);
			}
		});
	}

	private renderLanguageSetting(containerEl: HTMLElement, ctx: SettingsContext): void {
		const sectionEl = createSection(
			containerEl,
			"umos-settings-interface",
			"Interface"
		);

		new Setting(sectionEl)
			.setName("Language")
			.setDesc("Interface language for umOS widgets, dashboards, modals, and settings.")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("en", "English")
					.addOption("ru", "Russian")
					.setValue(ctx.settings.language ?? "en")
					.onChange(async (value) => {
						ctx.settings.language = value === "ru" ? "ru" : "en";
						setLanguage(ctx.settings.language);
						await ctx.saveSettings();
						ctx.display();
					})
			);
	}
}
