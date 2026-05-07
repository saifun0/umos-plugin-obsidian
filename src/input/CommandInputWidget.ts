import { MarkdownRenderChild, Notice, TFile, moment, normalizePath } from "obsidian";
import type UmOSPlugin from "../main";
import { DailyNoteEnhancer } from "../daily/DailyNoteEnhancer";
import { Task } from "../productivity/tasks/Task";
import { TaskService } from "../productivity/tasks/TaskService";
import type { CommandHistoryItem, ScheduleSlot } from "../settings/Settings";
import { getCurrentWeekKey, setSlot, WEEKDAYS } from "../productivity/schedule/ScheduleData";

export interface CommandInputConfig {
	placeholder?: string;
	target?: string;
	create_in?: string;
	file?: string;
	help?: boolean | string;
	history?: boolean | string;
}

type CommandStatus = "success" | "failed";
type CommandNoteTarget = "current" | "daily";
type CountdownView = "full" | "focus" | "minimal";
type Priority = "high" | "medium" | "low" | "none";
type ScheduleType = ScheduleSlot["type"];

interface CommandExecutionResult {
	message: string;
	target?: string;
}

interface ParsedTaskCommand {
	description: string;
	dueDate: string | null;
	priority: Priority;
	tags: string[];
}

interface ParsedCountdownCommand {
	title: string;
	date: string;
	accent: string;
	view: CountdownView;
	target?: CommandNoteTarget;
}

interface ParsedScheduleCommand {
	subject: string;
	day: string;
	startTime: string;
	endTime: string;
	room: string;
	teacher: string;
	type: ScheduleType;
	weekKey: "week1" | "week2";
}

const COMMAND_LIMIT = 10;

const HELP_ITEMS = [
	{ cmd: "task", example: "task Prepare notes tomorrow #study !high" },
	{ cmd: "countdown", example: "countdown Exam session 2026-07-01 accent:#27ae60 view:focus" },
	{ cmd: "schedule", example: "schedule Math monday 09:00-10:30 room:301 type:lecture" },
	{ cmd: "review", example: "review win Finished dashboard studio today" },
];

const REVIEW_KEYS: Record<string, string> = {
	win: "review_win",
	wins: "review_win",
	lesson: "review_lessons",
	lessons: "review_lessons",
	tomorrow: "review_tomorrow",
	next: "review_tomorrow",
	weekly_win: "weekly_review_win",
	weekly_friction: "weekly_review_friction",
	weekly_next: "weekly_review_next",
};

const DAY_ALIASES: Record<string, string> = {
	mon: "monday",
	monday: "monday",
	Monday: "monday",
	tue: "tuesday",
	tuesday: "tuesday",
	Tuesday: "tuesday",
	wed: "wednesday",
	wednesday: "wednesday",
	Wednesday: "wednesday",
	thu: "thursday",
	thursday: "thursday",
	Thursday: "thursday",
	fri: "friday",
	friday: "friday",
	Friday: "friday",
	sat: "saturday",
	saturday: "saturday",
	Saturday: "saturday",
};

export class CommandInputWidget extends MarkdownRenderChild {
	private service: TaskService;
	private inputEl: HTMLInputElement | null = null;
	private feedbackEl: HTMLElement | null = null;
	private historyEl: HTMLElement | null = null;

	constructor(
		containerEl: HTMLElement,
		private plugin: UmOSPlugin,
		private config: CommandInputConfig,
		private sourcePath: string | null
	) {
		super(containerEl);
		this.service = new TaskService(plugin.app, plugin);
	}

	onload(): void {
		this.render();
	}

	private render(): void {
		this.containerEl.empty();
		const root = this.containerEl.createDiv({ cls: "umos-command-center" });
		const commandRow = root.createDiv({ cls: "umos-command-input" });
		this.inputEl = commandRow.createEl("input", {
			cls: "umos-command-input-field",
			attr: {
				type: "text",
				placeholder: this.config.placeholder || "task Prepare notes tomorrow #study !high",
			},
		}) as HTMLInputElement;
		const button = commandRow.createEl("button", { text: "Run", cls: "umos-command-input-button" });

		this.feedbackEl = root.createDiv({ cls: "umos-command-feedback" });
		if (this.isConfigEnabled(this.config.help, true)) {
			this.renderHelp(root);
		}
		if (this.isConfigEnabled(this.config.history, true)) {
			this.historyEl = root.createDiv({ cls: "umos-command-history" });
			this.renderHistory();
		}

		const run = async () => {
			const raw = this.inputEl?.value.trim() ?? "";
			if (!raw) return;
			button.disabled = true;
			try {
				const ok = await this.execute(raw);
				if (ok && this.inputEl) this.inputEl.value = "";
			} finally {
				button.disabled = false;
			}
		};

		button.addEventListener("click", () => void run());
		this.inputEl.addEventListener("keydown", (event) => {
			if (event.key === "Enter") {
				event.preventDefault();
				void run();
			}
			if (event.key === "ArrowUp") {
				const last = this.plugin.data_store.commandHistory?.[0]?.raw;
				if (last && this.inputEl && !this.inputEl.value) {
					event.preventDefault();
					this.inputEl.value = last;
				}
			}
		});
	}

	private renderHelp(root: HTMLElement): void {
		const help = root.createDiv({ cls: "umos-command-help" });
		for (const item of HELP_ITEMS) {
			const pill = help.createEl("button", {
				cls: "umos-command-help-pill",
				text: item.example,
				attr: { type: "button", title: item.example, "data-command": item.cmd },
			});
			pill.addEventListener("click", () => {
				if (!this.inputEl) return;
				this.inputEl.value = item.example;
				this.inputEl.focus();
			});
		}
	}

	private renderHistory(): void {
		if (!this.historyEl) return;
		this.historyEl.empty();
		const history = (this.plugin.data_store.commandHistory ?? []).slice(0, COMMAND_LIMIT);
		if (history.length === 0) return;

		const title = this.historyEl.createDiv({ cls: "umos-command-history-title", text: "History" });
		title.createSpan({ text: " · ↑ repeats the latest command from an empty input" });

		for (const item of history) {
			const row = this.historyEl.createEl("button", {
				cls: `umos-command-history-item is-${item.status}`,
				attr: { type: "button", title: item.message },
			});
			row.createSpan({ cls: "umos-command-history-command", text: item.command || this.getCommandName(item.raw) });
			row.createSpan({ cls: "umos-command-history-raw", text: item.raw });
			row.createSpan({ cls: "umos-command-history-status", text: item.status === "success" ? "ok" : "fail" });
			row.addEventListener("click", () => {
				if (!this.inputEl) return;
				this.inputEl.value = item.raw;
				this.inputEl.focus();
			});
		}
	}

	private async execute(raw: string): Promise<boolean> {
		const [commandRaw, ...rest] = raw.split(/\s+/);
		const command = commandRaw.toLowerCase();

		try {
			let result: CommandExecutionResult;
			if (command === "task") result = await this.executeTask(rest);
			else if (command === "countdown") result = await this.executeCountdown(rest);
			else if (command === "schedule") result = await this.executeSchedule(rest);
			else if (command === "review") result = await this.executeReview(rest);
			else throw new Error(`Unknown command "${commandRaw}". Try task, countdown, schedule, or review.`);

			await this.recordHistory(raw, command, "success", result.message, result.target);
			this.plugin.eventBus.emit("command:executed", { command: raw, target: result.target ?? result.message });
			this.setFeedback(result.message, "success");
			new Notice(`✅ ${result.message}`);
			return true;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			await this.recordHistory(raw, command, "failed", message);
			this.plugin.eventBus.emit("command:failed", { command: raw, reason: message });
			this.setFeedback(message, "failed");
			new Notice(`umOS command: ${message}`);
			return false;
		}
	}

	private async executeTask(tokens: string[]): Promise<CommandExecutionResult> {
		const parsed = this.parseTask(tokens);
		if (!parsed.description) throw new Error("Task needs a description after task.");
		const filePath = this.resolveTaskTargetPath();
		if (!filePath) throw new Error("Could not determine the task file.");

		const task = new Task("", filePath, 0);
		task.description = parsed.description;
		task.dueDate = parsed.dueDate;
		task.priority = parsed.priority;
		task.tags = parsed.tags;
		const line = await this.service.createTask(task, filePath);
		if (line < 0) throw new Error(`Could not add task to ${filePath}.`);
		return {
			message: `Task added: ${parsed.description}`,
			target: filePath,
		};
	}

	private async executeCountdown(tokens: string[]): Promise<CommandExecutionResult> {
		const parsed = this.parseCountdown(tokens);
		if (!parsed.title) throw new Error("Countdown needs a title.");
		if (!parsed.date) throw new Error("Countdown needs a date: YYYY-MM-DD or YYYY-MM-DD HH:MM.");

		const file = await this.ensureTextTargetFile(parsed.target);
		const block = [
			"```countdown",
			`title: ${parsed.title}`,
			`date: ${parsed.date}`,
			parsed.accent ? `accent: ${parsed.accent}` : "",
			`view: ${parsed.view}`,
			"```",
		].filter((line) => line !== "").join("\n");
		await this.plugin.app.vault.append(file, `\n\n${block}\n`);
		return {
			message: `Countdown added: ${parsed.title}`,
			target: file.path,
		};
	}

	private async executeSchedule(tokens: string[]): Promise<CommandExecutionResult> {
		const parsed = this.parseSchedule(tokens);
		const slots = this.plugin.data_store.schedule[parsed.weekKey][parsed.day] ?? [];
		let slotIndex = slots.findIndex((slot) => slot.startTime === parsed.startTime);
		if (slotIndex === -1) {
			slotIndex = slots.findIndex((slot) => !slot.subject?.trim());
		}
		if (slotIndex === -1) slotIndex = slots.length;

		setSlot(this.plugin.data_store, parsed.weekKey, parsed.day, slotIndex, {
			subject: parsed.subject,
			teacher: parsed.teacher,
			room: parsed.room,
			startTime: parsed.startTime,
			endTime: parsed.endTime,
			type: parsed.type,
		});
		await this.plugin.saveSettings();
		this.plugin.eventBus.emit("schedule:changed");
		return {
			message: `Schedule updated: ${parsed.subject} ${parsed.day} ${parsed.startTime}-${parsed.endTime}`,
			target: `${parsed.weekKey}/${parsed.day}`,
		};
	}

	private async executeReview(tokens: string[]): Promise<CommandExecutionResult> {
		const keyRaw = tokens.shift()?.toLowerCase();
		if (!keyRaw) throw new Error("Review needs a key: win, lesson, tomorrow, weekly_win, weekly_friction, weekly_next.");
		const property = REVIEW_KEYS[keyRaw];
		if (!property) throw new Error(`Unknown review key "${keyRaw}".`);
		const value = tokens.join(" ").trim();
		if (!value) throw new Error("Review needs text after the key.");

		const file = await this.ensureDailyNote();
		await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
			fm[property] = value;
		});
		this.plugin.eventBus.emit("frontmatter:changed", {
			path: file.path,
			property,
			value,
		});
		return {
			message: `Review saved: ${property}`,
			target: file.path,
		};
	}

	private parseTask(tokens: string[]): ParsedTaskCommand {
		let dueDate: string | null = null;
		let priority: Priority = "none";
		const tags: string[] = [];
		const description: string[] = [];

		for (const token of tokens) {
			const lower = token.toLowerCase();
			if (lower === "today") {
				dueDate = moment().format("YYYY-MM-DD");
				continue;
			}
			if (lower === "tomorrow") {
				dueDate = moment().add(1, "day").format("YYYY-MM-DD");
				continue;
			}
			if (/^\d{4}-\d{2}-\d{2}$/.test(token)) {
				dueDate = this.parseDateToken(token);
				continue;
			}
			if (/^!(high|medium|low)$/.test(lower)) {
				priority = lower.slice(1) as Priority;
				continue;
			}
			if (token.startsWith("#") && token.length > 1) {
				tags.push(token.slice(1));
				continue;
			}
			description.push(token);
		}

		return {
			description: description.join(" ").trim(),
			dueDate,
			priority,
			tags,
		};
	}

	private parseCountdown(tokens: string[]): ParsedCountdownCommand {
		let date = "";
		let accent = "";
		let view: CountdownView = "focus";
		let target: CommandNoteTarget | undefined;
		const title: string[] = [];

		for (let i = 0; i < tokens.length; i++) {
			const token = tokens[i];
			const lower = token.toLowerCase();
			if (/^accent:/i.test(token)) {
				accent = token.slice("accent:".length);
				if (accent && !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(accent)) {
					throw new Error("accent must be a hex color, for example accent:#27ae60.");
				}
				continue;
			}
			if (/^view:/i.test(token)) {
				const value = token.slice("view:".length) as CountdownView;
				if (!["full", "focus", "minimal"].includes(value)) {
					throw new Error("countdown view: full, focus, or minimal.");
				}
				view = value;
				continue;
			}
			if (/^target:/i.test(token)) {
				const value = token.slice("target:".length).toLowerCase();
				if (value !== "current" && value !== "daily") {
					throw new Error("countdown target: current or daily.");
				}
				target = value;
				continue;
			}
			if (/^\d{4}-\d{2}-\d{2}$/.test(token)) {
				const next = tokens[i + 1];
				if (next && /^\d{1,2}:\d{2}$/.test(next)) {
					const time = this.normalizeAndValidateTime(next);
					date = this.parseCountdownDate(token, time);
					i++;
				} else {
					date = this.parseCountdownDate(token);
				}
				continue;
			}
			if (/^\d{1,2}:\d{2}$/.test(token)) {
				throw new Error("Countdown time goes after the date: countdown Exam 2026-07-01 09:00.");
			}
			title.push(token);
		}

		return { title: title.join(" ").trim(), date, accent, view, target };
	}

	private parseSchedule(tokens: string[]): ParsedScheduleCommand {
		let day = "";
		let startTime = "";
		let endTime = "";
		let room = "";
		let teacher = "";
		let type: ScheduleType = "lecture";
		let weekKey = getCurrentWeekKey(this.plugin.data_store.settings.scheduleAnchorDate);
		const subject: string[] = [];

		for (const token of tokens) {
			const lower = token.toLowerCase();
			if (DAY_ALIASES[lower]) {
				day = DAY_ALIASES[lower];
				continue;
			}
			const timeMatch = token.match(/^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/);
			if (timeMatch) {
				[startTime, endTime] = this.parseTimeRange(timeMatch[1], timeMatch[2]);
				continue;
			}
			if (/^room:/i.test(token)) {
				room = token.slice("room:".length);
				continue;
			}
			if (/^teacher:/i.test(token)) {
				teacher = token.slice("teacher:".length);
				continue;
			}
			if (/^type:/i.test(token)) {
				const nextType = token.slice("type:".length) as ScheduleType;
				if (!["lecture", "seminar", "lab", "practice", "exam"].includes(nextType)) {
					throw new Error("schedule type: lecture, seminar, lab, practice, or exam.");
				}
				type = nextType;
				continue;
			}
			if (/^week:/i.test(token)) {
				const nextWeek = token.slice("week:".length);
				if (nextWeek === "week1" || nextWeek === "week2") {
					weekKey = nextWeek;
				} else if (nextWeek !== "current") {
					throw new Error("schedule week: current, week1, or week2.");
				}
				continue;
			}
			subject.push(token);
		}

		if (!subject.join(" ").trim()) throw new Error("Schedule needs a class name after schedule.");
		if (!day || !WEEKDAYS.includes(day)) throw new Error("Schedule needs a weekday: monday, tuesday ... saturday.");
		if (!startTime || !endTime) throw new Error("Schedule needs time in 09:00-10:30 format.");

		return {
			subject: subject.join(" ").trim(),
			day,
			startTime,
			endTime,
			room,
			teacher,
			type,
			weekKey,
		};
	}

	private resolveTaskTargetPath(): string | null {
		if (this.config.file?.trim()) return this.config.file.trim();
		const target = String(this.config.target || this.config.create_in || "").toLowerCase();
		if ((target === "current" || target === "note") && this.sourcePath) return this.sourcePath;
		return this.getTodayDailyNotePath();
	}

	private async ensureTextTargetFile(targetOverride?: CommandNoteTarget): Promise<TFile> {
		const target = String(targetOverride || this.config.target || this.config.create_in || "").toLowerCase();
		if ((target === "daily" || !this.sourcePath) && !this.config.file) return this.ensureDailyNote();
		const path = this.config.file?.trim() || this.sourcePath || this.getTodayDailyNotePath();
		return this.ensureMarkdownFile(path);
	}

	private async ensureDailyNote(): Promise<TFile> {
		const enhancer = new DailyNoteEnhancer(
			this.plugin.app,
			() => this.plugin.settings,
			this.plugin.eventBus,
			() => this.plugin.data_store
		);
		const file = await enhancer.ensureDailyNote(undefined, { open: false, notify: false });
		if (!(file instanceof TFile)) throw new Error("Could not create daily note.");
		return file;
	}

	private async ensureMarkdownFile(path: string): Promise<TFile> {
		const normalized = normalizePath(path);
		const existing = this.plugin.app.vault.getAbstractFileByPath(normalized);
		if (existing instanceof TFile) return existing;

		const slash = normalized.lastIndexOf("/");
		if (slash > -1) {
			const folder = normalized.slice(0, slash);
			await this.ensureFolder(folder);
		}
		return this.plugin.app.vault.create(normalized, "");
	}

	private async ensureFolder(folderPath: string): Promise<void> {
		const parts = folderPath.split("/").filter(Boolean);
		let current = "";
		for (const part of parts) {
			current = current ? `${current}/${part}` : part;
			if (!this.plugin.app.vault.getAbstractFileByPath(current)) {
				await this.plugin.app.vault.createFolder(current);
			}
		}
	}

	private getTodayDailyNotePath(): string {
		const settings = this.plugin.settings;
		const fileName = moment().format(settings.dailyNoteFormat || "YYYY-MM-DD");
		return `${settings.dailyNotesPath}/${fileName}.md`;
	}

	private async recordHistory(
		raw: string,
		command: string,
		status: CommandStatus,
		message: string,
		target?: string
	): Promise<void> {
		const current = this.plugin.data_store.commandHistory ?? [];
		const entry: CommandHistoryItem = {
			raw,
			command,
			target,
			status,
			message,
			executedAt: Date.now(),
		};
		this.plugin.data_store.commandHistory = [
			entry,
			...current.filter((item) => item.raw !== raw),
		].slice(0, COMMAND_LIMIT);
		await this.plugin.saveSettings();
		this.renderHistory();
	}

	private setFeedback(message: string, status: CommandStatus): void {
		if (!this.feedbackEl) return;
		this.feedbackEl.empty();
		this.feedbackEl.className = `umos-command-feedback is-${status}`;
		this.feedbackEl.textContent = message;
	}

	private parseDateToken(value: string): string {
		const parsed = moment(value, "YYYY-MM-DD", true);
		if (!parsed.isValid()) throw new Error(`Invalid date: ${value}. Format: YYYY-MM-DD.`);
		return parsed.format("YYYY-MM-DD");
	}

	private parseCountdownDate(date: string, time?: string): string {
		const normalizedDate = this.parseDateToken(date);
		if (!time) return normalizedDate;
		const raw = `${normalizedDate} ${time}`;
		const parsed = moment(raw, "YYYY-MM-DD HH:mm", true);
		if (!parsed.isValid()) throw new Error(`Invalid countdown date: ${raw}.`);
		return parsed.format("YYYY-MM-DD HH:mm");
	}

	private parseTimeRange(start: string, end: string): [string, string] {
		const normalizedStart = this.normalizeAndValidateTime(start);
		const normalizedEnd = this.normalizeAndValidateTime(end);
		if (this.timeToMinutes(normalizedEnd) <= this.timeToMinutes(normalizedStart)) {
			throw new Error("End time must be after start time.");
		}
		return [normalizedStart, normalizedEnd];
	}

	private normalizeAndValidateTime(value: string): string {
		const match = value.match(/^(\d{1,2}):(\d{2})$/);
		if (!match) throw new Error(`Invalid time: ${value}. Format: HH:MM.`);
		const hours = Number(match[1]);
		const minutes = Number(match[2]);
		if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours > 23 || minutes > 59) {
			throw new Error(`Invalid time: ${value}. Format: HH:MM.`);
		}
		return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
	}

	private timeToMinutes(value: string): number {
		const [hours, minutes] = value.split(":").map(Number);
		return hours * 60 + minutes;
	}

	private getCommandName(raw: string): string {
		return raw.split(/\s+/)[0] || "command";
	}

	private isConfigEnabled(value: boolean | string | undefined, fallback: boolean): boolean {
		if (value === undefined) return fallback;
		if (typeof value === "boolean") return value;
		const normalized = value.trim().toLowerCase();
		return !["false", "0", "off", "no", "hide"].includes(normalized);
	}
}
