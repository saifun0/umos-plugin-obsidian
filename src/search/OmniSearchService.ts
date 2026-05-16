import { App, TFile, TFolder } from "obsidian";
import type UmOSPlugin from "../main";
import { COMMAND_HELP_ITEMS } from "../input/CommandService";
import { UMOS_SYNC_ICON_ID } from "../branding";
import type { ContentTypeDefinition } from "../settings/Settings";
import { widgetConfigToMarkdown } from "../dashboard/WidgetRegistry";
import { TaskService } from "../productivity/tasks/TaskService";
import type { Task } from "../productivity/tasks/Task";

export type OmniSearchKind =
	| "task"
	| "project"
	| "image"
	| "content"
	| "setting"
	| "command"
	| "widget"
	| "file";

export type OmniSearchAction =
	| { type: "open-file"; path: string; line?: number }
	| { type: "plugin-command"; commandId: string }
	| { type: "open-settings"; section?: string }
	| { type: "execute-command"; raw: string }
	| { type: "fill-query"; raw: string }
	| { type: "copy-text"; text: string; message: string };

export interface OmniSearchResult {
	id: string;
	kind: OmniSearchKind;
	title: string;
	subtitle: string;
	detail?: string;
	path?: string;
	icon: string;
	badges?: string[];
	thumbnail?: string;
	accent?: string;
	searchText?: string;
	bodyText?: string;
	score?: number;
	action: OmniSearchAction;
}

const IMAGE_EXTENSIONS = new Set(["avif", "bmp", "gif", "jpeg", "jpg", "png", "svg", "webp"]);
const COMMAND_PREFIX = ">";
const EXECUTABLE_COMMANDS = new Set(COMMAND_HELP_ITEMS.map((item) => item.cmd));

const KIND_WEIGHT: Record<OmniSearchKind, number> = {
	command: 90,
	task: 80,
	project: 76,
	content: 72,
	image: 68,
	setting: 64,
	widget: 58,
	file: 34,
};

const PLUGIN_COMMANDS: Array<{
	id: string;
	title: string;
	detail: string;
	icon: string;
}> = [
	{ id: "umos:omni-search", title: "Better Search", detail: "Search tasks, projects, images, content, settings, commands, and widgets.", icon: "search" },
	{ id: "umos:open-home", title: "Open Home", detail: "Open the umOS home dashboard.", icon: "umos-logo" },
	{ id: "umos:task-calendar", title: "Task Calendar", detail: "Open the task calendar view.", icon: "calendar-check" },
	{ id: "umos:image-gallery", title: "Image Gallery", detail: "Open the image gallery view.", icon: "images" },
	{ id: "umos:triage-center", title: "Inbox / Triage Center", detail: "Review quick notes, undated tasks, untyped files, images without descriptions, and capture records.", icon: "inbox" },
	{ id: "umos:quick-capture", title: "Quick Capture", detail: "Open fast capture for tasks, notes, countdowns, reviews, and commands.", icon: "wand-sparkles" },
	{ id: "umos:focus-session", title: "Focus Session", detail: "Start or resume a focused work session.", icon: "timer" },
	{ id: "umos:sync-center", title: "Sync Center", detail: "Preview and run vault sync.", icon: UMOS_SYNC_ICON_ID },
	{ id: "umos:vault-sync", title: "Vault Sync", detail: "Run the configured vault sync mode.", icon: UMOS_SYNC_ICON_ID },
	{ id: "umos:vault-sync-dry-run", title: "Vault Sync Dry Run", detail: "Preview sync changes without writing files.", icon: "scan-search" },
	{ id: "umos:vault-sync-pull", title: "Vault Sync Pull", detail: "Pull the remote vault state to this device.", icon: "download" },
	{ id: "umos:vault-sync-push", title: "Vault Sync Push", detail: "Push this vault state to the remote provider.", icon: "upload" },
	{ id: "umos:create-daily", title: "Create Daily Note", detail: "Create or open today's daily note.", icon: "calendar" },
	{ id: "umos:dashboard-studio", title: "Dashboard Studio", detail: "Build and edit dashboard profiles.", icon: "layout-dashboard" },
	{ id: "umos:format-picker", title: "Text Formatting", detail: "Open the formatting picker.", icon: "pilcrow" },
	{ id: "umos:refresh-api-data", title: "Force-refresh all API data", detail: "Refresh weather and prayer API data.", icon: "refresh-cw" },
	{ id: "umos:next-prayer", title: "Next prayer", detail: "Show the next prayer and remaining time.", icon: "moon" },
];

const SETTINGS_RESULTS: Array<{
	section: string;
	title: string;
	detail: string;
	icon: string;
}> = [
	{ section: "general", title: "General", detail: "Language, profile, appearance, sidebar GIF, and infobox behavior.", icon: "settings-2" },
	{ section: "home", title: "Home & Daily", detail: "Home dashboard, daily note template, habits, and visible metrics.", icon: "home" },
	{ section: "tasks", title: "Tasks & Calendar", detail: "Task calendar sources, default view, week layout, and visible states.", icon: "calendar-check" },
	{ section: "capture", title: "Quick Capture", detail: "Fast forms and command input for capture workflows.", icon: "wand-sparkles" },
	{ section: "prayer", title: "Prayer & Location", detail: "Prayer calculation, status bar display, linked note, and saved locations.", icon: "moon" },
	{ section: "study", title: "Study", detail: "Schedule and school grid parameters.", icon: "book-open" },
	{ section: "content", title: "Content Gallery", detail: "Media/content types, folders, fields, icons, and progress rules.", icon: "boxes" },
	{ section: "dashboard", title: "Dashboard Studio", detail: "Dashboard profiles, presets, preview, note generation, and diagnostics.", icon: "layout-dashboard" },
	{ section: "vault", title: "Vault & Data", detail: "Data sync, JSON tools, demo notes, alerts, health, and vault setup.", icon: "database" },
];

export class OmniSearchService {
	constructor(
		private app: App,
		private plugin: UmOSPlugin,
	) {}

	async buildIndex(): Promise<OmniSearchResult[]> {
		const [tasks] = await Promise.all([
			this.collectTasks(),
		]);
		const projects = this.collectProjects();
		const contentItems = this.collectContentItems();
		const images = this.collectImages();
		const noteTextByPath = await this.collectNoteTextByPath();
		const entityPaths = new Set(
			[...projects, ...contentItems, ...images]
				.map((result) => result.path)
				.filter((path): path is string => Boolean(path)),
		);

		const index = [
			...this.collectCommands(),
			...tasks,
			...projects,
			...contentItems,
			...images,
			...this.collectSettings(),
			...this.collectWidgets(),
			...this.collectFiles(entityPaths, noteTextByPath),
		];

		return index.map((result) => this.enrichWithNoteText(result, noteTextByPath));
	}

	search(index: OmniSearchResult[], query: string, kind: OmniSearchKind | "all" = "all"): OmniSearchResult[] {
		const commandMode = parseCommandMode(query);
		if (commandMode) {
			return this.searchCommandMode(index, commandMode, kind);
		}

		const normalized = normalizeSearchText(query);
		const terms = normalized.split(/\s+/).filter(Boolean);
		const filtered = kind === "all" ? index : index.filter((result) => result.kind === kind);

		if (terms.length === 0) {
			return filtered
				.map((result) => ({ ...result, score: KIND_WEIGHT[result.kind] }))
				.sort((a, b) => this.compareResults(a, b))
				.slice(0, 60);
		}

		return filtered
			.map((result) => ({ ...result, score: this.scoreResult(result, terms, normalized) }))
			.filter((result) => (result.score ?? 0) > 0)
			.map((result) => this.withQueryContext(result, terms, normalized))
			.sort((a, b) => this.compareResults(a, b))
			.slice(0, 80);
	}

	private compareResults(a: OmniSearchResult, b: OmniSearchResult): number {
		const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
		if (scoreDiff !== 0) return scoreDiff;
		const kindDiff = KIND_WEIGHT[b.kind] - KIND_WEIGHT[a.kind];
		if (kindDiff !== 0) return kindDiff;
		return a.title.localeCompare(b.title);
	}

	private searchCommandMode(
		index: OmniSearchResult[],
		commandMode: CommandModeQuery,
		kind: OmniSearchKind | "all"
	): OmniSearchResult[] {
		if (kind !== "all" && kind !== "command") return [];
		const dynamic = this.createCommandModeResults(index, commandMode);
		const commandIndex = index.filter((result) => result.kind === "command");
		const terms = normalizeSearchText(commandMode.raw || "command").split(/\s+/).filter(Boolean);
		const indexed = commandIndex
			.map((result) => ({ ...result, score: this.scoreResult(result, terms, commandMode.normalizedRaw) }))
			.filter((result) => (result.score ?? 0) > 0);
		return [...dynamic, ...indexed]
			.sort((a, b) => this.compareResults(a, b))
			.slice(0, 80);
	}

	private scoreResult(result: OmniSearchResult, terms: string[], fullQuery: string): number {
		const title = normalizeSearchText(result.title);
		const subtitle = normalizeSearchText(result.subtitle);
		const detail = normalizeSearchText(result.detail ?? "");
		const path = normalizeSearchText(result.path ?? "");
		const badges = normalizeSearchText((result.badges ?? []).join(" "));
		const searchText = normalizeSearchText(result.searchText ?? "");
		const haystack = `${title} ${subtitle} ${detail} ${path} ${badges} ${searchText}`;
		if (!terms.every((term) => haystack.includes(term))) return 0;

		let score = KIND_WEIGHT[result.kind];
		if (result.id.startsWith("run-command:")) score += 180;
		if (title === fullQuery) score += 130;
		else if (title.startsWith(fullQuery)) score += 95;
		else if (title.includes(fullQuery)) score += 70;
		if (subtitle.includes(fullQuery)) score += 25;
		if (path.includes(fullQuery)) score += 18;
		if (searchText.includes(fullQuery)) score += 10;
		score += Math.max(0, 40 - title.length / 3);
		return score;
	}

	private createCommandModeResults(index: OmniSearchResult[], commandMode: CommandModeQuery): OmniSearchResult[] {
		const results: OmniSearchResult[] = [];
		const raw = commandMode.raw;
		const firstToken = commandMode.command;
		const matchingCommands = COMMAND_HELP_ITEMS.filter((item) => !firstToken || item.cmd.startsWith(firstToken));

		if (!firstToken || !EXECUTABLE_COMMANDS.has(firstToken)) {
			for (const item of matchingCommands.length > 0 ? matchingCommands : COMMAND_HELP_ITEMS) {
				results.push(this.commandGuideResult(item, firstToken ? "Complete command name" : "Type a command after >"));
			}
			return results;
		}

		const definition = COMMAND_HELP_ITEMS.find((item) => item.cmd === firstToken);
		if (!definition) return results;

		if (commandMode.args.trim()) {
			results.push({
				id: `run-command:${raw}`,
				kind: "command",
				title: `${COMMAND_PREFIX} ${raw}`,
				subtitle: "Run command",
				detail: definition.usage,
				icon: "play",
				badges: [definition.cmd, "run"],
				score: 300,
				action: { type: "execute-command", raw },
			});
		}

		results.push(this.commandExampleResult(definition, 260));
		results.push(...this.commandTokenResults(index, definition, commandMode));
		return results;
	}

	private commandGuideResult(item: (typeof COMMAND_HELP_ITEMS)[number], detail: string): OmniSearchResult {
		return {
			id: `command-guide:${item.cmd}`,
			kind: "command",
			title: `${COMMAND_PREFIX} ${item.cmd}`,
			subtitle: item.title,
			detail: `${detail} - ${item.usage}`,
			icon: "terminal",
			badges: ["autocomplete", item.cmd],
			score: 280,
			action: { type: "fill-query", raw: `${COMMAND_PREFIX} ${item.cmd} ` },
		};
	}

	private commandExampleResult(item: (typeof COMMAND_HELP_ITEMS)[number], score = 220): OmniSearchResult {
		return {
			id: `command-example-live:${item.cmd}`,
			kind: "command",
			title: `${COMMAND_PREFIX} ${item.example}`,
			subtitle: "Command example",
			detail: `${item.description} - ${item.usage}`,
			icon: "terminal",
			badges: [item.cmd, "example"],
			score,
			action: { type: "fill-query", raw: `${COMMAND_PREFIX} ${item.example}` },
		};
	}

	private commandTokenResults(
		index: OmniSearchResult[],
		definition: (typeof COMMAND_HELP_ITEMS)[number],
		commandMode: CommandModeQuery
	): OmniSearchResult[] {
		const suggestions = [...definition.tokens];
		if (definition.cmd === "task") {
			for (const tag of this.collectKnownTags(index)) {
				suggestions.push({ value: `#${tag}`, detail: "Existing tag" });
			}
		}

		const current = commandMode.currentToken.toLowerCase();
		return suggestions
			.filter((item) => !current || item.value.toLowerCase().startsWith(current))
			.slice(0, 18)
			.map((item, index) => ({
				id: `command-token:${definition.cmd}:${item.value}`,
				kind: "command" as const,
				title: item.value,
				subtitle: "Autocomplete",
				detail: item.detail,
				icon: "corner-down-right",
				badges: [definition.cmd, "insert"],
				score: 240 - index,
				action: {
					type: "fill-query" as const,
					raw: replaceCurrentCommandToken(commandMode, item.value),
				},
			}));
	}

	private collectKnownTags(index: OmniSearchResult[]): string[] {
		const tags = new Set<string>();
		for (const result of index) {
			for (const badge of result.badges ?? []) {
				if (badge.startsWith("#") && badge.length > 1) {
					tags.add(badge.slice(1));
				}
			}
		}
		return Array.from(tags).sort((a, b) => a.localeCompare(b));
	}

	private withQueryContext(result: OmniSearchResult, terms: string[], normalizedQuery: string): OmniSearchResult {
		if (!result.bodyText || terms.length === 0) return result;

		const structural = normalizeSearchText([
			result.title,
			result.subtitle,
			result.detail ?? "",
			result.path ?? "",
			(result.badges ?? []).join(" "),
		].join(" "));
		if (terms.every((term) => structural.includes(term))) return result;

		const match = findBodyMatch(result.bodyText, terms, normalizedQuery);
		if (!match) return result;
		return {
			...result,
			subtitle: "Text match",
			detail: match.snippet,
			action: result.action.type === "open-file"
				? { ...result.action, line: match.line }
				: result.action,
		};
	}

	private async collectTasks(): Promise<OmniSearchResult[]> {
		try {
			const service = new TaskService(this.app, this.plugin);
			const tasks = await service.getFlatTasksWithQuery({
				path: this.plugin.settings.taskCalendarTaskPaths,
			});
			return tasks.map((task) => this.taskToResult(task));
		} catch (error) {
			console.error("umOS: search task indexing failed", error);
			return [];
		}
	}

	private taskToResult(task: Task): OmniSearchResult {
		const badges = [
			task.status,
			task.priority !== "none" ? task.priority : "",
			task.dueDate ? `due ${task.dueDate}` : "",
			...task.tags.map((tag) => `#${tag}`),
		].filter(Boolean);
		return {
			id: `task:${task.filePath}:${task.lineNumber}`,
			kind: "task",
			title: task.description || "Untitled task",
			subtitle: "Markdown task",
			detail: task.filePath,
			path: task.filePath,
			icon: task.status === "done" ? "check-circle-2" : task.status === "doing" ? "circle-dot" : "circle",
			badges,
			action: { type: "open-file", path: task.filePath, line: task.lineNumber },
		};
	}

	private collectCommands(): OmniSearchResult[] {
		const pluginCommands = PLUGIN_COMMANDS.map((command) => ({
			id: `command:${command.id}`,
			kind: "command" as const,
			title: command.title,
			subtitle: "Plugin command",
			detail: command.detail,
			icon: command.icon,
			badges: ["run"],
			action: { type: "plugin-command" as const, commandId: command.id },
		}));

		const commandExamples = COMMAND_HELP_ITEMS.map((item) => ({
			id: `command-example:${item.cmd}`,
			kind: "command" as const,
			title: `${COMMAND_PREFIX} ${item.example}`,
			subtitle: "Command example",
			detail: `${item.description} - ${item.usage}`,
			icon: "terminal",
			badges: [item.cmd, "insert"],
			searchText: `${item.cmd} ${item.title} ${item.description} ${item.usage} ${item.example}`,
			action: { type: "fill-query" as const, raw: `${COMMAND_PREFIX} ${item.example}` },
		}));

		const history = (this.plugin.data_store.commandHistory ?? []).slice(0, 10).map((item) => ({
			id: `command-history:${item.executedAt}:${item.raw}`,
			kind: "command" as const,
			title: `${COMMAND_PREFIX} ${item.raw}`,
			subtitle: "Recent command",
			detail: item.message,
			icon: item.status === "success" ? "history" : "circle-alert",
			badges: [item.command || "command", item.status],
			action: { type: "fill-query" as const, raw: `${COMMAND_PREFIX} ${item.raw}` },
		}));

		return [...pluginCommands, ...history, ...commandExamples];
	}

	private collectSettings(): OmniSearchResult[] {
		return SETTINGS_RESULTS.map((setting) => ({
			id: `setting:${setting.section}`,
			kind: "setting" as const,
			title: setting.title,
			subtitle: "Settings section",
			detail: setting.detail,
			icon: setting.icon,
			badges: ["settings"],
			action: { type: "open-settings" as const, section: setting.section },
		}));
	}

	private collectWidgets(): OmniSearchResult[] {
		return this.plugin.widgetRegistry.getAll().map((definition) => {
			const snippet = definition.snippets?.[0]?.config ?? definition.defaults;
			return {
				id: `widget:${definition.blockName}`,
				kind: "widget" as const,
				title: definition.title,
				subtitle: "Widget block",
				detail: `${definition.blockName} - ${definition.description}`,
				icon: "blocks",
				badges: [definition.blockName, `${definition.snippets?.length ?? 0} presets`],
				action: {
					type: "copy-text" as const,
					text: widgetConfigToMarkdown(definition.blockName, snippet),
					message: "Widget block copied",
				},
			};
		});
	}

	private collectImages(): OmniSearchResult[] {
		return this.app.vault.getFiles()
			.filter((file) => IMAGE_EXTENSIONS.has(file.extension.toLowerCase()))
			.map((file) => ({
				id: `image:${file.path}`,
				kind: "image" as const,
				title: file.name,
				subtitle: "Vault image",
				detail: `${file.parent?.path || "Vault root"} - ${formatBytes(file.stat.size)}`,
				path: file.path,
				icon: "image",
				thumbnail: this.app.vault.getResourcePath(file),
				badges: [file.extension.toUpperCase(), formatBytes(file.stat.size)],
				action: { type: "open-file" as const, path: file.path },
			}));
	}

	private collectContentItems(): OmniSearchResult[] {
		const root = this.plugin.settings.homeContentPath || "30 Content";
		const results: OmniSearchResult[] = [];
		for (const type of this.plugin.settings.contentTypes ?? []) {
			const folder = this.app.vault.getAbstractFileByPath(`${root}/${type.folder}`);
			if (folder instanceof TFolder) {
				this.collectContentFromFolder(folder, type, results);
			}
		}
		return results;
	}

	private collectContentFromFolder(folder: TFolder, type: ContentTypeDefinition, results: OmniSearchResult[]): void {
		for (const child of folder.children) {
			if (child instanceof TFolder) {
				this.collectContentFromFolder(child, type, results);
				continue;
			}
			if (!(child instanceof TFile) || child.extension !== "md") continue;
			const fm = this.app.metadataCache.getFileCache(child)?.frontmatter;
			if (!fm) continue;
			const title = String(fm.title || child.basename);
			const status = String(fm.status || "plan");
			const rating = Number(fm.rating ?? 0);
			const cover = this.resolveCover(fm);
			results.push({
				id: `content:${child.path}`,
				kind: "content",
				title,
				subtitle: "Content item",
				detail: `${type.icon} ${type.label} - ${status}${rating ? ` - ${rating}/10` : ""}`,
				path: child.path,
				icon: "boxes",
				thumbnail: cover,
				accent: type.color,
				badges: [type.label, status, rating ? `${rating}/10` : ""].filter(Boolean),
				action: { type: "open-file", path: child.path },
			});
		}
	}

	private collectProjects(): OmniSearchResult[] {
		const root = this.plugin.settings.homeProjectsPath || "20 Projects";
		const rootFolder = this.app.vault.getAbstractFileByPath(root);
		if (!(rootFolder instanceof TFolder)) return [];

		const results: OmniSearchResult[] = [];
		for (const child of rootFolder.children) {
			if (!(child instanceof TFolder)) continue;
			const file = this.findProjectFile(child);
			if (!file) continue;
			const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
			if (!fm) continue;
			const title = String(fm.title || file.basename);
			const status = String(fm.status || "plan");
			const priority = String(fm.priority || "");
			const deadline = String(fm.deadline || "");
			results.push({
				id: `project:${file.path}`,
				kind: "project",
				title,
				subtitle: "Project note",
				detail: [status, priority, deadline ? `deadline ${deadline}` : "", String(fm.description || "")].filter(Boolean).join(" - "),
				path: file.path,
				icon: "rocket",
				thumbnail: this.resolveCover(fm),
				accent: String(fm.color || "#3498db"),
				badges: [status, priority, deadline].filter(Boolean),
				action: { type: "open-file", path: file.path },
			});
		}
		return results;
	}

	private collectFiles(
		entityPaths: Set<string>,
		noteTextByPath: Map<string, { text: string; title: string; titleLine: number }>
	): OmniSearchResult[] {
		return this.app.vault.getMarkdownFiles()
			.filter((file) => !entityPaths.has(file.path))
			.map((file) => {
				const noteText = noteTextByPath.get(file.path);
				return {
					id: `file:${file.path}`,
					kind: "file" as const,
					title: noteText?.title || file.basename,
					subtitle: "Vault note",
					detail: file.path,
					path: file.path,
					icon: "file-text",
					badges: [file.parent?.path || "Vault root"],
					searchText: noteText?.text,
					bodyText: noteText?.text,
					action: { type: "open-file" as const, path: file.path, line: noteText?.titleLine ?? 0 },
				};
			});
	}

	private findProjectFile(folder: TFolder): TFile | null {
		const markdown = folder.children.filter((child): child is TFile => child instanceof TFile && child.extension === "md");
		return markdown.find((file) => file.basename === folder.name)
			?? markdown.find((file) => file.basename.toLowerCase() === "index")
			?? markdown[0]
			?? null;
	}

	private resolveCover(fm: Record<string, unknown>): string | undefined {
		const raw = String(fm.cover_url || fm.cover || fm.image || fm.poster || "").trim();
		if (!raw) return undefined;
		if (/^https?:\/\//i.test(raw)) return raw;
		const clean = raw
			.replace(/^!?\[\[/, "")
			.replace(/\]\]$/, "")
			.replace(/^!?\[.*?\]\(/, "")
			.replace(/\)$/, "");
		const file = this.app.vault.getAbstractFileByPath(clean)
			|| this.app.metadataCache.getFirstLinkpathDest(clean, "");
		return file instanceof TFile ? this.app.vault.getResourcePath(file) : undefined;
	}

	private async collectNoteTextByPath(): Promise<Map<string, { text: string; title: string; titleLine: number }>> {
		const entries = await Promise.all(this.app.vault.getMarkdownFiles().map(async (file) => {
			try {
				const content = await this.app.vault.cachedRead(file);
				const fmTitle = this.app.metadataCache.getFileCache(file)?.frontmatter?.title;
				const lines = content.split(/\r?\n/);
				const headingLine = lines.findIndex((line) => /^#\s+/.test(line));
				const heading = headingLine >= 0 ? lines[headingLine].replace(/^#\s+/, "").trim() : "";
				const title = String(fmTitle || heading || file.basename);
				return [file.path, { text: content, title, titleLine: headingLine >= 0 ? headingLine : 0 }] as const;
			} catch {
				return [file.path, { text: "", title: file.basename, titleLine: 0 }] as const;
			}
		}));
		return new Map(entries);
	}

	private enrichWithNoteText(
		result: OmniSearchResult,
		noteTextByPath: Map<string, { text: string; title: string; titleLine: number }>
	): OmniSearchResult {
		if (!result.path) return result;
		const noteText = noteTextByPath.get(result.path);
		if (!noteText) return result;
		return {
			...result,
			searchText: `${result.searchText ?? ""} ${noteText.title} ${noteText.text}`.trim(),
			bodyText: noteText.text,
			action: result.action.type === "open-file" && result.action.line === undefined
				? { ...result.action, line: noteText.titleLine }
				: result.action,
		};
	}
}

interface CommandModeQuery {
	original: string;
	raw: string;
	normalizedRaw: string;
	command: string;
	args: string;
	currentToken: string;
	beforeCurrent: string;
	trailingSpace: boolean;
}

function parseCommandMode(query: string): CommandModeQuery | null {
	const trimmedStart = query.trimStart();
	if (!trimmedStart.startsWith(COMMAND_PREFIX)) return null;
	const body = trimmedStart.slice(COMMAND_PREFIX.length).trimStart();
	const raw = body.trim();
	const tokens = body.split(/\s+/).filter(Boolean);
	const command = (tokens[0] ?? "").toLowerCase();
	const trailingSpace = /\s$/.test(body);
	const args = tokens.slice(1).join(" ");
	const currentToken = tokens.length <= 1 || trailingSpace ? "" : tokens[tokens.length - 1] ?? "";
	const beforeTokens = currentToken ? tokens.slice(0, -1) : tokens;
	return {
		original: query,
		raw,
		normalizedRaw: normalizeSearchText(raw),
		command,
		args,
		currentToken,
		beforeCurrent: beforeTokens.join(" "),
		trailingSpace,
	};
}

function replaceCurrentCommandToken(commandMode: CommandModeQuery, value: string): string {
	const body = commandMode.beforeCurrent
		? `${commandMode.beforeCurrent} ${value}`
		: value;
	const suffix = value.endsWith(":") ? "" : " ";
	return `${COMMAND_PREFIX} ${body}${suffix}`;
}

function normalizeSearchText(value: string): string {
	return value
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/ё/g, "е")
		.trim();
}

function formatBytes(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
	const units = ["B", "KB", "MB", "GB"];
	let size = bytes;
	let index = 0;
	while (size >= 1024 && index < units.length - 1) {
		size /= 1024;
		index++;
	}
	return `${size >= 10 || index === 0 ? Math.round(size) : size.toFixed(1)} ${units[index]}`;
}

function findBodyMatch(
	bodyText: string,
	terms: string[],
	normalizedQuery: string
): { snippet: string; line: number } | null {
	const lines = bodyText.split(/\r?\n/);
	const query = normalizedQuery.trim();
	let bestIndex = -1;

	if (query) {
		bestIndex = lines.findIndex((line) => normalizeSearchText(line).includes(query));
	}
	if (bestIndex === -1) {
		bestIndex = lines.findIndex((line) => {
			const normalizedLine = normalizeSearchText(line);
			return terms.some((term) => normalizedLine.includes(term));
		});
	}
	if (bestIndex === -1) return null;

	const rawLine = lines[bestIndex].replace(/^#+\s*/, "").replace(/\s+/g, " ").trim();
	const snippet = rawLine.length > 160 ? `${rawLine.slice(0, 157)}...` : rawLine;
	return {
		snippet: snippet || "Text match",
		line: bestIndex,
	};
}
