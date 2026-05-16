import { App, Modal, Setting } from "obsidian";
import { t } from "../i18n";

interface FormatItem {
	id: string;
	category: string;
	icon: string;
	name: string;
	desc: string;
	snippet: string;
	placeholder?: string;
	keywords?: string[];
	/** If true, snippet replaces frontmatter cssclasses (special handling) */
	isCssClass?: boolean;
	/** If true, snippet must start on its own blank line */
	isBlock?: boolean;
}

const ITEMS: FormatItem[] = [
	// ── Markdown ───────────────────────────────────────────────────
	{
		id: "md-bold",
		category: "Markdown",
		icon: "B",
		name: "Bold",
		desc: "Strong emphasis",
		snippet: "**{{selection}}**",
		placeholder: "text",
		keywords: ["жирный", "bold"],
	},
	{
		id: "md-italic",
		category: "Markdown",
		icon: "I",
		name: "Italic",
		desc: "Soft emphasis",
		snippet: "*{{selection}}*",
		placeholder: "text",
		keywords: ["курсив", "italic"],
	},
	{
		id: "md-bold-italic",
		category: "Markdown",
		icon: "BI",
		name: "Bold Italic",
		desc: "Strong and expressive emphasis",
		snippet: "***{{selection}}***",
		placeholder: "text",
	},
	{
		id: "md-strike",
		category: "Markdown",
		icon: "S",
		name: "Strikethrough",
		desc: "Crossed out text",
		snippet: "~~{{selection}}~~",
		placeholder: "text",
	},
	{
		id: "md-highlight",
		category: "Markdown",
		icon: "H",
		name: "Native Highlight",
		desc: "Obsidian ==highlight== syntax",
		snippet: "=={{selection}}==",
		placeholder: "text",
	},
	{
		id: "md-code",
		category: "Markdown",
		icon: "</>",
		name: "Inline Code",
		desc: "Monospace inline code",
		snippet: "`{{selection}}`",
		placeholder: "code",
	},
	{
		id: "md-wikilink",
		category: "Markdown",
		icon: "[[",
		name: "Wiki Link",
		desc: "Internal Obsidian link",
		snippet: "[[{{selection}}]]",
		placeholder: "Note name",
	},
	{
		id: "md-link",
		category: "Markdown",
		icon: "↗",
		name: "External Link",
		desc: "Markdown link with selected text as label",
		snippet: "[{{selection}}](https://example.com)",
		placeholder: "link text",
	},
	{
		id: "md-quote",
		category: "Markdown",
		icon: ">",
		name: "Quote Block",
		desc: "Blockquote from selected lines",
		snippet: "{{blockquote}}",
		placeholder: "Quote",
		isBlock: true,
	},
	{
		id: "md-codeblock",
		category: "Markdown",
		icon: "{}",
		name: "Code Block",
		desc: "Fenced code block",
		snippet: "```text\n{{selection}}\n```",
		placeholder: "code",
		isBlock: true,
	},
	{
		id: "md-table",
		category: "Markdown",
		icon: "▦",
		name: "Table",
		desc: "Editable markdown table",
		snippet: "| Column | Column |\n| --- | --- |\n| Value | Value |",
		isBlock: true,
	},
	{
		id: "umos-progress-table",
		category: "Markdown",
		icon: "▦",
		name: "Progress Table Template",
		desc: "Interactive umOS table with clickable marks",
		snippet: "```progress-table\nid: progress-table\ntitle: Progress Table\ncolumns: [Ready, Reviewed]\nmark: +\nsummary: true\ngroups:\n  Project A: №1-№5\n  Project B: Step 1, Step 2, Step 3\n```",
		keywords: ["progress-table", "progress", "table", "checklist", "долги", "прогресс", "таблица", "отметки"],
		isBlock: true,
	},
	{
		id: "md-math-inline",
		category: "Markdown",
		icon: "∑",
		name: "Inline Math",
		desc: "MathJax inline expression",
		snippet: "${{selection}}$",
		placeholder: "x^2",
	},
	{
		id: "md-math-block",
		category: "Markdown",
		icon: "∫",
		name: "Math Block",
		desc: "Display MathJax block",
		snippet: "$$\n{{selection}}\n$$",
		placeholder: "E = mc^2",
		isBlock: true,
	},
	{
		id: "md-mermaid",
		category: "Markdown",
		icon: "◇",
		name: "Mermaid Flowchart",
		desc: "Diagram code block",
		snippet: "```mermaid\ngraph TD\n  A[Start] --> B[Next]\n```",
		isBlock: true,
	},

	// ── Callouts ─────────────────────────────────────────────────────
	{
		id: "callout-note",
		category: "Callouts",
		icon: "ⓘ",
		name: "Note Callout",
		desc: "Native Obsidian note block",
		snippet: "> [!note]\n{{blockquote}}",
		placeholder: "Note",
		isBlock: true,
	},
	{
		id: "callout-tip",
		category: "Callouts",
		icon: "!",
		name: "Tip Callout",
		desc: "Helpful hint or important idea",
		snippet: "> [!tip]\n{{blockquote}}",
		placeholder: "Tip",
		isBlock: true,
	},
	{
		id: "callout-warning",
		category: "Callouts",
		icon: "!",
		name: "Warning Callout",
		desc: "Caution or risk",
		snippet: "> [!warning]\n{{blockquote}}",
		placeholder: "Warning",
		isBlock: true,
	},
	{
		id: "callout-question",
		category: "Callouts",
		icon: "?",
		name: "Question Callout",
		desc: "Question, prompt, or uncertainty",
		snippet: "> [!question]\n{{blockquote}}",
		placeholder: "Question",
		isBlock: true,
	},
	{
		id: "callout-success",
		category: "Callouts",
		icon: "✓",
		name: "Success Callout",
		desc: "Result, win, or completed idea",
		snippet: "> [!success]\n{{blockquote}}",
		placeholder: "Success",
		isBlock: true,
	},
	{
		id: "callout-danger",
		category: "Callouts",
		icon: "×",
		name: "Danger Callout",
		desc: "Critical warning",
		snippet: "> [!danger]\n{{blockquote}}",
		placeholder: "Danger",
		isBlock: true,
	},
	{
		id: "callout-focus",
		category: "Callouts",
		icon: "⚡",
		name: "Focus — Important",
		desc: "Accent block, purple",
		snippet: "> [!focus-umos]\n{{blockquote}}",
		placeholder: "Important point",
		isBlock: true,
	},
	{
		id: "callout-focus-center",
		category: "Callouts",
		icon: "⚡",
		name: "Focus — Centered",
		desc: "Accent callout with the |center parameter",
		snippet: "> [!focus-umos|center]\n{{blockquote}}",
		placeholder: "Centered point",
		isBlock: true,
	},
	{
		id: "callout-reflect",
		category: "Callouts",
		icon: "✍️",
		name: "Reflect — Reflection",
		desc: "Journal / personal thoughts, italic",
		snippet: "> [!reflect-umos] Thought\n{{blockquote}}",
		placeholder: "Reflection",
		isBlock: true,
	},
	{
		id: "callout-goal",
		category: "Callouts",
		icon: "◎",
		name: "Goal — Target",
		desc: "Green goal block",
		snippet: "> [!goal-umos] Goal\n{{blockquote}}",
		placeholder: "Target",
		isBlock: true,
	},
	{
		id: "callout-verse",
		category: "Callouts",
		icon: "💬",
		name: "Verse — Quote / Verse",
		desc: "No title, large italic",
		snippet: "> [!verse-umos]\n{{blockquote}}",
		placeholder: "Quote",
		isBlock: true,
	},
	{
		id: "callout-verse-center",
		category: "Callouts",
		icon: "💬",
		name: "Verse — Centered",
		desc: "Quote / verse with the |center parameter",
		snippet: "> [!verse-umos|center]\n{{blockquote}}",
		placeholder: "Quote",
		isBlock: true,
	},
	{
		id: "callout-arabic",
		category: "Callouts",
		icon: "📖",
		name: "Arabic — Arabic Text",
		desc: "RTL, large Amiri font",
		snippet: "> [!arabic-umos] Ayah\n{{blockquote}}",
		placeholder: "النص العربي",
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
	{
		id: "callout-definition",
		category: "Callouts",
		icon: "≡",
		name: "Definition",
		desc: "Term and explanation block",
		snippet: "> [!definition-umos] Term\n{{blockquote}}",
		placeholder: "Definition",
		isBlock: true,
	},
	{
		id: "callout-method",
		category: "Callouts",
		icon: "↪",
		name: "Method",
		desc: "Steps or workflow block",
		snippet: "> [!method-umos] Method\n> 1. First step\n> 2. Next step\n> 3. Result\n",
		isBlock: true,
	},
	{
		id: "callout-compare",
		category: "Callouts",
		icon: "⇄",
		name: "Compare",
		desc: "Comparison or contrast",
		snippet: "> [!compare-umos] Compare\n> **A:** \n> **B:** \n> **Conclusion:** \n",
		isBlock: true,
	},
	{
		id: "callout-checklist",
		category: "Callouts",
		icon: "☑",
		name: "Checklist",
		desc: "Compact action checklist",
		snippet: "> [!checklist-umos] Checklist\n> - First\n> - Second\n> - Third\n",
		isBlock: true,
	},

	// ── Dividers ───────────────────────────────────────────────────
	{
		id: "hr-soft",
		category: "Dividers",
		icon: "─",
		name: "Soft Divider",
		desc: "Inline soft horizontal divider",
		snippet: '<hr class="umos-hr-soft">',
		isBlock: true,
	},
	{
		id: "hr-glow",
		category: "Dividers",
		icon: "━",
		name: "Glow Divider",
		desc: "Accent divider with a soft glow",
		snippet: '<hr class="umos-hr-glow">',
		isBlock: true,
	},
	{
		id: "hr-label",
		category: "Dividers",
		icon: "◆",
		name: "Label Divider",
		desc: "Centered label divider",
		snippet: '<div class="umos-divider-label">Section</div>',
		isBlock: true,
	},
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
	{
		id: "cls-dropcap",
		category: "Note Classes",
		icon: "D",
		name: "Drop Cap",
		desc: "Large first letter in reading view",
		snippet: "umos-dropcap",
		isCssClass: true,
	},
	{
		id: "cls-paper",
		category: "Note Classes",
		icon: "□",
		name: "Paper Note",
		desc: "Soft paper-like reading surface",
		snippet: "umos-paper",
		isCssClass: true,
	},
	{
		id: "cls-compact",
		category: "Note Classes",
		icon: "≋",
		name: "Compact Note",
		desc: "Tighter paragraphs and headings",
		snippet: "umos-compact-note",
		isCssClass: true,
	},
	{
		id: "cls-accent-links",
		category: "Note Classes",
		icon: "↗",
		name: "Accent Links",
		desc: "More visible internal and external links",
		snippet: "umos-accent-links",
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
		id: "image-embed",
		category: "Layout",
		icon: "▣",
		name: "Image Embed",
		desc: "Vault image embed with width",
		snippet: "![[00 Files/image.png|420]]",
		isBlock: true,
	},
	{
		id: "details",
		category: "Layout",
		icon: "▾",
		name: "Details Toggle",
		desc: "HTML collapsible block",
		snippet: "<details>\n<summary>Summary</summary>\n\n{{selection}}\n\n</details>",
		placeholder: "Hidden content",
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
		snippet: '<mark class="umos-mark-red">{{selection}}</mark>',
		placeholder: "text",
	},
	{
		id: "mark-green",
		category: "Labels",
		icon: "🟢",
		name: "Mark — Green",
		desc: "Done / ok",
		snippet: '<mark class="umos-mark-green">{{selection}}</mark>',
		placeholder: "text",
	},
	{
		id: "mark-blue",
		category: "Labels",
		icon: "🔵",
		name: "Mark — Blue",
		desc: "Idea / note",
		snippet: '<mark class="umos-mark-blue">{{selection}}</mark>',
		placeholder: "text",
	},
	{
		id: "mark-yellow",
		category: "Labels",
		icon: "🟡",
		name: "Mark — Yellow",
		desc: "Worth noting",
		snippet: '<mark class="umos-mark-yellow">{{selection}}</mark>',
		placeholder: "text",
	},
	{
		id: "mark-purple",
		category: "Labels",
		icon: "🟣",
		name: "Mark — Purple",
		desc: "Question / unclear",
		snippet: '<mark class="umos-mark-purple">{{selection}}</mark>',
		placeholder: "text",
	},
	{
		id: "pill",
		category: "Labels",
		icon: "🏷",
		name: "Pill Tag",
		desc: "Accent inline tag",
		snippet: '<span class="umos-pill">{{selection}}</span>',
		placeholder: "tag",
	},
	{
		id: "badge-info",
		category: "Labels",
		icon: "i",
		name: "Badge — Info",
		desc: "Small blue badge",
		snippet: '<span class="umos-badge umos-badge-info">{{selection}}</span>',
		placeholder: "info",
	},
	{
		id: "badge-success",
		category: "Labels",
		icon: "✓",
		name: "Badge — Success",
		desc: "Small green badge",
		snippet: '<span class="umos-badge umos-badge-success">{{selection}}</span>',
		placeholder: "done",
	},
	{
		id: "badge-warning",
		category: "Labels",
		icon: "!",
		name: "Badge — Warning",
		desc: "Small amber badge",
		snippet: '<span class="umos-badge umos-badge-warning">{{selection}}</span>',
		placeholder: "warning",
	},
	{
		id: "badge-danger",
		category: "Labels",
		icon: "×",
		name: "Badge — Danger",
		desc: "Small red badge",
		snippet: '<span class="umos-badge umos-badge-danger">{{selection}}</span>',
		placeholder: "danger",
	},
	{
		id: "text-muted",
		category: "Labels",
		icon: "∼",
		name: "Muted Text",
		desc: "Quiet secondary text",
		snippet: '<span class="umos-text-muted">{{selection}}</span>',
		placeholder: "side note",
	},
	{
		id: "text-underline",
		category: "Labels",
		icon: "U",
		name: "Accent Underline",
		desc: "Clean accent underline",
		snippet: '<span class="umos-text-underline">{{selection}}</span>',
		placeholder: "text",
	},
	{
		id: "text-wavy",
		category: "Labels",
		icon: "~",
		name: "Wavy Underline",
		desc: "Questionable or needs review",
		snippet: '<span class="umos-text-wavy">{{selection}}</span>',
		placeholder: "text",
	},
	{
		id: "text-double",
		category: "Labels",
		icon: "=",
		name: "Double Underline",
		desc: "Academic emphasis",
		snippet: '<span class="umos-text-double">{{selection}}</span>',
		placeholder: "text",
	},
	{
		id: "text-glow",
		category: "Labels",
		icon: "✦",
		name: "Soft Glow",
		desc: "Subtle luminous emphasis",
		snippet: '<span class="umos-text-glow">{{selection}}</span>',
		placeholder: "text",
	},
	{
		id: "kbd",
		category: "Labels",
		icon: "⌘",
		name: "Keyboard Key",
		desc: "Keyboard shortcut key",
		snippet: "<kbd>{{selection}}</kbd>",
		placeholder: "Ctrl K",
	},
	{
		id: "small",
		category: "Labels",
		icon: "sm",
		name: "Small Text",
		desc: "Side note / fine print",
		snippet: "<small>{{selection}}</small>",
		placeholder: "small note",
	},
	{
		id: "sup",
		category: "Labels",
		icon: "x²",
		name: "Superscript",
		desc: "Raised text",
		snippet: "<sup>{{selection}}</sup>",
		placeholder: "2",
	},
	{
		id: "sub",
		category: "Labels",
		icon: "x₂",
		name: "Subscript",
		desc: "Lowered text",
		snippet: "<sub>{{selection}}</sub>",
		placeholder: "2",
	},
];

const CATEGORY_ORDER = ["Markdown", "Callouts", "Layout", "Dividers", "Note Classes", "Labels"];

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
			attr: { type: "text", placeholder: t("Search formatting...") },
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
				(i) => this.getSearchText(i).includes(q)
			)
			: ITEMS;

		this.visibleItems = filtered;
		if (this.focusedIdx >= filtered.length) this.focusedIdx = 0;

		if (filtered.length === 0) {
			this.listEl.createDiv({ cls: "umos-fp-empty", text: t("Nothing found") });
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

				this.listEl.createDiv({ cls: "umos-fp-category", text: t(cat) });
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
		text.createSpan({ cls: "umos-fp-item-name", text: t(item.name) });
		text.createSpan({ cls: "umos-fp-item-desc", text: t(item.desc) });

		const badge = row.createSpan({
			cls: "umos-fp-item-badge",
			text: this.getItemBadge(item),
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
			this.insertSnippet(item);
		}
		this.close();
	}

	/** Insert     */
	private insertSnippet(item: FormatItem): void {
		const editor = this.app.workspace.activeEditor?.editor;
		if (!editor) return;

		const snippet = this.prepareSnippet(item, editor.getSelection());

		if (item.isBlock) {
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

	private prepareSnippet(item: FormatItem, selection: string): string {
		const fallback = item.placeholder ?? "text";
		const selectedText = selection.trim().length > 0 ? selection : fallback;
		const blockquote = selectedText
			.split("\n")
			.map((line) => `> ${line}`)
			.join("\n");

		return t(item.snippet)
			.replaceAll("{{selection}}", selectedText)
			.replaceAll("{{blockquote}}", blockquote);
	}

	private getSearchText(item: FormatItem): string {
		return [
			item.name,
			t(item.name),
			item.desc,
			t(item.desc),
			item.category,
			t(item.category),
			...(item.keywords ?? []),
		].join(" ").toLowerCase();
	}

	private getItemBadge(item: FormatItem): string {
		if (item.isCssClass) return "cssclass";
		if (item.isBlock) return t("block");
		if (item.snippet.includes("{{selection}}")) return t("wrap");
		return t("insert");
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
