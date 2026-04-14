import { App, TFile, TFolder, CachedMetadata, normalizePath } from "obsidian";
import { EventBus } from "../EventBus";
import { UmOSSettings } from "../settings/Settings";
import { formatDate, getTodayInTimezone } from "../utils/date";

export interface MetricData {
	date: string;
	value: number;
}

export interface StatsResult {
	metric: string;
	data: MetricData[];
	avg: number;
	min: number;
	max: number;
	sum: number;
	count: number;
	streak: number;
}

export class StatsEngine {
	private app: App;
	private eventBus: EventBus;
	private settings: UmOSSettings;
	private cache: Map<string, Map<string, unknown>> = new Map();

	constructor(app: App, eventBus: EventBus, settings: UmOSSettings) {
		this.app = app;
		this.eventBus = eventBus;
		this.settings = settings;
	}

	/**
	 * Инициализация: первичный скан + подписка на изменения.
	 */
	init(registerEvent: (ref: ReturnType<typeof this.app.metadataCache.on>) => void): void {
		// On mobile, metadata cache may not be ready yet at plugin load.
		// Wait for "resolved" event before scanning to ensure frontmatter is available.
		const mc = this.app.metadataCache as any;
		if (mc.resolved) {
			this.scanAllDailyNotes();
		} else {
			registerEvent(
				this.app.metadataCache.on("resolved", () => {
					this.scanAllDailyNotes();
					this.eventBus.emit("stats:recalculated", { period: 0 });
				})
			);
		}

		registerEvent(
			this.app.metadataCache.on("changed", (file) => {
				if (this.isDailyNote(file)) {
					this.updateFileCache(file);
					this.eventBus.emit("stats:recalculated", { period: 0 });
				}
			})
		);

		registerEvent(
			this.app.vault.on("create", (file) => {
				if (file instanceof TFile && this.isDailyNote(file)) {
					this.updateFileCache(file);
				}
			})
		);

		registerEvent(
			this.app.vault.on("delete", (file) => {
				if (file instanceof TFile) {
					this.cache.delete(file.path);
				}
			})
		);

		this.eventBus.on("frontmatter:changed", (data) => {
			const file = this.app.vault.getAbstractFileByPath(data.path);
			if (file instanceof TFile && this.isDailyNote(file)) {
				const fileCache = this.cache.get(file.path) || new Map<string, unknown>();
				fileCache.set(data.property, data.value);
				this.cache.set(file.path, fileCache);
			}
		});
	}

	/**
	 * Получает данные метрики за период (дней назад от сегодня).
	 */
	getMetricData(metric: string, periodDays: number): StatsResult {
		const today = getTodayInTimezone();
		const data: MetricData[] = [];

		for (let i = periodDays - 1; i >= 0; i--) {
			const date = new Date(today);
			date.setDate(date.getDate() - i);
			const dateStr = formatDate(date);
			const value = this.getValueForDate(dateStr, metric);

			if (value !== null) {
				data.push({ date: dateStr, value });
			}
		}

		const values = data.map((d) => d.value);
		const sum = values.reduce((a, b) => a + b, 0);
		const avg = values.length > 0 ? sum / values.length : 0;
		const min = values.length > 0 ? Math.min(...values) : 0;
		const max = values.length > 0 ? Math.max(...values) : 0;
		const streak = this.calculateStreak(metric);

		return {
			metric,
			data,
			avg: Math.round(avg * 100) / 100,
			min,
			max,
			sum,
			count: values.length,
			streak,
		};
	}

	/**
	 * Получает prayer_count — количество отмеченных намазов за дату.
	 */
	getPrayerCountForDate(dateStr: string): number {
		const prayers = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
		let count = 0;

		for (const prayer of prayers) {
			const val = this.getValueForDate(dateStr, prayer);
			if (val === 1) count++;
		}

		return count;
	}

	/**
	 * Возвращает сырое значение метрики для конкретной даты.
	 */
	getValueForDate(dateStr: string, metric: string): number | null {
		// Специальная метрика prayer_count
		if (metric === "prayer_count") {
			return this.getPrayerCountForDate(dateStr);
		}

		// Ищем файл по дате
		const filePath = this.dateToFilePath(dateStr);
		const fileCache = this.cache.get(filePath);

		if (!fileCache) return null;

		const value = fileCache.get(metric);
		if (value === undefined || value === null || value === "") return null;

		if (typeof value === "boolean") return value ? 1 : 0;
		if (typeof value === "number") return value;

		const num = Number(value);
		return isNaN(num) ? null : num;
	}

	/**
	 * Получает текстовые данные метрики за период (для нечисловых полей вроде word_of_day).
	 */
	getTextDataForPeriod(metric: string, periodDays: number): { date: string; value: string }[] {
		const today = getTodayInTimezone();
		const result: { date: string; value: string }[] = [];

		for (let i = periodDays - 1; i >= 0; i--) {
			const date = new Date(today);
			date.setDate(date.getDate() - i);
			const dateStr = formatDate(date);
			const filePath = this.dateToFilePath(dateStr);
			const fileCache = this.cache.get(filePath);
			if (!fileCache) continue;
			const value = fileCache.get(metric);
			if (value && typeof value === "string" && value.trim()) {
				result.push({ date: dateStr, value: value.trim() });
			}
		}

		return result;
	}

	/**
	 * Получает все значения frontmatter для даты.
	 */
	getAllValuesForDate(dateStr: string): Record<string, unknown> {
		const filePath = this.dateToFilePath(dateStr);
		const fileCache = this.cache.get(filePath);

		if (!fileCache) return {};

		const result: Record<string, unknown> = {};
		fileCache.forEach((value, key) => {
			result[key] = value;
		});
		return result;
	}

	/**
	 * Вычисляет streak — последовательные дни с заполненной метрикой.
	 */
	private calculateStreak(metric: string): number {
		const today = getTodayInTimezone();
		let streak = 0;

		for (let i = 0; i < 365; i++) {
			const date = new Date(today);
			date.setDate(date.getDate() - i);
			const dateStr = formatDate(date);
			const value = this.getValueForDate(dateStr, metric);

			if (value !== null && value > 0) {
				streak++;
			} else {
				break;
			}
		}

		return streak;
	}

	// ─── Внутренние методы ──────────────────────

	private scanAllDailyNotes(): void {
		const folderPath = normalizePath(this.settings.dailyNotesPath);
		const folder = this.app.vault.getAbstractFileByPath(folderPath);

		if (!(folder instanceof TFolder)) {
			return;
		}

		const files = folder.children.filter(
			(f): f is TFile => f instanceof TFile && f.extension === "md"
		);

		for (const file of files) {
			this.updateFileCache(file);
		}
	}

	private updateFileCache(file: TFile): void {
		const metadata = this.app.metadataCache.getFileCache(file);
		if (!metadata?.frontmatter) return;

		const fm = metadata.frontmatter;
		const map = new Map<string, unknown>();

		for (const key of Object.keys(fm)) {
			if (key === "position") continue;
			map.set(key, fm[key]);
		}

		this.cache.set(file.path, map);
	}

	private isDailyNote(file: TFile): boolean {
		const folder = normalizePath(this.settings.dailyNotesPath);
		return file.path.startsWith(folder) && file.extension === "md";
	}

	private dateToFilePath(dateStr: string): string {
		const fileName = this.formatDailyFileName(dateStr);
		return normalizePath(`${this.settings.dailyNotesPath}/${fileName}.md`);
	}

	private formatDailyFileName(dateISO: string): string {
		const parts = dateISO.split("-");
		if (parts.length !== 3) return dateISO;
		const [year, month, day] = parts;
		const format = this.settings.dailyNoteFormat || "YYYY-MM-DD";
		return format.replace("YYYY", year).replace("MM", month).replace("DD", day);
	}
}
