import { Notice } from "obsidian";
import { BaseWidget, EventSubscription } from "../core/BaseWidget";
import { EventBus } from "../EventBus";
import { BalanceService } from "./BalanceService";

interface BalanceWidgetConfig {
	/** "full" shows chart + history; "compact" shows only balance card + log form. */
	style: "full" | "compact";
}

export class BalanceWidget extends BaseWidget {
	private readonly balanceService: BalanceService;
	private readonly config: BalanceWidgetConfig;

	// Widget-local UI state (persists across renders)
	private activeMode: "earn" | "spend" = "earn";
	private selectedActivityId: string | null = null;
	private selectedEntertainmentId: string | null = null;

	constructor(
		containerEl: HTMLElement,
		config: BalanceWidgetConfig,
		eventBus: EventBus,
		balanceService: BalanceService,
	) {
		super(containerEl);
		this.config = config;
		this.eventBus = eventBus;
		this.balanceService = balanceService;
	}

	protected subscribeToEvents(): EventSubscription[] {
		return [{ event: "balance:updated", handler: () => this.render() }];
	}

	protected render(): void {
		this.containerEl.empty();
		const root = this.containerEl.createDiv({ cls: "umos-balance" });

		this.renderHeader(root);
		this.renderBalanceCard(root);
		this.renderDailyBonus(root);
		this.renderLogSection(root);

		if (this.config.style === "full") {
			this.renderWeekChart(root);
			this.renderRecentEntries(root);
		}
	}

	// ─── Formatting ───────────────────────────────────────────────────────────

	private fmt(minutes: number): string {
		const abs = Math.abs(minutes);
		const h = Math.floor(abs / 60);
		const m = abs % 60;
		if (h === 0) return `${m}мин`;
		if (m === 0) return `${h}ч`;
		return `${h}ч ${m}мин`;
	}

	// ─── Sections ─────────────────────────────────────────────────────────────

	private renderHeader(root: HTMLElement): void {
		root.createDiv({ cls: "umos-balance-header" })
			.createSpan({ cls: "umos-balance-title", text: "⚖️ Баланс времени" });
	}

	private renderBalanceCard(root: HTMLElement): void {
		const balance  = this.balanceService.getBalance();
		const earned   = this.balanceService.getTodayEarned();
		const spent    = this.balanceService.getTodaySpent();
		const settings = this.balanceService.getPluginSettings();

		const card = root.createDiv({ cls: "umos-balance-card" });

		// Big balance number
		const amountWrap = card.createDiv({ cls: "umos-balance-amount-wrap" });
		const levelCls = balance >= 60 ? "umos-balance-good" : balance >= 20 ? "umos-balance-med" : "umos-balance-low";
		amountWrap.createDiv({ cls: `umos-balance-amount ${levelCls}`, text: this.fmt(balance) });
		amountWrap.createDiv({ cls: "umos-balance-label", text: "свободного времени" });

		// Progress bar (only when maxTotal is set)
		if (settings.balanceMaxTotal > 0) {
			const pct = Math.min(100, (balance / settings.balanceMaxTotal) * 100);
			const barWrap = card.createDiv({ cls: "umos-balance-bar-wrap" });
			const track = barWrap.createDiv({ cls: "umos-balance-bar" });
			track.createDiv({ cls: "umos-balance-bar-fill", attr: { style: `width:${pct.toFixed(1)}%` } });
			barWrap.createDiv({
				cls: "umos-balance-bar-label",
				text: `${Math.round(pct)}% от ${this.fmt(settings.balanceMaxTotal)}`,
			});
		}

		// Today summary
		const row = card.createDiv({ cls: "umos-balance-today" });
		row.createSpan({ cls: "umos-balance-today-item umos-balance-earn-text", text: `+${this.fmt(earned)} заработано` });
		row.createSpan({ cls: "umos-balance-today-sep", text: "·" });
		row.createSpan({ cls: "umos-balance-today-item umos-balance-spend-text", text: `-${this.fmt(spent)} потрачено` });

		// Daily earnings cap notice
		if (settings.balanceMaxDailyEarnings > 0) {
			const remaining = settings.balanceMaxDailyEarnings - earned;
			if (remaining <= 0) {
				card.createDiv({ cls: "umos-balance-cap-warn", text: "⚠️ Дневной лимит заработка достигнут" });
			} else {
				card.createDiv({ cls: "umos-balance-cap-info", text: `Ещё можно заработать: ${this.fmt(remaining)}` });
			}
		}
	}

	private renderDailyBonus(root: HTMLElement): void {
		if (!this.balanceService.hasDailyBonus()) return;
		const bonus = this.balanceService.getPluginSettings().balanceDailyBonus;
		const wrap = root.createDiv({ cls: "umos-balance-bonus" });
		const btn = wrap.createEl("button", {
			cls: "umos-balance-bonus-btn",
			text: `🎁 Забрать ежедневный бонус +${this.fmt(bonus)}`,
		});
		btn.addEventListener("click", () => {
			if (this.balanceService.claimDailyBonus()) {
				new Notice(`🎁 Бонус +${this.fmt(bonus)} начислен!`);
			}
		});
	}

	private renderLogSection(root: HTMLElement): void {
		const section = root.createDiv({ cls: "umos-balance-log-section" });

		// Tabs
		const tabs = section.createDiv({ cls: "umos-balance-tabs" });
		const earnTab  = tabs.createEl("button", { cls: `umos-balance-tab${this.activeMode === "earn" ? " active" : ""}`, text: "💪 Заработать" });
		const spendTab = tabs.createEl("button", { cls: `umos-balance-tab${this.activeMode === "spend" ? " active" : ""}`, text: "🎮 Потратить" });
		earnTab.addEventListener("click", () => { this.activeMode = "earn"; this.render(); });
		spendTab.addEventListener("click", () => { this.activeMode = "spend"; this.render(); });

		const panel = section.createDiv({ cls: "umos-balance-panel" });
		if (this.activeMode === "earn") {
			this.renderEarnPanel(panel);
		} else {
			this.renderSpendPanel(panel);
		}
	}

	private renderEarnPanel(panel: HTMLElement): void {
		const types = this.balanceService.getActivityTypes();
		if (types.length === 0) {
			panel.createDiv({ cls: "umos-balance-empty", text: "Нет видов активности. Добавьте в настройках плагина." });
			return;
		}

		const grid = panel.createDiv({ cls: "umos-balance-type-grid" });
		for (const type of types) {
			const btn = grid.createEl("button", {
				cls: `umos-balance-type-btn${this.selectedActivityId === type.id ? " selected" : ""}`,
			});
			btn.style.setProperty("--type-color", type.color);
			btn.createSpan({ cls: "umos-balance-type-icon", text: type.icon });
			btn.createSpan({ cls: "umos-balance-type-label", text: type.label });
			if (type.multiplier !== 1) {
				btn.createSpan({ cls: "umos-balance-type-mult", text: `×${type.multiplier}` });
			}
			btn.addEventListener("click", () => {
				this.selectedActivityId = this.selectedActivityId === type.id ? null : type.id;
				this.render();
			});
		}

		if (this.selectedActivityId) {
			this.renderDurationForm(panel, "earn", this.selectedActivityId);
		}
	}

	private renderSpendPanel(panel: HTMLElement): void {
		const types    = this.balanceService.getEntertainmentTypes();
		const settings = this.balanceService.getPluginSettings();
		const balance  = this.balanceService.getBalance();

		if (types.length === 0) {
			panel.createDiv({ cls: "umos-balance-empty", text: "Нет видов развлечений. Добавьте в настройках плагина." });
			return;
		}

		if (!settings.balanceAllowNegative && balance === 0) {
			const wrap = panel.createDiv({ cls: "umos-balance-insufficient" });
			wrap.createDiv({ cls: "umos-balance-insufficient-icon", text: "😔" });
			wrap.createDiv({ cls: "umos-balance-insufficient-text", text: "Баланс пуст. Заработайте время продуктивной работой!" });
			return;
		}

		const grid = panel.createDiv({ cls: "umos-balance-type-grid" });
		for (const type of types) {
			const btn = grid.createEl("button", {
				cls: `umos-balance-type-btn${this.selectedEntertainmentId === type.id ? " selected" : ""}`,
			});
			btn.style.setProperty("--type-color", type.color);
			btn.createSpan({ cls: "umos-balance-type-icon", text: type.icon });
			btn.createSpan({ cls: "umos-balance-type-label", text: type.label });
			if (type.drainMultiplier !== 1) {
				btn.createSpan({ cls: "umos-balance-type-mult", text: `×${type.drainMultiplier}` });
			}
			btn.addEventListener("click", () => {
				this.selectedEntertainmentId = this.selectedEntertainmentId === type.id ? null : type.id;
				this.render();
			});
		}

		if (this.selectedEntertainmentId) {
			this.renderDurationForm(panel, "spend", this.selectedEntertainmentId);
		}
	}

	private renderDurationForm(panel: HTMLElement, mode: "earn" | "spend", selectedId: string): void {
		const settings = this.balanceService.getPluginSettings();
		const balance  = this.balanceService.getBalance();

		const inputRow = panel.createDiv({ cls: "umos-balance-input-row" });

		const durationInput = inputRow.createEl("input", {
			cls: "umos-balance-duration-input",
			attr: { type: "number", min: "1", max: "480", placeholder: "мин", value: "30" },
		});

		const preview = inputRow.createDiv({ cls: "umos-balance-preview" });

		const updatePreview = () => {
			const dur = parseInt(durationInput.value) || 0;
			preview.empty();
			if (dur <= 0) return;

			if (mode === "earn") {
				const type = settings.balanceActivityTypes.find(a => a.id === selectedId);
				if (!type) return;
				const earned = Math.round(dur * type.multiplier);
				preview.createSpan({ cls: "umos-balance-preview-earn", text: `→ +${this.fmt(earned)}` });
			} else {
				const type = settings.balanceEntertainmentTypes.find(e => e.id === selectedId);
				if (!type) return;
				const cost = Math.round(dur * type.drainMultiplier);
				const canAfford = settings.balanceAllowNegative || cost <= balance;
				preview.createSpan({
					cls: canAfford ? "umos-balance-preview-spend" : "umos-balance-preview-denied",
					text: `→ -${this.fmt(cost)}`,
				});
			}
		};
		durationInput.addEventListener("input", updatePreview);
		updatePreview();

		// Note input
		const noteInput = panel.createEl("input", {
			cls: "umos-balance-note-input",
			attr: { type: "text", placeholder: "Заметка (необязательно)" },
		});

		const submitBtn = panel.createEl("button", {
			cls: "umos-balance-submit",
			text: mode === "earn" ? "✅ Записать активность" : "🎮 Потратить время",
		});

		submitBtn.addEventListener("click", () => {
			const dur = parseInt(durationInput.value) || 0;
			if (dur <= 0) { new Notice("Введите длительность"); return; }
			const note = noteInput.value.trim() || undefined;

			if (mode === "earn") {
				// Clear selection before logActivity so the event-triggered render sees it cleared
				this.selectedActivityId = null;
				const ok = this.balanceService.logActivity(selectedId, dur, note);
				if (!ok) {
					this.selectedActivityId = selectedId;
					this.render();
					new Notice("⚠️ Лимит достигнут или тип активности не найден");
				} else {
					const type = settings.balanceActivityTypes.find(a => a.id === selectedId);
					new Notice(`✅ +${this.fmt(Math.round(dur * (type?.multiplier ?? 1)))} заработано!`);
					// render() is triggered automatically by balance:updated event
				}
			} else {
				this.selectedEntertainmentId = null;
				const ok = this.balanceService.logEntertainment(selectedId, dur, note);
				if (!ok) {
					this.selectedEntertainmentId = selectedId;
					this.render();
					new Notice("⚠️ Недостаточно баланса!");
				} else {
					const type = settings.balanceEntertainmentTypes.find(e => e.id === selectedId);
					new Notice(`🎮 -${this.fmt(Math.round(dur * (type?.drainMultiplier ?? 1)))} потрачено`);
				}
			}
		});
	}

	private renderWeekChart(root: HTMLElement): void {
		const stats = this.balanceService.getWeekStats();
		const maxVal = Math.max(...stats.map(s => Math.max(s.earned, s.spent)), 1);
		const BAR_MAX_H = 52; // px

		const section = root.createDiv({ cls: "umos-balance-chart-section" });
		section.createDiv({ cls: "umos-balance-section-title", text: "Неделя" });

		const chart = section.createDiv({ cls: "umos-balance-chart" });
		const dayLabels = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
		const todayStr = new Date().toISOString().slice(0, 10);

		for (const day of stats) {
			const col = chart.createDiv({ cls: "umos-balance-chart-col" });
			const bars = col.createDiv({ cls: "umos-balance-chart-bars" });

			const earnH  = Math.max(2, Math.round((day.earned / maxVal) * BAR_MAX_H));
			const spendH = Math.max(2, Math.round((day.spent  / maxVal) * BAR_MAX_H));

			if (day.earned > 0) {
				const b = bars.createDiv({ cls: "umos-balance-chart-bar earn" });
				b.style.height = `${earnH}px`;
				b.title = `+${this.fmt(day.earned)}`;
			}
			if (day.spent > 0) {
				const b = bars.createDiv({ cls: "umos-balance-chart-bar spend" });
				b.style.height = `${spendH}px`;
				b.title = `-${this.fmt(day.spent)}`;
			}

			const d = new Date(day.date + "T00:00:00");
			col.createDiv({
				cls: `umos-balance-chart-day${day.date === todayStr ? " today" : ""}`,
				text: dayLabels[d.getDay()],
			});
		}
	}

	private renderRecentEntries(root: HTMLElement): void {
		const entries = this.balanceService.getRecentEntries(10);
		if (entries.length === 0) return;

		const section = root.createDiv({ cls: "umos-balance-history-section" });
		section.createDiv({ cls: "umos-balance-section-title", text: "Последние записи" });

		const list = section.createDiv({ cls: "umos-balance-history-list" });

		for (const entry of entries) {
			const item = list.createDiv({ cls: `umos-balance-history-item ${entry.type}` });

			item.createSpan({ cls: "umos-balance-history-icon", text: entry.icon });

			const info = item.createDiv({ cls: "umos-balance-history-info" });
			info.createDiv({ cls: "umos-balance-history-label", text: entry.label });

			const meta = info.createDiv({ cls: "umos-balance-history-meta" });
			meta.createSpan({ text: this.fmt(entry.durationMinutes) });
			meta.createSpan({ text: " → " });
			meta.createSpan({
				cls: entry.type === "earn" ? "earn" : "spend",
				text: entry.type === "earn"
					? `+${this.fmt(entry.balanceMinutes)}`
					: `-${this.fmt(entry.balanceMinutes)}`,
			});

			if (entry.note) {
				info.createDiv({ cls: "umos-balance-history-note", text: entry.note });
			}

			const d = new Date(entry.timestamp);
			const hh = d.getHours().toString().padStart(2, "0");
			const mm = d.getMinutes().toString().padStart(2, "0");
			item.createDiv({ cls: "umos-balance-history-time", text: `${hh}:${mm}` });

			const delBtn = item.createEl("button", { cls: "umos-balance-history-del", text: "✕" });
			delBtn.setAttribute("aria-label", "Удалить запись");
			delBtn.addEventListener("click", () => this.balanceService.deleteEntry(entry.id));
		}
	}
}
