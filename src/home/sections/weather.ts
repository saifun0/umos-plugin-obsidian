import { Notice } from "obsidian";
import { HomeViewContext } from "../types";
import { createElement } from "../../utils/dom";
import { getWeatherInfo } from "../../weather/WeatherService";
import { detectLocation } from "../../utils/api";

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
	createElement("span", { cls: "umos-home-weather-feels", text: `Ощущается ${current.apparentTemperature}°`, parent: temps });

	const right = createElement("div", { cls: "umos-home-weather-details", parent: card });
	createElement("span", { text: info.description, parent: right });
	const stats = createElement("div", { cls: "umos-home-weather-stats", parent: right });
	createElement("span", { text: `💧 ${current.humidity}%`, parent: stats });
	createElement("span", { text: `💨 ${current.windSpeed} км/ч`, parent: stats });

	if (ctx.settings.locationCity) {
		const cityRow = createElement("div", { cls: "umos-home-weather-city-row", parent: right });
		createElement("span", { cls: "umos-home-weather-city", text: ctx.settings.locationCity, parent: cityRow });
		const geoBtn = createElement("span", { cls: "umos-home-geo-btn", text: "📍", parent: cityRow });
		geoBtn.title = "Обновить местоположение";
		geoBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			updateGeolocation(ctx);
		});
	}

	// Hourly forecast
	const hourly = ctx.weatherService.getHourlyForecast();
	if (hourly.length > 0) {
		const scroll = createElement("div", {
			cls: "umos-home-weather-hourly",
			parent: section,
		});

		for (const h of hourly) {
			const item = createElement("div", { cls: "umos-home-weather-hour", parent: scroll });
			createElement("span", { cls: "umos-home-weather-hour-time", text: h.hour, parent: item });
			createElement("span", { cls: "umos-home-weather-hour-icon", text: getWeatherInfo(h.weatherCode).emoji, parent: item });
			createElement("span", { cls: "umos-home-weather-hour-temp", text: `${h.temp}°`, parent: item });
		}
	}
}

export async function updateGeolocation(ctx: HomeViewContext): Promise<void> {
	try {
		const geo = await detectLocation();
		ctx.settings.locationLatitude = Math.round(geo.latitude * 10000) / 10000;
		ctx.settings.locationLongitude = Math.round(geo.longitude * 10000) / 10000;
		ctx.settings.locationCity = geo.city || ctx.settings.locationCity;
		if (ctx.saveSettings) await ctx.saveSettings();
		ctx.eventBus.emit("location:updated");
		new Notice(`📍 Местоположение обновлено: ${ctx.settings.locationCity}`);
	} catch (err) {
		new Notice(`❌ Ошибка определения местоположения: ${(err as Error).message}`);
	}
}
