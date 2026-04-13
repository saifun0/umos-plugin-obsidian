import { App, Notice } from "obsidian";
import { EventBus } from "../../EventBus";
import { BaseWidget, EventSubscription } from "../../core/BaseWidget";
import { GoalsService } from "./GoalsService";
import { Goal } from "./Goal";
import { GoalModal } from "./GoalModal";
import { renderGoalsList } from "./GoalsRenderer";

export class GoalsWidget extends BaseWidget {
    private app: App;
    protected eventBus: EventBus;
    private goalsService: GoalsService;
    private filter: "all" | "active" | "completed" | "archived" = "active";
    private sort: "updated" | "target" | "progress" | "title" = "updated";
    private categoryFilter: string = "";

    constructor(
        containerEl: HTMLElement,
        app: App,
        eventBus: EventBus,
        goalsService: GoalsService
    ) {
        super(containerEl);
        this.app = app;
        this.eventBus = eventBus;
        this.goalsService = goalsService;
    }

    protected subscribeToEvents(): EventSubscription[] {
        return [{ event: "goals:updated", handler: () => this.render() }];
    }

    protected render(): void {
        this.containerEl.empty();
        const wrapper = this.containerEl.createDiv({ cls: "umos-goals-widget" });

        const header = wrapper.createDiv({ cls: "umos-goals-header" });
        header.createEl("h3", { text: "Цели", cls: "umos-goals-title" });
        const addButton = header.createEl("button", { cls: "umos-goals-add-btn umos-focusable", text: "+ Добавить цель" });
        addButton.addEventListener("click", () => this.openGoalModal());

        const goals = this.goalsService.getGoals();
        this.renderSummary(wrapper, goals);
        this.renderControls(wrapper);

        const filtered = this.applyFilter(goals);
        const categoryFiltered = this.applyCategory(filtered);
        const sorted = this.applySort(categoryFiltered);

        this.renderCategoryFilter(wrapper, goals);

        const listContainer = wrapper.createDiv({ cls: "umos-goals-list" });
        renderGoalsList(listContainer, sorted, {
            showActions: true,
            onEdit: (goal) => this.openGoalModal(goal),
            onDelete: (goal) => this.deleteGoal(goal),
            onComplete: (goal) => this.goalsService.updateGoal(goal.id, { status: "completed", progress: 100 }),
            onStart: (goal) => this.startGoal(goal),
            onArchive: (goal) => this.goalsService.updateGoal(goal.id, { status: "archived" }),
            onRestore: (goal) => this.goalsService.updateGoal(goal.id, { status: "not-started" }),
        });
    };

    private openGoalModal(goal?: Goal): void {
        const modal = new GoalModal(this.app, (result) => {
            if (goal) {
                this.goalsService.updateGoal(goal.id, result);
            } else {
                this.goalsService.addGoal(result as Omit<Goal, "id" | "createdAt" | "updatedAt" | "status">);
            }
        }, goal);
        modal.open();
    }

    private renderSummary(wrapper: HTMLElement, goals: Goal[]): void {
        const counts = this.countByStatus(goals);
        const summary = wrapper.createDiv({ cls: "umos-goals-summary" });
        summary.createDiv({ cls: "umos-goals-summary-item", text: `Всего: ${goals.length}` });
        summary.createDiv({ cls: "umos-goals-summary-item", text: `Активные: ${counts.active}` });
        summary.createDiv({ cls: "umos-goals-summary-item", text: `Завершено: ${counts.completed}` });
    }

    private renderControls(wrapper: HTMLElement): void {
        const controls = wrapper.createDiv({ cls: "umos-goals-controls" });
        const filterRow = controls.createDiv({ cls: "umos-goals-filters" });
        this.renderFilterButton(filterRow, "active", "Активные");
        this.renderFilterButton(filterRow, "all", "Все");
        this.renderFilterButton(filterRow, "completed", "Завершённые");
        this.renderFilterButton(filterRow, "archived", "Архив");

        const sortRow = controls.createDiv({ cls: "umos-goals-sort" });
        sortRow.createSpan({ text: "Сортировка:", cls: "umos-goals-sort-label" });
        const select = sortRow.createEl("select", { cls: "umos-goals-sort-select" });
        const options: Array<{ value: "updated" | "target" | "progress" | "title"; label: string }> = [
            { value: "updated", label: "По обновлению" },
            { value: "target", label: "По сроку" },
            { value: "progress", label: "По прогрессу" },
            { value: "title", label: "По названию" },
        ];
        for (const opt of options) {
            const option = select.createEl("option", { text: opt.label });
            option.value = opt.value;
        }
        select.value = this.sort;
        select.addEventListener("change", () => {
            this.sort = select.value as typeof this.sort;
            this.render();
        });
    }

    private renderFilterButton(parent: HTMLElement, value: typeof this.filter, label: string): void {
        const btn = parent.createEl("button", {
            cls: `umos-goals-filter-btn${this.filter === value ? " is-active" : ""}`,
            text: label,
        });
        btn.addEventListener("click", () => {
            this.filter = value;
            this.render();
        });
    }

    private renderCategoryFilter(wrapper: HTMLElement, goals: Goal[]): void {
        const categories = [...new Set(goals.map(g => g.category ?? "").filter(Boolean))].sort();
        if (categories.length === 0) return;

        const row = wrapper.createDiv({ cls: "umos-goals-category-filter" });
        row.createSpan({ text: "Категория:", cls: "umos-goals-sort-label" });

        const allBtn = row.createEl("button", {
            cls: `umos-goals-category-btn${!this.categoryFilter ? " is-active" : ""}`,
            text: "Все",
        });
        allBtn.addEventListener("click", () => { this.categoryFilter = ""; this.render(); });

        for (const cat of categories) {
            const btn = row.createEl("button", {
                cls: `umos-goals-category-btn${this.categoryFilter === cat ? " is-active" : ""}`,
                text: cat,
            });
            btn.addEventListener("click", () => {
                this.categoryFilter = this.categoryFilter === cat ? "" : cat;
                this.render();
            });
        }
    }

    private applyCategory(goals: Goal[]): Goal[] {
        if (!this.categoryFilter) return goals;
        return goals.filter(g => (g.category ?? "") === this.categoryFilter);
    }

    private applyFilter(goals: Goal[]): Goal[] {
        if (this.filter === "all") return goals;
        if (this.filter === "archived") return goals.filter(g => g.status === "archived");
        if (this.filter === "completed") return goals.filter(g => g.status === "completed");
        return goals.filter(g => g.status === "not-started" || g.status === "in-progress");
    }

    private applySort(goals: Goal[]): Goal[] {
        const copy = [...goals];
        switch (this.sort) {
            case "title":
                copy.sort((a, b) => (a.title || "").localeCompare(b.title || "", "ru"));
                break;
            case "progress":
                copy.sort((a, b) => b.progress - a.progress);
                break;
            case "target":
                copy.sort((a, b) => this.safeDate(a.targetDate) - this.safeDate(b.targetDate));
                break;
            case "updated":
            default:
                copy.sort((a, b) => this.safeDate(b.updatedAt || b.createdAt) - this.safeDate(a.updatedAt || a.createdAt));
        }
        return copy;
    }

    private safeDate(dateStr?: string): number {
        if (!dateStr) return Number.POSITIVE_INFINITY;
        const date = new Date(dateStr);
        return Number.isNaN(date.getTime()) ? Number.POSITIVE_INFINITY : date.getTime();
    }

    private countByStatus(goals: Goal[]): { active: number; completed: number; archived: number } {
        let active = 0;
        let completed = 0;
        let archived = 0;
        for (const goal of goals) {
            if (goal.status === "archived") {
                archived++;
            } else if (goal.status === "completed") {
                completed++;
            } else {
                active++;
            }
        }
        return { active, completed, archived };
    }

    private async deleteGoal(goal: Goal): Promise<void> {
        const confirm = window.confirm(`Удалить цель "${goal.title || "Без названия"}"?`);
        if (!confirm) return;
        await this.goalsService.deleteGoal(goal.id);
        new Notice("Цель удалена");
    }

    private async startGoal(goal: Goal): Promise<void> {
        const nextProgress = goal.progress >= 100 ? 50 : Math.max(10, goal.progress);
        await this.goalsService.updateGoal(goal.id, { status: "in-progress", progress: nextProgress });
    }
}
