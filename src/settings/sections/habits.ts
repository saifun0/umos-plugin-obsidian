import { Setting } from "obsidian";
import { SettingsContext, createSection, renderEditableList, renderEditActions } from "../helpers";

export function renderHabitsSection(containerEl: HTMLElement, ctx: SettingsContext): void {
	const sectionEl = createSection(
		containerEl,
		"umos-settings-habits",
		"Привычки",
		"Каждая привычка хранится как boolean в frontmatter daily note."
	);

	const listContainer = sectionEl.createDiv();
	renderHabitsList(listContainer, ctx);
}

function renderHabitsList(container: HTMLElement, ctx: SettingsContext): void {
	const habits = ctx.settings.habits;

	renderEditableList(container, habits, {
		getName: (h) => `${h.icon} ${h.name}`,
		getDesc: (h) => `${h.id} | ${h.color}`,
		onEdit: (c, i) => editHabit(c, i, ctx),
		onDelete: async (i) => {
			habits.splice(i, 1);
			await ctx.saveSettings();
		},
		onReorder: async (from, to) => {
			const temp = habits[to];
			habits[to] = habits[from];
			habits[from] = temp;
			await ctx.saveSettings();
		},
		onAdd: async () => {
			habits.push({ id: `habit_${Date.now()}`, name: "Новая привычка", icon: "✅", color: "#7c3aed" });
			await ctx.saveSettings();
		},
		addLabel: "+ Добавить привычку",
	});
}

function editHabit(container: HTMLElement, index: number, ctx: SettingsContext): void {
	const habit = ctx.settings.habits[index];
	container.empty();
	container.createEl("h4", { text: `${habit.icon} ${habit.name}` });

	new Setting(container).setName("ID (frontmatter)").addText((t) => t.setValue(habit.id).onChange((v) => { habit.id = v; }));
	new Setting(container).setName("Название").addText((t) => t.setValue(habit.name).onChange((v) => { habit.name = v; }));
	new Setting(container).setName("Иконка").addText((t) => t.setValue(habit.icon).onChange((v) => { habit.icon = v; }));
	new Setting(container).setName("Цвет").addText((t) => t.setValue(habit.color).onChange((v) => { habit.color = v; }));

	renderEditActions(container,
		() => renderHabitsList(container, ctx),
		async () => {
			ctx.settings.habits[index] = habit;
			await ctx.saveSettings();
			renderHabitsList(container, ctx);
		}
	);
}
