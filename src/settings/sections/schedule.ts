import { Setting } from "obsidian";
import { SettingsContext, createSection } from "../helpers";

export function renderScheduleSection(containerEl: HTMLElement, ctx: SettingsContext): void {
	const sectionEl = createSection(
		containerEl,
		"umos-settings-schedule",
		"Расписание",
		"Учебная сетка: привязка недель и параметры слотов."
	);

	new Setting(sectionEl)
		.setName("Anchor Date")
		.setDesc("Начало первой недели (YYYY-MM-DD)")
		.addText((text) =>
			text.setPlaceholder("2025-01-13").setValue(ctx.settings.scheduleAnchorDate)
				.onChange(async (value) => {
					ctx.settings.scheduleAnchorDate = value;
					ctx.data_store.schedule.anchorDate = value;
					await ctx.saveSettings();
				})
		);

	new Setting(sectionEl)
		.setName("Пар в день")
		.addSlider((slider) =>
			slider.setLimits(1, 10, 1).setValue(ctx.settings.scheduleSlotsPerDay).setDynamicTooltip()
				.onChange(async (value) => { ctx.settings.scheduleSlotsPerDay = value; await ctx.saveSettings(); })
		);

	new Setting(sectionEl)
		.setName("Длительность пары")
		.setDesc("минуты")
		.addSlider((slider) =>
			slider.setLimits(30, 180, 5).setValue(ctx.settings.scheduleSlotDuration).setDynamicTooltip()
				.onChange(async (value) => { ctx.settings.scheduleSlotDuration = value; await ctx.saveSettings(); })
		);

	new Setting(sectionEl)
		.setName("Перерыв")
		.setDesc("минуты")
		.addSlider((slider) =>
			slider.setLimits(5, 60, 5).setValue(ctx.settings.scheduleBreakDuration).setDynamicTooltip()
				.onChange(async (value) => { ctx.settings.scheduleBreakDuration = value; await ctx.saveSettings(); })
		);

	new Setting(sectionEl)
		.setName("Начало первой пары")
		.addText((text) =>
			text.setPlaceholder("08:00").setValue(ctx.settings.scheduleFirstSlotStart)
				.onChange(async (value) => { ctx.settings.scheduleFirstSlotStart = value; await ctx.saveSettings(); })
		);

	new Setting(sectionEl)
		.setName("Номер первой пары")
		.setDesc("С какого номера начинается нумерация пар (например 2, если расписание стартует со 2-й пары)")
		.addSlider((slider) =>
			slider.setLimits(1, 10, 1)
				.setValue(ctx.settings.scheduleFirstSlotNumber ?? 1)
				.setDynamicTooltip()
				.onChange(async (value) => { ctx.settings.scheduleFirstSlotNumber = value; await ctx.saveSettings(); })
		);
}
