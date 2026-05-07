import { Notice } from "obsidian";
import { HomeViewContext } from "../types";
import { createElement } from "../../utils/dom";
import {
	getWeatherInfo,
	type DailyForecastItem,
	type HourlyForecastItem,
} from "../../weather/WeatherService";
import { detectLocation } from "../../utils/api";

type WeatherForecastMode = "hourly" | "daily";

let weatherForecastMode: WeatherForecastMode = "hourly";

export function renderWeatherSection(parent: HTMLElement, ctx: HomeViewContext): void {
	if (!ctx.weatherService) return;

	const current = ctx.weatherService.getCurrentWeather();
	if (!current) return;

	const section = createElement("div", {
		cls: "umos-home-section umos-home-section-anim",
		parent,
	});

	const info = getWeatherInfo(current.weatherCode);

	// Current weather card
	const card = createElement("div", {
		cls: "umos-home-weather-current",
		parent: section,
	});

	const left = createElement("div", { cls: "umos-home-weather-main", parent: card });
	createElement("span", { cls: "umos-home-weather-icon", text: info.emoji, parent: left });
	const temps = createElement("div", { cls: "umos-home-weather-temps", parent: left });
	createElement("span", { cls: "umos-home-weather-temp", text: `${current.temperature}°`, parent: temps });
	createElement("span", { cls: "umos-home-weather-feels", text: `Feels like ${current.apparentTemperature}°`, parent: temps });

	const right = createElement("div", { cls: "umos-home-weather-details", parent: card });
	createElement("span", { text: info.description, parent: right });
	const stats = createElement("div", { cls: "umos-home-weather-stats", parent: right });
	createElement("span", { text: `💧 ${current.humidity}%`, parent: stats });
	createElement("span", { text: `💨 ${current.windSpeed} km/h`, parent: stats });

	if (ctx.settings.locationCity) {
		const cityRow = createElement("div", { cls: "umos-home-weather-city-row", parent: right });
		createElement("span", { cls: "umos-home-weather-city", text: ctx.settings.locationCity, parent: cityRow });
		const geoBtn = createElement("span", { cls: "umos-home-geo-btn", text: "📍", parent: cityRow });
		geoBtn.title = "Update location";
		geoBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			updateGeolocation(ctx);
		});
	}

	const hourly = ctx.weatherService.getHourlyForecast();
	const daily = ctx.weatherService.getDailyForecast();
	if (hourly.length > 0 || daily.length > 0) {
		const toggleHost = createElement("div", { cls: "umos-home-weather-mode-host", parent: right });
		const content = createElement("div", {
			cls: "umos-home-weather-forecast",
			parent: section,
		});
		renderForecast(toggleHost, content, hourly, daily);
	}
}

function renderForecast(
	toggleParent: HTMLElement,
	content: HTMLElement,
	hourly: HourlyForecastItem[],
	daily: DailyForecastItem[]
): void {
	const toggle = createElement("div", {
		cls: "umos-home-weather-mode-toggle",
		attr: { role: "group", "aria-label": "Weather forecast mode" },
		parent: toggleParent,
	});
	const hourlyBtn = createElement("button", {
		cls: "umos-home-weather-mode-btn",
		text: "Hourly",
		attr: { type: "button", "aria-pressed": "false" },
		parent: toggle,
	});
	const dailyBtn = createElement("button", {
		cls: "umos-home-weather-mode-btn",
		text: "Day / night",
		attr: { type: "button", "aria-pressed": "false" },
		parent: toggle,
	});

	hourlyBtn.disabled = hourly.length === 0;
	dailyBtn.disabled = daily.length === 0;
	hourlyBtn.title = "Hourly forecast";
	dailyBtn.title = daily.length > 0 ? "Daily forecast" : "Daily forecast will update after weather loads";

	const setMode = (requestedMode: WeatherForecastMode): void => {
		let nextMode = requestedMode;
		if (nextMode === "daily" && daily.length === 0) nextMode = "hourly";
		if (nextMode === "hourly" && hourly.length === 0 && daily.length > 0) nextMode = "daily";

		weatherForecastMode = nextMode;
		hourlyBtn.classList.toggle("is-active", nextMode === "hourly");
		dailyBtn.classList.toggle("is-active", nextMode === "daily");
		hourlyBtn.setAttribute("aria-pressed", String(nextMode === "hourly"));
		dailyBtn.setAttribute("aria-pressed", String(nextMode === "daily"));
		content.replaceChildren();
		renderForecastContent(content, nextMode, hourly, daily);
	};

	hourlyBtn.addEventListener("click", () => setMode("hourly"));
	dailyBtn.addEventListener("click", () => setMode("daily"));
	setMode(weatherForecastMode);
}

function renderForecastContent(
	parent: HTMLElement,
	mode: WeatherForecastMode,
	hourly: HourlyForecastItem[],
	daily: DailyForecastItem[]
): void {
	if (mode === "daily") {
		renderDailyForecast(parent, daily);
		return;
	}
	renderHourlyForecast(parent, hourly);
}

function renderHourlyForecast(parent: HTMLElement, hourly: HourlyForecastItem[]): void {
	const scroll = createElement("div", {
		cls: "umos-home-weather-hourly",
		parent,
	});

	for (const h of hourly) {
		const item = createElement("div", { cls: "umos-home-weather-hour", parent: scroll });
		createElement("span", { cls: "umos-home-weather-hour-time", text: h.hour, parent: item });
		createElement("span", { cls: "umos-home-weather-hour-icon", text: getWeatherInfo(h.weatherCode).emoji, parent: item });
		createElement("span", { cls: "umos-home-weather-hour-temp", text: `${h.temp}°`, parent: item });
	}
}

function renderDailyForecast(parent: HTMLElement, daily: DailyForecastItem[]): void {
	const grid = createElement("div", {
		cls: "umos-home-weather-daily",
		parent,
	});

	for (const day of daily) {
		const item = createElement("div", { cls: "umos-home-weather-day", parent: grid });
		const head = createElement("div", { cls: "umos-home-weather-day-head", parent: item });
		createElement("span", { cls: "umos-home-weather-day-label", text: day.label, parent: head });
		createElement("span", { cls: "umos-home-weather-day-date", text: formatWeatherDayDate(day.date), parent: head });

		const parts = createElement("div", { cls: "umos-home-weather-day-parts", parent: item });
		renderDailyPart(parts, "day", "Day", day.dayTemp, day.dayWeatherCode);
		renderDailyPart(parts, "night", "Night", day.nightTemp, day.nightWeatherCode);
	}
}

function renderDailyPart(
	parent: HTMLElement,
	kind: "day" | "night",
	label: string,
	temp: number,
	weatherCode: number
): void {
	const row = createElement("div", {
		cls: `umos-home-weather-day-part is-${kind}`,
		parent,
	});
	const meta = createElement("div", { cls: "umos-home-weather-day-part-meta", parent: row });
	createElement("span", { cls: "umos-home-weather-day-part-icon", text: getWeatherInfo(weatherCode).emoji, parent: meta });
	createElement("span", { cls: "umos-home-weather-day-part-label", text: label, parent: meta });
	createElement("span", { cls: "umos-home-weather-day-part-temp", text: `${temp}°`, parent: row });
}

function formatWeatherDayDate(date: string): string {
	const [, month, day] = date.split("-");
	return month && day ? `${day}.${month}` : date;
}

export async function updateGeolocation(ctx: HomeViewContext): Promise<void> {
	try {
		const geo = await detectLocation();
		ctx.settings.locationLatitude = Math.round(geo.latitude * 10000) / 10000;
		ctx.settings.locationLongitude = Math.round(geo.longitude * 10000) / 10000;
		ctx.settings.locationCity = geo.city || ctx.settings.locationCity;
		if (ctx.saveSettings) await ctx.saveSettings();
		ctx.eventBus.emit("location:updated");
		new Notice(`📍 Location updated: ${ctx.settings.locationCity}`);
	} catch (err) {
		new Notice(`❌ Location lookup failed: ${(err as Error).message}`);
	}
}
