import { App, Notice, TFile, normalizePath } from "obsidian";
import { UmOSSettings } from "../settings/Settings";
import { EventBus } from "../EventBus";
import { ScheduleSlot } from "../settings/Settings";
import { formatDateISO, getTodayISO, getDayOfWeekIndex, getCurrentWeekType } from "../utils/date";

const DAY_NAMES_RU: Record<string, string> = {
	monday: "Понедельник",
	tuesday: "Вторник",
	wednesday: "Среда",
	thursday: "Четверг",
	friday: "Пятница",
	saturday: "Суббота",
	sunday: "Воскресенье",
};

const SLOT_TYPE_RU: Record<string, string> = {
	lecture: "Лекция",
	seminar: "Семинар",
	lab: "Лабораторная",
	laboratory: "Лабораторная",
	practice: "Практика",
	exam: "Экзамен",
};

export class DailyNoteEnhancer {
	constructor(
		private app: App,
		private getSettings: () => UmOSSettings,
		private eventBus: EventBus,
		private getDataStore: () => {
			schedule: {
				anchorDate: string;
				week1: Record<string, ScheduleSlot[]>;
				week2: Record<string, ScheduleSlot[]>;
			};
		}
	) {}

	async createDailyNote(dateISO?: string): Promise<void> {
		const date = dateISO || getTodayISO();
		const fileName = this.getFileName(date);
		const folderPath = normalizePath(this.getSettings().dailyNotesPath);
		const filePath = normalizePath(`${folderPath}/${fileName}.md`);

		const existing = this.app.vault.getAbstractFileByPath(filePath);
		if (existing instanceof TFile) {
			new Notice(`📝 Заметка на ${date} уже существует`);
			await this.openFile(existing);
			return;
		}

		await this.ensureFolder(folderPath);

		const content = this.generateContent(date);

		try {
			const file = await this.app.vault.create(filePath, content);
			new Notice(`✅ Дневная заметка на ${date} создана`);
			await this.openFile(file);
			this.eventBus.emit("daily:created", { path: filePath, date });
		} catch (err) {
			console.error("umOS: failed to create daily note:", err);
			new Notice(`❌ Ошибка создания заметки: ${String(err)}`);
		}
	}

	private getFileName(dateISO: string): string {
		const format = this.getSettings().dailyNoteFormat || "YYYY-MM-DD";
		return this.applyDateFormat(format, dateISO);
	}

	private applyDateFormat(format: string, dateISO: string): string {
		const parts = dateISO.split("-");
		if (parts.length !== 3) return dateISO;
		const [year, month, day] = parts;
		return format
			.replace("YYYY", year)
			.replace("MM", month)
			.replace("DD", day);
	}

	private async ensureFolder(folderPath: string): Promise<void> {
		const parts = folderPath.split("/").filter(Boolean);
		let current = "";
		for (const part of parts) {
			current = current ? `${current}/${part}` : part;
			const normalized = normalizePath(current);
			const existing = this.app.vault.getAbstractFileByPath(normalized);
			if (!existing) {
				try {
					await this.app.vault.createFolder(normalized);
				} catch {
					// папка может уже существовать
				}
			}
		}
	}

	private async openFile(file: TFile): Promise<void> {
		const leaf = this.app.workspace.getLeaf("tab");
		await leaf.openFile(file);
	}

	// ─── Content Generation ──────────────────

	private generateContent(dateISO: string): string {
		const sections: string[] = [];
		const settings = this.getSettings();

		sections.push(this.generateFrontmatter(dateISO));
		sections.push(this.generateTitle(dateISO));
		sections.push(this.generateNavSection());
		sections.push(this.generateWordOfDaySection(dateISO));

		if (settings.dailySections.prayers) {
			sections.push(this.generatePrayerSection());
		}

		if (settings.dailySections.ratings) {
			sections.push(this.generateRatingsSection());
		}

		if (settings.dailySections.habits) {
			sections.push(this.generateHabitsSection());
		}

		if (settings.dailySections.schedule) {
			const s = this.generateScheduleSection(dateISO);
			if (s) sections.push(s);
		}

		if (settings.dailySections.tasks) {
			sections.push(this.generateTasksSection());
		}

		if (settings.dailySections.notes) {
			sections.push(this.generateNotesSection());
		}

		return sections.join("\n");
	}

	private generateFrontmatter(dateISO: string): string {
		const lines = [
			"---",
			`date: ${dateISO}`,
			"type: daily",
			'word_of_day: ""',
			"mood: ",
			"productivity: ",
			"sleep: 0",
			"fajr: false",
			"dhuhr: false",
			"asr: false",
			"maghrib: false",
			"isha: false",
		];

		const settings = this.getSettings();
		if (settings.ramadanEnabled) {
			lines.push("fasting: false");
			lines.push("tarawih: false");
		}

		for (const h of settings.habits) {
			lines.push(`${h.id}: 0`);
		}

		lines.push("cssclasses:");
		lines.push("  - hide");
		lines.push("---", "");
		return lines.join("\n");
	}

	private generateTitle(dateISO: string): string {
		const dateObj = new Date(dateISO + "T00:00:00");
		const dayName = dateObj.toLocaleDateString("ru-RU", { weekday: "long" });
		const dayCapitalized = dayName.charAt(0).toUpperCase() + dayName.slice(1);
		const formatted = dateObj.toLocaleDateString("ru-RU", {
			day: "numeric",
			month: "long",
			year: "numeric",
		});

		return `# ${dayCapitalized}, ${formatted}\n\n`;
	}

	// ─── Навигация ──────────────────

	private generateNavSection(): string {
		return "```daily-nav\n```\n\n";
	}

	// ─── Слово дня ──────────────────

	private generateWordOfDaySection(_dateISO: string): string {
		return [
			"```word-of-day",
			"property: word_of_day",
			"```",
			"",
		].join("\n");
	}

	// ─── Намазы ──────────────────

	private generatePrayerSection(): string {
		return [
			"## Намазы",
			"",
			"```umos-input",
			"type: chips",
			`properties: ${this.arr(["fajr", "dhuhr", "asr", "maghrib", "isha"])}`,
			`labels: ${this.arr(["Фаджр", "Зухр", "Аср", "Магриб", "Иша"])}`,
			`icons: ${this.arr(["🌅", "☀️", "🌤️", "🌇", "🌙"])}`,
			`colors: ${this.arr(["#e67e22", "#f1c40f", "#3498db", "#e74c3c", "#9b59b6"])}`,
			"columns: 5",
			"```",
			"",
		].join("\n");
	}

	// ─── Оценка дня ──────────────────

	private generateRatingsSection(): string {
		return [
			"## Оценка дня",
			"",
			"```umos-input",
			"type: rating",
			"property: mood",
			"label: Настроение",
			"max: 5",
			"```",
			"",
			"```umos-input",
			"type: rating",
			"property: productivity",
			"label: Продуктивность",
			"max: 5",
			"icon: ●",
			"empty_icon: ○",
			"```",
			"",
			"```umos-input",
			"type: slider",
			"property: sleep",
			"label: Сон",
			"min: 0",
			"max: 14",
			"step: 1",
			"suffix: ч",
			"style: numeric",
			"```",
			"",
		].join("\n");
	}

	// ─── Привычки ──────────────────

	private generateHabitsSection(): string {
		const habits = this.getSettings().habits;
		if (habits.length === 0) return "";

		const properties = habits.map(h => h.id);
		const labels = habits.map(h => h.name);
		const icons = habits.map(h => h.icon);
		const mins = habits.map(() => 0);
		const maxes = habits.map(() => 999);
		const steps = habits.map(() => 1);

		const lines: string[] = [
			"## Привычки",
			"",
			"```umos-input",
			"type: numbers",
			`properties: ${this.arr(properties)}`,
			`labels: ${this.arr(labels)}`,
			`icons: ${this.arr(icons)}`,
			`mins: [${mins.join(", ")}]`,
			`maxes: [${maxes.join(", ")}]`,
			`steps: [${steps.join(", ")}]`,
			`columns: ${habits.length}`,
			"```",
			"",
		];

		return lines.join("\n");
	}

	// ─── Расписание ──────────────────

	private generateScheduleSection(dateISO: string): string | null {
		const dataStore = this.getDataStore();
		const schedule = dataStore.schedule;
		if (!schedule) return null;

		const anchorDate = this.getSettings().scheduleAnchorDate || schedule.anchorDate;
		if (!anchorDate) return null;

		const dateObj = new Date(dateISO + "T00:00:00");
		const dayIndex = getDayOfWeekIndex(dateObj);
		const dayKeys = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
		const dayKey = dayKeys[dayIndex];

		if (dayKey === "sunday") {
			return "## Расписание\n\n> Выходной\n\n";
		}

		const weekType = getCurrentWeekType(anchorDate, dateISO);
		const weekData = weekType === "week1" ? schedule.week1 : schedule.week2;

		if (!weekData?.[dayKey] || weekData[dayKey].length === 0) {
			return "## Расписание\n\n> Нет пар\n\n";
		}

		const slots: ScheduleSlot[] = weekData[dayKey]
			.filter((s: ScheduleSlot) => s.subject && s.subject.trim() !== "")
			.sort((a: ScheduleSlot, b: ScheduleSlot) => a.startTime.localeCompare(b.startTime));

		if (slots.length === 0) {
			return "## Расписание\n\n> Нет пар\n\n";
		}

		const dayNameRu = DAY_NAMES_RU[dayKey] || dayKey;
		const weekLabel = weekType === "week1" ? "нед. 1" : "нед. 2";

		const lines: string[] = [
			`## Расписание — ${dayNameRu} (${weekLabel})`,
			"",
		];

		for (const slot of slots) {
			const typeRu = SLOT_TYPE_RU[slot.type] || slot.type;
			const parts = [`\`${slot.startTime}–${slot.endTime}\``, `**${slot.subject}**`, `*${typeRu}*`];
			if (slot.room) parts.push(`📍 ${slot.room}`);
			lines.push(`- ${parts.join("  ")}`);
		}

		lines.push("");
		return lines.join("\n");
	}

	// ─── Задачи ──────────────────

	private generateTasksSection(): string {
		return "## Задачи\n\n\n\n";
	}

	// ─── Заметки ──────────────────

	private generateNotesSection(): string {
		return "## Заметки\n\n\n\n";
	}

	// ─── Helpers ──────────────────

	private arr(values: string[]): string {
		return `[${values.map(v => `"${v.replace(/"/g, '\\"')}"`).join(", ")}]`;
	}
}
