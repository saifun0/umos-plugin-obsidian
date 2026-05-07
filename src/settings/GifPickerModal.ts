import { App, Modal, Notice, Setting, TFile } from "obsidian";
import type { GifLibraryItem } from "./Settings";

interface GifPickerOptions {
	currentPath: string;
	library: GifLibraryItem[];
	onChoose: (path: string, nextLibrary: GifLibraryItem[]) => Promise<void>;
	onLibraryChange: (nextLibrary: GifLibraryItem[]) => Promise<void>;
}

const IMAGE_EXTENSIONS = new Set(["gif", "png", "jpg", "jpeg", "webp", "avif", "svg"]);

export class GifPickerModal extends Modal {
	private library: GifLibraryItem[];
	private query = "";
	private gridEl: HTMLElement | null = null;

	constructor(app: App, private options: GifPickerOptions) {
		super(app);
		this.library = [...options.library];
	}

	onOpen(): void {
		this.modalEl.addClass("umos-gif-picker-modal");
		this.render();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "GIF / Image Picker" });

		const current = contentEl.createDiv({ cls: "umos-gif-picker-current" });
		current.createSpan({ text: "Currently selected", cls: "umos-gif-picker-current-label" });
		current.createSpan({
			text: this.options.currentPath || "Nothing selected",
			cls: "umos-gif-picker-current-path",
		});

		this.renderQuickAdd(contentEl);
		this.renderSearch(contentEl);

		this.gridEl = contentEl.createDiv({ cls: "umos-gif-picker-grid" });
		this.renderGrid();
	}

	private renderQuickAdd(parent: HTMLElement): void {
		const wrap = parent.createDiv({ cls: "umos-gif-picker-add" });
		let value = "";

		new Setting(wrap)
			.setName("Quick Add")
			.setDesc("Image/GIF URL or path inside the vault.")
			.addText((text) => {
				text.setPlaceholder("https://... or 00 Files/anim.gif")
					.onChange((next) => {
						value = next.trim();
					});
				text.inputEl.addEventListener("keydown", (event) => {
					if (event.key === "Enter") {
						event.preventDefault();
						void this.addAndChoose(value);
					}
				});
			})
			.addButton((button) => button
				.setButtonText("Add and choose")
				.setCta()
				.onClick(() => void this.addAndChoose(value)));
	}

	private renderSearch(parent: HTMLElement): void {
		const search = parent.createDiv({ cls: "umos-gif-picker-search" });
		const input = search.createEl("input", {
			cls: "umos-gif-picker-search-input",
			attr: { type: "text", placeholder: "Search by name or path..." },
		}) as HTMLInputElement;
		input.addEventListener("input", () => {
			this.query = input.value.trim().toLowerCase();
			this.renderGrid();
		});
	}

	private renderGrid(): void {
		if (!this.gridEl) return;
		this.gridEl.empty();

		const saved = this.filterItems(this.library);
		this.renderSection(this.gridEl, "Saved", saved, true);

		const vaultItems = this.getVaultImageItems()
			.filter((item) => !this.library.some((savedItem) => savedItem.path === item.path));
		this.renderSection(this.gridEl, "From vault", this.filterItems(vaultItems), false);
	}

	private renderSection(parent: HTMLElement, title: string, items: GifLibraryItem[], saved: boolean): void {
		const section = parent.createDiv({ cls: "umos-gif-picker-section" });
		section.createEl("h3", { text: `${title} (${items.length})` });

		if (items.length === 0) {
			section.createDiv({
				cls: "umos-gif-picker-empty",
				text: saved ? "No saved images yet." : "No images found in the vault.",
			});
			return;
		}

		const list = section.createDiv({ cls: "umos-gif-picker-card-grid" });
		for (const item of items) {
			this.renderCard(list, item, saved);
		}
	}

	private renderCard(parent: HTMLElement, item: GifLibraryItem, saved: boolean): void {
		const isActive = item.path === this.options.currentPath;
		const card = parent.createDiv({ cls: `umos-gif-picker-card${isActive ? " is-active" : ""}` });
		const preview = card.createDiv({ cls: "umos-gif-picker-preview" });
		const img = preview.createEl("img", {
			attr: { src: this.resolveImageSrc(item.path), alt: item.name, loading: "lazy" },
		});
		img.addEventListener("error", () => {
			preview.empty();
			preview.createDiv({ cls: "umos-gif-picker-broken", text: "No preview" });
		});

		card.createDiv({ cls: "umos-gif-picker-name", text: item.name });
		card.createDiv({ cls: "umos-gif-picker-path", text: item.path });

		const actions = card.createDiv({ cls: "umos-gif-picker-actions" });
		actions.createEl("button", { text: isActive ? "Selected" : "Choose" })
			.addEventListener("click", () => void this.choose(item.path, saved ? this.library : this.upsertItem(item)));
		if (!saved) {
			actions.createEl("button", { text: "Save" })
				.addEventListener("click", async () => {
					this.library = this.upsertItem(item);
					await this.options.onLibraryChange(this.library);
					new Notice("✅ Image saved");
					this.renderGrid();
				});
		} else {
			actions.createEl("button", { text: "Delete", cls: "mod-warning" })
				.addEventListener("click", async () => {
					this.library = this.library.filter((savedItem) => savedItem.id !== item.id);
					await this.options.onLibraryChange(this.library);
					this.renderGrid();
				});
		}
	}

	private async addAndChoose(rawValue: string): Promise<void> {
		const path = rawValue.trim();
		if (!path) {
			new Notice("Enter a URL or file path");
			return;
		}

		const item = this.createItem(path);
		this.library = this.upsertItem(item);
		await this.choose(path, this.library);
	}

	private async choose(path: string, nextLibrary: GifLibraryItem[]): Promise<void> {
		await this.options.onChoose(path, nextLibrary);
		this.close();
	}

	private upsertItem(item: GifLibraryItem): GifLibraryItem[] {
		const existingIndex = this.library.findIndex((saved) => saved.path === item.path);
		if (existingIndex === -1) return [...this.library, item];
		const next = [...this.library];
		next[existingIndex] = { ...next[existingIndex], ...item, id: next[existingIndex].id };
		return next;
	}

	private getVaultImageItems(): GifLibraryItem[] {
		return this.app.vault.getFiles()
			.filter((file) => IMAGE_EXTENSIONS.has(file.extension.toLowerCase()))
			.map((file) => this.createItem(file.path, file));
	}

	private filterItems(items: GifLibraryItem[]): GifLibraryItem[] {
		if (!this.query) return items;
		return items.filter((item) =>
			item.name.toLowerCase().includes(this.query) ||
			item.path.toLowerCase().includes(this.query)
		);
	}

	private createItem(path: string, file?: TFile): GifLibraryItem {
		const name = file?.basename || this.getNameFromPath(path);
		return {
			id: `gif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
			name,
			path,
		};
	}

	private getNameFromPath(path: string): string {
		try {
			const url = new URL(path);
			const last = url.pathname.split("/").filter(Boolean).pop();
			return decodeURIComponent(last || url.hostname || "Image");
		} catch {
			const last = path.split(/[\\/]/).filter(Boolean).pop();
			return last?.replace(/\.[^.]+$/, "") || "Image";
		}
	}

	private resolveImageSrc(path: string): string {
		if (/^https?:\/\//i.test(path) || path.startsWith("data:")) return path;
		const file = this.app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile) return this.app.vault.getResourcePath(file);
		return path;
	}
}
