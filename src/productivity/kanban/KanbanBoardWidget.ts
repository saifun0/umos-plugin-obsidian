import { App, Menu, Modal, Setting, setIcon } from "obsidian";
import { BaseWidget } from "../../core/BaseWidget";
import { EventBus } from "../../EventBus";

// ── Types ──────────────────────────────────────────────────────────────────

export interface KanbanLabel { id: string; text: string; color: string; }

export interface KanbanCard {
	id: string; title: string; description: string;
	coverUrl: string; labels: string[]; createdAt: number;
}

export interface KanbanColumn { id: string; title: string; color: string; cards: KanbanCard[]; }

export interface KanbanBoardData { columns: KanbanColumn[]; labels: KanbanLabel[]; }

// ── Helpers ────────────────────────────────────────────────────────────────

function uid(): string { return Math.random().toString(36).slice(2, 10); }

const PRESET_COLORS = [
	"#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
	"#f97316", "#eab308", "#22c55e", "#14b8a6", "#3b82f6", "#64748b",
];

function resolveImageUrl(app: App, raw: string): string {
	if (!raw) return "";
	if (/^https?:\/\//.test(raw)) return raw;
	const file = app.vault.getFileByPath(raw) ?? app.metadataCache.getFirstLinkpathDest(raw, "");
	if (file) return app.vault.getResourcePath(file);
	return raw;
}

// ── Card Modal ─────────────────────────────────────────────────────────────

class KanbanCardModal extends Modal {
	private card: KanbanCard;
	private readonly board: KanbanBoardData;
	private readonly onSave: (card: KanbanCard) => void;
	private readonly isNew: boolean;

	constructor(app: App, board: KanbanBoardData, card: KanbanCard | null, onSave: (card: KanbanCard) => void) {
		super(app);
		this.board = board;
		this.isNew = !card;
		this.card = card
			? { ...card, labels: [...card.labels] }
			: { id: uid(), title: "", description: "", coverUrl: "", labels: [], createdAt: Date.now() };
		this.onSave = onSave;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass("umos-kb-modal");
		contentEl.createEl("h3", { text: this.isNew ? "Новая карточка" : "Редактировать карточку" });

		new Setting(contentEl).setName("Заголовок").addText(t => {
			t.setValue(this.card.title).onChange(v => (this.card.title = v));
			t.inputEl.addClass("umos-kb-modal-input");
			t.inputEl.focus();
		});

		new Setting(contentEl).setName("Описание").addTextArea(t => {
			t.setValue(this.card.description || "").onChange(v => (this.card.description = v));
			t.inputEl.rows = 3;
			t.inputEl.addClass("umos-kb-modal-input");
		});

		let imgInputEl: HTMLInputElement | null = null;
		const imgSetting = new Setting(contentEl).setName("Изображение").setDesc("URL или путь к файлу в хранилище");
		imgSetting.addText(t => {
			t.setValue(this.card.coverUrl || "").onChange(v => (this.card.coverUrl = v));
			t.inputEl.addClass("umos-kb-modal-input");
			t.inputEl.placeholder = "https://... или Images/photo.png";
			imgInputEl = t.inputEl;
		});
		imgSetting.addExtraButton(btn => {
			btn.setIcon("folder-open").setTooltip("Выбрать из хранилища");
			btn.onClick(() => {
				const imageFiles = this.app.vault.getFiles().filter(f =>
					/\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(f.extension));
				const picker = new Modal(this.app);
				picker.contentEl.addClass("umos-kb-modal");
				picker.contentEl.createEl("h3", { text: "Выбрать изображение" });
				const search = picker.contentEl.createEl("input", {
					cls: "umos-kb-modal-input",
					attr: { type: "text", placeholder: "Поиск файла..." },
				});
				const list = picker.contentEl.createDiv({ cls: "umos-kb-file-list" });
				const renderFiles = (q: string) => {
					list.empty();
					imageFiles.filter(f => f.path.toLowerCase().includes(q.toLowerCase()))
						.slice(0, 40).forEach(f => {
							const row = list.createDiv({ cls: "umos-kb-file-row" });
							row.textContent = f.path;
							row.addEventListener("click", () => {
								this.card.coverUrl = f.path;
								if (imgInputEl) imgInputEl.value = f.path;
								picker.close();
							});
						});
				};
				renderFiles("");
				search.addEventListener("input", () => renderFiles(search.value));
				picker.open();
				setTimeout(() => search.focus(), 50);
			});
		});

		if (this.board.labels.length > 0) {
			const ls = new Setting(contentEl).setName("Метки");
			const lw = ls.controlEl.createDiv({ cls: "umos-kb-label-picker" });
			for (const lbl of this.board.labels) {
				const pill = lw.createDiv({ cls: "umos-kb-label-pill-pick" });
				pill.style.setProperty("--lbl-color", lbl.color);
				pill.textContent = lbl.text;
				if (this.card.labels.includes(lbl.id)) pill.addClass("is-active");
				pill.addEventListener("click", () => {
					if (this.card.labels.includes(lbl.id)) {
						this.card.labels = this.card.labels.filter(id => id !== lbl.id);
						pill.removeClass("is-active");
					} else { this.card.labels.push(lbl.id); pill.addClass("is-active"); }
				});
			}
		}

		const btnRow = contentEl.createDiv({ cls: "umos-kb-modal-btns" });
		btnRow.createEl("button", { text: "Сохранить", cls: "mod-cta" }).addEventListener("click", () => {
			if (!this.card.title.trim()) return;
			this.onSave(this.card); this.close();
		});
		btnRow.createEl("button", { text: "Отмена" }).addEventListener("click", () => this.close());
	}

	onClose(): void { this.contentEl.empty(); }
}

// ── Column Modal ───────────────────────────────────────────────────────────

class KanbanColumnModal extends Modal {
	private col: KanbanColumn;
	private readonly isNew: boolean;
	private readonly onSave: (col: KanbanColumn) => void;

	constructor(app: App, col: KanbanColumn | null, onSave: (col: KanbanColumn) => void) {
		super(app);
		this.isNew = !col;
		this.col = col ? { ...col } : { id: uid(), title: "", color: PRESET_COLORS[0], cards: [] };
		this.onSave = onSave;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass("umos-kb-modal");
		contentEl.createEl("h3", { text: this.isNew ? "Новая колонка" : "Редактировать колонку" });

		new Setting(contentEl).setName("Название").addText(t => {
			t.setValue(this.col.title).onChange(v => (this.col.title = v));
			t.inputEl.addClass("umos-kb-modal-input"); t.inputEl.focus();
		});

		const cs = new Setting(contentEl).setName("Цвет");
		const cw = cs.controlEl.createDiv({ cls: "umos-kb-color-picker" });
		for (const c of PRESET_COLORS) {
			const dot = cw.createDiv({ cls: "umos-kb-color-dot" });
			dot.style.background = c;
			if (this.col.color === c) dot.addClass("is-active");
			dot.addEventListener("click", () => {
				this.col.color = c;
				cw.querySelectorAll<HTMLElement>(".umos-kb-color-dot").forEach(d => d.removeClass("is-active"));
				dot.addClass("is-active");
			});
		}

		const btnRow = contentEl.createDiv({ cls: "umos-kb-modal-btns" });
		btnRow.createEl("button", { text: "Сохранить", cls: "mod-cta" }).addEventListener("click", () => {
			if (!this.col.title.trim()) return; this.onSave(this.col); this.close();
		});
		btnRow.createEl("button", { text: "Отмена" }).addEventListener("click", () => this.close());
	}

	onClose(): void { this.contentEl.empty(); }
}

// ── Label Modal ────────────────────────────────────────────────────────────

class KanbanLabelModal extends Modal {
	private label: KanbanLabel;
	private readonly isNew: boolean;
	private readonly onSave: (lbl: KanbanLabel) => void;

	constructor(app: App, label: KanbanLabel | null, onSave: (lbl: KanbanLabel) => void) {
		super(app);
		this.isNew = !label;
		this.label = label ? { ...label } : { id: uid(), text: "", color: PRESET_COLORS[0] };
		this.onSave = onSave;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass("umos-kb-modal");
		contentEl.createEl("h3", { text: this.isNew ? "Новая метка" : "Редактировать метку" });

		new Setting(contentEl).setName("Название").addText(t => {
			t.setValue(this.label.text).onChange(v => (this.label.text = v));
			t.inputEl.addClass("umos-kb-modal-input"); t.inputEl.focus();
		});

		const cs = new Setting(contentEl).setName("Цвет");
		const cw = cs.controlEl.createDiv({ cls: "umos-kb-color-picker" });
		for (const c of PRESET_COLORS) {
			const dot = cw.createDiv({ cls: "umos-kb-color-dot" });
			dot.style.background = c;
			if (this.label.color === c) dot.addClass("is-active");
			dot.addEventListener("click", () => {
				this.label.color = c;
				cw.querySelectorAll<HTMLElement>(".umos-kb-color-dot").forEach(d => d.removeClass("is-active"));
				dot.addClass("is-active");
			});
		}

		const btnRow = contentEl.createDiv({ cls: "umos-kb-modal-btns" });
		btnRow.createEl("button", { text: "Сохранить", cls: "mod-cta" }).addEventListener("click", () => {
			if (!this.label.text.trim()) return; this.onSave(this.label); this.close();
		});
		btnRow.createEl("button", { text: "Отмена" }).addEventListener("click", () => this.close());
	}

	onClose(): void { this.contentEl.empty(); }
}

// ── Main Widget ────────────────────────────────────────────────────────────

export class KanbanBoardWidget extends BaseWidget {
	protected eventBus?: EventBus;
	private wideMode = false;

	// Drag state
	private dragCard: { cardId: string; fromColId: string; fromIdx: number } | null = null;
	private dragColId: string | null = null;
	private dragInsertColIdx = -1;

	// Collapse state (session-only)
	private collapsedCols = new Set<string>();

	// DOM refs
	private boardEl: HTMLElement | null = null;
	private colDropIndicator: HTMLElement | null = null;
	private cardDropIndicators: HTMLElement[] = [];

	constructor(
		containerEl: HTMLElement,
		private readonly boardId: string,
		private readonly getData: () => KanbanBoardData,
		private readonly persistData: (d: KanbanBoardData) => Promise<void>,
		private readonly appRef: App,
		eventBus: EventBus,
	) {
		super(containerEl);
		this.eventBus = eventBus;
	}

	protected render(): void { void this.renderAsync(); }

	private async renderAsync(): Promise<void> {
		this.containerEl.empty();
		this.containerEl.addClass("umos-kb-root");
		this.cardDropIndicators = [];

		const board = this.getData();

		// ── Toolbar ──────────────────────────────────────────────────────
		const toolbar = this.containerEl.createDiv({ cls: "umos-kb-toolbar" });

		const addColBtn = toolbar.createEl("button", { cls: "umos-kb-toolbar-btn" });
		setIcon(addColBtn, "layout-dashboard");
		addColBtn.createSpan({ text: " Добавить колонку" });
		addColBtn.addEventListener("click", () => {
			new KanbanColumnModal(this.appRef, null, async col => {
				board.columns.push(col);
				await this.persistData(board);
				this.renderAsync();
			}).open();
		});

		const labelsBtn = toolbar.createEl("button", { cls: "umos-kb-toolbar-btn" });
		setIcon(labelsBtn, "tag");
		labelsBtn.createSpan({ text: " Метки" });
		labelsBtn.addEventListener("click", () => this.openLabelsManager(board));

		const wideBtn = toolbar.createEl("button", {
			cls: `umos-kb-toolbar-btn${this.wideMode ? " is-active" : ""}`,
		});
		setIcon(wideBtn, this.wideMode ? "minimize-2" : "maximize-2");
		wideBtn.title = this.wideMode ? "Обычная ширина" : "На всю ширину";
		wideBtn.addEventListener("click", () => {
			this.wideMode = !this.wideMode;
			wideBtn.classList.toggle("is-active", this.wideMode);
			setIcon(wideBtn, this.wideMode ? "minimize-2" : "maximize-2");
			wideBtn.title = this.wideMode ? "Обычная ширина" : "На всю ширину";
			this.applyWideMode(this.wideMode);
		});

		// ── Board ─────────────────────────────────────────────────────────
		this.boardEl = this.containerEl.createDiv({ cls: "umos-kb-board" });

		// Column drop indicator line
		this.colDropIndicator = this.boardEl.createDiv({ cls: "umos-kb-col-drop-indicator" });

		if (board.columns.length === 0) {
			this.boardEl.createDiv({ cls: "umos-kb-empty", text: "Нет колонок. Нажмите «Добавить колонку»." });
		} else {
			for (const col of board.columns) {
				this.renderColumn(this.boardEl, col, board);
			}
		}

		// Board-level column drag handlers
		this.boardEl.addEventListener("dragover", e => {
			if (!this.dragColId || this.dragCard) return;
			e.preventDefault();
			this.updateColDropIndicator(e.clientX, board);
		});
		this.boardEl.addEventListener("dragleave", e => {
			if (!this.boardEl!.contains(e.relatedTarget as Node)) {
				this.colDropIndicator?.removeClass("is-visible");
			}
		});
		this.boardEl.addEventListener("drop", async e => {
			if (!this.dragColId || this.dragCard) return;
			e.preventDefault();
			this.colDropIndicator?.removeClass("is-visible");
			const fromIdx = board.columns.findIndex(c => c.id === this.dragColId);
			if (fromIdx === -1) return;
			let toIdx = this.dragInsertColIdx;
			if (toIdx > fromIdx) toIdx--;
			toIdx = Math.max(0, Math.min(toIdx, board.columns.length - 1));
			const [moved] = board.columns.splice(fromIdx, 1);
			board.columns.splice(toIdx, 0, moved);
			this.dragColId = null;
			await this.persistData(board);
			this.renderAsync();
		});

		if (this.wideMode) this.applyWideMode(true);
	}

	// ── Column drop indicator ──────────────────────────────────────────────

	private updateColDropIndicator(clientX: number, board: KanbanBoardData): void {
		if (!this.boardEl || !this.colDropIndicator) return;
		const cols = Array.from(this.boardEl.querySelectorAll<HTMLElement>(":scope > .umos-kb-column"));

		let insertIdx = board.columns.length;
		let insertBefore: HTMLElement | null = null;

		for (let i = 0; i < cols.length; i++) {
			const rect = cols[i].getBoundingClientRect();
			if (clientX < rect.left + rect.width / 2) {
				insertIdx = i;
				insertBefore = cols[i];
				break;
			}
		}

		// Skip DOM mutation if position unchanged
		if (insertIdx === this.dragInsertColIdx && this.colDropIndicator.hasClass("is-visible")) return;

		this.dragInsertColIdx = insertIdx;
		if (insertBefore) {
			this.boardEl.insertBefore(this.colDropIndicator, insertBefore);
		} else {
			this.boardEl.appendChild(this.colDropIndicator);
		}
		this.colDropIndicator.addClass("is-visible");
	}

	// ── Column ──────────────────────────────────────────────────────────────

	private renderColumn(boardEl: HTMLElement, col: KanbanColumn, board: KanbanBoardData): void {
		const isCollapsed = this.collapsedCols.has(col.id);
		const colEl = boardEl.createDiv({ cls: `umos-kb-column${isCollapsed ? " is-collapsed" : ""}` });
		colEl.dataset.colId = col.id;
		colEl.style.setProperty("--col-color", col.color || "#6366f1");

		// Column drag: activate only via handle
		colEl.addEventListener("dragstart", e => {
			if (!this.dragColId || this.dragCard) { e.preventDefault(); return; }
			colEl.addClass("umos-kb-col--dragging");
			if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
		});
		colEl.addEventListener("dragend", () => {
			colEl.draggable = false;
			this.dragColId = null;
			colEl.removeClass("umos-kb-col--dragging");
			this.colDropIndicator?.removeClass("is-visible");
		});

		// Header
		const header = colEl.createDiv({ cls: "umos-kb-col-header" });

		const dragHandle = header.createDiv({ cls: "umos-kb-col-drag-handle" });
		setIcon(dragHandle, "grip-vertical");
		dragHandle.addEventListener("mousedown", () => {
			this.dragColId = col.id;
			colEl.draggable = true;
		});
		dragHandle.addEventListener("mouseup", () => {
			setTimeout(() => {
				if (!colEl.classList.contains("umos-kb-col--dragging")) {
					colEl.draggable = false;
					this.dragColId = null;
				}
			}, 50);
		});

		const titleRow = header.createDiv({ cls: "umos-kb-col-title-row" });
		const dot = titleRow.createDiv({ cls: "umos-kb-col-dot" });
		dot.style.background = col.color || "#6366f1";
		titleRow.createSpan({ cls: "umos-kb-col-title", text: col.title });
		titleRow.createSpan({ cls: "umos-kb-col-count", text: String(col.cards.length) });

		const headerActions = header.createDiv({ cls: "umos-kb-col-actions" });

		// Collapse button
		const collapseBtn = headerActions.createEl("button", {
			cls: "clickable-icon",
			attr: { "aria-label": isCollapsed ? "Развернуть" : "Свернуть" },
		});
		setIcon(collapseBtn, isCollapsed ? "chevron-right" : "chevron-down");
		collapseBtn.addEventListener("click", () => {
			if (this.collapsedCols.has(col.id)) {
				this.collapsedCols.delete(col.id);
				colEl.removeClass("is-collapsed");
				setIcon(collapseBtn, "chevron-down");
				collapseBtn.setAttribute("aria-label", "Свернуть");
			} else {
				this.collapsedCols.add(col.id);
				colEl.addClass("is-collapsed");
				setIcon(collapseBtn, "chevron-right");
				collapseBtn.setAttribute("aria-label", "Развернуть");
			}
		});

		// FIX: use clickable-icon like TasksWidget
		const addCardBtn = headerActions.createEl("button", {
			cls: "clickable-icon",
			attr: { "aria-label": "Добавить карточку" },
		});
		setIcon(addCardBtn, "plus");
		addCardBtn.addEventListener("click", () => {
			new KanbanCardModal(this.appRef, board, null, async card => {
				col.cards.push(card);
				await this.persistData(board);
				this.renderAsync();
			}).open();
		});

		const menuBtn = headerActions.createEl("button", {
			cls: "clickable-icon",
			attr: { "aria-label": "Действия" },
		});
		setIcon(menuBtn, "more-horizontal");
		menuBtn.addEventListener("click", (e: MouseEvent) => {
			const menu = new Menu();
			menu.addItem(item => item.setTitle("Редактировать").setIcon("pencil").onClick(() => {
				new KanbanColumnModal(this.appRef, col, async updated => {
					col.title = updated.title; col.color = updated.color;
					await this.persistData(board); this.renderAsync();
				}).open();
			}));
			menu.addItem(item => item.setTitle("Удалить колонку").setIcon("trash-2").onClick(async () => {
				board.columns = board.columns.filter(c => c.id !== col.id);
				await this.persistData(board); this.renderAsync();
			}));
			menu.showAtMouseEvent(e);
		});

		// Cards container
		const cardsEl = colEl.createDiv({ cls: "umos-kb-cards" });

		cardsEl.addEventListener("dragover", e => {
			if (this.dragColId) return;
			e.preventDefault(); e.stopPropagation();
			this.updateCardDropIndicator(e.clientY, cardsEl, col, board);
		});
		cardsEl.addEventListener("dragleave", e => {
			if (!cardsEl.contains(e.relatedTarget as Node)) {
				cardsEl.querySelectorAll(".umos-kb-card-drop-indicator").forEach(el => el.removeClass("is-visible"));
			}
		});
		cardsEl.addEventListener("drop", async e => {
			if (this.dragColId) return;
			e.preventDefault(); e.stopPropagation();
			cardsEl.querySelectorAll(".umos-kb-card-drop-indicator").forEach(el => el.removeClass("is-visible"));
			if (!this.dragCard) return;

			const { cardId, fromColId, fromIdx } = this.dragCard;
			const fromCol = board.columns.find(c => c.id === fromColId);
			if (!fromCol) return;

			const insertIdx = this.getCardInsertIdx(e.clientY, cardsEl);

			if (fromColId === col.id) {
				// Reorder within same column
				const [card] = fromCol.cards.splice(fromIdx, 1);
				const adjusted = insertIdx > fromIdx ? insertIdx - 1 : insertIdx;
				col.cards.splice(Math.max(0, Math.min(adjusted, col.cards.length)), 0, card);
			} else {
				// Move to different column
				const idx = fromCol.cards.findIndex(c => c.id === cardId);
				if (idx === -1) return;
				const [card] = fromCol.cards.splice(idx, 1);
				col.cards.splice(Math.min(insertIdx, col.cards.length), 0, card);
			}

			await this.persistData(board);
			this.renderAsync();
		});

		for (let i = 0; i < col.cards.length; i++) {
			// Drop indicator before each card
			const ind = cardsEl.createDiv({ cls: "umos-kb-card-drop-indicator" });
			ind.dataset.idx = String(i);
			this.cardDropIndicators.push(ind);
			this.renderCard(cardsEl, col.cards[i], i, col, board);
		}
		// Drop indicator at end
		const endInd = cardsEl.createDiv({ cls: "umos-kb-card-drop-indicator" });
		endInd.dataset.idx = String(col.cards.length);
		this.cardDropIndicators.push(endInd);
	}

	// ── Card drop position ─────────────────────────────────────────────────

	private getCardInsertIdx(clientY: number, cardsEl: HTMLElement): number {
		const cards = Array.from(cardsEl.querySelectorAll<HTMLElement>(":scope > .umos-kb-card"));
		for (let i = 0; i < cards.length; i++) {
			const rect = cards[i].getBoundingClientRect();
			if (clientY < rect.top + rect.height / 2) return i;
		}
		return cards.length;
	}

	private updateCardDropIndicator(clientY: number, cardsEl: HTMLElement, col: KanbanColumn, board: KanbanBoardData): void {
		const insertIdx = this.getCardInsertIdx(clientY, cardsEl);
		// Hide all indicators in this column, show the right one
		const indicators = Array.from(cardsEl.querySelectorAll<HTMLElement>(".umos-kb-card-drop-indicator"));
		indicators.forEach(el => el.removeClass("is-visible"));
		const target = indicators[insertIdx];
		if (target) target.addClass("is-visible");
	}

	// ── Card ────────────────────────────────────────────────────────────────

	private renderCard(cardsEl: HTMLElement, card: KanbanCard, idx: number, col: KanbanColumn, board: KanbanBoardData): void {
		const cardEl = cardsEl.createDiv({ cls: "umos-kb-card" });
		cardEl.draggable = true;

		cardEl.addEventListener("dragstart", e => {
			e.stopPropagation();
			this.dragCard = { cardId: card.id, fromColId: col.id, fromIdx: idx };
			cardEl.addClass("umos-kb-card--dragging");
			if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
		});
		cardEl.addEventListener("dragend", () => {
			cardEl.removeClass("umos-kb-card--dragging");
			this.dragCard = null;
			this.containerEl.querySelectorAll(".umos-kb-card-drop-indicator").forEach(el => el.removeClass("is-visible"));
		});

		if (card.coverUrl?.trim()) {
			const url = resolveImageUrl(this.appRef, card.coverUrl.trim());
			if (url) {
				const cover = cardEl.createDiv({ cls: "umos-kb-card-cover" });
				cover.style.backgroundImage = `url("${url}")`;
			}
		}

		const labels = card.labels.map(id => board.labels.find(l => l.id === id)).filter(Boolean) as KanbanLabel[];
		if (labels.length > 0) {
			const le = cardEl.createDiv({ cls: "umos-kb-card-labels" });
			for (const lbl of labels) {
				const pill = le.createSpan({ cls: "umos-kb-card-label", text: lbl.text });
				pill.style.setProperty("--lbl-color", lbl.color);
			}
		}

		cardEl.createDiv({ cls: "umos-kb-card-title", text: card.title });
		if (card.description?.trim()) cardEl.createDiv({ cls: "umos-kb-card-desc", text: card.description });

		// Actions — FIX: use clickable-icon
		const actions = cardEl.createDiv({ cls: "umos-kb-card-actions" });

		const editBtn = actions.createEl("button", { cls: "clickable-icon", attr: { "aria-label": "Редактировать" } });
		setIcon(editBtn, "pencil");
		editBtn.addEventListener("click", e => {
			e.stopPropagation();
			new KanbanCardModal(this.appRef, board, card, async updated => {
				Object.assign(card, updated);
				await this.persistData(board);
				this.renderAsync();
			}).open();
		});

		if (board.columns.length > 1) {
			const moveBtn = actions.createEl("button", {
				cls: "clickable-icon umos-kb-card-btn--move",
				attr: { "aria-label": "Переместить" },
			});
			setIcon(moveBtn, "arrow-right-left");
			moveBtn.addEventListener("click", e => {
				e.stopPropagation();
				const menu = new Menu();
				for (const target of board.columns.filter(c => c.id !== col.id)) {
					menu.addItem(item => item.setTitle(`→ ${target.title}`).onClick(async () => {
						col.cards = col.cards.filter(c => c.id !== card.id);
						target.cards.push(card);
						await this.persistData(board);
						this.renderAsync();
					}));
				}
				menu.showAtMouseEvent(e as MouseEvent);
			});
		}

		const delBtn = actions.createEl("button", {
			cls: "clickable-icon umos-kb-card-btn--danger",
			attr: { "aria-label": "Удалить" },
		});
		setIcon(delBtn, "trash-2");
		delBtn.addEventListener("click", e => {
			e.stopPropagation();
			col.cards = col.cards.filter(c => c.id !== card.id);
			this.persistData(board).then(() => this.renderAsync());
		});
	}

	// ── Labels manager ──────────────────────────────────────────────────────

	private openLabelsManager(board: KanbanBoardData): void {
		const modal = new Modal(this.appRef);
		modal.contentEl.addClass("umos-kb-modal");
		modal.contentEl.createEl("h3", { text: "Метки" });
		const listEl = modal.contentEl.createDiv({ cls: "umos-kb-labels-list" });

		const renderList = () => {
			listEl.empty();
			if (board.labels.length === 0) { listEl.createDiv({ cls: "umos-kb-labels-empty", text: "Меток нет." }); return; }
			for (const lbl of board.labels) {
				const row = listEl.createDiv({ cls: "umos-kb-label-row" });
				const pill = row.createSpan({ cls: "umos-kb-label-pill-preview" });
				pill.textContent = lbl.text; pill.style.setProperty("--lbl-color", lbl.color);
				const acts = row.createDiv({ cls: "umos-kb-label-row-acts" });
				const eb = acts.createEl("button", {
					cls: "clickable-icon",
					attr: { "aria-label": "Редактировать метку" },
				});
				setIcon(eb, "pencil");
				eb.addEventListener("click", () => {
					new KanbanLabelModal(this.appRef, lbl, async updated => {
						Object.assign(lbl, updated); await this.persistData(board); renderList();
					}).open();
				});
				const db = acts.createEl("button", {
					cls: "clickable-icon",
					attr: { "aria-label": "Удалить метку" },
				});
				setIcon(db, "trash-2");
				db.addEventListener("click", async () => {
					board.labels = board.labels.filter(l => l.id !== lbl.id);
					for (const col of board.columns)
						for (const c of col.cards) c.labels = c.labels.filter(id => id !== lbl.id);
					await this.persistData(board); renderList();
				});
			}
		};
		renderList();

		const addBtn = modal.contentEl.createEl("button", { text: "+ Добавить метку", cls: "mod-cta" });
		addBtn.style.marginTop = "12px";
		addBtn.addEventListener("click", () => {
			new KanbanLabelModal(this.appRef, null, async lbl => {
				board.labels.push(lbl); await this.persistData(board); renderList();
			}).open();
		});
		modal.open();
	}

	// ── Wide mode — expands only the board area ────────────────────────────

	private applyWideMode(wide: boolean): void {
		const boardEl = this.boardEl;
		if (!boardEl) return;

		if (wide) {
			// Measure after layout
			requestAnimationFrame(() => {
				const scrollView =
					(this.containerEl.closest(".markdown-preview-view") as HTMLElement | null) ??
					(this.containerEl.closest(".cm-scroller") as HTMLElement | null) ??
					(this.containerEl.closest(".view-content") as HTMLElement | null);

				if (!scrollView) return;
				const viewRect = scrollView.getBoundingClientRect();
				const boardRect = boardEl.getBoundingClientRect();
				const scrollbarW = scrollView.offsetWidth - scrollView.clientWidth;
				const leftExpand = boardRect.left - viewRect.left;
				const rightExpand = Math.max(0, viewRect.right - boardRect.right - scrollbarW);

				boardEl.style.marginLeft = `-${leftExpand}px`;
				boardEl.style.marginRight = `-${rightExpand}px`;
				boardEl.style.width = `calc(100% + ${leftExpand + rightExpand}px)`;
			});
		} else {
			boardEl.style.removeProperty("margin-left");
			boardEl.style.removeProperty("margin-right");
			boardEl.style.removeProperty("width");
		}
	}

	protected onWidgetUnload(): void {
		if (this.wideMode) this.applyWideMode(false);
	}
}
