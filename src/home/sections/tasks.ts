import { setIcon, Menu } from "obsidian";
import { HomeViewContext } from "../types";
import { createElement } from "../../utils/dom";
import { TaskService } from "../../productivity/tasks/TaskService";
import { Task } from "../../productivity/tasks/Task";
import { t } from "../../i18n";

const RU_MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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

// getDailyNotePathForDate is a private helper exported only to suppress an unused warning.
export { getDailyNotePathForDate };

function getTaskKey(task: Pick<Task, "filePath" | "lineNumber">): string {
	return `${task.filePath}:${task.lineNumber}`;
}

function getTodayIso(): string {
	return getDateIsoWithOffset(0);
}

function getTomorrowIso(): string {
	return getDateIsoWithOffset(1);
}

function getDateIsoWithOffset(dayOffset: number): string {
	const now = new Date();
	now.setDate(now.getDate() + dayOffset);
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function isTaskActive(task: Pick<Task, "status">): boolean {
	return task.status !== "done" && task.status !== "cancelled";
}

function isTaskDueToday(task: Pick<Task, "dueDate">): boolean {
	return Boolean(task.dueDate && task.dueDate === getTodayIso());
}

function isTaskDueTomorrow(task: Pick<Task, "dueDate">): boolean {
	return Boolean(task.dueDate && task.dueDate === getTomorrowIso());
}

function hasDoingAncestor(task: Task): boolean {
	let current = task.parent as Task | null;
	while (current) {
		if (isTaskActive(current) && current.status === "doing") {
			return true;
		}
		current = current.parent as Task | null;
	}
	return false;
}

function cleanTaskDescription(description: string): string {
	return description
		.replace(/\uFFFD/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

function pluralize(count: number, one: string, few: string, many: string): string {
	const abs = Math.abs(count) % 100;
	const last = abs % 10;

	if (abs > 10 && abs < 20) return many;
	if (last > 1 && last < 5) return few;
	if (last === 1) return one;
	return many;
}

function formatTaskDate(dateISO: string): string {
	const parts = dateISO.split("-");
	if (parts.length !== 3) return dateISO;

	const year = Number(parts[0]);
	const monthIndex = Number(parts[1]) - 1;
	const day = Number(parts[2]);

	if (
		Number.isNaN(year) ||
		Number.isNaN(monthIndex) ||
		Number.isNaN(day) ||
		monthIndex < 0 ||
		monthIndex > 11
	) {
		return dateISO;
	}

	const currentYear = new Date().getFullYear();
	const yearSuffix = year !== currentYear ? ` '${String(year).slice(-2)}` : "";
	return `${day} ${RU_MONTH_SHORT[monthIndex]}${yearSuffix}`;
}

function getTaskSourceLabel(filePath: string): string {
	const normalized = filePath.replace(/\\/g, "/").replace(/\.md$/i, "");
	const parts = normalized.split("/").filter(Boolean);

	if (parts.length === 0) return "note";
	if (parts.length === 1) return parts[0];

	return `${parts[parts.length - 2]} / ${parts[parts.length - 1]}`;
}

function getTaskMetaLabel(task: Task, isOverdueTask: boolean): { text: string; cls: string } {
	if (isOverdueTask) {
		return { text: "overdue", cls: "is-overdue" };
	}

	if (isTaskDueToday(task)) {
		return { text: "today", cls: "is-today" };
	}

	if (isTaskDueTomorrow(task)) {
		return { text: "tomorrow", cls: "is-tomorrow" };
	}

	if (task.status === "doing") {
		return { text: "in progress", cls: "is-progress" };
	}

	return { text: "to do", cls: "is-queued" };
}

function getHeroSubtitle(todayCount: number, tomorrowCount: number, overdueCount: number, inProgressCount: number): string {
	if (todayCount === 0 && tomorrowCount === 0 && inProgressCount === 0) {
		return "Quiet today - no active tasks";
	}

	if (overdueCount > 0) {
		const fragments: string[] = [
			`${overdueCount} ${pluralize(overdueCount, "overdue task", "overdue tasks", "overdue tasks")}`,
		];
		const dueTodayOnly = todayCount - overdueCount;
		if (dueTodayOnly > 0) fragments.push(`${dueTodayOnly} for today`);
		if (tomorrowCount > 0) fragments.push(`${tomorrowCount} for tomorrow`);
		if (inProgressCount > 0) fragments.push(`${inProgressCount} active`);
		return fragments.join(" · ");
	}

	const fragments: string[] = [];
	if (todayCount > 0) fragments.push(`${todayCount} for today`);
	if (tomorrowCount > 0) fragments.push(`${tomorrowCount} for tomorrow`);
	if (inProgressCount > 0) fragments.push(`${inProgressCount} active`);

	if (fragments.length > 0) {
		return fragments.join(" · ");
	}

	return `${inProgressCount} ${pluralize(inProgressCount, "task already active", "tasks already active", "tasks already active")}`;
}

function getTasksDashboardPath(ctx: HomeViewContext): string {
	const cards = ctx.settings.homeNavCards || [];
	const configured = cards.find((card) => {
		const name = card.name.toLowerCase();
		const path = card.path.toLowerCase();
		return name.includes("task") || path.includes("tasks");
	});

	return configured?.path || "05 Dashboards/Tasks";
}

function openTasksDashboard(ctx: HomeViewContext): void {
	void ctx.app.workspace.openLinkText(getTasksDashboardPath(ctx), "", false);
}

function addTaskOpenBehavior(el: HTMLElement, ctx: HomeViewContext): void {
	const onOpen = () => openTasksDashboard(ctx);

	el.addEventListener("click", onOpen);
	el.addEventListener("keydown", (event) => {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			onOpen();
		}
	});
}

function setTaskStatusIcon(el: HTMLElement, task: Task, isOverdueTask: boolean): void {
	if (isOverdueTask) setIcon(el, "alert-triangle");
	else if (task.status === "doing") setIcon(el, "circle");
	else if (task.status === "done") setIcon(el, "check-circle-2");
	else if (task.status === "cancelled") setIcon(el, "circle-x");
	else setIcon(el, "circle");
}

function renderMetric(
	parent: HTMLElement,
	label: string,
	value: number,
	icon: string,
	tone: string,
): void {
	const metric = createElement("div", { cls: `umos-home-tasks-metric ${tone}`, parent });
	const iconEl = createElement("span", { cls: "umos-home-tasks-metric-icon", parent: metric });
	setIcon(iconEl, icon);

	const content = createElement("div", { cls: "umos-home-tasks-metric-content", parent: metric });
	createElement("span", {
		cls: "umos-home-tasks-metric-value",
		text: String(value),
		parent: content,
	});
	createElement("span", {
		cls: "umos-home-tasks-metric-label",
		text: label,
		parent: content,
	});
}

function renderTaskSubtasks(
	parent: HTMLElement,
	subtasks: Task[],
	overdueKeys: Set<string>,
	ctx: HomeViewContext,
	depth = 1,
): void {
	if (subtasks.length === 0) {
		return;
	}

	const list = createElement("div", {
		cls: "umos-home-task-children",
		attr: { "data-depth": String(depth) },
		parent,
	});

	for (const subtask of subtasks) {
		const isOverdueTask = overdueKeys.has(getTaskKey(subtask));
		let rowCls = "umos-home-task-child";
		if (isOverdueTask) rowCls += " is-overdue";
		if (subtask.status === "doing") rowCls += " is-doing";
		if (subtask.status === "done") rowCls += " is-done";
		if (subtask.status === "cancelled") rowCls += " is-cancelled";

		const item = createElement("div", {
			cls: "umos-home-task-child-wrap",
			attr: { "data-depth": String(depth) },
			parent: list,
		});
		item.style.setProperty("--umos-home-task-child-depth", String(depth));

		const row = createElement("div", {
			cls: rowCls,
			attr: { role: "button", tabindex: "0" },
			parent: item,
		});
		row.style.setProperty("--umos-home-task-child-depth", String(depth));

		const statusEl = createElement("span", {
			cls: `umos-home-task-child-status is-${isOverdueTask ? "overdue" : subtask.status}`,
			parent: row,
		});
		setTaskStatusIcon(statusEl, subtask, isOverdueTask);

		const body = createElement("div", { cls: "umos-home-task-child-body", parent: row });
		createElement("span", {
			cls: "umos-home-task-child-title",
			text: cleanTaskDescription(subtask.description),
			parent: body,
		});

		if (subtask.dueDate) {
			createElement("span", {
				cls: `umos-home-task-child-date${isOverdueTask ? " is-overdue" : ""}`,
				text: formatTaskDate(subtask.dueDate),
				parent: row,
			});
		}

		row.addEventListener("click", (event) => {
			event.stopPropagation();
			openTasksDashboard(ctx);
		});
		row.addEventListener("keydown", (event) => {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				event.stopPropagation();
				openTasksDashboard(ctx);
			}
		});

		if (subtask.subtasks.length > 0) {
			renderTaskSubtasks(item, subtask.subtasks, overdueKeys, ctx, depth + 1);
		}
	}
}

function renderTaskItems(
	parent: HTMLElement,
	tasks: Task[],
	overdueKeys: Set<string>,
	ctx: HomeViewContext,
	taskService: TaskService,
	limit = 5,
): void {
	const list = createElement("div", { cls: "umos-home-task-stream-list", parent });
	const displayTasks = tasks.slice(0, limit);

	for (const task of displayTasks) {
		const isOverdueTask = overdueKeys.has(getTaskKey(task));
		const meta = getTaskMetaLabel(task, isOverdueTask);

		let cardCls = "umos-home-task-card";
		if (isOverdueTask) cardCls += " is-overdue";
		if (task.status === "doing") cardCls += " is-doing";
		if (task.priority !== "none") cardCls += ` has-priority-${task.priority}`;

		const taskEl = createElement("div", {
			cls: cardCls,
			attr: { role: "button", tabindex: "0" },
			parent: list,
		});

		const statusEl = createElement("span", {
			cls: `umos-home-task-card-status is-${isOverdueTask ? "overdue" : task.status}`,
			parent: taskEl,
		});
		setTaskStatusIcon(statusEl, task, isOverdueTask);

		statusEl.addEventListener("click", (e) => {
			e.stopPropagation();
			const menu = new Menu();
			menu.addItem((item) => {
				item.setTitle(t("To Do")).setIcon("circle").onClick(() => {
					void taskService.bulkUpdate([task], { status: "todo" });
				});
			});
			menu.addItem((item) => {
				item.setTitle(t("In Progress")).setIcon("play").onClick(() => {
					void taskService.bulkUpdate([task], { status: "doing" });
				});
			});
			menu.addItem((item) => {
				item.setTitle(t("Done")).setIcon("check-circle-2").onClick(() => {
					void taskService.bulkUpdate([task], { status: "done" });
				});
			});
			menu.addItem((item) => {
				item.setTitle(t("Cancelled")).setIcon("circle-x").onClick(() => {
					void taskService.bulkUpdate([task], { status: "cancelled" });
				});
			});
			menu.showAtMouseEvent(e);
		});

		const body = createElement("div", { cls: "umos-home-task-card-body", parent: taskEl });
		const topRow = createElement("div", { cls: "umos-home-task-card-top", parent: body });
		const titleWrap = createElement("div", { cls: "umos-home-task-card-title-wrap", parent: topRow });

		if (task.priority !== "none") {
			createElement("span", {
				cls: `umos-home-task-priority-dot priority-${task.priority}`,
				parent: titleWrap,
			});
		}

		createElement("span", {
			cls: "umos-home-task-card-title",
			text: cleanTaskDescription(task.description),
			parent: titleWrap,
		});

		if (task.dueDate) {
			createElement("span", {
				cls: `umos-home-task-card-date${isOverdueTask ? " is-overdue" : ""}`,
				text: formatTaskDate(task.dueDate),
				parent: topRow,
			});
		}

		const metaRow = createElement("div", { cls: "umos-home-task-card-meta", parent: body });
		createElement("span", {
			cls: `umos-home-task-card-pill ${meta.cls}`,
			text: meta.text,
			parent: metaRow,
		});
		createElement("span", {
			cls: "umos-home-task-card-source",
			text: getTaskSourceLabel(task.filePath),
			parent: metaRow,
		});

		if (task.status === "doing" && task.subtasks.length > 0) {
			renderTaskSubtasks(body, task.subtasks, overdueKeys, ctx);
		}

		const arrowEl = createElement("span", { cls: "umos-home-task-card-arrow", parent: taskEl });
		setIcon(arrowEl, "arrow-up-right");

		addTaskOpenBehavior(taskEl, ctx);
	}

	if (tasks.length > limit) {
		createElement("div", {
			cls: "umos-home-task-stream-more",
			text: `${tasks.length - limit} more ${pluralize(tasks.length - limit, "task", "tasks", "tasks")}`,
			parent,
		});
	}
}

function sortHomeTasks(tasks: Task[]): Task[] {
	const priorityOrder: Record<Task["priority"], number> = { high: 0, medium: 1, low: 2, none: 3 };

	return [...tasks].sort((a, b) => {
		const dueCompare = (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31");
		if (dueCompare !== 0) return dueCompare;

		const priorityCompare = (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3);
		if (priorityCompare !== 0) return priorityCompare;

		const fileCompare = a.filePath.localeCompare(b.filePath);
		if (fileCompare !== 0) return fileCompare;

		return a.lineNumber - b.lineNumber;
	});
}

function renderTaskStream(
	parent: HTMLElement,
	options: {
		title: string;
		caption: string;
		count: number;
		icon: string;
		tone: "urgent" | "progress";
		tasks: Task[];
		overdueKeys: Set<string>;
		ctx: HomeViewContext;
		taskService: TaskService;
		emptyText?: string;
		limit?: number;
	},
): void {
	const stream = createElement("div", {
		cls: `umos-home-task-stream is-${options.tone}`,
		parent,
	});

	const head = createElement("div", { cls: "umos-home-task-stream-head", parent: stream });
	const titleWrap = createElement("div", { cls: "umos-home-task-stream-title-wrap", parent: head });
	const iconEl = createElement("span", { cls: "umos-home-task-stream-icon", parent: titleWrap });
	setIcon(iconEl, options.icon);

	const copy = createElement("div", { cls: "umos-home-task-stream-copy", parent: titleWrap });
	createElement("div", {
		cls: "umos-home-task-stream-title",
		text: options.title,
		parent: copy,
	});
	createElement("div", {
		cls: "umos-home-task-stream-caption",
		text: options.caption,
		parent: copy,
	});

	createElement("span", {
		cls: "umos-home-task-stream-count",
		text: String(options.count),
		parent: head,
	});

	if (options.tasks.length === 0) {
		const empty = createElement("div", { cls: "umos-home-task-stream-empty", parent: stream });
		const emptyIcon = createElement("span", { cls: "umos-home-task-stream-empty-icon", parent: empty });
		setIcon(emptyIcon, options.tone === "urgent" ? "calendar" : "circle-dot");
		createElement("span", {
			cls: "umos-home-task-stream-empty-text",
			text: options.emptyText ?? "Empty",
			parent: empty,
		});
		return;
	}

	renderTaskItems(stream, options.tasks, options.overdueKeys, options.ctx, options.taskService, options.limit ?? 5);
}

export function renderTasksSection(parent: HTMLElement, ctx: HomeViewContext): void {
	const section = createElement("div", {
		cls: "umos-home-section umos-home-section-anim umos-home-tasks-section",
		parent,
	});
	const taskService = new TaskService(ctx.app);

	taskService.getHomeTasks().then(({ overdue, dueToday, dueTomorrow, inProgress, completedToday }) => {
		const overdueKeys = new Set(overdue.map(getTaskKey));
		const urgentTasks = [...sortHomeTasks(overdue), ...sortHomeTasks(dueToday)];
		const tomorrowTasks = sortHomeTasks(dueTomorrow);
		const sortedInProgress = sortHomeTasks(inProgress);
		const visibleInProgress = sortedInProgress.filter((task) => !hasDoingAncestor(task));
		const completedTasks = sortHomeTasks(completedToday);

		const hero = createElement("div", { cls: "umos-home-tasks-hero", parent: section });
		const heroCopy = createElement("div", { cls: "umos-home-tasks-hero-copy", parent: hero });
		createElement("div", {
			cls: "umos-home-tasks-kicker",
			text: overdue.length > 0 ? t("Needs attention") : t("Daily Focus"),
			parent: heroCopy,
		});
		createElement("div", {
			cls: "umos-home-section-title",
			text: t("Tasks"),
			parent: heroCopy,
		});
		createElement("div", {
			cls: "umos-home-tasks-subtitle",
			text: t(getHeroSubtitle(urgentTasks.length, tomorrowTasks.length, overdue.length, sortedInProgress.length)),
			parent: heroCopy,
		});

		const totalCard = createElement("div", { cls: "umos-home-tasks-total", parent: hero });
		createElement("span", {
			cls: "umos-home-tasks-total-value",
			text: String(urgentTasks.length + tomorrowTasks.length + sortedInProgress.length),
			parent: totalCard,
		});
		createElement("span", {
			cls: "umos-home-tasks-total-label",
			text: t("active"),
			parent: totalCard,
		});

		if (urgentTasks.length > 0) {
			renderTaskStream(section, {
				title: t("Today"),
				caption:
					overdue.length > 0
						? t("Handle urgent items first")
						: t("What needs to be finished today"),
				count: urgentTasks.length,
				icon: overdue.length > 0 ? "flame" : "calendar",
				tone: "urgent",
				tasks: urgentTasks,
				overdueKeys,
				ctx,
				taskService,
				limit: 5,
			});
		}

		if (tomorrowTasks.length > 0) {
			renderTaskStream(section, {
				title: t("Tomorrow"),
				caption: t("What can be prepared next"),
				count: tomorrowTasks.length,
				icon: "calendar-days",
				tone: "progress",
				tasks: tomorrowTasks,
				overdueKeys,
				ctx,
				taskService,
				limit: 5,
			});
		}

		if (visibleInProgress.length > 0) {
			renderTaskStream(section, {
				title: t("In Progress"),
				caption: t("Started work waiting for the next step"),
				count: visibleInProgress.length,
				icon: "play",
				tone: "progress",
				tasks: visibleInProgress,
				overdueKeys,
				ctx,
				taskService,
				limit: 4,
			});
		}

		if (completedTasks.length > 0) {
			renderTaskStream(section, {
				title: t("Completed Today"),
				caption: t("Great job!"),
				count: completedTasks.length,
				icon: "check-circle-2",
				tone: "progress",
				tasks: completedTasks,
				overdueKeys,
				ctx,
				taskService,
				limit: 4,
			});
		}

		if (urgentTasks.length === 0 && tomorrowTasks.length === 0 && visibleInProgress.length === 0 && completedTasks.length === 0) {
			const emptyState = createElement("div", { cls: "umos-home-tasks-empty-state", parent: section });
			const emptyIcon = createElement("div", { cls: "umos-home-tasks-empty-icon", parent: emptyState });
			setIcon(emptyIcon, "party-popper");
			createElement("div", { cls: "umos-home-tasks-empty-title", text: t("All caught up!"), parent: emptyState });
			createElement("div", { cls: "umos-home-tasks-empty-subtitle", text: t("Take a break or plan ahead for tomorrow."), parent: emptyState });
		}
	});
}
