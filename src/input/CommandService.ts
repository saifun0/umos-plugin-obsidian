import { Notice, TFile, moment, normalizePath } from "obsidian";
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

export interface CommandExecutionContext {
	config?: CommandInputConfig;
	sourcePath?: string | null;
	notify?: boolean;
	saveHistory?: boolean;
}

export interface CommandExecutionResult {
	ok: boolean;
	command: string;
	message: string;
	target?: string;
	createdFile?: string;
	openedFile?: string;
}

type CommandStatus = "success" | "failed";
type CommandNoteTarget = "current" | "daily";
type CountdownView = "full" | "focus" | "minimal";
type Priority = "high" | "medium" | "low" | "none";
type ScheduleType = ScheduleSlot["type"];

interface InternalCommandResult {
	message: string;
	target?: string;
	createdFile?: string;
	openedFile?: string;
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

export interface CommandHelpItem {
	cmd: string;
	title: string;
	description: string;
	usage: string;
	example: string;
	tokens: Array<{ value: string; detail: string }>;
}

export const COMMAND_HELP_ITEMS: CommandHelpItem[] = [
	{
		cmd: "task",
		title: "Task command",
		description: "Create a markdown task in the current note or daily note.",
		usage: "Usage: > task Description today|tomorrow|YYYY-MM-DD #tag !high",
		example: "task Prepare notes tomorrow #study !high",
		tokens: [
			{ value: "today", detail: "Due today" },
			{ value: "tomorrow", detail: "Due tomorrow" },
			{ value: "!high", detail: "High priority" },
			{ value: "!medium", detail: "Medium priority" },
			{ value: "!low", detail: "Low priority" },
		],
	},
	{
		cmd: "countdown",
		title: "Countdown command",
		description: "Add a countdown block to the current or daily note.",
		usage: "Usage: > countdown Title YYYY-MM-DD [HH:mm] accent:#27ae60 view:focus target:current",
		example: "countdown Exam session 2026-07-01 accent:#27ae60 view:focus",
		tokens: [
			{ value: "accent:#27ae60", detail: "Accent color" },
			{ value: "view:focus", detail: "Focus view" },
			{ value: "view:full", detail: "Full view" },
			{ value: "view:minimal", detail: "Minimal view" },
			{ value: "target:current", detail: "Write into current note" },
			{ value: "target:daily", detail: "Write into daily note" },
		],
	},
	{
		cmd: "schedule",
		title: "Schedule command",
		description: "Update a schedule slot.",
		usage: "Usage: > schedule Subject monday 09:00-10:30 room:301 type:lecture week:current",
		example: "schedule Math monday 09:00-10:30 room:301 type:lecture",
		tokens: [
			{ value: "monday", detail: "Monday" },
			{ value: "tuesday", detail: "Tuesday" },
			{ value: "wednesday", detail: "Wednesday" },
			{ value: "thursday", detail: "Thursday" },
			{ value: "friday", detail: "Friday" },
			{ value: "saturday", detail: "Saturday" },
			{ value: "room:", detail: "Room" },
			{ value: "teacher:", detail: "Teacher" },
			{ value: "type:lecture", detail: "Lecture" },
			{ value: "type:seminar", detail: "Seminar" },
			{ value: "type:lab", detail: "Lab" },
			{ value: "type:practice", detail: "Practice" },
			{ value: "type:exam", detail: "Exam" },
			{ value: "week:current", detail: "Current week" },
			{ value: "week:week1", detail: "First week" },
			{ value: "week:week2", detail: "Second week" },
		],
	},
	{
		cmd: "review",
		title: "Review command",
		description: "Save a daily or weekly review field.",
		usage: "Usage: > review win|lesson|tomorrow|weekly_win|weekly_friction|weekly_next Text",
		example: "review win Finished dashboard studio today",
		tokens: [
			{ value: "win", detail: "Review win" },
			{ value: "lesson", detail: "Review lesson" },
			{ value: "tomorrow", detail: "Review tomorrow" },
			{ value: "weekly_win", detail: "Weekly win" },
			{ value: "weekly_friction", detail: "Weekly friction" },
			{ value: "weekly_next", detail: "Weekly next" },
		],
	},
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

export class CommandService {
	private taskService: TaskService;

	constructor(private plugin: UmOSPlugin) {
		this.taskService = new TaskService(plugin.app, plugin);
	}

	async execute(raw: string, context: CommandExecutionContext = {}): Promise<CommandExecutionResult> {
		const trimmed = raw.trim();
		const [commandRaw = "", ...rest] = trimmed.split(/\s+/);
		const command = commandRaw.toLowerCase();
		const shouldNotify = context.notify !== false;

		try {
			if (!trimmed) throw new Error("Command is empty.");

			let result: InternalCommandResult;
			if (command === "task") result = await this.executeTask(rest, context);
			else if (command === "countdown") result = await this.executeCountdown(rest, context);
			else if (command === "schedule") result = await this.executeSchedule(rest);
			else if (command === "review") result = await this.executeReview(rest);
			else throw new Error(`Unknown command "${commandRaw}". Try task, countdown, schedule, or review.`);

			if (context.saveHistory !== false) {
				await this.recordHistory(trimmed, command, "success", result.message, result.target);
			}
			this.plugin.eventBus.emit("command:executed", { command: trimmed, target: result.target ?? result.message });
			if (shouldNotify) new Notice(`✅ ${result.message}`);
			return { ok: true, command, ...result };
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			if (context.saveHistory !== false) {
				await this.recordHistory(trimmed, command || "command", "failed", message);
			}
			this.plugin.eventBus.emit("command:failed", { command: trimmed, reason: message });
			if (shouldNotify) new Notice(`umOS command: ${message}`);
			return { ok: false, command: command || "command", message };
		}
	}

	private async executeTask(tokens: string[], context: CommandExecutionContext): Promise<InternalCommandResult> {
		const parsed = this.parseTask(tokens);
		if (!parsed.description) throw new Error("Task needs a description after task.");
		const filePath = this.resolveTaskTargetPath(context);
		if (!filePath) throw new Error("Could not determine the task file.");

		const task = new Task("", filePath, 0);
		task.description = parsed.description;
		task.dueDate = parsed.dueDate;
		task.priority = parsed.priority;
		task.tags = parsed.tags;
		const line = await this.taskService.createTask(task, filePath);
		if (line < 0) throw new Error(`Could not add task to ${filePath}.`);
		return {
			message: `Task added: ${parsed.description}`,
			target: filePath,
		};
	}

	private async executeCountdown(tokens: string[], context: CommandExecutionContext): Promise<InternalCommandResult> {
		const parsed = this.parseCountdown(tokens);
		if (!parsed.title) throw new Error("Countdown needs a title.");
		if (!parsed.date) throw new Error("Countdown needs a date: YYYY-MM-DD or YYYY-MM-DD HH:MM.");

		const file = await this.ensureTextTargetFile(context, parsed.target);
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
			createdFile: file.path,
		};
	}

	private async executeSchedule(tokens: string[]): Promise<InternalCommandResult> {
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

	private async executeReview(tokens: string[]): Promise<InternalCommandResult> {
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

	private resolveTaskTargetPath(context: CommandExecutionContext): string | null {
		const config = context.config ?? {};
		if (config.file?.trim()) return config.file.trim();
		const target = String(config.target || config.create_in || "").toLowerCase();
		if ((target === "current" || target === "note") && context.sourcePath) return context.sourcePath;
		return this.getTodayDailyNotePath();
	}

	private async ensureTextTargetFile(
		context: CommandExecutionContext,
		targetOverride?: CommandNoteTarget
	): Promise<TFile> {
		const config = context.config ?? {};
		const target = String(targetOverride || config.target || config.create_in || "").toLowerCase();
		if ((target === "daily" || !context.sourcePath) && !config.file) return this.ensureDailyNote();
		const path = config.file?.trim() || context.sourcePath || this.getTodayDailyNotePath();
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
}
