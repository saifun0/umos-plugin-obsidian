import { App, TFile } from "obsidian";
import { BaseWidget } from "../core/BaseWidget";
import { UmOSSettings } from "../settings/Settings";
import { createElement } from "../utils/dom";

export class DailyNavWidget extends BaseWidget {
	private obsidianApp: App;
	private settings: UmOSSettings;
	private createDailyNote: (dateISO: string) => Promise<void>;

	constructor(
		containerEl: HTMLElement,
		app: App,
		settings: UmOSSettings,
		createDailyNote: (dateISO: string) => Promise<void>
	) {
		super(containerEl);
		this.obsidianApp = app;
		this.settings = settings;
		this.createDailyNote = createDailyNote;
	}

	protected render(): void {
		this.containerEl.empty();

		const currentDate = this.getCurrentDate();
		if (!currentDate) return;

		const wrapper = createElement("div", {
			cls: "umos-daily-nav",
			parent: this.containerEl,
		});

		// ← Назад
		const prevBtn = createElement("button", {
			cls: "umos-daily-nav-btn",
			text: "← Вчера",
			parent: wrapper,
		});
		prevBtn.addEventListener("click", () => {
			const prev = this.shiftDate(currentDate, -1);
			this.navigateTo(prev);
		});

		// Текущая дата
		const dateObj = new Date(currentDate + "T00:00:00");
		const dayName = dateObj.toLocaleDateString("ru-RU", { weekday: "short" });
		const formatted = dateObj.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });

		createElement("span", {
			cls: "umos-daily-nav-date",
			text: `${dayName}, ${formatted}`,
			parent: wrapper,
		});

		// → Вперёд
		const nextBtn = createElement("button", {
			cls: "umos-daily-nav-btn",
			text: "Завтра →",
			parent: wrapper,
		});
		nextBtn.addEventListener("click", () => {
			const next = this.shiftDate(currentDate, 1);
			this.navigateTo(next);
		});
	}

	private getCurrentDate(): string | null {
		const file = this.obsidianApp.workspace.getActiveFile();
		if (!file) return null;

		const cache = this.obsidianApp.metadataCache.getFileCache(file);
		const fmDate = cache?.frontmatter?.date;
		if (fmDate) {
			const str = fmDate instanceof Date
				? this.formatISO(fmDate)
				: String(fmDate).trim().slice(0, 10);
			if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
		}

		// Попробуем извлечь из имени файла
		const match = file.basename.match(/(\d{4})-(\d{2})-(\d{2})/);
		if (match) return `${match[1]}-${match[2]}-${match[3]}`;

		return null;
	}

	private shiftDate(dateISO: string, days: number): string {
		const d = new Date(dateISO + "T00:00:00");
		d.setDate(d.getDate() + days);
		return this.formatISO(d);
	}

	private formatISO(d: Date): string {
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, "0");
		const day = String(d.getDate()).padStart(2, "0");
		return `${y}-${m}-${day}`;
	}

	private navigateTo(dateISO: string): void {
		const format = this.settings.dailyNoteFormat || "YYYY-MM-DD";
		const parts = dateISO.split("-");
		const fileName = format
			.replace("YYYY", parts[0])
			.replace("MM", parts[1])
			.replace("DD", parts[2]);
		const filePath = `${this.settings.dailyNotesPath}/${fileName}.md`;

		const existing = this.obsidianApp.vault.getAbstractFileByPath(filePath);
		if (existing instanceof TFile) {
			this.obsidianApp.workspace.getLeaf(false).openFile(existing);
		} else {
			this.createDailyNote(dateISO);
		}
	}
}
