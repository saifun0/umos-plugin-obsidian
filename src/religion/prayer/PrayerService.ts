import { App } from "obsidian";
import { EventBus, PrayerTimesData } from "../../EventBus";
import { UmOSSettings } from "../../settings/Settings";
import { safeFetch, buildAladhanUrlByCoords } from "../../utils/api";
import { formatDateForAladhan, getTodayDateString } from "../../utils/date";

const LOCALSTORAGE_KEY = "umos-prayer-cache";

const PRAYER_NAMES_RU: Record<string, string> = {
	Fajr: "Фаджр",
	Sunrise: "Восход",
	Dhuhr: "Зухр",
	Asr: "Аср",
	Maghrib: "Магриб",
	Isha: "Иша",
};

const PRAYER_ICONS: Record<string, string> = {
	Fajr: "🌅",
	Sunrise: "☀️",
	Dhuhr: "🕐",
	Asr: "🌤️",
	Maghrib: "🌇",
	Isha: "🌙",
};

/** Порядок намазов для отображения */
const PRAYER_ORDER = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];

/** Только обязательные (без Sunrise) */
const OBLIGATORY_PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

export interface PrayerCacheEntry {
	date: string;
	times: PrayerTimesData;
	hijriDate: string;
	gregorianDate: string;
	hijriMonth: number;
	hijriDay: number;
	fetchedAt: number;
}

interface AladhanResponse {
	code: number;
	status: string;
	data: {
		timings: Record<string, string>;
		date: {
			hijri: {
				day: string;
				weekday: { ar: string };
				month: { ar: string; number: number };
				year: string;
				designation: { abbreviated: string };
			};
			gregorian: {
				date: string;
				day: string;
				weekday: { en: string };
				month: { en: string; number: number };
				year: string;
			};
		};
	};
}

export class PrayerService {
	private app: App;
	private eventBus: EventBus;
	private settings: UmOSSettings;
	private cache: PrayerCacheEntry | null = null;
	private refreshIntervalId: number | null = null;

	constructor(app: App, eventBus: EventBus, settings: UmOSSettings) {
		this.app = app;
		this.eventBus = eventBus;
		this.settings = settings;
		this.loadFromLocalStorage();
	}

	/**
	 * Инициализация: загрузка данных и настройка авто-обновления.
	 * Вызывается из main.ts, registerInterval передаётся извне.
	 */
	async init(registerInterval: (id: number) => void): Promise<void> {
		try {
			await this.fetchIfNeeded();
		} catch (error) {
			console.warn("umOS Prayer: init error, using cache:", error);
		}

		// Обновление каждый час (3600000 мс)
		const hourlyId = window.setInterval(() => {
			this.fetchIfNeeded().catch((error) => {
				console.error("umOS Prayer: auto-refresh error:", error);
			});
		}, 3600000);
		registerInterval(hourlyId);

		// Проверка смены дня каждую минуту
		const midnightCheckId = window.setInterval(() => {
			this.checkDayChange();
		}, 60000);
		registerInterval(midnightCheckId);
	}

	/**
	 * Возвращает кешированные данные или null.
	 */
	getCache(): PrayerCacheEntry | null {
		return this.cache;
	}

	/**
	 * Возвращает времена намазов на сегодня.
	 */
	getTimes(): PrayerTimesData | null {
		if (!this.cache || this.cache.date !== getTodayDateString()) {
			return null;
		}
		return this.cache.times;
	}

	/**
	 * Возвращает хиджри дату.
	 */
	getHijriDate(): string {
		return this.cache?.hijriDate || "";
	}

	/**
	 * Возвращает григорианскую дату из API.
	 */
	getGregorianDate(): string {
		return this.cache?.gregorianDate || "";
	}

	/**
	 * Определяет следующий намаз и оставшееся время.
	 */
	getNextPrayer(): { name: string; nameRu: string; icon: string; time: string; minutesLeft: number } | null {
		const times = this.getTimes();
		if (!times) return null;

		const now = new Date();
		const currentMinutes = now.getHours() * 60 + now.getMinutes();

		for (const name of OBLIGATORY_PRAYERS) {
			const timeStr = times[name];
			if (!timeStr) continue;

			const prayerMinutes = this.timeToMinutes(timeStr);
			if (prayerMinutes > currentMinutes) {
				return {
					name,
					nameRu: PRAYER_NAMES_RU[name] || name,
					icon: PRAYER_ICONS[name] || "🕌",
					time: timeStr,
					minutesLeft: prayerMinutes - currentMinutes,
				};
			}
		}

		// Все намазы прошли
		return null;
	}

	/**
	 * Определяет статус каждого намаза: passed / next / upcoming / info.
	 */
	getPrayerStatuses(): Record<string, "passed" | "next" | "upcoming" | "info"> {
		const times = this.getTimes();
		const result: Record<string, "passed" | "next" | "upcoming" | "info"> = {};

		if (!times) {
			for (const name of PRAYER_ORDER) {
				result[name] = "upcoming";
			}
			return result;
		}

		const now = new Date();
		const currentMinutes = now.getHours() * 60 + now.getMinutes();
		let nextFound = false;

		for (const name of PRAYER_ORDER) {
			if (name === "Sunrise") {
				result[name] = "info";
				continue;
			}

			const timeStr = times[name];
			if (!timeStr) {
				result[name] = "upcoming";
				continue;
			}

			const prayerMinutes = this.timeToMinutes(timeStr);

			if (prayerMinutes <= currentMinutes) {
				result[name] = "passed";
			} else if (!nextFound) {
				result[name] = "next";
				nextFound = true;
			} else {
				result[name] = "upcoming";
			}
		}

		return result;
	}

	/**
	 * Проверяет, все ли намазы на сегодня завершены.
	 */
	allPrayersDone(): boolean {
		return this.getNextPrayer() === null && this.getTimes() !== null;
	}

	/**
	 * Возвращает номер хиджри-месяца (1-12).
	 */
	getHijriMonth(): number {
		return this.cache?.hijriMonth || 0;
	}

	/**
	 * Возвращает день хиджри-месяца.
	 */
	getHijriDay(): number {
		return this.cache?.hijriDay || 0;
	}

	/**
	 * Проверяет, является ли текущий месяц Рамаданом (9-й месяц хиджри).
	 */
	isRamadan(): boolean {
		return this.getHijriMonth() === 9;
	}

	/**
	 * Принудительно обновить данные.
	 */
	async refresh(): Promise<void> {
		await this.fetchFromApi();
	}

	// ─── Приватные методы ────────────────────────────────

	private async fetchIfNeeded(): Promise<void> {
		const today = getTodayDateString();

		if (this.cache && this.cache.date === today) {
			// Данные актуальны, обновляем только если прошло >1 часа
			const hourAgo = Date.now() - 3600000;
			if (this.cache.fetchedAt > hourAgo) {
				return;
			}
		}

		await this.fetchFromApi();
	}

	private async fetchFromApi(): Promise<void> {
		const today = new Date();
		const dateStr = formatDateForAladhan(today);

		const url = buildAladhanUrlByCoords(
			dateStr,
			this.settings.locationLatitude,
			this.settings.locationLongitude,
			this.settings.prayerMethod
		);

		try {
			const response = await safeFetch<AladhanResponse>(url, {
				timeout: 10000,
				retries: 2,
			});

			if (response.code !== 200 || !response.data) {
				console.warn("umOS Prayer: unexpected API response:", response);
				return;
			}

			const timings = response.data.timings;
			const hijri = response.data.date.hijri;
			const gregorian = response.data.date.gregorian;

			// Извлекаем только нужные времена и убираем " (XXX)" из значений
			const times: PrayerTimesData = {
				Fajr: this.cleanTime(timings.Fajr),
				Sunrise: this.cleanTime(timings.Sunrise),
				Dhuhr: this.cleanTime(timings.Dhuhr),
				Asr: this.cleanTime(timings.Asr),
				Maghrib: this.cleanTime(timings.Maghrib),
				Isha: this.cleanTime(timings.Isha),
			};

			const hijriDateStr = `${hijri.day} ${hijri.month.ar} ${hijri.year} ${hijri.designation.abbreviated}`;
			const gregorianDateStr = `${gregorian.day} ${gregorian.month.en} ${gregorian.year}`;

			this.cache = {
				date: getTodayDateString(),
				times,
				hijriDate: hijriDateStr,
				gregorianDate: gregorianDateStr,
				hijriMonth: hijri.month.number,
				hijriDay: parseInt(hijri.day, 10),
				fetchedAt: Date.now(),
			};

			this.saveToLocalStorage();

			this.eventBus.emit("prayer:updated", {
				times,
				hijriDate: hijriDateStr,
			});

			console.log("umOS Prayer: data updated", times);
		} catch (error) {
			console.error("umOS Prayer: fetch error:", error);
			// Используем кеш из localStorage если есть
			if (!this.cache) {
				this.loadFromLocalStorage();
			}
		}
	}

	/**
	 * Убирает " (EET)" и подобные суффиксы из времени.
	 */
	private cleanTime(time: string): string {
		return time.replace(/\s*\(.*\)\s*$/, "").trim();
	}

	private timeToMinutes(timeStr: string): number {
		const parts = timeStr.split(":");
		return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
	}

	private checkDayChange(): void {
		const today = getTodayDateString();
		if (this.cache && this.cache.date !== today) {
			console.log("umOS Prayer: new day detected, refreshing data");
			this.fetchFromApi();
		}
	}

	private saveToLocalStorage(): void {
		try {
			if (this.cache) {
				localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(this.cache));
			}
		} catch (e) {
			console.warn("umOS Prayer: failed to save to localStorage:", e);
		}
	}

	private loadFromLocalStorage(): void {
		try {
			const stored = localStorage.getItem(LOCALSTORAGE_KEY);
			if (stored) {
				const parsed = JSON.parse(stored) as PrayerCacheEntry;
				if (parsed && parsed.date && parsed.times) {
					this.cache = parsed;
				}
			}
		} catch (e) {
			console.warn("umOS Prayer: failed to load from localStorage:", e);
		}
	}

	/**
	 * Статические геттеры для внешнего использования.
	 */
	static getPrayerNameRu(name: string): string {
		return PRAYER_NAMES_RU[name] || name;
	}

	static getPrayerIcon(name: string): string {
		return PRAYER_ICONS[name] || "🕌";
	}

	static getPrayerOrder(): string[] {
		return [...PRAYER_ORDER];
	}

	static getObligatoryPrayers(): string[] {
		return [...OBLIGATORY_PRAYERS];
	}
}