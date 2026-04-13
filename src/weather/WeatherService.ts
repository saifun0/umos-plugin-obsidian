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
}

const CACHE_KEY = "umos-weather-cache";
const CACHE_TTL = 30 * 60 * 1000; // 30 min

const WMO_CODES: Record<number, { emoji: string; description: string }> = {
	0: { emoji: "☀️", description: "Ясно" },
	1: { emoji: "🌤", description: "Малооблачно" },
	2: { emoji: "⛅", description: "Переменная облачность" },
	3: { emoji: "☁️", description: "Облачно" },
	45: { emoji: "🌫", description: "Туман" },
	48: { emoji: "🌫", description: "Изморозь" },
	51: { emoji: "🌦", description: "Лёгкая морось" },
	53: { emoji: "🌦", description: "Морось" },
	55: { emoji: "🌧", description: "Сильная морось" },
	56: { emoji: "🌧", description: "Ледяная морось" },
	57: { emoji: "🌧", description: "Сильная ледяная морось" },
	61: { emoji: "🌧", description: "Небольшой дождь" },
	63: { emoji: "🌧", description: "Дождь" },
	65: { emoji: "🌧", description: "Сильный дождь" },
	66: { emoji: "🌧", description: "Ледяной дождь" },
	67: { emoji: "🌧", description: "Сильный ледяной дождь" },
	71: { emoji: "🌨", description: "Небольшой снег" },
	73: { emoji: "🌨", description: "Снег" },
	75: { emoji: "❄️", description: "Сильный снег" },
	77: { emoji: "🌨", description: "Снежные зёрна" },
	80: { emoji: "🌦", description: "Небольшой ливень" },
	81: { emoji: "🌧", description: "Ливень" },
	82: { emoji: "⛈", description: "Сильный ливень" },
	85: { emoji: "🌨", description: "Снежный ливень" },
	86: { emoji: "❄️", description: "Сильный снежный ливень" },
	95: { emoji: "⛈", description: "Гроза" },
	96: { emoji: "⛈", description: "Гроза с градом" },
	99: { emoji: "⛈", description: "Сильная гроза с градом" },
};

export function getWeatherInfo(code: number): { emoji: string; description: string } {
	return WMO_CODES[code] || { emoji: "❓", description: "Неизвестно" };
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

	async forceFetch(): Promise<void> {
		this.cache = null;
		await this.fetchWeather();
	}

	async fetchWeather(): Promise<void> {
		if (this.cache && Date.now() - this.cache.timestamp < CACHE_TTL) {
			return;
		}

		try {
			const url = `https://api.open-meteo.com/v1/forecast?latitude=${this.settings.locationLatitude}&longitude=${this.settings.locationLongitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code&timezone=auto&forecast_days=2`;
			const data = await safeFetch<OpenMeteoResponse>(url);

			const current: CurrentWeather = {
				temperature: Math.round(data.current.temperature_2m),
				apparentTemperature: Math.round(data.current.apparent_temperature),
				weatherCode: data.current.weather_code,
				humidity: data.current.relative_humidity_2m,
				windSpeed: Math.round(data.current.wind_speed_10m),
			};

			const now = new Date();
			const currentHour = now.getHours();
			const hourly: HourlyForecastItem[] = [];

			const nowTs = now.getTime();
			for (let i = 0; i < data.hourly.time.length && hourly.length < 11; i++) {
				const hDate = new Date(data.hourly.time[i]);
				if (hDate.getTime() > nowTs) {
					const h = hDate.getHours();
					hourly.push({
						hour: String(h).padStart(2, "0") + ":00",
						temp: Math.round(data.hourly.temperature_2m[i]),
						weatherCode: data.hourly.weather_code[i],
					});
				}
			}

			this.cache = { timestamp: Date.now(), current, hourly };
			this.saveCache();
			this.eventBus.emit("weather:updated");
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
}
