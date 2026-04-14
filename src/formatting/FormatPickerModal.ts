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
	// ── Каллауты ─────────────────────────────────────────────────────
	{
		id: "callout-focus",
		category: "Каллауты",
		icon: "⚡",
		name: "Focus — Важно",
		desc: "Акцентный блок, фиолетовый",
		snippet: "> [!focus-umos]\n> ",
		isBlock: true,
	},
	{
		id: "callout-reflect",
		category: "Каллауты",
		icon: "✍️",
		name: "Reflect — Рефлексия",
		desc: "Дневник / личные мысли, курсив",
		snippet: "> [!reflect-umos] Мысль\n> ",
		isBlock: true,
	},
	{
		id: "callout-goal",
		category: "Каллауты",
		icon: "🎯",
		name: "Goal — Цель",
		desc: "Блок цели, зелёный",
		snippet: "> [!goal-umos] Цель\n> ",
		isBlock: true,
	},
	{
		id: "callout-verse",
		category: "Каллауты",
		icon: "💬",
		name: "Verse — Цитата / Стих",
		desc: "Без заголовка, крупный курсив",
		snippet: "> [!verse-umos]\n> ",
		isBlock: true,
	},
	{
		id: "callout-arabic",
		category: "Каллауты",
		icon: "📖",
		name: "Arabic — Арабский текст",
		desc: "RTL, крупный шрифт Amiri",
		snippet: "> [!arabic-umos] Аят\n> ",
		isBlock: true,
	},
	{
		id: "callout-stat",
		category: "Каллауты",
		icon: "📊",
		name: "Stat — Мини-статистика",
		desc: "Горизонтальные цифры в тексте",
		snippet: "> [!stat-umos] Заголовок\n> **42** задачи\n> **7** привычек\n> **3** цели\n",
		isBlock: true,
	},

	// ── Разделители ───────────────────────────────────────────────────
	{
		id: "div-dots",
		category: "Разделители",
		icon: "·",
		name: "Точки  · · · · ·",
		desc: "Добавить cssclass umos-divider-dots в frontmatter",
		snippet: "umos-divider-dots",
		isCssClass: true,
	},
	{
		id: "div-ornament",
		category: "Разделители",
		icon: "✦",
		name: "Орнамент  ──── ✦ ────",
		desc: "Добавить cssclass umos-divider-ornament в frontmatter",
		snippet: "umos-divider-ornament",
		isCssClass: true,
	},
	{
		id: "div-gradient",
		category: "Разделители",
		icon: "━",
		name: "Градиент ────────",
		desc: "Добавить cssclass umos-divider-gradient в frontmatter",
		snippet: "umos-divider-gradient",
		isCssClass: true,
	},

	// ── CSS-классы для заметки ─────────────────────────────────────────
	{
		id: "cls-wide",
		category: "Классы заметки",
		icon: "⟷",
		name: "Wide — На всю ширину",
		desc: "Убирает max-width контента",
		snippet: "umos-wide",
		isCssClass: true,
	},
	{
		id: "cls-reading",
		category: "Классы заметки",
		icon: "📚",
		name: "Reading — Режим чтения",
		desc: "Засечный шрифт, ширина 68ch, межстрочник 1.85",
		snippet: "umos-reading",
		isCssClass: true,
	},
	{
		id: "cls-no-title",
		category: "Классы заметки",
		icon: "🔇",
		name: "No Title — Скрыть H1",
		desc: "Прячет первый заголовок и inline-title",
		snippet: "umos-no-title",
		isCssClass: true,
	},
	{
		id: "cls-columns",
		category: "Классы заметки",
		icon: "⫶",
		name: "Columns — Две колонки",
		desc: "H1/H2 — на всю ширину, остальное в 2 колонки",
		snippet: "umos-columns",
		isCssClass: true,
	},
	{
		id: "cls-headings",
		category: "Классы заметки",
		icon: "H",
		name: "Headings Accent — Цветные заголовки",
		desc: "H2/H3 с цветной полосой слева",
		snippet: "umos-headings-accent",
		isCssClass: true,
	},

	// ── Макет (cols-umos / info-umos) ────────────────────────────────
	{
		id: "cols-2",
		category: "Макет",
		icon: "⫶",
		name: "Колонки — 2 равные",
		desc: "Текст в две колонки, разделитель ===",
		snippet: "```cols-umos\n## Левая колонка\nТекст первой колонки.\n\n===\n\n## Правая колонка\nТекст второй колонки.\n```",
		isBlock: true,
	},
	{
		id: "cols-3",
		category: "Макет",
		icon: "⫸",
		name: "Колонки — 3 равные",
		desc: "Текст в три колонки",
		snippet: "```cols-umos\n## Колонка 1\nТекст.\n\n===\n\n## Колонка 2\nТекст.\n\n===\n\n## Колонка 3\nТекст.\n```",
		isBlock: true,
	},
	{
		id: "cols-custom",
		category: "Макет",
		icon: "⚌",
		name: "Колонки — задать число",
		desc: "cols: N в первой строке принудительно задаёт количество",
		snippet: "```cols-umos\ncols: 2\n\n## Колонка 1\nТекст.\n\n===\n\n## Колонка 2\nТекст.\n```",
		isBlock: true,
	},
	{
		id: "infobox",
		category: "Макет",
		icon: "🗂",
		name: "Инфополе (Wikipedia-стиль)",
		desc: "Карточка справа от текста: заголовок, фото, таблица",
		snippet: "```info-umos\ntitle: Имя / Название\nimage: 00 Files/photo.png\ncaption: Подпись к фото\n---\nИнформация\nПоле 1     | Значение 1\nПоле 2     | Значение 2\n\nДеятельность\nРоль       | Описание\n```",
		isBlock: true,
	},
	{
		id: "kanban-board",
		category: "Макет",
		icon: "📋",
		name: "Канбан-доска",
		desc: "Доска с колонками и карточками",
		snippet: "",
		isBlock: true,
	},

	// ── Инлайн-метки ──────────────────────────────────────────────────
	{
		id: "mark-red",
		category: "Метки",
		icon: "🔴",
		name: "Метка — Красная",
		desc: "Критично / важно",
		snippet: '<mark class="umos-mark-red">текст</mark>',
	},
	{
		id: "mark-green",
		category: "Метки",
		icon: "🟢",
		name: "Метка — Зелёная",
		desc: "Готово / ок",
		snippet: '<mark class="umos-mark-green">текст</mark>',
	},
	{
		id: "mark-blue",
		category: "Метки",
		icon: "🔵",
		name: "Метка — Синяя",
		desc: "Идея / заметка",
		snippet: '<mark class="umos-mark-blue">текст</mark>',
	},
	{
		id: "mark-yellow",
		category: "Метки",
		icon: "🟡",
		name: "Метка — Жёлтая",
		desc: "На заметку",
		snippet: '<mark class="umos-mark-yellow">текст</mark>',
	},
	{
		id: "mark-purple",
		category: "Метки",
		icon: "🟣",
		name: "Метка — Фиолетовая",
		desc: "Вопрос / неясно",
		snippet: '<mark class="umos-mark-purple">текст</mark>',
	},
	{
		id: "pill",
		category: "Метки",
		icon: "🏷",
		name: "Пилюля-тег",
		desc: "Акцентный инлайн-тег",
		snippet: '<span class="umos-pill">тег</span>',
	},
];

const CATEGORY_ORDER = ["Каллауты", "Макет", "Разделители", "Классы заметки", "Метки"];

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
			attr: { type: "text", placeholder: "Поиск форматирования…" },
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
		// Фокус на инпут после открытия
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
			this.listEl.createDiv({ cls: "umos-fp-empty", text: "Ничего не найдено" });
			return;
		}

		let globalIdx = 0;

		if (q) {
			// без группировки при поиске
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
			text: item.isCssClass ? "cssclass" : "вставить",
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
		// Прокрутить в видимую зону
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

	/** Вставить сниппет в позицию курсора */
	private insertSnippet(snippet: string, isBlock: boolean): void {
		const editor = this.app.workspace.activeEditor?.editor;
		if (!editor) return;

		if (isBlock) {
			// Блочный элемент (каллаут) должен начинаться с новой пустой строки
			const cursor = editor.getCursor();
			const lineText = editor.getLine(cursor.line);
			const beforeCursor = lineText.slice(0, cursor.ch);

			// Если текущая строка не пустая — перейти на новую перед вставкой
			if (beforeCursor.trim() !== "") {
				editor.replaceSelection("\n\n" + snippet);
			} else if (cursor.line > 0) {
				// Строка пустая, но предыдущая может быть не пустой
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

	/** Добавить CSS-класс в frontmatter cssclasses заметки */
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

		contentEl.createEl("h3", { text: "Канбан-доска" });

		const inputSetting = new Setting(contentEl).setName("Название доски");
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
				text: "Существующие доски",
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
			btn.setButtonText("Вставить").setCta().onClick(() => {
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
