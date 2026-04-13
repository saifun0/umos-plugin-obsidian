import { setIcon } from "obsidian";
import { HomeViewContext } from "../types";
import { createElement } from "../../utils/dom";
import { TaskService } from "../../productivity/tasks/TaskService";

function getDailyNotePathForDate(dateISO: string, ctx: HomeViewContext): string {
	const parts = dateISO.split("-");
	if (parts.length !== 3) {
		return `${ctx.settings.dailyNotesPath}/${dateISO}.md`;
	}
	const [year, month, day] = parts;
	const format = ctx.settings.dailyNoteFormat || "YYYY-MM-DD";
	const fileName = format.replace("YYYY", year).replace("MM", month).replace("DD", day);
	return `${ctx.settings.dailyNotesPath}/${fileName}.md`;
}

// getDailyNotePathForDate is a private helper — exported only to suppress unused warning;
// it is not part of the public API.
export { getDailyNotePathForDate };

export function renderTasksSection(parent: HTMLElement, ctx: HomeViewContext): void {
	const section = createElement("div", {
		cls: "umos-home-section umos-home-section-anim",
		parent,
	});

	// Header row: title on left, counter chip on right (filled after data loads)
	const headerRow = createElement("div", { cls: "umos-home-tasks-header", parent: section });
	createElement("div", {
		cls: "umos-home-section-title",
		text: "Задачи на сегодня",
		parent: headerRow,
	});
	const counterChip = createElement("span", { cls: "umos-home-tasks-counter", parent: headerRow });

	// Progress bar wrapper (filled after data loads)
	const progressWrap = createElement("div", { cls: "umos-home-tasks-progress-wrap", parent: section });

	const taskService = new TaskService(ctx.app);

	taskService.getUrgentTasks().then(({ overdue, dueToday }) => {
		const allTasks = [...overdue, ...dueToday];

		if (allTasks.length === 0) {
			createElement("div", {
				cls: "umos-home-empty",
				text: "Нет срочных задач",
				parent: section,
			});
			return;
		}

		const doneCount = allTasks.filter(t => t.status === "done").length;
		const percent = allTasks.length > 0 ? Math.round((doneCount / allTasks.length) * 100) : 0;

		// Counter chip
		counterChip.setText(`${doneCount} / ${allTasks.length}`);
		if (doneCount === allTasks.length) counterChip.addClass("is-complete");

		// Progress bar
		const progressBar = createElement("div", { cls: "umos-home-tasks-progress-bar", parent: progressWrap });
		const fill = createElement("div", { cls: "umos-home-tasks-progress-fill", parent: progressBar });
		fill.style.width = `${percent}%`;
		const infoRow = createElement("div", { cls: "umos-home-tasks-progress-info", parent: progressWrap });
		if (overdue.length > 0) {
			createElement("span", {
				cls: "umos-home-tasks-progress-overdue",
				text: `просрочено: ${overdue.length}`,
				parent: infoRow,
			});
		} else {
			infoRow.createSpan(); // spacer
		}
		createElement("span", {
			cls: "umos-home-tasks-progress-text",
			text: `${percent}%`,
			parent: infoRow,
		});

		// Overdue alert strip
		if (overdue.length > 0) {
			const alert = createElement("div", { cls: "umos-home-tasks-alert", parent: section });
			const iconEl = alert.createSpan({ cls: "umos-home-tasks-alert-icon" });
			setIcon(iconEl, "alert-triangle");
			createElement("span", {
				cls: "umos-home-tasks-alert-text",
				text: `${overdue.length} ${overdue.length === 1 ? "задача просрочена" : "задач просрочено"}`,
				parent: alert,
			});
		}

		// Task list
		const list = createElement("div", { cls: "umos-home-tasks-list", parent: section });

		const displayTasks = allTasks.slice(0, 7);
		for (const task of displayTasks) {
			const isOverdueTask = overdue.includes(task);

			let taskCls = "umos-home-task";
			if (task.status === "done") taskCls += " umos-home-task-done";
			if (task.status === "doing") taskCls += " umos-home-task-progress";
			if (isOverdueTask) taskCls += " umos-home-task-overdue";

			const taskEl = createElement("div", { cls: taskCls, parent: list });

			// Status icon
			const statusEl = taskEl.createSpan({ cls: `umos-home-task-status is-${task.status}` });
			if (task.status === "done") setIcon(statusEl, "check-circle-2");
			else if (task.status === "doing") setIcon(statusEl, "circle-dot");
			else if (task.status === "cancelled") setIcon(statusEl, "circle-x");
			else setIcon(statusEl, "circle");

			// Priority dot
			if (task.priority !== "none") {
				createElement("span", {
					cls: `umos-task-priority-dot priority-${task.priority}`,
					parent: taskEl,
				});
			}

			// Description
			const cleanDesc = task.description.replace(/[⏫🔼🔽\uFFFD]/g, '').replace(/\(priority:\w+\)/g, '').trim();
			createElement("span", {
				cls: "umos-home-task-text",
				text: cleanDesc,
				parent: taskEl,
			});

			// Due date badge
			if (task.dueDate) {
				createElement("span", {
					cls: `umos-home-task-due${isOverdueTask ? " is-overdue" : ""}`,
					text: task.dueDate,
					parent: taskEl,
				});
			}

			// Click → open source file
			taskEl.addEventListener("click", () => {
				ctx.app.workspace.openLinkText(task.filePath, task.filePath, false);
			});
		}

		if (allTasks.length > 7) {
			createElement("div", {
				cls: "umos-home-more",
				text: `+ ещё ${allTasks.length - 7} задач`,
				parent: section,
			});
		}
	});
}
