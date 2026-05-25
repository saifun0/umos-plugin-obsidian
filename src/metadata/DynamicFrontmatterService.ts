import { App, Notice, TFile, TAbstractFile, normalizePath } from "obsidian";
import type UmOSPlugin from "../main";
import { t } from "../i18n";

export class DynamicFrontmatterService {
	constructor(
		private app: App,
		private plugin: UmOSPlugin,
	) {}

	/**
	 * Process all markdown files in the vault to enforce dynamic frontmatter
	 */
	async syncAllFiles(showNotice = false): Promise<void> {
		const files = this.app.vault.getMarkdownFiles();
		let updated = 0;

		for (const file of files) {
			if (this.shouldIgnoreFile(file)) continue;

			const didUpdate = await this.processFile(file);
			if (didUpdate) updated++;
		}

		if (showNotice) {
			new Notice(t(`Dynamic Frontmatter synced: ${updated} files updated.`));
		}
	}

	async handleRename(file: TAbstractFile, oldPath: string): Promise<void> {
		if (file instanceof TFile && file.extension === "md") {
			await this.processFile(file);
		}
	}

	/**
	 * Evaluate and update the frontmatter of a single file.
	 * @returns true if the file was modified, false otherwise.
	 */
	async processFile(file: TFile): Promise<boolean> {
		if (this.shouldIgnoreFile(file)) return false;

		const expectedType = this.inferType(file.path);
		const expectedTopic = this.inferTopic(file.path);

		let touched = false;

		await this.app.fileManager.processFrontMatter(file, (fm) => {
			// Deep clone to check for changes
			const beforeStr = JSON.stringify(this.cloneFrontmatter(fm));

			// Remove old hardcoded fields if they exist
			delete fm.area;
			delete fm.classification;
			delete fm.content_type;
			delete fm.contentType;

			if (expectedType) {
				fm.type = expectedType;
			} else {
				delete fm.type;
			}

			if (expectedTopic) {
				fm.topic = expectedTopic;
			} else {
				delete fm.topic;
			}

			const afterStr = JSON.stringify(this.cloneFrontmatter(fm));
			if (beforeStr !== afterStr) {
				touched = true;
			}
		});

		return touched;
	}

	private inferType(path: string): string | null {
		const clean = normalizePath(path);
		
		const projectsRoot = this.plugin.settings.homeProjectsPath || "20 Projects";
		const contentRoot = this.plugin.settings.homeContentPath || "30 Content";
		const resourcesRoot = "40 Resources";
		const studyRoot = "45 Study";
		const archiveRoot = "50 Archive";
		const journalRoot = this.getJournalRoot();

		// 30 Content
		if (clean.startsWith(`${contentRoot}/`)) {
			const folder = this.getFirstFolderAfterRoot(path, contentRoot);
			if (!folder) return "content"; // Root of content
			const typeDef = (this.plugin.settings.contentTypes ?? []).find(
				(item) => this.slugify(item.folder) === this.slugify(folder)
			);
			return typeDef?.key ?? this.slugify(folder);
		}

		// Other standard areas
		if (clean.startsWith(`${projectsRoot}/`)) return "project";
		if (clean.startsWith(`${resourcesRoot}/`)) return "resource";
		if (clean.startsWith(`${studyRoot}/`)) return "study";
		if (clean.startsWith(`${journalRoot}/`)) return "journal";
		if (clean.startsWith(`${archiveRoot}/`)) return "archive";
		
		// System paths
		if (clean.startsWith("05 Dashboards/") || clean.startsWith("00 Files/") || clean.startsWith("10 Inbox/")) {
			return "system";
		}

		return null; // Don't enforce type on unknown paths
	}

	private inferTopic(path: string): string | null {
		const clean = normalizePath(path);
		const rootFolder = this.getAreaRootForPath(clean);
		if (!rootFolder) return null;

		const topicFolder = this.getFirstFolderAfterRoot(clean, rootFolder);
		if (!topicFolder) return null;

		return topicFolder;
	}

	private getAreaRootForPath(path: string): string | null {
		const clean = normalizePath(path);
		const projectsRoot = this.plugin.settings.homeProjectsPath || "20 Projects";
		const contentRoot = this.plugin.settings.homeContentPath || "30 Content";
		const resourcesRoot = "40 Resources";
		const studyRoot = "45 Study";
		const archiveRoot = "50 Archive";
		const journalRoot = this.getJournalRoot();

		const roots = [projectsRoot, contentRoot, resourcesRoot, studyRoot, archiveRoot, journalRoot];
		
		for (const root of roots) {
			if (clean.startsWith(`${root}/`)) {
				return root;
			}
		}

		return null;
	}

	private getJournalRoot(): string {
		const dailyPath = normalizePath(this.plugin.settings.dailyNotesPath || "11 Journal/Daily");
		return dailyPath.split("/")[0] || "11 Journal";
	}

	private getFirstFolderAfterRoot(path: string, root: string): string | null {
		const cleanRoot = normalizePath(root).replace(/\/+$/, "");
		if (!cleanRoot) return null;
		
		const cleanPath = normalizePath(path);
		if (!cleanPath.startsWith(`${cleanRoot}/`)) return null;
		
		const rest = cleanPath.slice(cleanRoot.length + 1);
		if (!rest || !rest.includes("/")) return null; // It's a file in the root directory

		const first = rest.split("/")[0];
		return first || null;
	}

	private shouldIgnoreFile(file: TFile): boolean {
		const path = normalizePath(file.path);
		if (path.startsWith(".obsidian/")) return true;
		if (path.startsWith("99 Trash/")) return true;
		if (path.startsWith(".trash/")) return true;
		if (path.startsWith("_umos-sync/") || path.startsWith(".umos-sync/")) return true;
		
		// Ignore automatically generated Maps & Indexes
		const mapsRoot = normalizePath(this.plugin.settings.graphMapsMapsPath || "05 Dashboards/Maps");
		if (path.startsWith(`${mapsRoot}/`)) return true;
		
		const graphIndex = normalizePath(`${this.plugin.settings.graphMapsRootPath || "05 Dashboards"}/Graph Index.md`);
		if (path === graphIndex) return true;

		const imageIndex = normalizePath(this.plugin.settings.graphMapsImageIndexPath || "00 Files/Image Index.md");
		if (path === imageIndex) return true;

		return false;
	}

	private cloneFrontmatter(frontmatter: Record<string, unknown>): Record<string, unknown> {
		const clone: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(frontmatter)) {
			clone[key] = Array.isArray(value) ? [...value] : value;
		}
		return clone;
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
}
