export type GoalStatus = "not-started" | "in-progress" | "completed" | "archived";

export interface Goal {
	id: string;
	title: string;
	description: string;
	targetDate: string;
	progress: number;
	status: GoalStatus;
	category?: string;
	createdAt: string;
	updatedAt?: string;
}
