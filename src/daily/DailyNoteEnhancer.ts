import { App, Notice, TFile, normalizePath } from "obsidian";
import { UmOSSettings, ScheduleSlot } from "../settings/Settings";
import { EventBus } from "../EventBus";
import { getTodayISO, getDayOfWeekIndex, getCurrentWeekType } from "../utils/date";
import { getLocale, t } from "../i18n";

const DAY_NAMES_RU: Record<string, string> = {
	monday: "Monday",
	tuesday: "Tuesday",
	wednesday: "Wednesday",
	thursday: "Thursday",
	friday: "Friday",
	saturday: "Saturday",
	sunday: "Sunday",
};

const SLOT_TYPE_RU: Record<string, string> = {
	lecture: "Lecture",
	seminar: "Seminar",
	lab: "Lab",
	laboratory: "Lab",
	practice: "Practice",
	exam: "Exam",
};

interface EnsureDailyNoteOptions {
	open?: boolean;
	notify?: boolean;
}

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
		await this.ensureDailyNote(dateISO, { open: true, notify: true });
	}

	async ensureDailyNote(dateISO?: string, options: EnsureDailyNoteOptions = {}): Promise<TFile | null> {
		const open = options.open ?? false;
		const notify = options.notify ?? false;
		const date = dateISO || getTodayISO();
		const fileName = this.getFileName(date);
		const folderPath = normalizePath(this.getSettings().dailyNotesPath);
		const filePath = normalizePath(`${folderPath}/${fileName}.md`);

		const existing = this.app.vault.getAbstractFileByPath(filePath);
		if (existing instanceof TFile) {
			if (notify) new Notice(t(`📝 Note for ${date} already exists`));
			if (open) await this.openFile(existing);
			return existing;
		}

		await this.ensureFolder(folderPath);

		const content = this.generateContent(date);

		try {
			const file = await this.app.vault.create(filePath, content);
			if (notify) new Notice(t(`✅ Daily note for ${date} created`));
			if (open) await this.openFile(file);
			this.eventBus.emit("daily:created", { path: filePath, date });
			return file;
		} catch (err) {
			console.error("umOS: failed to create daily note:", err);
			if (notify) new Notice(t(`❌ Failed to create note: ${String(err)}`));
			return null;
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
					// folder may already exist
				}
			}
		}
	}

	private async openFile(file: TFile): Promise<void> {
		const leaf = this.app.workspace.getLeaf("tab");
		await leaf.openFile(file);
	}

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
			const section = this.generateScheduleSection(dateISO);
			if (section) sections.push(section);
		}

		if (settings.dailySections.tasks) {
			sections.push(this.generateTasksSection());
		}

		if (settings.dailySections.review) {
			sections.push(this.generateReviewSection());
		}

		if (settings.dailySections.notes) {
			sections.push(this.generateNotesSection());
		}

		return sections.join("\n");
	}

	private generateFrontmatter(dateISO: string): string {
		const settings = this.getSettings();
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

		for (const habit of settings.habits) {
			lines.push(`${habit.id}: 0`);
		}

		lines.push(
			"cssclasses:",
			"  - hide",
			"---",
			"",
		);

		return lines.join("\n");
	}

	private generateTitle(dateISO: string): string {
		const dateObj = new Date(`${dateISO}T00:00:00`);
		const dayName = dateObj.toLocaleDateString(getLocale(), { weekday: "long" });
		const dayCapitalized = dayName.charAt(0).toUpperCase() + dayName.slice(1);
		const formatted = dateObj.toLocaleDateString(getLocale(), {
			day: "numeric",
			month: "long",
			year: "numeric",
		});

		return `# ${dayCapitalized}, ${formatted}\n\n`;
	}

	private generateNavSection(): string {
		return "```daily-nav\n```\n\n";
	}

	private generateWordOfDaySection(_dateISO: string): string {
		return [
			"```word-of-day",
			"property: word_of_day",
			"```",
			"",
		].join("\n");
	}

	private generatePrayerSection(): string {
		return [
			t("## Prayers"),
			"",
			"```umos-input",
			"type: chips",
			`properties: ${this.arr(["fajr", "dhuhr", "asr", "maghrib", "isha"])}`,
			`labels: ${this.arr(["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"].map((name) => t(name)))}`,
			`icons: ${this.arr(["🌅", "☀️", "🌤️", "🌇", "🌙"])}`,
			`colors: ${this.arr(["#e67e22", "#f1c40f", "#3498db", "#e74c3c", "#9b59b6"])}`,
			"columns: 5",
			"```",
			"",
		].join("\n");
	}

	private generateRatingsSection(): string {
		return [
			t("## Daily Rating"),
			"",
			"```umos-input",
			"type: rating",
			"property: mood",
			`label: ${t("Mood")}`,
			"max: 5",
			"```",
			"",
			"```umos-input",
			"type: rating",
			"property: productivity",
			`label: ${t("Productivity")}`,
			"max: 5",
			"icon: ●",
			"empty_icon: ○",
			"```",
			"",
			"```umos-input",
			"type: slider",
			"property: sleep",
			`label: ${t("Sleep")}`,
			"min: 0",
			"max: 14",
			"step: 1",
			"suffix: h",
			"style: numeric",
			"```",
			"",
		].join("\n");
	}

	private generateHabitsSection(): string {
		const habits = this.getSettings().habits;
		if (habits.length === 0) return "";

		return [
			t("## Habits"),
			"",
			"```umos-input",
			"type: numbers",
			`properties: ${this.arr(habits.map(habit => habit.id))}`,
			`labels: ${this.arr(habits.map(habit => habit.name))}`,
			`icons: ${this.arr(habits.map(habit => habit.icon))}`,
			`mins: [${habits.map(() => 0).join(", ")}]`,
			`maxes: [${habits.map(() => 999).join(", ")}]`,
			`steps: [${habits.map(() => 1).join(", ")}]`,
			`columns: ${habits.length}`,
			"```",
			"",
		].join("\n");
	}

	private generateScheduleSection(dateISO: string): string | null {
		const dataStore = this.getDataStore();
		const schedule = dataStore.schedule;
		if (!schedule) return null;

		const anchorDate = this.getSettings().scheduleAnchorDate || schedule.anchorDate;
		if (!anchorDate) return null;

		const dateObj = new Date(`${dateISO}T00:00:00`);
		const dayIndex = getDayOfWeekIndex(dateObj);
		const dayKeys = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
		const dayKey = dayKeys[dayIndex];

		if (dayKey === "sunday") {
			return t("## Schedule\n\n> Day off\n\n");
		}

		const weekType = getCurrentWeekType(anchorDate, dateISO);
		const weekData = weekType === "week1" ? schedule.week1 : schedule.week2;

		if (!weekData?.[dayKey] || weekData[dayKey].length === 0) {
			return t("## Schedule\n\n> No classes\n\n");
		}

		const slots: ScheduleSlot[] = weekData[dayKey]
			.filter((slot: ScheduleSlot) => slot.subject && slot.subject.trim() !== "")
			.sort((a: ScheduleSlot, b: ScheduleSlot) => a.startTime.localeCompare(b.startTime));

		if (slots.length === 0) {
			return t("## Schedule\n\n> No classes\n\n");
		}

		const dayNameRu = DAY_NAMES_RU[dayKey] || dayKey;
		const weekLabel = weekType === "week1" ? t("week 1") : t("week 2");

		const lines: string[] = [
			`${t("## Schedule")} — ${t(dayNameRu)} (${weekLabel})`,
			"",
		];

		for (const slot of slots) {
			const typeRu = t(SLOT_TYPE_RU[slot.type] || slot.type);
			const parts = [`\`${slot.startTime}–${slot.endTime}\``, `**${slot.subject}**`, `*${typeRu}*`];
			if (slot.room) parts.push(`📌 ${slot.room}`);
			lines.push(`- ${parts.join("  ")}`);
		}

		lines.push("");
		return lines.join("\n");
	}

	private generateTasksSection(): string {
		return t("## Tasks\n\n\n\n");
	}

	private generateReviewSection(): string {
		return [
			t("## Review"),
			"",
			"```daily-review",
			"mode: daily",
			"```",
			"",
		].join("\n");
	}

	private generateNotesSection(): string {
		return t("## Notes\n\n\n\n");
	}

	private arr(values: string[]): string {
		return `[${values.map(v => `"${v.replace(/"/g, '\\"')}"`).join(", ")}]`;
	}
}
