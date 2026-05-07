import { Setting } from "obsidian";
import { SettingsContext, createSection } from "../helpers";

export function renderSyncSection(containerEl: HTMLElement, ctx: SettingsContext): void {
	const sectionEl = createSection(
		containerEl,
		"umos-settings-sync",
		"Data Sync",
		"Duplicates plugin data into a file inside the vault so it is easier to move between devices."
	);

	new Setting(sectionEl)
		.setName("Sync File Path")
		.setDesc("Path relative to the vault root, for example: umOS/sync.json. Empty value disables writing.")
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
