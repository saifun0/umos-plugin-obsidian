import { App } from "obsidian";
import { EventBus } from "../../EventBus";
import { Goal, GoalStatus } from "./Goal";

export class GoalsService {
    private app: App;
    private eventBus: EventBus;
    private getData: () => Goal[];
    private saveData: (data: Goal[]) => Promise<void>;

    constructor(
        app: App,
        eventBus: EventBus,
        getData: () => Goal[],
        saveData: (data: Goal[]) => Promise<void>
    ) {
        this.app = app;
        this.eventBus = eventBus;
        this.getData = getData;
        this.saveData = saveData;
    }

    async init() {
        // Nothing to do here for now
    }

    destroy() {
        // Nothing to clean up
    }

    getGoals(status?: GoalStatus | GoalStatus[]): Goal[] {
        const goals = this.getData();
        if (!status) return goals;
        const statuses = Array.isArray(status) ? status : [status];
        return goals.filter(goal => statuses.includes(goal.status));
    }

    getGoal(id: string): Goal | undefined {
        return this.getData().find(goal => goal.id === id);
    }

    async addGoal(goalData: Omit<Goal, "id" | "createdAt" | "updatedAt" | "status"> & Partial<Pick<Goal, "status">>): Promise<Goal> {
        const goals = this.getData();
        const now = new Date().toISOString();
        const newGoal: Goal = {
            ...goalData,
            id: this.generateId(),
            createdAt: now,
            updatedAt: now,
            status: goalData.status ?? "not-started",
        };
        this.normalizeGoal(newGoal);
        goals.push(newGoal);
        await this.saveData(goals);
        this.eventBus.emit('goals:updated');
        return newGoal;
    }

    async updateGoal(id: string, updates: Partial<Omit<Goal, "id" | "createdAt">>): Promise<Goal | undefined> {
        const goals = this.getData();
        const goal = goals.find(g => g.id === id);
        if (goal) {
            Object.assign(goal, updates);
            goal.updatedAt = new Date().toISOString();
            this.normalizeGoal(goal);
            await this.saveData(goals);
            this.eventBus.emit('goals:updated');
            return goal;
        }
    }

    async deleteGoal(id: string): Promise<void> {
        let goals = this.getData();
        const initialLength = goals.length;
        goals = goals.filter(goal => goal.id !== id);
        if (goals.length < initialLength) {
            await this.saveData(goals);
            this.eventBus.emit('goals:updated');
        }
    }

    async setStatus(id: string, status: GoalStatus): Promise<Goal | undefined> {
        return this.updateGoal(id, { status });
    }

    private generateId(): string {
        return Math.random().toString(36).substr(2, 9);
    }

    private normalizeGoal(goal: Goal): void {
        if (goal.progress < 0) goal.progress = 0;
        if (goal.progress > 100) goal.progress = 100;

        if (goal.status === "archived") {
            goal.title = (goal.title || "").trim();
            goal.description = (goal.description || "").trim();
            goal.targetDate = (goal.targetDate || "").trim();
            return;
        }

        if (goal.status === "completed") {
            goal.progress = 100;
        }

        if (goal.status === "not-started" && goal.progress > 0) {
            goal.status = "in-progress";
        }

        if (goal.progress === 0 && goal.status === "in-progress") {
            goal.status = "not-started";
        }

        if (goal.progress === 100 && goal.status !== "completed") {
            goal.status = "completed";
        }

        goal.title = (goal.title || "").trim();
        goal.description = (goal.description || "").trim();
        goal.targetDate = (goal.targetDate || "").trim();
    }
}
