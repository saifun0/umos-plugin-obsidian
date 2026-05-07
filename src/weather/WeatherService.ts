import { EventBus } from "../EventBus";
import { safeFetch } from "../utils/api";
import type { UmOSSettings } from "../settings/Settings";

export interface CurrentWeather {
	temperature: number;
	apparentTemperature: number;
	weatherCode: number;
	humidity: number;
	windSpeed: number;
}

export interface HourlyForecastItem {
	hour: string;
	temp: number;
	weatherCode: number;
}

export interface DailyForecastItem {
	date: string;
	label: string;
	dayTemp: number;
	nightTemp: number;
	dayWeatherCode: number;
	nightWeatherCode: number;
}

export interface WeatherSnapshot {
	updatedAt: number;
	current: CurrentWeather;
	hourly: HourlyForecastItem[];
	daily: DailyForecastItem[];
}

export interface WeatherRefreshResult {
	ok: boolean;
	snapshot: WeatherSnapshot | null;
	error?: string;
}

interface OpenMeteoResponse {
	current: {
		temperature_2m: number;
		apparent_temperature: number;
		weather_code: number;
		relative_humidity_2m: number;
		wind_speed_10m: number;
	};
	hourly: {
		time: string[];
		temperature_2m: number[];
		weather_code: number[];
	};
}

interface WeatherCache {
	timestamp: number;
	current: CurrentWeather;
	hourly: HourlyForecastItem[];
	daily?: DailyForecastItem[];
}

const CACHE_KEY = "umos-weather-cache";
const CACHE_TTL = 30 * 60 * 1000; // 30 min
const DAILY_FORECAST_DAYS = 6;
const WEATHER_FETCH_DAYS = DAILY_FORECAST_DAYS + 1;

const WMO_CODES: Record<number, { emoji: string; description: string }> = {
	0: { emoji: "☀️", description: "Clear" },
	1: { emoji: "🌤", description: "Mostly clear" },
	2: { emoji: "⛅", description: "Partly cloudy" },
	3: { emoji: "☁️", description: "Cloudy" },
	45: { emoji: "🌫", description: "Fog" },
	48: { emoji: "🌫", description: "Rime fog" },
	51: { emoji: "🌦", description: "Light drizzle" },
	53: { emoji: "🌦", description: "Drizzle" },
	55: { emoji: "🌧", description: "Heavy drizzle" },
	56: { emoji: "🌧", description: "Freezing drizzle" },
	57: { emoji: "🌧", description: "Heavy freezing drizzle" },
	61: { emoji: "🌧", description: "Light rain" },
	63: { emoji: "🌧", description: "Rain" },
	65: { emoji: "🌧", description: "Heavy rain" },
	66: { emoji: "🌧", description: "Freezing rain" },
	67: { emoji: "🌧", description: "Heavy freezing rain" },
	71: { emoji: "🌨", description: "Light snow" },
	73: { emoji: "🌨", description: "Snow" },
	75: { emoji: "❄️", description: "Heavy snow" },
	77: { emoji: "🌨", description: "Snow grains" },
	80: { emoji: "🌦", description: "Light showers" },
	81: { emoji: "🌧", description: "Showers" },
	82: { emoji: "⛈", description: "Heavy showers" },
	85: { emoji: "🌨", description: "Snow showers" },
	86: { emoji: "❄️", description: "Heavy snow showers" },
	95: { emoji: "⛈", description: "Thunderstorm" },
	96: { emoji: "⛈", description: "Thunderstorm with hail" },
	99: { emoji: "⛈", description: "Heavy thunderstorm with hail" },
};

export function getWeatherInfo(code: number): { emoji: string; description: string } {
	return WMO_CODES[code] || { emoji: "❓", description: "Unknown" };
}

export class WeatherService {
	private eventBus: EventBus;
	private settings: UmOSSettings;
	private cache: WeatherCache | null = null;

	constructor(eventBus: EventBus, settings: UmOSSettings) {
		this.eventBus = eventBus;
		this.settings = settings;
		this.loadCache();
	}

	async init(registerInterval: (id: number) => void): Promise<void> {
		await this.fetchWeather();
		registerInterval(window.setInterval(() => this.fetchWeather(), CACHE_TTL));
	}

	private loadCache(): void {
		try {
			const raw = localStorage.getItem(CACHE_KEY);
			if (raw) {
				const parsed = JSON.parse(raw) as WeatherCache;
				if (Date.now() - parsed.timestamp < CACHE_TTL) {
					this.cache = parsed;
				}
			}
		} catch { /* ignore */ }
	}

	private saveCache(): void {
		if (this.cache) {
			localStorage.setItem(CACHE_KEY, JSON.stringify(this.cache));
		}
	}

	async forceFetch(): Promise<WeatherRefreshResult> {
		const previousCache = this.cache;
		try {
			const cache = await this.fetchWeatherFromApi();
			this.applyCache(cache);
			return { ok: true, snapshot: this.createSnapshot(cache) };
		} catch (error) {
			this.cache = previousCache;
			const message = error instanceof Error ? error.message : String(error);
			console.error("umOS: failed to force fetch weather:", error);
			return { ok: false, snapshot: this.getSnapshot(), error: message };
		}
	}

	async fetchWeather(): Promise<void> {
		if (
			this.cache &&
			this.cache.daily &&
			this.cache.daily.length >= DAILY_FORECAST_DAYS &&
			Date.now() - this.cache.timestamp < CACHE_TTL
		) {
			return;
		}

		try {
			this.applyCache(await this.fetchWeatherFromApi());
		} catch (error) {
			console.error("umOS: failed to fetch weather:", error);
		}
	}

	getCurrentWeather(): CurrentWeather | null {
		return this.cache?.current || null;
	}

	getHourlyForecast(): HourlyForecastItem[] {
		return this.cache?.hourly || [];
	}

	getDailyForecast(): DailyForecastItem[] {
		return this.cache?.daily || [];
	}

	getSnapshot(): WeatherSnapshot | null {
		return this.cache ? this.createSnapshot(this.cache) : null;
	}

	private async fetchWeatherFromApi(): Promise<WeatherCache> {
		const url = `https://api.open-meteo.com/v1/forecast?latitude=${this.settings.locationLatitude}&longitude=${this.settings.locationLongitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code&timezone=auto&forecast_days=${WEATHER_FETCH_DAYS}`;
		const data = await safeFetch<OpenMeteoResponse>(url);

		const current: CurrentWeather = {
			temperature: Math.round(data.current.temperature_2m),
			apparentTemperature: Math.round(data.current.apparent_temperature),
			weatherCode: data.current.weather_code,
			humidity: data.current.relative_humidity_2m,
			windSpeed: Math.round(data.current.wind_speed_10m),
		};

		const now = new Date();
		const hourly: HourlyForecastItem[] = [];
		const futureHourly: Array<{ date: Date; temp: number; weatherCode: number }> = [];

		const nowTs = now.getTime();
		for (let i = 0; i < data.hourly.time.length; i++) {
			const hDate = new Date(data.hourly.time[i]);
			if (hDate.getTime() > nowTs) {
				futureHourly.push({
					date: hDate,
					temp: Math.round(data.hourly.temperature_2m[i]),
					weatherCode: data.hourly.weather_code[i],
				});
			}
			if (hDate.getTime() > nowTs && hourly.length < 11) {
				const h = hDate.getHours();
				hourly.push({
					hour: String(h).padStart(2, "0") + ":00",
					temp: Math.round(data.hourly.temperature_2m[i]),
					weatherCode: data.hourly.weather_code[i],
				});
			}
		}

		return { timestamp: Date.now(), current, hourly, daily: buildDailyForecast(futureHourly) };
	}

	private applyCache(cache: WeatherCache): void {
		this.cache = cache;
		this.saveCache();
		this.eventBus.emit("weather:updated");
	}

	private createSnapshot(cache: WeatherCache): WeatherSnapshot {
		return {
			updatedAt: cache.timestamp,
			current: cache.current,
			hourly: [...cache.hourly],
			daily: [...(cache.daily ?? [])],
		};
	}
}

function buildDailyForecast(hourly: Array<{ date: Date; temp: number; weatherCode: number }>): DailyForecastItem[] {
	const groups = new Map<string, Array<{ date: Date; temp: number; weatherCode: number }>>();
	for (const item of hourly) {
		const key = formatLocalDate(item.date);
		const group = groups.get(key) ?? [];
		group.push(item);
		groups.set(key, group);
	}

	return Array.from(groups.entries()).slice(0, DAILY_FORECAST_DAYS).map(([date, items]) => {
		const dayItems = items.filter((item) => {
			const hour = item.date.getHours();
			return hour >= 6 && hour < 18;
		});
		const nightItems = items.filter((item) => {
			const hour = item.date.getHours();
			return hour < 6 || hour >= 18;
		});
		const daySource = dayItems.length > 0 ? dayItems : items;
		const nightSource = nightItems.length > 0 ? nightItems : items;

		return {
			date,
			label: formatDailyLabel(items[0]?.date),
			dayTemp: Math.round(Math.max(...daySource.map((item) => item.temp))),
			nightTemp: Math.round(Math.min(...nightSource.map((item) => item.temp))),
			dayWeatherCode: mostFrequentWeatherCode(daySource),
			nightWeatherCode: mostFrequentWeatherCode(nightSource),
		};
	});
}

function mostFrequentWeatherCode(items: Array<{ weatherCode: number }>): number {
	const counts = new Map<number, number>();
	for (const item of items) counts.set(item.weatherCode, (counts.get(item.weatherCode) ?? 0) + 1);
	return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
}

function formatLocalDate(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function formatDailyLabel(date: Date | undefined): string {
	if (!date) return "Day";
	const key = formatLocalDate(date);
	const today = formatLocalDate(new Date());
	const tomorrow = new Date();
	tomorrow.setDate(tomorrow.getDate() + 1);
	if (key === today) return "Today";
	if (key === formatLocalDate(tomorrow)) return "Tomorrow";
	const label = date.toLocaleDateString("en-US", { weekday: "short" }).replace(".", "");
	return label.charAt(0).toUpperCase() + label.slice(1);
}
