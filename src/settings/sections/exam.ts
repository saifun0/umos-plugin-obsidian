import { Setting } from "obsidian";
import { SettingsContext, createSection, renderEditableList, renderEditActions } from "../helpers";

export function renderExamSection(containerEl: HTMLElement, ctx: SettingsContext): void {
	const sectionEl = createSection(
		containerEl,
		"umos-settings-exams",
		"Экзамены",
		"Управление предстоящими экзаменами."
	);

	const listContainer = sectionEl.createDiv();
	renderExamList(listContainer, ctx);
}

function renderExamList(container: HTMLElement, ctx: SettingsContext): void {
	const exams = ctx.data_store.exams;
	const priorityLabels: Record<string, string> = { high: "🔴 Высокий", medium: "🟠 Средний", low: "🟢 Низкий" };

	renderEditableList(container, exams, {
		getName: (e) => e.name || "Без названия",
		getDesc: (e) => `${e.date} | ${priorityLabels[e.priority] || e.priority} | ${e.topics.length} тем`,
		onEdit: (c, i) => editExam(c, i, ctx),
		onDelete: async (i) => {
			exams.splice(i, 1);
			await ctx.saveSettings();
		},
		onReorder: async (from, to) => {
			const temp = exams[to];
			exams[to] = exams[from];
			exams[from] = temp;
			await ctx.saveSettings();
		},
		onAdd: async () => {
			exams.push({
				id: `exam_${Date.now()}`,
				name: "Новый экзамен",
				date: "",
				priority: "medium",
				topics: [],
			});
			await ctx.saveSettings();
		},
		addLabel: "+ Добавить экзамен",
	});
}

function editExam(container: HTMLElement, index: number, ctx: SettingsContext): void {
	const exam = ctx.data_store.exams[index];
	container.empty();
	container.createEl("h4", { text: exam.name || "Экзамен" });

	new Setting(container).setName("Название").addText((t) => t.setValue(exam.name).onChange((v) => { exam.name = v; }));
	new Setting(container).setName("Дата (YYYY-MM-DD)").addText((t) => t.setValue(exam.date).onChange((v) => { exam.date = v; }));
	new Setting(container).setName("Приоритет").addDropdown((d) =>
		d.addOptions({ high: "Высокий", medium: "Средний", low: "Низкий" })
			.setValue(exam.priority).onChange((v) => { exam.priority = v as "high" | "medium" | "low"; })
	);

	renderEditActions(container,
		() => renderExamList(container, ctx),
		async () => {
			ctx.data_store.exams[index] = exam;
			await ctx.saveSettings();
			renderExamList(container, ctx);
		}
	);
}
