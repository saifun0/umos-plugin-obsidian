import { UmOSData, ScheduleSlot } from "../../settings/Settings";
import { getCurrentWeekNumber, getDayOfWeek } from "../../utils/date";

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const WEEKDAY_LABELS_RU: Record<string, string> = {
	monday: "Понедельник",
	tuesday: "Вторник",
	wednesday: "Среда",
	thursday: "Четверг",
	friday: "Пятница",
	saturday: "Суббота",
};

const WEEKDAY_SHORT_RU: Record<string, string> = {
	monday: "Пн",
	tuesday: "Вт",
	wednesday: "Ср",
	thursday: "Чт",
	friday: "Пт",
	saturday: "Сб",
};

const SLOT_TYPE_LABELS: Record<string, string> = {
	lecture: "Лекция",
	seminar: "Семинар",
	lab: "Лабораторная",
	laboratory: "Лабораторная",
	practice: "Практика",
	exam: "Экзамен",
};

const SLOT_TYPE_ICONS: Record<string, string> = {
	lecture: "📖",
	seminar: "💬",
	lab: "🔬",
	practice: "✏️",
	exam: "📝",
};

export { WEEKDAYS, WEEKDAY_LABELS_RU, WEEKDAY_SHORT_RU, SLOT_TYPE_LABELS, SLOT_TYPE_ICONS };

/**
 * Получить текущую неделю (week1 или week2).
 */
export function getCurrentWeekKey(anchorDate: string): "week1" | "week2" {
	const weekNum = getCurrentWeekNumber(anchorDate);
	return weekNum === 0 ? "week1" : "week2";
}

/**
 * Получить расписание на конкретный день текущей недели.
 */
export function getTodaySlots(data: UmOSData): ScheduleSlot[] {
	const weekKey = getCurrentWeekKey(data.settings.scheduleAnchorDate);
	const today = getDayOfWeek();

	if (today === "sunday") return [];

	const week = data.schedule[weekKey];
	return week[today] || [];
}

/**
 * Получить расписание на конкретный день конкретной недели.
 */
export function getSlotsForDay(
	data: UmOSData,
	weekKey: "week1" | "week2",
	day: string
): ScheduleSlot[] {
	const week = data.schedule[weekKey];
	return week[day] || [];
}

/**
 * Получить только заполненные слоты (с предметом), отсортированные по времени.
 */
export function getFilledSlots(slots: ScheduleSlot[]): ScheduleSlot[] {
	return slots
		.filter((s) => s.subject && s.subject.trim() !== "")
		.sort((a, b) => timeToMin(a.startTime) - timeToMin(b.startTime));
}

/**
 * Установить слот в расписании.
 */
export function setSlot(
	data: UmOSData,
	weekKey: "week1" | "week2",
	day: string,
	slotIndex: number,
	slot: ScheduleSlot | null
): void {
	if (!data.schedule[weekKey][day]) {
		data.schedule[weekKey][day] = [];
	}

	const slots = data.schedule[weekKey][day];

	// Расширяем массив если нужно
	while (slots.length <= slotIndex) {
		slots.push(createEmptySlot());
	}

	if (slot === null) {
		slots[slotIndex] = createEmptySlot();
	} else {
		slots[slotIndex] = slot;
	}
}

/**
 * Создать пустой слот.
 */
export function createEmptySlot(): ScheduleSlot {
	return {
		subject: "",
		teacher: "",
		room: "",
		startTime: "",
		endTime: "",
		type: "lecture",
	};
}

/**
 * Определить текущую/следующую пару из списка заполненных слотов.
 */
export function getCurrentSlotInfo(slots: ScheduleSlot[]): {
	currentSlot: ScheduleSlot | null;
	currentIndex: number;
	nextSlot: ScheduleSlot | null;
	nextIndex: number;
} {
	const now = new Date();
	const currentMinutes = now.getHours() * 60 + now.getMinutes();

	const filled = getFilledSlots(slots);

	let currentSlot: ScheduleSlot | null = null;
	let currentIndex = -1;
	let nextSlot: ScheduleSlot | null = null;
	let nextIndex = -1;

	for (let i = 0; i < filled.length; i++) {
		const slot = filled[i];
		if (!slot.startTime || !slot.endTime) continue;

		const startMin = timeToMin(slot.startTime);
		const endMin = timeToMin(slot.endTime);

		if (currentMinutes >= startMin && currentMinutes < endMin) {
			currentSlot = slot;
			currentIndex = i;
		} else if (currentMinutes < startMin && nextSlot === null) {
			nextSlot = slot;
			nextIndex = i;
		}
	}

	return { currentSlot, currentIndex, nextSlot, nextIndex };
}

/**
 * Подсчитать количество заполненных пар.
 */
export function countSlots(slots: ScheduleSlot[]): number {
	return slots.filter((s) => s.subject && s.subject.trim() !== "").length;
}

/**
 * Подсчитать пары на неделю.
 */
export function countWeekSlots(data: UmOSData, weekKey: "week1" | "week2"): number {
	let total = 0;
	for (const day of WEEKDAYS) {
		total += countSlots(getSlotsForDay(data, weekKey, day));
	}
	return total;
}

/**
 * Форматирование countdown до конца/начала пары.
 */
export function formatSlotCountdown(targetTime: string): string {
	if (!targetTime) return "";

	const now = new Date();
	const currentMin = now.getHours() * 60 + now.getMinutes();
	const targetMin = timeToMin(targetTime);
	const diff = targetMin - currentMin;

	if (diff <= 0) return "";
	const h = Math.floor(diff / 60);
	const m = diff % 60;
	if (h > 0) return `${h}ч ${m}мин`;
	return `${m}мин`;
}

function timeToMin(time: string): number {
	if (!time || !time.includes(":")) return 0;
	const parts = time.split(":");
	return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}