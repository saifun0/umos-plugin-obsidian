import { Setting } from "obsidian";
import type { DailySections, HabitDefinition } from "../Settings";
import {
	SettingsContext,
	createSection,
	createSubheading,
	renderEditActions,
	renderEditableList,
} from "../helpers";

export function renderDailyNoteSection(containerEl: HTMLElement, ctx: SettingsContext): void {
	const sectionEl = createSection(
		containerEl,
		"umos-settings-daily",
		"Daily Note",
		"Daily note template: where it is stored, how it is named, and which blocks it includes."
	);

	createSubheading(sectionEl, "File");

	new Setting(sectionEl)
		.setName("Folder Path")
		.setDesc("Folder for daily notes")
		.addText((text) =>
			text
				.setPlaceholder("11 Journal/Daily")
				.setValue(ctx.settings.dailyNotesPath)
				.onChange(async (value) => {
					ctx.settings.dailyNotesPath = value || "11 Journal/Daily";
					await ctx.saveSettings();
				})
		);

	new Setting(sectionEl)
		.setName("File Name Format")
		.setDesc("For example: YYYY-MM-DD")
		.addText((text) =>
			text
				.setPlaceholder("YYYY-MM-DD")
				.setValue(ctx.settings.dailyNoteFormat)
				.onChange(async (value) => {
					ctx.settings.dailyNoteFormat = value || "YYYY-MM-DD";
					await ctx.saveSettings();
				})
		);

	new Setting(sectionEl)
		.setName("Create Note Automatically")
		.setDesc("If today's note does not exist, umOS creates it in the background on startup and after the day changes.")
		.addToggle((toggle) =>
			toggle.setValue(ctx.settings.dailyAutoCreate).onChange(async (value) => {
				ctx.settings.dailyAutoCreate = value;
				await ctx.saveSettings();
			})
		);

	createSubheading(sectionEl, "Template Blocks");

	const sectionNames: Record<keyof DailySections, string> = {
		prayers: "Prayers",
		ratings: "Daily Ratings",
		habits: "Habits",
		schedule: "Schedule",
		tasks: "Tasks",
		review: "Review",
		notes: "Notes",
	};

	for (const [key, label] of Object.entries(sectionNames)) {
		const sectionKey = key as keyof DailySections;
		new Setting(sectionEl)
			.setName(label)
			.addToggle((toggle) =>
				toggle.setValue(ctx.settings.dailySections[sectionKey]).onChange(async (value) => {
					ctx.settings.dailySections[sectionKey] = value;
					await ctx.saveSettings();
				})
			);
	}

	createSubheading(sectionEl, "Habits");
	const habitsList = sectionEl.createDiv();
	renderHabitsList(habitsList, ctx);
}

function renderHabitsList(container: HTMLElement, ctx: SettingsContext): void {
	ensureHabits(ctx);

	renderEditableList(container, ctx.settings.habits, {
		getName: (habit) => `${habit.icon} ${habit.name}`,
		getDesc: (habit) => `${habit.id} | ${habit.color}`,
		onEdit: (editContainer, index) => editHabit(editContainer, index, ctx),
		onDelete: async (index) => {
			ctx.settings.habits.splice(index, 1);
			await ctx.saveSettings();
		},
		onReorder: async (from, to) => {
			const moved = ctx.settings.habits[from];
			ctx.settings.habits[from] = ctx.settings.habits[to];
			ctx.settings.habits[to] = moved;
			await ctx.saveSettings();
		},
		onAdd: async () => {
			ctx.settings.habits.push(createHabit());
			await ctx.saveSettings();
		},
		addLabel: "+ Add Habit",
		emptyState: "No habits yet.",
	});
}

function editHabit(container: HTMLElement, index: number, ctx: SettingsContext): void {
	ensureHabits(ctx);
	const habit = { ...ctx.settings.habits[index] };

	container.empty();
	container.createEl("h4", { text: `${habit.icon} ${habit.name}` });

	new Setting(container)
		.setName("ID")
		.setDesc("Frontmatter key, for example exercise or reading.")
		.addText((text) =>
			text.setValue(habit.id).onChange((value) => {
				habit.id = normalizeHabitId(value);
			})
		);

	new Setting(container)
		.setName("Title")
		.addText((text) =>
			text.setValue(habit.name).onChange((value) => {
				habit.name = value.trim() || "New Habit";
			})
		);

	new Setting(container)
		.setName("Icon")
		.addText((text) =>
			text.setValue(habit.icon).onChange((value) => {
				habit.icon = value.trim() || "✅";
			})
		);

	new Setting(container)
		.setName("Color")
		.addText((text) =>
			text.setPlaceholder("#7c3aed").setValue(habit.color).onChange((value) => {
				habit.color = value.trim() || "#7c3aed";
			})
		);

	renderEditActions(
		container,
		() => renderHabitsList(container, ctx),
		async () => {
			ctx.settings.habits[index] = normalizeHabit(habit);
			await ctx.saveSettings();
			renderHabitsList(container, ctx);
		}
	);
}

function ensureHabits(ctx: SettingsContext): void {
	if (!Array.isArray(ctx.settings.habits)) {
		ctx.settings.habits = [];
	}
}

function createHabit(): HabitDefinition {
	const id = `habit_${Date.now()}`;
	return { id, name: "New Habit", icon: "✅", color: "#7c3aed" };
}

function normalizeHabit(habit: HabitDefinition): HabitDefinition {
	return {
		id: normalizeHabitId(habit.id),
		name: habit.name.trim() || "New Habit",
		icon: habit.icon.trim() || "✅",
		color: habit.color.trim() || "#7c3aed",
	};
}

function normalizeHabitId(value: string): string {
	const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
	return normalized || `habit_${Date.now()}`;
}
