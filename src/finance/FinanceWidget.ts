import { setIcon } from "obsidian";
import { EventBus } from "../EventBus";
import { BaseWidget, EventSubscription } from "../core/BaseWidget";
import { FinanceService, UpcomingPayment } from "./FinanceService";
import { UmOSSettings, FinanceTransaction, FinanceRecurring } from "../settings/Settings";
import { createElement, createSvgElement } from "../utils/dom";

export interface FinanceTrackerConfig {
	month?: string;
	style: "full" | "compact";
}

type FormMode = "none" | "expense" | "income" | "topup" | "recurring";

export class FinanceWidget extends BaseWidget {
	protected eventBus: EventBus;
	private financeService: FinanceService;
	private settings: UmOSSettings;
	private config: FinanceTrackerConfig;

	private formMode: FormMode = "none";
	private editingTx: FinanceTransaction | null = null;
	private viewMonth: string;

	constructor(
		containerEl: HTMLElement,
		config: FinanceTrackerConfig,
		eventBus: EventBus,
		financeService: FinanceService,
		settings: UmOSSettings
	) {
		super(containerEl);
		this.eventBus = eventBus;
		this.financeService = financeService;
		this.settings = settings;
		this.config = config;
		this.viewMonth = config.month ?? this.currentMonthStr();
	}

	protected subscribeToEvents(): EventSubscription[] {
		const rerender = () => this.render();
		return [
			{ event: "finance:transaction-added", handler: rerender },
			{ event: "finance:transaction-updated", handler: rerender },
			{ event: "finance:transaction-deleted", handler: rerender },
			{ event: "finance:balance-updated", handler: rerender },
			{ event: "finance:recurring-updated", handler: rerender },
		];
	}

	private fmt(n: number): string {
		return Math.abs(n).toLocaleString("ru-RU");
	}

	private get cur(): string {
		return this.settings.financeCurrency || "₽";
	}

	private currentMonthStr(): string {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
	}

	private formatMonth(m: string): string {
		const [year, month] = m.split("-");
		const names = ["Январь","Февраль","Март","Апрель","Май","Июнь",
		               "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
		return `${names[parseInt(month) - 1]} ${year}`;
	}

	private prevMonth(m: string): string {
		const [y, mo] = m.split("-").map(Number);
		const d = new Date(y, mo - 2, 1);
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
	}

	private nextMonth(m: string): string {
		const [y, mo] = m.split("-").map(Number);
		const d = new Date(y, mo, 1);
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
	}

	private formatDate(dateStr: string): string {
		const [, m, d] = dateStr.split("-");
		const months = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
		return `${parseInt(d)} ${months[parseInt(m) - 1]}`;
	}

	protected render(): void {
		const savedForm = this.formMode;
		const savedEdit = this.editingTx;
		this.containerEl.empty();

		const wrapper = createElement("div", { cls: "umos-finance-widget", parent: this.containerEl });

		if (this.config.style === "compact") {
			this.renderCompact(wrapper);
		} else {
			this.renderFull(wrapper, savedForm, savedEdit);
		}
	}

	// ── COMPACT MODE ──────────────────────────────────────────────────────

	private renderCompact(wrapper: HTMLElement): void {
		const balance = this.financeService.getBalance();
		const stats = this.financeService.getCurrentMonthStats();

		// Balance row
		const balRow = createElement("div", { cls: "umos-finance-compact-bal", parent: wrapper });
		createElement("span", { cls: "umos-finance-compact-bal-label", text: "Баланс", parent: balRow });
		createElement("span", {
			cls: "umos-finance-compact-bal-value",
			text: `${this.fmt(balance)}${this.cur}`,
			parent: balRow,
		});

		// Monthly stat strip
		const strip = createElement("div", { cls: "umos-finance-compact-strip", parent: wrapper });
		const makeChip = (label: string, val: string, cls: string) => {
			const chip = createElement("div", { cls: `umos-finance-compact-chip ${cls}`, parent: strip });
			createElement("span", { cls: "umos-finance-compact-chip-label", text: label, parent: chip });
			createElement("span", { cls: "umos-finance-compact-chip-val", text: val, parent: chip });
		};
		makeChip("Доходы", `+${this.fmt(stats.income)}${this.cur}`, "umos-fc-income");
		makeChip("Расходы", `-${this.fmt(stats.spent)}${this.cur}`, "umos-fc-expense");

		// Last 3 transactions
		const recent = [...stats.transactions]
			.sort((a, b) => b.date.localeCompare(a.date))
			.slice(0, 3);
		if (recent.length > 0) {
			const list = createElement("div", { cls: "umos-finance-compact-list", parent: wrapper });
			for (const tx of recent) {
				const cat = this.settings.financeCategories.find(c => c.id === tx.categoryId);
				const row = createElement("div", { cls: "umos-finance-tx-row", parent: list });
				const icon = createElement("div", { cls: "umos-finance-tx-icon", parent: row });
				icon.textContent = cat?.icon ?? "❓";
				icon.style.background = (cat?.color ?? "#95a5a6") + "22";
				const info = createElement("div", { cls: "umos-finance-tx-info", parent: row });
				createElement("span", { cls: "umos-finance-tx-name", text: cat?.name ?? "Прочее", parent: info });
				const isIncome = tx.type === "income";
				createElement("span", {
					cls: `umos-finance-tx-amount ${isIncome ? "umos-fc-income" : "umos-fc-expense"}`,
					text: `${isIncome ? "+" : "-"}${this.fmt(tx.amount)}${this.cur}`,
					parent: row,
				});
			}
		}
	}

	// ── FULL MODE ─────────────────────────────────────────────────────────

	private renderFull(wrapper: HTMLElement, savedForm: FormMode, savedEdit: FinanceTransaction | null): void {
		const balance = this.financeService.getBalance();
		const stats = this.financeService.getMonthStats(this.viewMonth);
		const isCurrentMonth = this.viewMonth === this.currentMonthStr();

		// ── Hero balance card ──
		const hero = createElement("div", { cls: "umos-finance-hero", parent: wrapper });
		const heroLeft = createElement("div", { cls: "umos-finance-hero-left", parent: hero });
		createElement("div", { cls: "umos-finance-hero-label", text: "Текущий баланс", parent: heroLeft });
		createElement("div", {
			cls: `umos-finance-hero-value${balance < 0 ? " umos-fc-negative" : ""}`,
			text: `${balance < 0 ? "-" : ""}${this.fmt(balance)}${this.cur}`,
			parent: heroLeft,
		});

		// Top-up button
		const topupBtn = createElement("button", { cls: "umos-finance-topup-btn", parent: hero });
		topupBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
		topupBtn.title = "Пополнить / установить баланс";
		topupBtn.addEventListener("click", () => {
			this.formMode = this.formMode === "topup" ? "none" : "topup";
			this.editingTx = null;
			this.render();
		});

		// ── Month navigator ──
		const monthNav = createElement("div", { cls: "umos-finance-month-nav", parent: wrapper });
		const prevBtn = createElement("button", { cls: "umos-finance-month-btn", text: "‹", parent: monthNav });
		createElement("div", { cls: "umos-finance-month-label", text: this.formatMonth(this.viewMonth), parent: monthNav });
		const nextBtn = createElement("button", { cls: "umos-finance-month-btn", text: "›", parent: monthNav });

		if (isCurrentMonth) nextBtn.disabled = true;

		prevBtn.addEventListener("click", () => { this.viewMonth = this.prevMonth(this.viewMonth); this.render(); });
		nextBtn.addEventListener("click", () => { this.viewMonth = this.nextMonth(this.viewMonth); this.render(); });

		// ── Quick action buttons ──
		const actions = createElement("div", { cls: "umos-finance-actions", parent: wrapper });

		const makeActionBtn = (label: string, iconName: string, mode: FormMode, cls: string) => {
			const btn = createElement("button", { cls: `umos-finance-action-btn ${cls}${savedForm === mode ? " is-active" : ""}`, parent: actions });
			const iconSpan = createElement("span", { cls: "umos-finance-action-icon", parent: btn });
			setIcon(iconSpan, iconName);
			createElement("span", { text: label, parent: btn });
			btn.addEventListener("click", () => {
				this.formMode = this.formMode === mode ? "none" : mode;
				this.editingTx = null;
				this.render();
			});
		};

		makeActionBtn("Расход", "arrow-down-circle", "expense", "umos-finance-btn-expense");
		makeActionBtn("Доход", "arrow-up-circle", "income", "umos-finance-btn-income");
		makeActionBtn("Регулярные", "repeat", "recurring", "umos-finance-btn-neutral");

		// ── Form area ──
		if (savedForm === "topup" || savedForm === "expense" || savedForm === "income") {
			this.renderTransactionForm(wrapper, savedForm === "topup" ? "topup" : savedForm as "expense" | "income", savedEdit ?? undefined);
		} else if (savedForm === "recurring") {
			this.renderRecurringManager(wrapper);
		}

		// ── Monthly stats ──
		const monthStats = createElement("div", { cls: "umos-finance-month-stats", parent: wrapper });
		const net = stats.income - stats.spent;

		const makeStat = (icon: string, label: string, val: string, cls: string) => {
			const col = createElement("div", { cls: `umos-finance-stat-col ${cls}`, parent: monthStats });
			createElement("div", { cls: "umos-finance-stat-icon", text: icon, parent: col });
			createElement("div", { cls: "umos-finance-stat-val", text: val, parent: col });
			createElement("div", { cls: "umos-finance-stat-label", text: label, parent: col });
		};

		makeStat("↑", "Доходы", `+${this.fmt(stats.income)}${this.cur}`, "umos-fc-income");
		makeStat("↓", "Расходы", `-${this.fmt(stats.spent)}${this.cur}`, "umos-fc-expense");
		makeStat("≈", "Разница", `${net >= 0 ? "+" : "-"}${this.fmt(net)}${this.cur}`, net >= 0 ? "umos-fc-income" : "umos-fc-expense");

		// ── Upcoming payments ──
		const upcoming = this.financeService.getUpcomingPayments(14);
		if (upcoming.length > 0) {
			createElement("div", { cls: "umos-finance-section-title", text: "Ближайшие платежи", parent: wrapper });
			const upRow = createElement("div", { cls: "umos-finance-upcoming-row", parent: wrapper });
			for (const up of upcoming.slice(0, 5)) {
				this.renderUpcomingCard(upRow, up);
			}
		}

		// ── Category donut ──
		const catEntries = Object.entries(stats.categoryBreakdown).sort((a, b) => b[1].amount - a[1].amount);
		if (catEntries.length > 0) {
			createElement("div", { cls: "umos-finance-section-title", text: "По категориям", parent: wrapper });
			const catSection = createElement("div", { cls: "umos-finance-cat-section", parent: wrapper });

			this.renderDonut(catSection, catEntries.map(([, c]) => ({ value: c.amount, color: c.color, label: c.name })), stats.spent);

			const legend = createElement("div", { cls: "umos-finance-cat-legend", parent: catSection });
			for (const [, cat] of catEntries) {
				const item = createElement("div", { cls: "umos-finance-cat-item", parent: legend });
				const dot = createElement("span", { cls: "umos-finance-cat-dot", parent: item });
				dot.style.background = cat.color;
				createElement("span", { cls: "umos-finance-cat-name", text: `${cat.icon} ${cat.name}`, parent: item });
				createElement("span", { cls: "umos-finance-cat-pct", text: `${cat.percentage}%`, parent: item });
				createElement("span", { cls: "umos-finance-cat-amount", text: `${this.fmt(cat.amount)}${this.cur}`, parent: item });
			}
		}

		// ── Transactions list ──
		const allTx = [...stats.transactions].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
		if (allTx.length > 0) {
			createElement("div", { cls: "umos-finance-section-title", text: "Операции", parent: wrapper });
			const txList = createElement("div", { cls: "umos-finance-tx-list", parent: wrapper });

			for (const tx of allTx) {
				const cat = this.settings.financeCategories.find(c => c.id === tx.categoryId);
				const isIncome = tx.type === "income";

				const row = createElement("div", { cls: "umos-finance-tx-row umos-finance-tx-row--full", parent: txList });

				const iconEl = createElement("div", { cls: "umos-finance-tx-icon", parent: row });
				iconEl.textContent = cat?.icon ?? "❓";
				iconEl.style.background = (cat?.color ?? "#95a5a6") + "22";
				iconEl.style.color = cat?.color ?? "#95a5a6";

				const info = createElement("div", { cls: "umos-finance-tx-info", parent: row });
				createElement("span", { cls: "umos-finance-tx-name", text: cat?.name ?? "Прочее", parent: info });
				if (tx.description) {
					createElement("span", { cls: "umos-finance-tx-desc", text: tx.description, parent: info });
				}
				createElement("span", { cls: "umos-finance-tx-date", text: this.formatDate(tx.date), parent: info });

				createElement("span", {
					cls: `umos-finance-tx-amount ${isIncome ? "umos-fc-income" : "umos-fc-expense"}`,
					text: `${isIncome ? "+" : "-"}${this.fmt(tx.amount)}${this.cur}`,
					parent: row,
				});

				// Controls
				const ctrl = createElement("div", { cls: "umos-finance-tx-ctrl", parent: row });

				const editBtn = createElement("button", { cls: "umos-finance-tx-btn", parent: ctrl });
				editBtn.title = "Редактировать";
				setIcon(editBtn, "pencil");
				editBtn.addEventListener("click", () => {
					this.editingTx = tx;
					this.formMode = tx.type === "income" ? "income" : "expense";
					this.render();
				});

				const delBtn = createElement("button", { cls: "umos-finance-tx-btn umos-finance-tx-btn--del", parent: ctrl });
				delBtn.title = "Удалить";
				setIcon(delBtn, "trash-2");
				delBtn.addEventListener("click", () => { this.financeService.deleteTransaction(tx.id); });
			}
		} else {
			createElement("div", { cls: "umos-finance-empty", text: "Нет операций за этот месяц", parent: wrapper });
		}
	}

	// ── Upcoming payment card ─────────────────────────────────────────────

	private renderUpcomingCard(parent: HTMLElement, up: UpcomingPayment): void {
		const card = createElement("div", { cls: "umos-finance-upcoming-card", parent });

		const icon = createElement("div", { cls: "umos-finance-upcoming-icon", parent: card });
		icon.textContent = up.categoryIcon;
		icon.style.background = up.categoryColor + "22";
		icon.style.color = up.categoryColor;

		createElement("div", { cls: "umos-finance-upcoming-name", text: up.recurring.name, parent: card });
		createElement("div", {
			cls: `umos-finance-upcoming-amount ${up.recurring.type === "income" ? "umos-fc-income" : "umos-fc-expense"}`,
			text: `${up.recurring.type === "income" ? "+" : "-"}${this.fmt(up.recurring.amount)}${this.cur}`,
			parent: card,
		});
		createElement("div", {
			cls: "umos-finance-upcoming-days",
			text: up.daysUntil === 0 ? "Сегодня" : up.daysUntil === 1 ? "Завтра" : `${up.daysUntil} дн.`,
			parent: card,
		});
	}

	// ── Transaction / top-up form ─────────────────────────────────────────

	private renderTransactionForm(parent: HTMLElement, mode: "expense" | "income" | "topup", existing?: FinanceTransaction): void {
		const form = createElement("div", { cls: "umos-finance-form", parent });
		const isTopup = mode === "topup";
		const isEditing = !!existing;

		if (!isTopup) {
			// Type toggle
			const typeRow = createElement("div", { cls: "umos-finance-form-type-row", parent: form });
			let selType: "expense" | "income" = existing?.type ?? (mode as "expense" | "income");

			const expBtn = createElement("button", {
				cls: `umos-finance-type-pill${selType === "expense" ? " is-expense" : ""}`,
				text: "↓ Расход",
				parent: typeRow,
			});
			const incBtn = createElement("button", {
				cls: `umos-finance-type-pill${selType === "income" ? " is-income" : ""}`,
				text: "↑ Доход",
				parent: typeRow,
			});

			expBtn.addEventListener("click", () => { selType = "expense"; expBtn.className = "umos-finance-type-pill is-expense"; incBtn.className = "umos-finance-type-pill"; });
			incBtn.addEventListener("click", () => { selType = "income"; incBtn.className = "umos-finance-type-pill is-income"; expBtn.className = "umos-finance-type-pill"; });

			// Amount
			const amtInput = createElement("input", {
				cls: "umos-finance-input",
				attr: { type: "number", placeholder: `Сумма (${this.cur})`, min: "0", step: "any", value: existing ? String(existing.amount) : "" },
				parent: form,
			}) as HTMLInputElement;

			// Category select
			let selectedCatId = existing?.categoryId ?? (this.settings.financeCategories[0]?.id ?? "");
			const catSelWrap = createElement("div", { cls: "umos-finance-select-wrap", parent: form });
			const catSel = createElement("select", { cls: "umos-finance-select", parent: catSelWrap }) as HTMLSelectElement;
			for (const cat of this.settings.financeCategories) {
				const opt = createElement("option", { text: `${cat.icon} ${cat.name}`, parent: catSel }) as HTMLOptionElement;
				opt.value = cat.id;
				if (cat.id === selectedCatId) opt.selected = true;
			}
			catSel.addEventListener("change", () => { selectedCatId = catSel.value; });

			// Description
			const descInput = createElement("input", {
				cls: "umos-finance-input",
				attr: { type: "text", placeholder: "Описание (необязательно)", value: existing?.description ?? "" },
				parent: form,
			}) as HTMLInputElement;

			// Buttons
			const btnRow = createElement("div", { cls: "umos-finance-form-btns", parent: form });
			const submitBtn = createElement("button", { cls: "umos-finance-submit-btn", text: isEditing ? "Сохранить" : "Добавить", parent: btnRow });
			const cancelBtn = createElement("button", { cls: "umos-finance-cancel-btn", text: "Отмена", parent: btnRow });

			submitBtn.addEventListener("click", () => {
				const amount = parseFloat(amtInput.value);
				if (!amount || amount <= 0) return;
				if (isEditing && existing) {
					this.financeService.updateTransaction(existing.id, { type: selType, amount, categoryId: selectedCatId, description: descInput.value.trim() });
				} else {
					this.financeService.addTransaction(selType, amount, selectedCatId, descInput.value.trim());
				}
				this.formMode = "none";
				this.editingTx = null;
			});

			cancelBtn.addEventListener("click", () => { this.formMode = "none"; this.editingTx = null; this.render(); });
			requestAnimationFrame(() => amtInput.focus());

		} else {
			// Top-up / set balance form
			createElement("div", { cls: "umos-finance-form-title", text: "Установить текущий баланс", parent: form });
			const amtInput = createElement("input", {
				cls: "umos-finance-input",
				attr: { type: "number", placeholder: `Баланс (${this.cur})`, step: "any", value: String(this.financeService.getBalance()) },
				parent: form,
			}) as HTMLInputElement;

			const btnRow = createElement("div", { cls: "umos-finance-form-btns", parent: form });
			const saveBtn = createElement("button", { cls: "umos-finance-submit-btn", text: "Сохранить", parent: btnRow });
			const cancelBtn = createElement("button", { cls: "umos-finance-cancel-btn", text: "Отмена", parent: btnRow });

			saveBtn.addEventListener("click", () => {
				const v = parseFloat(amtInput.value);
				if (isNaN(v)) return;
				this.financeService.setBalance(v);
				this.formMode = "none";
			});
			cancelBtn.addEventListener("click", () => { this.formMode = "none"; this.render(); });
			requestAnimationFrame(() => amtInput.focus());
		}
	}

	// ── Recurring payments manager ────────────────────────────────────────

	private renderRecurringManager(parent: HTMLElement): void {
		const box = createElement("div", { cls: "umos-finance-recurring-box", parent });
		createElement("div", { cls: "umos-finance-form-title", text: "Регулярные платежи", parent: box });

		const list = this.financeService.getRecurring();
		if (list.length > 0) {
			const listEl = createElement("div", { cls: "umos-finance-recurring-list", parent: box });
			for (const r of list) {
				const cat = this.settings.financeCategories.find(c => c.id === r.categoryId);
				const row = createElement("div", { cls: "umos-finance-recurring-row", parent: listEl });
				createElement("span", { cls: "umos-finance-recurring-icon", text: r.icon ?? cat?.icon ?? "📋", parent: row });
				const info = createElement("div", { cls: "umos-finance-recurring-info", parent: row });
				createElement("span", { cls: "umos-finance-recurring-name", text: r.name, parent: info });
				createElement("span", {
					cls: "umos-finance-recurring-detail",
					text: `${r.dayOfMonth}-е каждого месяца · ${this.fmt(r.amount)}${this.cur}`,
					parent: info,
				});
				const delBtn = createElement("button", { cls: "umos-finance-tx-btn umos-finance-tx-btn--del", parent: row });
				delBtn.title = "Удалить";
				setIcon(delBtn, "trash-2");
				delBtn.addEventListener("click", () => { this.financeService.deleteRecurring(r.id); });
			}
		}

		// Add recurring form
		createElement("div", { cls: "umos-finance-recurring-subtitle", text: "Добавить", parent: box });
		const form = createElement("div", { cls: "umos-finance-recurring-form", parent: box });

		const nameInput = createElement("input", {
			cls: "umos-finance-input",
			attr: { type: "text", placeholder: "Название (напр. Netflix)" },
			parent: form,
		}) as HTMLInputElement;

		const amtInput = createElement("input", {
			cls: "umos-finance-input",
			attr: { type: "number", placeholder: `Сумма`, min: "0", step: "any" },
			parent: form,
		}) as HTMLInputElement;

		const dayInput = createElement("input", {
			cls: "umos-finance-input",
			attr: { type: "number", placeholder: "День месяца (1-28)", min: "1", max: "28" },
			parent: form,
		}) as HTMLInputElement;

		const catSel = createElement("select", { cls: "umos-finance-select", parent: form }) as HTMLSelectElement;
		for (const cat of this.settings.financeCategories) {
			const opt = createElement("option", { text: `${cat.icon} ${cat.name}`, parent: catSel });
			opt.value = cat.id;
		}

		let rType: FinanceRecurring["type"] = "expense";
		const typeRow = createElement("div", { cls: "umos-finance-form-type-row", parent: form });
		const expBtn = createElement("button", { cls: "umos-finance-type-pill is-expense", text: "↓ Расход", parent: typeRow });
		const incBtn = createElement("button", { cls: "umos-finance-type-pill", text: "↑ Доход", parent: typeRow });
		expBtn.addEventListener("click", () => { rType = "expense"; expBtn.className = "umos-finance-type-pill is-expense"; incBtn.className = "umos-finance-type-pill"; });
		incBtn.addEventListener("click", () => { rType = "income"; incBtn.className = "umos-finance-type-pill is-income"; expBtn.className = "umos-finance-type-pill"; });

		const addBtn = createElement("button", { cls: "umos-finance-submit-btn", text: "Добавить платёж", parent: form });
		addBtn.addEventListener("click", () => {
			const name = nameInput.value.trim();
			const amount = parseFloat(amtInput.value);
			const day = parseInt(dayInput.value);
			if (!name || !amount || !day || day < 1 || day > 28) return;
			this.financeService.addRecurring({ name, amount, categoryId: catSel.value, type: rType, dayOfMonth: day });
			nameInput.value = "";
			amtInput.value = "";
			dayInput.value = "";
		});
	}

	// ── SVG Donut chart ───────────────────────────────────────────────────

	private renderDonut(parent: HTMLElement, segments: { value: number; color: string; label: string }[], total: number): void {
		const size = 120;
		const strokeWidth = 18;
		const radius = (size - strokeWidth) / 2;
		const circumference = 2 * Math.PI * radius;
		const center = size / 2;

		const svgWrap = createElement("div", { cls: "umos-finance-donut-wrap", parent });
		const svg = createSvgElement("svg", {
			viewBox: `0 0 ${size} ${size}`,
			width: String(size),
			height: String(size),
		}, svgWrap);

		// Background ring
		createSvgElement("circle", {
			cx: String(center), cy: String(center), r: String(radius),
			fill: "none",
			stroke: "var(--background-modifier-border)",
			"stroke-width": String(strokeWidth),
		}, svg);

		if (total > 0) {
			let offset = 0;
			for (const seg of segments) {
				const pct = seg.value / total;
				const arcLen = pct * circumference;
				const dashOffset = circumference - arcLen;

				createSvgElement("circle", {
					cx: String(center), cy: String(center), r: String(radius),
					fill: "none",
					stroke: seg.color,
					"stroke-width": String(strokeWidth),
					"stroke-dasharray": `${arcLen} ${circumference - arcLen}`,
					"stroke-dashoffset": String(circumference * (1 - offset) - circumference),
					"stroke-linecap": "butt",
					transform: `rotate(-90 ${center} ${center})`,
					style: `stroke-dashoffset: ${-(offset * circumference)}`,
				}, svg);

				offset += pct;
			}
		}

		// Center text
		createSvgElement("text", {
			x: String(center), y: String(center - 6),
			"text-anchor": "middle", "dominant-baseline": "central",
			"font-size": "11", "font-weight": "700", fill: "var(--text-normal)",
		}, svg).textContent = `${this.fmt(total)}`;

		createSvgElement("text", {
			x: String(center), y: String(center + 10),
			"text-anchor": "middle", "dominant-baseline": "central",
			"font-size": "8", fill: "var(--text-muted)",
		}, svg).textContent = this.cur;
	}
}
