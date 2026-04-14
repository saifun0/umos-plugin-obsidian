import { App, Modal, moment, setIcon } from "obsidian";
import type UmOSPlugin from "../main";
import { Task } from "../productivity/tasks/Task";
import { TaskService } from "../productivity/tasks/TaskService";
import { TaskEditorModal } from "../productivity/tasks/TaskEditorModal";
import { ScheduleEditor } from "../productivity/schedule/ScheduleEditor";
import { QuickCaptureModal } from "../capture/QuickCaptureModal";
import { FinanceService } from "../finance/FinanceService";
import {
	getTodaySlots,
	getFilledSlots,
	getCurrentSlotInfo,
	formatSlotCountdown,
} from "../productivity/schedule/ScheduleData";

export class QuickHubModal extends Modal {
	private plugin: UmOSPlugin;
	private financeService: FinanceService | null;
	private taskService: TaskService;

	constructor(app: App, plugin: UmOSPlugin, financeService: FinanceService | null) {
		super(app);
		this.plugin = plugin;
		this.financeService = financeService;
		this.taskService = new TaskService(app, plugin);
	}

	onOpen(): void {
		this.modalEl.classList.add("umos-hub-modal");
		this.render();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("umos-hub-content");

		this.renderProfile(contentEl);
		this.renderActions(contentEl);
		this.renderStats(contentEl);
		this.renderScheduleToday(contentEl);
		void this.renderTaskStats(contentEl);
	}

	// ── Profile ──────────────────────────────────────────────────────────

	private renderProfile(parent: HTMLElement): void {
		const s = this.plugin.settings;
		const header = parent.createDiv({ cls: "umos-hub-profile" });

		// Avatar
		const avatarWrap = header.createDiv({ cls: "umos-hub-avatar-wrap" });
		if (s.userAvatarUrl && s.userAvatarUrl.trim()) {
			const resolvedUrl = this.resolveAssetUrl(s.userAvatarUrl.trim());
			const img = avatarWrap.createEl("img", { cls: "umos-hub-avatar-img" });
			img.src = resolvedUrl;
			img.alt = "avatar";
		} else {
			avatarWrap.createDiv({ cls: "umos-hub-avatar-placeholder", text: "👤" });
		}

		// Info
		const info = header.createDiv({ cls: "umos-hub-profile-info" });
		const nickname = s.userNickname?.trim() || "Пользователь";
		info.createDiv({ cls: "umos-hub-nickname", text: nickname });

		const now = new Date();
		const months = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
		const days   = ["Воскресенье","Понедельник","Вторник","Среда","Четверг","Пятница","Суббота"];
		info.createDiv({
			cls: "umos-hub-date",
			text: `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`,
		});

		// Greeting
		const h = now.getHours();
		const greeting = h < 6 ? "🌙 Доброй ночи" : h < 12 ? "🌅 Доброе утро" : h < 18 ? "☀️ Добрый день" : "🌆 Добрый вечер";
		info.createDiv({ cls: "umos-hub-greeting", text: greeting });
	}

	// ── Quick actions ─────────────────────────────────────────────────────

	private renderActions(parent: HTMLElement): void {
		const row = parent.createDiv({ cls: "umos-hub-actions" });

		const actions: { icon: string; label: string; cb: () => void }[] = [
			{
				icon: "plus",
				label: "Задача",
				cb: () => {
					this.close();
					const blank = new Task("", "", 0);
					new TaskEditorModal(this.app, blank, async (updated, subtasks) => {
						const service = new TaskService(this.app, this.plugin);
						const inboxPath = `${this.plugin.settings.captureInboxPath}/inbox.md`;
						const lineNum = await service.createTask(updated, inboxPath);
						if (subtasks.length > 0 && lineNum >= 0) {
							await service.addSubtasksAfterLine(inboxPath, lineNum, 0, subtasks);
						}
					}).open();
				},
			},
			{
				icon: "calendar",
				label: "Расписание",
				cb: () => {
					this.close();
					new ScheduleEditor(
						this.app, this.plugin.data_store, this.plugin.eventBus,
						() => this.plugin.saveSettings()
					).open();
				},
			},
			{
				icon: "pencil",
				label: "Заметка",
				cb: () => {
					this.close();
					new QuickCaptureModal(this.app, this.plugin.settings, "note", this.plugin).open();
				},
			},
			{
				icon: "settings",
				label: "Настройки",
				cb: () => {
					this.close();
					// @ts-ignore
					this.app.setting?.open();
				},
			},
		];

		for (const a of actions) {
			const btn = row.createDiv({ cls: "umos-hub-action-btn" });
			const iconEl = btn.createDiv({ cls: "umos-hub-action-icon" });
			setIcon(iconEl, a.icon);
			btn.createDiv({ cls: "umos-hub-action-label", text: a.label });
			btn.addEventListener("click", a.cb);
		}
	}

	// ── Quick stat cards ──────────────────────────────────────────────────

	private renderStats(parent: HTMLElement): void {
		this.renderStatsMini(parent);
	}

	private renderStatsMini(parent: HTMLElement): void {
		const engine = this.plugin.statsEngine;
		if (!engine) return;

		const metrics = (this.plugin.settings.homeStatsMetrics?.length > 0
			? this.plugin.settings.homeStatsMetrics
			: ["mood", "productivity", "sleep", "prayer_count"]).slice(0, 6);

		const ICONS: Record<string, string> = {
			mood: "😊", productivity: "⚡", sleep: "😴", prayer_count: "🕌",
			exercise: "🏋️", reading: "📚", water: "💧", quran: "📖", study: "🎓",
		};
		const NAMES: Record<string, string> = {
			mood: "Настроение", productivity: "Продукт.", sleep: "Сон",
			prayer_count: "Намазы", exercise: "Упражн.", reading: "Чтение",
			water: "Вода", quran: "Коран", study: "Учёба",
		};
		const COLORS: Record<string, string> = {
			mood: "#f39c12", productivity: "#3498db", sleep: "#9b59b6",
			prayer_count: "#27ae60", exercise: "#e74c3c", reading: "#1abc9c",
			water: "#2980b9", quran: "#27ae60", study: "#8e44ad",
		};

		const card = parent.createDiv({ cls: "umos-hub-stat-card umos-hub-stat-neutral umos-hub-stat-metrics" });
		card.createDiv({ cls: "umos-hub-stat-emoji", text: "📊" });
		card.createDiv({ cls: "umos-hub-stat-label", text: "Статистика · 14д" });

		const inner = card.createDiv({ cls: "umos-hub-metrics-inner" });

		for (const metric of metrics) {
			const result = engine.getMetricData(metric, 14);
			const values = result.data.map(d => d.value);

			const row = inner.createDiv({ cls: "umos-hub-metric-row" });
			row.createSpan({ cls: "umos-hub-metric-icon", text: ICONS[metric] || "📊" });
			row.createSpan({ cls: "umos-hub-metric-name", text: NAMES[metric] || metric });
			row.createSpan({
				cls: "umos-hub-metric-val",
				text: metric === "prayer_count" ? `${result.avg}/5` : String(result.avg),
			});

			if (values.length >= 3) {
				row.appendChild(this.makeMiniSparkline(values, COLORS[metric] || "#888"));
			}
		}
	}

	private makeMiniSparkline(values: number[], color: string): SVGElement {
		const W = 44, H = 16;
		const min = Math.min(...values);
		const max = Math.max(...values);
		const range = max - min || 1;

		const pts = values.map((v, i) => {
			const x = (i / (values.length - 1)) * W;
			const y = H - 1 - ((v - min) / range) * (H - 2);
			return `${x.toFixed(1)},${y.toFixed(1)}`;
		}).join(" ");

		const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		svg.setAttribute("width", String(W));
		svg.setAttribute("height", String(H));
		svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
		svg.setAttribute("class", "umos-hub-metric-spark");

		const poly = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
		poly.setAttribute("points", pts);
		poly.setAttribute("fill", "none");
		poly.setAttribute("stroke", color);
		poly.setAttribute("stroke-width", "1.5");
		poly.setAttribute("stroke-linecap", "round");
		poly.setAttribute("stroke-linejoin", "round");
		svg.appendChild(poly);
		return svg;
	}

	private makeStatCard(
		parent: HTMLElement,
		emoji: string,
		label: string,
		value: string,
		sub: string,
		variant: "good" | "warn" | "danger" | "neutral"
	): void {
		const card = parent.createDiv({ cls: `umos-hub-stat-card umos-hub-stat-${variant}` });
		card.createDiv({ cls: "umos-hub-stat-emoji", text: emoji });
		card.createDiv({ cls: "umos-hub-stat-label", text: label });
		card.createDiv({ cls: "umos-hub-stat-value", text: value });
		card.createDiv({ cls: "umos-hub-stat-sub", text: sub });
	}

	// ── Today's schedule ──────────────────────────────────────────────────

	private renderScheduleToday(parent: HTMLElement): void {
		const allSlots = getTodaySlots(this.plugin.data_store);
		const slots = getFilledSlots(allSlots);

		const section = parent.createDiv({ cls: "umos-hub-section" });
		const titleRow = section.createDiv({ cls: "umos-hub-section-title-row" });
		setIcon(titleRow.createDiv({ cls: "umos-hub-section-icon" }), "calendar");
		titleRow.createDiv({ cls: "umos-hub-section-title", text: "Расписание сегодня" });

		if (slots.length === 0) {
			section.createDiv({ cls: "umos-hub-empty", text: "Пар нет — свободный день 🎉" });
			return;
		}

		const { currentSlot, nextSlot } = getCurrentSlotInfo(allSlots);

		const list = section.createDiv({ cls: "umos-hub-schedule-list" });
		for (let i = 0; i < slots.length; i++) {
			const slot = slots[i];
			const isCurrent = slot === currentSlot;
			const isNext = slot === nextSlot;

			const row = list.createDiv({
				cls: `umos-hub-schedule-row${isCurrent ? " is-current" : ""}${isNext ? " is-next" : ""}`,
			});

			// Pair number
			row.createDiv({ cls: "umos-hub-schedule-pair-num", text: String(i + 1) });

			// Time (start + end stacked)
			const timeCol = row.createDiv({ cls: "umos-hub-schedule-time-col" });
			timeCol.createDiv({ cls: "umos-hub-schedule-time", text: slot.startTime });
			timeCol.createDiv({ cls: "umos-hub-schedule-time umos-hub-schedule-time-end", text: slot.endTime });

			// Countdown — bottom-right corner of row (absolute)
			if (isCurrent) {
				const cd = formatSlotCountdown(slot.endTime);
				if (cd) row.createDiv({ cls: "umos-hub-schedule-cd is-current", text: `ещё ${cd}` });
			} else if (isNext) {
				const cd = formatSlotCountdown(slot.startTime);
				if (cd) row.createDiv({ cls: "umos-hub-schedule-cd is-next", text: `через ${cd}` });
			}

			// Subject + room
			const info = row.createDiv({ cls: "umos-hub-schedule-info" });
			info.createDiv({ cls: "umos-hub-schedule-subject", text: slot.subject });
			if (slot.room) info.createDiv({ cls: "umos-hub-schedule-room", text: `📍 ${slot.room}` });

			// Status badge
			if (isCurrent) row.createDiv({ cls: "umos-hub-schedule-badge is-current", text: "Сейчас" });
			else if (isNext) row.createDiv({ cls: "umos-hub-schedule-badge is-next", text: "Следующая" });
		}
	}

	// ── Task stats (async) ────────────────────────────────────────────────

	private async renderTaskStats(parent: HTMLElement): Promise<void> {
		const section = parent.createDiv({ cls: "umos-hub-section" });
		const titleRow = section.createDiv({ cls: "umos-hub-section-title-row" });
		setIcon(titleRow.createDiv({ cls: "umos-hub-section-icon" }), "check-square");
		titleRow.createDiv({ cls: "umos-hub-section-title", text: "Задачи" });

		const placeholder = section.createDiv({ cls: "umos-hub-loading", text: "Загрузка…" });

		try {
			const extended = await this.taskService.getExtendedStats({});
			placeholder.remove();

			const s = extended.base;

			// Big numbers row
			const nums = section.createDiv({ cls: "umos-hub-task-nums" });
			this.makeTaskNum(nums, String(s.pending), "активных", "var(--color-blue)");
			this.makeTaskNum(nums, String(s.doing), "в процессе", "var(--color-yellow)");
			this.makeTaskNum(nums, String(s.done), "готово", "var(--color-green)");
			if (s.overdue > 0) this.makeTaskNum(nums, String(s.overdue), "просроч.", "var(--color-red)");

			// Progress bar
			const barWrap = section.createDiv({ cls: "umos-hub-task-bar-wrap" });
			barWrap.createDiv({ cls: "umos-hub-task-bar-label", text: `${s.completionPercentage}% выполнено` });
			const barBg = barWrap.createDiv({ cls: "umos-hub-task-bar-bg" });
			const fill = barBg.createDiv({ cls: "umos-hub-task-bar-fill" });
			fill.style.width = `${s.completionPercentage}%`;

			// Streak + weekly
			const streakRow = section.createDiv({ cls: "umos-hub-task-meta" });
			if (extended.streak > 0) {
				streakRow.createDiv({ cls: "umos-hub-task-chip", text: `🔥 Серия: ${extended.streak} дн.` });
			}
			if (extended.completedLast7 > 0) {
				streakRow.createDiv({ cls: "umos-hub-task-chip", text: `✅ За неделю: ${extended.completedLast7}` });
			}
			if (extended.completedLast30 > 0) {
				streakRow.createDiv({ cls: "umos-hub-task-chip", text: `📅 За месяц: ${extended.completedLast30}` });
			}

			// Mini daily bar (last 7 days)
			if (extended.dailyCompleted.length > 0) {
				const barSection = section.createDiv({ cls: "umos-hub-daily-bar" });
				const last7 = extended.dailyCompleted.slice(-7);
				const maxVal = Math.max(...last7.map(d => d.count), 1);
				for (const day of last7) {
					const col = barSection.createDiv({ cls: "umos-hub-daily-col" });
					const barH = barSection.createDiv({ cls: "umos-hub-daily-bar-inner" });
					const pct = (day.count / maxVal) * 100;
					const fill2 = barH.createDiv({ cls: "umos-hub-daily-fill" });
					fill2.style.height = `${pct}%`;
					col.appendChild(barH);
					col.createDiv({ cls: "umos-hub-daily-label", text: moment(day.date).format("dd") });
				}
			}
		} catch {
			placeholder.textContent = "Не удалось загрузить задачи";
		}
	}

	private makeTaskNum(parent: HTMLElement, value: string, label: string, color: string): void {
		const col = parent.createDiv({ cls: "umos-hub-task-num-col" });
		const val = col.createDiv({ cls: "umos-hub-task-num-val", text: value });
		val.style.color = color;
		col.createDiv({ cls: "umos-hub-task-num-label", text: label });
	}

	// ── Util ──────────────────────────────────────────────────────────────

	private resolveAssetUrl(pathOrUrl: string): string {
		if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) return pathOrUrl;
		// Vault-relative path → resource URL
		const file = this.app.vault.getAbstractFileByPath(pathOrUrl);
		if (file) return this.app.vault.getResourcePath(file as any);
		return pathOrUrl;
	}
}
