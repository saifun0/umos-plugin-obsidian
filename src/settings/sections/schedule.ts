import { Setting } from "obsidian";
import { SettingsContext, createSection, createSubheading } from "../helpers";

export function renderScheduleSection(containerEl: HTMLElement, ctx: SettingsContext): void {
	const sectionEl = createSection(
		containerEl,
		"umos-settings-schedule",
		"Schedule",
		"School grid: anchor date, class duration, and slot parameters."
	);

	createSubheading(sectionEl, "Weeks");

	new Setting(sectionEl)
		.setName("Anchor date")
		.setDesc("First week start date in YYYY-MM-DD format")
		.addText((text) =>
			text
				.setPlaceholder("2025-01-13")
				.setValue(ctx.settings.scheduleAnchorDate)
				.onChange(async (value) => {
					ctx.settings.scheduleAnchorDate = value;
					ctx.data_store.schedule.anchorDate = value;
					await ctx.saveSettings();
				})
		);

	createSubheading(sectionEl, "Slots");

	new Setting(sectionEl)
		.setName("Classes per day")
		.addSlider((slider) =>
			slider
				.setLimits(1, 10, 1)
				.setValue(ctx.settings.scheduleSlotsPerDay)
				.setDynamicTooltip()
				.onChange(async (value) => {
					ctx.settings.scheduleSlotsPerDay = value;
					await ctx.saveSettings();
				})
		);

	new Setting(sectionEl)
		.setName("Class Duration")
		.setDesc("Minutes")
		.addSlider((slider) =>
			slider
				.setLimits(30, 180, 5)
				.setValue(ctx.settings.scheduleSlotDuration)
				.setDynamicTooltip()
				.onChange(async (value) => {
					ctx.settings.scheduleSlotDuration = value;
					await ctx.saveSettings();
				})
		);

	new Setting(sectionEl)
		.setName("Break")
		.setDesc("Minutes")
		.addSlider((slider) =>
			slider
				.setLimits(5, 60, 5)
				.setValue(ctx.settings.scheduleBreakDuration)
				.setDynamicTooltip()
				.onChange(async (value) => {
					ctx.settings.scheduleBreakDuration = value;
					await ctx.saveSettings();
				})
		);

	new Setting(sectionEl)
		.setName("First Class Start")
		.addText((text) =>
			text
				.setPlaceholder("08:00")
				.setValue(ctx.settings.scheduleFirstSlotStart)
				.onChange(async (value) => {
					ctx.settings.scheduleFirstSlotStart = value;
					await ctx.saveSettings();
				})
		);

	new Setting(sectionEl)
		.setName("First Class Number")
		.setDesc("If the day starts with class 2, set this to 2.")
		.addSlider((slider) =>
			slider
				.setLimits(1, 10, 1)
				.setValue(ctx.settings.scheduleFirstSlotNumber ?? 1)
				.setDynamicTooltip()
				.onChange(async (value) => {
					ctx.settings.scheduleFirstSlotNumber = value;
					await ctx.saveSettings();
				})
		);
}
