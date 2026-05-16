import { App, Modal, Notice, TFile, moment, setIcon } from "obsidian";
import type UmOSPlugin from "../main";
import type { FocusSessionActive, FocusSessionData, FocusSessionRecord } from "../settings/Settings";
import { createElement } from "../utils/dom";
import { t } from "../i18n";
import type { Task } from "../productivity/tasks/Task";
import { TaskService } from "../productivity/tasks/TaskService";

const DEFAULT_FOCUS_MINUTES = 25;
const FOCUS_HISTORY_LIMIT = 40;

function formatClock(seconds: number): string {
	const safe = Math.max(0, Math.floor(seconds));
	const hours = Math.floor(safe / 3600);
	const minutes = Math.floor((safe % 3600) / 60);
	const rest = safe % 60;
	if (hours > 0) {
		return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
	}
	return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function formatDuration(seconds: number): string {
	const minutes = Math.max(1, Math.round(seconds / 60));
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`;
}

function cleanTitle(value: string): string {
	return value.replace(/\s+/g, " ").trim();
}

function taskOptionLabel(task: Task): string {
	const parts = [task.description];
	if (task.dueDate) parts.push(`${t("due")} ${task.dueDate}`);
	if (task.status === "doing") parts.push(t("in progress"));
	return parts.join(" · ");
}

export class FocusSessionModal extends Modal {
	private availableTasks: Task[] = [];
	private tickId: number | null = null;

	constructor(
		app: App,
		private plugin: UmOSPlugin,
	) {
		super(app);
	}

	onOpen(): void {
		this.modalEl.addClass("umos-focus-session-modal");
		this.contentEl.addClass("umos-focus-session-content");
		void this.render();
	}

	onClose(): void {
		this.clearTick();
		this.contentEl.empty();
		this.contentEl.removeClass("umos-focus-session-content");
	}

	private async render(): Promise<void> {
		this.clearTick();
		this.contentEl.empty();
		const store = this.getFocusStore();
		if (store.active) {
			this.renderActive(store.active);
			return;
		}

		this.renderLoading();
		await this.loadTasks();
		this.contentEl.empty();
		this.renderStart();
	}

	private renderLoading(): void {
		const shell = this.renderShell("Focus Session", "A calm timer for one deliberate block of work.");
		createElement("div", {
			cls: "umos-focus-empty",
			text: t("Loading active tasks..."),
			parent: shell,
		});
	}

	private renderStart(): void {
		const shell = this.renderShell("Focus Session", "Choose a task, set the length, and start.");
		const form = createElement("div", { cls: "umos-focus-start-form", parent: shell });

		const taskField = this.createField(form, "Linked task");
		const taskSelect = taskField.createEl("select", { cls: "umos-focus-input" }) as HTMLSelectElement;
		taskSelect.createEl("option", { value: "", text: t("Manual focus") });
		this.availableTasks.forEach((task, index) => {
			taskSelect.createEl("option", { value: String(index), text: taskOptionLabel(task) });
		});

		const titleInput = this.createField(form, "Focus title").createEl("input", {
			cls: "umos-focus-input",
			attr: { type: "text", placeholder: t("What are you focusing on?") },
		}) as HTMLInputElement;

		const minutesInput = this.createField(form, "Planned minutes").createEl("input", {
			cls: "umos-focus-input",
			attr: { type: "number", min: "1", max: "240", step: "5" },
		}) as HTMLInputElement;
		minutesInput.value = String(DEFAULT_FOCUS_MINUTES);

		const options = createElement("div", { cls: "umos-focus-options", parent: form });
		const logToDaily = this.createCheckbox(options, "Log to daily note", true);
		const markDoing = this.createCheckbox(options, "Mark linked task as in progress", true);

		const feedback = createElement("div", { cls: "umos-focus-feedback", parent: form });
		const actions = createElement("div", { cls: "umos-focus-actions", parent: form });
		const startButton = this.createActionButton(actions, "Start focus", "play", "is-primary");

		taskSelect.addEventListener("change", () => {
			const task = this.getSelectedTask(taskSelect);
			if (task) titleInput.value = task.description;
		});

		startButton.addEventListener("click", async () => {
			const selectedTask = this.getSelectedTask(taskSelect);
			const title = cleanTitle(titleInput.value || selectedTask?.description || "");
			const plannedMinutes = Math.min(240, Math.max(1, Number(minutesInput.value) || DEFAULT_FOCUS_MINUTES));
			if (!title) {
				this.setFeedback(feedback, "Focus title is required.", false);
				return;
			}

			startButton.disabled = true;
			await this.startSession({
				title,
				plannedMinutes,
				task: selectedTask,
				logToDaily: logToDaily.checked,
				markDoing: markDoing.checked,
			});
			startButton.disabled = false;
			new Notice(`✅ ${t("Focus session started")}`);
			await this.render();
		});

		if (this.availableTasks.length === 0) {
			createElement("div", {
				cls: "umos-focus-hint",
				text: t("No active tasks found. You can still start a manual focus session."),
				parent: form,
			});
		}

		this.renderRecent(shell);
	}

	private renderActive(active: FocusSessionActive): void {
		const shell = this.renderShell("Focus Session", active.state === "paused" ? "Paused and waiting." : "Stay with one thing.");
		const activeCard = createElement("div", { cls: `umos-focus-active-card is-${active.state}`, parent: shell });

		const timerWrap = createElement("div", { cls: "umos-focus-timer-wrap", parent: activeCard });
		const remainingEl = createElement("div", { cls: "umos-focus-timer", parent: timerWrap });
		const stateEl = createElement("div", { cls: "umos-focus-state", parent: timerWrap });
		const progress = createElement("div", { cls: "umos-focus-progress", parent: activeCard });
		const progressBar = createElement("div", { cls: "umos-focus-progress-bar", parent: progress });

		const titleRow = createElement("div", { cls: "umos-focus-active-title-row", parent: activeCard });
		createElement("div", { cls: "umos-focus-active-title", text: active.title, parent: titleRow });
		createElement("span", { cls: "umos-focus-duration-pill", text: `${active.plannedMinutes}m`, parent: titleRow });

		const meta = createElement("div", { cls: "umos-focus-meta-grid", parent: activeCard });
		const elapsedValue = this.createMeta(meta, "Elapsed");
		const startedValue = this.createMeta(meta, "Started");
		startedValue.textContent = moment(active.startedAt).format("HH:mm");

		if (active.taskFilePath) {
			const source = createElement("button", {
				cls: "umos-focus-source",
				attr: { type: "button", title: active.taskFilePath },
				parent: activeCard,
			});
			const icon = createElement("span", { cls: "umos-focus-source-icon", parent: source });
			setIcon(icon, "file-text");
			createElement("span", { text: this.getSourceLabel(active), parent: source });
			source.addEventListener("click", () => void this.openTaskSource(active));
		}

		const actions = createElement("div", { cls: "umos-focus-actions", parent: activeCard });
		const pauseButton = this.createActionButton(
			actions,
			active.state === "paused" ? "Resume" : "Pause",
			active.state === "paused" ? "play" : "pause",
			"is-secondary",
		);
		const finishButton = this.createActionButton(actions, "Finish session", "check", "is-primary");
		const cancelButton = this.createActionButton(actions, "Cancel session", "x", "is-danger");

		const updateTimer = () => {
			const elapsed = this.getElapsedSeconds(active);
			const planned = active.plannedMinutes * 60;
			const remaining = planned - elapsed;
			remainingEl.textContent = remaining > 0 ? formatClock(remaining) : formatClock(elapsed);
			stateEl.textContent = t(remaining > 0 ? "Remaining" : "Overtime");
			elapsedValue.textContent = formatDuration(elapsed);
			progressBar.style.width = `${Math.min(100, Math.max(0, (elapsed / planned) * 100))}%`;
			activeCard.classList.toggle("is-overtime", remaining <= 0);
		};
		updateTimer();
		this.tickId = window.setInterval(updateTimer, 1000);

		pauseButton.addEventListener("click", async () => {
			await this.togglePause(active);
			await this.render();
		});
		finishButton.addEventListener("click", async () => {
			finishButton.disabled = true;
			await this.finishSession(active);
			new Notice(`✅ ${t("Focus session finished")}`);
			await this.render();
		});
		cancelButton.addEventListener("click", async () => {
			cancelButton.disabled = true;
			await this.cancelSession(active);
			new Notice(t("Focus session cancelled"));
			await this.render();
		});

		this.renderRecent(shell);
	}

	private renderShell(title: string, subtitle: string): HTMLElement {
		const shell = createElement("div", { cls: "umos-focus-shell", parent: this.contentEl });
		const header = createElement("div", { cls: "umos-focus-header", parent: shell });
		const titleWrap = createElement("div", { cls: "umos-focus-title-wrap", parent: header });
		const icon = createElement("span", { cls: "umos-focus-icon", parent: titleWrap });
		setIcon(icon, "timer");
		createElement("div", { cls: "umos-focus-title", text: t(title), parent: titleWrap });
		createElement("div", { cls: "umos-focus-subtitle", text: t(subtitle), parent: shell });
		return shell;
	}

	private async loadTasks(): Promise<void> {
		try {
			const service = new TaskService(this.app, this.plugin);
			const tasks = await service.getFlatTasksWithQuery({
				path: this.plugin.settings.taskCalendarTaskPaths,
				status: ["todo", "doing"],
			});
			this.availableTasks = tasks
				.sort((a, b) => this.compareTasksForFocus(a, b))
				.slice(0, 80);
		} catch (error) {
			console.error("umOS: could not load focus tasks", error);
			this.availableTasks = [];
		}
	}

	private compareTasksForFocus(a: Task, b: Task): number {
		const statusRank = (task: Task) => task.status === "doing" ? 0 : 1;
		const rankCompare = statusRank(a) - statusRank(b);
		if (rankCompare !== 0) return rankCompare;
		const dueA = a.dueDate ?? "9999-12-31";
		const dueB = b.dueDate ?? "9999-12-31";
		const dueCompare = dueA.localeCompare(dueB);
		if (dueCompare !== 0) return dueCompare;
		const pathCompare = a.filePath.localeCompare(b.filePath);
		if (pathCompare !== 0) return pathCompare;
		return a.lineNumber - b.lineNumber;
	}

	private getSelectedTask(select: HTMLSelectElement): Task | null {
		if (!select.value) return null;
		const index = Number(select.value);
		return Number.isFinite(index) ? this.availableTasks[index] ?? null : null;
	}

	private async startSession(options: {
		title: string;
		plannedMinutes: number;
		task: Task | null;
		logToDaily: boolean;
		markDoing: boolean;
	}): Promise<void> {
		if (options.task && options.markDoing && options.task.status === "todo") {
			const service = new TaskService(this.app, this.plugin);
			options.task.status = "doing";
			await service.updateTask(options.task);
		}

		const store = this.getFocusStore();
		store.active = {
			id: `focus-${Date.now()}`,
			title: options.title,
			taskFilePath: options.task?.filePath,
			taskLineNumber: options.task?.lineNumber,
			plannedMinutes: options.plannedMinutes,
			startedAt: Date.now(),
			pausedSeconds: 0,
			state: "running",
			logToDaily: options.logToDaily,
		};
		await this.saveFocus("started");
	}

	private async togglePause(active: FocusSessionActive): Promise<void> {
		if (active.state === "paused") {
			if (active.pausedAt) {
				active.pausedSeconds += Math.floor((Date.now() - active.pausedAt) / 1000);
			}
			active.state = "running";
			delete active.pausedAt;
			await this.saveFocus("resumed");
			return;
		}

		active.state = "paused";
		active.pausedAt = Date.now();
		await this.saveFocus("paused");
	}

	private async finishSession(active: FocusSessionActive): Promise<void> {
		const now = Date.now();
		const record: FocusSessionRecord = {
			id: active.id,
			title: active.title,
			taskFilePath: active.taskFilePath,
			taskLineNumber: active.taskLineNumber,
			plannedMinutes: active.plannedMinutes,
			startedAt: active.startedAt,
			endedAt: now,
			durationSeconds: this.getElapsedSeconds(active, now),
			status: "completed",
		};
		if (active.logToDaily) {
			record.notePath = await this.appendDailyLog(record);
		}

		const store = this.getFocusStore();
		store.sessions = [record, ...(store.sessions ?? [])].slice(0, FOCUS_HISTORY_LIMIT);
		store.active = null;
		await this.saveFocus("completed");
	}

	private async cancelSession(active: FocusSessionActive): Promise<void> {
		const now = Date.now();
		const record: FocusSessionRecord = {
			id: active.id,
			title: active.title,
			taskFilePath: active.taskFilePath,
			taskLineNumber: active.taskLineNumber,
			plannedMinutes: active.plannedMinutes,
			startedAt: active.startedAt,
			endedAt: now,
			durationSeconds: this.getElapsedSeconds(active, now),
			status: "cancelled",
		};
		const store = this.getFocusStore();
		store.sessions = [record, ...(store.sessions ?? [])].slice(0, FOCUS_HISTORY_LIMIT);
		store.active = null;
		await this.saveFocus("cancelled");
	}

	private async appendDailyLog(record: FocusSessionRecord): Promise<string | undefined> {
		try {
			const date = moment(record.endedAt).format("YYYY-MM-DD");
			const file = await this.plugin.ensureDailyNoteFile(date, { open: false, notify: false });
			if (!(file instanceof TFile)) {
				new Notice(t("Could not write focus log to daily note."));
				return undefined;
			}

			const content = await this.app.vault.read(file);
			const lines = content.split(/\r?\n/);
			const heading = t("## Focus Sessions");
			const candidates = new Set(["## Focus Sessions", "## Фокус-сессии", heading]);
			const line = this.buildDailyLogLine(record);
			const headingIndex = lines.findIndex((item) => candidates.has(item.trim()));

			if (headingIndex === -1) {
				const suffix = content.endsWith("\n") ? "" : "\n";
				await this.app.vault.modify(file, `${content}${suffix}\n${heading}\n\n${line}\n`);
				return file.path;
			}

			let insertIndex = headingIndex + 1;
			while (insertIndex < lines.length && lines[insertIndex].trim() === "") {
				insertIndex++;
			}
			lines.splice(insertIndex, 0, line);
			await this.app.vault.modify(file, lines.join("\n"));
			return file.path;
		} catch (error) {
			console.error("umOS: could not append focus log", error);
			new Notice(t("Could not write focus log to daily note."));
			return undefined;
		}
	}

	private buildDailyLogLine(record: FocusSessionRecord): string {
		const start = moment(record.startedAt).format("HH:mm");
		const end = moment(record.endedAt).format("HH:mm");
		const parts = [
			`- ${start}-${end}`,
			formatDuration(record.durationSeconds),
			record.title,
		];
		if (record.taskFilePath) {
			parts.push(`[[${record.taskFilePath.replace(/\.md$/i, "")}|${t("source")}]]`);
		}
		return parts.join(" | ");
	}

	private getElapsedSeconds(active: FocusSessionActive, now = Date.now()): number {
		const pausedLive = active.state === "paused" && active.pausedAt
			? Math.floor((now - active.pausedAt) / 1000)
			: 0;
		return Math.max(0, Math.floor((now - active.startedAt) / 1000) - active.pausedSeconds - pausedLive);
	}

	private getFocusStore(): FocusSessionData {
		const current = this.plugin.data_store.focus;
		if (!current) {
			this.plugin.data_store.focus = { active: null, sessions: [] };
			return this.plugin.data_store.focus;
		}
		current.active = current.active ?? null;
		current.sessions = Array.isArray(current.sessions) ? current.sessions : [];
		return current;
	}

	private async saveFocus(action: "started" | "paused" | "resumed" | "completed" | "cancelled"): Promise<void> {
		await this.plugin.saveSettings();
		this.plugin.eventBus.emit("focus-session:changed", { action });
	}

	private createField(parent: HTMLElement, label: string): HTMLLabelElement {
		const field = createElement("label", { cls: "umos-focus-field", parent });
		createElement("span", { text: t(label), parent: field });
		return field;
	}

	private createCheckbox(parent: HTMLElement, label: string, checked: boolean): HTMLInputElement {
		const wrap = createElement("label", { cls: "umos-focus-check", parent });
		const input = wrap.createEl("input", { attr: { type: "checkbox" } }) as HTMLInputElement;
		input.checked = checked;
		createElement("span", { text: t(label), parent: wrap });
		return input;
	}

	private createActionButton(parent: HTMLElement, label: string, iconName: string, cls: string): HTMLButtonElement {
		const button = createElement("button", {
			cls: `umos-focus-action ${cls}`,
			attr: { type: "button" },
			parent,
		});
		const icon = createElement("span", { cls: "umos-focus-action-icon", parent: button });
		setIcon(icon, iconName);
		createElement("span", { text: t(label), parent: button });
		return button;
	}

	private createMeta(parent: HTMLElement, label: string): HTMLElement {
		const item = createElement("div", { cls: "umos-focus-meta", parent });
		createElement("div", { cls: "umos-focus-meta-label", text: t(label), parent: item });
		return createElement("div", { cls: "umos-focus-meta-value", parent: item });
	}

	private setFeedback(el: HTMLElement, message: string, ok: boolean): void {
		el.className = `umos-focus-feedback is-${ok ? "success" : "failed"}`;
		el.textContent = t(message);
	}

	private renderRecent(parent: HTMLElement): void {
		const recent = this.getFocusStore().sessions.slice(0, 5);
		const section = createElement("div", { cls: "umos-focus-recent", parent });
		createElement("div", { cls: "umos-focus-recent-title", text: t("Recent focus sessions"), parent: section });
		if (recent.length === 0) {
			createElement("div", { cls: "umos-focus-empty", text: t("No focus sessions yet."), parent: section });
			return;
		}

		for (const item of recent) {
			const row = createElement("div", { cls: `umos-focus-recent-row is-${item.status}`, parent: section });
			createElement("span", { cls: "umos-focus-recent-name", text: item.title, parent: row });
			createElement("span", {
				cls: "umos-focus-recent-meta",
				text: `${formatDuration(item.durationSeconds)} · ${moment(item.endedAt).format("DD.MM HH:mm")}`,
				parent: row,
			});
		}
	}

	private getSourceLabel(active: FocusSessionActive): string {
		if (!active.taskFilePath) return "";
		const line = typeof active.taskLineNumber === "number" ? `:${active.taskLineNumber + 1}` : "";
		return `${active.taskFilePath}${line}`;
	}

	private async openTaskSource(active: FocusSessionActive): Promise<void> {
		if (!active.taskFilePath) return;
		const file = this.app.vault.getAbstractFileByPath(active.taskFilePath);
		if (file instanceof TFile) {
			await this.app.workspace.getLeaf(false).openFile(file);
		}
	}

	private clearTick(): void {
		if (this.tickId !== null) {
			window.clearInterval(this.tickId);
			this.tickId = null;
		}
	}
}
