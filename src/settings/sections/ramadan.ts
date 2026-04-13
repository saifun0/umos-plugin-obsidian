import { Notice, Setting } from "obsidian";
import { SettingsContext, createSection } from "../helpers";

export function renderRamadanSection(containerEl: HTMLElement, ctx: SettingsContext): void {
	const sectionEl = createSection(
		containerEl,
		"umos-settings-ramadan",
		"Рамадан",
		"Трекер поста и таравих-намаза."
	);

	new Setting(sectionEl)
		.setName("Включить модуль Рамадан")
		.setDesc("Показывать виджет и секцию на Home")
		.addToggle((toggle) =>
			toggle
				.setValue(ctx.settings.ramadanEnabled)
				.onChange(async (value) => {
					ctx.settings.ramadanEnabled = value;
					await ctx.saveSettings();
				})
		);

	new Setting(sectionEl)
		.setName("Сбросить данные Рамадана")
		.setDesc("Очистить все отметки постов и таравих")
		.addButton((btn) =>
			btn
				.setButtonText("Сбросить")
				.setWarning()
				.onClick(async () => {
					ctx.data_store.ramadan.fastTracker = {};
					ctx.data_store.ramadan.tarawihTracker = {};
					await ctx.saveSettings();
					new Notice("✅ Данные Рамадана сброшены");
				})
		);
}
