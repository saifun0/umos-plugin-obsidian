import { App, TFile } from "obsidian";
import { BaseWidget } from "../core/BaseWidget";
import { EventBus } from "../EventBus";

export interface DailyReviewConfig {
	mode: "daily" | "weekly";
	title?: string;
}

interface ReviewPrompt {
	key: string;
	label: string;
	placeholder: string;
}

const DAILY_PROMPTS: ReviewPrompt[] = [
	{ key: "review_win", label: "What worked?", placeholder: "The best result of the day..." },
	{ key: "review_lessons", label: "What should be considered?", placeholder: "Observation, lesson, or adjustment..." },
	{ key: "review_tomorrow", label: "Tomorrow focus", placeholder: "One main thing..." },
];

const WEEKLY_PROMPTS: ReviewPrompt[] = [
	{ key: "weekly_review_win", label: "Weekly win", placeholder: "What moved forward most..." },
	{ key: "weekly_review_friction", label: "What got in the way?", placeholder: "Recurring friction or noise..." },
	{ key: "weekly_review_next", label: "Next week focus", placeholder: "Main direction..." },
];

export class DailyReviewWidget extends BaseWidget {
	protected eventBus: EventBus;

	constructor(
		containerEl: HTMLElement,
		private app: App,
		private file: TFile,
		eventBus: EventBus,
		private config: DailyReviewConfig
	) {
		super(containerEl);
		this.eventBus = eventBus;
	}

	protected render(): void {
		this.containerEl.empty();
		const prompts = this.config.mode === "weekly" ? WEEKLY_PROMPTS : DAILY_PROMPTS;
		const cache = this.app.metadataCache.getFileCache(this.file)?.frontmatter ?? {};
		const root = this.containerEl.createDiv({ cls: "umos-review-widget" });
		const title = this.config.title || (this.config.mode === "weekly" ? "Weekly Review" : "Daily Review");
		root.createEl("h3", { text: title, cls: "umos-review-title" });

		for (const prompt of prompts) {
			const row = root.createDiv({ cls: "umos-review-field" });
			row.createEl("label", { text: prompt.label, cls: "umos-review-label" });
			const input = row.createEl("textarea", {
				cls: "umos-review-input",
				attr: { placeholder: prompt.placeholder },
			}) as HTMLTextAreaElement;
			input.value = String(cache[prompt.key] ?? "");
			input.addEventListener("change", () => {
				void this.saveField(prompt.key, input.value);
			});
			input.addEventListener("blur", () => {
				void this.saveField(prompt.key, input.value);
			});
		}
	}

	private async saveField(property: string, value: string): Promise<void> {
		try {
			await this.app.fileManager.processFrontMatter(this.file, (fm) => {
				fm[property] = value;
			});
			this.eventBus.emit("frontmatter:changed", {
				path: this.file.path,
				property,
				value,
			});
		} catch (error) {
			console.error("umOS: failed to save review field:", error);
		}
	}
}
