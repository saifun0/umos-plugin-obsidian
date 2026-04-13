import { Setting } from "obsidian";
import { SettingsContext, createSection, createSubheading } from "../helpers";

export function renderPrayerSection(containerEl: HTMLElement, ctx: SettingsContext): void {
	const sectionEl = createSection(
		containerEl,
		"umos-settings-prayer",
		"Намаз",
		"Расчёт времени, статус-бар и отображение."
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

	new Setting(sectionEl)
		.setName("Метод расчёта")
		.addDropdown((dropdown) =>
			dropdown.addOptions(methodOptions).setValue(String(ctx.settings.prayerMethod))
				.onChange(async (value) => { ctx.settings.prayerMethod = parseInt(value, 10); await ctx.saveSettings(); })
		);

	// Display
	createSubheading(sectionEl, "Отображение");

	new Setting(sectionEl)
		.setName("StatusBar")
		.setDesc("Показывать следующий намаз в StatusBar")
		.addToggle((toggle) =>
			toggle.setValue(ctx.settings.prayerShowStatusBar)
				.onChange(async (value) => { ctx.settings.prayerShowStatusBar = value; await ctx.saveSettings(); })
		);

	new Setting(sectionEl)
		.setName("Sunrise")
		.setDesc("Показывать время восхода")
		.addToggle((toggle) =>
			toggle.setValue(ctx.settings.prayerShowSunrise)
				.onChange(async (value) => { ctx.settings.prayerShowSunrise = value; await ctx.saveSettings(); })
		);

	new Setting(sectionEl)
		.setName("Дашборд намаза")
		.setDesc("Путь к заметке (клик по StatusBar)")
		.addText((text) =>
			text.setPlaceholder("05 Dashboards/Prayer").setValue(ctx.settings.prayerDashboardPath)
				.onChange(async (value) => { ctx.settings.prayerDashboardPath = value; await ctx.saveSettings(); })
		);
}
