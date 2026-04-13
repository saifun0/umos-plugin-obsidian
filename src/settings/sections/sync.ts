import { Setting } from "obsidian";
import { SettingsContext, createSection } from "../helpers";

export function renderSyncSection(containerEl: HTMLElement, ctx: SettingsContext): void {
	const sectionEl = createSection(
		containerEl,
		"umos-settings-sync",
		"Синхронизация данных",
		"Дублирует данные плагина в файл внутри vault для синхронизации между устройствами (например, через Obsidian Sync).",
	);

	new Setting(sectionEl)
		.setName("Путь к файлу синхронизации")
		.setDesc("Путь относительно корня vault. Например: umOS/sync.json. Оставьте пустым, чтобы отключить.")
		.addText((text) =>
			text
				.setPlaceholder("umOS/sync.json")
				.setValue(ctx.settings.syncDataPath || "")
				.onChange(async (value) => {
					ctx.settings.syncDataPath = value.trim();
					await ctx.saveSettings();
				})
		);
}
