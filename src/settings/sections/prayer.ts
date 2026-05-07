import { Setting } from "obsidian";
import { SettingsContext, createSection, createSubheading } from "../helpers";

export function renderPrayerSection(containerEl: HTMLElement, ctx: SettingsContext): void {
	const sectionEl = createSection(
		containerEl,
		"umos-settings-prayer",
		"Prayer",
		"Calculation method, status bar, and linked note for the prayer dashboard."
	);

	const methodOptions: Record<string, string> = {
		"0": "Shia Ithna-Ashari",
		"1": "Muslim World League",
		"2": "ISNA",
		"3": "Egyptian General Authority",
		"4": "Umm Al-Qura University",
		"5": "University of Islamic Sciences, Karachi",
		"7": "Institute of Geophysics, University of Tehran",
		"8": "Gulf Region",
		"9": "Kuwait",
		"10": "Qatar",
		"11": "Majlis Ugama Islam Singapura",
		"12": "UOIF (France)",
		"13": "Diyanet (Turkey)",
		"14": "Spiritual Administration of Muslims of Russia",
		"15": "Moonsighting Committee Worldwide",
	};

	createSubheading(sectionEl, "Calculation");

	new Setting(sectionEl)
		.setName("Calculation Method")
		.addDropdown((dropdown) =>
			dropdown
				.addOptions(methodOptions)
				.setValue(String(ctx.settings.prayerMethod))
				.onChange(async (value) => {
					ctx.settings.prayerMethod = parseInt(value, 10);
					await ctx.saveSettings();
				})
		);

	createSubheading(sectionEl, "Display");

	new Setting(sectionEl)
		.setName("Status bar")
		.setDesc("Show the next prayer in the status bar.")
		.addToggle((toggle) =>
			toggle.setValue(ctx.settings.prayerShowStatusBar).onChange(async (value) => {
				ctx.settings.prayerShowStatusBar = value;
				await ctx.saveSettings();
			})
		);

	new Setting(sectionEl)
		.setName("Sunrise")
		.setDesc("Show sunrise together with prayer times.")
		.addToggle((toggle) =>
			toggle.setValue(ctx.settings.prayerShowSunrise).onChange(async (value) => {
				ctx.settings.prayerShowSunrise = value;
				await ctx.saveSettings();
			})
		);

	new Setting(sectionEl)
		.setName("Prayer Dashboard")
		.setDesc("Note opened when the status bar is clicked.")
		.addText((text) =>
			text
				.setPlaceholder("05 Dashboards/Prayer")
				.setValue(ctx.settings.prayerDashboardPath)
				.onChange(async (value) => {
					ctx.settings.prayerDashboardPath = value;
					await ctx.saveSettings();
				})
		);
}
