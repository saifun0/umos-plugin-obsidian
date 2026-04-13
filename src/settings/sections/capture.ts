import { Setting } from "obsidian";
import { SettingsContext, createSection } from "../helpers";

export function renderCaptureSection(containerEl: HTMLElement, ctx: SettingsContext): void {
	const sectionEl = createSection(
		containerEl,
		"umos-settings-capture",
		"Быстрый ввод",
		"Куда и как сохраняются задачи/заметки из модалки и URI-захвата."
	);

	new Setting(sectionEl)
		.setName("Путь к Inbox")
		.addText((text) =>
			text
				.setPlaceholder("10 Inbox")
				.setValue(ctx.settings.captureInboxPath)
				.onChange(async (value) => {
					ctx.settings.captureInboxPath = value;
					await ctx.saveSettings();
				})
		);

	new Setting(sectionEl)
		.setName("Режим записи")
		.addDropdown((dropdown) =>
			dropdown
				.addOptions({ file: "Новый файл", append: "Дописывать в inbox.md" })
				.setValue(ctx.settings.captureMode)
				.onChange(async (value) => {
					ctx.settings.captureMode = value as "file" | "append";
					await ctx.saveSettings();
				})
		);

	new Setting(sectionEl)
		.setName("Шаблон имени файла")
		.setDesc("YYYY, MM, DD, HH, mm, ss")
		.addText((text) =>
			text
				.setPlaceholder("YYYY-MM-DD_HHmmss")
				.setValue(ctx.settings.captureFileTemplate)
				.onChange(async (value) => {
					ctx.settings.captureFileTemplate = value;
					await ctx.saveSettings();
				})
		);
}
