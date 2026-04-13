import { App, PluginSettingTab } from "obsidian";
import type UmOSPlugin from "../main";
import type { SettingsContext } from "./helpers";
import { renderScaffoldSection } from "./sections/scaffold";
import { renderDailyNoteSection } from "./sections/dailyNote";
import { renderHabitsSection } from "./sections/habits";
import { renderCaptureSection } from "./sections/capture";
import { renderLocationSection } from "./sections/location";
import { renderPrayerSection } from "./sections/prayer";
import { renderQuranSection } from "./sections/quran";
import { renderRamadanSection } from "./sections/ramadan";
import { renderPomodoroSection } from "./sections/pomodoro";
import { renderExamSection } from "./sections/exam";
import { renderScheduleSection } from "./sections/schedule";
import { renderContentSection } from "./sections/content";
import { renderHomeSection } from "./sections/home";
import { renderStatsSection } from "./sections/stats";
import { renderFinanceSection } from "./sections/finance";
import { renderBalanceSection } from "./sections/balance";
import { renderSyncSection } from "./sections/sync";
import { renderProfileSection } from "./sections/profile";
import { renderDemoNoteSection } from "./sections/demoNote";

const TABS = [
	{ id: "system",       icon: "🔧", label: "Система"        },
	{ id: "islam",        icon: "🕌", label: "Ислам"           },
	{ id: "study",        icon: "📚", label: "Учёба"           },
	{ id: "productivity", icon: "⚡", label: "Продуктивность"  },
	{ id: "other",        icon: "🌍", label: "Прочее"          },
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
		containerEl.addClass("umos-settings-root");

		// ── Header ──
		containerEl.createEl("h1", { text: "umOS — Настройки" });
		containerEl.createEl("p", {
			text: "by Saifun",
			cls: "setting-item-description umos-settings-author",
		});

		const ctx: SettingsContext = {
			app: this.app,
			plugin: this.plugin,
			settings: this.plugin.settings,
			data_store: this.plugin.data_store,
			saveSettings: () => this.plugin.saveSettings(),
			display: () => this.display(),
		};

		// ── Tab nav ──
		const nav = containerEl.createDiv({ cls: "umos-settings-nav" });
		const groups = {} as Record<TabId, HTMLElement>;
		TABS.forEach(tab => {
			groups[tab.id] = containerEl.createDiv({ cls: "umos-settings-group" });
		});

		const navBtns: HTMLElement[] = [];
		TABS.forEach(tab => {
			const btn = nav.createEl("button", { cls: "umos-settings-nav-btn" });
			btn.createSpan({ cls: "umos-settings-nav-icon", text: tab.icon });
			btn.createSpan({ cls: "umos-settings-nav-label", text: tab.label });
			btn.addEventListener("click", () => this.showTab(tab.id, groups, navBtns));
			navBtns.push(btn);
		});

		// ── Sections → groups ──
		renderProfileSection(groups.system, ctx);
		renderScaffoldSection(groups.system, ctx);
		renderDemoNoteSection(groups.system, ctx);
		renderDailyNoteSection(groups.system, ctx);
		renderHomeSection(groups.system, ctx);
		renderStatsSection(groups.system, ctx);
		renderSyncSection(groups.system, ctx);

		renderPrayerSection(groups.islam, ctx);
		renderQuranSection(groups.islam, ctx);
		renderRamadanSection(groups.islam, ctx);
		renderLocationSection(groups.islam, ctx);

		renderScheduleSection(groups.study, ctx);
		renderExamSection(groups.study, ctx);

		renderHabitsSection(groups.productivity, ctx);
		renderPomodoroSection(groups.productivity, ctx);
		renderCaptureSection(groups.productivity, ctx);

		renderFinanceSection(groups.other, ctx);
		renderBalanceSection(groups.other, ctx);
		renderContentSection(groups.other, ctx);

		// ── Show active tab ──
		this.showTab(this.activeTab, groups, navBtns);
	}

	private showTab(id: TabId, groups: Record<TabId, HTMLElement>, navBtns: HTMLElement[]): void {
		this.activeTab = id;
		TABS.forEach((tab, i) => {
			const isActive = tab.id === id;
			groups[tab.id].style.display = isActive ? "" : "none";
			navBtns[i].toggleClass("umos-settings-nav-btn--active", isActive);
		});
	}
}
