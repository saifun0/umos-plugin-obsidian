/**
 * Утилиты для работы с датами.
 * Часовой пояс по умолчанию: Europe/Moscow.
 */

const DEFAULT_TIMEZONE = "Europe/Moscow";

/**
 * Возвращает текущую дату в формате YYYY-MM-DD (Europe/Moscow).
 */
export function getTodayDateString(): string {
	return formatDate(getTodayInTimezone(DEFAULT_TIMEZONE));
}

/**
 * Алиас для getTodayDateString — совместимость с DailyNoteEnhancer.
 */
export function getTodayISO(): string {
	return formatDate(getTodayInTimezone(DEFAULT_TIMEZONE));
}

/**
 * Форматирует Date в строку YYYY-MM-DD.
 */
export function formatDate(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

/**
 * Алиас для formatDate — совместимость с DailyNoteEnhancer.
 */
export function formatDateISO(date: Date): string {
	return formatDate(date);
}

/**
 * Форматирует дату для Aladhan API (DD-MM-YYYY).
 */
export function formatDateForAladhan(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${day}-${month}-${year}`;
}

/**
 * Парсит строку YYYY-MM-DD → Date.
 */
export function parseDate(dateStr: string): Date {
	const [year, month, day] = dateStr.split("-").map(Number);
	return new Date(year, month - 1, day);
}

/**
 * Парсит время "HH:MM" → { hours, minutes }.
 */
export function parseTime(timeStr: string): { hours: number; minutes: number } {
	const parts = timeStr.split(":");
	return {
		hours: parseInt(parts[0], 10),
		minutes: parseInt(parts[1], 10),
	};
}

/**
 * Конвертирует время "HH:MM" в минуты от начала суток.
 */
export function timeToMinutes(timeStr: string): number {
	const { hours, minutes } = parseTime(timeStr);
	return hours * 60 + minutes;
}

/**
 * Конвертирует минуты от начала суток в "HH:MM".
 */
export function minutesToTime(totalMinutes: number): string {
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * Возвращает текущее время в формате "HH:MM".
 */
export function getCurrentTimeString(): string {
	const now = new Date();
	return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

/**
 * Возвращает текущее время в формате "HH:MM:SS".
 */
export function getCurrentTimeStringWithSeconds(): string {
	const now = new Date();
	return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
}

/**
 * Разница в днях между двумя датами (date2 - date1).
 */
export function diffDays(date1: Date, date2: Date): number {
	const msPerDay = 24 * 60 * 60 * 1000;
	const utc1 = Date.UTC(date1.getFullYear(), date1.getMonth(), date1.getDate());
	const utc2 = Date.UTC(date2.getFullYear(), date2.getMonth(), date2.getDate());
	return Math.floor((utc2 - utc1) / msPerDay);
}

/**
 * Определяет номер текущей недели (0 = week1, 1 = week2) на основе anchor date.
 * Двухнедельное чередование.
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
 * Получить тип недели (week1/week2) для произвольной даты на основе anchor_date.
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
 * Возвращает день недели (monday, tuesday, ..., sunday).
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
 * Получить индекс дня недели (0 = понедельник, 6 = воскресенье).
 */
export function getDayOfWeekIndex(date: Date): number {
	const jsDay = date.getDay(); // 0=Sun, 1=Mon, ...
	return jsDay === 0 ? 6 : jsDay - 1;
}

/**
 * Русские названия дней недели.
 */
export function getDayOfWeekRu(day: string): string {
	const map: Record<string, string> = {
		monday: "Понедельник",
		tuesday: "Вторник",
		wednesday: "Среда",
		thursday: "Четверг",
		friday: "Пятница",
		saturday: "Суббота",
		sunday: "Воскресенье",
	};
	return map[day] || day;
}

/**
 * Короткие русские названия дней недели.
 */
export function getDayOfWeekShortRu(day: string): string {
	const map: Record<string, string> = {
		monday: "Пн",
		tuesday: "Вт",
		wednesday: "Ср",
		thursday: "Чт",
		friday: "Пт",
		saturday: "Сб",
		sunday: "Вс",
	};
	return map[day] || day;
}

/**
 * Полная русская дата: "15 января 2025 г., среда"
 */
export function getFullRussianDate(date?: Date): string {
	const d = date || new Date();
	const months = [
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
	];
	const weekdays = [
		"воскресенье",
		"понедельник",
		"вторник",
		"среда",
		"четверг",
		"пятница",
		"суббота",
	];
	const day = d.getDate();
	const month = months[d.getMonth()];
	const year = d.getFullYear();
	const weekday = weekdays[d.getDay()];
	return `${day} ${month} ${year} г., ${weekday}`;
}

/**
 * Формат countdown: "Xч Yмин" или "Yмин".
 */
export function formatCountdown(totalMinutes: number): string {
	if (totalMinutes <= 0) return "сейчас";
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	if (hours > 0) {
		return `${hours}ч ${minutes}мин`;
	}
	return `${minutes}мин`;
}

/**
 * Приветствие по времени суток.
 */
export function getGreeting(): { text: string; emoji: string } {
	const hour = new Date().getHours();
	if (hour >= 5 && hour < 12) {
		return { text: "Доброе утро", emoji: "☀️" };
	} else if (hour >= 12 && hour < 17) {
		return { text: "Добрый день", emoji: "🌤️" };
	} else if (hour >= 17 && hour < 21) {
		return { text: "Добрый вечер", emoji: "🌅" };
	} else {
		return { text: "Доброй ночи", emoji: "🌙" };
	}
}

/**
 * Форматирует шаблон имени файла, заменяя плейсхолдеры датой.
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
 * Seeded random number generator (для детерминированных аятов дня).
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
 * Генерирует seed из строки даты.
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
 * Получает сегодняшнюю дату по таймзоне.
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