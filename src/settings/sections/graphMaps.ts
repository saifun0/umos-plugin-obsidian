import { Notice, Setting } from "obsidian";
import { createSection, createSubheading, SettingsContext } from "../helpers";
import { GraphMapService } from "../../graph/GraphMapService";
import { t } from "../../i18n";

export function renderGraphMapsSection(containerEl: HTMLElement, ctx: SettingsContext): void {
	const sectionEl = createSection(
		containerEl,
		"umos-settings-graph-maps",
		"Graph Maps",
		"Auto-generated map notes for Obsidian Graph View with minimal metadata."
	);

	new Setting(sectionEl)
		.setName("Auto-update generated indexes")
		.setDesc("Rebuild Graph Index, area maps, and Image Index after vault changes.")
		.addToggle((toggle) =>
			toggle
				.setValue(ctx.settings.graphMapsAutoUpdate)
				.onChange(async (value) => {
					ctx.settings.graphMapsAutoUpdate = value;
					await ctx.saveSettings();
					ctx.display();
				})
		);

	new Setting(sectionEl)
		.setName("Update delay")
		.setDesc("Seconds to wait after a vault change before rebuilding maps.")
		.addSlider((slider) =>
			slider
				.setLimits(1, 60, 1)
				.setValue(ctx.settings.graphMapsDebounceSeconds || 5)
				.setDynamicTooltip()
				.onChange(async (value) => {
					ctx.settings.graphMapsDebounceSeconds = value;
					await ctx.saveSettings();
				})
		);

	new Setting(sectionEl)
		.setName("Graph Index folder")
		.setDesc("Where Graph Index.md is stored.")
		.addText((text) =>
			text
				.setPlaceholder("05 Dashboards")
				.setValue(ctx.settings.graphMapsRootPath || "05 Dashboards")
				.onChange(async (value) => {
					ctx.settings.graphMapsRootPath = value.trim() || "05 Dashboards";
					await ctx.saveSettings();
				})
		);

	new Setting(sectionEl)
		.setName("Maps folder")
		.setDesc("Where area map notes are stored.")
		.addText((text) =>
			text
				.setPlaceholder("05 Dashboards/Maps")
				.setValue(ctx.settings.graphMapsMapsPath || "05 Dashboards/Maps")
				.onChange(async (value) => {
					ctx.settings.graphMapsMapsPath = value.trim() || "05 Dashboards/Maps";
					await ctx.saveSettings();
				})
		);

	new Setting(sectionEl)
		.setName("Auto-update Image Index")
		.setDesc("Keep the generated image index synchronized with vault images while preserving existing captions.")
		.addToggle((toggle) =>
			toggle
				.setValue(ctx.settings.graphMapsIncludeImageIndex !== false)
				.onChange(async (value) => {
					ctx.settings.graphMapsIncludeImageIndex = value;
					await ctx.saveSettings();
					ctx.display();
				})
		);

	new Setting(sectionEl)
		.setName("Image Index path")
		.setDesc("Where the generated Image Index note is stored.")
		.addText((text) =>
			text
				.setPlaceholder("00 Files/Image Index.md")
				.setValue(ctx.settings.graphMapsImageIndexPath || "00 Files/Image Index.md")
				.onChange(async (value) => {
					ctx.settings.graphMapsImageIndexPath = value.trim() || "00 Files/Image Index.md";
					await ctx.saveSettings();
				})
		);

	createSubheading(sectionEl, "Actions");

	new Setting(sectionEl)
		.setName("Rebuild generated indexes")
		.setDesc("Regenerate Graph Index, area maps, and Image Index from the current vault.")
		.addButton((button) =>
			button
				.setButtonText("Rebuild")
				.setCta()
				.onClick(async () => {
					button.setDisabled(true);
					try {
						await ctx.plugin.rebuildGraphMaps(true);
					} finally {
						button.setDisabled(false);
					}
				})
		);

	new Setting(sectionEl)
		.setName("Simplify graph metadata")
		.setDesc("Remove redundant area/status/type/topic tags and default graph frontmatter. Keeps functional fields.")
		.addButton((button) =>
			button
				.setButtonText("Simplify")
				.onClick(async () => {
					const confirmed = window.confirm(t("Simplify graph metadata across notes?"));
					if (!confirmed) return;
					button.setDisabled(true);
					try {
						const result = await new GraphMapService(ctx.app, ctx.plugin).simplifyGraphMetadata(false);
						await ctx.plugin.rebuildGraphMaps(false);
						new Notice(`${t("Frontmatter simplified")}: ${result.changed}/${result.scanned}`);
					} finally {
						button.setDisabled(false);
					}
				})
		);
}
