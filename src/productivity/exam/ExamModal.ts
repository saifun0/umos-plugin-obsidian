import { App, Modal, Setting } from "obsidian";
import { ExamEntry } from "../../settings/Settings";

export class ExamModal extends Modal {
	private onSubmit: (exam: ExamEntry) => void;
	private exam: ExamEntry;
	private isEdit: boolean;

	constructor(app: App, onSubmit: (exam: ExamEntry) => void, existing?: ExamEntry) {
		super(app);
		this.onSubmit = onSubmit;
		this.isEdit = !!existing;
		this.exam = existing
			? { ...existing }
			: {
					id: `exam_${Date.now()}`,
					name: "",
					date: "",
					priority: "medium",
					topics: [],
			  };
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("umos-exam-modal");

		contentEl.createEl("h2", {
			text: this.isEdit ? "Редактировать экзамен" : "Добавить экзамен",
		});

		new Setting(contentEl)
			.setName("Название")
			.addText((text) =>
				text
					.setPlaceholder("Математический анализ")
					.setValue(this.exam.name)
					.onChange((value) => {
						this.exam.name = value;
					})
			);

		new Setting(contentEl)
			.setName("Дата")
			.setDesc("YYYY-MM-DD")
			.addText((text) =>
				text
					.setPlaceholder("2026-06-15")
					.setValue(this.exam.date)
					.onChange((value) => {
						this.exam.date = value;
					})
			);

		new Setting(contentEl)
			.setName("Приоритет")
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						high: "Высокий",
						medium: "Средний",
						low: "Низкий",
					})
					.setValue(this.exam.priority)
					.onChange((value) => {
						this.exam.priority = value as "high" | "medium" | "low";
					})
			);

		new Setting(contentEl)
			.setName("Заметки")
			.setDesc("Ресурсы, ссылки, комментарии к предмету")
			.addTextArea((ta) =>
				ta
					.setPlaceholder("Конспекты, учебники, ссылки...")
					.setValue(this.exam.notes ?? "")
					.onChange((value) => {
						this.exam.notes = value || undefined;
					})
			);

		new Setting(contentEl)
			.setName("Оценка")
			.setDesc("Результат после экзамена (0–100)")
			.addText((text) =>
				text
					.setPlaceholder("85")
					.setValue(this.exam.score !== undefined ? String(this.exam.score) : "")
					.onChange((value) => {
						const n = parseFloat(value);
						this.exam.score = isNaN(n) ? undefined : Math.max(0, Math.min(100, n));
					})
			);

		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText(this.isEdit ? "Сохранить" : "Добавить")
				.setCta()
				.onClick(() => {
					if (!this.exam.name || !this.exam.date) return;
					this.onSubmit(this.exam);
					this.close();
				})
		);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
