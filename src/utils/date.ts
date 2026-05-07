import { getLanguage } from "../i18n";

/**
 *     .
 *    : Europe/Moscow.
 */

const DEFAULT_TIMEZONE = "Europe/Moscow";

/**
 *      YYYY-MM-DD (Europe/Moscow).
 */
export function getTodayDateString(): string {
	return formatDate(getTodayInTimezone(DEFAULT_TIMEZONE));
}

/**
 *   getTodayDateString — mo  DailyNoteEnhancer.
 */
export function getTodayISO(): string {
	return formatDate(getTodayInTimezone(DEFAULT_TIMEZONE));
}

/**
 *  Date   YYYY-MM-DD.
 */
export function formatDate(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

/**
 *   formatDate — mo  DailyNoteEnhancer.
 */
export function formatDateISO(date: Date): string {
	return formatDate(date);
}

/**
 *    Aladhan API (DD-MM-YYYY).
 */
export function formatDateForAladhan(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${day}-${month}-${year}`;
}

/**
 *   YYYY-MM-DD → Date.
 */
export function parseDate(dateStr: string): Date {
	const [year, month, day] = dateStr.split("-").map(Number);
	return new Date(year, month - 1, day);
}

/**
 *   "HH:MM" → { hours, minutes }.
 */
export function parseTime(timeStr: string): { hours: number; minutes: number } {
	const parts = timeStr.split(":");
	return {
		hours: parseInt(parts[0], 10),
		minutes: parseInt(parts[1], 10),
	};
}

/**
 *   "HH:MM"  minutes   .
 */
export function timeToMinutes(timeStr: string): number {
	const { hours, minutes } = parseTime(timeStr);
	return hours * 60 + minutes;
}

/**
 *  minutes     "HH:MM".
 */
export function minutesToTime(totalMinutes: number): string {
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 *      "HH:MM".
 */
export function getCurrentTimeString(): string {
	const now = new Date();
	return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

/**
 *      "HH:MM:SS".
 */
export function getCurrentTimeStringWithSeconds(): string {
	const now = new Date();
	return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
}

/**
 *       (date2 - date1).
 */
export function diffDays(date1: Date, date2: Date): number {
	const msPerDay = 24 * 60 * 60 * 1000;
	const utc1 = Date.UTC(date1.getFullYear(), date1.getMonth(), date1.getDate());
	const utc2 = Date.UTC(date2.getFullYear(), date2.getMonth(), date2.getDate());
	return Math.floor((utc2 - utc1) / msPerDay);
}

/**
 *    wk (0 = week1, 1 = week2)   anchor date.
 * weeks .
 */
export function getCurrentWeekNumber(anchorDateStr: string): 0 | 1 {
	if (!anchorDateStr) return 0;
	const anchor = parseDate(anchorDateStr);
	const today = new Date();
	const days = diffDays(anchor, today);
	const weekIndex = Math.floor(days / 7) % 2;
	return (weekIndex < 0 ? ((weekIndex % 2) + 2) % 2 : weekIndex) as 0 | 1;
}

/**
 *   wk (week1/week2)      anchor_date.
 */
export function getCurrentWeekType(anchorDateISO: string, targetDateISO: string): "week1" | "week2" {
	if (!anchorDateISO) return "week1";
	const anchor = parseDate(anchorDateISO);
	const target = parseDate(targetDateISO);
	const days = diffDays(anchor, target);
	const weekIndex = Math.floor(days / 7) % 2;
	const normalized = weekIndex < 0 ? ((weekIndex % 2) + 2) % 2 : weekIndex;
	return normalized === 0 ? "week1" : "week2";
}

/**
 *   wk (monday, tuesday, ..., sunday).
 */
export function getDayOfWeek(date?: Date): string {
	const d = date || new Date();
	const days = [
		"sunday",
		"monday",
		"tuesday",
		"wednesday",
		"thursday",
		"friday",
		"saturday",
	];
	return days[d.getDay()];
}

/**
 *  Dec  wk (0 = Monday, 6 = Sunday).
 */
export function getDayOfWeekIndex(date: Date): number {
	const jsDay = date.getDay(); // 0=Sun, 1=Mon, ...
	return jsDay === 0 ? 6 : jsDay - 1;
}

/**
 *   days wk.
 */
export function getDayOfWeekRu(day: string): string {
	const map: Record<string, string> = getLanguage() === "ru" ? {
		monday: "Понедельник",
		tuesday: "Вторник",
		wednesday: "Среда",
		thursday: "Четверг",
		friday: "Пятница",
		saturday: "Суббота",
		sunday: "Воскресенье",
	} : {
		monday: "Monday",
		tuesday: "Tuesday",
		wednesday: "Wednesday",
		thursday: "Thursday",
		friday: "Friday",
		saturday: "Saturday",
		sunday: "Sunday",
	};
	return map[day] || day;
}

/**
 *    days wk.
 */
export function getDayOfWeekShortRu(day: string): string {
	const map: Record<string, string> = getLanguage() === "ru" ? {
		monday: "Пн",
		tuesday: "Вт",
		wednesday: "Ср",
		thursday: "Чт",
		friday: "Пт",
		saturday: "Сб",
		sunday: "Вс",
	} : {
		monday: "Mon",
		tuesday: "Tue",
		wednesday: "Wed",
		thursday: "Thu",
		friday: "Fri",
		saturday: "Sat",
		sunday: "Sun",
	};
	return map[day] || day;
}

/**
 *   : "15 January 2025 ., Wednesday"
 */
export function getFullRussianDate(date?: Date): string {
	const d = date || new Date();
	const isRu = getLanguage() === "ru";
	const months = isRu ? [
		"января",
		"февраля",
		"марта",
		"апреля",
		"мая",
		"июня",
		"июля",
		"августа",
		"сентября",
		"октября",
		"ноября",
		"декабря",
	] : [
		"January",
		"February",
		"March",
		"April",
		"May",
		"June",
		"July",
		"August",
		"September",
		"October",
		"November",
		"December",
	];
	const weekdays = isRu ? [
		"Воскресенье",
		"Понедельник",
		"Вторник",
		"Среда",
		"Четверг",
		"Пятница",
		"Суббота",
	] : [
		"Sunday",
		"Monday",
		"Tuesday",
		"Wednesday",
		"Thursday",
		"Friday",
		"Saturday",
	];
	const day = d.getDate();
	const month = months[d.getMonth()];
	const year = d.getFullYear();
	const weekday = weekdays[d.getDay()];
	return `${day} ${month} ${year}, ${weekday}`;
}

/**
 *  countdown: "X Ymin"  "Ymin".
 */
export function formatCountdown(totalMinutes: number): string {
	const isRu = getLanguage() === "ru";
	if (totalMinutes <= 0) return isRu ? "сейчас" : "now";
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	if (hours > 0) {
		return isRu ? `${hours}ч ${minutes}мин` : `${hours}h ${minutes}min`;
	}
	return isRu ? `${minutes}мин` : `${minutes}min`;
}

/**
 * Greeting   .
 */
export function getGreeting(): { text: string; emoji: string } {
	const hour = new Date().getHours();
	const isRu = getLanguage() === "ru";
	if (hour >= 5 && hour < 12) {
		return { text: isRu ? "Доброе утро" : "Good morning", emoji: "☀️" };
	} else if (hour >= 12 && hour < 17) {
		return { text: isRu ? "Добрый день" : "Good afternoon", emoji: "🌤️" };
	} else if (hour >= 17 && hour < 21) {
		return { text: isRu ? "Добрый вечер" : "Good evening", emoji: "🌅" };
	} else {
		return { text: isRu ? "Доброй ночи" : "Good night", emoji: "🌙" };
	}
}

/**
 *    ,   .
 */
export function formatTemplate(template: string, date?: Date): string {
	const d = date || new Date();
	return template
		.replace("YYYY", String(d.getFullYear()))
		.replace("MM", String(d.getMonth() + 1).padStart(2, "0"))
		.replace("DD", String(d.getDate()).padStart(2, "0"))
		.replace("HH", String(d.getHours()).padStart(2, "0"))
		.replace("mm", String(d.getMinutes()).padStart(2, "0"))
		.replace("ss", String(d.getSeconds()).padStart(2, "0"));
}

/**
 * Seeded random number generator ( min  ).
 * Mulberry32.
 */
export function seededRandom(seed: number): () => number {
	let s = seed;
	return () => {
		s |= 0;
		s = (s + 0x6d2b79f5) | 0;
		let t = Math.imul(s ^ (s >>> 15), 1 | s);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/**
 *  seed of  .
 */
export function dateSeed(dateStr: string): number {
	let hash = 0;
	for (let i = 0; i < dateStr.length; i++) {
		const char = dateStr.charCodeAt(i);
		hash = ((hash << 5) - hash + char) | 0;
	}
	return Math.abs(hash);
}

/**
 *  today   .
 */
export function getTodayInTimezone(timezone: string = DEFAULT_TIMEZONE): Date {
	const now = new Date();
	const formatter = new Intl.DateTimeFormat("en-CA", {
		timeZone: timezone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});
	const parts = formatter.formatToParts(now);
	const year = parseInt(
		parts.find((p) => p.type === "year")?.value || "2025",
		10
	);
	const month =
		parseInt(
			parts.find((p) => p.type === "month")?.value || "1",
			10
		) - 1;
	const day = parseInt(
		parts.find((p) => p.type === "day")?.value || "1",
		10
	);
	return new Date(year, month, day);
}
