import { App, TFile, TFolder, Notice, setIcon, Modal } from "obsidian";
import { EventBus } from "../EventBus";
import { UmOSSettings, ContentTypeDefinition } from "../settings/Settings";
import { createElement } from "../utils/dom";
import { BaseWidget } from "../core/BaseWidget";

export interface ContentGalleryConfig {
	style: "grid" | "list";
}

// ── Статусы ────────────────────────────────────

interface StatusMeta { label: string; cls: string; icon: string }

const STATUS_NORMALIZE: Record<string, string> = {
	"📋 plan":     "plan",
	"▶️ watching": "watching",
	"▶️ reading":  "watching",
	"▶️ playing":  "watching",
	"✅ done":     "done",
	"⛔ drop":     "drop",
	"⏸️ on-hold": "on-hold",
	"plan":        "plan",
	"watching":    "watching",
	"reading":     "watching",
	"playing":     "watching",
	"active":      "watching",
	"in-progress": "watching",
	"done":        "done",
	"completed":   "done",
	"drop":        "drop",
	"dropped":     "drop",
	"on-hold":     "on-hold",
	"paused":      "on-hold",
};

const STATUS_DISPLAY: Record<string, StatusMeta> = {
	"plan":     { label: "В планах",   cls: "umos-cg-s-plan",   icon: "📋" },
	"watching": { label: "В процессе", cls: "umos-cg-s-active", icon: "▶️" },
	"done":     { label: "Завершено",  cls: "umos-cg-s-done",   icon: "✅" },
	"drop":     { label: "Брошено",    cls: "umos-cg-s-drop",   icon: "⛔" },
	"on-hold":  { label: "На паузе",   cls: "umos-cg-s-hold",   icon: "⏸️" },
};

const ALL_STATUSES = Object.keys(STATUS_DISPLAY);

// ── Карточка контента ──────────────────────────

interface ContentCard {
	title: string;
	path: string;
	coverUrl: string;
	typeKey: string;
	typeLabel: string;
	typeIcon: string;
	typeColor: string;
	nStatus: string;
	rating: number;
	pct: number;
	progressLabel: string;
	genreStr: string;
	year: string;
	mtime: number;
}

// ── Шаблоны ────────────────────────────────────

function contentTemplate(typeDef: ContentTypeDefinition, title: string): string {
	const today = new Date().toISOString().slice(0, 10);
	const lines: string[] = [
		"---",
		`title: "${title}"`,
		`status: "📋 plan"`,
		"rating: 0",
		'cover_url: ""',
	];

	if (typeDef.epField) {
		lines.push(`${typeDef.epField}: 0`);
	}
	if (typeDef.totalField) {
		lines.push(`${typeDef.totalField}: 0`);
	}

	lines.push(
		`start_date: "${today}"`,
		'end_date: ""',
		"genres: []",
		"tags:",
		`  - content`,
		`  - content/${typeDef.key}`,
		'review: ""',
		"---",
		"",
	);

	// ── Тело заметки с umos-input виджетами ──
	lines.push(`# ${typeDef.icon} ${title}`, "");
	lines.push("## Информация", "");

	// Status select
	lines.push("```umos-input");
	lines.push("type: select");
	lines.push("property: status");
	lines.push("label: Статус");
	lines.push("style: pills");
	lines.push('options: ["📋 plan", "▶️ watching", "✅ done", "⛔ drop", "⏸️ on-hold"]');
	lines.push('labels: ["В планах", "В процессе", "Завершено", "Брошено", "На паузе"]');
	lines.push('colors: ["#95a5a6", "#7c3aed", "#27ae60", "#e74c3c", "#f39c12"]');
	lines.push("```");
	lines.push("");

	// Progress (if has epField + totalField)
	if (typeDef.epField && typeDef.totalField) {
		lines.push("```umos-input");
		lines.push("type: progress");
		lines.push(`property_current: ${typeDef.epField}`);
		lines.push(`property_total: ${typeDef.totalField}`);
		lines.push(`label: Прогресс (${typeDef.unit || ""})`);
		lines.push(`color: ${typeDef.color}`);
		lines.push("editable: true");
		lines.push("```");
		lines.push("");
	} else if (typeDef.epField) {
		lines.push("```umos-input");
		lines.push("type: number");
		lines.push(`property: ${typeDef.epField}`);
		lines.push(`label: ${typeDef.epField.replace(/_/g, " ")} (${typeDef.unit || ""})`);
		lines.push("min: 0");
		lines.push("max: 10000");
		lines.push(`suffix: ${typeDef.unit || ""}`);
		lines.push("```");
		lines.push("");
	}

	// Rating slider
	lines.push("```umos-input");
	lines.push("type: slider");
	lines.push("property: rating");
	lines.push("label: Рейтинг");
	lines.push("min: 0");
	lines.push("max: 10");
	lines.push("step: 1");
	lines.push("```");
	lines.push("");

	// Genres text
	lines.push("```umos-input");
	lines.push("type: text");
	lines.push("property: genres");
	lines.push("label: Жанры");
	lines.push("placeholder: action, fantasy, drama...");
	lines.push("```");
	lines.push("");

	// Dates
	lines.push("```umos-input");
	lines.push("type: date");
	lines.push("property: start_date");
	lines.push("label: Дата начала");
	lines.push("```");
	lines.push("");

	lines.push("```umos-input");
	lines.push("type: date");
	lines.push("property: end_date");
	lines.push("label: Дата окончания");
	lines.push("```");
	lines.push("");

	// Cover URL
	lines.push("```umos-input");
	lines.push("type: text");
	lines.push("property: cover_url");
	lines.push("label: Обложка (URL)");
	lines.push("placeholder: https://...");
	lines.push("```");
	lines.push("");

	lines.push("---", "");
	lines.push("## Рецензия", "");

	lines.push("```umos-input");
	lines.push("type: text");
	lines.push("property: review");
	lines.push("label: Рецензия");
	lines.push("placeholder: Напишите свой отзыв...");
	lines.push("multiline: true");
	lines.push("```");
	lines.push("");

	lines.push("---", "");
	lines.push("## Связанное", "");

	return lines.join("\n");
}

// ── Status donut chart ──────────────────────────

const STATUS_COLORS: Record<string, string> = {
	"plan":     "#95a5a6",
	"watching": "#7c3aed",
	"done":     "#27ae60",
	"drop":     "#e74c3c",
	"on-hold":  "#f39c12",
};

function renderStatusDonut(parent: HTMLElement, statusCounts: Record<string, number>, total: number, size: number): void {
	const container = createElement("div", { cls: "umos-cg-donut-container", parent });

	const svgNS = "http://www.w3.org/2000/svg";
	const svg = document.createElementNS(svgNS, "svg");
	svg.setAttribute("width", String(size));
	svg.setAttribute("height", String(size));
	svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
	svg.classList.add("umos-cg-donut-svg");
	container.appendChild(svg);

	const cx = size / 2;
	const cy = size / 2;
	const strokeWidth = 10;
	const r = (size - strokeWidth) / 2 - 2;
	const circumference = 2 * Math.PI * r;

	const bgCircle = document.createElementNS(svgNS, "circle");
	bgCircle.setAttribute("cx", String(cx));
	bgCircle.setAttribute("cy", String(cy));
	bgCircle.setAttribute("r", String(r));
	bgCircle.setAttribute("fill", "none");
	bgCircle.setAttribute("stroke", "var(--background-modifier-border)");
	bgCircle.setAttribute("stroke-width", String(strokeWidth));
	svg.appendChild(bgCircle);

	if (total > 0) {
		const GAP_DEG = 2;
		let cumulativeDegrees = -90;
		for (const status of ALL_STATUSES) {
			const cnt = statusCounts[status] || 0;
			if (cnt === 0) continue;
			const pctDeg = (cnt / total) * 360;
			const segDeg = Math.max(pctDeg - GAP_DEG, 0);
			const segLen = (segDeg / 360) * circumference;

			const circle = document.createElementNS(svgNS, "circle");
			circle.setAttribute("cx", String(cx));
			circle.setAttribute("cy", String(cy));
			circle.setAttribute("r", String(r));
			circle.setAttribute("fill", "none");
			circle.setAttribute("stroke", STATUS_COLORS[status] || "#999");
			circle.setAttribute("stroke-width", String(strokeWidth));
			circle.setAttribute("stroke-linecap", "butt");
			circle.setAttribute("stroke-dasharray", `${segLen} ${circumference - segLen}`);
			circle.setAttribute("transform", `rotate(${cumulativeDegrees} ${cx} ${cy})`);
			svg.appendChild(circle);

			cumulativeDegrees += pctDeg;
		}
	}

	createElement("div", { cls: "umos-cg-donut-val", text: String(total), parent: container });
	createElement("div", { cls: "umos-cg-donut-lbl", text: "всего", parent: container });
}

// ── Виджет ─────────────────────────────────────

export class ContentGallery extends BaseWidget {
	private config: ContentGalleryConfig;
	private obsidianApp: App;
	protected eventBus: EventBus;
	private settings: UmOSSettings;

	private filterType = "all";
	private filterStatus = "all";
	private sortMode = "updated";
	private groupMode: "none" | "type" | "status" = "none";
	private searchQuery = "";
	private wideView = false;
	private _sizerEl: HTMLElement | null = null;
	private _sizerOrigMaxWidth = "";
	private galleryEl: HTMLElement | null = null;
	private filterCountEl: HTMLElement | null = null;
	private emptyEl: HTMLElement | null = null;
	private allCards: ContentCard[] = [];

	constructor(
		containerEl: HTMLElement,
		config: ContentGalleryConfig,
		app: App,
		eventBus: EventBus,
		settings: UmOSSettings,
	) {
		super(containerEl);
		this.config = config;
		this.obsidianApp = app;
		this.eventBus = eventBus;
		this.settings = settings;
	}

	onload(): void {
		this.allCards = this.loadAllCards();
		super.onload();

		// Reset wide mode when the user navigates away from the gallery note
		this.registerEvent(
			this.obsidianApp.workspace.on("active-leaf-change", () => {
				if (this.wideView) {
					this.applyWideMode(false);
					this.wideView = false;
				}
			}),
		);
	}

	protected render(): void {
		this.renderInternal();
	}

	private getTypes(): ContentTypeDefinition[] {
		return this.settings.contentTypes || [];
	}

	private getTypeMap(): Record<string, ContentTypeDefinition> {
		const map: Record<string, ContentTypeDefinition> = {};
		for (const t of this.getTypes()) map[t.key] = t;
		return map;
	}

	// ── Data loading ───────────────────────────

	private getContentRoot(): string {
		return this.settings.homeContentPath || "30 Content";
	}

	private normalizeStatus(raw: unknown): string {
		if (!raw) return "plan";
		const s = String(raw).trim();
		return STATUS_NORMALIZE[s] || s;
	}

	private loadAllCards(): ContentCard[] {
		const root = this.getContentRoot();
		const cards: ContentCard[] = [];

		for (const typeObj of this.getTypes()) {
			const folderPath = `${root}/${typeObj.folder}`;
			const folder = this.obsidianApp.vault.getAbstractFileByPath(folderPath);
			if (!(folder instanceof TFolder)) continue;

			this.collectFromFolder(folder, typeObj, cards);
		}

		return cards;
	}

	private collectFromFolder(folder: TFolder, typeObj: ContentTypeDefinition, cards: ContentCard[]): void {
		for (const child of folder.children) {
			if (child instanceof TFolder) {
				this.collectFromFolder(child, typeObj, cards);
				continue;
			}
			if (!(child instanceof TFile) || child.extension !== "md") continue;
			const cache = this.obsidianApp.metadataCache.getFileCache(child);
			const fm = cache?.frontmatter;
			if (!fm) continue;

			const nStatus = this.normalizeStatus(fm.status);

			// Cover
			let coverUrl = "";
			const coverRaw = fm.cover_url || fm.cover || fm.image || fm.poster || "";
			const coverStr = String(coverRaw);
			if (coverStr.startsWith("http") || coverStr.startsWith("//")) {
				coverUrl = coverStr;
			} else if (coverStr.length > 0) {
				const clean = coverStr.replace(/^!?\[\[/, "").replace(/\]\]$/, "").replace(/^!?\[.*?\]\(/, "").replace(/\)$/, "");
				const f = this.obsidianApp.vault.getAbstractFileByPath(clean)
					|| this.obsidianApp.metadataCache.getFirstLinkpathDest(clean, "");
				if (f instanceof TFile) {
					coverUrl = this.obsidianApp.vault.getResourcePath(f);
				}
			}

			// Progress
			let pct = -1;
			let progressLabel = "";
			if (typeObj.epField && fm[typeObj.epField] != null) {
				const cur = Number(fm[typeObj.epField]) || 0;
				const tot = typeObj.totalField ? (Number(fm[typeObj.totalField]) || 0) : 0;
				if (tot > 0) {
					pct = Math.min(Math.round((cur / tot) * 100), 100);
					progressLabel = `${cur}/${tot} ${typeObj.unit}`;
				} else if (cur > 0) {
					progressLabel = `${cur} ${typeObj.unit}`;
				}
			}

			// Genre
			const genre = fm.genres || fm.genre || "";
			let genreStr: string;
			if (Array.isArray(genre)) {
				genreStr = genre.filter((g: string) => !String(g).startsWith("content")).slice(0, 2).join(" · ");
			} else {
				genreStr = typeof genre === "string" ? genre : "";
			}

			cards.push({
				title: String(fm.title || child.basename),
				path: child.path,
				coverUrl,
				typeKey: typeObj.key,
				typeLabel: typeObj.label,
				typeIcon: typeObj.icon,
				typeColor: typeObj.color || "#7c3aed",
				nStatus,
				rating: fm.rating ? Number(fm.rating) : 0,
				pct,
				progressLabel,
				genreStr,
				year: String(fm.year || fm.release_year || fm.season || ""),
				mtime: child.stat.mtime,
			});
		}
	}

	// ── Render ──────────────────────────────────

	// ── Wide mode helpers ───────────────────────────

	private applyWideMode(wide: boolean): void {
		// We target .view-content to override CSS variables (Primary theme compatibility),
		// plus directly remove max-width on sizer and cm-content elements.
		const viewContent = this.containerEl.closest(".view-content") as HTMLElement | null;
		const sizer = this.containerEl.closest(".markdown-preview-sizer") as HTMLElement | null;
		const cmContent = this.containerEl.closest(".cm-content") as HTMLElement | null;

		if (wide) {
			this._sizerEl = viewContent;
			if (viewContent) {
				viewContent.style.setProperty("--file-line-width", "100%");
				viewContent.style.setProperty("--file-max-line-width", "100%");
				viewContent.classList.add("umos-preview-sizer--wide");
			}
			if (sizer) {
				this._sizerOrigMaxWidth = sizer.style.maxWidth;
				sizer.style.setProperty("max-width", "none", "important");
				sizer.style.setProperty("width", "100%", "important");
			}
			if (cmContent) {
				cmContent.style.setProperty("max-width", "none", "important");
			}
		} else {
			if (this._sizerEl) {
				this._sizerEl.style.removeProperty("--file-line-width");
				this._sizerEl.style.removeProperty("--file-max-line-width");
				this._sizerEl.classList.remove("umos-preview-sizer--wide");
				this._sizerEl = null;
			}
			if (sizer) {
				sizer.style.maxWidth = this._sizerOrigMaxWidth;
				sizer.style.removeProperty("width");
			}
			if (cmContent) {
				cmContent.style.removeProperty("max-width");
			}
		}
	}

	private renderInternal(): void {
		this.containerEl.empty();

		// Restore wide mode if re-rendering while active
		if (this.wideView) this.applyWideMode(true);

		const wrapper = createElement("div", { cls: "umos-cg", parent: this.containerEl });

		// Apply dynamic CSS vars for custom content types
		for (const t of this.getTypes()) {
			wrapper.style.setProperty(`--cg-${t.key}`, t.color || "#7c3aed");
		}

		// Stats block
		this.renderStats(wrapper);

		// Divider
		createElement("div", { cls: "umos-cg-divider", parent: wrapper });

		// Filters bar
		this.renderFilters(wrapper);

		// Gallery container
		this.galleryEl = createElement("div", {
			cls: `umos-cg-gallery ${this.config.style === "list" ? "umos-cg-gallery-list" : ""}${this.wideView ? " umos-cg-gallery--wide" : ""}`,
			parent: wrapper,
		});

		// Empty message
		this.emptyEl = createElement("div", { cls: "umos-cg-empty", parent: wrapper });
		this.emptyEl.style.display = "none";
		createElement("div", { cls: "umos-cg-empty-icon", text: "🔍", parent: this.emptyEl });
		createElement("div", { cls: "umos-cg-empty-text", text: "Ничего не найдено", parent: this.emptyEl });

		this.filterAndRender();
	}

	// ── Stats ───────────────────────────────────

	private renderStats(parent: HTMLElement): void {
		const all = this.allCards;
		const countByStatus = (s: string) => all.filter(c => c.nStatus === s).length;
		const watching = countByStatus("watching");
		const completed = countByStatus("done");
		const planned = countByStatus("plan");
		const onHold = countByStatus("on-hold");
		const dropped = countByStatus("drop");

		const rated = all.filter(c => c.rating > 0);
		const avgRating = rated.length > 0
			? (rated.reduce((s, c) => s + c.rating, 0) / rated.length).toFixed(1)
			: "—";

		const block = createElement("div", { cls: "umos-cg-stats", parent });

		// ── Top: Ring charts row ──
		const ringsRow = createElement("div", { cls: "umos-cg-rings-row", parent: block });

		renderStatusDonut(ringsRow, { plan: planned, watching, done: completed, drop: dropped, "on-hold": onHold }, all.length, 90);

		// Summary numbers beside rings
		const summaryCol = createElement("div", { cls: "umos-cg-summary-col", parent: ringsRow });
		const summaryItems = [
			{ value: String(all.length), label: "Всего", icon: "📦" },
			{ value: `⭐ ${avgRating}`, label: "Средняя оценка", icon: "" },
			{ value: String(planned), label: "В планах", icon: "📋" },
			{ value: String(onHold), label: "На паузе", icon: "⏸️" },
			{ value: String(dropped), label: "Брошено", icon: "⛔" },
		];
		for (const s of summaryItems) {
			const row = createElement("div", { cls: "umos-cg-summary-row", parent: summaryCol });
			if (s.icon) createElement("span", { cls: "umos-cg-summary-icon", text: s.icon, parent: row });
			createElement("span", { cls: "umos-cg-summary-val", text: s.value, parent: row });
			createElement("span", { cls: "umos-cg-summary-lbl", text: s.label, parent: row });
		}

		// ── Bottom: Type distribution bar ──
		if (all.length > 0) {
			const barSection = createElement("div", { cls: "umos-cg-dist-section", parent: block });
			const barTrack = createElement("div", { cls: "umos-cg-dist-bar", parent: barSection });
			const legend = createElement("div", { cls: "umos-cg-dist-legend", parent: barSection });

			for (const t of this.getTypes()) {
				const cnt = all.filter(c => c.typeKey === t.key).length;
				if (cnt === 0) continue;
				const pct = (cnt / all.length) * 100;

				const seg = createElement("div", { cls: "umos-cg-dist-seg", parent: barTrack });
				seg.style.width = `${pct}%`;
				seg.style.background = t.color || "#7c3aed";
				seg.title = `${t.icon} ${t.label}: ${cnt}`;

				const legendItem = createElement("div", { cls: "umos-cg-dist-legend-item", parent: legend });
				const dot = createElement("span", { cls: "umos-cg-dist-dot", parent: legendItem });
				dot.style.background = t.color || "#7c3aed";
				createElement("span", { cls: "umos-cg-dist-legend-label", text: `${t.icon} ${t.label}`, parent: legendItem });

				const inP = all.filter(c => c.typeKey === t.key && c.nStatus === "watching").length;
				const done = all.filter(c => c.typeKey === t.key && c.nStatus === "done").length;
				let detail = String(cnt);
				if (inP > 0) detail += ` (▶${inP})`;
				if (done > 0) detail += ` (✓${done})`;
				createElement("span", { cls: "umos-cg-dist-legend-count", text: detail, parent: legendItem });
			}
		}
	}

	// ── Filters ─────────────────────────────────

	private renderFilters(parent: HTMLElement): void {
		const bar = createElement("div", { cls: "umos-cg-filters-bar", parent });

		// ── Row 1: Search + action buttons ──────────
		const topRow = createElement("div", { cls: "umos-cg-filter-top-row", parent: bar });

		const searchWrap = createElement("div", { cls: "umos-cg-search-wrap", parent: topRow });
		const searchIcon = createElement("span", { cls: "umos-cg-search-icon", parent: searchWrap });
		setIcon(searchIcon, "search");
		const searchInput = createElement("input", { cls: "umos-cg-search-input", parent: searchWrap }) as HTMLInputElement;
		searchInput.type = "text";
		searchInput.placeholder = "Поиск по названию...";
		searchInput.value = this.searchQuery;
		searchInput.addEventListener("input", () => {
			this.searchQuery = searchInput.value;
			this.filterAndRender();
		});

		const addBtn = createElement("button", { cls: "umos-cg-add-btn", parent: topRow });
		addBtn.appendText("＋");
		createElement("span", { cls: "umos-cg-add-btn-text", text: " Добавить", parent: addBtn });
		addBtn.addEventListener("click", () => this.openAddModal());

		const wideBtn = createElement("button", {
			cls: `clickable-icon umos-cg-wide-btn${this.wideView ? " is-active" : ""}`,
			parent: topRow,
		});
		wideBtn.title = this.wideView ? "Обычная ширина" : "Развернуть на всю ширину";
		setIcon(wideBtn, this.wideView ? "minimize-2" : "maximize-2");
		wideBtn.addEventListener("click", () => {
			this.wideView = !this.wideView;
			wideBtn.classList.toggle("is-active", this.wideView);
			wideBtn.title = this.wideView ? "Обычная ширина" : "Развернуть на всю ширину";
			setIcon(wideBtn, this.wideView ? "minimize-2" : "maximize-2");
			this.applyWideMode(this.wideView);
			if (this.galleryEl) {
				this.galleryEl.classList.toggle("umos-cg-gallery--wide", this.wideView);
			}
		});

		// ── Row 2: Selects ───────────────────────────
		const selectRow = createElement("div", { cls: "umos-cg-select-row", parent: bar });

		// Тип
		this.renderSelect(selectRow, "Тип", [
			{ value: "all", label: "Все типы" },
			...this.getTypes().map(t => ({ value: t.key, label: `${t.icon} ${t.label}` })),
		], () => this.filterType, (v) => { this.filterType = v; this.filterAndRender(); });

		// Статус
		this.renderSelect(selectRow, "Статус", [
			{ value: "all", label: "Все статусы" },
			...ALL_STATUSES.map(k => ({ value: k, label: `${STATUS_DISPLAY[k].icon} ${STATUS_DISPLAY[k].label}` })),
		], () => this.filterStatus, (v) => { this.filterStatus = v; this.filterAndRender(); });

		// Сортировка
		this.renderSelect(selectRow, "Сортировка", [
			{ value: "updated", label: "🕐 По дате" },
			{ value: "name",    label: "🔤 По имени" },
			{ value: "rating",  label: "⭐ По оценке" },
		], () => this.sortMode, (v) => { this.sortMode = v; this.filterAndRender(); });

		// Группировка
		this.renderSelect(selectRow, "Группировка", [
			{ value: "none",   label: "Без группировки" },
			{ value: "type",   label: "По типу" },
			{ value: "status", label: "По статусу" },
		], () => this.groupMode, (v) => { this.groupMode = v as "none" | "type" | "status"; this.filterAndRender(); });

		// Count
		this.filterCountEl = createElement("span", { cls: "umos-cg-filter-count", parent: selectRow });
	}

	private renderSelect(
		parent: HTMLElement,
		label: string,
		options: { value: string; label: string }[],
		getValue: () => string,
		setValue: (v: string) => void,
	): void {
		const wrap = createElement("div", { cls: "umos-cg-select-wrap", parent });
		createElement("span", { cls: "umos-cg-select-label", text: label, parent: wrap });
		const sel = createElement("select", { cls: "umos-cg-select", parent: wrap }) as HTMLSelectElement;
		for (const opt of options) {
			const o = document.createElement("option");
			o.value = opt.value;
			o.textContent = opt.label;
			if (opt.value === getValue()) o.selected = true;
			sel.appendChild(o);
		}
		sel.addEventListener("change", () => setValue(sel.value));
	}

	// ── Filter + render gallery ─────────────────

	private filterAndRender(): void {
		if (!this.galleryEl || !this.emptyEl) return;
		this.galleryEl.empty();

		let filtered = [...this.allCards];
		if (this.filterType !== "all") {
			filtered = filtered.filter(c => c.typeKey === this.filterType);
		}
		if (this.filterStatus !== "all") {
			filtered = filtered.filter(c => c.nStatus === this.filterStatus);
		}
		if (this.searchQuery.trim()) {
			const q = this.searchQuery.trim().toLowerCase();
			filtered = filtered.filter(c => c.title.toLowerCase().includes(q));
		}

		filtered = this.sortCards(filtered);

		if (this.filterCountEl) {
			this.filterCountEl.textContent = `${filtered.length} из ${this.allCards.length}`;
		}

		if (filtered.length === 0) {
			this.emptyEl.style.display = "flex";
			return;
		}
		this.emptyEl.style.display = "none";

		const isGrouped = this.groupMode !== "none";
		this.galleryEl.classList.toggle("umos-cg-gallery--grouped", isGrouped);

		if (!isGrouped) {
			for (const card of filtered) {
				this.renderCard(this.galleryEl, card);
			}
		} else {
			// Build ordered groups preserving sort
			const groupKeys: string[] = [];
			const groups = new Map<string, ContentCard[]>();
			for (const card of filtered) {
				const key = this.groupMode === "type" ? card.typeKey : card.nStatus;
				if (!groups.has(key)) {
					groupKeys.push(key);
					groups.set(key, []);
				}
				groups.get(key)!.push(card);
			}

			for (const key of groupKeys) {
				const cards = groups.get(key)!;
				// Group header
				const header = createElement("div", { cls: "umos-cg-group-header", parent: this.galleryEl });
				if (this.groupMode === "type") {
					const t = this.getTypeMap()[key];
					if (t) {
						header.style.setProperty("--group-color", t.color || "var(--umos-accent)");
						createElement("span", { cls: "umos-cg-group-icon", text: t.icon, parent: header });
						createElement("span", { cls: "umos-cg-group-name", text: t.label, parent: header });
					}
				} else {
					const sm = STATUS_DISPLAY[key] || STATUS_DISPLAY["plan"];
					createElement("span", { cls: "umos-cg-group-icon", text: sm.icon, parent: header });
					createElement("span", { cls: "umos-cg-group-name", text: sm.label, parent: header });
				}
				createElement("span", { cls: "umos-cg-group-count", text: String(cards.length), parent: header });

				// Sub-grid
				const grid = createElement("div", {
					cls: `umos-cg-group-grid${this.wideView ? " umos-cg-gallery--wide" : ""}`,
					parent: this.galleryEl,
				});
				for (const card of cards) {
					this.renderCard(grid, card);
				}
			}
		}

		this.setupLazyLoad();
	}

	private sortCards(cards: ContentCard[]): ContentCard[] {
		return cards.sort((a, b) => {
			if (this.sortMode === "updated") return b.mtime - a.mtime;
			if (this.sortMode === "name") return a.title.localeCompare(b.title, "ru");
			if (this.sortMode === "rating") return b.rating - a.rating;
			return 0;
		});
	}

	// ── Card ────────────────────────────────────

	private renderCard(parent: HTMLElement, c: ContentCard): void {
		const card = createElement("div", {
			cls: `umos-cg-card umos-cg-card-t-${c.typeKey}`,
			parent,
		});
		card.style.setProperty("--cg-card-color", c.typeColor);
		card.addEventListener("click", () => {
			if (this.wideView) {
				this.applyWideMode(false);
				this.wideView = false;
			}
			this.obsidianApp.workspace.openLinkText(c.path, "", false);
		});

		// Cover
		const bg = createElement("div", {
			cls: c.coverUrl ? "umos-cg-card-bg umos-cg-card-lazy" : "umos-cg-card-bg umos-cg-card-nocover",
			parent: card,
		});
		if (c.coverUrl) {
			bg.dataset.bg = c.coverUrl;
		} else {
			createElement("span", { cls: "umos-cg-card-placeholder", text: c.typeIcon, parent: bg });
		}
		createElement("div", { cls: "umos-cg-card-overlay", parent: bg });

		// Hover actions
		const actions = createElement("div", { cls: "umos-cg-card-actions", parent: bg });

		const openBtn = createElement("button", { cls: "clickable-icon umos-cg-card-action-btn", parent: actions });
		openBtn.title = "Открыть заметку";
		setIcon(openBtn, "external-link");
		openBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			this.obsidianApp.workspace.openLinkText(c.path, "", false);
		});

		const nextStatus = c.nStatus === "watching" ? "done" : c.nStatus === "done" ? "plan" : "watching";
		const statusActionBtn = createElement("button", {
			cls: "clickable-icon umos-cg-card-action-btn",
			parent: actions,
		});
		statusActionBtn.title = c.nStatus === "done" ? "Сбросить на «В планах»" : c.nStatus === "watching" ? "Завершить" : "Начать";
		setIcon(statusActionBtn, c.nStatus === "done" ? "rotate-ccw" : c.nStatus === "watching" ? "check-circle" : "play");
		statusActionBtn.addEventListener("click", async (e) => {
			e.stopPropagation();
			await this.quickSetStatus(c, nextStatus);
		});

		// Content
		const content = createElement("div", { cls: "umos-cg-card-content", parent: card });

		// Badges row
		const badges = createElement("div", { cls: "umos-cg-card-badges", parent: content });
		const typeBadge = createElement("span", {
			cls: "umos-cg-card-type",
			text: `${c.typeIcon} ${c.typeLabel}`,
			parent: badges,
		});
		typeBadge.style.setProperty("--cg-badge-color", c.typeColor);

		const sm = STATUS_DISPLAY[c.nStatus] || STATUS_DISPLAY["plan"];
		createElement("span", {
			cls: `umos-cg-card-status ${sm.cls}`,
			text: sm.label,
			parent: badges,
		});

		// Title
		createElement("div", { cls: "umos-cg-card-title", text: c.title, parent: content });

		// Meta (genre + year)
		const meta = [c.genreStr, c.year].filter(Boolean).join(" · ");
		if (meta) {
			createElement("div", { cls: "umos-cg-card-meta", text: meta, parent: content });
		}

		// Rating
		if (c.rating > 0) {
			const starsCount = Math.min(Math.round(c.rating / 2), 5);
			const stars = "★".repeat(starsCount) + "☆".repeat(5 - starsCount);
			createElement("div", {
				cls: "umos-cg-card-rating",
				text: `${stars} ${c.rating}/10`,
				parent: content,
			});
		}

		// Progress (hidden for completed titles)
		const bottom = createElement("div", { cls: "umos-cg-card-bottom", parent: content });
		if (c.nStatus !== "done" && c.pct >= 0) {
			const pbar = createElement("div", { cls: "umos-cg-card-pbar", parent: bottom });
			const fill = createElement("div", { cls: "umos-cg-card-pfill", parent: pbar });
			fill.style.width = `${c.pct}%`;
			fill.style.background = `linear-gradient(90deg, ${c.typeColor}, color-mix(in srgb, ${c.typeColor} 70%, white))`;
		}
		if (c.nStatus !== "done" && c.progressLabel) {
			createElement("span", {
				cls: "umos-cg-card-ptext",
				text: c.pct >= 0 ? `${c.progressLabel} · ${c.pct}%` : c.progressLabel,
				parent: bottom,
			});
		}
	}

	// ── Quick status update ──────────────────────

	private async quickSetStatus(card: ContentCard, newStatus: string): Promise<void> {
		const file = this.obsidianApp.vault.getAbstractFileByPath(card.path);
		if (!(file instanceof TFile)) return;

		const statusValues: Record<string, string> = {
			"plan":     "📋 plan",
			"watching": "▶️ watching",
			"done":     "✅ done",
			"drop":     "⛔ drop",
			"on-hold":  "⏸️ on-hold",
		};

		await this.obsidianApp.fileManager.processFrontMatter(file, (fm) => {
			fm.status = statusValues[newStatus] ?? newStatus;
		});

		const label = STATUS_DISPLAY[newStatus]?.label ?? newStatus;
		new Notice(`${card.title} → ${label}`, 2000);
		this.allCards = this.loadAllCards();
		this.filterAndRender();
	}

	// ── Lazy load covers ────────────────────────

	private setupLazyLoad(): void {
		if (!this.galleryEl) return;
		const lazyEls = this.galleryEl.querySelectorAll(".umos-cg-card-lazy");
		if (!lazyEls.length) return;

		const observer = new IntersectionObserver((entries, obs) => {
			for (const entry of entries) {
				if (entry.isIntersecting) {
					const el = entry.target as HTMLElement;
					const bgUrl = el.dataset.bg;
					if (bgUrl) {
						el.style.backgroundImage = `url('${bgUrl}')`;
						el.classList.remove("umos-cg-card-lazy");
						el.classList.add("umos-cg-card-loaded");
					}
					obs.unobserve(el);
				}
			}
		}, { rootMargin: "300px", threshold: 0 });

		lazyEls.forEach(el => observer.observe(el));
	}

	// ── Add modal ───────────────────────────────

	private openAddModal(): void {
		const types = this.getTypes();
		if (types.length === 0) {
			new Notice("Нет типов контента. Добавьте их в настройках плагина.");
			return;
		}

		const m = new Modal(this.obsidianApp);
		m.modalEl.addClass("umos-cg-obsidian-modal");
		const { contentEl } = m;

		contentEl.createEl("h3", { text: "Добавить контент", cls: "umos-cg-modal-title" });
		const body = contentEl.createDiv({ cls: "umos-cg-modal-body" });

		// Type selector
		const typeField = body.createDiv({ cls: "umos-cg-modal-field" });
		typeField.createEl("label", { cls: "umos-cg-modal-label", text: "Тип контента" });
		const typeGrid = typeField.createDiv({ cls: "umos-cg-modal-types" });

		let selectedType = types[0].key;
		const typeBtns: HTMLButtonElement[] = [];

		for (const t of types) {
			const btn = createElement("button", {
				cls: `umos-cg-modal-type-btn ${t.key === selectedType ? "umos-cg-mtb-active" : ""}`,
				parent: typeGrid,
			});
			btn.dataset.key = t.key;
			btn.style.setProperty("--cg-mtb-color", t.color || "#7c3aed");
			createElement("span", { text: t.label, parent: btn });
			typeBtns.push(btn);
			btn.addEventListener("click", () => {
				typeBtns.forEach(b => b.classList.remove("umos-cg-mtb-active"));
				btn.classList.add("umos-cg-mtb-active");
				selectedType = t.key;
			});
		}

		// Name input
		const nameField = body.createDiv({ cls: "umos-cg-modal-field" });
		nameField.createEl("label", { cls: "umos-cg-modal-label", text: "Название" });
		const nameInput = nameField.createEl("input", {
			cls: "umos-cg-modal-input",
			attr: { type: "text", placeholder: "Введите название..." },
		});

		// Submit
		const submitBtn = body.createEl("button", { cls: "umos-cg-modal-submit", text: "Создать" });

		const create = async () => {
			const name = nameInput.value.trim();
			if (!name) { new Notice("Введите название"); return; }
			const typeMap = this.getTypeMap();
			const typeObj = typeMap[selectedType];
			if (!typeObj) return;
			const root = this.getContentRoot();
			const folderPath = `${root}/${typeObj.folder}`;
			const folder = this.obsidianApp.vault.getAbstractFileByPath(folderPath);
			if (!folder) await this.obsidianApp.vault.createFolder(folderPath);
			const safeName = name.replace(/[\\/:*?"<>|]/g, "_");
			const filePath = `${folderPath}/${safeName}.md`;
			const existing = this.obsidianApp.vault.getAbstractFileByPath(filePath);
			if (existing) { new Notice(`Файл уже существует: ${safeName}`); return; }
			const fileContent = contentTemplate(typeObj, name);
			const newFile = await this.obsidianApp.vault.create(filePath, fileContent);
			m.close();
			new Notice(`✅ Создано: ${safeName}`);
			const leaf = this.obsidianApp.workspace.getLeaf(false);
			await leaf.openFile(newFile);
			this.allCards = this.loadAllCards();
			this.render();
		};

		submitBtn.addEventListener("click", create);
		nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") void create(); });
		m.open();
		setTimeout(() => nameInput.focus(), 80);
	}

	onWidgetUnload(): void {
		// Restore sizer max-width when the widget is destroyed
		if (this.wideView) this.applyWideMode(false);
	}
}
