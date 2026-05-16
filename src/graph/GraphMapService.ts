import { App, Notice, TAbstractFile, TFile, TFolder, normalizePath } from "obsidian";
import type UmOSPlugin from "../main";
import { t } from "../i18n";

interface GraphMapArea {
	id: string;
	title: string;
	root: string;
	mapPath: string;
	description: string;
}

interface GraphMapGroup {
	title: string;
	files: TFile[];
}

interface ImageIndexCaption {
	path: string;
	caption: string;
}

export interface GraphMapBuildResult {
	updated: number;
	unchanged: number;
	files: string[];
}

export interface FrontmatterSimplifyResult {
	changed: number;
	scanned: number;
}

const GENERATED_BY = "umos";
const LOGO_PATH = "00 Files/branding/umos-logo.png";
const DEFAULT_ARCHIVE_ROOT = "50 Archive";
const DEFAULT_RESOURCES_ROOT = "40 Resources";
const DEFAULT_STUDY_ROOT = "45 Study";
const DEFAULT_SYSTEM_ROOTS = ["00 Files", "05 Dashboards", "10 Inbox"];
const IMAGE_EXTENSIONS = new Set(["avif", "bmp", "gif", "jpeg", "jpg", "png", "svg", "webp"]);

const DUPLICATE_TAG_PREFIXES = ["area/", "status/", "topic/", "type/", "graph/"];
const DUPLICATE_TAGS = new Set(["project", "content", "resource", "study", "archive", "daily", "map"]);

export class GraphMapService {
	constructor(
		private app: App,
		private plugin: UmOSPlugin,
	) {}

	async rebuildMaps(showNotice = false): Promise<GraphMapBuildResult> {
		const areas = this.getAreas();
		const files: string[] = [];
		let updated = 0;
		let unchanged = 0;

		await this.ensureFolder(this.getMapsRoot());

		const indexResult = await this.writeIfChanged(this.getGraphIndexPath(), this.renderGraphIndex(areas));
		files.push(this.getGraphIndexPath());
		if (indexResult) updated++;
		else unchanged++;

		for (const area of areas) {
			const content = this.renderAreaMap(area);
			const didUpdate = await this.writeIfChanged(area.mapPath, content);
			files.push(area.mapPath);
			if (didUpdate) updated++;
			else unchanged++;
		}

		if (this.shouldBuildImageIndex()) {
			const imageIndexPath = this.getImageIndexPath();
			const didUpdate = await this.writeIfChanged(imageIndexPath, await this.renderImageIndex(imageIndexPath));
			files.push(imageIndexPath);
			if (didUpdate) updated++;
			else unchanged++;
		}

		if (showNotice) {
			new Notice(t("Generated indexes updated"));
		}

		return { updated, unchanged, files };
	}

	async simplifyGraphMetadata(showNotice = false): Promise<FrontmatterSimplifyResult> {
		let scanned = 0;
		let changed = 0;

		for (const file of this.app.vault.getMarkdownFiles()) {
			if (this.shouldIgnoreFile(file)) continue;
			const cachedFrontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined;
			if (!this.isManagedMapPath(file.path) && !cachedFrontmatter) continue;
			scanned++;
			const beforePreview = this.cloneFrontmatter(cachedFrontmatter ?? {});
			const afterPreview = this.cloneFrontmatter(cachedFrontmatter ?? {});
			this.simplifyFrontmatter(file, afterPreview);
			if (JSON.stringify(beforePreview) === JSON.stringify(afterPreview)) continue;
			let touched = false;
			await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
				const before = JSON.stringify(this.cloneFrontmatter(frontmatter));
				this.simplifyFrontmatter(file, frontmatter);
				touched = before !== JSON.stringify(this.cloneFrontmatter(frontmatter));
			});
			if (touched) changed++;
		}

		if (showNotice) {
			new Notice(`${t("Frontmatter simplified")}: ${changed}/${scanned}`);
		}

		return { changed, scanned };
	}

	getManagedPaths(): Set<string> {
		const paths = Array.from(this.getGraphMapPaths());
		if (this.shouldBuildImageIndex()) paths.push(this.getImageIndexPath());
		return new Set(paths);
	}

	isManagedMapPath(path: string): boolean {
		return this.getManagedPaths().has(normalizePath(path));
	}

	private renderGraphIndex(areas: GraphMapArea[]): string {
		const lines = [
			...this.renderMapFrontmatter(),
			"# Graph Index",
			"",
			`![[${LOGO_PATH}|160]]`,
			"",
			t("Main vault map for Obsidian Graph View. Open the local graph from this note and use depth 2."),
			"",
			"## Core maps",
			"",
			...areas.map((area) => `- [[${this.stripMd(area.mapPath)}|${area.title}]]`),
			"",
			"## Useful graph filters",
			"",
			...areas.map((area) => `- \`path:"${area.root}"\` — ${area.description}`),
			"",
		];
		return lines.join("\n");
	}

	private renderAreaMap(area: GraphMapArea): string {
		const groups = this.collectGroups(area);
		const lines = [
			...this.renderMapFrontmatter(),
			`# ${area.title}`,
			"",
			`![[${LOGO_PATH}|72]]`,
			"",
			`[[${this.stripMd(this.getGraphIndexPath())}|Graph Index]]`,
			"",
		];

		if (groups.length === 0) {
			lines.push(`_${t("No notes found for this map.")}_`, "");
			return lines.join("\n");
		}

		for (const group of groups) {
			lines.push(`## ${group.title}`, "");
			for (const file of group.files) {
				lines.push(`- [[${this.stripMd(file.path)}|${file.basename}]]`);
			}
			lines.push("");
		}

		return lines.join("\n");
	}

	private async renderImageIndex(path: string): Promise<string> {
		const captions = await this.collectExistingImageCaptions(path);
		const groups = this.collectImageGroups();
		const lines = [
			...this.renderImageIndexFrontmatter(),
			`# ${t("Image Index")}`,
			"",
			t("Managed image index. Add a caption after the pipe in an image embed to describe it."),
			"",
		];

		if (groups.length === 0) {
			lines.push(`_${t("No images found.")}_`, "");
			return lines.join("\n");
		}

		for (const group of groups) {
			lines.push(`## ${group.title}`, "");
			for (const file of group.files) {
				const caption = captions.get(file.path) ?? "";
				lines.push(`- ${this.renderImageEmbed(file.path, caption)}`);
			}
			lines.push("");
		}

		return lines.join("\n");
	}

	private renderMapFrontmatter(): string[] {
		return [
			"---",
			"type: map",
			`generated: ${GENERATED_BY}`,
			"---",
			"",
		];
	}

	private renderImageIndexFrontmatter(): string[] {
		return [
			"---",
			"type: media-index",
			`generated: ${GENERATED_BY}`,
			"---",
			"",
		];
	}

	private collectGroups(area: GraphMapArea): GraphMapGroup[] {
		if (area.id === "system") {
			return this.collectSystemGroups();
		}

		const root = this.app.vault.getAbstractFileByPath(area.root);
		if (!(root instanceof TFolder)) return [];

		const groups = new Map<string, TFile[]>();
		const files = this.collectMarkdownFiles(root)
			.filter((file) => !this.shouldIgnoreFile(file))
			.filter((file) => !this.isGraphMapOutputPath(file.path));

		for (const file of files) {
			const group = this.getFirstFolderAfterRoot(file.path, area.root) || `${file.basename}.md`;
			if (!groups.has(group)) groups.set(group, []);
			groups.get(group)?.push(file);
		}

		return this.sortGroups(groups);
	}

	private collectSystemGroups(): GraphMapGroup[] {
		const groups = new Map<string, TFile[]>();
		for (const rootPath of DEFAULT_SYSTEM_ROOTS) {
			const root = this.app.vault.getAbstractFileByPath(rootPath);
			if (!(root instanceof TFolder)) continue;
			const files = this.collectMarkdownFiles(root)
				.filter((file) => !this.shouldIgnoreFile(file))
				.filter((file) => !this.isGraphMapOutputPath(file.path));
			if (files.length > 0) groups.set(rootPath, files);
		}
		return this.sortGroups(groups);
	}

	private collectImageGroups(): GraphMapGroup[] {
		const groups = new Map<string, TFile[]>();
		const files = this.app.vault.getFiles()
			.filter((file) => IMAGE_EXTENSIONS.has(file.extension.toLowerCase()))
			.filter((file) => !this.shouldIgnoreFile(file))
			.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));

		for (const file of files) {
			const folder = this.getFolderPath(file.path) || t("Vault root");
			if (!groups.has(folder)) groups.set(folder, []);
			groups.get(folder)?.push(file);
		}

		return this.sortGroups(groups);
	}

	private collectMarkdownFiles(folder: TFolder): TFile[] {
		const files: TFile[] = [];
		const walk = (node: TFolder) => {
			for (const child of node.children) {
				if (child instanceof TFolder) {
					walk(child);
				} else if (child instanceof TFile && child.extension.toLowerCase() === "md") {
					files.push(child);
				}
			}
		};
		walk(folder);
		return files.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
	}

	private sortGroups(groups: Map<string, TFile[]>): GraphMapGroup[] {
		return Array.from(groups.entries())
			.map(([title, files]) => ({
				title,
				files: files.sort((a, b) => a.basename.localeCompare(b.basename, undefined, { numeric: true })),
			}))
			.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }));
	}

	private simplifyFrontmatter(file: TFile, frontmatter: Record<string, unknown>): void {
		if (this.isImageIndexPath(file.path)) {
			for (const key of Object.keys(frontmatter)) delete frontmatter[key];
			frontmatter.type = "media-index";
			frontmatter.generated = GENERATED_BY;
			return;
		}

		if (this.isGraphMapOutputPath(file.path)) {
			for (const key of Object.keys(frontmatter)) delete frontmatter[key];
			frontmatter.type = "map";
			frontmatter.generated = GENERATED_BY;
			return;
		}

		const inferredArea = this.inferArea(file.path);
		const inferredContentType = this.inferContentType(file.path);
		const cleanArea = this.cleanValue(frontmatter.area);
		const cleanClassification = this.cleanValue(frontmatter.classification);
		const cleanContentType = this.cleanValue(frontmatter.content_type ?? frontmatter.contentType);
		const cleanTopic = this.cleanValue(frontmatter.topic);

		if (cleanArea && inferredArea && this.sameToken(cleanArea, inferredArea)) delete frontmatter.area;
		if (cleanClassification === "active") delete frontmatter.classification;
		if (cleanClassification === "archived" && inferredArea === "archive") delete frontmatter.classification;
		if (cleanContentType && inferredContentType && this.sameToken(cleanContentType, inferredContentType)) {
			delete frontmatter.content_type;
			delete frontmatter.contentType;
		}
		if (cleanTopic && this.isRedundantTopic(cleanTopic, file.path, inferredArea, inferredContentType)) {
			delete frontmatter.topic;
		}

		this.simplifyTags(frontmatter);
	}

	private simplifyTags(frontmatter: Record<string, unknown>): void {
		const rawTags = this.readTags(frontmatter.tags);
		if (rawTags.length === 0) {
			delete frontmatter.tags;
			return;
		}

		const cleanTags = rawTags
			.map((tag) => tag.replace(/^#/, "").trim())
			.filter(Boolean)
			.filter((tag) => !this.isRedundantTag(tag));

		const unique = Array.from(new Set(cleanTags));
		if (unique.length > 0) frontmatter.tags = unique;
		else delete frontmatter.tags;
	}

	private readTags(value: unknown): string[] {
		if (Array.isArray(value)) return value.map(String);
		if (typeof value === "string") return value.split(/[,\s]+/);
		return [];
	}

	private cloneFrontmatter(frontmatter: Record<string, unknown>): Record<string, unknown> {
		const clone: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(frontmatter)) {
			if (key === "position") continue;
			clone[key] = Array.isArray(value) ? [...value] : value;
		}
		return clone;
	}

	private isRedundantTag(tag: string): boolean {
		const clean = tag.toLowerCase();
		if (DUPLICATE_TAGS.has(clean)) return true;
		return DUPLICATE_TAG_PREFIXES.some((prefix) => clean.startsWith(prefix));
	}

	private isRedundantTopic(topic: string, path: string, inferredArea: string, inferredContentType: string): boolean {
		const tokens = [
			inferredArea,
			inferredContentType,
			this.getFirstFolderAfterRoot(path, this.getAreaRootForPath(path)),
			this.slugify(this.getFirstFolderAfterRoot(path, this.getAreaRootForPath(path))),
			this.slugify(path.split("/").pop()?.replace(/\.md$/i, "") ?? ""),
			"daily",
			"graph",
		].filter(Boolean);
		return tokens.some((token) => this.sameToken(topic, token));
	}

	private inferArea(path: string): string {
		const clean = normalizePath(path);
		if (clean.startsWith(`${this.plugin.settings.homeProjectsPath || "20 Projects"}/`)) return "projects";
		if (clean.startsWith(`${this.plugin.settings.homeContentPath || "30 Content"}/`)) return "content";
		if (clean.startsWith(`${DEFAULT_RESOURCES_ROOT}/`)) return "resources";
		if (clean.startsWith(`${DEFAULT_STUDY_ROOT}/`)) return "study";
		if (clean.startsWith(`${this.getJournalRoot()}/`)) return "journal";
		if (clean.startsWith(`${DEFAULT_ARCHIVE_ROOT}/`)) return "archive";
		if (clean.startsWith("05 Dashboards/") || clean.startsWith("00 Files/") || clean.startsWith("10 Inbox/")) return "system";
		return "";
	}

	private inferContentType(path: string): string {
		const contentRoot = this.plugin.settings.homeContentPath || "30 Content";
		if (!normalizePath(path).startsWith(`${contentRoot}/`)) return "";
		const folder = this.getFirstFolderAfterRoot(path, contentRoot);
		if (!folder) return "";
		const type = (this.plugin.settings.contentTypes ?? []).find((item) => this.sameToken(item.folder, folder));
		return type?.key ?? this.slugify(folder);
	}

	private getAreas(): GraphMapArea[] {
		const mapsRoot = this.getMapsRoot();
		const projectsRoot = this.plugin.settings.homeProjectsPath || "20 Projects";
		const contentRoot = this.plugin.settings.homeContentPath || "30 Content";
		const journalRoot = this.getJournalRoot();
		return [
			{ id: "projects", title: "Projects Map", root: projectsRoot, mapPath: `${mapsRoot}/Projects Map.md`, description: t("Project notes and active work.") },
			{ id: "content", title: "Content Map", root: contentRoot, mapPath: `${mapsRoot}/Content Map.md`, description: t("Media and content library.") },
			{ id: "resources", title: "Resources Map", root: DEFAULT_RESOURCES_ROOT, mapPath: `${mapsRoot}/Resources Map.md`, description: t("Reusable references and materials.") },
			{ id: "study", title: "Study Map", root: DEFAULT_STUDY_ROOT, mapPath: `${mapsRoot}/Study Map.md`, description: t("Study notes, labs, and courses.") },
			{ id: "journal", title: "Journal Map", root: journalRoot, mapPath: `${mapsRoot}/Journal Map.md`, description: t("Daily notes and journal material.") },
			{ id: "archive", title: "Archive Map", root: DEFAULT_ARCHIVE_ROOT, mapPath: `${mapsRoot}/Archive Map.md`, description: t("Archived notes.") },
			{ id: "system", title: "System Map", root: "05 Dashboards", mapPath: `${mapsRoot}/System Map.md`, description: t("Dashboards, files, and inbox notes.") },
		].map((area) => ({ ...area, mapPath: normalizePath(area.mapPath) }));
	}

	private getAreaRootForPath(path: string): string {
		const area = this.getAreas().find((item) => item.id !== "system" && normalizePath(path).startsWith(`${item.root}/`));
		return area?.root ?? "";
	}

	private getJournalRoot(): string {
		const dailyPath = normalizePath(this.plugin.settings.dailyNotesPath || "11 Journal/Daily");
		return dailyPath.split("/")[0] || "11 Journal";
	}

	private getGraphIndexPath(): string {
		return normalizePath(`${this.plugin.settings.graphMapsRootPath || "05 Dashboards"}/Graph Index.md`);
	}

	private getMapsRoot(): string {
		return normalizePath(this.plugin.settings.graphMapsMapsPath || "05 Dashboards/Maps");
	}

	private getImageIndexPath(): string {
		return normalizePath(this.plugin.settings.graphMapsImageIndexPath || "00 Files/Image Index.md");
	}

	private shouldBuildImageIndex(): boolean {
		return this.plugin.settings.graphMapsIncludeImageIndex !== false;
	}

	private getGraphMapPaths(): Set<string> {
		return new Set([this.getGraphIndexPath(), ...this.getAreas().map((area) => area.mapPath)]);
	}

	private isGraphMapOutputPath(path: string): boolean {
		return this.getGraphMapPaths().has(normalizePath(path));
	}

	private isImageIndexPath(path: string): boolean {
		return normalizePath(path) === this.getImageIndexPath();
	}

	private shouldIgnoreFile(file: TFile): boolean {
		const path = normalizePath(file.path);
		if (path.startsWith(".obsidian/")) return true;
		if (path.startsWith("99 Trash/")) return true;
		if (path.startsWith(".trash/")) return true;
		if (path.startsWith("_umos-sync/") || path.startsWith(".umos-sync/")) return true;
		return false;
	}

	private async collectExistingImageCaptions(path: string): Promise<Map<string, string>> {
		const captions = new Map<string, string>();
		const indexFile = this.app.vault.getAbstractFileByPath(normalizePath(path));
		if (!(indexFile instanceof TFile)) return captions;

		const content = await this.app.vault.cachedRead(indexFile);
		const wikiRegex = /!\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g;
		let match: RegExpExecArray | null;
		while ((match = wikiRegex.exec(content)) !== null) {
			const entry = this.parseImageIndexCaption(match[1], match[2] ?? "");
			if (entry) captions.set(entry.path, entry.caption);
		}
		return captions;
	}

	private parseImageIndexCaption(rawPath: string, rawCaption: string): ImageIndexCaption | null {
		const path = this.normalizeImageRefPath(rawPath);
		if (!path) return null;
		return {
			path,
			caption: rawCaption.trim(),
		};
	}

	private normalizeImageRefPath(rawPath: string): string {
		const clean = rawPath
			.trim()
			.replace(/^<|>$/g, "")
			.replace(/^["']|["']$/g, "")
			.split("?")[0]
			.split("#")[0];
		if (!clean) return "";
		try {
			return normalizePath(decodeURIComponent(clean));
		} catch {
			return normalizePath(clean);
		}
	}

	private renderImageEmbed(path: string, caption: string): string {
		const cleanCaption = caption
			.replace(/\]/g, "")
			.replace(/\r?\n/g, " ")
			.replace(/\s+/g, " ")
			.trim();
		return cleanCaption ? `![[${path}|${cleanCaption}]]` : `![[${path}]]`;
	}

	private getFirstFolderAfterRoot(path: string, root: string): string {
		const cleanRoot = normalizePath(root).replace(/\/+$/, "");
		if (!cleanRoot) return "";
		const cleanPath = normalizePath(path);
		if (!cleanPath.startsWith(`${cleanRoot}/`)) return "";
		const rest = cleanPath.slice(cleanRoot.length + 1);
		const first = rest.split("/")[0] ?? "";
		return first.replace(/\.md$/i, "");
	}

	private stripMd(path: string): string {
		return normalizePath(path).replace(/\.md$/i, "");
	}

	private getFolderPath(path: string): string {
		const clean = normalizePath(path);
		const index = clean.lastIndexOf("/");
		return index >= 0 ? clean.slice(0, index) : "";
	}

	private cleanValue(value: unknown): string {
		return typeof value === "string" ? value.trim() : "";
	}

	private sameToken(left: string, right: string): boolean {
		return this.slugify(left) === this.slugify(right);
	}

	private slugify(value: string | undefined): string {
		return String(value ?? "")
			.toLowerCase()
			.replace(/^\[\[/, "")
			.replace(/\]\]$/, "")
			.split("|")[0]
			.split("/")
			.pop()
			?.replace(/\.md$/i, "")
			.replace(/[_\s]+/g, "-")
			.replace(/[^\p{L}\p{N}-]+/gu, "")
			.replace(/-+/g, "-")
			.replace(/^-|-$/g, "") ?? "";
	}

	private async writeIfChanged(path: string, content: string): Promise<boolean> {
		const normalized = normalizePath(path);
		await this.ensureFolder(normalized.includes("/") ? normalized.slice(0, normalized.lastIndexOf("/")) : "");
		const existing = this.app.vault.getAbstractFileByPath(normalized);
		if (existing instanceof TFile) {
			const current = await this.app.vault.cachedRead(existing);
			if (current === content) return false;
			await this.app.vault.modify(existing, content);
			return true;
		}
		await this.app.vault.create(normalized, content);
		return true;
	}

	private async ensureFolder(folder: string): Promise<void> {
		const clean = normalizePath(folder).replace(/^\/+|\/+$/g, "");
		if (!clean) return;
		const parts = clean.split("/").filter(Boolean);
		let current = "";
		for (const part of parts) {
			current = current ? `${current}/${part}` : part;
			const existing: TAbstractFile | null = this.app.vault.getAbstractFileByPath(current);
			if (!existing) await this.app.vault.createFolder(current);
		}
	}
}
