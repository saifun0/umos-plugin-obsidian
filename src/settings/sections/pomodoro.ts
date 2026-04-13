import { Setting } from "obsidian";
import { SettingsContext, createSection } from "../helpers";

export function renderPomodoroSection(containerEl: HTMLElement, ctx: SettingsContext): void {
	const sectionEl = createSection(
		containerEl,
		"umos-settings-pomodoro",
		"Помодоро",
		"Параметры таймера по технике Помодоро."
	);

	new Setting(sectionEl)
		.setName("Рабочая сессия")
		.setDesc("минуты")
		.addSlider((slider) =>
			slider.setLimits(5, 60, 5).setValue(ctx.settings.pomodoroWorkMinutes).setDynamicTooltip()
				.onChange(async (value) => { ctx.settings.pomodoroWorkMinutes = value; await ctx.saveSettings(); })
		);

	new Setting(sectionEl)
		.setName("Короткий перерыв")
		.setDesc("минуты")
		.addSlider((slider) =>
			slider.setLimits(1, 15, 1).setValue(ctx.settings.pomodoroBreakMinutes).setDynamicTooltip()
				.onChange(async (value) => { ctx.settings.pomodoroBreakMinutes = value; await ctx.saveSettings(); })
		);

	new Setting(sectionEl)
		.setName("Длинный перерыв")
		.setDesc("минуты")
		.addSlider((slider) =>
			slider.setLimits(5, 30, 5).setValue(ctx.settings.pomodoroLongBreakMinutes).setDynamicTooltip()
				.onChange(async (value) => { ctx.settings.pomodoroLongBreakMinutes = value; await ctx.saveSettings(); })
		);

	new Setting(sectionEl)
		.setName("Интервал длинного перерыва")
		.setDesc("Каждые N сессий")
		.addSlider((slider) =>
			slider.setLimits(2, 8, 1).setValue(ctx.settings.pomodoroLongBreakInterval).setDynamicTooltip()
				.onChange(async (value) => { ctx.settings.pomodoroLongBreakInterval = value; await ctx.saveSettings(); })
		);
}
