import { App, EventRef, ItemView, Modal, Notice, TFile, WorkspaceLeaf, moment, normalizePath, setIcon } from "obsidian";
import type UmOSPlugin from "../main";
import { t } from "../i18n";

export const IMAGE_GALLERY_VIEW_TYPE = "umos-image-gallery-view";

type ImageGallerySize = "small" | "medium" | "large";
type ImageGallerySort = "modified-desc" | "name-asc" | "folder-asc" | "size-desc";

interface ImageEntry {
	file: TFile;
	path: string;
	name: string;
	extension: string;
	folder: string;
	size: number;
	modified: number;
	resourcePath: string;
}

const IMAGE_EXTENSIONS = new Set(["avif", "bmp", "gif", "jpeg", "jpg", "png", "svg", "webp"]);
const INVALID_IMAGE_NAME_CHARS = /[\\/:*?"<>|]/;

function getFolderPath(path: string): string {
	const lastSlash = path.lastIndexOf("/");
	return lastSlash === -1 ? "" : path.slice(0, lastSlash);
}

function getImageRenameBase(rawName: string): string {
	const trimmed = rawName.trim();
	const extensionMatch = trimmed.match(/\.([^.]+)$/);
	if (extensionMatch && IMAGE_EXTENSIONS.has(extensionMatch[1].toLowerCase())) {
		return trimmed.slice(0, -(extensionMatch[1].length + 1)).trim();
	}
	return trimmed;
}

function getImageRenameTarget(file: TFile, rawName: string): { path: string; error?: string } {
	const baseName = getImageRenameBase(rawName);
	if (!baseName) return { path: file.path, error: "Name cannot be empty" };
	if (INVALID_IMAGE_NAME_CHARS.test(baseName)) {
		return { path: file.path, error: "Name cannot contain / \\ : * ? \" < > |" };
	}
	if (/^\.+$/.test(baseName) || baseName.endsWith(".")) {
		return { path: file.path, error: "Name cannot end with a dot" };
	}

	const folder = getFolderPath(file.path);
	const newName = `${baseName}.${file.extension}`;
	return { path: normalizePath(folder ? `${folder}/${newName}` : newName) };
}

class ImageRenameModal extends Modal {
	private file: TFile;
	private onSubmit: (newPath: string) => Promise<boolean>;

	constructor(app: App, file: TFile, onSubmit: (newPath: string) => Promise<boolean>) {
		super(app);
		this.file = file;
		this.onSubmit = onSubmit;
	}

	onOpen(): void {
		this.modalEl.classList.add("umos-image-rename-modal");
		this.contentEl.empty();

		const shell = this.contentEl.createDiv({ cls: "umos-image-rename-shell" });
		shell.createEl("h2", { cls: "umos-image-rename-title", text: t("Rename image") });
		shell.createDiv({ cls: "umos-image-rename-current", text: this.file.path });

		const label = shell.createEl("label", { cls: "umos-image-rename-field" });
		label.createSpan({ cls: "umos-image-rename-label", text: t("New name") });
		const input = label.createEl("input", {
			cls: "umos-image-rename-input",
			attr: { type: "text", value: this.file.basename },
		});
		shell.createDiv({ cls: "umos-image-rename-help", text: t("Extension is kept automatically.") });
		const errorEl = shell.createDiv({ cls: "umos-image-rename-error" });

		const actions = shell.createDiv({ cls: "umos-image-rename-actions" });
		const cancel = actions.createEl("button", {
			cls: "umos-image-gallery-text-btn",
			text: t("Cancel"),
			attr: { type: "button" },
		});
		const save = actions.createEl("button", {
			cls: "umos-image-gallery-text-btn is-primary",
			text: t("Rename"),
			attr: { type: "button" },
		});

		const submit = async () => {
			const result = getImageRenameTarget(this.file, input.value);
			if (result.error) {
				errorEl.setText(t(result.error));
				return;
			}
			errorEl.setText("");
			const ok = await this.onSubmit(result.path);
			if (ok) this.close();
		};

		cancel.addEventListener("click", () => this.close());
		save.addEventListener("click", () => void submit());
		input.addEventListener("keydown", (event) => {
			if (event.key === "Enter") {
				event.preventDefault();
				void submit();
			}
			if (event.key === "Escape") {
				event.preventDefault();
				this.close();
			}
		});

		window.setTimeout(() => {
			input.focus();
			input.select();
		});
	}
}

export class ImageGalleryView extends ItemView {
	private obsidianApp: App;
	private plugin: UmOSPlugin;
	private contentContainerEl: HTMLElement | null = null;
	private renderTimeout: ReturnType<typeof setTimeout> | null = null;
	private renderToken = 0;
	private searchQuery = "";
	private selectedFolder = "all";
	private selectedType = "all";
	private sortMode: ImageGallerySort = "modified-desc";
	private sizeMode: ImageGallerySize = "medium";
	private selectedPath: string | null = null;

	constructor(leaf: WorkspaceLeaf, app: App, plugin: UmOSPlugin) {
		super(leaf);
		this.obsidianApp = app;
		this.plugin = plugin;
	}

	getViewType(): string {
		return IMAGE_GALLERY_VIEW_TYPE;
	}

	getDisplayText(): string {
		return t("Image Gallery");
	}

	getIcon(): string {
		return "images";
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.classList.add("umos-image-gallery-view-container");

		this.contentContainerEl = container.createDiv({ cls: "umos-image-gallery-view" });
		await this.renderAsync();

		const refresh = () => this.scheduleRender(250);
		const eventRefs: EventRef[] = [
			this.obsidianApp.vault.on("create", refresh),
			this.obsidianApp.vault.on("delete", refresh),
			this.obsidianApp.vault.on("modify", refresh),
			this.obsidianApp.vault.on("rename", refresh),
		];
		for (const ref of eventRefs) this.registerEvent(ref);

		const settingsHandler = () => this.scheduleRender(120);
		this.plugin.eventBus.on("settings:changed", settingsHandler);
		this.register(() => this.plugin.eventBus.off("settings:changed", settingsHandler));
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
		const token = ++this.renderToken;
		this.contentContainerEl.empty();
		this.renderLoading();

		const images = this.collectImages();
		if (token !== this.renderToken || !this.contentContainerEl) return;

		const filtered = this.filterAndSortImages(images);
		if (this.selectedPath && !filtered.some((entry) => entry.path === this.selectedPath)) {
			this.selectedPath = filtered[0]?.path ?? null;
		} else if (!this.selectedPath && filtered.length > 0) {
			this.selectedPath = filtered[0].path;
		}

		this.contentContainerEl.empty();
		const root = this.contentContainerEl.createDiv({ cls: "umos-image-gallery" });
		this.renderToolbar(root, images, filtered);
		this.renderStats(root, images, filtered);

		if (images.length === 0) {
			this.renderEmpty(root, "No images found", "Add images to the vault and refresh the gallery.");
			return;
		}

		if (filtered.length === 0) {
			this.renderEmpty(root, "No matching images", "Try another folder, type, or search query.");
			return;
		}

		const selected = filtered.find((entry) => entry.path === this.selectedPath) ?? filtered[0];
		const layout = root.createDiv({ cls: "umos-image-gallery-layout" });
		this.renderGrid(layout, filtered, selected);
		this.renderDetail(layout, selected);
	}

	private renderLoading(): void {
		if (!this.contentContainerEl) return;
		const shell = this.contentContainerEl.createDiv({ cls: "umos-image-gallery" });
		const toolbar = shell.createDiv({ cls: "umos-image-gallery-toolbar" });
		toolbar.createDiv({ cls: "umos-image-gallery-title", text: t("Image Gallery") });
		shell.createDiv({ cls: "umos-image-gallery-loading", text: t("Loading image gallery...") });
	}

	private renderToolbar(parent: HTMLElement, images: ImageEntry[], filtered: ImageEntry[]): void {
		const toolbar = parent.createDiv({ cls: "umos-image-gallery-toolbar" });

		const titleWrap = toolbar.createDiv({ cls: "umos-image-gallery-title-wrap" });
		const title = titleWrap.createDiv({ cls: "umos-image-gallery-title" });
		const icon = title.createSpan({ cls: "umos-image-gallery-title-icon" });
		setIcon(icon, "images");
		title.createSpan({ text: t("Image Gallery") });
		titleWrap.createDiv({
			cls: "umos-image-gallery-subtitle",
			text: `${filtered.length} ${t("images")} - ${this.getFolders(images).length} ${t("folders")}`,
		});

		const controls = toolbar.createDiv({ cls: "umos-image-gallery-controls" });

		const search = controls.createEl("input", {
			cls: "umos-image-gallery-search",
			attr: {
				type: "search",
				placeholder: t("Search images..."),
				value: this.searchQuery,
			},
		});
		search.addEventListener("input", () => {
			this.searchQuery = search.value;
			this.scheduleRender(80);
		});

		this.renderSelect(controls, "Type", this.selectedType, this.getTypeOptions(images), (value) => {
			this.selectedType = value;
			void this.renderAsync();
		});

		this.renderSelect(controls, "Folder", this.selectedFolder, this.getFolderOptions(images), (value) => {
			this.selectedFolder = value;
			void this.renderAsync();
		});

		this.renderSelect(controls, "Sort", this.sortMode, [
			["modified-desc", "Newest first"],
			["name-asc", "Name A-Z"],
			["folder-asc", "Folder A-Z"],
			["size-desc", "Largest first"],
		], (value) => {
			this.sortMode = this.normalizeSort(value);
			void this.renderAsync();
		});

		const sizePicker = controls.createDiv({ cls: "umos-image-gallery-size" });
		this.renderSizeButton(sizePicker, "small", "Small");
		this.renderSizeButton(sizePicker, "medium", "Medium");
		this.renderSizeButton(sizePicker, "large", "Large");

		this.createIconButton(controls, "refresh-cw", "Refresh", () => void this.renderAsync());
	}

	private renderStats(parent: HTMLElement, images: ImageEntry[], filtered: ImageEntry[]): void {
		const stats = parent.createDiv({ cls: "umos-image-gallery-stats" });
		this.renderStat(stats, "image", "All images", String(images.length));
		this.renderStat(stats, "filter", "Visible", String(filtered.length));
		this.renderStat(stats, "folder", "Folders", String(this.getFolders(images).length));
		this.renderStat(stats, "hard-drive", "Total size", this.formatBytes(images.reduce((sum, entry) => sum + entry.size, 0)));
	}

	private renderStat(parent: HTMLElement, iconName: string, label: string, value: string): void {
		const item = parent.createDiv({ cls: "umos-image-gallery-stat" });
		const icon = item.createSpan({ cls: "umos-image-gallery-stat-icon" });
		setIcon(icon, iconName);
		const body = item.createDiv({ cls: "umos-image-gallery-stat-body" });
		body.createDiv({ cls: "umos-image-gallery-stat-value", text: value });
		body.createDiv({ cls: "umos-image-gallery-stat-label", text: t(label) });
	}

	private renderGrid(parent: HTMLElement, entries: ImageEntry[], selected: ImageEntry): void {
		const grid = parent.createDiv({ cls: `umos-image-gallery-grid is-${this.sizeMode}` });

		for (const entry of entries) {
			const card = grid.createDiv({
				cls: `umos-image-gallery-card${entry.path === selected.path ? " is-selected" : ""}`,
				attr: { role: "button", tabindex: "0", title: entry.path },
			});
			const selectImage = () => {
				this.selectedPath = entry.path;
				void this.renderAsync();
			};
			card.addEventListener("click", selectImage);
			card.addEventListener("keydown", (event) => {
				if (event.key !== "Enter" && event.key !== " ") return;
				event.preventDefault();
				selectImage();
			});
			card.addEventListener("dblclick", () => void this.openImage(entry.file));

			const preview = card.createDiv({ cls: "umos-image-gallery-card-preview" });
			const img = preview.createEl("img", {
				attr: {
					src: entry.resourcePath,
					alt: entry.name,
					loading: "lazy",
				},
			});
			img.addEventListener("error", () => {
				preview.addClass("is-broken");
				preview.empty();
				const icon = preview.createSpan({ cls: "umos-image-gallery-broken-icon" });
				setIcon(icon, "image-off");
				preview.createSpan({ cls: "umos-image-gallery-broken-text", text: t("Preview unavailable") });
			}, { once: true });

			const meta = card.createDiv({ cls: "umos-image-gallery-card-meta" });
			meta.createDiv({ cls: "umos-image-gallery-card-name", text: entry.name });
			meta.createDiv({ cls: "umos-image-gallery-card-subtitle", text: `${entry.extension.toUpperCase()} - ${this.formatBytes(entry.size)}` });
		}
	}

	private renderDetail(parent: HTMLElement, entry: ImageEntry): void {
		const detail = parent.createDiv({ cls: "umos-image-gallery-detail" });
		detail.createDiv({ cls: "umos-image-gallery-detail-kicker", text: t("Selected image") });

		const preview = detail.createDiv({ cls: "umos-image-gallery-detail-preview" });
		preview.createEl("img", {
			attr: {
				src: entry.resourcePath,
				alt: entry.name,
			},
		});

		detail.createDiv({ cls: "umos-image-gallery-detail-title", text: entry.name });
		detail.createDiv({ cls: "umos-image-gallery-detail-path", text: entry.path });

		const meta = detail.createDiv({ cls: "umos-image-gallery-detail-meta" });
		this.renderMetaRow(meta, "Folder", entry.folder);
		this.renderMetaRow(meta, "Type", entry.extension.toUpperCase());
		this.renderMetaRow(meta, "Size", this.formatBytes(entry.size));
		this.renderMetaRow(meta, "Modified", moment(entry.modified).format("YYYY-MM-DD HH:mm"));

		const actions = detail.createDiv({ cls: "umos-image-gallery-detail-actions" });
		this.createTextButton(actions, "Open image", () => void this.openImage(entry.file), "external-link");
		this.createTextButton(actions, "Copy path", () => void this.copyPath(entry.path), "copy");
		this.createTextButton(actions, "Rename", () => this.openRenameModal(entry), "pencil");
		this.createTextButton(actions, "Delete", () => void this.deleteImage(entry), "trash-2", "is-danger");
	}

	private renderMetaRow(parent: HTMLElement, label: string, value: string): void {
		const row = parent.createDiv({ cls: "umos-image-gallery-meta-row" });
		row.createSpan({ cls: "umos-image-gallery-meta-label", text: t(label) });
		row.createSpan({ cls: "umos-image-gallery-meta-value", text: value });
	}

	private renderEmpty(parent: HTMLElement, title: string, desc: string): void {
		const empty = parent.createDiv({ cls: "umos-image-gallery-empty" });
		const icon = empty.createDiv({ cls: "umos-image-gallery-empty-icon" });
		setIcon(icon, "image");
		empty.createDiv({ cls: "umos-image-gallery-empty-title", text: t(title) });
		empty.createDiv({ cls: "umos-image-gallery-empty-desc", text: t(desc) });
	}

	private renderSelect(
		parent: HTMLElement,
		label: string,
		value: string,
		options: Array<[string, string]>,
		onChange: (value: string) => void,
	): void {
		const wrap = parent.createEl("label", { cls: "umos-image-gallery-select" });
		wrap.createSpan({ text: t(label) });
		const select = wrap.createEl("select");
		for (const [optionValue, optionLabel] of options) {
			select.createEl("option", {
				text: t(optionLabel),
				value: optionValue,
			});
		}
		select.value = value;
		select.addEventListener("change", () => onChange(select.value));
	}

	private renderSizeButton(parent: HTMLElement, size: ImageGallerySize, label: string): void {
		const button = parent.createEl("button", {
			cls: `umos-image-gallery-size-btn${this.sizeMode === size ? " is-active" : ""}`,
			text: t(label),
			attr: { type: "button" },
		});
		button.addEventListener("click", () => {
			this.sizeMode = size;
			void this.renderAsync();
		});
	}

	private createIconButton(parent: HTMLElement, iconName: string, label: string, onClick: () => void): HTMLButtonElement {
		const button = parent.createEl("button", {
			cls: "umos-image-gallery-icon-btn",
			attr: { type: "button", "aria-label": t(label), title: t(label) },
		});
		setIcon(button, iconName);
		button.addEventListener("click", onClick);
		return button;
	}

	private createTextButton(
		parent: HTMLElement,
		label: string,
		onClick: () => void,
		iconName?: string,
		extraClass = "",
	): HTMLButtonElement {
		const button = parent.createEl("button", {
			cls: `umos-image-gallery-text-btn${extraClass ? ` ${extraClass}` : ""}`,
			attr: { type: "button" },
		});
		if (iconName) {
			const icon = button.createSpan({ cls: "umos-image-gallery-text-btn-icon" });
			setIcon(icon, iconName);
		}
		button.createSpan({ text: t(label) });
		button.addEventListener("click", onClick);
		return button;
	}

	private collectImages(): ImageEntry[] {
		return this.obsidianApp.vault.getFiles()
			.filter((file) => IMAGE_EXTENSIONS.has(file.extension.toLowerCase()))
			.map((file) => ({
				file,
				path: file.path,
				name: file.name,
				extension: file.extension.toLowerCase(),
				folder: this.getFolder(file.path),
				size: file.stat.size,
				modified: file.stat.mtime,
				resourcePath: this.obsidianApp.vault.getResourcePath(file),
			}));
	}

	private filterAndSortImages(images: ImageEntry[]): ImageEntry[] {
		const query = this.searchQuery.trim().toLowerCase();
		const filtered = images.filter((entry) => {
			if (this.selectedType !== "all" && entry.extension !== this.selectedType) return false;
			if (this.selectedFolder !== "all" && entry.folder !== this.selectedFolder) return false;
			if (!query) return true;
			return entry.name.toLowerCase().includes(query)
				|| entry.path.toLowerCase().includes(query)
				|| entry.extension.toLowerCase().includes(query);
		});

		return filtered.sort((a, b) => {
			switch (this.sortMode) {
				case "name-asc":
					return a.name.localeCompare(b.name);
				case "folder-asc":
					return a.folder.localeCompare(b.folder) || a.name.localeCompare(b.name);
				case "size-desc":
					return b.size - a.size || a.name.localeCompare(b.name);
				case "modified-desc":
				default:
					return b.modified - a.modified || a.name.localeCompare(b.name);
			}
		});
	}

	private getFolder(path: string): string {
		const parts = path.split("/");
		if (parts.length <= 1) return "Vault root";
		return parts.slice(0, -1).join("/");
	}

	private getFolders(images: ImageEntry[]): string[] {
		return Array.from(new Set(images.map((entry) => entry.folder))).sort((a, b) => a.localeCompare(b));
	}

	private getFolderOptions(images: ImageEntry[]): Array<[string, string]> {
		return [["all", "All folders"], ...this.getFolders(images).map((folder): [string, string] => [folder, folder])];
	}

	private getTypeOptions(images: ImageEntry[]): Array<[string, string]> {
		const types = Array.from(new Set(images.map((entry) => entry.extension))).sort();
		return [["all", "All types"], ...types.map((type): [string, string] => [type, type.toUpperCase()])];
	}

	private normalizeSort(value: string): ImageGallerySort {
		if (value === "name-asc" || value === "folder-asc" || value === "size-desc") return value;
		return "modified-desc";
	}

	private formatBytes(bytes: number): string {
		if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
		const units = ["B", "KB", "MB", "GB"];
		let value = bytes;
		let unit = 0;
		while (value >= 1024 && unit < units.length - 1) {
			value /= 1024;
			unit++;
		}
		return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
	}

	private async openImage(file: TFile): Promise<void> {
		const leaf = this.obsidianApp.workspace.getLeaf("tab");
		await leaf.openFile(file);
		this.obsidianApp.workspace.revealLeaf(leaf);
	}

	private openRenameModal(entry: ImageEntry): void {
		const file = this.getFreshImageFile(entry.path);
		if (!file) {
			new Notice(t("Image not found"));
			void this.renderAsync();
			return;
		}

		new ImageRenameModal(this.obsidianApp, file, (newPath) => this.renameImage(entry.path, newPath)).open();
	}

	private async renameImage(oldPath: string, newPath: string): Promise<boolean> {
		const file = this.getFreshImageFile(oldPath);
		if (!file) {
			new Notice(t("Image not found"));
			void this.renderAsync();
			return false;
		}

		if (newPath === file.path) {
			new Notice(t("Image name unchanged"));
			return false;
		}

		const existing = this.obsidianApp.vault.getAbstractFileByPath(newPath);
		if (existing && existing !== file) {
			new Notice(t("A file with this name already exists"));
			return false;
		}

		try {
			await this.obsidianApp.vault.rename(file, newPath);
			this.selectedPath = newPath;
			new Notice(t("Image renamed"));
			await this.renderAsync();
			return true;
		} catch (error) {
			console.error("umOS image rename failed", error);
			new Notice(t("Could not rename image"));
			return false;
		}
	}

	private async deleteImage(entry: ImageEntry): Promise<void> {
		const file = this.getFreshImageFile(entry.path);
		if (!file) {
			new Notice(t("Image not found"));
			await this.renderAsync();
			return;
		}

		const confirmed = window.confirm(`${t("Delete image?")}\n\n${entry.name}\n\n${t("The file will be moved to trash.")}`);
		if (!confirmed) return;

		this.selectedPath = this.getNextSelectedPath(entry.path);

		try {
			await this.obsidianApp.vault.trash(file, true);
			new Notice(t("Image moved to trash"));
			await this.renderAsync();
		} catch (error) {
			console.error("umOS image delete failed", error);
			new Notice(t("Could not delete image"));
			this.selectedPath = entry.path;
		}
	}

	private getFreshImageFile(path: string): TFile | null {
		const file = this.obsidianApp.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) return null;
		return IMAGE_EXTENSIONS.has(file.extension.toLowerCase()) ? file : null;
	}

	private getNextSelectedPath(path: string): string | null {
		const images = this.filterAndSortImages(this.collectImages());
		const remaining = images.filter((entry) => entry.path !== path);
		if (remaining.length === 0) return null;

		const index = images.findIndex((entry) => entry.path === path);
		if (index === -1) return remaining[0].path;
		return remaining[Math.min(index, remaining.length - 1)]?.path ?? remaining[0].path;
	}

	private async copyPath(path: string): Promise<void> {
		try {
			await navigator.clipboard.writeText(path);
			new Notice(t("Image path copied"));
		} catch {
			new Notice(path);
		}
	}
}
