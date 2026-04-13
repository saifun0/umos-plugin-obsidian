import { App, TFile, TFolder, Notice, Modal } from "obsidian";
import { EventBus } from "../EventBus";
import { UmOSSettings } from "../settings/Settings";
import { createElement } from "../utils/dom";
import { BaseWidget } from "../core/BaseWidget";

// ── Конфигурация виджета ────────────────────────

export interface ProjectGalleryConfig {
	style: "grid" | "list";
}

// ── Статусы проекта ─────────────────────────────

interface StatusMeta { label: string; cls: string; icon: string; color: string }

const STATUS_NORMALIZE: Record<string, string> = {
	"📋 plan":        "plan",
	"▶️ active":      "active",
	"▶️ in-progress": "active",
	"✅ done":        "done",
	"✅ completed":   "done",
	"⛔ cancelled":   "cancelled",
	"⏸️ on-hold":    "on-hold",
	"plan":           "plan",
	"active":         "active",
	"in-progress":    "active",
	"done":           "done",
	"completed":      "done",
	"cancelled":      "cancelled",
	"dropped":        "cancelled",
	"on-hold":        "on-hold",
	"paused":         "on-hold",
};

const STATUS_DISPLAY: Record<string, StatusMeta> = {
	"plan":      { label: "В планах",  cls: "umos-pg-s-plan",      icon: "📋", color: "#95a5a6" },
	"active":    { label: "В работе",  cls: "umos-pg-s-active",    icon: "▶️",  color: "#3498db" },
	"done":      { label: "Завершён",  cls: "umos-pg-s-done",      icon: "✅", color: "#27ae60" },
	"cancelled": { label: "Отменён",   cls: "umos-pg-s-cancelled", icon: "⛔", color: "#e74c3c" },
	"on-hold":   { label: "На паузе",  cls: "umos-pg-s-hold",      icon: "⏸️",  color: "#f39c12" },
};

// Canonical raw values written to frontmatter
const STATUS_RAW: Record<string, string> = {
	"plan":      "📋 plan",
	"active":    "▶️ active",
	"done":      "✅ done",
	"cancelled": "⛔ cancelled",
	"on-hold":   "⏸️ on-hold",
};

// Cycle order for quick-action button
const STATUS_CYCLE = ["plan", "active", "on-hold", "done"];

const ALL_STATUSES = Object.keys(STATUS_DISPLAY);

// ── Приоритеты ──────────────────────────────────

const PRIORITY_DISPLAY: Record<string, { label: string; cls: string; icon: string }> = {
	"high":   { label: "Высокий", cls: "umos-pg-p-high",   icon: "🔴" },
	"medium": { label: "Средний", cls: "umos-pg-p-medium", icon: "🟡" },
	"low":    { label: "Низкий",  cls: "umos-pg-p-low",    icon: "🟢" },
};

// ── Карточка проекта ────────────────────────────

interface ProjectCard {
	title: string;
	path: string;
	folderPath: string;
	coverUrl: string;
	nStatus: string;
	priority: string;
	deadline: string;
	deadlineDays: number;
	tasksTotal: number;
	tasksDone: number;
	tasksPct: number;
	tags: string[];
	description: string;
	color: string;
	mtime: number;
}

// ── Шаблон новой заметки проекта ────────────────

function projectTemplate(title: string): string {
	const today = new Date().toISOString().slice(0, 10);
	const slug  = title.replace(/[\\/:*?"<>|]/g, "_").replace(/ /g, "-").toLowerCase();
	const lines: string[] = [
		"---",
		`title: "${title}"`,
		`status: "📋 plan"`,
		`priority: "medium"`,
		`deadline: ""`,
		`color: "#3498db"`,
		'cover_url: ""',
		`start_date: "${today}"`,
		"tags:",
		"  - project",
		'description: ""',
		"---",
		"",
		`# 🚀 ${title}`,
		"",
		"## Информация",
		"",
		"```umos-input",
		"type: select",
		"property: status",
		"label: Статус",
		"style: pills",
		'options: ["📋 plan", "▶️ active", "✅ done", "⛔ cancelled", "⏸️ on-hold"]',
		'labels: ["В планах", "В работе", "Завершён", "Отменён", "На паузе"]',
		'colors: ["#95a5a6", "#3498db", "#27ae60", "#e74c3c", "#f39c12"]',
		"```",
		"",
		"```umos-input",
		"type: select",
		"property: priority",
		"label: Приоритет",
		"style: pills",
		'options: ["high", "medium", "low"]',
		'labels: ["Высокий", "Средний", "Низкий"]',
		'colors: ["#e74c3c", "#f39c12", "#27ae60"]',
		"```",
		"",
		"```umos-input",
		"type: date",
		"property: deadline",
		"label: Дедлайн",
		"```",
		"",
		"```umos-input",
		"type: date",
		"property: start_date",
		"label: Дата начала",
		"```",
		"",
		"```umos-input",
		"type: text",
		"property: description",
		"label: Описание",
		"placeholder: Краткое описание проекта...",
		"multiline: true",
		"```",
		"",
		"```umos-input",
		"type: text",
		"property: cover_url",
		"label: Обложка (URL)",
		"placeholder: https://...",
		"```",
		"",
		"---",
		"",
		"## Задачи проекта",
		"",
		"```tasks-widget",
		`tag: projectTasks/${slug}`,
		"target: current",
		`title: Задачи проекта`,
		"```",
		"",
		`- [ ] Первая задача #projectTasks/${slug}`,
		"",
		"---",
		"",
		"## Заметки",
		"",
	];
	return lines.join("\n");
}

// ── Подсчёт задач (чекбоксов) в файлах папки ───

function countTasksInFolder(app: App, folder: TFolder): { total: number; done: number } {
	let total = 0;
	let done  = 0;
	for (const child of folder.children) {
		if (child instanceof TFolder) {
			const sub = countTasksInFolder(app, child);
			total += sub.total; done += sub.done;
			continue;
		}
		if (!(child instanceof TFile) || child.extension !== "md") continue;
		const cache = app.metadataCache.getFileCache(child);
		if (!cache?.listItems) continue;
		for (const item of cache.listItems) {
			if (item.task !== undefined) {
				total++;
				if (item.task === "x" || item.task === "X") done++;
			}
		}
	}
	return { total, done };
}

// ── Дни до дедлайна ────────────────────────────

function daysUntil(dateStr: string): number {
	if (!dateStr) return Infinity;
	const target = new Date(dateStr);
	if (isNaN(target.getTime())) return Infinity;
	const now = new Date();
	now.setHours(0, 0, 0, 0);
	target.setHours(0, 0, 0, 0);
	return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDeadline(days: number): string {
	if (days === Infinity || days === -Infinity) return "";
	if (days < 0)  return `просрочено на ${Math.abs(days)} дн.`;
	if (days === 0) return "сегодня!";
	if (days === 1) return "завтра";
	if (days <= 7)  return `через ${days} дн.`;
	if (days <= 30) return `через ${Math.ceil(days / 7)} нед.`;
	return `через ${Math.ceil(days / 30)} мес.`;
}

// ── SVG ring helper ─────────────────────────────

function renderMiniRing(parent: HTMLElement, percent: number, color: string, size: number, label: string): void {
	const container = createElement("div", { cls: "umos-pg-ring-container", parent });

	const svgNS = "http://www.w3.org/2000/svg";
	const svg = document.createElementNS(svgNS, "svg");
	svg.setAttribute("width",   String(size));
	svg.setAttribute("height",  String(size));
	svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
	svg.classList.add("umos-pg-ring-svg");
	container.appendChild(svg);

	const cx = size / 2, cy = size / 2;
	const strokeWidth = 5;
	const r = (size - strokeWidth) / 2;
	const circumference = 2 * Math.PI * r;
	const offset = circumference * (1 - Math.min(percent, 100) / 100);

	const bg = document.createElementNS(svgNS, "circle");
	bg.setAttribute("cx", String(cx)); bg.setAttribute("cy", String(cy));
	bg.setAttribute("r", String(r));   bg.setAttribute("fill", "none");
	bg.setAttribute("stroke", "var(--background-modifier-border)");
	bg.setAttribute("stroke-width", String(strokeWidth));
	svg.appendChild(bg);

	const val = document.createElementNS(svgNS, "circle");
	val.setAttribute("cx", String(cx)); val.setAttribute("cy", String(cy));
	val.setAttribute("r", String(r));   val.setAttribute("fill", "none");
	val.setAttribute("stroke", color);  val.setAttribute("stroke-width", String(strokeWidth));
	val.setAttribute("stroke-linecap", "round");
	val.setAttribute("stroke-dasharray",  String(circumference));
	val.setAttribute("stroke-dashoffset", String(offset));
	val.setAttribute("transform", `rotate(-90 ${cx} ${cy})`);
	val.classList.add("umos-pg-ring-value");
	svg.appendChild(val);

	createElement("div", { cls: "umos-pg-ring-text",  text: `${Math.round(percent)}%`, parent: container });
	createElement("div", { cls: "umos-pg-ring-label", text: label,                      parent: container });
}

// ── Виджет ──────────────────────────────────────

export class ProjectGallery extends BaseWidget {
	private config: ProjectGalleryConfig;
	private obsidianApp: App;
	protected eventBus: EventBus;
	private settings: UmOSSettings;

	private filterStatus   = "all";
	private filterPriority = "all";
	private filterSearch   = "";
	private sortMode       = "deadline";
	private galleryEl:     HTMLElement | null = null;
	private filterCountEl: HTMLElement | null = null;
	private emptyEl:       HTMLElement | null = null;
	private allCards:      ProjectCard[]      = [];

	constructor(
		containerEl: HTMLElement,
		config: ProjectGalleryConfig,
		app: App,
		eventBus: EventBus,
		settings: UmOSSettings,
	) {
		super(containerEl);
		this.config      = config;
		this.obsidianApp = app;
		this.eventBus    = eventBus;
		this.settings    = settings;
	}

	onload(): void {
		this.allCards = this.loadAllCards();
		super.onload();
	}

	protected render(): void { this.renderInternal(); }

	// ── Data loading ───────────────────────────

	private getProjectsRoot(): string {
		return this.settings.homeProjectsPath || "20 Projects";
	}

	private normalizeStatus(raw: unknown): string {
		if (!raw) return "plan";
		const s = String(raw).trim();
		return STATUS_NORMALIZE[s] || s;
	}

	private loadAllCards(): ProjectCard[] {
		const root = this.getProjectsRoot();
		const rootFolder = this.obsidianApp.vault.getAbstractFileByPath(root);
		if (!(rootFolder instanceof TFolder)) return [];

		const cards: ProjectCard[] = [];
		for (const child of rootFolder.children) {
			if (!(child instanceof TFolder)) continue;
			const indexFile = this.findProjectFile(child);
			if (!indexFile) continue;
			const cache = this.obsidianApp.metadataCache.getFileCache(indexFile);
			const fm = cache?.frontmatter;
			if (!fm) continue;

			const nStatus      = this.normalizeStatus(fm.status);
			const deadline     = String(fm.deadline || "");
			const deadlineDays = daysUntil(deadline);
			const tasks        = countTasksInFolder(this.obsidianApp, child);
			const tasksPct     = tasks.total > 0 ? Math.round((tasks.done / tasks.total) * 100) : 0;

			let coverUrl = "";
			const coverStr = String(fm.cover_url || fm.cover || fm.image || "");
			if (coverStr.startsWith("http") || coverStr.startsWith("//")) {
				coverUrl = coverStr;
			} else if (coverStr.length > 0) {
				const clean = coverStr
					.replace(/^!?\[\[/, "").replace(/\]\]$/, "")
					.replace(/^!?\[.*?\]\(/, "").replace(/\)$/, "");
				const f = this.obsidianApp.vault.getAbstractFileByPath(clean)
					|| this.obsidianApp.metadataCache.getFirstLinkpathDest(clean, "");
				if (f instanceof TFile) coverUrl = this.obsidianApp.vault.getResourcePath(f);
			}

			const rawTags  = fm.tags || [];
			const tags: string[] = Array.isArray(rawTags) ? rawTags.map(String) : [];
			const priority = String(fm.priority || "medium").toLowerCase();

			cards.push({
				title:       String(fm.title || child.name),
				path:        indexFile.path,
				folderPath:  child.path,
				coverUrl,
				nStatus,
				priority:    PRIORITY_DISPLAY[priority] ? priority : "medium",
				deadline,
				deadlineDays,
				tasksTotal:  tasks.total,
				tasksDone:   tasks.done,
				tasksPct,
				tags:        tags.filter(t => t !== "project"),
				description: String(fm.description || ""),
				color:       String(fm.color || "#3498db"),
				mtime:       indexFile.stat.mtime,
			});
		}
		return cards;
	}

	private findProjectFile(folder: TFolder): TFile | null {
		for (const child of folder.children)
			if (child instanceof TFile && child.name === "index.md") return child;
		for (const child of folder.children)
			if (child instanceof TFile && child.basename === folder.name) return child;
		for (const child of folder.children)
			if (child instanceof TFile && child.extension === "md") return child;
		return null;
	}

	// ── Render ──────────────────────────────────

	private renderInternal(): void {
		this.containerEl.empty();
		const wrapper = createElement("div", { cls: "umos-pg", parent: this.containerEl });

		this.renderStats(wrapper);
		createElement("div", { cls: "umos-pg-divider", parent: wrapper });
		this.renderFilters(wrapper);

		this.galleryEl = createElement("div", {
			cls:    `umos-pg-gallery ${this.config.style === "list" ? "umos-pg-gallery-list" : ""}`,
			parent: wrapper,
		});

		this.emptyEl = createElement("div", { cls: "umos-pg-empty", parent: wrapper });
		this.emptyEl.style.display = "none";
		createElement("div", { cls: "umos-pg-empty-icon", text: "🔍", parent: this.emptyEl });
		createElement("div", { cls: "umos-pg-empty-text", text: "Нет проектов", parent: this.emptyEl });

		this.filterAndRender();
	}

	// ── Stats ───────────────────────────────────

	private renderStats(parent: HTMLElement): void {
		const all = this.allCards;
		const cnt = {
			active:    all.filter(c => c.nStatus === "active").length,
			plan:      all.filter(c => c.nStatus === "plan").length,
			done:      all.filter(c => c.nStatus === "done").length,
			"on-hold": all.filter(c => c.nStatus === "on-hold").length,
			cancelled: all.filter(c => c.nStatus === "cancelled").length,
		};
		const totalTasks = all.reduce((s, c) => s + c.tasksTotal, 0);
		const doneTasks  = all.reduce((s, c) => s + c.tasksDone,  0);
		const tasksPct   = totalTasks > 0 ? (doneTasks  / totalTasks) * 100 : 0;
		const projPct    = all.length  > 0 ? (cnt.done  / all.length)  * 100 : 0;
		const overdue    = all.filter(c =>
			c.deadlineDays < 0 && c.nStatus !== "done" && c.nStatus !== "cancelled",
		).length;

		const block = createElement("div", { cls: "umos-pg-stats", parent });

		// ── Status distribution bar ──
		if (all.length > 0) {
			const distItems = [
				{ key: "active",    count: cnt.active,          color: "#3498db", label: "В работе"  },
				{ key: "plan",      count: cnt.plan,            color: "#95a5a6", label: "В планах"  },
				{ key: "done",      count: cnt.done,            color: "#27ae60", label: "Завершено" },
				{ key: "on-hold",   count: cnt["on-hold"],      color: "#f39c12", label: "На паузе"  },
				{ key: "cancelled", count: cnt.cancelled,       color: "#e74c3c", label: "Отменено"  },
			].filter(d => d.count > 0);

			const bar = createElement("div", { cls: "umos-pg-dist-bar", parent: block });
			for (const d of distItems) {
				const seg = createElement("div", { cls: "umos-pg-dist-seg", parent: bar });
				seg.style.width      = `${(d.count / all.length) * 100}%`;
				seg.style.background = d.color;
				seg.title = `${d.label}: ${d.count}`;
			}

			const legend = createElement("div", { cls: "umos-pg-dist-legend", parent: block });
			for (const d of distItems) {
				const item = createElement("div", { cls: "umos-pg-dist-item", parent: legend });
				const dot  = createElement("span", { cls: "umos-pg-dist-dot",   parent: item });
				dot.style.background = d.color;
				createElement("b",    { cls: "umos-pg-dist-count", text: String(d.count), parent: item });
				createElement("span", { cls: "umos-pg-dist-name",  text: d.label,         parent: item });
			}
		}

		createElement("div", { cls: "umos-pg-stats-sep", parent: block });

		// ── Rings + compact key stats ──
		const metricsRow = createElement("div", { cls: "umos-pg-metrics-row", parent: block });

		renderMiniRing(metricsRow, projPct,  "var(--umos-success)", 72, "Проектов");
		renderMiniRing(metricsRow, tasksPct, "var(--umos-accent)",  72, "Задач");

		createElement("div", { cls: "umos-pg-metrics-divider", parent: metricsRow });

		const keyStats = createElement("div", { cls: "umos-pg-key-stats", parent: metricsRow });
		const ksItems = [
			{ v: String(all.length),   l: "Всего",      icon: "📦", alert: false },
			{ v: String(cnt.active),   l: "В работе",   icon: "▶️",  alert: false },
			{ v: String(overdue),      l: "Просрочено", icon: "🔥", alert: overdue > 0 },
		];
		for (const s of ksItems) {
			const card = createElement("div", {
				cls:    `umos-pg-ks-card${s.alert ? " is-alert" : ""}`,
				parent: keyStats,
			});
			createElement("div", { cls: "umos-pg-ks-val",   text: s.v,              parent: card });
			createElement("div", { cls: "umos-pg-ks-label", text: `${s.icon} ${s.l}`, parent: card });
		}
	}

	// ── Filters ─────────────────────────────────

	private renderFilters(parent: HTMLElement): void {
		const bar = createElement("div", { cls: "umos-pg-filters-bar", parent });

		// ── Search ──
		const searchWrap = createElement("div", { cls: "umos-pg-search-wrap", parent: bar });
		createElement("span", { cls: "umos-pg-search-icon", text: "🔍", parent: searchWrap });
		const searchInput = createElement("input", { cls: "umos-pg-search-input", parent: searchWrap });
		searchInput.type        = "text";
		searchInput.placeholder = "Поиск проектов...";
		searchInput.value       = this.filterSearch;
		searchInput.addEventListener("input", () => {
			this.filterSearch = searchInput.value;
			this.filterAndRender();
		});

		// ── Status pills ──
		const pillsRow = createElement("div", { cls: "umos-pg-pills-row", parent: bar });

		const allPill = createElement("button", {
			cls:    `umos-pg-pill${this.filterStatus === "all" ? " is-active" : ""}`,
			text:   "Все",
			parent: pillsRow,
		});
		allPill.addEventListener("click", () => {
			this.filterStatus = "all";
			this.syncPills(pillsRow, "all");
			this.filterAndRender();
		});

		for (const key of ALL_STATUSES) {
			const m   = STATUS_DISPLAY[key];
			const btn = createElement("button", {
				cls:    `umos-pg-pill${this.filterStatus === key ? " is-active" : ""}`,
				parent: pillsRow,
			});
			btn.dataset.statusKey = key;
			btn.style.setProperty("--pill-color", m.color);
			createElement("span", { text: m.icon,         parent: btn });
			createElement("span", { text: ` ${m.label}`,  parent: btn });
			btn.addEventListener("click", () => {
				this.filterStatus = key;
				this.syncPills(pillsRow, key);
				this.filterAndRender();
			});
		}

		// ── Row 2: priority + sort + add btn + count ──
		const row2 = createElement("div", { cls: "umos-pg-filters-row2", parent: bar });

		const prioGroup = createElement("div", { cls: "umos-pg-select-group", parent: row2 });
		createElement("label", { cls: "umos-pg-select-label", text: "Приоритет", parent: prioGroup });
		const prioSelect = createElement("select", { cls: "umos-pg-select", parent: prioGroup });
		this.addOpt(prioSelect, "all", "Все приоритеты");
		for (const [key, m] of Object.entries(PRIORITY_DISPLAY))
			this.addOpt(prioSelect, key, `${m.icon} ${m.label}`);
		prioSelect.value = this.filterPriority;
		prioSelect.addEventListener("change", () => {
			this.filterPriority = prioSelect.value;
			this.filterAndRender();
		});

		const sortGroup = createElement("div", { cls: "umos-pg-select-group", parent: row2 });
		createElement("label", { cls: "umos-pg-select-label", text: "Сортировка", parent: sortGroup });
		const sortSelect = createElement("select", { cls: "umos-pg-select", parent: sortGroup });
		this.addOpt(sortSelect, "deadline", "📅 По дедлайну");
		this.addOpt(sortSelect, "updated",  "🕐 Обновлённые");
		this.addOpt(sortSelect, "name",     "🔤 По имени");
		this.addOpt(sortSelect, "progress", "📊 По прогрессу");
		sortSelect.value = this.sortMode;
		sortSelect.addEventListener("change", () => {
			this.sortMode = sortSelect.value;
			this.filterAndRender();
		});

		const addBtn = createElement("button", { cls: "umos-pg-add-btn", parent: row2 });
		addBtn.appendText("＋");
		createElement("span", { cls: "umos-pg-add-btn-text", text: " Новый проект", parent: addBtn });
		addBtn.addEventListener("click", () => this.openAddModal());

		this.filterCountEl = createElement("div", { cls: "umos-pg-filter-count", parent: row2 });
	}

	private syncPills(pillsRow: HTMLElement, activeKey: string): void {
		pillsRow.querySelectorAll<HTMLElement>(".umos-pg-pill").forEach(btn => {
			const isAll    = !btn.dataset.statusKey && activeKey === "all";
			const isStatus = btn.dataset.statusKey === activeKey;
			btn.classList.toggle("is-active", isAll || isStatus);
		});
	}

	private addOpt(select: HTMLSelectElement, value: string, text: string): void {
		const opt = createElement("option", { text });
		opt.value = value;
		select.appendChild(opt);
	}

	// ── Filter + render ─────────────────────────

	private filterAndRender(): void {
		if (!this.galleryEl || !this.emptyEl) return;
		this.galleryEl.empty();

		let filtered = [...this.allCards];
		if (this.filterStatus !== "all")
			filtered = filtered.filter(c => c.nStatus === this.filterStatus);
		if (this.filterPriority !== "all")
			filtered = filtered.filter(c => c.priority === this.filterPriority);
		if (this.filterSearch.trim()) {
			const q = this.filterSearch.toLowerCase();
			filtered = filtered.filter(c =>
				c.title.toLowerCase().includes(q) ||
				c.description.toLowerCase().includes(q) ||
				c.tags.some(t => t.toLowerCase().includes(q)),
			);
		}

		filtered = this.sortCards(filtered);

		if (this.filterCountEl)
			this.filterCountEl.textContent = `${filtered.length} из ${this.allCards.length}`;

		if (filtered.length === 0) { this.emptyEl.style.display = "flex"; return; }
		this.emptyEl.style.display = "none";
		for (const card of filtered) this.renderCard(this.galleryEl, card);
		this.setupLazyLoad();
	}

	private sortCards(cards: ProjectCard[]): ProjectCard[] {
		return cards.sort((a, b) => {
			if (this.sortMode === "deadline") {
				if (a.deadlineDays === Infinity && b.deadlineDays !== Infinity) return 1;
				if (b.deadlineDays === Infinity && a.deadlineDays !== Infinity) return -1;
				return a.deadlineDays - b.deadlineDays;
			}
			if (this.sortMode === "updated")  return b.mtime - a.mtime;
			if (this.sortMode === "name")     return a.title.localeCompare(b.title, "ru");
			if (this.sortMode === "progress") return b.tasksPct - a.tasksPct;
			return 0;
		});
	}

	// ── Card ────────────────────────────────────

	private renderCard(parent: HTMLElement, c: ProjectCard): void {
		const card = createElement("div", { cls: "umos-pg-card", parent });
		card.style.setProperty("--pg-card-color", c.color);
		card.addEventListener("click", () =>
			this.obsidianApp.workspace.openLinkText(c.path, "", false),
		);

		// Cover / color header
		const bg = createElement("div", {
			cls:    c.coverUrl ? "umos-pg-card-bg umos-pg-card-lazy" : "umos-pg-card-bg umos-pg-card-nocover",
			parent: card,
		});
		if (c.coverUrl) {
			bg.dataset.bg = c.coverUrl;
		} else {
			bg.style.background = `linear-gradient(135deg, ${c.color}, color-mix(in srgb, ${c.color} 60%, black))`;
			createElement("span", { cls: "umos-pg-card-placeholder", text: "🚀", parent: bg });
		}
		createElement("div", { cls: "umos-pg-card-overlay", parent: bg });

		// Deadline badge
		if (c.deadline && c.nStatus !== "done" && c.nStatus !== "cancelled") {
			const dl = createElement("div", {
				cls:    `umos-pg-card-deadline${c.deadlineDays < 0 ? " umos-pg-deadline-overdue" : c.deadlineDays <= 3 ? " umos-pg-deadline-soon" : ""}`,
				parent: bg,
			});
			createElement("span", { cls: "umos-pg-deadline-icon", text: "📅",                     parent: dl });
			createElement("span", { cls: "umos-pg-deadline-text", text: formatDeadline(c.deadlineDays), parent: dl });
		}

		// Content
		const content = createElement("div", { cls: "umos-pg-card-content", parent: card });

		const badgesRow = createElement("div", { cls: "umos-pg-card-badges-row", parent: content });
		const badges    = createElement("div", { cls: "umos-pg-card-badges",     parent: badgesRow });
		const sm = STATUS_DISPLAY[c.nStatus] || STATUS_DISPLAY["plan"];
		createElement("span", { cls: `umos-pg-card-status ${sm.cls}`, text: `${sm.icon} ${sm.label}`, parent: badges });
		const pm = PRIORITY_DISPLAY[c.priority];
		if (pm) createElement("span", { cls: `umos-pg-card-priority ${pm.cls}`, text: `${pm.icon} ${pm.label}`, parent: badges });

		const deleteBtn = createElement("button", { cls: "umos-pg-card-delete", parent: badgesRow });
		deleteBtn.setAttribute("aria-label", "Удалить проект");
		deleteBtn.textContent = "✕";
		deleteBtn.addEventListener("click", async (e) => {
			e.stopPropagation();
			if (!window.confirm(`Удалить проект "${c.title}"? Будет удалена вся папка проекта.`)) return;
			await this.deleteProjectFolder(c.folderPath);
			this.allCards = this.loadAllCards();
			this.render();
		});

		createElement("div", { cls: "umos-pg-card-title", text: c.title, parent: content });

		if (c.description) {
			const desc = c.description.length > 80 ? c.description.slice(0, 80) + "..." : c.description;
			createElement("div", { cls: "umos-pg-card-desc", text: desc, parent: content });
		}

		if (c.tags.length > 0) {
			const tagsEl = createElement("div", { cls: "umos-pg-card-tags", parent: content });
			for (const tag of c.tags.slice(0, 3))
				createElement("span", { cls: "umos-pg-card-tag", text: `#${tag}`, parent: tagsEl });
		}

		const bottom = createElement("div", { cls: "umos-pg-card-bottom", parent: content });
		if (c.tasksTotal > 0) {
			const pbar = createElement("div", { cls: "umos-pg-card-pbar", parent: bottom });
			const fill = createElement("div", { cls: "umos-pg-card-pfill", parent: pbar });
			fill.style.width      = `${c.tasksPct}%`;
			fill.style.background = `linear-gradient(90deg, ${c.color}, color-mix(in srgb, ${c.color} 70%, white))`;
			createElement("span", {
				cls:  "umos-pg-card-ptext",
				text: `${c.tasksDone}/${c.tasksTotal} задач · ${c.tasksPct}%`,
				parent: bottom,
			});
		} else {
			createElement("span", { cls: "umos-pg-card-ptext umos-pg-card-ptext-empty", text: "Нет задач", parent: bottom });
		}

		// ── Hover action bar ──
		const actions = createElement("div", { cls: "umos-pg-card-actions", parent: card });
		actions.addEventListener("click", e => e.stopPropagation());

		const openBtn = createElement("button", { cls: "umos-pg-card-action-btn", text: "↗ Открыть", parent: actions });
		openBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			this.obsidianApp.workspace.openLinkText(c.path, "", false);
		});

		const nextKey  = STATUS_CYCLE[(STATUS_CYCLE.indexOf(c.nStatus) + 1) % STATUS_CYCLE.length];
		const nextMeta = STATUS_DISPLAY[nextKey];
		const cycleBtn = createElement("button", {
			cls:  "umos-pg-card-action-btn",
			text: `${nextMeta.icon} ${nextMeta.label}`,
			parent: actions,
		});
		cycleBtn.addEventListener("click", async (e) => {
			e.stopPropagation();
			await this.cycleCardStatus(c);
		});
	}

	// ── Status cycle ────────────────────────────

	private async cycleCardStatus(card: ProjectCard): Promise<void> {
		const file = this.obsidianApp.vault.getAbstractFileByPath(card.path);
		if (!(file instanceof TFile)) return;
		const nextKey   = STATUS_CYCLE[(STATUS_CYCLE.indexOf(card.nStatus) + 1) % STATUS_CYCLE.length];
		const nextRaw   = STATUS_RAW[nextKey] ?? nextKey;
		const nextLabel = STATUS_DISPLAY[nextKey]?.label ?? nextKey;
		await this.obsidianApp.fileManager.processFrontMatter(file, fm => { fm.status = nextRaw; });
		new Notice(`Статус: ${nextLabel}`);
		this.allCards = this.loadAllCards();
		this.render();
	}

	// ── Delete ──────────────────────────────────

	private async deleteProjectFolder(folderPath: string): Promise<void> {
		const folder = this.obsidianApp.vault.getAbstractFileByPath(folderPath);
		if (!(folder instanceof TFolder)) { new Notice("Папка проекта не найдена"); return; }
		await this.deleteFolderRecursive(folder);
		new Notice("Проект удалён");
	}

	private async deleteFolderRecursive(folder: TFolder): Promise<void> {
		for (const child of [...folder.children]) {
			if (child instanceof TFolder) await this.deleteFolderRecursive(child);
			else await this.obsidianApp.vault.delete(child);
		}
		await this.obsidianApp.vault.delete(folder);
	}

	// ── Lazy load ───────────────────────────────

	private setupLazyLoad(): void {
		if (!this.galleryEl) return;
		const lazyEls = this.galleryEl.querySelectorAll(".umos-pg-card-lazy");
		if (!lazyEls.length) return;
		const observer = new IntersectionObserver((entries, obs) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				const el    = entry.target as HTMLElement;
				const bgUrl = el.dataset.bg;
				if (bgUrl) {
					el.style.backgroundImage = `url('${bgUrl}')`;
					el.classList.replace("umos-pg-card-lazy", "umos-pg-card-loaded");
				}
				obs.unobserve(el);
			}
		}, { rootMargin: "300px", threshold: 0 });
		lazyEls.forEach(el => observer.observe(el));
	}

	// ── Add modal ───────────────────────────────

	private openAddModal(): void {
		const m = new Modal(this.obsidianApp);
		m.modalEl.addClass("umos-pg-obsidian-modal");
		const { contentEl } = m;

		contentEl.createEl("h3", { text: "Новый проект", cls: "umos-pg-modal-title" });
		const body = contentEl.createDiv({ cls: "umos-pg-modal-body" });

		// Name
		const nameField = body.createDiv({ cls: "umos-pg-modal-field" });
		nameField.createEl("label", { cls: "umos-pg-modal-label", text: "Название" });
		const nameInput = nameField.createEl("input", {
			cls: "umos-pg-modal-input",
			attr: { type: "text", placeholder: "Введите название..." },
		});

		// Description
		const descField = body.createDiv({ cls: "umos-pg-modal-field" });
		descField.createEl("label", { cls: "umos-pg-modal-label", text: "Описание (необязательно)" });
		const descInput = descField.createEl("textarea", {
			cls: "umos-pg-modal-input umos-pg-modal-textarea",
			attr: { placeholder: "Краткое описание проекта..." },
		}) as HTMLTextAreaElement;

		// Priority + Color row
		const row = body.createDiv({ cls: "umos-pg-modal-row" });

		const prioField = row.createDiv({ cls: "umos-pg-modal-field" });
		prioField.createEl("label", { cls: "umos-pg-modal-label", text: "Приоритет" });
		const prioSelect = prioField.createEl("select", { cls: "umos-pg-modal-input" }) as HTMLSelectElement;
		for (const [key, meta] of Object.entries(PRIORITY_DISPLAY)) {
			const opt = prioSelect.createEl("option", { text: `${meta.icon} ${meta.label}` });
			opt.value = key;
		}
		prioSelect.value = "medium";

		const colorField = row.createDiv({ cls: "umos-pg-modal-field" });
		colorField.createEl("label", { cls: "umos-pg-modal-label", text: "Цвет проекта" });
		const colorWrap  = colorField.createDiv({ cls: "umos-pg-modal-color-wrap" });
		const colorInput = colorWrap.createEl("input", {
			cls: "umos-pg-modal-color-input",
			attr: { type: "color", value: "#3498db" },
		}) as HTMLInputElement;
		const presetsEl  = colorWrap.createDiv({ cls: "umos-pg-modal-presets" });
		for (const hex of ["#3498db", "#e74c3c", "#27ae60", "#f39c12", "#9b59b6", "#1abc9c", "#e67e22", "#e91e63"]) {
			const dot = presetsEl.createDiv({ cls: "umos-pg-modal-preset-dot" });
			dot.style.background = hex;
			dot.title = hex;
			dot.addEventListener("click", () => { colorInput.value = hex; });
		}

		// Deadline
		const dlField = body.createDiv({ cls: "umos-pg-modal-field" });
		dlField.createEl("label", { cls: "umos-pg-modal-label", text: "Дедлайн (необязательно)" });
		const dlInput = dlField.createEl("input", {
			cls: "umos-pg-modal-input",
			attr: { type: "date" },
		}) as HTMLInputElement;

		// Submit
		const submitBtn = body.createEl("button", { cls: "umos-pg-modal-submit", text: "Создать проект" });

		const create = async () => {
			const name = nameInput.value.trim();
			if (!name) { new Notice("Введите название проекта"); return; }
			const root     = this.getProjectsRoot();
			const safeName = name.replace(/[\\/:*?"<>|]/g, "_");
			const folderPath = `${root}/${safeName}`;
			if (!this.obsidianApp.vault.getAbstractFileByPath(root))
				await this.obsidianApp.vault.createFolder(root);
			if (this.obsidianApp.vault.getAbstractFileByPath(folderPath)) {
				new Notice(`Проект уже существует: ${safeName}`); return;
			}
			await this.obsidianApp.vault.createFolder(folderPath);

			let content = projectTemplate(name);
			if (dlInput.value)           content = content.replace('deadline: ""',      `deadline: "${dlInput.value}"`);
			if (colorInput.value !== "#3498db") content = content.replace('color: "#3498db"', `color: "${colorInput.value}"`);
			if (descInput.value.trim())  content = content.replace('description: ""',   `description: "${descInput.value.trim()}"`);
			if (prioSelect.value !== "medium")  content = content.replace('priority: "medium"', `priority: "${prioSelect.value}"`);

			const newFile = await this.obsidianApp.vault.create(`${folderPath}/index.md`, content);
			m.close();
			new Notice(`✅ Проект создан: ${safeName}`);
			await this.obsidianApp.workspace.getLeaf(false).openFile(newFile);
			this.allCards = this.loadAllCards();
			this.render();
		};

		submitBtn.addEventListener("click", () => void create());
		nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") void create(); });
		m.open();
		setTimeout(() => nameInput.focus(), 80);
	}
}
