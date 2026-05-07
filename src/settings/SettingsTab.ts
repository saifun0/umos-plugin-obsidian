import { App, PluginSettingTab, Setting } from "obsidian";
import type UmOSPlugin from "../main";
import { setLanguage } from "../i18n";
import type { SettingsContext } from "./helpers";
import { renderScaffoldSection } from "./sections/scaffold";
import { renderDailyNoteSection } from "./sections/dailyNote";
import { renderLocationSection } from "./sections/location";
import { renderPrayerSection } from "./sections/prayer";
import { renderScheduleSection } from "./sections/schedule";
import { renderContentSection } from "./sections/content";
import { renderHomeSection } from "./sections/home";
import { renderStatsSection } from "./sections/stats";
import { renderSyncSection } from "./sections/sync";
import { renderProfileSection } from "./sections/profile";
import { renderDemoNoteSection } from "./sections/demoNote";
import { renderDashboardSection, renderDiagnosticsSection } from "./sections/dashboard";

interface SettingsTabMeta {
	id: string;
	icon: string;
	label: string;
	description: string;
}

const TABS: readonly SettingsTabMeta[] = [
	{
		id: "system",
		icon: "🔧",
		label: "System",
		description: "Profile, Home, daily note, stats, and utility actions.",
	},
	{
		id: "islam",
		icon: "🕌",
		label: "Islam",
		description: "Prayer and geolocation for religious and weather blocks.",
	},
	{
		id: "study",
		icon: "📚",
		label: "Study",
		description: "Schedule and school grid parameters.",
	},
	{
		id: "other",
		icon: "🌍",
		label: "Other",
		description: "Content types and the rest of the gallery structure.",
	},
] as const;

type TabId = typeof TABS[number]["id"];

export class UmOSSettingsTab extends PluginSettingTab {
	plugin: UmOSPlugin;
	private activeTab: TabId = "system";

	constructor(app: App, plugin: UmOSPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		const rootEl = containerEl.createDiv({ cls: "umos-settings-root" });
		rootEl.createEl("h1", {
			text: "umOS — Settings",
			cls: "umos-settings-title",
		});

		const ctx: SettingsContext = {
			app: this.app,
			plugin: this.plugin,
			settings: this.plugin.settings,
			data_store: this.plugin.data_store,
			saveSettings: () => this.plugin.saveSettings(),
			display: () => this.display(),
		};

		const navEl = rootEl.createDiv({ cls: "umos-settings-nav" });
		const groups: Record<TabId, HTMLElement> = {} as Record<TabId, HTMLElement>;
		const navBtns: HTMLButtonElement[] = [];

		for (const tab of TABS) {
			const btn = navEl.createEl("button", {
				cls: "umos-settings-nav-btn",
				attr: { type: "button" },
			});
			btn.createSpan({ cls: "umos-settings-nav-icon", text: tab.icon });
			btn.createSpan({ cls: "umos-settings-nav-label", text: tab.label });
			btn.addEventListener("click", () => this.showTab(tab.id, groups, navBtns));
			navBtns.push(btn);

			const groupEl = rootEl.createDiv({ cls: "umos-settings-group" });
			const introEl = groupEl.createDiv({ cls: "umos-settings-group-header" });
			introEl.createEl("h2", {
				text: `${tab.icon} ${tab.label}`,
				cls: "umos-settings-group-title",
			});
			introEl.createEl("p", {
				text: tab.description,
				cls: "umos-settings-group-desc",
			});

			groups[tab.id] = groupEl;
		}

		this.renderLanguageSetting(groups.system, ctx);
		renderProfileSection(groups.system, ctx);
		renderHomeSection(groups.system, ctx);
		renderDailyNoteSection(groups.system, ctx);
		renderStatsSection(groups.system, ctx);
		renderSyncSection(groups.system, ctx);
		renderDashboardSection(groups.system, ctx);
		renderDiagnosticsSection(groups.system, ctx);
		renderScaffoldSection(groups.system, ctx);
		renderDemoNoteSection(groups.system, ctx);

		renderPrayerSection(groups.islam, ctx);
		renderLocationSection(groups.islam, ctx);

		renderScheduleSection(groups.study, ctx);

		renderContentSection(groups.other, ctx);

		this.showTab(this.activeTab, groups, navBtns);
	}

	private showTab(
		id: TabId,
		groups: Record<TabId, HTMLElement>,
		navBtns: HTMLButtonElement[]
	): void {
		this.activeTab = id;
		TABS.forEach((tab, index) => {
			const isActive = tab.id === id;
			groups[tab.id].style.display = isActive ? "block" : "none";
			navBtns[index].toggleClass("umos-settings-nav-btn--active", isActive);
		});
	}

	private renderLanguageSetting(containerEl: HTMLElement, ctx: SettingsContext): void {
		new Setting(containerEl)
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
