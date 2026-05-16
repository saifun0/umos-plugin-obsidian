import { Notice, TFile, moment, normalizePath, setIcon } from "obsidian";
import { createElement } from "../utils/dom";
import { COMMAND_HELP_ITEMS, CommandService } from "../input/CommandService";
import type { CommandHistoryItem } from "../settings/Settings";
import { t } from "../i18n";
import type { App } from "obsidian";
import type UmOSPlugin from "../main";
import type { UmOSSettings } from "../settings/Settings";
import type { EventBus } from "../EventBus";
import { parseTaskTagsInput, renderTaskTagField } from "../productivity/tasks/TaskTagAutocomplete";

export type CaptureTab = "task" | "note" | "countdown" | "review" | "command";

type CaptureTaskPriority = "none" | "high" | "medium" | "low";

export interface QuickCaptureInitialState {
	activeTab?: CaptureTab;
	task?: {
		title?: string;
		dueDate?: string;
		priority?: CaptureTaskPriority;
		tags?: string;
	};
}

export interface QuickCaptureOptions {
	initial?: QuickCaptureInitialState;
	onSuccess?: () => void;
}

export interface QuickCaptureContext {
	app: App;
	plugin: UmOSPlugin;
	settings: UmOSSettings;
	eventBus: EventBus;
	initial?: QuickCaptureInitialState;
	onSuccess?: () => void;
}

interface CaptureTabMeta {
	id: CaptureTab;
	label: string;
	icon: string;
}

const TABS: CaptureTabMeta[] = [
	{ id: "task", label: "Task", icon: "check-square" },
	{ id: "note", label: "Note", icon: "file-plus" },
	{ id: "countdown", label: "Countdown", icon: "timer" },
	{ id: "review", label: "Review", icon: "sparkles" },
	{ id: "command", label: "Command", icon: "terminal" },
];

function createField(parent: HTMLElement, label: string, placeholder = ""): HTMLInputElement {
	const wrap = createElement("label", { cls: "umos-capture-field", parent });
	createElement("span", { text: t(label), parent: wrap });
	return wrap.createEl("input", {
		cls: "umos-capture-input",
		attr: { type: "text", placeholder },
	}) as HTMLInputElement;
}

function createTextarea(parent: HTMLElement, label: string, placeholder = ""): HTMLTextAreaElement {
	const wrap = createElement("label", { cls: "umos-capture-field is-wide", parent });
	createElement("span", { text: t(label), parent: wrap });
	return wrap.createEl("textarea", {
		cls: "umos-capture-textarea",
		attr: { placeholder },
	}) as HTMLTextAreaElement;
}

function createSelect(
	parent: HTMLElement,
	label: string,
	options: Array<[string, string]>,
): HTMLSelectElement {
	const wrap = createElement("label", { cls: "umos-capture-field", parent });
	createElement("span", { text: t(label), parent: wrap });
	const select = wrap.createEl("select", { cls: "umos-capture-select" }) as HTMLSelectElement;
	for (const [value, optionLabel] of options) {
		select.createEl("option", { value, text: t(optionLabel) });
	}
	return select;
}

function setFeedback(el: HTMLElement, message: string, ok: boolean): void {
	el.empty();
	el.className = `umos-capture-feedback is-${ok ? "success" : "failed"}`;
	el.textContent = t(message);
}

function sanitizeFileName(title: string): string {
	return title
		.replace(/[\\/:*?"<>|]/g, "-")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 96);
}

async function ensureFolder(ctx: QuickCaptureContext, folderPath: string): Promise<void> {
	const parts = folderPath.split("/").filter(Boolean);
	let current = "";
	for (const part of parts) {
		current = current ? `${current}/${part}` : part;
		if (!ctx.app.vault.getAbstractFileByPath(current)) {
			await ctx.app.vault.createFolder(current);
		}
	}
}

async function getUniquePath(ctx: QuickCaptureContext, path: string): Promise<string> {
	const normalized = normalizePath(path);
	if (!ctx.app.vault.getAbstractFileByPath(normalized)) return normalized;

	const dot = normalized.lastIndexOf(".");
	const base = dot > -1 ? normalized.slice(0, dot) : normalized;
	const ext = dot > -1 ? normalized.slice(dot) : "";
	for (let i = 2; i < 100; i++) {
		const candidate = `${base} ${i}${ext}`;
		if (!ctx.app.vault.getAbstractFileByPath(candidate)) return candidate;
	}
	return `${base} ${Date.now()}${ext}`;
}

async function createQuickNote(ctx: QuickCaptureContext, title: string, folder: string, body: string): Promise<string> {
	const cleanTitle = sanitizeFileName(title) || `Quick note ${moment().format("YYYY-MM-DD HH-mm")}`;
	const cleanFolder = normalizePath(folder.trim() || ctx.settings.homeQuickCaptureDefaultNoteFolder || "10 Inbox");
	await ensureFolder(ctx, cleanFolder);
	const path = await getUniquePath(ctx, `${cleanFolder}/${cleanTitle}.md`);
	const content = [
		"---",
		`created: ${moment().format("YYYY-MM-DD HH:mm")}`,
		"source: umOS quick capture",
		"---",
		"",
		`# ${cleanTitle}`,
		"",
		body.trim(),
		"",
	].join("\n");
	const file = await ctx.app.vault.create(path, content);
	if (file instanceof TFile) {
		await ctx.app.workspace.openLinkText(file.path, file.path, false);
	}
	await recordQuickHistory(ctx, `note ${cleanTitle}`, "note", "success", `Note created: ${cleanTitle}`, path);
	ctx.eventBus.emit("command:executed", { command: `note ${cleanTitle}`, target: path });
	new Notice(`✅ ${t("Note created")}: ${cleanTitle}`);
	return path;
}

async function recordQuickHistory(
	ctx: QuickCaptureContext,
	raw: string,
	command: string,
	status: CommandHistoryItem["status"],
	message: string,
	target?: string,
): Promise<void> {
	const current = ctx.plugin.data_store.commandHistory ?? [];
	ctx.plugin.data_store.commandHistory = [
		{ raw, command, status, message, target, executedAt: Date.now() },
		...current.filter((item) => item.raw !== raw),
	].slice(0, 10);
	await ctx.plugin.saveSettings();
}

function renderSubmit(parent: HTMLElement, label: string, iconName: string): HTMLButtonElement {
	const button = createElement("button", {
		cls: "umos-capture-submit",
		attr: { type: "button" },
		parent,
	});
	const icon = createElement("span", { cls: "umos-capture-submit-icon", parent: button });
	setIcon(icon, iconName);
	createElement("span", { text: t(label), parent: button });
	return button as HTMLButtonElement;
}

function renderHistory(parent: HTMLElement, ctx: QuickCaptureContext, fillCommand?: (raw: string) => void): void {
	const history = (ctx.plugin.data_store.commandHistory ?? []).slice(0, 5);
	if (history.length === 0) return;

	const wrap = createElement("div", { cls: "umos-capture-history", parent });
	createElement("div", { cls: "umos-capture-history-title", text: t("Recent commands"), parent: wrap });
	for (const item of history) {
		const row = createElement("button", {
			cls: `umos-capture-history-item is-${item.status}`,
			attr: { type: "button", title: item.message },
			parent: wrap,
		});
		createElement("span", { cls: "umos-capture-history-command", text: item.command, parent: row });
		createElement("span", { cls: "umos-capture-history-raw", text: item.raw, parent: row });
		row.addEventListener("click", () => fillCommand?.(item.raw));
	}
}

function getInitialDueValue(dueDate?: string): string {
	if (!dueDate) return "";
	if (dueDate === moment().format("YYYY-MM-DD")) return "today";
	if (dueDate === moment().add(1, "day").format("YYYY-MM-DD")) return "tomorrow";
	return dueDate;
}

function getInitialDueDate(dueDate?: string): string {
	const value = getInitialDueValue(dueDate);
	if (value === "today") return moment().format("YYYY-MM-DD");
	if (value === "tomorrow") return moment().add(1, "day").format("YYYY-MM-DD");
	return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function renderTaskForm(
	parent: HTMLElement,
	ctx: QuickCaptureContext,
	feedback: HTMLElement,
	service: CommandService,
	initial: QuickCaptureInitialState["task"] | undefined,
	onSuccess?: () => void,
): void {
	const form = createElement("div", { cls: "umos-capture-form", parent });
	const grid = createElement("div", { cls: "umos-capture-grid", parent: form });
	const title = createField(grid, "Task", "Prepare notes");
	const due = createField(grid, "Due", "YYYY-MM-DD");
	due.type = "date";
	const priority = createSelect(grid, "Priority", [["none", "None"], ["high", "High"], ["medium", "Medium"], ["low", "Low"]]);
	const tagsWrap = createElement("div", { cls: "umos-capture-field umos-capture-tag-field", parent: grid });
	createElement("span", { text: t("Tags"), parent: tagsWrap });
	const tagController = renderTaskTagField(tagsWrap, ctx.app, {
		initialTags: parseTaskTagsInput(initial?.tags ?? ""),
		placeholder: t("Add tag…"),
	});
	const button = renderSubmit(form, "Add task", "plus");

	if (initial?.title) title.value = initial.title;
	const initialDueValue = getInitialDueDate(initial?.dueDate);
	if (initialDueValue) due.value = initialDueValue;
	if (initial?.priority) priority.value = initial.priority;

	button.addEventListener("click", async () => {
		const description = title.value.trim();
		if (!description) {
			setFeedback(feedback, "Task title is required.", false);
			return;
		}
		const parts = ["task", description];
		if (due.value) parts.push(due.value);
		if (priority.value && priority.value !== "none") parts.push(`!${priority.value}`);
		const cleanTags = tagController.getTags().map((tag) => `#${tag}`);
		parts.push(...cleanTags);

		button.disabled = true;
		const result = await service.execute(parts.join(" "), { notify: true });
		button.disabled = false;
		setFeedback(feedback, result.message, result.ok);
		if (result.ok) {
			title.value = "";
			onSuccess?.();
		}
	});
}

function renderNoteForm(parent: HTMLElement, ctx: QuickCaptureContext, feedback: HTMLElement): void {
	const form = createElement("div", { cls: "umos-capture-form", parent });
	const grid = createElement("div", { cls: "umos-capture-grid", parent: form });
	const title = createField(grid, "Title", "Quick thought");
	const folder = createField(grid, "Folder", ctx.settings.homeQuickCaptureDefaultNoteFolder || "10 Inbox");
	folder.value = ctx.settings.homeQuickCaptureDefaultNoteFolder || "10 Inbox";
	const body = createTextarea(grid, "Body", "Write it before it disappears.");
	const button = renderSubmit(form, "Create note", "file-plus");

	button.addEventListener("click", async () => {
		button.disabled = true;
		try {
			const path = await createQuickNote(ctx, title.value, folder.value, body.value);
			setFeedback(feedback, `Note created: ${path}`, true);
			title.value = "";
			body.value = "";
		} catch (error) {
			setFeedback(feedback, error instanceof Error ? error.message : String(error), false);
		} finally {
			button.disabled = false;
		}
	});
}

function renderCountdownForm(parent: HTMLElement, feedback: HTMLElement, service: CommandService): void {
	const form = createElement("div", { cls: "umos-capture-form", parent });
	const grid = createElement("div", { cls: "umos-capture-grid", parent: form });
	const title = createField(grid, "Title", "Exam session");
	const date = createField(grid, "Date", "2026-07-01");
	const time = createField(grid, "Time", "09:00");
	const accent = createField(grid, "Accent", "#27ae60");
	accent.value = "#27ae60";
	const view = createSelect(grid, "View", [["focus", "Focus"], ["full", "Full"], ["minimal", "Minimal"]]);
	const button = renderSubmit(form, "Add countdown", "timer");

	button.addEventListener("click", async () => {
		const cleanTitle = title.value.trim();
		const cleanDate = date.value.trim();
		if (!cleanTitle || !cleanDate) {
			setFeedback(feedback, "Countdown needs a title and date.", false);
			return;
		}
		const parts = ["countdown", cleanTitle, cleanDate];
		if (time.value.trim()) parts.push(time.value.trim());
		if (accent.value.trim()) parts.push(`accent:${accent.value.trim()}`);
		parts.push(`view:${view.value}`, "target:daily");

		button.disabled = true;
		const result = await service.execute(parts.join(" "), { notify: true });
		button.disabled = false;
		setFeedback(feedback, result.message, result.ok);
		if (result.ok) title.value = "";
	});
}

function renderReviewForm(parent: HTMLElement, feedback: HTMLElement, service: CommandService): void {
	const form = createElement("div", { cls: "umos-capture-form", parent });
	const grid = createElement("div", { cls: "umos-capture-grid", parent: form });
	const key = createSelect(grid, "Review field", [
		["win", "Win"],
		["lesson", "Lesson"],
		["tomorrow", "Tomorrow"],
		["weekly_win", "Weekly win"],
		["weekly_friction", "Weekly friction"],
		["weekly_next", "Weekly next"],
	]);
	const text = createTextarea(grid, "Text", "What should be remembered?");
	const button = renderSubmit(form, "Save review", "sparkles");

	button.addEventListener("click", async () => {
		const value = text.value.trim();
		if (!value) {
			setFeedback(feedback, "Review text is required.", false);
			return;
		}
		button.disabled = true;
		const result = await service.execute(`review ${key.value} ${value}`, { notify: true });
		button.disabled = false;
		setFeedback(feedback, result.message, result.ok);
		if (result.ok) text.value = "";
	});
}

function renderCommandForm(parent: HTMLElement, ctx: QuickCaptureContext, feedback: HTMLElement, service: CommandService): void {
	const form = createElement("div", { cls: "umos-capture-form", parent });
	const row = createElement("div", { cls: "umos-command-input", parent: form });
	const input = row.createEl("input", {
		cls: "umos-command-input-field",
		attr: { type: "text", placeholder: "task Prepare notes tomorrow #study !high" },
	}) as HTMLInputElement;
	const button = row.createEl("button", {
		cls: "umos-command-input-button",
		text: t("Run"),
		attr: { type: "button" },
	});

	const run = async () => {
		const raw = input.value.trim();
		if (!raw) return;
		button.disabled = true;
		const result = await service.execute(raw, { notify: true });
		button.disabled = false;
		setFeedback(feedback, result.message, result.ok);
		if (result.ok) input.value = "";
	};

	button.addEventListener("click", () => void run());
	input.addEventListener("keydown", (event) => {
		if (event.key === "Enter") {
			event.preventDefault();
			void run();
		}
	});

	const help = createElement("div", { cls: "umos-command-help", parent: form });
	for (const item of COMMAND_HELP_ITEMS) {
		const pill = createElement("button", {
			cls: "umos-command-help-pill",
			text: item.example,
			attr: { type: "button" },
			parent: help,
		});
		pill.addEventListener("click", () => {
			input.value = item.example;
			input.focus();
		});
	}

	renderHistory(form, ctx, (raw) => {
		input.value = raw;
		input.focus();
	});
}

export function renderQuickCaptureSection(parent: HTMLElement, ctx: QuickCaptureContext): void {
	const section = createElement("div", {
		cls: "umos-home-section umos-home-section-anim umos-capture-section",
		parent,
	});

	const head = createElement("div", { cls: "umos-home-compact-head", parent: section });
	const titleWrap = createElement("div", { cls: "umos-home-compact-title-wrap", parent: head });
	const icon = createElement("span", { cls: "umos-home-compact-icon", parent: titleWrap });
	setIcon(icon, "wand-sparkles");
	createElement("div", { cls: "umos-home-section-title", text: t("Quick Capture"), parent: titleWrap });
	createElement("div", {
		cls: "umos-home-compact-subtitle",
		text: t("Forms for fast capture, plus the command center."),
		parent: section,
	});

	const tabs = createElement("div", { cls: "umos-capture-tabs", parent: section });
	const body = createElement("div", { cls: "umos-capture-body", parent: section });
	const feedback = createElement("div", { cls: "umos-capture-feedback", parent: section });
	const service = new CommandService(ctx.plugin);
	let active: CaptureTab = ctx.initial?.activeTab ?? "task";

	const renderBody = () => {
		body.empty();
		for (const tabButton of Array.from(tabs.querySelectorAll("button"))) {
			tabButton.classList.toggle("is-active", tabButton.getAttribute("data-tab") === active);
		}
		if (active === "task") renderTaskForm(body, ctx, feedback, service, ctx.initial?.task, ctx.onSuccess);
		else if (active === "note") renderNoteForm(body, ctx, feedback);
		else if (active === "countdown") renderCountdownForm(body, feedback, service);
		else if (active === "review") renderReviewForm(body, feedback, service);
		else renderCommandForm(body, ctx, feedback, service);
	};

	for (const tab of TABS) {
		const button = createElement("button", {
			cls: `umos-capture-tab${tab.id === active ? " is-active" : ""}`,
			attr: { type: "button", "data-tab": tab.id },
			parent: tabs,
		});
		const tabIcon = createElement("span", { cls: "umos-capture-tab-icon", parent: button });
		setIcon(tabIcon, tab.icon);
		createElement("span", { text: t(tab.label), parent: button });
		button.addEventListener("click", () => {
			active = tab.id;
			renderBody();
		});
	}

	renderBody();
}
