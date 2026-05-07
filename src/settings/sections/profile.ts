import { Setting } from "obsidian";
import { GifPickerModal } from "../GifPickerModal";
import { SettingsContext, createSection, createSubheading } from "../helpers";

export function renderProfileSection(containerEl: HTMLElement, ctx: SettingsContext): void {
	const sectionEl = createSection(
		containerEl,
		"umos-settings-profile",
		"Profile and Appearance",
		"Personal details, sidebar GIF panel, and infobox behavior."
	);

	createSubheading(sectionEl, "Profile");

	new Setting(sectionEl)
		.setName("Nickname")
		.setDesc("Shown in the home greeting.")
		.addText((text) =>
			text
				.setPlaceholder("Saifun")
				.setValue(ctx.settings.userNickname ?? "")
				.onChange(async (value) => {
					ctx.settings.userNickname = value;
					await ctx.saveSettings();
				})
		);

	new Setting(sectionEl)
		.setName("Avatar")
		.setDesc("URL or vault file path, for example: 00 Files/avatar.png")
		.addText((text) =>
			text
				.setPlaceholder("https://... or 00 Files/avatar.png")
				.setValue(ctx.settings.userAvatarUrl ?? "")
				.onChange(async (value) => {
					ctx.settings.userAvatarUrl = value;
					await ctx.saveSettings();
				})
		);

	createSubheading(sectionEl, "Note Width");

	new Setting(sectionEl)
		.setName("Soft Wide Note")
		.setDesc("Width for cssclasses: umos-wide-soft. Wider than a standard note, but not full-screen.")
		.addSlider((slider) =>
			slider
				.setLimits(760, 1400, 20)
				.setValue(ctx.settings.softWideLineWidth ?? 980)
				.setDynamicTooltip()
				.onChange(async (value) => {
					ctx.settings.softWideLineWidth = value;
					await ctx.saveSettings();
				})
		);

	createSubheading(sectionEl, "GIF Panel");

	new Setting(sectionEl)
		.setName("Show GIF Panel")
		.setDesc("Embeds a GIF above the file tree in the file explorer.")
		.addToggle((toggle) =>
			toggle.setValue(ctx.settings.gifEnabled ?? false).onChange(async (value) => {
				ctx.settings.gifEnabled = value;
				await ctx.saveSettings();
			})
		);

	new Setting(sectionEl)
		.setName("GIF Path or URL")
		.setDesc(ctx.settings.gifPath ? `Selected: ${ctx.settings.gifPath}` : "Choose a saved image/GIF or quickly add a URL/path.")
		.addButton((button) => button
			.setButtonText(ctx.settings.gifPath ? "Change" : "Choose")
			.setCta()
			.onClick(() => {
				new GifPickerModal(ctx.app, {
					currentPath: ctx.settings.gifPath ?? "",
					library: ctx.settings.gifLibrary ?? [],
					onChoose: async (path, nextLibrary) => {
						ctx.settings.gifPath = path;
						ctx.settings.gifLibrary = nextLibrary;
						await ctx.saveSettings();
						ctx.display();
					},
					onLibraryChange: async (nextLibrary) => {
						ctx.settings.gifLibrary = nextLibrary;
						await ctx.saveSettings();
					},
				}).open();
			}))
		.addButton((button) => button
			.setButtonText("Clear")
			.setDisabled(!ctx.settings.gifPath)
			.onClick(async () => {
				ctx.settings.gifPath = "";
				await ctx.saveSettings();
				ctx.display();
			}));

	new Setting(sectionEl)
		.setName("Maximum Height")
		.setDesc("Limits image height in the sidebar.")
		.addSlider((slider) =>
			slider
				.setLimits(80, 500, 10)
				.setValue(ctx.settings.gifSize ?? 240)
				.setDynamicTooltip()
				.onChange(async (value) => {
					ctx.settings.gifSize = value;
					await ctx.saveSettings();
				})
		);

	new Setting(sectionEl)
		.setName("Animation")
		.setDesc("Subtle panel motion when you want it to feel alive.")
		.addDropdown((dropdown) =>
			dropdown
				.addOption("none", "None")
				.addOption("float", "Float")
				.addOption("swing", "Swing")
				.setValue(ctx.settings.gifAnimation ?? "float")
				.onChange(async (value) => {
					ctx.settings.gifAnimation = value as "none" | "float" | "swing";
					await ctx.saveSettings();
				})
		);

	new Setting(sectionEl)
		.setName("Glass Container")
		.setDesc("Frosted translucent background around the GIF.")
		.addToggle((toggle) =>
			toggle.setValue(ctx.settings.gifGlass ?? false).onChange(async (value) => {
				ctx.settings.gifGlass = value;
				await ctx.saveSettings();
			})
		);

	new Setting(sectionEl)
		.setName("Glow")
		.setDesc("Adds a soft accent-colored glow.")
		.addToggle((toggle) =>
			toggle.setValue(ctx.settings.gifGlow ?? false).onChange(async (value) => {
				ctx.settings.gifGlow = value;
				await ctx.saveSettings();
			})
		);

	new Setting(sectionEl)
		.setName("SVG Divider")
		.setDesc("Vault path to .svg or inline SVG code. When empty, the default line is used.")
		.addText((text) =>
			text
				.setPlaceholder("<svg...> or 00 Files/divider.svg")
				.setValue(ctx.settings.gifDividerSvg ?? "")
				.onChange(async (value) => {
					ctx.settings.gifDividerSvg = value;
					await ctx.saveSettings();
				})
		);

	createSubheading(sectionEl, "Infobox");

	new Setting(sectionEl)
		.setName("Stick on Scroll")
		.setDesc("Infobox stays on screen as a sticky block.")
		.addToggle((toggle) =>
			toggle.setValue(ctx.settings.infoboxSticky ?? false).onChange(async (value) => {
				ctx.settings.infoboxSticky = value;
				await ctx.saveSettings();
			})
		);
}
