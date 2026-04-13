import { Setting } from "obsidian";
import { SettingsContext, createSection } from "../helpers";

const ALL_METRICS: { key: string; label: string; icon: string }[] = [
	{ key: "mood",         label: "Настроение",    icon: "😊" },
	{ key: "productivity", label: "Продуктивность", icon: "⚡" },
	{ key: "sleep",        label: "Сон",            icon: "😴" },
	{ key: "prayer_count", label: "Намазы",         icon: "🕌" },
	{ key: "exercise",     label: "Упражнения",     icon: "🏋️" },
	{ key: "reading",      label: "Чтение",         icon: "📚" },
	{ key: "water",        label: "Вода",           icon: "💧" },
	{ key: "quran",        label: "Коран",          icon: "📖" },
	{ key: "study",        label: "Учёба",          icon: "🎓" },
];

export function renderStatsSection(containerEl: HTMLElement, ctx: SettingsContext): void {
	const section = createSection(
		containerEl,
		"umos-settings-stats",
		"Статистика",
		"Выберите метрики, которые отображаются в блоке «Показатели дня» на главной панели (HomeView). До 4 метрик."
	);

	const wrap = section.createDiv({ cls: "umos-settings-stats-metrics" });

	const ensureArray = () => {
		if (!Array.isArray(ctx.settings.homeStatsMetrics)) {
			ctx.settings.homeStatsMetrics = ["mood", "productivity", "sleep", "prayer_count"];
		}
	};

	for (const metric of ALL_METRICS) {
		new Setting(wrap)
			.setName(`${metric.icon} ${metric.label}`)
			.addToggle((toggle) => {
				ensureArray();
				toggle.setValue(ctx.settings.homeStatsMetrics.includes(metric.key));
				toggle.onChange(async (value) => {
					ensureArray();
					if (value) {
						if (ctx.settings.homeStatsMetrics.length < 4) {
							ctx.settings.homeStatsMetrics.push(metric.key);
						} else {
							toggle.setValue(false);
							return;
						}
					} else {
						ctx.settings.homeStatsMetrics = ctx.settings.homeStatsMetrics.filter(k => k !== metric.key);
					}
					await ctx.saveSettings();
				});
			});
	}

	new Setting(wrap)
		.setName("Своя метрика")
		.setDesc("Добавить произвольный ключ frontmatter (через запятую)")
		.addText((text) => {
			ensureArray();
			const knownKeys = ALL_METRICS.map(m => m.key);
			const customKeys = ctx.settings.homeStatsMetrics.filter(k => !knownKeys.includes(k));
			text.setValue(customKeys.join(", "));
			text.setPlaceholder("focus, weight...");
			text.onChange(async (value) => {
				ensureArray();
				const custom = value.split(",").map(s => s.trim()).filter(Boolean);
				const builtin = ctx.settings.homeStatsMetrics.filter(k => knownKeys.includes(k));
				ctx.settings.homeStatsMetrics = [...builtin, ...custom];
				await ctx.saveSettings();
			});
		});
}
