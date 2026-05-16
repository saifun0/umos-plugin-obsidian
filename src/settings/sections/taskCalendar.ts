import { Setting } from "obsidian";
import { SettingsContext, createSection, createSubheading } from "../helpers";

const WEEKDAY_OPTIONS: { value: string; label: string }[] = [
	{ value: "0", label: "Sunday" },
	{ value: "1", label: "Monday" },
	{ value: "2", label: "Tuesday" },
	{ value: "3", label: "Wednesday" },
	{ value: "4", label: "Thursday" },
	{ value: "5", label: "Friday" },
	{ value: "6", label: "Saturday" },
];

export function renderTaskCalendarSection(containerEl: HTMLElement, ctx: SettingsContext): void {
	const sectionEl = createSection(
		containerEl,
		"umos-settings-task-calendar",
		"Task Calendar",
		"Task calendar tab setup: source folders, default view, week layout, and visible task states."
	);

	new Setting(sectionEl)
		.setName("Open Task Calendar")
		.setDesc("Open the calendar as an umOS view tab.")
		.addButton((button) =>
			button
				.setButtonText("Open")
				.setCta()
				.onClick(() => void ctx.plugin.activateTaskCalendarView())
		);

	createSubheading(sectionEl, "View");

	new Setting(sectionEl)
		.setName("Default View")
		.setDesc("The view opened from the command, ribbon icon, and settings button.")
		.addDropdown((dropdown) =>
			dropdown
				.addOption("month", "Month")
				.addOption("list", "List")
				.setValue(ctx.settings.taskCalendarDefaultView)
				.onChange(async (value) => {
					ctx.settings.taskCalendarDefaultView = value === "list" ? "list" : "month";
					await ctx.saveSettings();
				})
		);

	new Setting(sectionEl)
		.setName("First Day of Week")
		.addDropdown((dropdown) => {
			for (const option of WEEKDAY_OPTIONS) {
				dropdown.addOption(option.value, option.label);
			}
			return dropdown
				.setValue(String(ctx.settings.taskCalendarFirstDayOfWeek))
				.onChange(async (value) => {
					const next = Number(value);
					ctx.settings.taskCalendarFirstDayOfWeek = Number.isFinite(next) ? Math.max(0, Math.min(6, next)) : 1;
					await ctx.saveSettings();
				});
		});

	new Setting(sectionEl)
		.setName("Maximum Tasks in Day Cell")
		.setDesc("Extra tasks remain available in the selected-day panel.")
		.addSlider((slider) =>
			slider
				.setLimits(1, 8, 1)
				.setValue(ctx.settings.taskCalendarMaxItemsPerDay)
				.setDynamicTooltip()
				.onChange(async (value) => {
					ctx.settings.taskCalendarMaxItemsPerDay = value;
					await ctx.saveSettings();
				})
		);

	new Setting(sectionEl)
		.setName("Show Task Paths")
		.setDesc("Shows the source note path under each task in the calendar panels.")
		.addToggle((toggle) =>
			toggle
				.setValue(ctx.settings.taskCalendarShowTaskPaths)
				.onChange(async (value) => {
					ctx.settings.taskCalendarShowTaskPaths = value;
					await ctx.saveSettings();
				})
		);

	createSubheading(sectionEl, "Sources");

	new Setting(sectionEl)
		.setName("Task Source Paths")
		.setDesc("Empty scans the whole vault. Use a folder or comma-separated folders to limit the calendar.")
		.addText((text) =>
			text
				.setPlaceholder("11 Journal/Daily, 20 Projects")
				.setValue(ctx.settings.taskCalendarTaskPaths)
				.onChange(async (value) => {
					ctx.settings.taskCalendarTaskPaths = value.trim();
					await ctx.saveSettings();
				})
		);

	createSubheading(sectionEl, "Visible Task States");

	new Setting(sectionEl)
		.setName("Show Completed Tasks")
		.setDesc("Uses done dates when available, then due dates as fallback.")
		.addToggle((toggle) =>
			toggle
				.setValue(ctx.settings.taskCalendarShowCompleted)
				.onChange(async (value) => {
					ctx.settings.taskCalendarShowCompleted = value;
					await ctx.saveSettings();
				})
		);

	new Setting(sectionEl)
		.setName("Show Cancelled Tasks")
		.setDesc("Cancelled tasks are shown on their due, scheduled, or start date.")
		.addToggle((toggle) =>
			toggle
				.setValue(ctx.settings.taskCalendarShowCancelled)
				.onChange(async (value) => {
					ctx.settings.taskCalendarShowCancelled = value;
					await ctx.saveSettings();
				})
		);

	new Setting(sectionEl)
		.setName("Show Active Today")
		.setDesc("Tasks with start and due dates appear on today only when today is between those dates.")
		.addToggle((toggle) =>
			toggle
				.setValue(ctx.settings.taskCalendarShowProgress)
				.onChange(async (value) => {
					ctx.settings.taskCalendarShowProgress = value;
					await ctx.saveSettings();
				})
		);

	new Setting(sectionEl)
		.setName("Show Daily Note Tasks")
		.setDesc("Undated tasks inside daily notes appear on the daily note date.")
		.addToggle((toggle) =>
			toggle
				.setValue(ctx.settings.taskCalendarShowDailyNoteTasks)
				.onChange(async (value) => {
					ctx.settings.taskCalendarShowDailyNoteTasks = value;
					await ctx.saveSettings();
				})
		);
}
