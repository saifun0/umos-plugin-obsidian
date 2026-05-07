import { App, Modal } from "obsidian";
import { PrayerService, type PrayerRefreshResult, type PrayerSnapshot } from "../religion/prayer/PrayerService";
import {
	getWeatherInfo,
	type DailyForecastItem,
	type HourlyForecastItem,
	type WeatherRefreshResult,
	type WeatherSnapshot,
} from "../weather/WeatherService";

export interface ApiRefreshResults {
	weather: WeatherRefreshResult | null;
	prayer: PrayerRefreshResult | null;
}

interface ApiRefreshModalOptions {
	city?: string;
	latitude: number;
	longitude: number;
	prayerMethod: number;
}

export class ApiRefreshModal extends Modal {
	constructor(
		app: App,
		private results: ApiRefreshResults,
		private options: ApiRefreshModalOptions
	) {
		super(app);
	}

	onOpen(): void {
		this.modalEl.addClass("umos-weather-api-modal");
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("umos-weather-api-content");

		const status = this.getOverallStatus();
		const header = contentEl.createDiv({ cls: "umos-weather-api-header" });
		const title = header.createDiv({ cls: "umos-weather-api-title" });
		title.createEl("span", { cls: "umos-weather-api-title-icon", text: "↻" });
		const titleText = title.createDiv();
		titleText.createEl("h2", { text: "API Refresh" });
		titleText.createEl("p", { text: "Force-refresh all umOS API data" });
		header.createEl("span", {
			cls: `umos-weather-api-status ${status.className}`,
			text: status.label,
		});

		this.renderSourceOverview(contentEl);
		this.renderWeather(contentEl, this.results.weather);
		this.renderPrayer(contentEl, this.results.prayer);
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private getOverallStatus(): { className: string; label: string } {
		const entries = [this.results.weather, this.results.prayer];
		if (entries.every((entry) => entry?.ok)) return { className: "is-ok", label: "Updated" };
		if (entries.some((entry) => entry?.ok)) return { className: "is-warn", label: "Partial" };
		return { className: "is-error", label: "Error" };
	}

	private renderSourceOverview(parent: HTMLElement): void {
		const meta = parent.createDiv({ cls: "umos-weather-api-meta" });
		this.renderMetric(meta, "Weather", this.statusText(this.results.weather));
		this.renderMetric(meta, "Prayers", this.statusText(this.results.prayer));
		this.renderMetric(meta, "Location", this.formatLocation());
		this.renderMetric(meta, "Prayer method", `${this.options.prayerMethod}`);
	}

	private renderWeather(parent: HTMLElement, result: WeatherRefreshResult | null): void {
		const section = parent.createDiv({ cls: "umos-weather-api-section" });
		section.createEl("h3", { text: "Weather · Open-Meteo" });

		if (!result) {
			this.renderError(section, "WeatherService is not initialized", null);
			return;
		}
		if (!result.ok) {
			this.renderError(section, result.error ?? "Could not update weather", result.snapshot ? "The latest saved cache is shown below." : null);
		}
		if (!result.snapshot) return;

		this.renderWeatherSnapshot(section, result.snapshot);
	}

	private renderWeatherSnapshot(parent: HTMLElement, snapshot: WeatherSnapshot): void {
		const currentInfo = getWeatherInfo(snapshot.current.weatherCode);
		const current = parent.createDiv({ cls: "umos-weather-api-current" });
		current.createEl("span", { cls: "umos-weather-api-current-icon", text: currentInfo.emoji });
		const currentMain = current.createDiv({ cls: "umos-weather-api-current-main" });
		currentMain.createEl("strong", { text: `${snapshot.current.temperature}°` });
		currentMain.createEl("span", { text: currentInfo.description });
		const currentStats = current.createDiv({ cls: "umos-weather-api-current-stats" });
		this.renderMetric(currentStats, "Updated", formatDateTime(snapshot.updatedAt));
		this.renderMetric(currentStats, "Feels like", `${snapshot.current.apparentTemperature}°`);
		this.renderMetric(currentStats, "Wind", `${snapshot.current.windSpeed} km/h`);

		this.renderHourly(parent, snapshot.hourly);
		this.renderDaily(parent, snapshot.daily);
	}

	private renderHourly(parent: HTMLElement, hourly: HourlyForecastItem[]): void {
		const section = parent.createDiv({ cls: "umos-weather-api-subsection" });
		section.createEl("h4", { text: `Next Hours · ${hourly.length}` });
		const list = section.createDiv({ cls: "umos-weather-api-hourly" });
		for (const item of hourly) {
			const info = getWeatherInfo(item.weatherCode);
			const row = list.createDiv({ cls: "umos-weather-api-hour" });
			row.createEl("span", { cls: "umos-weather-api-hour-time", text: item.hour });
			row.createEl("span", { cls: "umos-weather-api-hour-icon", text: info.emoji });
			row.createEl("strong", { text: `${item.temp}°` });
		}
	}

	private renderDaily(parent: HTMLElement, daily: DailyForecastItem[]): void {
		const section = parent.createDiv({ cls: "umos-weather-api-subsection" });
		section.createEl("h4", { text: `Day / night · ${daily.length}` });
		const grid = section.createDiv({ cls: "umos-weather-api-daily" });
		for (const item of daily) {
			const card = grid.createDiv({ cls: "umos-weather-api-day" });
			const head = card.createDiv({ cls: "umos-weather-api-day-head" });
			head.createEl("strong", { text: item.label });
			head.createEl("span", { text: formatShortDate(item.date) });
			this.renderDailyPart(card, "day", "Day", item.dayTemp, item.dayWeatherCode);
			this.renderDailyPart(card, "night", "Night", item.nightTemp, item.nightWeatherCode);
		}
	}

	private renderPrayer(parent: HTMLElement, result: PrayerRefreshResult | null): void {
		const section = parent.createDiv({ cls: "umos-weather-api-section" });
		section.createEl("h3", { text: "Prayers · Aladhan" });

		if (!result) {
			this.renderError(section, "PrayerService is not initialized", null);
			return;
		}
		if (!result.ok) {
			this.renderError(section, result.error ?? "Could not update prayers", result.snapshot ? "The latest saved cache is shown below." : null);
		}
		if (!result.snapshot) return;

		this.renderPrayerSnapshot(section, result.snapshot);
	}

	private renderPrayerSnapshot(parent: HTMLElement, snapshot: PrayerSnapshot): void {
		const meta = parent.createDiv({ cls: "umos-weather-api-meta" });
		this.renderMetric(meta, "Updated", formatDateTime(snapshot.fetchedAt));
		this.renderMetric(meta, "Gregorian", snapshot.gregorianDate);
		this.renderMetric(meta, "Hijri", snapshot.hijriDate);
		this.renderMetric(meta, "Cache Date", snapshot.date);

		const list = parent.createDiv({ cls: "umos-weather-api-prayer-list" });
		for (const name of PrayerService.getPrayerOrder()) {
			const row = list.createDiv({ cls: "umos-weather-api-prayer" });
			const label = row.createDiv({ cls: "umos-weather-api-prayer-label" });
			label.createEl("span", { text: PrayerService.getPrayerIcon(name) });
			label.createEl("strong", { text: PrayerService.getPrayerNameRu(name) });
			row.createEl("span", { text: snapshot.times[name] ?? "—" });
		}
	}

	private renderDailyPart(parent: HTMLElement, kind: "day" | "night", label: string, temp: number, code: number): void {
		const info = getWeatherInfo(code);
		const row = parent.createDiv({ cls: `umos-weather-api-day-part is-${kind}` });
		const left = row.createDiv({ cls: "umos-weather-api-day-part-label" });
		left.createEl("span", { text: info.emoji });
		left.createEl("span", { text: label });
		row.createEl("strong", { text: `${temp}°` });
	}

	private renderError(parent: HTMLElement, message: string, hint: string | null): void {
		const error = parent.createDiv({ cls: "umos-weather-api-error" });
		error.createEl("strong", { text: message });
		if (hint) error.createEl("small", { text: hint });
	}

	private renderMetric(parent: HTMLElement, label: string, value: string): void {
		const item = parent.createDiv({ cls: "umos-weather-api-metric" });
		item.createEl("span", { text: label });
		item.createEl("strong", { text: value });
	}

	private statusText(result: { ok: boolean } | null): string {
		if (!result) return "no service";
		return result.ok ? "updated" : "error";
	}

	private formatLocation(): string {
		const city = this.options.city?.trim();
		const coords = `${this.options.latitude.toFixed(4)}, ${this.options.longitude.toFixed(4)}`;
		return city ? `${city} · ${coords}` : coords;
	}
}

function formatDateTime(timestamp: number): string {
	return new Date(timestamp).toLocaleString("en-US", {
		day: "2-digit",
		month: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function formatShortDate(date: string): string {
	const [, month, day] = date.split("-");
	return month && day ? `${day}.${month}` : date;
}
