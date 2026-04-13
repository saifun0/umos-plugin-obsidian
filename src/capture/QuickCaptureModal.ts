import { App, Modal, Notice, TFile, TFolder } from "obsidian";
import { UmOSSettings } from "../settings/Settings";
import { Task, TaskStatus } from "../productivity/tasks/Task";
import { TaskService } from "../productivity/tasks/TaskService";
import { formatTemplate, getTodayDateString } from "../utils/date";
import { moment } from "obsidian";
import type UmOSPlugin from "../main";

type CaptureType = "task" | "note";
type Priority = "high" | "medium" | "low" | "none";

export class QuickCaptureModal extends Modal {
	private settings: UmOSSettings;
	private captureType: CaptureType;
	private plugin: UmOSPlugin | null;

	// task fields
	private description: string = "";
	private status: TaskStatus = "todo";
	private priority: Priority = "none";
	private dueDate: string = "";
	private startDate: string = "";
	private scheduledDate: string = "";
	private tags: string = "";
	private recurrence: string = "";
	private pendingSubtasks: string[] = [];

	// note fields
	private noteText: string = "";

	constructor(app: App, settings: UmOSSettings, type: CaptureType, plugin?: UmOSPlugin | null) {
		super(app);
		this.settings = settings;
		this.captureType = type;
		this.plugin = plugin || null;
	}

	onOpen(): void {
		this.modalEl.classList.add("umos-capture-modal");
		this.render();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();

		// Title
		const title = this.captureType === "task" ? "⚡ Быстрая задача" : "📝 Быстрая заметка";
		contentEl.createEl("h2", { text: title });

		// Type toggle
		const typeRow = contentEl.createDiv({ cls: "umos-capture-type-row" });
		for (const t of [{ key: "task" as CaptureType, label: "✅ Задача" }, { key: "note" as CaptureType, label: "📝 Заметка" }]) {
			const btn = typeRow.createEl("button", {
				text: t.label,
				cls: `umos-capture-type-btn ${this.captureType === t.key ? "umos-capture-type-active" : ""}`,
			});
			btn.addEventListener("click", () => {
				this.captureType = t.key;
				this.render();
			});
		}

		if (this.captureType === "task") {
			this.renderTaskForm(contentEl);
		} else {
			this.renderNoteForm(contentEl);
		}

		// Footer
		const submitRow = contentEl.createDiv({ cls: "umos-capture-submit-row" });
		submitRow.createDiv({ cls: "umos-capture-hint", text: "Ctrl+Enter для отправки" });
		const submitBtn = submitRow.createEl("button", {
			text: this.captureType === "task" ? "✅ Добавить задачу" : "📝 Добавить заметку",
			cls: "mod-cta umos-capture-submit-btn",
		});
		submitBtn.addEventListener("click", () => { void this.submit(); });
	}

	private renderTaskForm(parent: HTMLElement): void {
		// Description
		const descInput = parent.createEl("textarea", {
			cls: "umos-capture-text",
			attr: { placeholder: "Что нужно сделать?", rows: "2" },
		});
		descInput.value = this.description;
		descInput.addEventListener("input", () => { this.description = descInput.value; });
		descInput.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void this.submit(); }
		});
		setTimeout(() => descInput.focus(), 50);

		const opts = parent.createDiv({ cls: "umos-capture-options" });

		// Status
		this.renderRow(opts, "Статус", (container) => {
			const statuses: { key: TaskStatus; label: string }[] = [
				{ key: "todo", label: "К выполнению" },
				{ key: "doing", label: "В процессе" },
				{ key: "done", label: "Выполнено" },
				{ key: "cancelled", label: "Отменено" },
			];
			const select = container.createEl("select", { cls: "umos-capture-select" });
			for (const s of statuses) {
				const opt = select.createEl("option", { text: s.label, value: s.key });
				if (this.status === s.key) opt.selected = true;
			}
			select.addEventListener("change", () => { this.status = select.value as TaskStatus; });
		});

		// Priority
		this.renderRow(opts, "Приоритет", (container) => {
			const priorities: { key: Priority; label: string }[] = [
				{ key: "none", label: "Нет" },
				{ key: "low", label: "🔽 Низкий" },
				{ key: "medium", label: "🔼 Средний" },
				{ key: "high", label: "⏫ Высокий" },
			];
			const select = container.createEl("select", { cls: "umos-capture-select" });
			for (const p of priorities) {
				const opt = select.createEl("option", { text: p.label, value: p.key });
				if (this.priority === p.key) opt.selected = true;
			}
			select.addEventListener("change", () => { this.priority = select.value as Priority; });
		});

		// Dates row
		this.renderRow(opts, "Срок", (container) => {
			const inp = container.createEl("input", { cls: "umos-capture-date-input", attr: { type: "date" } });
			inp.value = this.dueDate;
			inp.addEventListener("change", () => { this.dueDate = inp.value; });
		});

		this.renderRow(opts, "Начало", (container) => {
			const inp = container.createEl("input", { cls: "umos-capture-date-input", attr: { type: "date" } });
			inp.value = this.startDate;
			inp.addEventListener("change", () => { this.startDate = inp.value; });
		});

		this.renderRow(opts, "Запланировано", (container) => {
			const inp = container.createEl("input", { cls: "umos-capture-date-input", attr: { type: "date" } });
			inp.value = this.scheduledDate;
			inp.addEventListener("change", () => { this.scheduledDate = inp.value; });
		});

		// Tags
		this.renderRow(opts, "Теги", (container) => {
			const inp = container.createEl("input", {
				cls: "umos-capture-tags-input",
				attr: { type: "text", placeholder: "work, urgent (tasks/ добавляется авто)" },
			});
			inp.value = this.tags;
			inp.addEventListener("input", () => { this.tags = inp.value; });
		});

		// Recurrence
		this.renderRow(opts, "Повторение", (container) => {
			const inp = container.createEl("input", {
				cls: "umos-capture-tags-input",
				attr: { type: "text", placeholder: "daily, weekly, every 3 days" },
			});
			inp.value = this.recurrence;
			inp.addEventListener("input", () => { this.recurrence = inp.value; });
		});

		// Subtasks
		const subHeader = parent.createDiv({ cls: "umos-modal-subtasks-header" });
		subHeader.createEl("span", { text: "Подзадачи", cls: "umos-modal-subtasks-title" });

		const subList = parent.createDiv({ cls: "umos-modal-subtasks-list" });

		const renderSubs = () => {
			subList.empty();
			this.pendingSubtasks.forEach((desc, i) => {
				const row = subList.createDiv({ cls: "umos-modal-subtask-row" });
				const inp = row.createEl("input", { cls: "umos-modal-subtask-input" }) as HTMLInputElement;
				inp.type = "text";
				inp.value = desc;
				inp.placeholder = "Описание подзадачи...";
				inp.addEventListener("input", () => { this.pendingSubtasks[i] = inp.value; });
				const rm = row.createEl("button", { text: "✕", cls: "umos-modal-subtask-remove" });
				rm.addEventListener("click", () => { this.pendingSubtasks.splice(i, 1); renderSubs(); });
			});
		};
		renderSubs();

		const addSubBtn = parent.createEl("button", { text: "+ Добавить подзадачу", cls: "umos-modal-subtask-add" });
		addSubBtn.addEventListener("click", () => {
			this.pendingSubtasks.push("");
			renderSubs();
			const inputs = subList.querySelectorAll<HTMLInputElement>(".umos-modal-subtask-input");
			inputs[inputs.length - 1]?.focus();
		});
	}

	private renderNoteForm(parent: HTMLElement): void {
		const textArea = parent.createEl("textarea", {
			cls: "umos-capture-text",
			attr: { placeholder: "О чём заметка?", rows: "4" },
		});
		textArea.value = this.noteText;
		textArea.addEventListener("input", () => { this.noteText = textArea.value; });
		textArea.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void this.submit(); }
		});
		setTimeout(() => textArea.focus(), 50);
	}

	private renderRow(parent: HTMLElement, label: string, buildInput: (container: HTMLElement) => void): void {
		const row = parent.createDiv({ cls: "umos-capture-option-row" });
		row.createDiv({ cls: "umos-capture-option-label", text: label });
		const right = row.createDiv({ cls: "umos-capture-option-value" });
		buildInput(right);
	}

	private async submit(): Promise<void> {
		if (this.captureType === "task") {
			const text = this.description.trim();
			if (!text) { new Notice("❌ Введите описание задачи"); return; }
			try {
				await this.saveTask(text);
				new Notice("✅ Задача добавлена");
				this.close();
			} catch (error) {
				console.error("umOS Capture:", error);
				new Notice(`❌ Ошибка: ${error instanceof Error ? error.message : String(error)}`);
			}
		} else {
			const text = this.noteText.trim();
			if (!text) { new Notice("❌ Введите текст заметки"); return; }
			try {
				await this.saveNote(text);
				new Notice("✅ Заметка добавлена");
				this.close();
			} catch (error) {
				console.error("umOS Capture:", error);
				new Notice(`❌ Ошибка: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
	}

	private async saveTask(text: string): Promise<void> {
		const task = new Task("", "", 0);
		task.description = text;
		task.status = this.status;
		task.priority = this.priority;
		task.dueDate = this.dueDate || null;
		task.startDate = this.startDate || null;
		task.scheduledDate = this.scheduledDate || null;
		task.recurrence = this.recurrence.trim() || null;
		task.tags = this.tags
			.split(",")
			.map((t) => t.trim())
			.filter((t) => t.length > 0)
			.map((t) => (t.startsWith("tasks/") ? t : `tasks/${t}`));

		const inboxPath = this.settings.captureInboxPath;
		const filePath = `${inboxPath}/inbox.md`;

		const service = new TaskService(this.app, this.plugin);
		const lineNum = await service.createTask(task, filePath);

		const subtasks = this.pendingSubtasks.filter((s) => s.trim());
		if (subtasks.length > 0 && lineNum >= 0) {
			await service.addSubtasksAfterLine(filePath, lineNum, 0, subtasks);
		}
	}

	private async saveNote(text: string): Promise<void> {
		if (this.settings.captureMode === "file") {
			await this.saveAsFile(text);
		} else {
			await this.appendNoteToInbox(text);
		}
	}

	private getNowDateTimeString(): string {
		const now = new Date();
		const date = getTodayDateString();
		const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
		return `${date} ${time}`;
	}

	private async appendNoteToInbox(content: string): Promise<void> {
		const inboxPath = this.settings.captureInboxPath;
		const filePath = `${inboxPath}/inbox.md`;
		await this.ensureFolder(inboxPath);

		const header = `> *📝 ${this.getNowDateTimeString()}*`;
		const existing = this.app.vault.getAbstractFileByPath(filePath);

		if (existing instanceof TFile) {
			const trimmed = (await this.app.vault.read(existing)).trimEnd();
			const newContent = trimmed ? `${trimmed}\n\n${header}\n${content}` : `${header}\n${content}`;
			await this.app.vault.modify(existing, newContent);
		} else {
			await this.app.vault.create(filePath, `${header}\n${content}`);
		}
	}

	private async saveAsFile(content: string): Promise<void> {
		const inboxPath = this.settings.captureInboxPath;
		const template = this.settings.captureFileTemplate || "YYYY-MM-DD_HHmmss";
		const fileName = formatTemplate(template);
		const filePath = `${inboxPath}/${fileName}.md`;

		await this.ensureFolder(inboxPath);

		const now = new Date();
		const dateStr = getTodayDateString();
		const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
		await this.app.vault.create(filePath, `---\ndate: ${dateStr}\ntime: ${timeStr}\ntype: capture\n---\n\n${content}`);
	}

	private async ensureFolder(path: string): Promise<void> {
		const existing = this.app.vault.getAbstractFileByPath(path);
		if (existing instanceof TFolder) return;
		const parts = path.split("/");
		let current = "";
		for (const part of parts) {
			current = current ? `${current}/${part}` : part;
			if (!this.app.vault.getAbstractFileByPath(current)) {
				await this.app.vault.createFolder(current);
			}
		}
	}
}
