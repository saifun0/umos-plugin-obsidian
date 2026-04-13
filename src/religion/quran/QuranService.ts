import { EventBus, CachedAyah } from "../../EventBus";
import { safeFetch, buildQuranAyahUrl } from "../../utils/api";
import { getTodayDateString, seededRandom, dateSeed } from "../../utils/date";
import { getSurahNameRu } from "./SurahNames";

const LOCALSTORAGE_KEY = "umos-ayat-cache";
const TOTAL_AYAHS = 6236;

interface QuranApiResponse {
	code: number;
	status: string;
	data: {
		number: number;
		text: string;
		surah: {
			number: number;
			name: string;
			englishName: string;
			numberOfAyahs: number;
		};
		numberInSurah: number;
		edition: {
			identifier: string;
			language: string;
			name: string;
			englishName: string;
		};
	};
}

interface AyatCacheEntry {
	date: string;
	ayahs: CachedAyah[];
	fetchedAt: number;
}

export class QuranService {
	private eventBus: EventBus;
	private cache: AyatCacheEntry | null = null;

	constructor(eventBus: EventBus) {
		this.eventBus = eventBus;
		this.loadFromLocalStorage();
	}

	/**
	 * Загружает аяты дня. Если кеш актуален — возвращает из кеша.
	 */
	async getAyatOfDay(count: number, translation: string, showArabic: boolean): Promise<CachedAyah[]> {
		const today = getTodayDateString();

		// Проверяем кеш
		if (this.cache && this.cache.date === today && this.cache.ayahs.length >= count) {
			return this.cache.ayahs.slice(0, count);
		}

		// Генерируем детерминированные номера аятов
		const ayahNumbers = this.generateAyahNumbers(today, count);

		// Загружаем параллельно
		const ayahs = await this.fetchAyahs(ayahNumbers, translation, showArabic);

		// Кешируем
		this.cache = {
			date: today,
			ayahs,
			fetchedAt: Date.now(),
		};

		this.saveToLocalStorage();

		this.eventBus.emit("quran:ayat-loaded", {
			date: today,
			ayahs,
		});

		return ayahs;
	}

	/**
	 * Возвращает кешированные аяты или null.
	 */
	getCachedAyahs(): CachedAyah[] | null {
		const today = getTodayDateString();
		if (this.cache && this.cache.date === today) {
			return this.cache.ayahs;
		}
		return null;
	}

	/**
	 * Генерирует детерминированные уникальные номера аятов на основе даты.
	 */
	private generateAyahNumbers(dateStr: string, count: number): number[] {
		const seed = dateSeed(dateStr);
		const rng = seededRandom(seed);
		const numbers = new Set<number>();

		// Пропускаем аят 1 (Бисмилля Аль-Фатихи) — он будет отдельно
		while (numbers.size < count) {
			const num = Math.floor(rng() * TOTAL_AYAHS) + 1;
			if (num > 0 && num <= TOTAL_AYAHS) {
				numbers.add(num);
			}
		}

		return Array.from(numbers);
	}

	/**
	 * Загружает аяты из API параллельно.
	 */
	private async fetchAyahs(
		numbers: number[],
		translation: string,
		showArabic: boolean
	): Promise<CachedAyah[]> {
		const results: CachedAyah[] = [];

		// Формируем массив промисов для параллельной загрузки
		const promises = numbers.map(async (num) => {
			return this.fetchSingleAyah(num, translation, showArabic);
		});

		const settled = await Promise.allSettled(promises);

		for (const result of settled) {
			if (result.status === "fulfilled" && result.value !== null) {
				results.push(result.value);
			}
		}

		return results;
	}

	/**
	 * Загружает один аят (перевод + арабский).
	 */
	private async fetchSingleAyah(
		number: number,
		translation: string,
		showArabic: boolean
	): Promise<CachedAyah | null> {
		try {
			// Параллельно: перевод + арабский
			const fetchPromises: Promise<QuranApiResponse>[] = [
				safeFetch<QuranApiResponse>(buildQuranAyahUrl(number, translation), {
					timeout: 10000,
					retries: 1,
				}),
			];

			if (showArabic) {
				fetchPromises.push(
					safeFetch<QuranApiResponse>(buildQuranAyahUrl(number, "quran-uthmani"), {
						timeout: 10000,
						retries: 1,
					})
				);
			}

			const responses = await Promise.all(fetchPromises);

			const translationData = responses[0];
			if (!translationData || translationData.code !== 200) {
				return null;
			}

			const surahNumber = translationData.data.surah.number;
			const ayahInSurah = translationData.data.numberInSurah;

			const ayah: CachedAyah = {
				number: translationData.data.number,
				surahNumber,
				ayahInSurah,
				arabicText: "",
				translationText: translationData.data.text,
				surahNameRu: getSurahNameRu(surahNumber),
			};

			if (showArabic && responses[1] && responses[1].code === 200) {
				ayah.arabicText = responses[1].data.text;
			}

			return ayah;
		} catch (error) {
			console.error(`umOS Quran: failed to fetch ayah #${number}:`, error);
			return null;
		}
	}

	private saveToLocalStorage(): void {
		try {
			if (this.cache) {
				localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(this.cache));
			}
		} catch (e) {
			console.warn("umOS Quran: failed to save to localStorage:", e);
		}
	}

	private loadFromLocalStorage(): void {
		try {
			const stored = localStorage.getItem(LOCALSTORAGE_KEY);
			if (stored) {
				const parsed = JSON.parse(stored) as AyatCacheEntry;
				if (parsed && parsed.date && Array.isArray(parsed.ayahs)) {
					this.cache = parsed;
				}
			}
		} catch (e) {
			console.warn("umOS Quran: failed to load from localStorage:", e);
		}
	}
}