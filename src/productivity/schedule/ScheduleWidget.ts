import { App, MarkdownView, moment } from "obsidian";
import { UmOSData } from "../../settings/Settings";
import { EventBus } from "../../EventBus";
import { BaseWidget, EventSubscription } from "../../core/BaseWidget";
import { Task } from "../tasks/Task";
import { TaskService } from "../tasks/TaskService";
import { createElement } from "../../utils/dom";
import {
	getCurrentWeekKey,
	getSlotsForDay,
	getFilledSlots,
	getCurrentSlotInfo,
	countSlots,
	countWeekSlots,
	formatSlotCountdown,
	WEEKDAYS,
	WEEKDAY_SHORT_RU,
	WEEKDAY_LABELS_RU,
	SLOT_TYPE_LABELS,
	SLOT_TYPE_ICONS,
	createEmptySlot,
} from "./ScheduleData";
import { getDayOfWeek } from "../../utils/date";

export interface ScheduleWidgetConfig {
	show: "current" | "week" | "both";
	highlight: boolean;
	countdown: boolean;
	tasks?: boolean;
	taskMode?: "both" | "due" | "scheduled";
	taskPath?: string;
}

export class ScheduleWidget extends BaseWidget {
	private obsidianApp: App;
	protected eventBus: EventBus;
	private config: ScheduleWidgetConfig;
	private getData: () => UmOSData;
	private taskService: TaskService;
	private selectedWeek: "current" | "week1" | "week2" = "current";
	private selectedDay: string | null = null;

	constructor(
		containerEl: HTMLElement,
		config: ScheduleWidgetConfig,
		app: App,
		eventBus: EventBus,
		getData: () => UmOSData
	) {
		super(containerEl);
		this.obsidianApp = app;
		this.eventBus = eventBus;
		this.config = config;
		this.getData = getData;
		this.taskService = new TaskService(app);
	}

	protected subscribeToEvents(): EventSubscription[] {
		return [
			{ event: "schedule:changed", handler: () => this.render() },
			{ event: "tasks:changed", handler: () => this.render() },
		];
	}

	protected onWidgetLoad(): void {
		this.registerInterval(window.setInterval(() => this.render(), 60000));
	}

	protected render(): void {
		void this.renderAsync();
	}

	private async renderAsync(): Promise<void> {
		this.containerEl.empty();

		const data = this.getData();
		const wrapper = createElement("div", {
			cls: "umos-schedule-widget",
			parent: this.containerEl,
		});

		const weekKey = getCurrentWeekKey(data.settings.scheduleAnchorDate);
		const activeWeekKey = this.getActiveWeekKey(weekKey);
		const weekLabel = activeWeekKey === "week1" ? "Week 1" : "Week 2";

		// Title
		const header = createElement("div", {
			cls: "umos-schedule-header",
			parent: wrapper,
		});

		createElement("div", {
			cls: "umos-schedule-title",
			text: "📅 Schedule",
			parent: header,
		});

		const weekLabelEl = createElement("div", {
			cls: "umos-schedule-week-label umos-schedule-week-label-btn",
			text: weekLabel,
			parent: header,
		});
		weekLabelEl.setAttribute("role", "button");
		weekLabelEl.setAttribute("tabindex", "0");
		weekLabelEl.setAttribute("title", "Switch week");
		weekLabelEl.addEventListener("click", () => {
			this.toggleWeek(activeWeekKey, weekKey);
		});
		weekLabelEl.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				this.toggleWeek(activeWeekKey, weekKey);
			}
		});

		const today = getDayOfWeek();
		const activeDay = this.getActiveDay(today);
		const overlayDate = this.getDateForDay(activeWeekKey, weekKey, activeDay);
		const overlayTasks = this.config.tasks ? await this.getTaskOverlaysForDay(overlayDate) : [];

		// Stat cards
		this.renderStatCards(wrapper, data, activeWeekKey, today);

		if (this.config.show === "week" || this.config.show === "both") {
			this.renderWeekOverview(wrapper, data, activeWeekKey, today, activeDay);
		}

		if (this.config.show === "current" || this.config.show === "both") {
			this.renderDaySchedule(wrapper, data, activeWeekKey, activeDay, overlayDate, overlayTasks);
		}
	}

	private renderStatCards(
		parent: HTMLElement,
		data: UmOSData,
		weekKey: "week1" | "week2",
		today: string
	): void {
		const todaySlots = getSlotsForDay(data, weekKey, today);
		const todayCount = countSlots(todaySlots);
		const weekCount = countWeekSlots(data, weekKey);

		const slotInfo = getCurrentSlotInfo(todaySlots);
		let nextLabel = "—";
		if (slotInfo.currentSlot) {
			nextLabel = `Now: ${slotInfo.currentSlot.subject}`;
		} else if (slotInfo.nextSlot) {
			nextLabel = slotInfo.nextSlot.subject;
		}

		const statsRow = createElement("div", {
			cls: "umos-schedule-stats-row",
			parent,
		});

		this.renderStatCard(statsRow, "📚", "Today", `${todayCount} classes`);
		this.renderStatCard(statsRow, "📅", "This week", `${weekCount} classes`);
		this.renderStatCard(statsRow, "➡️", "Next", nextLabel);
	}

	private renderStatCard(parent: HTMLElement, icon: string, label: string, value: string): void {
		const card = createElement("div", {
			cls: "umos-schedule-stat-card",
			parent,
		});

		createElement("div", { cls: "umos-schedule-stat-icon", text: icon, parent: card });
		createElement("div", { cls: "umos-schedule-stat-value", text: value, parent: card });
		createElement("div", { cls: "umos-schedule-stat-label", text: label, parent: card });
	}

	private renderDaySchedule(
		parent: HTMLElement,
		data: UmOSData,
		weekKey: "week1" | "week2",
		day: string,
		dateISO: string,
		taskOverlays: Task[]
	): void {
		const daySlots = getSlotsForDay(data, weekKey, day);
		const totalSlots = Math.max(1, data.settings.scheduleSlotsPerDay || 0);
		const allSlots = Array.from({ length: totalSlots }, (_, idx) => daySlots[idx] ?? createEmptySlot());
		const filledSlots = getFilledSlots(allSlots);
		const todayLabel = WEEKDAY_LABELS_RU[day] || day;

		createElement("div", {
			cls: "umos-schedule-section-title",
			text: `📋 ${todayLabel}`,
			parent,
		});

		if (filledSlots.length === 0) {
			createElement("div", {
				cls: "umos-info-message",
				text: "Today none classes 🎉",
				parent,
			});
			this.renderTaskOverlays(parent, dateISO, taskOverlays);
			return;
		}

		const slotInfo = getCurrentSlotInfo(allSlots);

		const list = createElement("div", {
			cls: "umos-schedule-today-list",
			parent,
		});

		for (let i = 0; i < allSlots.length; i++) {
			const slot = allSlots[i];
			if (!slot.subject || slot.subject.trim() === "") continue;
			const isCurrent = slotInfo.currentSlot === slot;
			const isNext = slotInfo.nextSlot === slot;
			const slotNumber = this.getSlotNumber(
				i,
				slot.startTime,
				data.settings.scheduleFirstSlotStart,
				data.settings.scheduleSlotDuration,
				data.settings.scheduleBreakDuration
			);

			const isExam = slot.type === "exam";
			const card = createElement("div", {
				cls: `umos-schedule-slot-card umos-card ${isCurrent ? "umos-schedule-slot-current" : ""} ${isNext ? "umos-schedule-slot-next" : ""} ${isExam ? "umos-schedule-slot-exam" : ""}`,
				parent: list,
			});

			//
			const timeCol = createElement("div", {
				cls: "umos-schedule-slot-time-col",
				parent: card,
			});

			createElement("div", {
				cls: "umos-schedule-slot-number",
				text: `Class ${slotNumber}`,
				parent: timeCol,
			});

			createElement("div", {
				cls: "umos-schedule-slot-start",
				text: slot.startTime || "—",
				parent: timeCol,
			});

			createElement("div", {
				cls: "umos-schedule-slot-end",
				text: slot.endTime || "—",
				parent: timeCol,
			});

			// Information
			const infoCol = createElement("div", {
				cls: "umos-schedule-slot-info-col",
				parent: card,
			});

			const typeIcon = SLOT_TYPE_ICONS[slot.type] || "📖";
			const typeLabel = SLOT_TYPE_LABELS[slot.type] || slot.type;

			createElement("div", {
				cls: "umos-schedule-slot-subject-name",
				text: `${typeIcon} ${slot.subject}`,
				parent: infoCol,
			});

			const meta = createElement("div", {
				cls: "umos-schedule-slot-meta",
				parent: infoCol,
			});

			if (slot.teacher) {
				createElement("span", { text: `👤 ${slot.teacher}`, parent: meta });
			}
			if (slot.room) {
				createElement("span", { text: `📍 ${slot.room}`, parent: meta });
			}

			createElement("span", {
				cls: "umos-schedule-slot-type-badge",
				text: typeLabel,
				parent: meta,
			});

			// Countdown
			if (this.config.countdown) {
				let countdownText = "";
				if (isCurrent && slot.endTime && day === getDayOfWeek()) {
					const left = formatSlotCountdown(slot.endTime);
					if (left) countdownText = `Ends in: ${left}`;
				} else if (isNext && slot.startTime && day === getDayOfWeek()) {
					const left = formatSlotCountdown(slot.startTime);
					if (left) countdownText = `Starts in: ${left}`;
				}

				if (countdownText) {
					createElement("div", {
						cls: "umos-schedule-slot-countdown",
						text: countdownText,
						parent: card,
					});
				}
			}
		}

		this.renderTaskOverlays(parent, dateISO, taskOverlays);
	}

	private renderTaskOverlays(parent: HTMLElement, dateISO: string, tasks: Task[]): void {
		if (!this.config.tasks) return;
		createElement("div", {
			cls: "umos-schedule-section-title",
			text: `✅ Day Tasks · ${dateISO}`,
			parent,
		});

		if (tasks.length === 0) {
			createElement("div", {
				cls: "umos-info-message",
				text: "No tasks for this day.",
				parent,
			});
			return;
		}

		const list = createElement("div", { cls: "umos-schedule-task-list", parent });
		for (const task of tasks) {
			const item = createElement("button", {
				cls: `umos-schedule-task-item priority-${task.priority}`,
				parent: list,
				attr: { type: "button" },
			});
			item.createSpan({ cls: "umos-schedule-task-title", text: task.description });
			const badges = item.createSpan({ cls: "umos-schedule-task-badges" });
			if (task.dueDate === dateISO) badges.createSpan({ cls: "umos-schedule-task-badge", text: "due" });
			if (task.scheduledDate === dateISO) badges.createSpan({ cls: "umos-schedule-task-badge", text: "scheduled" });
			if (task.priority !== "none") badges.createSpan({ cls: "umos-schedule-task-badge", text: task.priority });
			item.addEventListener("click", () => {
				void this.obsidianApp.workspace.openLinkText(task.filePath, task.filePath, false).then(() => {
					const view = this.obsidianApp.workspace.getActiveViewOfType(MarkdownView);
					if (view) view.editor.setCursor(task.lineNumber, 0);
				});
			});
		}
	}

	private renderWeekOverview(
		parent: HTMLElement,
		data: UmOSData,
		weekKey: "week1" | "week2",
		today: string,
		activeDay: string
	): void {
		createElement("div", {
			cls: "umos-schedule-section-title",
			text: "📆 Week Overview",
			parent,
		});

		const overview = createElement("div", {
			cls: "umos-schedule-week-overview",
			parent,
		});

		for (const day of WEEKDAYS) {
			const slots = getSlotsForDay(data, weekKey, day);
			const filled = getFilledSlots(slots);
			const count = filled.length;
			const isToday = day === today;
			const isSelected = day === activeDay;

			const dayCol = createElement("div", {
				cls: `umos-schedule-week-day ${isToday ? "umos-schedule-week-day-today" : ""} ${isSelected ? "umos-schedule-week-day-selected" : ""}`,
				parent: overview,
			});
			dayCol.setAttribute("role", "button");
			dayCol.setAttribute("tabindex", "0");
			dayCol.setAttribute("title", `Show ${WEEKDAY_LABELS_RU[day] || day}`);
			dayCol.addEventListener("click", () => {
				this.selectedDay = day;
				this.render();
			});
			dayCol.addEventListener("keydown", (e: KeyboardEvent) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					this.selectedDay = day;
					this.render();
				}
			});

			createElement("div", {
				cls: "umos-schedule-week-day-label",
				text: WEEKDAY_SHORT_RU[day],
				parent: dayCol,
			});

			createElement("div", {
				cls: "umos-schedule-week-day-count",
				text: String(count),
				parent: dayCol,
			});

			// - classes
			const blocks = createElement("div", {
				cls: "umos-schedule-week-day-blocks",
				parent: dayCol,
			});

			for (const slot of filled) {
				const isExamBlock = slot.type === "exam";
				const block = createElement("div", {
					cls: `umos-schedule-week-day-block${isExamBlock ? " umos-schedule-week-day-block--exam" : ""}`,
					parent: blocks,
					attr: { title: `${slot.subject} (${slot.startTime || "?"}–${slot.endTime || "?"})` },
				});
			}
		}
	}

	private getActiveWeekKey(currentWeekKey: "week1" | "week2"): "week1" | "week2" {
		if (this.selectedWeek === "current") return currentWeekKey;
		return this.selectedWeek;
	}

	private toggleWeek(activeWeekKey: "week1" | "week2", currentWeekKey: "week1" | "week2"): void {
		if (this.selectedWeek === "current") {
			this.selectedWeek = currentWeekKey === "week1" ? "week2" : "week1";
		} else {
			this.selectedWeek = activeWeekKey === "week1" ? "week2" : "week1";
		}
		this.render();
	}

	private getActiveDay(today: string): string {
		if (this.selectedDay && WEEKDAYS.includes(this.selectedDay)) {
			return this.selectedDay;
		}
		if (today === "sunday") return WEEKDAYS[0];
		return today;
	}

	private getDateForDay(
		activeWeekKey: "week1" | "week2",
		currentWeekKey: "week1" | "week2",
		day: string
	): string {
		const dayIndex = Math.max(0, WEEKDAYS.indexOf(day));
		const base = moment().startOf("isoWeek").add(dayIndex, "days");
		if (activeWeekKey !== currentWeekKey) base.add(7, "days");
		return base.format("YYYY-MM-DD");
	}

	private async getTaskOverlaysForDay(dateISO: string): Promise<Task[]> {
		const allTasks = await this.taskService.getTasksWithQuery({
			path: this.config.taskPath,
			status: ["todo", "doing"],
		});
		const flat = this.flattenTasks(allTasks);
		const mode = this.config.taskMode ?? "both";
		return flat.filter((task) => {
			if (task.status === "done" || task.status === "cancelled") return false;
			const matchesDue = task.dueDate === dateISO;
			const matchesScheduled = task.scheduledDate === dateISO;
			if (mode === "due") return matchesDue;
			if (mode === "scheduled") return matchesScheduled;
			return matchesDue || matchesScheduled;
		});
	}

	private flattenTasks(tasks: Task[]): Task[] {
		const flat: Task[] = [];
		for (const task of tasks) {
			flat.push(task);
			if (task.subtasks.length > 0) {
				flat.push(...this.flattenTasks(task.subtasks as Task[]));
			}
		}
		return flat;
	}

	private getSlotNumber(
		index: number,
		startTime: string,
		firstSlotStart: string,
		slotDuration: number,
		breakDuration: number
	): number {
		const fallback = index + 1;
		if (!startTime || !firstSlotStart) return fallback;
		const total = slotDuration + breakDuration;
		if (total <= 0) return fallback;
		const startMin = this.timeToMin(startTime);
		const firstMin = this.timeToMin(firstSlotStart);
		if (startMin < firstMin) return fallback;
		return Math.floor((startMin - firstMin) / total) + 1;
	}

	private timeToMin(time: string): number {
		if (!time || !time.includes(":")) return 0;
		const parts = time.split(":");
		return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
	}
}
