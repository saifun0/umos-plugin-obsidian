import { Setting } from "obsidian";
import { SettingsContext, createSection, createSubheading } from "../helpers";

const ALL_METRICS: { key: string; label: string; icon: string }[] = [
	{ key: "mood", label: "Mood", icon: "😊" },
	{ key: "productivity", label: "Productivity", icon: "⚡" },
	{ key: "sleep", label: "Sleep", icon: "😴" },
	{ key: "prayer_count", label: "Prayers", icon: "🕌" },
];

export function renderStatsSection(containerEl: HTMLElement, ctx: SettingsContext): void {
	const sectionEl = createSection(
		containerEl,
		"umos-settings-stats",
		"Stats",
		"Choose metrics for the Daily Metrics block on Home. Up to 4 can be active at once."
	);

	createSubheading(sectionEl, "Metrics");

	const ensureArray = () => {
		if (!Array.isArray(ctx.settings.homeStatsMetrics)) {
			ctx.settings.homeStatsMetrics = ["mood", "productivity", "sleep", "prayer_count"];
		}
	};

	for (const metric of ALL_METRICS) {
		new Setting(sectionEl)
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
						ctx.settings.homeStatsMetrics = ctx.settings.homeStatsMetrics.filter(
							(key) => key !== metric.key
						);
					}
					await ctx.saveSettings();
				});
			});
	}

	new Setting(sectionEl)
		.setName("Custom Metrics")
		.setDesc("Add custom frontmatter keys separated by commas.")
		.addText((text) => {
			ensureArray();
			const knownKeys = ALL_METRICS.map((metric) => metric.key);
			const customKeys = ctx.settings.homeStatsMetrics.filter((key) => !knownKeys.includes(key));
			text.setValue(customKeys.join(", "));
			text.setPlaceholder("focus, weight...");
			text.onChange(async (value) => {
				ensureArray();
				const custom = value
					.split(",")
					.map((part) => part.trim())
					.filter(Boolean);
				const builtin = ctx.settings.homeStatsMetrics.filter((key) => knownKeys.includes(key));
				ctx.settings.homeStatsMetrics = [...builtin, ...custom];
				await ctx.saveSettings();
			});
		});
}
