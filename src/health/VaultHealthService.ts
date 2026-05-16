import { App, TFile, moment, normalizePath } from "obsidian";
import type UmOSPlugin from "../main";
import { TaskService } from "../productivity/tasks/TaskService";
import { Task } from "../productivity/tasks/Task";

export type VaultHealthSeverity = "critical" | "warning" | "info";
export type VaultHealthIssueKind =
	| "broken-link"
	| "orphan-image"
	| "daily-note"
	| "task-date"
	| "content-metadata";

export interface VaultHealthIssue {
	id: string;
	kind: VaultHealthIssueKind;
	severity: VaultHealthSeverity;
	title: string;
	detail: string;
	filePath?: string;
	action?: "open-file";
}

export interface VaultHealthSummary {
	total: number;
	critical: number;
	warning: number;
	info: number;
	brokenLinks: number;
	orphanImages: number;
	dailyNotes: number;
	tasksWithoutDates: number;
	contentMetadata: number;
}

export interface VaultHealthScanResult {
	scannedAt: number;
	issues: VaultHealthIssue[];
	summary: VaultHealthSummary;
}

export interface VaultHealthScanOptions {
	lookbackDays?: number;
	maxIssuesPerKind?: number;
}

const IMAGE_EXTENSIONS = new Set(["avif", "bmp", "gif", "jpeg", "jpg", "png", "svg", "webp"]);
const COVER_FIELDS = ["cover", "image", "poster", "thumbnail", "banner"];
const TYPE_FIELDS = ["type", "content_type", "category"];

export class VaultHealthService {
	private taskService: TaskService;

	constructor(
		private app: App,
		private plugin: UmOSPlugin,
	) {
		this.taskService = new TaskService(app, plugin);
	}

	async scan(options: VaultHealthScanOptions = {}): Promise<VaultHealthScanResult> {
		const maxIssuesPerKind = Math.max(1, Math.floor(options.maxIssuesPerKind ?? 8));
		const summary: VaultHealthSummary = {
			total: 0,
			critical: 0,
			warning: 0,
			info: 0,
			brokenLinks: 0,
			orphanImages: 0,
			dailyNotes: 0,
			tasksWithoutDates: 0,
			contentMetadata: 0,
		};
		const issues: VaultHealthIssue[] = [];
		const perKind = new Map<VaultHealthIssueKind, number>();

		const addIssue = (issue: VaultHealthIssue) => {
			summary.total++;
			summary[issue.severity]++;
			this.incrementSummaryKind(summary, issue.kind);

			const current = perKind.get(issue.kind) ?? 0;
			if (current >= maxIssuesPerKind) return;
			perKind.set(issue.kind, current + 1);
			issues.push(issue);
		};

		this.scanBrokenLinks(addIssue);
		await this.scanOrphanImages(addIssue);
		await this.scanDailyNotes(addIssue, Math.max(1, Math.floor(options.lookbackDays ?? 7)));
		await this.scanTasksWithoutDates(addIssue);
		this.scanContentMetadata(addIssue);

		return {
			scannedAt: Date.now(),
			issues,
			summary,
		};
	}

	private scanBrokenLinks(addIssue: (issue: VaultHealthIssue) => void): void {
		const metadata = this.app.metadataCache as unknown as {
			unresolvedLinks?: Record<string, Record<string, number>>;
		};
		const unresolved = metadata.unresolvedLinks ?? {};

		for (const [sourcePath, links] of Object.entries(unresolved)) {
			for (const [linkPath, count] of Object.entries(links)) {
				addIssue({
					id: `broken-link:${sourcePath}:${linkPath}`,
					kind: "broken-link",
					severity: "critical",
					title: "Broken link",
					detail: `${linkPath}${count > 1 ? ` (${count})` : ""}`,
					filePath: sourcePath,
					action: "open-file",
				});
			}
		}
	}

	private async scanOrphanImages(addIssue: (issue: VaultHealthIssue) => void): Promise<void> {
		const images = this.app.vault.getFiles().filter((file) => IMAGE_EXTENSIONS.has(file.extension.toLowerCase()));
		if (images.length === 0) return;

		const references = await this.collectImageReferences();
		for (const image of images) {
			if (this.isImageReferenced(image, references)) continue;
			addIssue({
				id: `orphan-image:${image.path}`,
				kind: "orphan-image",
				severity: "info",
				title: "Orphan image",
				detail: image.path,
				filePath: image.path,
				action: "open-file",
			});
		}
	}

	private async collectImageReferences(): Promise<Set<string>> {
		const references = new Set<string>();
		const markdownFiles = this.app.vault.getMarkdownFiles();

		for (const file of markdownFiles) {
			let content = "";
			try {
				content = await this.app.vault.cachedRead(file);
			} catch {
				continue;
			}

			for (const match of content.matchAll(/!\[\[([^\]]+)]]/g)) {
				this.addReferenceVariants(references, match[1]);
			}
			for (const match of content.matchAll(/!\[[^\]]*]\(([^)]+)\)/g)) {
				this.addReferenceVariants(references, match[1]);
			}

			const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
			for (const key of COVER_FIELDS) {
				const value = frontmatter[key];
				if (typeof value === "string") this.addReferenceVariants(references, value);
			}
		}

		return references;
	}

	private addReferenceVariants(references: Set<string>, raw: string): void {
		const cleaned = raw
			.replace(/^</, "")
			.replace(/>$/, "")
			.split("|")[0]
			.split("#")[0]
			.trim();
		if (!cleaned) return;

		let decoded = cleaned;
		try {
			decoded = decodeURIComponent(cleaned);
		} catch {
			decoded = cleaned;
		}
		const normalized = normalizePath(decoded).toLowerCase();
		references.add(normalized);
		references.add(normalized.split("/").pop() ?? normalized);
	}

	private isImageReferenced(file: TFile, references: Set<string>): boolean {
		const path = normalizePath(file.path).toLowerCase();
		const name = file.name.toLowerCase();
		return references.has(path) || references.has(name);
	}

	private async scanDailyNotes(addIssue: (issue: VaultHealthIssue) => void, lookbackDays: number): Promise<void> {
		for (let offset = 0; offset < lookbackDays; offset++) {
			const date = moment().subtract(offset, "day");
			const dateISO = date.format("YYYY-MM-DD");
			const path = this.getDailyNotePath(date);
			const file = this.app.vault.getAbstractFileByPath(path);

			if (!(file instanceof TFile)) {
				addIssue({
					id: `daily-note:missing:${dateISO}`,
					kind: "daily-note",
					severity: offset === 0 ? "critical" : "warning",
					title: offset === 0 ? "Daily note not created" : "Daily note missing",
					detail: path,
					filePath: path,
				});
				continue;
			}

			try {
				const content = await this.app.vault.cachedRead(file);
				const withoutFrontmatter = content.replace(/^---[\s\S]*?---/, "").trim();
				if (withoutFrontmatter.length < 10) {
					addIssue({
						id: `daily-note:empty:${dateISO}`,
						kind: "daily-note",
						severity: offset === 0 ? "warning" : "info",
						title: offset === 0 ? "Daily note is empty" : "Daily note looks empty",
						detail: path,
						filePath: path,
						action: "open-file",
					});
				}
			} catch {
				addIssue({
					id: `daily-note:read:${dateISO}`,
					kind: "daily-note",
					severity: "warning",
					title: "Could not read daily note",
					detail: path,
					filePath: path,
					action: "open-file",
				});
			}
		}
	}

	private async scanTasksWithoutDates(addIssue: (issue: VaultHealthIssue) => void): Promise<void> {
		const tasks = await this.taskService.getFlatTasksWithQuery({});
		const activeWithoutDates = tasks.filter((task) =>
			task.status !== "done" &&
			task.status !== "cancelled" &&
			!task.dueDate &&
			!task.scheduledDate &&
			!task.startDate
		);

		for (const task of activeWithoutDates) {
			addIssue({
				id: `task-date:${task.filePath}:${task.lineNumber}`,
				kind: "task-date",
				severity: "warning",
				title: "Task without date",
				detail: this.getTaskTitle(task),
				filePath: task.filePath,
				action: "open-file",
			});
		}
	}

	private scanContentMetadata(addIssue: (issue: VaultHealthIssue) => void): void {
		for (const type of this.plugin.settings.contentTypes ?? []) {
			const folder = normalizePath(type.folder || "").replace(/\/+$/, "");
			if (!folder) continue;

			const files = this.app.vault.getMarkdownFiles().filter((file) => {
				const path = normalizePath(file.path);
				return path === `${folder}.md` || path.startsWith(`${folder}/`);
			});

			for (const file of files) {
				const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
				const hasCover = COVER_FIELDS.some((key) => this.hasFrontmatterValue(frontmatter[key]));
				const hasType = TYPE_FIELDS.some((key) => this.hasFrontmatterValue(frontmatter[key]));
				if (hasCover && hasType) continue;

				const missing = [
					hasCover ? "" : "cover",
					hasType ? "" : "type",
				].filter(Boolean).join(" + ");

				addIssue({
					id: `content-metadata:${file.path}:${missing}`,
					kind: "content-metadata",
					severity: "info",
					title: "Content metadata missing",
					detail: `${file.path} · ${missing}`,
					filePath: file.path,
					action: "open-file",
				});
			}
		}
	}

	private getDailyNotePath(date: ReturnType<typeof moment>): string {
		const fileName = date.format(this.plugin.settings.dailyNoteFormat || "YYYY-MM-DD");
		return normalizePath(`${this.plugin.settings.dailyNotesPath}/${fileName}.md`);
	}

	private getTaskTitle(task: Task): string {
		return task.description.trim() || "Untitled task";
	}

	private hasFrontmatterValue(value: unknown): boolean {
		if (Array.isArray(value)) return value.length > 0;
		if (typeof value === "string") return value.trim().length > 0;
		return value !== undefined && value !== null && value !== false;
	}

	private incrementSummaryKind(summary: VaultHealthSummary, kind: VaultHealthIssueKind): void {
		if (kind === "broken-link") summary.brokenLinks++;
		else if (kind === "orphan-image") summary.orphanImages++;
		else if (kind === "daily-note") summary.dailyNotes++;
		else if (kind === "task-date") summary.tasksWithoutDates++;
		else if (kind === "content-metadata") summary.contentMetadata++;
	}
}
