import { Goal, GoalStatus } from "./Goal";
import { diffDays, parseDate, getTodayDateString } from "../../utils/date";

export interface GoalsRenderOptions {
	compact?: boolean;
	showActions?: boolean;
	onEdit?: (goal: Goal) => void;
	onDelete?: (goal: Goal) => void;
	onComplete?: (goal: Goal) => void;
	onStart?: (goal: Goal) => void;
	onArchive?: (goal: Goal) => void;
	onRestore?: (goal: Goal) => void;
}

export function renderGoalsList(
	container: HTMLElement,
	goals: Goal[],
	options: GoalsRenderOptions = {}
): void {
	container.empty();

	if (goals.length === 0) {
		container.createDiv({
			cls: "umos-goals-empty",
			text: "Целей пока нет. Добавьте первую цель.",
		});
		return;
	}

	const list = container.createDiv({ cls: "umos-goals-container" });
	for (const goal of goals) {
		renderGoalCard(list, goal, options);
	}
}

export function renderGoalCard(
	container: HTMLElement,
	goal: Goal,
	options: GoalsRenderOptions = {}
): void {
	const card = container.createDiv({
		cls: "umos-goal",
		attr: { "data-status": goal.status },
	});

	const header = card.createDiv({ cls: "umos-goal-header" });
	const title = header.createEl("h4", { text: goal.title || "Без названия", cls: "umos-goal-title" });
	title.setAttribute("title", goal.title || "Без названия");

	if (options.showActions) {
		const controls = header.createDiv({ cls: "umos-goal-controls" });
		const editButton = controls.createEl("button", { cls: "umos-goal-btn umos-goal-edit-btn umos-focusable" });
		setResponsiveButtonText(editButton, "Редактировать", "Редакт.");
		editButton.addEventListener("click", () => options.onEdit?.(goal));

		const deleteButton = controls.createEl("button", { cls: "umos-goal-btn umos-goal-delete-btn umos-focusable" });
		setResponsiveButtonText(deleteButton, "Удалить", "Удал.");
		deleteButton.addEventListener("click", () => options.onDelete?.(goal));
	}

	const meta = card.createDiv({ cls: "umos-goal-meta" });
	meta.createSpan({
		cls: `umos-goal-status umos-goal-status-${goal.status}`,
		text: getStatusLabel(goal.status),
	});

	if (goal.category) {
		meta.createSpan({ cls: "umos-goal-category", text: `🏷️ ${goal.category}` });
	}

	if (goal.targetDate) {
		const target = goal.targetDate;
		const daysLeft = getDaysLeft(target);
		const dateEl = meta.createSpan({ cls: "umos-goal-date", text: `Срок: ${target}` });
		if (daysLeft !== null) {
			const daysText = daysLeft < 0 ? `Просрочено на ${Math.abs(daysLeft)} дн.` : `Осталось ${daysLeft} дн.`;
			dateEl.setAttribute("title", daysText);
			if (daysLeft < 0 && goal.status !== "completed") {
				dateEl.classList.add("umos-goal-date-overdue");
			}
			meta.createSpan({
				cls: `umos-goal-days ${daysLeft < 0 ? "umos-goal-days-overdue" : ""}`,
				text: daysText,
			});
		}
	}

	if (!options.compact && goal.description) {
		card.createEl("p", { text: goal.description, cls: "umos-goal-description" });
	}

	const progress = card.createDiv({ cls: "umos-goal-progress-wrapper" });
	progress.createEl("span", { cls: "umos-goal-progress-label", text: `Прогресс: ${goal.progress}%` });
	const bar = progress.createEl("progress", {
		cls: "umos-goal-progress",
		attr: { value: goal.progress, max: 100 },
	});
	bar.setAttribute("aria-label", `Прогресс ${goal.progress}%`);

	if (options.showActions) {
		const actions = card.createDiv({ cls: "umos-goal-actions" });
		if (goal.status === "archived") {
			const restore = actions.createEl("button", { cls: "umos-goal-action umos-focusable", text: "Восстановить" });
			restore.addEventListener("click", () => options.onRestore?.(goal));
		} else {
			if (goal.status !== "completed") {
				const start = actions.createEl("button", { cls: "umos-goal-action umos-focusable" });
				setResponsiveButtonText(start, goal.status === "not-started" ? "Начать" : "В работе", "Старт");
				start.addEventListener("click", () => options.onStart?.(goal));
				const complete = actions.createEl("button", { cls: "umos-goal-action umos-goal-action-primary umos-focusable" });
				setResponsiveButtonText(complete, "Завершить", "Готово");
				complete.addEventListener("click", () => options.onComplete?.(goal));
			}
			if (goal.status === "completed") {
				const reopen = actions.createEl("button", { cls: "umos-goal-action umos-focusable" });
				setResponsiveButtonText(reopen, "Вернуть в работу", "Вернуть");
				reopen.addEventListener("click", () => options.onStart?.(goal));
			}
			const archive = actions.createEl("button", { cls: "umos-goal-action umos-goal-action-muted umos-focusable" });
			setResponsiveButtonText(archive, "Архивировать", "В архив");
			archive.addEventListener("click", () => options.onArchive?.(goal));
		}
	}
}

export function getStatusLabel(status: GoalStatus): string {
	switch (status) {
		case "not-started":
			return "Не начато";
		case "in-progress":
			return "В работе";
		case "completed":
			return "Завершено";
		case "archived":
			return "Архив";
		default:
			return status;
	}
}

function setResponsiveButtonText(el: HTMLElement, full: string, short: string): void {
	el.setAttribute("data-label-full", full);
	el.setAttribute("data-label-short", short);
	const fullSpan = el.createSpan({ text: full, cls: "umos-btn-label-full" });
	const shortSpan = el.createSpan({ text: short, cls: "umos-btn-label-short" });
}

function getDaysLeft(targetDate: string): number | null {
	try {
		const today = parseDate(getTodayDateString());
		const target = parseDate(targetDate);
		return diffDays(today, target);
	} catch {
		return null;
	}
}
