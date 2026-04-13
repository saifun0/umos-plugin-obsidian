import { HomeViewContext } from "../types";
import { createElement } from "../../utils/dom";
import { renderSparkline } from "../../stats/Charts";
import { getTodayDateString, getDayOfWeek } from "../../utils/date";
import {
	getCurrentWeekKey,
	getSlotsForDay,
	getFilledSlots,
	getCurrentSlotInfo,
	WEEKDAY_LABELS_RU,
	SLOT_TYPE_ICONS,
	formatSlotCountdown,
} from "../../productivity/schedule/ScheduleData";

export function renderStatsSection(parent: HTMLElement, ctx: HomeViewContext): void {
	if (!ctx.statsEngine) return;

	const section = createElement("div", {
		cls: "umos-home-section umos-home-section-anim",
		parent,
	});

	createElement("div", {
		cls: "umos-home-section-title",
		text: "📊 Показатели дня",
		parent: section,
	});

	const today = getTodayDateString();

	// Справочник всех известных метрик
	const METRIC_META: Record<string, { label: string; icon: string; color: string; suffix?: string }> = {
		mood:         { label: "Настроение",    icon: "😊", color: "var(--umos-accent)" },
		productivity: { label: "Продуктивность", icon: "⚡", color: "var(--umos-warning)" },
		sleep:        { label: "Сон",            icon: "😴", color: "var(--umos-success)", suffix: "ч" },
		prayer_count: { label: "Намазы",         icon: "🕌", color: "#f39c12" },
		exercise:     { label: "Упражнения",     icon: "🏋️", color: "#e74c3c" },
		reading:      { label: "Чтение",         icon: "📚", color: "#3498db" },
		water:        { label: "Вода",           icon: "💧", color: "#1abc9c" },
		quran:        { label: "Коран",          icon: "📖", color: "#27ae60" },
		study:        { label: "Учёба",          icon: "🎓", color: "#9b59b6" },
	};

	const selectedKeys: string[] = Array.isArray(ctx.settings.homeStatsMetrics) && ctx.settings.homeStatsMetrics.length > 0
		? ctx.settings.homeStatsMetrics.slice(0, 4)
		: ["mood", "productivity", "sleep", "prayer_count"];

	const metrics = selectedKeys.map(key => {
		const meta = METRIC_META[key];
		return {
			key,
			label: meta?.label ?? key,
			icon: meta?.icon ?? "📊",
			color: meta?.color ?? "var(--umos-accent)",
			suffix: meta?.suffix,
		};
	});

	const grid = createElement("div", {
		cls: "umos-home-stats-grid",
		parent: section,
	});

	for (const metric of metrics) {
		const value = ctx.statsEngine.getValueForDate(today, metric.key);
		const displayValue = value !== null ? String(value) : "—";

		const card = createElement("div", {
			cls: "umos-home-stat-card",
			parent: grid,
		});

		createElement("div", { cls: "umos-home-stat-icon", text: metric.icon, parent: card });
		createElement("div", {
			cls: "umos-home-stat-value",
			text: metric.suffix ? `${displayValue}${metric.suffix}` : displayValue,
			parent: card,
		});
		createElement("div", { cls: "umos-home-stat-label", text: metric.label, parent: card });

		// Sparkline for last 7 days
		const weekData = ctx.statsEngine.getMetricData(metric.key, 7);
		if (weekData.data.length >= 2) {
			const sparkContainer = createElement("div", { cls: "umos-home-stat-spark", parent: card });
			renderSparkline(sparkContainer, weekData.data.map(d => d.value), {
				width: 80,
				height: 24,
				color: metric.color,
			});
		}
	}

	// Schedule mini-widget inside stats section
	renderScheduleMini(section, ctx);
}

export function renderScheduleMini(parent: HTMLElement, ctx: HomeViewContext): void {
	const data = ctx.getData();
	const dayKey = getDayOfWeek();

	if (dayKey === "sunday") return;

	const weekKey = getCurrentWeekKey(data.settings.scheduleAnchorDate);
	const slots = getSlotsForDay(data, weekKey, dayKey);
	const filled = getFilledSlots(slots);

	if (filled.length === 0) return;

	const { currentSlot, nextSlot } = getCurrentSlotInfo(slots);

	const wrap = createElement("div", { cls: "umos-home-schedule-mini", parent });

	const titleRow = createElement("div", { cls: "umos-home-schedule-mini-header", parent: wrap });
	createElement("span", {
		cls: "umos-home-section-title",
		text: `📅 Расписание — ${WEEKDAY_LABELS_RU[dayKey] || dayKey}`,
		parent: titleRow,
	});
	createElement("span", {
		cls: "umos-home-schedule-mini-count",
		text: `${filled.length} пар`,
		parent: titleRow,
	});

	// Show current or next slot prominently
	if (currentSlot) {
		const slotCard = createElement("div", { cls: "umos-home-schedule-slot umos-home-schedule-slot-current", parent: wrap });
		const typeIcon = SLOT_TYPE_ICONS[currentSlot.type] || "📖";
		createElement("span", { cls: "umos-home-schedule-slot-badge", text: "Сейчас", parent: slotCard });
		const slotMain = createElement("div", { cls: "umos-home-schedule-slot-main", parent: slotCard });
		createElement("span", { cls: "umos-home-schedule-slot-subject", text: `${typeIcon} ${currentSlot.subject}`, parent: slotMain });
		const meta = createElement("div", { cls: "umos-home-schedule-slot-meta", parent: slotMain });
		createElement("span", { text: `${currentSlot.startTime}–${currentSlot.endTime}`, parent: meta });
		if (currentSlot.room) {
			createElement("span", { text: `📍 ${currentSlot.room}`, parent: meta });
		}
		const countdown = formatSlotCountdown(currentSlot.endTime);
		if (countdown) {
			createElement("span", { cls: "umos-home-schedule-slot-countdown", text: `до конца ${countdown}`, parent: slotCard });
		}
	}

	if (nextSlot) {
		const slotCard = createElement("div", { cls: "umos-home-schedule-slot umos-home-schedule-slot-next", parent: wrap });
		const typeIcon = SLOT_TYPE_ICONS[nextSlot.type] || "📖";
		createElement("span", { cls: "umos-home-schedule-slot-badge umos-home-schedule-slot-badge-next", text: "Далее", parent: slotCard });
		const slotMain = createElement("div", { cls: "umos-home-schedule-slot-main", parent: slotCard });
		createElement("span", { cls: "umos-home-schedule-slot-subject", text: `${typeIcon} ${nextSlot.subject}`, parent: slotMain });
		const meta = createElement("div", { cls: "umos-home-schedule-slot-meta", parent: slotMain });
		createElement("span", { text: `${nextSlot.startTime}–${nextSlot.endTime}`, parent: meta });
		if (nextSlot.room) {
			createElement("span", { text: `📍 ${nextSlot.room}`, parent: meta });
		}
		const countdown = formatSlotCountdown(nextSlot.startTime);
		if (countdown) {
			createElement("span", { cls: "umos-home-schedule-slot-countdown", text: `через ${countdown}`, parent: slotCard });
		}
	}

	if (!currentSlot && !nextSlot && filled.length > 0) {
		createElement("div", {
			cls: "umos-home-empty",
			text: "Все пары на сегодня завершены ✅",
			parent: wrap,
		});
	}
}
