import {
	App,
	EventRef,
	ItemView,
	MarkdownView,
	Modal,
	Notice,
	TFile,
	WorkspaceLeaf,
	moment,
	normalizePath,
	setIcon,
} from "obsidian";
import type UmOSPlugin from "../main";
import type { CommandHistoryItem, TriageResolvedItem } from "../settings/Settings";
import { t } from "../i18n";
import { Task } from "../productivity/tasks/Task";
import { TaskService } from "../productivity/tasks/TaskService";

export const TRIAGE_CENTER_VIEW_TYPE = "umos-triage-center-view";

type TriageKind = "all" | "task" | "note" | "image" | "file" | "capture";
type TriageSeverity = "high" | "medium" | "low";

interface TriageItem {
	id: string;
	kind: Exclude<TriageKind, "all">;
	severity: TriageSeverity;
	title: string;
	subtitle: string;
	detail: string;
	reason: string;
	icon: string;
	accent: string;
	updatedAt: number;
	path?: string;
	line?: number;
	file?: TFile;
	task?: Task;
	capture?: CommandHistoryItem;
}

interface ProjectOption {
	label: string;
	path: string;
}

type TriageClassificationPresetId = "project" | "content" | "resource" | "study" | "archive" | "custom";

interface TriageClassificationInput {
	type: string;
	area: string;
	classification: string;
	topic: string;
	project: string;
	contentType: string;
	tags: string;
	destinationFolder: string;
	moveFile: boolean;
	markTriaged: boolean;
}

interface TriageClassificationPreset {
	id: TriageClassificationPresetId;
	label: string;
	icon: string;
	description: string;
	destinationFolder: string;
	values: Partial<TriageClassificationInput>;
}

interface TriageSuggestion {
	name: string;
	count: number;
}

interface TriageClassificationSuggestions {
	folders: TriageSuggestion[];
	type: TriageSuggestion[];
	area: TriageSuggestion[];
	classification: TriageSuggestion[];
	topic: TriageSuggestion[];
	project: TriageSuggestion[];
	contentType: TriageSuggestion[];
	tags: TriageSuggestion[];
}

const IMAGE_EXTENSIONS = new Set(["avif", "bmp", "gif", "jpeg", "jpg", "png", "svg", "webp"]);
const FRONTMATTER_TYPE_KEYS = ["type", "category", "kind", "content_type", "contentType"];
const FRONTMATTER_DESC_KEYS = ["description", "desc", "caption", "summary", "alt", "title"];

function hashText(value: string): string {
	let hash = 5381;
	for (let i = 0; i < value.length; i++) {
		hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
	}
	return (hash >>> 0).toString(36);
}

function stripMdExtension(path: string): string {
	return path.replace(/\.md$/i, "");
}

function getFolder(path: string): string {
	const index = path.lastIndexOf("/");
	return index === -1 ? "" : path.slice(0, index);
}

function getBaseName(path: string): string {
	const name = path.split("/").pop() ?? path;
	return name.replace(/\.[^.]+$/, "");
}

function isTruthyFrontmatterValue(value: unknown): boolean {
	if (Array.isArray(value)) return value.length > 0;
	if (typeof value === "string") return value.trim().length > 0;
	return value !== undefined && value !== null && value !== false;
}

function getFrontmatterTags(frontmatter: Record<string, unknown> | undefined): string[] {
	if (!frontmatter) return [];
	const raw = frontmatter.tags;
	if (Array.isArray(raw)) return raw.map(String);
	if (typeof raw === "string") return raw.split(/[,\s]+/).filter(Boolean);
	return [];
}

function getFrontmatterString(frontmatter: Record<string, unknown> | undefined, key: string): string {
	const value = frontmatter?.[key];
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	return "";
}

function cleanFolderPath(path: string): string {
	return normalizePath(path.trim()).replace(/^\/+|\/+$/g, "");
}

function normalizeTagValue(tag: string): string {
	return tag.trim().replace(/^#/, "").replace(/\s+/g, "-");
}

function parseTags(value: string): string[] {
	return value
		.split(/[,\s]+/)
		.map(normalizeTagValue)
		.filter(Boolean);
}

function removeFrontmatter(content: string): string {
	return content.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, "").trim();
}

class ProjectLinkModal extends Modal {
	private projects: ProjectOption[];
	private onChoose: (projectPath: string) => Promise<void>;

	constructor(app: App, projects: ProjectOption[], onChoose: (projectPath: string) => Promise<void>) {
		super(app);
		this.projects = projects;
		this.onChoose = onChoose;
	}

	onOpen(): void {
		this.modalEl.classList.add("umos-triage-project-modal");
		this.contentEl.empty();

		const shell = this.contentEl.createDiv({ cls: "umos-triage-project-shell" });
		shell.createEl("h2", { cls: "umos-triage-project-title", text: t("Link to project") });
		shell.createDiv({
			cls: "umos-triage-project-desc",
			text: t("Choose a project note or type a project path."),
		});

		const input = shell.createEl("input", {
			cls: "umos-triage-project-input",
			attr: {
				type: "text",
				placeholder: t("Project path or name"),
			},
		});

		const list = shell.createDiv({ cls: "umos-triage-project-list" });
		const renderList = () => {
			list.empty();
			const query = input.value.trim().toLowerCase();
			const matches = this.projects
				.filter((project) => {
					if (!query) return true;
					return project.label.toLowerCase().includes(query) || project.path.toLowerCase().includes(query);
				})
				.slice(0, 8);

			if (matches.length === 0) {
				list.createDiv({ cls: "umos-triage-project-empty", text: t("No project suggestions") });
				return;
			}

			for (const project of matches) {
				const row = list.createEl("button", {
					cls: "umos-triage-project-item",
					attr: { type: "button" },
				});
				row.createSpan({ cls: "umos-triage-project-item-name", text: project.label });
				row.createSpan({ cls: "umos-triage-project-item-path", text: project.path });
				row.addEventListener("click", () => void this.submit(project.path));
			}
		};

		const actions = shell.createDiv({ cls: "umos-triage-project-actions" });
		const cancel = actions.createEl("button", {
			cls: "umos-triage-action",
			text: t("Cancel"),
			attr: { type: "button" },
		});
		const link = actions.createEl("button", {
			cls: "umos-triage-action is-primary",
			text: t("Link"),
			attr: { type: "button" },
		});

		cancel.addEventListener("click", () => this.close());
		link.addEventListener("click", () => void this.submit(input.value.trim()));
		input.addEventListener("input", renderList);
		input.addEventListener("keydown", (event) => {
			if (event.key === "Enter") {
				event.preventDefault();
				void this.submit(input.value.trim());
			}
			if (event.key === "Escape") {
				event.preventDefault();
				this.close();
			}
		});

		renderList();
		window.setTimeout(() => input.focus());
	}

	private async submit(projectPath: string): Promise<void> {
		const clean = projectPath.trim();
		if (!clean) {
			new Notice(t("Project is required"));
			return;
		}
		await this.onChoose(clean);
		this.close();
	}
}

class ClassificationModal extends Modal {
	private item: TriageItem;
	private file: TFile;
	private presets: TriageClassificationPreset[];
	private suggestions: TriageClassificationSuggestions;
	private value: TriageClassificationInput;
	private selectedPreset: TriageClassificationPresetId = "custom";
	private onApply: (value: TriageClassificationInput) => Promise<void>;

	constructor(
		app: App,
		item: TriageItem,
		file: TFile,
		initial: TriageClassificationInput,
		presets: TriageClassificationPreset[],
		suggestions: TriageClassificationSuggestions,
		onApply: (value: TriageClassificationInput) => Promise<void>,
	) {
		super(app);
		this.item = item;
		this.file = file;
		this.value = { ...initial };
		this.presets = presets;
		this.suggestions = suggestions;
		this.onApply = onApply;
	}

	onOpen(): void {
		this.modalEl.classList.add("umos-triage-classify-modal");
		this.render();
	}

	private render(): void {
		this.contentEl.empty();

		const shell = this.contentEl.createDiv({ cls: "umos-triage-classify-shell" });
		const head = shell.createDiv({ cls: "umos-triage-classify-head" });
		const icon = head.createSpan({ cls: "umos-triage-classify-head-icon" });
		setIcon(icon, "folder-input");
		const titleWrap = head.createSpan({ cls: "umos-triage-classify-title-wrap" });
		titleWrap.createEl("h2", { cls: "umos-triage-classify-title", text: t("Classify and route") });
		titleWrap.createDiv({
			cls: "umos-triage-classify-desc",
			text: t("Choose frontmatter and destination folder."),
		});

		const target = shell.createDiv({ cls: "umos-triage-classify-target" });
		target.createSpan({ cls: "umos-triage-classify-target-name", text: this.file.basename });
		target.createSpan({ cls: "umos-triage-classify-target-path", text: this.file.path });

		const presets = shell.createDiv({ cls: "umos-triage-classify-presets" });
		for (const preset of this.presets) {
			const button = presets.createEl("button", {
				cls: `umos-triage-classify-preset${this.selectedPreset === preset.id ? " is-active" : ""}`,
				attr: { type: "button" },
			});
			const presetIcon = button.createSpan({ cls: "umos-triage-classify-preset-icon" });
			setIcon(presetIcon, preset.icon);
			const presetText = button.createSpan({ cls: "umos-triage-classify-preset-text" });
			presetText.createSpan({ cls: "umos-triage-classify-preset-label", text: t(preset.label) });
			presetText.createSpan({ cls: "umos-triage-classify-preset-desc", text: t(preset.description) });
			button.addEventListener("click", () => {
				this.selectedPreset = preset.id;
				this.value = {
					...this.value,
					...preset.values,
					destinationFolder: preset.destinationFolder,
				};
				this.render();
			});
		}

		const route = shell.createDiv({ cls: "umos-triage-classify-route" });
		this.createInput(route, "Destination folder", this.value.destinationFolder, (value) => {
			this.value.destinationFolder = value;
			this.updatePreview(shell);
		}, "20 Projects / 30 Content / 40 Resources", this.suggestions.folders);

		this.createCheckbox(route, "Move file to folder", this.value.moveFile, (checked) => {
			this.value.moveFile = checked;
			this.updatePreview(shell);
		});
		this.createCheckbox(route, "Mark as triaged", this.value.markTriaged, (checked) => {
			this.value.markTriaged = checked;
		});

		const fieldsWrap = shell.createDiv({ cls: "umos-triage-classify-section" });
		fieldsWrap.createDiv({ cls: "umos-triage-classify-section-title", text: t("Frontmatter") });
		const grid = fieldsWrap.createDiv({ cls: "umos-triage-classify-grid" });
		this.createInput(grid, "Type", this.value.type, (value) => { this.value.type = value; }, "note / resource / content", this.suggestions.type);
		this.createInput(grid, "Project", this.value.project, (value) => { this.value.project = value; }, "20 Projects/...", this.suggestions.project);
		this.createInput(grid, "Content type", this.value.contentType, (value) => { this.value.contentType = value; }, "anime / book / note", this.suggestions.contentType);
		this.createTagField(grid);

		const preview = shell.createDiv({ cls: "umos-triage-classify-preview" });
		preview.setAttr("data-preview", "true");
		this.renderPreview(preview);

		const actions = shell.createDiv({ cls: "umos-triage-classify-actions" });
		const cancel = actions.createEl("button", {
			cls: "umos-triage-action",
			text: t("Cancel"),
			attr: { type: "button" },
		});
		const apply = actions.createEl("button", {
			cls: "umos-triage-action is-primary",
			text: t("Apply classification"),
			attr: { type: "button" },
		});

		cancel.addEventListener("click", () => this.close());
		apply.addEventListener("click", () => void this.submit());
	}

	private createInput(
		parent: HTMLElement,
		label: string,
		value: string,
		onChange: (value: string) => void,
		placeholder = "",
		suggestions: TriageSuggestion[] = [],
		wide = false,
	): HTMLInputElement {
		const field = parent.createDiv({ cls: `umos-triage-classify-field${wide ? " is-wide" : ""}` });
		field.createSpan({ cls: "umos-triage-classify-label", text: t(label) });
		const inputWrap = field.createDiv({ cls: "umos-triage-classify-input-wrap" });
		const input = inputWrap.createEl("input", {
			cls: "umos-triage-classify-input",
			attr: {
				type: "text",
				value,
				placeholder,
			},
		});
		const dropdown = inputWrap.createDiv({ cls: "umos-triage-classify-autocomplete" });
		dropdown.style.display = "none";

		const closeDropdown = () => {
			dropdown.style.display = "none";
		};
		const commit = (nextValue: string) => {
			input.value = nextValue;
			onChange(nextValue);
			closeDropdown();
		};
		const updateDropdown = () => {
			dropdown.empty();
			const query = input.value.trim().toLowerCase();
			const matches = suggestions
				.filter((suggestion) => suggestion.name.trim())
				.filter((suggestion, index, all) => all.findIndex((item) => item.name.toLowerCase() === suggestion.name.toLowerCase()) === index)
				.filter((suggestion) => !query || suggestion.name.toLowerCase().includes(query))
				.filter((suggestion) => suggestion.name.toLowerCase() !== query)
				.slice(0, query ? 10 : 18);

			for (const suggestion of matches) {
				const option = dropdown.createDiv({ cls: "umos-triage-classify-autocomplete-item" });
				option.setAttribute("tabindex", "0");
				option.createSpan({ cls: "umos-triage-classify-autocomplete-value", text: suggestion.name });
				option.createSpan({ cls: "umos-triage-classify-autocomplete-count", text: String(suggestion.count) });
				option.addEventListener("mousedown", (event) => {
					event.preventDefault();
					commit(suggestion.name);
				});
			}

			dropdown.style.display = matches.length > 0 ? "block" : "none";
		};

		input.addEventListener("input", () => {
			onChange(input.value);
			updateDropdown();
		});
		input.addEventListener("focus", updateDropdown);
		input.addEventListener("blur", () => {
			window.setTimeout(closeDropdown, 140);
		});
		input.addEventListener("keydown", (event) => {
			if (event.key === "ArrowDown") {
				event.preventDefault();
				const items = dropdown.querySelectorAll<HTMLElement>(".umos-triage-classify-autocomplete-item");
				items[0]?.focus();
			}
			if (event.key === "Escape") {
				closeDropdown();
			}
		});
		dropdown.addEventListener("keydown", (event) => {
			const items = Array.from(dropdown.querySelectorAll<HTMLElement>(".umos-triage-classify-autocomplete-item"));
			const focused = document.activeElement as HTMLElement;
			const idx = items.indexOf(focused);
			if (event.key === "ArrowDown") {
				event.preventDefault();
				items[idx + 1]?.focus();
			}
			if (event.key === "ArrowUp") {
				event.preventDefault();
				if (idx <= 0) input.focus();
				else items[idx - 1]?.focus();
			}
			if (event.key === "Enter") {
				event.preventDefault();
				const value = focused.querySelector<HTMLElement>(".umos-triage-classify-autocomplete-value")?.textContent ?? "";
				if (value) commit(value);
			}
			if (event.key === "Escape") {
				closeDropdown();
				input.focus();
			}
		});
		return input;
	}

	private createTagField(parent: HTMLElement): void {
		let tags = parseTags(this.value.tags);
		const field = parent.createDiv({ cls: "umos-triage-classify-field is-wide" });
		field.createSpan({ cls: "umos-triage-classify-label", text: t("Tags") });
		const fieldWrap = field.createDiv({ cls: "umos-tag-field-wrap umos-triage-classify-tag-field" });
		const chipsEl = fieldWrap.createDiv({ cls: "umos-tag-chips" });
		const inputWrap = fieldWrap.createDiv({ cls: "umos-tag-input-wrap" });
		const input = inputWrap.createEl("input", {
			cls: "umos-tag-input",
			attr: { type: "text", placeholder: t("Add tag…") },
		}) as HTMLInputElement;
		const dropdown = inputWrap.createDiv({ cls: "umos-tag-dropdown" });
		dropdown.style.display = "none";

		const notify = () => {
			this.value.tags = tags.join(" ");
		};

		const rebuildChips = () => {
			chipsEl.empty();
			for (const tag of tags) {
				const chip = chipsEl.createSpan({ cls: "umos-tag-chip" });
				chip.createSpan({ text: `#${tag}` });
				const remove = chip.createEl("button", { text: "×", cls: "umos-tag-chip-remove" });
				remove.addEventListener("click", () => {
					tags = tags.filter((item) => item !== tag);
					rebuildChips();
					notify();
				});
			}
		};

		const addTag = (raw: string) => {
			const tag = normalizeTagValue(raw);
			if (!tag || tags.includes(tag)) return;
			tags = [...tags, tag];
			input.value = "";
			dropdown.style.display = "none";
			rebuildChips();
			notify();
		};

		const createSuggestionOption = (suggestion: TriageSuggestion) => {
			const opt = dropdown.createDiv({ cls: "umos-tag-dropdown-item" });
			opt.setAttribute("tabindex", "0");
			opt.createSpan({ cls: "umos-tag-dropdown-hash", text: "#" });
			opt.createSpan({ cls: "umos-tag-dropdown-name", text: suggestion.name });
			opt.createSpan({ cls: "umos-tag-dropdown-count", text: String(suggestion.count) });
			opt.addEventListener("mousedown", (event) => {
				event.preventDefault();
				addTag(suggestion.name);
			});
		};

		const createCreateOption = (tag: string) => {
			const opt = dropdown.createDiv({ cls: "umos-tag-dropdown-item umos-tag-dropdown-create" });
			opt.setAttribute("tabindex", "0");
			opt.textContent = `+ ${t("Create")} "#${tag}"`;
			opt.addEventListener("mousedown", (event) => {
				event.preventDefault();
				addTag(tag);
			});
		};

		const updateDropdown = (query: string) => {
			dropdown.empty();
			const q = normalizeTagValue(query).toLowerCase();
			const existingLower = new Set(tags.map((tag) => tag.toLowerCase()));
			const matches = this.suggestions.tags
				.filter((suggestion) => !existingLower.has(suggestion.name.toLowerCase()))
				.filter((suggestion) => !q || suggestion.name.toLowerCase().includes(q))
				.slice(0, q ? 8 : 16);

			for (const match of matches) createSuggestionOption(match);
			if (q && !existingLower.has(q) && !matches.some((match) => match.name.toLowerCase() === q)) {
				createCreateOption(q);
			}

			dropdown.style.display = matches.length > 0 || q ? "block" : "none";
		};

		input.addEventListener("input", () => updateDropdown(input.value));
		input.addEventListener("focus", () => updateDropdown(input.value));
		input.addEventListener("blur", () => {
			window.setTimeout(() => {
				dropdown.style.display = "none";
			}, 150);
		});
		input.addEventListener("keydown", (event) => {
			if (event.key === "Enter" || event.key === ",") {
				event.preventDefault();
				addTag(input.value);
			} else if (event.key === "Backspace" && input.value === "" && tags.length > 0) {
				tags = tags.slice(0, -1);
				rebuildChips();
				notify();
			} else if (event.key === "Escape") {
				dropdown.style.display = "none";
			} else if (event.key === "ArrowDown") {
				event.preventDefault();
				const items = dropdown.querySelectorAll<HTMLElement>(".umos-tag-dropdown-item");
				if (items.length > 0) items[0].focus();
			}
		});
		dropdown.addEventListener("keydown", (event) => {
			const items = Array.from(dropdown.querySelectorAll<HTMLElement>(".umos-tag-dropdown-item"));
			const focused = document.activeElement as HTMLElement;
			const idx = items.indexOf(focused);
			if (event.key === "ArrowDown") {
				event.preventDefault();
				items[idx + 1]?.focus();
			}
			if (event.key === "ArrowUp") {
				event.preventDefault();
				if (idx <= 0) input.focus();
				else items[idx - 1]?.focus();
			}
			if (event.key === "Enter") {
				event.preventDefault();
				focused.dispatchEvent(new MouseEvent("mousedown"));
			}
			if (event.key === "Escape") {
				dropdown.style.display = "none";
				input.focus();
			}
		});

		rebuildChips();
		notify();
	}

	private createCheckbox(parent: HTMLElement, label: string, checked: boolean, onChange: (checked: boolean) => void): void {
		const row = parent.createEl("label", { cls: "umos-triage-classify-check" });
		const input = row.createEl("input", { attr: { type: "checkbox" } });
		input.checked = checked;
		row.createSpan({ text: t(label) });
		input.addEventListener("change", () => onChange(input.checked));
	}

	private updatePreview(shell: HTMLElement): void {
		const preview = shell.querySelector<HTMLElement>("[data-preview='true']");
		if (!preview) return;
		preview.empty();
		this.renderPreview(preview);
	}

	private renderPreview(parent: HTMLElement): void {
		const destination = cleanFolderPath(this.value.destinationFolder);
		const nextPath = destination ? `${destination}/${this.file.name}` : this.file.path;
		parent.createSpan({
			cls: "umos-triage-classify-preview-label",
			text: this.value.moveFile ? t("Will move to") : t("Will stay in place"),
		});
		parent.createSpan({
			cls: "umos-triage-classify-preview-path",
			text: this.value.moveFile ? nextPath : this.file.path,
		});
	}

	private async submit(): Promise<void> {
		const destination = cleanFolderPath(this.value.destinationFolder);
		if (this.value.moveFile && !destination) {
			new Notice(t("Destination folder is required"));
			return;
		}

		await this.onApply({
			...this.value,
			tags: parseTags(this.value.tags).join(" "),
			destinationFolder: destination,
		});
		this.close();
	}
}

export class TriageCenterView extends ItemView {
	private obsidianApp: App;
	private plugin: UmOSPlugin;
	private contentContainerEl: HTMLElement | null = null;
	private renderTimeout: ReturnType<typeof setTimeout> | null = null;
	private filter: TriageKind = "all";
	private searchQuery = "";
	private selectedId: string | null = null;

	constructor(leaf: WorkspaceLeaf, app: App, plugin: UmOSPlugin) {
		super(leaf);
		this.obsidianApp = app;
		this.plugin = plugin;
	}

	getViewType(): string {
		return TRIAGE_CENTER_VIEW_TYPE;
	}

	getDisplayText(): string {
		return t("Inbox / Triage Center");
	}

	getIcon(): string {
		return "inbox";
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.classList.add("umos-triage-view-container");
		this.contentContainerEl = container.createDiv({ cls: "umos-triage-view" });
		await this.renderAsync();

		const refresh = () => this.scheduleRender(250);
		const refs: EventRef[] = [
			this.obsidianApp.vault.on("create", refresh),
			this.obsidianApp.vault.on("delete", refresh),
			this.obsidianApp.vault.on("modify", refresh),
			this.obsidianApp.vault.on("rename", refresh),
		];
		for (const ref of refs) this.registerEvent(ref);

		const tasksHandler = () => this.scheduleRender(120);
		this.plugin.eventBus.on("tasks:changed", tasksHandler);
		this.register(() => this.plugin.eventBus.off("tasks:changed", tasksHandler));

		const commandHandler = () => this.scheduleRender(120);
		this.plugin.eventBus.on("command:executed", commandHandler);
		this.register(() => this.plugin.eventBus.off("command:executed", commandHandler));
	}

	async onClose(): Promise<void> {
		if (this.renderTimeout) clearTimeout(this.renderTimeout);
		this.renderTimeout = null;
		this.contentContainerEl = null;
	}

	private scheduleRender(delay = 150): void {
		if (this.renderTimeout) clearTimeout(this.renderTimeout);
		this.renderTimeout = setTimeout(() => void this.renderAsync(), delay);
	}

	private async renderAsync(): Promise<void> {
		if (!this.contentContainerEl) return;
		this.contentContainerEl.empty();
		this.renderLoading();

		const items = await this.collectItems();
		if (!this.contentContainerEl) return;

		const visible = this.filterItems(items);
		if (this.selectedId && !visible.some((item) => item.id === this.selectedId)) {
			this.selectedId = visible[0]?.id ?? null;
		} else if (!this.selectedId && visible.length > 0) {
			this.selectedId = visible[0].id;
		}

		const selected = visible.find((item) => item.id === this.selectedId) ?? visible[0] ?? null;
		this.contentContainerEl.empty();
		const root = this.contentContainerEl.createDiv({ cls: "umos-triage" });
		this.renderHeader(root, items, visible);
		this.renderStats(root, items);

		if (items.length === 0) {
			this.renderEmpty(root, "Inbox is clear", "Nothing needs triage right now.");
			return;
		}

		if (visible.length === 0) {
			this.renderEmpty(root, "No matching triage items", "Try another filter or search query.");
			return;
		}

		const layout = root.createDiv({ cls: "umos-triage-layout" });
		this.renderList(layout, visible, selected);
		if (selected) this.renderDetail(layout, selected);
	}

	private renderLoading(): void {
		if (!this.contentContainerEl) return;
		const shell = this.contentContainerEl.createDiv({ cls: "umos-triage" });
		const title = shell.createDiv({ cls: "umos-triage-title" });
		const icon = title.createSpan({ cls: "umos-triage-title-icon" });
		setIcon(icon, "inbox");
		title.createSpan({ text: t("Inbox / Triage Center") });
		shell.createDiv({ cls: "umos-triage-loading", text: t("Scanning inbox...") });
	}

	private renderHeader(parent: HTMLElement, allItems: TriageItem[], visible: TriageItem[]): void {
		const toolbar = parent.createDiv({ cls: "umos-triage-toolbar" });
		const titleWrap = toolbar.createDiv({ cls: "umos-triage-title-wrap" });
		const title = titleWrap.createDiv({ cls: "umos-triage-title" });
		const icon = title.createSpan({ cls: "umos-triage-title-icon" });
		setIcon(icon, "inbox");
		title.createSpan({ text: t("Inbox / Triage Center") });
		titleWrap.createDiv({
			cls: "umos-triage-subtitle",
			text: `${visible.length} ${t("visible")} · ${allItems.length} ${t("needs triage")}`,
		});

		const controls = toolbar.createDiv({ cls: "umos-triage-controls" });
		const search = controls.createEl("input", {
			cls: "umos-triage-search",
			attr: {
				type: "search",
				placeholder: t("Search inbox..."),
				value: this.searchQuery,
			},
		});
		search.addEventListener("input", () => {
			this.searchQuery = search.value;
			this.scheduleRender(80);
		});

		const refresh = this.createIconButton(controls, "refresh-cw", "Refresh", () => void this.renderAsync());
		refresh.addClass("umos-triage-refresh");

		const filters = parent.createDiv({ cls: "umos-triage-filters" });
		const filterDefs: Array<[TriageKind, string, string]> = [
			["all", "All", "sparkles"],
			["task", "Tasks", "check-square"],
			["note", "Quick notes", "sticky-note"],
			["image", "Images", "image"],
			["file", "Files", "file-question"],
			["capture", "Captures", "wand-sparkles"],
		];
		for (const [kind, label, iconName] of filterDefs) {
			const count = kind === "all" ? allItems.length : allItems.filter((item) => item.kind === kind).length;
			const button = filters.createEl("button", {
				cls: `umos-triage-filter${this.filter === kind ? " is-active" : ""}`,
				attr: { type: "button" },
			});
			const filterIcon = button.createSpan({ cls: "umos-triage-filter-icon" });
			setIcon(filterIcon, iconName);
			button.createSpan({ text: t(label) });
			button.createSpan({ cls: "umos-triage-filter-count", text: String(count) });
			button.addEventListener("click", () => {
				this.filter = kind;
				void this.renderAsync();
			});
		}
	}

	private renderStats(parent: HTMLElement, items: TriageItem[]): void {
		const stats = parent.createDiv({ cls: "umos-triage-stats" });
		this.renderStat(stats, "check-square", "Undated tasks", items.filter((item) => item.kind === "task").length);
		this.renderStat(stats, "sticky-note", "Quick notes", items.filter((item) => item.kind === "note").length);
		this.renderStat(stats, "image", "Images without description", items.filter((item) => item.kind === "image").length);
		this.renderStat(stats, "file-question", "Files without type", items.filter((item) => item.kind === "file").length);
		this.renderStat(stats, "wand-sparkles", "Capture records", items.filter((item) => item.kind === "capture").length);
	}

	private renderStat(parent: HTMLElement, iconName: string, label: string, value: number): void {
		const stat = parent.createDiv({ cls: "umos-triage-stat" });
		const icon = stat.createSpan({ cls: "umos-triage-stat-icon" });
		setIcon(icon, iconName);
		const body = stat.createSpan({ cls: "umos-triage-stat-body" });
		body.createSpan({ cls: "umos-triage-stat-value", text: String(value) });
		body.createSpan({ cls: "umos-triage-stat-label", text: t(label) });
	}

	private renderList(parent: HTMLElement, items: TriageItem[], selected: TriageItem | null): void {
		const list = parent.createDiv({ cls: "umos-triage-list" });
		for (const item of items) {
			const row = list.createEl("button", {
				cls: `umos-triage-item is-${item.kind} is-${item.severity}${selected?.id === item.id ? " is-selected" : ""}`,
				attr: { type: "button" },
			});
			row.style.setProperty("--triage-accent", item.accent);
			const icon = row.createSpan({ cls: "umos-triage-item-icon" });
			setIcon(icon, item.icon);
			const body = row.createSpan({ cls: "umos-triage-item-body" });
			const top = body.createSpan({ cls: "umos-triage-item-top" });
			top.createSpan({ cls: "umos-triage-item-title", text: item.title });
			top.createSpan({ cls: "umos-triage-kind", text: this.getKindLabel(item.kind) });
			body.createSpan({ cls: "umos-triage-item-subtitle", text: item.subtitle });
			body.createSpan({ cls: "umos-triage-item-detail", text: item.reason });
			const age = row.createSpan({ cls: "umos-triage-age", text: this.formatAge(item.updatedAt) });
			age.setAttr("title", moment(item.updatedAt).format("YYYY-MM-DD HH:mm"));
			row.addEventListener("click", () => {
				this.selectedId = item.id;
				void this.renderAsync();
			});
		}
	}

	private renderDetail(parent: HTMLElement, item: TriageItem): void {
		const detail = parent.createDiv({ cls: `umos-triage-detail is-${item.kind}` });
		detail.style.setProperty("--triage-accent", item.accent);
		const head = detail.createDiv({ cls: "umos-triage-detail-head" });
		const icon = head.createSpan({ cls: "umos-triage-detail-icon" });
		setIcon(icon, item.icon);
		const titleWrap = head.createSpan({ cls: "umos-triage-detail-title-wrap" });
		titleWrap.createSpan({ cls: "umos-triage-detail-kicker", text: this.getKindLabel(item.kind) });
		titleWrap.createSpan({ cls: "umos-triage-detail-title", text: item.title });

		detail.createDiv({ cls: "umos-triage-detail-reason", text: item.reason });
		detail.createDiv({ cls: "umos-triage-detail-desc", text: item.detail });

		const meta = detail.createDiv({ cls: "umos-triage-meta" });
		this.renderMeta(meta, "Source", item.subtitle);
		if (item.path) this.renderMeta(meta, "Path", item.path);
		if (item.line !== undefined) this.renderMeta(meta, "Line", String(item.line + 1));
		this.renderMeta(meta, "Updated", moment(item.updatedAt).format("YYYY-MM-DD HH:mm"));

		const actions = detail.createDiv({ cls: "umos-triage-actions" });
		this.createAction(actions, "Open", "external-link", () => void this.openItem(item));
		this.createAction(actions, "Triage", "check", () => void this.resolveItem(item));
		if (this.getClassifiableFile(item)) {
			this.createAction(actions, "Classify", "folder-input", () => this.openClassificationModal(item), "is-classify");
		}
		this.createAction(actions, "Snooze", "alarm-clock", () => void this.snoozeItem(item));
		this.createAction(actions, "Link project", "git-branch", () => this.openProjectLinkModal(item));
		this.createAction(actions, "Delete", "trash-2", () => void this.deleteItem(item), "is-danger");
		this.renderRecentResolved(detail);
	}

	private renderRecentResolved(parent: HTMLElement): void {
		const recent = this.getRecentResolved(6);
		if (recent.length === 0) return;

		const section = parent.createDiv({ cls: "umos-triage-recent" });
		const head = section.createDiv({ cls: "umos-triage-recent-head" });
		head.createSpan({ cls: "umos-triage-recent-title", text: t("Recently triaged") });
		head.createSpan({ cls: "umos-triage-recent-count", text: String(recent.length) });

		const list = section.createDiv({ cls: "umos-triage-recent-list" });
		for (const [id, entry] of recent) {
			const row = list.createDiv({ cls: "umos-triage-recent-item" });
			const icon = row.createSpan({ cls: "umos-triage-recent-icon" });
			setIcon(icon, entry.icon || "check-circle-2");
			const body = row.createSpan({ cls: "umos-triage-recent-body" });
			body.createSpan({ cls: "umos-triage-recent-item-title", text: entry.title || this.getResolvedFallbackTitle(id) });
			body.createSpan({
				cls: "umos-triage-recent-item-meta",
				text: `${this.formatAge(entry.resolvedAt)}${entry.path ? ` · ${entry.path}` : ""}`,
			});
			const actions = row.createSpan({ cls: "umos-triage-recent-actions" });
			if (entry.path) {
				const open = actions.createEl("button", {
					cls: "umos-triage-recent-action",
					attr: { type: "button", title: t("Open") },
				});
				setIcon(open, "external-link");
				open.addEventListener("click", () => void this.openResolvedItem(entry));
			}
			const restore = actions.createEl("button", {
				cls: "umos-triage-recent-action is-restore",
				attr: { type: "button", title: t("Return to triage") },
			});
			setIcon(restore, "rotate-ccw");
			restore.addEventListener("click", () => void this.restoreResolvedItem(id));
		}
	}

	private renderMeta(parent: HTMLElement, label: string, value: string): void {
		const row = parent.createDiv({ cls: "umos-triage-meta-row" });
		row.createSpan({ cls: "umos-triage-meta-label", text: t(label) });
		row.createSpan({ cls: "umos-triage-meta-value", text: value });
	}

	private renderEmpty(parent: HTMLElement, title: string, desc: string): void {
		const empty = parent.createDiv({ cls: "umos-triage-empty" });
		const icon = empty.createSpan({ cls: "umos-triage-empty-icon" });
		setIcon(icon, "inbox");
		empty.createDiv({ cls: "umos-triage-empty-title", text: t(title) });
		empty.createDiv({ cls: "umos-triage-empty-desc", text: t(desc) });
	}

	private createIconButton(parent: HTMLElement, iconName: string, label: string, onClick: () => void): HTMLButtonElement {
		const button = parent.createEl("button", {
			cls: "umos-triage-icon-btn",
			attr: { type: "button", title: t(label), "aria-label": t(label) },
		});
		setIcon(button, iconName);
		button.addEventListener("click", onClick);
		return button;
	}

	private createAction(
		parent: HTMLElement,
		label: string,
		iconName: string,
		onClick: () => void,
		extraClass = "",
	): HTMLButtonElement {
		const button = parent.createEl("button", {
			cls: `umos-triage-action${extraClass ? ` ${extraClass}` : ""}`,
			attr: { type: "button" },
		});
		const icon = button.createSpan({ cls: "umos-triage-action-icon" });
		setIcon(icon, iconName);
		button.createSpan({ text: t(label) });
		button.addEventListener("click", onClick);
		return button;
	}

	private async collectItems(): Promise<TriageItem[]> {
		this.ensureTriageStore();
		const [tasks, notes, images, files, captures] = await Promise.all([
			this.collectUndatedTasks(),
			this.collectQuickNotes(),
			this.collectImagesWithoutDescription(),
			this.collectFilesWithoutType(),
			this.collectCaptureRecords(),
		]);

		const active = [...tasks, ...notes, ...images, ...files, ...captures];
		const activeIds = new Set(active.map((item) => item.id));
		const reopened = this.collectReopenedItems(activeIds);

		return [...active, ...reopened]
			.filter((item) => !this.isSuppressed(item))
			.sort((a, b) => {
				const severity = this.getSeverityRank(b.severity) - this.getSeverityRank(a.severity);
				if (severity !== 0) return severity;
				return b.updatedAt - a.updatedAt;
			});
	}

	private collectReopenedItems(activeIds: Set<string>): TriageItem[] {
		const store = this.ensureTriageStore();
		return Object.entries(store.reopened ?? {})
			.filter(([id]) => !activeIds.has(id) && !store.resolved[id])
			.map(([id, entry]) => {
				const file = entry.path ? this.obsidianApp.vault.getAbstractFileByPath(entry.path) : null;
				const kind = this.normalizeTriageKind(entry.kind);
				return {
					id,
					kind,
					severity: "medium" as const,
					title: entry.title || this.getResolvedFallbackTitle(id),
					subtitle: entry.subtitle || entry.path || t("Recently triaged"),
					detail: entry.detail || t("Returned from recently triaged."),
					reason: t("Returned to triage"),
					icon: entry.icon || "rotate-ccw",
					accent: entry.accent || "#22c55e",
					updatedAt: Date.now(),
					path: entry.path,
					line: entry.line,
					file: file instanceof TFile ? file : undefined,
				};
			});
	}

	private async collectUndatedTasks(): Promise<TriageItem[]> {
		const service = new TaskService(this.obsidianApp, this.plugin);
		const tasks = await service.getFlatTasksWithQuery({ status: ["todo", "doing"] });
		return tasks
			.filter((task) => task.status !== "done" && task.status !== "cancelled")
			.filter((task) => !task.dueDate && !task.startDate && !task.scheduledDate)
			.map((task) => ({
				id: `task:${task.filePath}:${task.lineNumber}:${hashText(task.rawText)}`,
				kind: "task" as const,
				severity: task.priority === "high" ? "high" as const : "medium" as const,
				title: task.description.replace(/[⏫🔼🔽]/g, "").trim() || t("Untitled task"),
				subtitle: task.filePath,
				detail: t("Task has no due, start, or scheduled date."),
				reason: t("Needs a date or project context"),
				icon: "check-square",
				accent: task.priority === "high" ? "#ef4444" : "#3b82f6",
				updatedAt: this.getPathMTime(task.filePath),
				path: task.filePath,
				line: task.lineNumber,
				task,
			}));
	}

	private async collectQuickNotes(): Promise<TriageItem[]> {
		const inbox = normalizePath(this.plugin.settings.homeQuickCaptureDefaultNoteFolder || "10 Inbox").replace(/\/+$/, "");
		const files = this.obsidianApp.vault.getMarkdownFiles()
			.filter((file) => file.path.startsWith(`${inbox}/`) || file.path === `${inbox}.md`)
			.filter((file) => !this.hasFrontmatterTriageDone(file));

		return files.map((file) => ({
			id: `note:${file.path}`,
			kind: "note" as const,
			severity: "medium" as const,
			title: file.basename,
			subtitle: file.path,
			detail: t("Quick note is still sitting in the inbox folder."),
			reason: t("Needs review, move, or project link"),
			icon: "sticky-note",
			accent: "#22c55e",
			updatedAt: file.stat.mtime,
			path: file.path,
			file,
		}));
	}

	private async collectImagesWithoutDescription(): Promise<TriageItem[]> {
		const [describedImages, sidecarDescriptions] = await Promise.all([
			this.collectDescribedImagesFromMarkdown(),
			this.collectSidecarImageDescriptions(),
		]);

		return this.obsidianApp.vault.getFiles()
			.filter((file) => IMAGE_EXTENSIONS.has(file.extension.toLowerCase()))
			.filter((file) => !describedImages.has(file.path) && !sidecarDescriptions.has(file.path))
			.map((file) => ({
				id: `image:${file.path}`,
				kind: "image" as const,
				severity: "low" as const,
				title: file.name,
				subtitle: file.path,
				detail: t("Image has no obvious alt text, caption, or sidecar description note."),
				reason: t("Needs description or project link"),
				icon: "image",
				accent: "#a855f7",
				updatedAt: file.stat.mtime,
				path: file.path,
				file,
			}));
	}

	private async collectFilesWithoutType(): Promise<TriageItem[]> {
		const dailyRoot = normalizePath(this.plugin.settings.dailyNotesPath || "").replace(/\/+$/, "");
		const inboxRoot = normalizePath(this.plugin.settings.homeQuickCaptureDefaultNoteFolder || "10 Inbox").replace(/\/+$/, "");
		const files = this.obsidianApp.vault.getMarkdownFiles()
			.filter((file) => !dailyRoot || !file.path.startsWith(`${dailyRoot}/`))
			.filter((file) => !file.path.startsWith(`${inboxRoot}/`))
			.filter((file) => !file.path.startsWith(".trash/"))
			.filter((file) => !file.path.toLowerCase().includes("/template"))
			.filter((file) => !this.hasKnownType(file))
			.slice(0, 160);

		return files.map((file) => ({
			id: `file:${file.path}`,
			kind: "file" as const,
			severity: "low" as const,
			title: file.basename,
			subtitle: file.path,
			detail: t("Markdown file has no type, category, kind, or content_type frontmatter."),
			reason: t("Needs classification"),
			icon: "file-question",
			accent: "#f59e0b",
			updatedAt: file.stat.mtime,
			path: file.path,
			file,
		}));
	}

	private async collectCaptureRecords(): Promise<TriageItem[]> {
		const history = (this.plugin.data_store.commandHistory ?? []).slice(0, 20);
		return history
			.filter((item) => Date.now() - item.executedAt < 7 * 24 * 60 * 60 * 1000)
			.map((item) => ({
				id: `capture:${item.executedAt}:${hashText(item.raw)}`,
				kind: "capture" as const,
				severity: item.status === "failed" ? "high" as const : "low" as const,
				title: item.command || item.raw,
				subtitle: item.target ?? t("Command history"),
				detail: item.message,
				reason: item.status === "failed" ? t("Capture failed and needs attention") : t("Recent capture may need routing"),
				icon: item.status === "failed" ? "alert-triangle" : "wand-sparkles",
				accent: item.status === "failed" ? "#ef4444" : "#06b6d4",
				updatedAt: item.executedAt,
				path: item.target,
				capture: item,
			}));
	}

	private filterItems(items: TriageItem[]): TriageItem[] {
		const query = this.searchQuery.trim().toLowerCase();
		return items.filter((item) => {
			if (this.filter !== "all" && item.kind !== this.filter) return false;
			if (!query) return true;
			return [item.title, item.subtitle, item.detail, item.reason, item.path ?? ""]
				.some((value) => value.toLowerCase().includes(query));
		});
	}

	private async collectDescribedImagesFromMarkdown(): Promise<Set<string>> {
		const result = new Set<string>();
		const markdownFiles = this.obsidianApp.vault.getMarkdownFiles();
		await Promise.all(markdownFiles.map(async (file) => {
			const content = await this.obsidianApp.vault.cachedRead(file);
			this.collectMarkdownImageRefs(content, file.path, result);
		}));
		return result;
	}

	private collectMarkdownImageRefs(content: string, sourcePath: string, described: Set<string>): void {
		const wikiRegex = /!\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g;
		let wikiMatch: RegExpExecArray | null;
		while ((wikiMatch = wikiRegex.exec(content)) !== null) {
			const target = this.resolveImageRef(wikiMatch[1], sourcePath);
			if (target && this.isUsefulImageDescription(wikiMatch[2] ?? "")) described.add(target.path);
		}

		const mdRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
		let mdMatch: RegExpExecArray | null;
		while ((mdMatch = mdRegex.exec(content)) !== null) {
			const target = this.resolveImageRef(mdMatch[2], sourcePath);
			if (target && this.isUsefulImageDescription(mdMatch[1] ?? "")) described.add(target.path);
		}
	}

	private async collectSidecarImageDescriptions(): Promise<Set<string>> {
		const result = new Set<string>();
		const imageFiles = this.obsidianApp.vault.getFiles().filter((file) => IMAGE_EXTENSIONS.has(file.extension.toLowerCase()));
		await Promise.all(imageFiles.map(async (image) => {
			const sidecarPath = normalizePath(`${getFolder(image.path)}/${image.basename}.md`).replace(/^\//, "");
			const sidecar = this.obsidianApp.vault.getAbstractFileByPath(sidecarPath);
			if (!(sidecar instanceof TFile)) return;

			const frontmatter = this.getFrontmatter(sidecar);
			const hasFrontmatterDesc = FRONTMATTER_DESC_KEYS.some((key) => isTruthyFrontmatterValue(frontmatter?.[key]));
			if (hasFrontmatterDesc) {
				result.add(image.path);
				return;
			}

			const body = removeFrontmatter(await this.obsidianApp.vault.cachedRead(sidecar));
			if (body.replace(/!\[\[[^\]]+\]\]/g, "").trim().length > 24) {
				result.add(image.path);
			}
		}));
		return result;
	}

	private resolveImageRef(rawRef: string, sourcePath: string): TFile | null {
		const clean = rawRef
			.trim()
			.replace(/^<|>$/g, "")
			.replace(/^["']|["']$/g, "")
			.split("?")[0]
			.split("#")[0];
		if (!clean) return null;

		const decoded = (() => {
			try {
				return decodeURIComponent(clean);
			} catch {
				return clean;
			}
		})();

		const direct = this.obsidianApp.vault.getAbstractFileByPath(normalizePath(decoded));
		if (direct instanceof TFile && IMAGE_EXTENSIONS.has(direct.extension.toLowerCase())) return direct;

		const linked = this.obsidianApp.metadataCache.getFirstLinkpathDest(decoded, sourcePath);
		if (linked instanceof TFile && IMAGE_EXTENSIONS.has(linked.extension.toLowerCase())) return linked;
		return null;
	}

	private isUsefulImageDescription(value: string): boolean {
		const clean = value.trim();
		if (!clean) return false;
		if (/^\d+(?:x\d+)?$/i.test(clean)) return false;
		if (/^(left|right|center)$/i.test(clean)) return false;
		return clean.length >= 3;
	}

	private hasFrontmatterTriageDone(file: TFile): boolean {
		const frontmatter = this.getFrontmatter(file);
		return String(frontmatter?.triage ?? "").toLowerCase() === "done";
	}

	private hasKnownType(file: TFile): boolean {
		const frontmatter = this.getFrontmatter(file);
		if (!frontmatter) return false;
		if (FRONTMATTER_TYPE_KEYS.some((key) => isTruthyFrontmatterValue(frontmatter[key]))) return true;
		const tags = getFrontmatterTags(frontmatter).map((tag) => tag.replace(/^#/, "").toLowerCase());
		return tags.some((tag) => tag.startsWith("content/") || tag.startsWith("project") || tag === "content");
	}

	private getFrontmatter(file: TFile): Record<string, unknown> | undefined {
		return this.obsidianApp.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined;
	}

	private getPathMTime(path: string): number {
		const file = this.obsidianApp.vault.getAbstractFileByPath(path);
		return file instanceof TFile ? file.stat.mtime : Date.now();
	}

	private isSuppressed(item: TriageItem): boolean {
		const store = this.ensureTriageStore();
		if (store.resolved[item.id]) return true;
		const snoozedUntil = store.snoozedUntil[item.id] ?? 0;
		return snoozedUntil > Date.now();
	}

	private getRecentResolved(limit: number): Array<[string, TriageResolvedItem]> {
		const store = this.ensureTriageStore();
		return Object.entries(store.resolved)
			.sort(([, a], [, b]) => b.resolvedAt - a.resolvedAt)
			.slice(0, limit);
	}

	private getResolvedFallbackTitle(id: string): string {
		const [, value = id] = id.split(/:(.+)/);
		const clean = value.split(":")[0] || value;
		return getBaseName(clean) || t("Untitled item");
	}

	private normalizeTriageKind(kind: TriageResolvedItem["kind"]): Exclude<TriageKind, "all"> {
		if (kind === "task" || kind === "note" || kind === "image" || kind === "file" || kind === "capture") return kind;
		return "file";
	}

	private async openItem(item: TriageItem): Promise<void> {
		if (!item.path) return;
		const file = this.obsidianApp.vault.getAbstractFileByPath(item.path);
		if (!(file instanceof TFile)) {
			new Notice(t("File not found"));
			await this.renderAsync();
			return;
		}

		const leaf = this.obsidianApp.workspace.getLeaf("tab");
		await leaf.openFile(file);
		this.obsidianApp.workspace.revealLeaf(leaf);

		if (item.line !== undefined) {
			const view = this.obsidianApp.workspace.getActiveViewOfType(MarkdownView);
			view?.editor.setCursor(item.line, 0);
			view?.editor.scrollIntoView({ from: { line: item.line, ch: 0 }, to: { line: item.line, ch: 0 } }, true);
		}
	}

	private async openResolvedItem(entry: TriageResolvedItem): Promise<void> {
		if (!entry.path) return;
		const file = this.obsidianApp.vault.getAbstractFileByPath(entry.path);
		if (!(file instanceof TFile)) {
			new Notice(t("File not found"));
			await this.renderAsync();
			return;
		}

		const leaf = this.obsidianApp.workspace.getLeaf("tab");
		await leaf.openFile(file);
		this.obsidianApp.workspace.revealLeaf(leaf);
	}

	private async resolveItem(item: TriageItem, projectPath?: string, notify = true): Promise<void> {
		const store = this.ensureTriageStore();
		store.resolved[item.id] = {
			resolvedAt: Date.now(),
			projectPath,
			...this.createResolvedSnapshot(item),
		};
		delete store.snoozedUntil[item.id];
		delete store.reopened[item.id];
		if (projectPath) store.linkedProjects[item.id] = projectPath;
		await this.plugin.saveSettings();
		if (notify) new Notice(t("Item triaged"));
		await this.renderAsync();
	}

	private createResolvedSnapshot(item: TriageItem): Partial<TriageResolvedItem> {
		return {
			kind: item.kind,
			title: item.title,
			subtitle: item.subtitle,
			detail: item.detail,
			reason: item.reason,
			icon: item.icon,
			accent: item.accent,
			updatedAt: item.updatedAt,
			path: item.path,
			line: item.line,
		};
	}

	private async restoreResolvedItem(id: string): Promise<void> {
		const store = this.ensureTriageStore();
		const entry = store.resolved[id];
		if (!entry) return;

		delete store.resolved[id];
		delete store.snoozedUntil[id];
		delete store.linkedProjects[id];
		store.reopened[id] = entry;

		if (entry.path) {
			const file = this.obsidianApp.vault.getAbstractFileByPath(entry.path);
			if (file instanceof TFile && file.extension.toLowerCase() === "md") {
				await this.obsidianApp.fileManager.processFrontMatter(file, (frontmatter) => {
					delete frontmatter.triage;
				});
			}
		}

		await this.plugin.saveSettings();
		new Notice(t("Returned to triage"));
		await this.renderAsync();
	}

	private async snoozeItem(item: TriageItem): Promise<void> {
		const store = this.ensureTriageStore();
		store.snoozedUntil[item.id] = Date.now() + 24 * 60 * 60 * 1000;
		await this.plugin.saveSettings();
		new Notice(t("Snoozed until tomorrow"));
		await this.renderAsync();
	}

	private openProjectLinkModal(item: TriageItem): void {
		new ProjectLinkModal(this.obsidianApp, this.collectProjects(), async (projectPath) => {
			await this.linkProject(item, projectPath);
		}).open();
	}

	private openClassificationModal(item: TriageItem): void {
		const file = this.getClassifiableFile(item);
		if (!file) {
			new Notice(t("Classify works with markdown files."));
			return;
		}

		new ClassificationModal(
			this.obsidianApp,
			item,
			file,
			this.getInitialClassification(item, file),
			this.getClassificationPresets(),
			this.collectClassificationSuggestions(),
			async (classification) => {
				await this.applyClassification(item, file, classification);
			},
		).open();
	}

	private getClassifiableFile(item: TriageItem): TFile | null {
		if (item.kind !== "note" && item.kind !== "file" && item.kind !== "capture") return null;
		const file = item.file ?? (item.path ? this.obsidianApp.vault.getAbstractFileByPath(item.path) : null);
		if (!(file instanceof TFile) || file.extension.toLowerCase() !== "md") return null;
		if (item.kind === "capture" && !this.isInboxFile(file)) return null;
		return file;
	}

	private getInitialClassification(item: TriageItem, file: TFile): TriageClassificationInput {
		const frontmatter = this.getFrontmatter(file);
		const isInbox = this.isInboxFile(file);
		const folder = getFolder(file.path);
		return {
			type: getFrontmatterString(frontmatter, "type") || (item.kind === "file" ? "resource" : "note"),
			area: "",
			classification: "",
			topic: "",
			project: getFrontmatterString(frontmatter, "project"),
			contentType: getFrontmatterString(frontmatter, "content_type") || getFrontmatterString(frontmatter, "contentType"),
			tags: getFrontmatterTags(frontmatter).map(normalizeTagValue).join(" "),
			destinationFolder: isInbox
				? cleanFolderPath(this.plugin.settings.homeProjectsPath || "20 Projects")
				: folder,
			moveFile: isInbox,
			markTriaged: true,
		};
	}

	private getClassificationPresets(): TriageClassificationPreset[] {
		const projectsRoot = cleanFolderPath(this.plugin.settings.homeProjectsPath || "20 Projects");
		const contentRoot = cleanFolderPath(this.plugin.settings.homeContentPath || "30 Content");
		return [
			{
				id: "project",
				label: "Project note",
				icon: "rocket",
				description: "Active project material",
				destinationFolder: projectsRoot,
				values: {
					type: "project-note",
					area: "",
					classification: "",
					tags: "",
				},
			},
			{
				id: "content",
				label: "Content item",
				icon: "clapperboard",
				description: "Media, books, anime, videos",
				destinationFolder: contentRoot,
				values: {
					type: "content",
					area: "",
					classification: "",
					contentType: "",
					tags: "",
				},
			},
			{
				id: "resource",
				label: "Resource",
				icon: "book-open",
				description: "Reference or reusable note",
				destinationFolder: "40 Resources",
				values: {
					type: "resource",
					area: "",
					classification: "",
					tags: "",
				},
			},
			{
				id: "study",
				label: "Study note",
				icon: "graduation-cap",
				description: "Learning, labs, courses",
				destinationFolder: "45 Study",
				values: {
					type: "study-note",
					area: "",
					classification: "",
					tags: "",
				},
			},
			{
				id: "archive",
				label: "Archive note",
				icon: "archive",
				description: "Keep but remove from active flow",
				destinationFolder: "50 Archive",
				values: {
					type: "archive-note",
					area: "",
					classification: "",
					tags: "",
				},
			},
		];
	}

	private collectClassificationSuggestions(): TriageClassificationSuggestions {
		const frontmatterValues = {
			type: new Map<string, number>(),
			area: new Map<string, number>(),
			classification: new Map<string, number>(),
			topic: new Map<string, number>(),
			project: new Map<string, number>(),
			contentType: new Map<string, number>(),
		};
		const tagCounts = new Map<string, number>();

		const addValue = (map: Map<string, number>, value: unknown) => {
			if (Array.isArray(value)) {
				for (const item of value) addValue(map, item);
				return;
			}
			if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") return;
			const clean = String(value).trim();
			if (!clean) return;
			map.set(clean, (map.get(clean) ?? 0) + 1);
		};
		const addTag = (value: unknown) => {
			if (Array.isArray(value)) {
				for (const item of value) addTag(item);
				return;
			}
			if (typeof value !== "string") return;
			for (const raw of value.split(/[,\s]+/)) {
				const tag = normalizeTagValue(raw);
				if (!tag) continue;
				tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
			}
		};

		for (const file of this.obsidianApp.vault.getMarkdownFiles()) {
			const frontmatter = this.getFrontmatter(file);
			if (!frontmatter) continue;
			addValue(frontmatterValues.type, frontmatter.type);
			addValue(frontmatterValues.type, frontmatter.kind);
			addValue(frontmatterValues.type, frontmatter.category);
			addValue(frontmatterValues.area, frontmatter.area);
			addValue(frontmatterValues.classification, frontmatter.classification);
			addValue(frontmatterValues.topic, frontmatter.topic);
			addValue(frontmatterValues.project, frontmatter.project);
			addValue(frontmatterValues.contentType, frontmatter.content_type);
			addValue(frontmatterValues.contentType, frontmatter.contentType);
			addTag(frontmatter.tags);
		}

		const metadataCache = this.obsidianApp.metadataCache as unknown as { getTags?: () => Record<string, number> };
		const allTags = typeof metadataCache.getTags === "function" ? metadataCache.getTags() : {};
		for (const [raw, count] of Object.entries(allTags)) {
			const tag = normalizeTagValue(raw);
			if (!tag) continue;
			tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + Number(count));
		}

		for (const project of this.collectProjects()) {
			addValue(frontmatterValues.project, project.path);
			addValue(frontmatterValues.project, project.label);
		}

		return {
			folders: this.collectFolderSuggestions(),
			type: this.rankSuggestionMap(frontmatterValues.type, ["note", "resource", "content", "project-note", "study-note", "archive-note"]),
			area: this.rankSuggestionMap(frontmatterValues.area, ["projects", "content", "resources", "study", "archive"]),
			classification: this.rankSuggestionMap(frontmatterValues.classification, ["active", "archived"]),
			topic: this.rankSuggestionMap(frontmatterValues.topic),
			project: this.rankSuggestionMap(frontmatterValues.project),
			contentType: this.rankSuggestionMap(frontmatterValues.contentType, ["anime", "book", "video", "game", "manga", "audiobook", "note"]),
			tags: Array.from(tagCounts.entries())
				.map(([name, count]) => ({ name, count }))
				.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
				.slice(0, 200),
		};
	}

	private rankSuggestionMap(map: Map<string, number>, preferred: string[] = []): TriageSuggestion[] {
		const preferredRank = new Map(preferred.map((value, index) => [value.toLowerCase(), preferred.length - index]));
		for (const value of preferred) {
			if (!map.has(value)) map.set(value, 0);
		}
		return Array.from(map.entries())
			.map(([name, count]) => ({ name, count }))
			.sort((a, b) => {
				const rankDiff = (preferredRank.get(b.name.toLowerCase()) ?? 0) - (preferredRank.get(a.name.toLowerCase()) ?? 0);
				if (rankDiff !== 0) return rankDiff;
				if (b.count !== a.count) return b.count - a.count;
				return a.name.localeCompare(b.name, undefined, { numeric: true });
			})
			.slice(0, 200);
	}

	private collectFolderSuggestions(): TriageSuggestion[] {
		const suggestions = new Map<string, number>();
		const addFolder = (folder: string, count = 0) => {
			const clean = cleanFolderPath(folder);
			if (!clean) return;
			suggestions.set(clean, (suggestions.get(clean) ?? 0) + count);
		};
		const preferred = [
			this.plugin.settings.homeQuickCaptureDefaultNoteFolder || "10 Inbox",
			this.plugin.settings.homeProjectsPath || "20 Projects",
			this.plugin.settings.homeContentPath || "30 Content",
			"40 Resources",
			"45 Study",
			"50 Archive",
		];
		for (const folder of preferred) {
			addFolder(folder, 0);
		}

		for (const entry of this.obsidianApp.vault.getAllLoadedFiles()) {
			if (entry instanceof TFile) {
				const folder = getFolder(entry.path);
				if (folder) addFolder(folder, 1);
			} else if (entry.path) {
				addFolder(entry.path, 0);
			}
		}

		return this.rankSuggestionMap(suggestions, preferred.map(cleanFolderPath));
	}

	private isInboxFile(file: TFile): boolean {
		const inbox = cleanFolderPath(this.plugin.settings.homeQuickCaptureDefaultNoteFolder || "10 Inbox");
		return Boolean(inbox) && (file.path.startsWith(`${inbox}/`) || file.path === `${inbox}.md`);
	}

	private async applyClassification(item: TriageItem, file: TFile, classification: TriageClassificationInput): Promise<void> {
		try {
			let targetFile = file;
			if (classification.moveFile) {
				const folder = cleanFolderPath(classification.destinationFolder);
				await this.ensureFolder(folder);
				const targetPath = this.getUniqueDestinationPath(folder, file);
				if (targetPath !== file.path) {
					await this.obsidianApp.vault.rename(file, targetPath);
					const moved = this.obsidianApp.vault.getAbstractFileByPath(targetPath);
					if (moved instanceof TFile) targetFile = moved;
				}
			}

			await this.writeClassificationFrontmatter(targetFile, classification);
			await this.resolveItem({
				...item,
				title: targetFile.basename,
				subtitle: targetFile.path,
				path: targetFile.path,
				file: targetFile,
				updatedAt: Date.now(),
			}, classification.project || undefined, false);
			new Notice(t("Classified and routed"));
		} catch (error) {
			console.error("umOS: failed to classify triage item", error);
			new Notice(t("Could not classify item"));
		}
	}

	private async writeClassificationFrontmatter(file: TFile, classification: TriageClassificationInput): Promise<void> {
		await this.obsidianApp.fileManager.processFrontMatter(file, (frontmatter) => {
			const setOrDelete = (key: string, value: string) => {
				const clean = value.trim();
				if (clean) frontmatter[key] = clean;
				else delete frontmatter[key];
			};

			setOrDelete("type", classification.type);
			setOrDelete("area", classification.area);
			setOrDelete("classification", classification.classification);
			setOrDelete("topic", classification.topic);
			setOrDelete("project", classification.project);
			setOrDelete("content_type", classification.contentType);
			if (classification.markTriaged) frontmatter.triage = "done";

			const nextTags = parseTags(classification.tags);
			if (nextTags.length > 0) frontmatter.tags = nextTags;
			else delete frontmatter.tags;
		});
	}

	private async ensureFolder(folder: string): Promise<void> {
		const clean = cleanFolderPath(folder);
		if (!clean) return;
		const parts = clean.split("/").filter(Boolean);
		let current = "";
		for (const part of parts) {
			current = current ? `${current}/${part}` : part;
			if (!this.obsidianApp.vault.getAbstractFileByPath(current)) {
				await this.obsidianApp.vault.createFolder(current);
			}
		}
	}

	private getUniqueDestinationPath(folder: string, file: TFile): string {
		const cleanFolder = cleanFolderPath(folder);
		const firstPath = normalizePath(`${cleanFolder}/${file.name}`).replace(/^\/+/, "");
		if (firstPath === file.path || !this.obsidianApp.vault.getAbstractFileByPath(firstPath)) return firstPath;

		const extension = file.extension ? `.${file.extension}` : "";
		for (let index = 2; index < 1000; index++) {
			const candidate = normalizePath(`${cleanFolder}/${file.basename}-${index}${extension}`).replace(/^\/+/, "");
			if (!this.obsidianApp.vault.getAbstractFileByPath(candidate)) return candidate;
		}
		return normalizePath(`${cleanFolder}/${file.basename}-${Date.now()}${extension}`).replace(/^\/+/, "");
	}

	private async linkProject(item: TriageItem, projectPath: string): Promise<void> {
		try {
			if (item.kind === "task" && item.task) {
				await this.linkTaskToProject(item.task, projectPath);
			} else if ((item.kind === "note" || item.kind === "file") && item.file) {
				await this.writeProjectFrontmatter(item.file, projectPath);
			} else if (item.kind === "image" && item.file) {
				await this.writeImageSidecar(item.file, projectPath);
			} else if (item.kind === "capture" && item.path) {
				const file = this.obsidianApp.vault.getAbstractFileByPath(item.path);
				if (file instanceof TFile && file.extension.toLowerCase() === "md") {
					await this.writeProjectFrontmatter(file, projectPath);
				}
			}
			new Notice(t("Linked to project"));
			await this.resolveItem(item, projectPath);
		} catch (error) {
			console.error("umOS: failed to link triage item to project", error);
			new Notice(t("Could not link project"));
		}
	}

	private async linkTaskToProject(task: Task, projectPath: string): Promise<void> {
		const target = stripMdExtension(projectPath);
		const link = `[[${target}]]`;
		if (!task.description.includes(link)) {
			task.description = `${task.description.trim()} ${link}`.trim();
		}
		await new TaskService(this.obsidianApp, this.plugin).updateTask(task);
	}

	private async writeProjectFrontmatter(file: TFile, projectPath: string): Promise<void> {
		await this.obsidianApp.fileManager.processFrontMatter(file, (frontmatter) => {
			frontmatter.project = projectPath;
			if (!frontmatter.triage) frontmatter.triage = "done";
		});
	}

	private async writeImageSidecar(file: TFile, projectPath: string): Promise<void> {
		const sidecarPath = normalizePath(`${getFolder(file.path)}/${file.basename}.md`).replace(/^\//, "");
		const sidecar = this.obsidianApp.vault.getAbstractFileByPath(sidecarPath);
		if (sidecar instanceof TFile) {
			await this.writeProjectFrontmatter(sidecar, projectPath);
			return;
		}

		const content = [
			"---",
			"type: image",
			`image: "${file.path}"`,
			`project: "${projectPath}"`,
			"description: \"\"",
			"triage: done",
			"---",
			"",
			`# ${file.basename}`,
			"",
			`![[${file.path}]]`,
			"",
		].join("\n");
		await this.obsidianApp.vault.create(sidecarPath, content);
	}

	private async deleteItem(item: TriageItem): Promise<void> {
		const confirmed = window.confirm(`${t("Delete triage item?")}\n\n${item.title}`);
		if (!confirmed) return;

		try {
			if (item.kind === "task" && item.task) {
				await new TaskService(this.obsidianApp, this.plugin).deleteTask(item.task);
			} else if (item.kind === "capture" && item.capture) {
				this.plugin.data_store.commandHistory = (this.plugin.data_store.commandHistory ?? [])
					.filter((entry) => entry.executedAt !== item.capture!.executedAt || entry.raw !== item.capture!.raw);
				await this.plugin.saveSettings();
			} else if (item.file) {
				await this.obsidianApp.vault.trash(item.file, true);
			}

			await this.resolveItem(item);
			new Notice(t("Triage item deleted"));
		} catch (error) {
			console.error("umOS: failed to delete triage item", error);
			new Notice(t("Could not delete triage item"));
		}
	}

	private collectProjects(): ProjectOption[] {
		const root = normalizePath(this.plugin.settings.homeProjectsPath || "20 Projects").replace(/\/+$/, "");
		const files = this.obsidianApp.vault.getMarkdownFiles()
			.filter((file) => file.path.startsWith(`${root}/`) || this.getFrontmatter(file)?.type === "project")
			.sort((a, b) => a.basename.localeCompare(b.basename));
		return files.map((file) => ({ label: file.basename, path: file.path }));
	}

	private getKindLabel(kind: Exclude<TriageKind, "all">): string {
		switch (kind) {
			case "task": return t("Task");
			case "note": return t("Quick note");
			case "image": return t("Image");
			case "file": return t("File");
			case "capture": return t("Capture");
		}
	}

	private formatAge(timestamp: number): string {
		const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
		if (minutes < 1) return t("just now");
		if (minutes < 60) return `${minutes} ${t("min ago")}`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours} ${t("h ago")}`;
		const days = Math.floor(hours / 24);
		return `${days} ${t("d ago")}`;
	}

	private getSeverityRank(severity: TriageSeverity): number {
		if (severity === "high") return 3;
		if (severity === "medium") return 2;
		return 1;
	}

	private ensureTriageStore() {
		if (!this.plugin.data_store.triage) {
			this.plugin.data_store.triage = {
				resolved: {},
				snoozedUntil: {},
				linkedProjects: {},
				reopened: {},
			};
		}
		this.plugin.data_store.triage.resolved ??= {};
		this.plugin.data_store.triage.snoozedUntil ??= {};
		this.plugin.data_store.triage.linkedProjects ??= {};
		this.plugin.data_store.triage.reopened ??= {};
		return this.plugin.data_store.triage;
	}
}
