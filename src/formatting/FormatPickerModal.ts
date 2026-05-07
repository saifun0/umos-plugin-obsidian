import { App, Modal, Setting } from "obsidian";

interface FormatItem {
	id: string;
	category: string;
	icon: string;
	name: string;
	desc: string;
	snippet: string;
	/** If true, snippet replaces frontmatter cssclasses (special handling) */
	isCssClass?: boolean;
	/** If true, snippet must start on its own blank line */
	isBlock?: boolean;
}

const ITEMS: FormatItem[] = [
	// ── Callouts ─────────────────────────────────────────────────────
	{
		id: "callout-focus",
		category: "Callouts",
		icon: "⚡",
		name: "Focus — Important",
		desc: "Accent block, purple",
		snippet: "> [!focus-umos]\n> ",
		isBlock: true,
	},
	{
		id: "callout-focus-center",
		category: "Callouts",
		icon: "⚡",
		name: "Focus — Centered",
		desc: "Accent callout with the |center parameter",
		snippet: "> [!focus-umos|center]\n> ",
		isBlock: true,
	},
	{
		id: "callout-reflect",
		category: "Callouts",
		icon: "✍️",
		name: "Reflect — Reflection",
		desc: "Journal / personal thoughts, italic",
		snippet: "> [!reflect-umos] Thought\n> ",
		isBlock: true,
	},
	{
		id: "callout-verse",
		category: "Callouts",
		icon: "💬",
		name: "Verse — Quote / Verse",
		desc: "No title, large italic",
		snippet: "> [!verse-umos]\n> ",
		isBlock: true,
	},
	{
		id: "callout-verse-center",
		category: "Callouts",
		icon: "💬",
		name: "Verse — Centered",
		desc: "Quote / verse with the |center parameter",
		snippet: "> [!verse-umos|center]\n> ",
		isBlock: true,
	},
	{
		id: "callout-arabic",
		category: "Callouts",
		icon: "📖",
		name: "Arabic — Arabic Text",
		desc: "RTL, large Amiri font",
		snippet: "> [!arabic-umos] Ayah\n> ",
		isBlock: true,
	},
	{
		id: "callout-stat",
		category: "Callouts",
		icon: "📊",
		name: "Stat — Mini Stats",
		desc: "Horizontal numbers in text",
		snippet: "> [!stat-umos] Title\n> **42** tasks\n> **7** habits\n> **3** projects\n",
		isBlock: true,
	},

	// ── Dividers ───────────────────────────────────────────────────
	{
		id: "div-dots",
		category: "Dividers",
		icon: "·",
		name: "Dots  · · · · ·",
		desc: "Add cssclass umos-divider-dots to frontmatter",
		snippet: "umos-divider-dots",
		isCssClass: true,
	},
	{
		id: "div-ornament",
		category: "Dividers",
		icon: "✦",
		name: "Ornament  ──── ✦ ────",
		desc: "Add cssclass umos-divider-ornament to frontmatter",
		snippet: "umos-divider-ornament",
		isCssClass: true,
	},
	{
		id: "div-gradient",
		category: "Dividers",
		icon: "━",
		name: "Gradient ────────",
		desc: "Add cssclass umos-divider-gradient to frontmatter",
		snippet: "umos-divider-gradient",
		isCssClass: true,
	},

	// ── CSS-   ─────────────────────────────────────────
	{
		id: "cls-wide",
		category: "Note Classes",
		icon: "⟷",
		name: "Wide — Full width",
		desc: "Removes content max-width",
		snippet: "umos-wide",
		isCssClass: true,
	},
	{
		id: "cls-wide-soft",
		category: "Note Classes",
		icon: "↔",
		name: "Soft Wide — Soft wide",
		desc: "Wider than a regular note, but not full-screen",
		snippet: "umos-wide-soft",
		isCssClass: true,
	},
	{
		id: "cls-reading",
		category: "Note Classes",
		icon: "📚",
		name: "Reading — Reading Mode",
		desc: "Serif font, 68ch width, 1.85 line height",
		snippet: "umos-reading",
		isCssClass: true,
	},
	{
		id: "cls-no-title",
		category: "Note Classes",
		icon: "🔇",
		name: "No Title — Hide H1",
		desc: "Hides the first heading and inline title",
		snippet: "umos-no-title",
		isCssClass: true,
	},
	{
		id: "cls-columns",
		category: "Note Classes",
		icon: "⫶",
		name: "Columns — Two Columns",
		desc: "H1/H2 span full width, everything else uses 2 columns",
		snippet: "umos-columns",
		isCssClass: true,
	},
	{
		id: "cls-headings",
		category: "Note Classes",
		icon: "H",
		name: "Headings Accent — Colored Headings",
		desc: "H2/H3 with a colored bar on the left",
		snippet: "umos-headings-accent",
		isCssClass: true,
	},

	// ── Layout (cols-umos / info-umos) ────────────────────────────────
	{
		id: "cols-2",
		category: "Layout",
		icon: "⫶",
		name: "Columns — 2 Equal",
		desc: "Text in two columns, separated by ===",
		snippet: "```cols-umos\n## Left Column\nText in the first column.\n\n===\n\n## Right Column\nText in the second column.\n```",
		isBlock: true,
	},
	{
		id: "cols-3",
		category: "Layout",
		icon: "⫸",
		name: "Columns — 3 Equal",
		desc: "Text in three columns",
		snippet: "```cols-umos\n## Column 1\nText.\n\n===\n\n## Column 2\nText.\n\n===\n\n## Column 3\nText.\n```",
		isBlock: true,
	},
	{
		id: "cols-custom",
		category: "Layout",
		icon: "⚌",
		name: "Columns — set count",
		desc: "cols: N on the first line forces the count",
		snippet: "```cols-umos\ncols: 2\n\n## Column 1\nText.\n\n===\n\n## Column 2\nText.\n```",
		isBlock: true,
	},
	{
		id: "infobox",
		category: "Layout",
		icon: "🗂",
		name: "Infobox (Wikipedia-style)",
		desc: "Card to the right of text: title, photo, table",
		snippet: "```info-umos\ntitle: Name / Title\nimage: 00 Files/photo.png\ncaption: Photo caption\n---\nInformation\nField 1     | Value 1\nField 2     | Value 2\n\nActivity\nRole       | Description\n```",
		isBlock: true,
	},
	{
		id: "kanban-board",
		category: "Layout",
		icon: "📋",
		name: "Kanban Board",
		desc: "Board with columns and cards",
		snippet: "",
		isBlock: true,
	},

	// ── - ──────────────────────────────────────────────────
	{
		id: "mark-red",
		category: "Labels",
		icon: "🔴",
		name: "Mark — Red",
		desc: "Critical / important",
		snippet: '<mark class="umos-mark-red">text</mark>',
	},
	{
		id: "mark-green",
		category: "Labels",
		icon: "🟢",
		name: "Mark — Green",
		desc: "Done / ok",
		snippet: '<mark class="umos-mark-green">text</mark>',
	},
	{
		id: "mark-blue",
		category: "Labels",
		icon: "🔵",
		name: "Mark — Blue",
		desc: "Idea / note",
		snippet: '<mark class="umos-mark-blue">text</mark>',
	},
	{
		id: "mark-yellow",
		category: "Labels",
		icon: "🟡",
		name: "Mark — Yellow",
		desc: "Worth noting",
		snippet: '<mark class="umos-mark-yellow">text</mark>',
	},
	{
		id: "mark-purple",
		category: "Labels",
		icon: "🟣",
		name: "Mark — Purple",
		desc: "Question / unclear",
		snippet: '<mark class="umos-mark-purple">text</mark>',
	},
	{
		id: "pill",
		category: "Labels",
		icon: "🏷",
		name: "Pill Tag",
		desc: "Accent inline tag",
		snippet: '<span class="umos-pill">tag</span>',
	},
];

const CATEGORY_ORDER = ["Callouts", "Layout", "Dividers", "Note Classes", "Labels"];

export class FormatPickerModal extends Modal {
	private query = "";
	private focusedIdx = 0;
	private visibleItems: FormatItem[] = [];
	private listEl!: HTMLElement;
	private inputEl!: HTMLInputElement;

	constructor(app: App, private existingBoardIds: string[] = []) {
		super(app);
	}

	onOpen(): void {
		this.modalEl.addClass("umos-format-picker");
		this.buildUI();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private buildUI(): void {
		const { contentEl } = this;
		contentEl.empty();

		// ── Search ────────────────────────────────────────────────────
		const searchWrap = contentEl.createDiv({ cls: "umos-fp-search-wrap" });
		this.inputEl = searchWrap.createEl("input", {
			cls: "umos-fp-search",
			attr: { type: "text", placeholder: "Search formatting..." },
		}) as HTMLInputElement;

		// ── List ──────────────────────────────────────────────────────
		this.listEl = contentEl.createDiv({ cls: "umos-fp-list" });

		// ── Events ────────────────────────────────────────────────────
		this.inputEl.addEventListener("input", () => {
			this.query = this.inputEl.value;
			this.focusedIdx = 0;
			this.renderList();
		});

		this.inputEl.addEventListener("keydown", (e) => {
			if (e.key === "ArrowDown") { e.preventDefault(); this.moveFocus(1); }
			else if (e.key === "ArrowUp") { e.preventDefault(); this.moveFocus(-1); }
			else if (e.key === "Enter") { e.preventDefault(); this.insertFocused(); }
			else if (e.key === "Escape") { this.close(); }
		});

		this.renderList();
		//
		setTimeout(() => this.inputEl.focus(), 50);
	}

	private renderList(): void {
		this.listEl.empty();

		const q = this.query.toLowerCase().trim();
		const filtered = q
			? ITEMS.filter(
				(i) =>
					i.name.toLowerCase().includes(q) ||
					i.desc.toLowerCase().includes(q) ||
					i.category.toLowerCase().includes(q)
			)
			: ITEMS;

		this.visibleItems = filtered;
		if (this.focusedIdx >= filtered.length) this.focusedIdx = 0;

		if (filtered.length === 0) {
			this.listEl.createDiv({ cls: "umos-fp-empty", text: "Nothing found" });
			return;
		}

		let globalIdx = 0;

		if (q) {
			//
			for (const item of filtered) {
				this.renderItem(item, globalIdx++);
			}
		} else {
			for (const cat of CATEGORY_ORDER) {
				const group = filtered.filter((i) => i.category === cat);
				if (group.length === 0) continue;

				this.listEl.createDiv({ cls: "umos-fp-category", text: cat });
				for (const item of group) {
					this.renderItem(item, globalIdx++);
				}
			}
		}
	}

	private renderItem(item: FormatItem, idx: number): void {
		const row = this.listEl.createDiv({
			cls: `umos-fp-item${idx === this.focusedIdx ? " is-focused" : ""}`,
			attr: { "data-idx": String(idx) },
		});

		row.createSpan({ cls: "umos-fp-item-icon", text: item.icon });

		const text = row.createDiv({ cls: "umos-fp-item-text" });
		text.createSpan({ cls: "umos-fp-item-name", text: item.name });
		text.createSpan({ cls: "umos-fp-item-desc", text: item.desc });

		const badge = row.createSpan({
			cls: "umos-fp-item-badge",
			text: item.isCssClass ? "cssclass" : "insert",
		});
		if (item.isCssClass) badge.addClass("umos-fp-item-badge--cls");

		row.addEventListener("click", () => this.insertItem(item));
		row.addEventListener("mouseenter", () => {
			this.focusedIdx = idx;
			this.highlightFocused();
		});
	}

	private moveFocus(delta: number): void {
		const len = this.visibleItems.length;
		if (len === 0) return;
		this.focusedIdx = (this.focusedIdx + delta + len) % len;
		this.highlightFocused();
		//
		const focused = this.listEl.querySelector(".umos-fp-item.is-focused");
		focused?.scrollIntoView({ block: "nearest" });
	}

	private highlightFocused(): void {
		this.listEl.querySelectorAll(".umos-fp-item").forEach((el, i) => {
			el.toggleClass("is-focused", i === this.focusedIdx);
		});
	}

	private insertFocused(): void {
		const item = this.visibleItems[this.focusedIdx];
		if (item) this.insertItem(item);
	}

	private insertItem(item: FormatItem): void {
		if (item.id === "kanban-board") {
			const app = this.app;
			const boardIds = this.existingBoardIds;
			this.close();
			new KanbanBoardPickerModal(app, boardIds, (boardId) => {
				const snippet = "```kanban-board\nid: " + boardId + "\n```";
				const editor = app.workspace.activeEditor?.editor;
				if (!editor) return;
				const cursor = editor.getCursor();
				const lineText = editor.getLine(cursor.line);
				const beforeCursor = lineText.slice(0, cursor.ch);
				if (beforeCursor.trim() !== "") {
					editor.replaceSelection("\n\n" + snippet);
				} else if (cursor.line > 0) {
					const prevLine = editor.getLine(cursor.line - 1);
					if (prevLine.trim() !== "") {
						editor.replaceSelection("\n" + snippet);
					} else {
						editor.replaceSelection(snippet);
					}
				} else {
					editor.replaceSelection(snippet);
				}
			}).open();
			return;
		}
		if (item.isCssClass) {
			this.addCssClass(item.snippet);
		} else {
			this.insertSnippet(item.snippet, item.isBlock ?? false);
		}
		this.close();
	}

	/** Insert     */
	private insertSnippet(snippet: string, isBlock: boolean): void {
		const editor = this.app.workspace.activeEditor?.editor;
		if (!editor) return;

		if (isBlock) {
			//   ()
			const cursor = editor.getCursor();
			const lineText = editor.getLine(cursor.line);
			const beforeCursor = lineText.slice(0, cursor.ch);

			//      —
			if (beforeCursor.trim() !== "") {
				editor.replaceSelection("\n\n" + snippet);
			} else if (cursor.line > 0) {
				//  ,
				const prevLine = editor.getLine(cursor.line - 1);
				if (prevLine.trim() !== "") {
					editor.replaceSelection("\n" + snippet);
				} else {
					editor.replaceSelection(snippet);
				}
			} else {
				editor.replaceSelection(snippet);
			}
		} else {
			editor.replaceSelection(snippet);
		}
	}

	/** Add CSS-  frontmatter cssclasses  */
	private addCssClass(cls: string): void {
		const file = this.app.workspace.getActiveFile();
		if (!file) return;

		this.app.fileManager.processFrontMatter(file, (fm) => {
			if (!fm.cssclasses) {
				fm.cssclasses = [cls];
			} else if (Array.isArray(fm.cssclasses)) {
				if (!fm.cssclasses.includes(cls)) fm.cssclasses.push(cls);
			} else if (typeof fm.cssclasses === "string") {
				if (fm.cssclasses !== cls) fm.cssclasses = [fm.cssclasses, cls];
			}
		});
	}
}

// ── Kanban Board Picker Modal ────────────────────────────────────────────

class KanbanBoardPickerModal extends Modal {
	private inputEl!: HTMLInputElement;

	constructor(
		app: App,
		private existingIds: string[],
		private onSelect: (id: string) => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.modalEl.addClass("umos-format-picker");
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h3", { text: "Kanban Board" });

		const inputSetting = new Setting(contentEl).setName("Board title");
		inputSetting.addText(t => {
			t.setPlaceholder("my-board");
			this.inputEl = t.inputEl;
			this.inputEl.style.width = "100%";
			this.inputEl.addEventListener("keydown", (e) => {
				if (e.key === "Enter") {
					e.preventDefault();
					const val = this.inputEl.value.trim();
					if (val) this.pick(val);
				}
			});
		});

		if (this.existingIds.length > 0) {
			contentEl.createEl("div", {
				text: "Existing boards",
				cls: "umos-fp-category",
			});

			const list = contentEl.createDiv({ cls: "umos-fp-list umos-kb-picker-list" });
			for (const id of this.existingIds) {
				const row = list.createDiv({ cls: "umos-fp-item" });
				row.createSpan({ cls: "umos-fp-item-icon", text: "📋" });
				const text = row.createDiv({ cls: "umos-fp-item-text" });
				text.createSpan({ cls: "umos-fp-item-name", text: id });
				row.addEventListener("click", () => this.pick(id));
				row.addEventListener("mouseenter", () => {
					list.querySelectorAll(".umos-fp-item").forEach(el => el.removeClass("is-focused"));
					row.addClass("is-focused");
				});
			}
		}

		new Setting(contentEl).addButton(btn => {
			btn.setButtonText("Insert").setCta().onClick(() => {
				const val = this.inputEl.value.trim() || "default";
				this.pick(val);
			});
		});

		setTimeout(() => this.inputEl.focus(), 50);
	}

	private pick(id: string): void {
		this.close();
		this.onSelect(id);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
