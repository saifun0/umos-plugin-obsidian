import { Events } from "obsidian";

/**
 * Типизированные события umOS для межмодульной коммуникации.
 */
export interface PrayerTimesData {
	Fajr: string;
	Sunrise: string;
	Dhuhr: string;
	Asr: string;
	Maghrib: string;
	Isha: string;
	[key: string]: string;
}

export interface CachedAyah {
	number: number;
	surahNumber: number;
	ayahInSurah: number;
	arabicText: string;
	translationText: string;
	surahNameRu: string;
}

export interface UmOSEventMap {
	"prayer:updated": [data: { times: PrayerTimesData; hijriDate: string }];
	"frontmatter:changed": [data: { path: string; property: string; value: unknown }];
	"stats:recalculated": [data: { period: number }];
	"habit:toggled": [data: { habit: string; date: string; value: boolean }];
	"daily:created": [data: { path: string; date: string }];
	"quran:ayat-loaded": [data: { date: string; ayahs: CachedAyah[] }];
	"schedule:changed": [];
	"ramadan:toggled": [data: { date: string; field: "fasting" | "tarawih"; value: boolean }];
	"pomodoro:completed": [data: { date: string; count: number }];
	"pomodoro:state-changed": [data: { state: "idle" | "work" | "break" }];
	"exam:changed": [];
	"finance:transaction-added": [data: { transaction: { id: string; date: string; type: "income" | "expense"; amount: number; categoryId: string; description: string } }];
	"finance:transaction-updated": [data: { transaction: { id: string; date: string; type: "income" | "expense"; amount: number; categoryId: string; description: string } }];
	"finance:transaction-deleted": [data: { transactionId: string }];
	"finance:budget-updated": [data: { month: string; budget: number }];
	"finance:balance-updated": [data: { balance: number }];
	"finance:recurring-updated": [];
	"weather:updated": [];
	"location:updated": [];
	"goals:updated": [];
	"balance:updated": [];
	"settings:changed": [];
}

/**
 * EventBus — типизированная шина событий для межмодульной коммуникации.
 * Обёртка над Obsidian Events с типизацией.
 */
export class EventBus {
	private events: Events;

	constructor() {
		this.events = new Events();
	}

	on<K extends keyof UmOSEventMap>(
		event: K,
		callback: (...args: UmOSEventMap[K]) => void,
		ctx?: unknown
	): void {
		this.events.on(
			event as string,
			callback as (...args: unknown[]) => void,
			ctx
		);
	}

	off<K extends keyof UmOSEventMap>(
		event: K,
		callback: (...args: UmOSEventMap[K]) => void
	): void {
		this.events.off(
			event as string,
			callback as (...args: unknown[]) => void
		);
	}

	emit<K extends keyof UmOSEventMap>(
		event: K,
		...args: UmOSEventMap[K]
	): void {
		this.events.trigger(event as string, ...args);
	}

	offAll(): void {
		// Events в Obsidian не предоставляет метод offAll,
		// но при unload плагина мы просто перестаём использовать этот инстанс.
		// Создаём новый Events для полного сброса.
		this.events = new Events();
	}
}