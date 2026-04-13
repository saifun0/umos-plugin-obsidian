import { App, MarkdownRenderChild, TFile } from "obsidian";
import { FrontmatterHelper } from "./FrontmatterHelper";
import { createElement } from "../utils/dom";
import { getTodayDateString } from "../utils/date";

export interface DateInputConfig {
	property: string;
	label: string;
}

export class DateInput extends MarkdownRenderChild {
	private config: DateInputConfig;
	private file: TFile;
	private fmHelper: FrontmatterHelper;
	private obsidianApp: App;
	private currentValue: string;
	private inputEl: HTMLInputElement | null = null;

	constructor(
		containerEl: HTMLElement,
		config: DateInputConfig,
		file: TFile,
		fmHelper: FrontmatterHelper,
		app: App
	) {
		super(containerEl);
		this.config = config;
		this.file = file;
		this.fmHelper = fmHelper;
		this.obsidianApp = app;
		this.currentValue = "";
	}

	onload(): void {
		const raw = this.fmHelper.readProperty(this.file, this.config.property);
		this.currentValue = typeof raw === "string" ? raw : "";
		this.render();

		this.registerEvent(
			this.obsidianApp.metadataCache.on("changed", (changedFile) => {
				if (changedFile.path === this.file.path) {
					const newRaw = this.fmHelper.readProperty(this.file, this.config.property);
					const newValue = typeof newRaw === "string" ? newRaw : "";
					if (newValue !== this.currentValue && this.inputEl) {
						this.currentValue = newValue;
						this.inputEl.value = this.currentValue;
					}
				}
			})
		);
	}

	private render(): void {
		this.containerEl.empty();

		const wrapper = createElement("div", {
			cls: "umos-input-wrapper umos-date-wrapper",
			parent: this.containerEl,
		});

		createElement("span", {
			cls: "umos-date-label",
			text: this.config.label,
			parent: wrapper,
		});

		const input = document.createElement("input");
		input.type = "date";
		input.className = "umos-date-input umos-focusable";
		input.value = this.currentValue || getTodayDateString();
		input.setAttribute("aria-label", this.config.label);
		wrapper.appendChild(input);
		this.inputEl = input;

		this.registerDomEvent(input, "change", () => {
			this.currentValue = input.value;
			this.fmHelper.writeProperty(this.file, this.config.property, this.currentValue);
		});
	}
}