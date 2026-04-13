import { Setting } from "obsidian";
import { SettingsContext, createSection } from "../helpers";

export function renderQuranSection(containerEl: HTMLElement, ctx: SettingsContext): void {
	const sectionEl = createSection(
		containerEl,
		"umos-settings-quran",
		"Коран",
		"Аят дня: перевод, арабский текст и количество."
	);

	new Setting(sectionEl)
		.setName("Перевод")
		.addDropdown((dropdown) =>
			dropdown
				.addOptions({
					"ru.kuliev": "Русский — Кулиев",
					"ru.osmanov": "Русский — Османов",
					"en.sahih": "English — Sahih International",
				})
				.setValue(ctx.settings.quranTranslation)
				.onChange(async (value) => { ctx.settings.quranTranslation = value; await ctx.saveSettings(); })
		);

	new Setting(sectionEl)
		.setName("Арабский текст")
		.addToggle((toggle) =>
			toggle.setValue(ctx.settings.quranShowArabic)
				.onChange(async (value) => { ctx.settings.quranShowArabic = value; await ctx.saveSettings(); })
		);

	new Setting(sectionEl)
		.setName("Аятов в день")
		.setDesc("1-10")
		.addSlider((slider) =>
			slider.setLimits(1, 10, 1).setValue(ctx.settings.quranAyatCount).setDynamicTooltip()
				.onChange(async (value) => { ctx.settings.quranAyatCount = value; await ctx.saveSettings(); })
		);
}
