import { Setting } from "obsidian";
import type { DailySections } from "../Settings";
import { SettingsContext, createSection, createSubheading } from "../helpers";

export function renderDailyNoteSection(containerEl: HTMLElement, ctx: SettingsContext): void {
	const sectionEl = createSection(
		containerEl,
		"umos-settings-daily",
		"Дневная заметка",
		"Шаблон ежедневной заметки и включаемые блоки."
	);

	new Setting(sectionEl)
		.setName("Путь к папке")
		.setDesc("Папка для ежедневных заметок")
		.addText((text) =>
			text
				.setPlaceholder("11 Journal/Daily")
				.setValue(ctx.settings.dailyNotesPath)
				.onChange(async (value) => {
					ctx.settings.dailyNotesPath = value || "11 Journal/Daily";
					await ctx.saveSettings();
				})
		);

	new Setting(sectionEl)
		.setName("Формат имени файла")
		.setDesc("YYYY-MM-DD")
		.addText((text) =>
			text
				.setPlaceholder("YYYY-MM-DD")
				.setValue(ctx.settings.dailyNoteFormat)
				.onChange(async (value) => {
					ctx.settings.dailyNoteFormat = value || "YYYY-MM-DD";
					await ctx.saveSettings();
				})
		);

	createSubheading(sectionEl, "Секции в шаблоне");

	const sectionNames: Record<keyof DailySections, string> = {
		prayers: "Намазы",
		habits: "Привычки",
		ratings: "Оценки дня",
		schedule: "Расписание",
		tasks: "Задачи",
		notes: "Заметки",
	};

	for (const [key, label] of Object.entries(sectionNames)) {
		const sectionKey = key as keyof DailySections;
		new Setting(sectionEl)
			.setName(label)
			.addToggle((toggle) =>
				toggle
					.setValue(ctx.settings.dailySections[sectionKey])
					.onChange(async (value) => {
						ctx.settings.dailySections[sectionKey] = value;
						await ctx.saveSettings();
					})
			);
	}
}
