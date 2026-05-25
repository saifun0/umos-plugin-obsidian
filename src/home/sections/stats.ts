import { HomeViewContext } from "../types";
import { createElement } from "../../utils/dom";
import { renderSparkline } from "../../stats/Charts";
import { formatDate, getCurrentWeekType, getTodayDateString, getDayOfWeek } from "../../utils/date";
import {
	getSlotsForDay,
	getFilledSlots,
	getCurrentSlotInfo,
	WEEKDAY_LABELS_RU,
	SLOT_TYPE_ICONS,
} from "../../productivity/schedule/ScheduleData";
import { t } from "../../i18n";

const HOME_SCHEDULE_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"];
const DEFAULT_COMPLETED_DAY_ADVANCE_DELAY_MINUTES = 60;

interface ScheduleMiniTarget {
	date: Date;
	dayKey: string;
	weekKey: "week1" | "week2";
	isToday: boolean;
}

type ScheduleMiniSlot = ReturnType<typeof getFilledSlots>[number];

export function renderStatsSection(parent: HTMLElement, ctx: HomeViewContext): void {
	if (!ctx.statsEngine) return;

	const section = createElement("div", {
		cls: "umos-home-section umos-home-section-anim",
		parent,
	});

	createElement("div", {
		cls: "umos-home-section-title",
		text: "📊 Daily Metrics",
		parent: section,
	});

	const today = getTodayDateString();

	const METRIC_META: Record<string, { label: string; icon: string; color: string; suffix?: string }> = {
		mood: { label: "Mood", icon: "😊", color: "var(--umos-accent)" },
		productivity: { label: "Productivity", icon: "⚡", color: "var(--umos-warning)" },
		sleep: { label: "Sleep", icon: "😴", color: "var(--umos-success)", suffix: "h" },
		prayer_count: { label: "Prayers", icon: "🕌", color: "#f39c12" },
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

	renderScheduleMini(section, ctx);
}

export function renderScheduleMini(parent: HTMLElement, ctx: HomeViewContext): void {
	const data = ctx.getData();
	const target = getScheduleMiniTarget(data);
	if (!target) return;

	const slots = getSlotsForDay(data, target.weekKey, target.dayKey);
	const filled = getFilledSlots(slots);

	if (filled.length === 0) return;

	const now = new Date();
	const slotInfo = target.isToday
		? getCurrentSlotInfo(slots)
		: { currentSlot: null, nextSlot: filled[0] ?? null };
	const weekLabel = target.weekKey === "week1" ? "Week 1" : "Week 2";
	const visibleSlots = data.settings.homeScheduleShowPastLessons === false
		? filled.filter((slot) => !isScheduleMiniSlotPast(slot, target, now))
		: filled;

	const wrap = createElement("div", { cls: "umos-home-schedule-mini", parent });

	const titleRow = createElement("div", { cls: "umos-home-schedule-mini-header", parent: wrap });
	createElement("span", {
		cls: "umos-home-section-title",
		text: `📅 ${t("Schedule").toUpperCase()} — ${t(WEEKDAY_LABELS_RU[target.dayKey] || target.dayKey).toUpperCase()}`,
		parent: titleRow,
	});
	createElement("span", {
		cls: "umos-home-schedule-mini-count",
		text: `${t(weekLabel).toLowerCase()} · ${t(formatLessonCount(filled.length))}`,
		parent: titleRow,
	});

	const list = createElement("div", { cls: "umos-home-schedule-mini-list", parent: wrap });
	if (visibleSlots.length === 0) {
		createElement("div", {
			cls: "umos-home-empty",
			text: t("All classes for today are done ✅"),
			parent: list,
		});
		return;
	}

	for (const slot of visibleSlots) {
		renderScheduleMiniSlot(list, slot, target, {
			isCurrent: slotInfo.currentSlot === slot,
			isNext: slotInfo.nextSlot === slot,
			now,
		});
	}
}

function getScheduleMiniTarget(data: ReturnType<HomeViewContext["getData"]>): ScheduleMiniTarget | null {
	const now = new Date();
	const todayKey = getDayOfWeek(now);

	if (!HOME_SCHEDULE_DAYS.includes(todayKey)) {
		return createScheduleMiniTarget(data, getNextStudyDate(now, todayKey), false);
	}

	const todayTarget = createScheduleMiniTarget(data, now, true);
	const todaySlots = getSlotsForDay(data, todayTarget.weekKey, todayTarget.dayKey);
	const filled = getFilledSlots(todaySlots);
	const advanceDelay = getHomeScheduleAdvanceDelayMinutes(data.settings.homeScheduleAdvanceDelayMinutes);

	if (filled.length === 0) return null;
	if (shouldAdvancePastCompletedDay(filled, now, advanceDelay)) {
		return createScheduleMiniTarget(data, getNextStudyDate(now, todayKey), false);
	}

	return todayTarget;
}

function createScheduleMiniTarget(
	data: ReturnType<HomeViewContext["getData"]>,
	date: Date,
	isToday: boolean
): ScheduleMiniTarget {
	const normalized = new Date(date);
	normalized.setHours(0, 0, 0, 0);
	const dateISO = formatDate(normalized);
	return {
		date: normalized,
		dayKey: getDayOfWeek(normalized),
		weekKey: getCurrentWeekType(data.settings.scheduleAnchorDate, dateISO),
		isToday,
	};
}

function shouldAdvancePastCompletedDay(filledSlots: ReturnType<typeof getFilledSlots>, now: Date, delayMinutes: number): boolean {
	const lastEnd = filledSlots.reduce<number | null>((latest, slot) => {
		const end = timeToMinutesSafe(slot.endTime);
		if (end === null) return latest;
		return latest === null ? end : Math.max(latest, end);
	}, null);
	if (lastEnd === null) return false;

	const currentMinutes = now.getHours() * 60 + now.getMinutes();
	return currentMinutes >= lastEnd + delayMinutes;
}

function isScheduleMiniSlotPast(slot: ScheduleMiniSlot, target: ScheduleMiniTarget, now: Date): boolean {
	const endAt = getSlotDateTime(target.date, slot.endTime);
	return !!endAt && endAt.getTime() <= now.getTime();
}

function getHomeScheduleAdvanceDelayMinutes(value: number): number {
	const minutes = Number(value);
	if (!Number.isFinite(minutes)) return DEFAULT_COMPLETED_DAY_ADVANCE_DELAY_MINUTES;
	return Math.max(0, Math.min(240, Math.round(minutes)));
}

function renderScheduleMiniSlot(
	parent: HTMLElement,
	slot: ScheduleMiniSlot,
	target: ScheduleMiniTarget,
	state: { isCurrent: boolean; isNext: boolean; now: Date }
): void {
	const timing = getScheduleMiniSlotTiming(slot, target, state);
	const slotCard = createElement("div", {
		cls: `umos-home-schedule-slot ${timing.className}`,
		parent,
	});

	createElement("span", {
		cls: `umos-home-schedule-slot-badge ${timing.badgeClassName}`,
		text: t(timing.badge),
		parent: slotCard,
	});

	const slotMain = createElement("div", { cls: "umos-home-schedule-slot-main", parent: slotCard });
	const typeIcon = SLOT_TYPE_ICONS[slot.type] || "📖";
	createElement("span", { cls: "umos-home-schedule-slot-subject", text: `${typeIcon} ${slot.subject}`, parent: slotMain });

	const meta = createElement("div", { cls: "umos-home-schedule-slot-meta", parent: slotMain });
	const time = createElement("span", { cls: "umos-home-schedule-slot-time", parent: meta });
	createElement("span", { cls: "umos-home-schedule-slot-time-start", text: slot.startTime || "—", parent: time });
	if (slot.endTime) {
		createElement("span", { cls: "umos-home-schedule-slot-time-end", text: slot.endTime, parent: time });
	}
	if (slot.room) {
		createElement("span", { text: `📌 ${slot.room}`, parent: meta });
	}

	if (timing.text) {
		createElement("span", {
			cls: "umos-home-schedule-slot-countdown",
			text: t(timing.text),
			parent: slotCard,
		});
	}
}

function getScheduleMiniSlotTiming(
	slot: ScheduleMiniSlot,
	target: ScheduleMiniTarget,
	state: { isCurrent: boolean; isNext: boolean; now: Date }
): { badge: string; badgeClassName: string; className: string; text: string } {
	const startAt = getSlotDateTime(target.date, slot.startTime);
	const endAt = getSlotDateTime(target.date, slot.endTime);

	if (target.isToday && state.isCurrent && endAt) {
		return {
			badge: "Now",
			badgeClassName: "",
			className: "umos-home-schedule-slot-current",
			text: `ends in ${formatDurationUntil(state.now, endAt)}`,
		};
	}

	if (startAt && startAt.getTime() > state.now.getTime()) {
		const isNext = state.isNext;
		return {
			badge: isNext ? "Next" : "Later",
			badgeClassName: isNext ? "umos-home-schedule-slot-badge-next" : "umos-home-schedule-slot-badge-later",
			className: isNext ? "umos-home-schedule-slot-next" : "umos-home-schedule-slot-later",
			text: isNext ? `in ${formatDurationUntil(state.now, startAt)}` : "",
		};
	}

	if (endAt && endAt.getTime() > state.now.getTime()) {
		return {
			badge: "Now",
			badgeClassName: "",
			className: "umos-home-schedule-slot-current",
			text: `ends in ${formatDurationUntil(state.now, endAt)}`,
		};
	}

	return {
		badge: "Past",
		badgeClassName: "umos-home-schedule-slot-badge-past",
		className: "umos-home-schedule-slot-past",
		text: "done",
	};
}

function getSlotDateTime(day: Date, time: string): Date | null {
	const minutes = timeToMinutesSafe(time);
	if (minutes === null) return null;
	const date = new Date(day);
	date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
	return date;
}

function formatDurationUntil(from: Date, to: Date): string {
	const totalMinutes = Math.max(0, Math.ceil((to.getTime() - from.getTime()) / 60000));
	const days = Math.floor(totalMinutes / 1440);
	const hours = Math.floor((totalMinutes % 1440) / 60);
	const minutes = totalMinutes % 60;

	if (days > 0 && hours > 0) return `${days}d ${hours}h`;
	if (days > 0) return `${days}d`;
	if (hours > 0 && minutes > 0) return `${hours}h ${minutes}min`;
	if (hours > 0) return `${hours}h`;
	return `${minutes}min`;
}

function getNextStudyDate(from: Date, dayKey: string): Date {
	const next = new Date(from);
	const daysToAdd =
		dayKey === "friday" ? 3 :
		dayKey === "saturday" ? 2 :
		dayKey === "sunday" ? 1 :
		1;
	next.setDate(next.getDate() + daysToAdd);
	next.setHours(0, 0, 0, 0);
	return next;
}

function timeToMinutesSafe(time: string): number | null {
	if (!time || !time.includes(":")) return null;
	const [hoursRaw, minutesRaw] = time.split(":");
	const hours = Number(hoursRaw);
	const minutes = Number(minutesRaw);
	if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
	return hours * 60 + minutes;
}

function formatLessonCount(count: number): string {
	const abs = Math.abs(count);
	const mod10 = abs % 10;
	const mod100 = abs % 100;
	if (mod10 === 1 && mod100 !== 11) return `${count} class`;
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} classes`;
	return `${count} classes`;
}
