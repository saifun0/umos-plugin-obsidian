/**
 * Обёртка для сетевых запросов: использует requestUrl из Obsidian API
 * (обходит CORS), с retry и error handling.
 */
import { requestUrl } from "obsidian";

export interface FetchOptions {
	timeout?: number;
	retries?: number;
	retryDelay?: number;
}

const DEFAULT_FETCH_OPTIONS: Required<FetchOptions> = {
	timeout: 10000,
	retries: 2,
	retryDelay: 1000,
};

/**
 * Ошибка API-запроса.
 */
export class ApiError extends Error {
	public status: number;
	public url: string;

	constructor(message: string, status: number, url: string) {
		super(message);
		this.name = "ApiError";
		this.status = status;
		this.url = url;
	}
}

/**
 * Безопасный HTTP-запрос через Obsidian requestUrl (без CORS),
 * с retry и timeout.
 * Возвращает JSON-ответ или выбрасывает ApiError.
 */
export async function safeFetch<T>(
	url: string,
	options?: FetchOptions
): Promise<T> {
	const opts = { ...DEFAULT_FETCH_OPTIONS, ...options };
	let lastError: Error | null = null;

	for (let attempt = 0; attempt <= opts.retries; attempt++) {
		try {
			const response = await requestUrl({ url, throw: false });

			if (response.status >= 400) {
				throw new ApiError(
					`HTTP ${response.status}`,
					response.status,
					url
				);
			}

			return response.json as T;
		} catch (error) {
			lastError = error as Error;

			// Не retry на 4xx ошибках (кроме 429)
			if (
				error instanceof ApiError &&
				error.status >= 400 &&
				error.status < 500 &&
				error.status !== 429
			) {
				throw error;
			}

			if (attempt < opts.retries) {
				await sleep(opts.retryDelay * (attempt + 1));
			}
		}
	}

	throw lastError || new Error(`Не удалось загрузить: ${url}`);
}

/**
 * Задержка.
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Формирует URL для Aladhan API по городу/стране.
 */
export function buildAladhanUrl(
	date: string,
	city: string,
	country: string,
	method: number
): string {
	return `https://api.aladhan.com/v1/timingsByCity/${date}?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=${method}`;
}

/**
 * Формирует URL для Aladhan API по координатам.
 */
export function buildAladhanUrlByCoords(
	date: string,
	latitude: number,
	longitude: number,
	method: number
): string {
	return `https://api.aladhan.com/v1/timings/${date}?latitude=${latitude}&longitude=${longitude}&method=${method}`;
}

export interface GeoIpResult {
	latitude: number;
	longitude: number;
	city: string;
}

/**
 * Определение геолокации по IP через ip-api.com (запасной вариант).
 */
async function fetchGeoIp(): Promise<GeoIpResult> {
	const data = await safeFetch<{ lat: number; lon: number; city: string }>(
		"http://ip-api.com/json/?fields=lat,lon,city"
	);
	return { latitude: data.lat, longitude: data.lon, city: data.city };
}


/**
 * Определение геолокации по IP через ip-api.com.
 * navigator.geolocation в Electron (Obsidian) не работает —
 * внутри обращается к Google Network Location API и получает 403.
 */
export async function detectLocation(): Promise<GeoIpResult> {
	return fetchGeoIp();
}

/**
 * Формирует URL для Al Quran Cloud API.
 */
export function buildQuranAyahUrl(
	ayahNumber: number,
	edition: string
): string {
	return `https://api.alquran.cloud/v1/ayah/${ayahNumber}/${edition}`;
}