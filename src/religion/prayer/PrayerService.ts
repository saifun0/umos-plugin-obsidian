import { App } from "obsidian";
import { EventBus, PrayerTimesData } from "../../EventBus";
import { UmOSSettings } from "../../settings/Settings";
import { safeFetch, buildAladhanUrlByCoords } from "../../utils/api";
import { formatDateForAladhan, getTodayDateString } from "../../utils/date";
import { getLanguage } from "../../i18n";

const LOCALSTORAGE_KEY = "umos-prayer-cache";

const PRAYER_NAMES_RU: Record<string, string> = {
	Fajr: "Фаджр",
	Sunrise: "Восход",
	Dhuhr: "Зухр",
	Asr: "Аср",
	Maghrib: "Магриб",
	Isha: "Иша",
};

const PRAYER_NAMES_EN: Record<string, string> = {
	Fajr: "Fajr",
	Sunrise: "Sunrise",
	Dhuhr: "Dhuhr",
	Asr: "Asr",
	Maghrib: "Maghrib",
	Isha: "Isha",
};

const PRAYER_ICONS: Record<string, string> = {
	Fajr: "🌅",
	Sunrise: "☀️",
	Dhuhr: "🕐",
	Asr: "🌤️",
	Maghrib: "🌇",
	Isha: "🌙",
};

/**     */
const PRAYER_ORDER = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];

/**   ( Sunrise) */
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

export interface PrayerSnapshot extends PrayerCacheEntry {}

export interface PrayerRefreshResult {
	ok: boolean;
	snapshot: PrayerSnapshot | null;
	error?: string;
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
	 * :     tue-.
	 *  of main.ts, registerInterval  .
	 */
	async init(registerInterval: (id: number) => void): Promise<void> {
		try {
			await this.fetchIfNeeded();
		} catch (error) {
			console.warn("umOS Prayer: init error, using cache:", error);
		}

		//    (3600000 )
		const hourlyId = window.setInterval(() => {
			this.fetchIfNeeded().catch((error) => {
				console.error("umOS Prayer: auto-refresh error:", error);
			});
		}, 3600000);
		registerInterval(hourlyId);

		//     minutes
		const midnightCheckId = window.setInterval(() => {
			this.checkDayChange();
		}, 60000);
		registerInterval(midnightCheckId);
	}

	/**
	 *     null.
	 */
	getCache(): PrayerCacheEntry | null {
		return this.cache;
	}

	/**
	 *    for today.
	 */
	getTimes(): PrayerTimesData | null {
		if (!this.cache || this.cache.date !== getTodayDateString()) {
			return null;
		}
		return this.cache.times;
	}

	/**
	 *   .
	 */
	getHijriDate(): string {
		return this.cache?.hijriDate || "";
	}

	/**
	 *    of API.
	 */
	getGregorianDate(): string {
		return this.cache?.gregorianDate || "";
	}

	/**
	 *      .
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
					nameRu: PrayerService.getPrayerNameRu(name),
					icon: PRAYER_ICONS[name] || "🕌",
					time: timeStr,
					minutesLeft: prayerMinutes - currentMinutes,
				};
			}
		}

		// All
		return null;
	}

	/**
	 *    : passed / next / upcoming / info.
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
	 * ,    for today .
	 */
	allPrayersDone(): boolean {
		return this.getNextPrayer() === null && this.getTimes() !== null;
	}

	/**
	 *   -mo (1-12).
	 */
	getHijriMonth(): number {
		return this.cache?.hijriMonth || 0;
	}

	/**
	 *   .
	 */
	async refresh(): Promise<PrayerRefreshResult> {
		const previousCache = this.cache;
		try {
			const entry = await this.fetchPrayerFromApi();
			this.applyCache(entry);
			return { ok: true, snapshot: this.createSnapshot(entry) };
		} catch (error) {
			this.cache = previousCache;
			const message = error instanceof Error ? error.message : String(error);
			console.error("umOS Prayer: force refresh error:", error);
			if (!this.cache) {
				this.loadFromLocalStorage();
			}
			return { ok: false, snapshot: this.getSnapshot(), error: message };
		}
	}

	// ───   ────────────────────────────────

	private async fetchIfNeeded(): Promise<void> {
		const today = getTodayDateString();

		if (this.cache && this.cache.date === today) {
			//  ,     >1
			const hourAgo = Date.now() - 3600000;
			if (this.cache.fetchedAt > hourAgo) {
				return;
			}
		}

		await this.fetchFromApi();
	}

	private async fetchFromApi(): Promise<void> {
		try {
			this.applyCache(await this.fetchPrayerFromApi());
			console.log("umOS Prayer: data updated", this.cache?.times);
		} catch (error) {
			console.error("umOS Prayer: fetch error:", error);
			//   of localStorage
			if (!this.cache) {
				this.loadFromLocalStorage();
			}
		}
	}

	private async fetchPrayerFromApi(): Promise<PrayerCacheEntry> {
		const today = new Date();
		const dateStr = formatDateForAladhan(today);

		const url = buildAladhanUrlByCoords(
			dateStr,
			this.settings.locationLatitude,
			this.settings.locationLongitude,
			this.settings.prayerMethod
		);

		const response = await safeFetch<AladhanResponse>(url, {
			timeout: 10000,
			retries: 2,
		});

		if (response.code !== 200 || !response.data) {
			throw new Error(`Unexpected Aladhan response: ${response.status || response.code}`);
		}

		const timings = response.data.timings;
		const hijri = response.data.date.hijri;
		const gregorian = response.data.date.gregorian;

		//       " (XXX)" of
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

		return {
			date: getTodayDateString(),
			times,
			hijriDate: hijriDateStr,
			gregorianDate: gregorianDateStr,
			hijriMonth: hijri.month.number,
			hijriDay: parseInt(hijri.day, 10),
			fetchedAt: Date.now(),
		};
	}

	getSnapshot(): PrayerSnapshot | null {
		return this.cache ? this.createSnapshot(this.cache) : null;
	}

	private applyCache(entry: PrayerCacheEntry): void {
		this.cache = entry;
		this.saveToLocalStorage();
		this.eventBus.emit("prayer:updated", {
			times: entry.times,
			hijriDate: entry.hijriDate,
		});
	}

	private createSnapshot(entry: PrayerCacheEntry): PrayerSnapshot {
		return {
			...entry,
			times: { ...entry.times },
		};
	}

	/**
	 *  " (EET)"    of .
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
	 *     .
	 */
	static getPrayerNameRu(name: string): string {
		const names = getLanguage() === "ru" ? PRAYER_NAMES_RU : PRAYER_NAMES_EN;
		return names[name] || name;
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
