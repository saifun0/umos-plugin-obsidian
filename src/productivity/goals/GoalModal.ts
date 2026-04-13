import { App, Modal, Notice } from "obsidian";
import { Goal, GoalStatus } from "./Goal";

export class GoalModal extends Modal {
    private onSubmit: (result: Partial<Goal>) => void;
    private goal: Partial<Goal>;
    private progressInputEl: HTMLInputElement | null = null;
    private progressRangeEl: HTMLInputElement | null = null;
    private statusSelectEl: HTMLSelectElement | null = null;

    constructor(app: App, onSubmit: (result: Partial<Goal>) => void, goal?: Goal) {
        super(app);
        this.onSubmit = onSubmit;
        this.goal = goal
            ? { ...goal }
            : { title: "", description: "", targetDate: "", progress: 0, status: "not-started", category: "" };
    }

    onOpen() {
        const { contentEl } = this;
        this.modalEl.addClass("umos-goal-modal");
        contentEl.empty();

        const wrapper = contentEl.createDiv({ cls: "umos-goal-modal-content" });
        wrapper.createEl("h2", { text: this.goal.id ? "Редактировать цель" : "Новая цель" });

        const form = wrapper.createDiv({ cls: "umos-goal-form" });

        this.renderTextField(form, "Название", "Например: Сдать диплом", this.goal.title || "", (value) => {
            this.goal.title = value;
        });

        this.renderTextArea(form, "Описание", "Коротко опишите цель", this.goal.description || "", (value) => {
            this.goal.description = value;
        });

        this.renderTextField(form, "Категория", "Здоровье, Учёба, Карьера...", this.goal.category || "", (value) => {
            this.goal.category = value;
        });

        this.renderDateField(form, "Срок", this.goal.targetDate || "", (value) => {
            this.goal.targetDate = value;
        });

        this.renderStatusField(form, "Статус", (this.goal.status || "not-started") as GoalStatus);
        this.renderProgressField(form, "Прогресс", this.goal.progress ?? 0);

        const footer = wrapper.createDiv({ cls: "umos-goal-modal-footer" });
        const cancelBtn = footer.createEl("button", { text: "Отмена", cls: "umos-goal-modal-btn" });
        cancelBtn.addEventListener("click", () => this.close());

        const saveBtn = footer.createEl("button", { text: this.goal.id ? "Сохранить" : "Добавить", cls: "umos-goal-modal-btn umos-goal-modal-btn-primary" });
        saveBtn.addEventListener("click", () => this.submit());

        wrapper.addEventListener("keydown", (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                this.submit();
            }
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }

    private renderTextField(
        parent: HTMLElement,
        label: string,
        placeholder: string,
        value: string,
        onChange: (value: string) => void
    ): void {
        const row = parent.createDiv({ cls: "umos-goal-field" });
        row.createEl("label", { text: label, cls: "umos-goal-field-label" });
        const input = row.createEl("input", {
            cls: "umos-goal-field-input",
            attr: { type: "text", placeholder },
        });
        input.value = value;
        input.addEventListener("input", () => onChange(input.value));
    }

    private renderTextArea(
        parent: HTMLElement,
        label: string,
        placeholder: string,
        value: string,
        onChange: (value: string) => void
    ): void {
        const row = parent.createDiv({ cls: "umos-goal-field" });
        row.createEl("label", { text: label, cls: "umos-goal-field-label" });
        const input = row.createEl("textarea", {
            cls: "umos-goal-field-input umos-goal-field-textarea",
            attr: { placeholder, rows: "3" },
        });
        input.value = value;
        input.addEventListener("input", () => onChange(input.value));
    }

    private renderDateField(
        parent: HTMLElement,
        label: string,
        value: string,
        onChange: (value: string) => void
    ): void {
        const row = parent.createDiv({ cls: "umos-goal-field" });
        row.createEl("label", { text: label, cls: "umos-goal-field-label" });
        const input = row.createEl("input", {
            cls: "umos-goal-field-input",
            attr: { type: "date" },
        });
        input.value = value;
        input.addEventListener("change", () => onChange(input.value));
    }

    private renderStatusField(parent: HTMLElement, label: string, value: GoalStatus): void {
        const row = parent.createDiv({ cls: "umos-goal-field" });
        row.createEl("label", { text: label, cls: "umos-goal-field-label" });
        const select = row.createEl("select", { cls: "umos-goal-field-input" });
        const options: Array<{ value: GoalStatus; label: string }> = [
            { value: "not-started", label: "Не начато" },
            { value: "in-progress", label: "В работе" },
            { value: "completed", label: "Завершено" },
            { value: "archived", label: "Архив" },
        ];
        for (const opt of options) {
            const option = select.createEl("option", { text: opt.label });
            option.value = opt.value;
        }
        select.value = value;
        select.addEventListener("change", () => {
            this.goal.status = select.value as GoalStatus;
            this.syncProgressWithStatus();
        });
        this.statusSelectEl = select;
    }

    private renderProgressField(parent: HTMLElement, label: string, value: number): void {
        const row = parent.createDiv({ cls: "umos-goal-field" });
        const header = row.createDiv({ cls: "umos-goal-field-row" });
        header.createEl("label", { text: label, cls: "umos-goal-field-label" });
        const input = header.createEl("input", {
            cls: "umos-goal-field-input umos-goal-field-number",
            attr: { type: "number", min: "0", max: "100", step: "1" },
        });
        input.value = String(value ?? 0);

        const range = row.createEl("input", {
            cls: "umos-goal-progress-range",
            attr: { type: "range", min: "0", max: "100", step: "1" },
        });
        range.value = String(value ?? 0);

        const sync = (next: number) => {
            const clamped = Math.min(100, Math.max(0, next));
            this.goal.progress = clamped;
            input.value = String(clamped);
            range.value = String(clamped);
            this.syncStatusWithProgress();
        };

        input.addEventListener("input", () => sync(Number(input.value)));
        range.addEventListener("input", () => sync(Number(range.value)));

        this.progressInputEl = input;
        this.progressRangeEl = range;
    }

    private syncProgressWithStatus(): void {
        if (!this.statusSelectEl) return;
        if (this.statusSelectEl.value === "completed") {
            this.setProgressValue(100);
        }
    }

    private syncStatusWithProgress(): void {
        if (!this.statusSelectEl) return;
        const value = Number(this.progressInputEl?.value ?? 0);
        if (value >= 100) {
            this.statusSelectEl.value = "completed";
            this.goal.status = "completed";
        } else if (value > 0 && this.statusSelectEl.value === "not-started") {
            this.statusSelectEl.value = "in-progress";
            this.goal.status = "in-progress";
        } else if (value === 0 && this.statusSelectEl.value === "in-progress") {
            this.statusSelectEl.value = "not-started";
            this.goal.status = "not-started";
        }
    }

    private setProgressValue(value: number): void {
        const clamped = Math.min(100, Math.max(0, value));
        this.goal.progress = clamped;
        if (this.progressInputEl) this.progressInputEl.value = String(clamped);
        if (this.progressRangeEl) this.progressRangeEl.value = String(clamped);
    }

    private submit(): void {
        const title = (this.goal.title || "").trim();
        if (!title) {
            new Notice("Введите название цели");
            return;
        }
        this.goal.title = title;
        this.goal.description = (this.goal.description || "").trim();
        this.goal.targetDate = (this.goal.targetDate || "").trim();
        if (!this.goal.status) this.goal.status = "not-started";
        if (this.goal.progress === undefined || this.goal.progress === null) this.goal.progress = 0;
        this.onSubmit(this.goal);
        this.close();
    }
}
