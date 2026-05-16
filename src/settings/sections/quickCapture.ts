import { Setting } from "obsidian";
import { SettingsContext, createSection } from "../helpers";

export function renderQuickCaptureSettingsSection(containerEl: HTMLElement, ctx: SettingsContext): void {
	const sectionEl = createSection(
		containerEl,
		"umos-settings-quick-capture",
		"Quick Capture",
		"Fast capture module for tasks, notes, countdowns, reviews, and command input."
	);

	new Setting(sectionEl)
		.setName("Open Quick Capture")
		.setDesc("Open the standalone Quick Capture module.")
		.addButton((button) =>
			button
				.setButtonText("Open")
				.setCta()
				.onClick(() => {
					ctx.plugin.openQuickCaptureModal();
				})
		);

	new Setting(sectionEl)
		.setName("Default note folder")
		.setDesc("Folder used by the Quick Capture note form.")
		.addText((text) =>
			text
				.setPlaceholder("10 Inbox")
				.setValue(ctx.settings.homeQuickCaptureDefaultNoteFolder)
				.onChange(async (value) => {
					ctx.settings.homeQuickCaptureDefaultNoteFolder = value;
					await ctx.saveSettings();
				})
		);
}
