import { App, MarkdownRenderChild, TFile } from "obsidian";
import { FrontmatterHelper } from "./FrontmatterHelper";
import { createElement } from "../utils/dom";

export interface TextInputConfig {
	property: string;
	label: string;
	placeholder: string;
	multiline: boolean;
}

export class TextInput extends MarkdownRenderChild {
	private config: TextInputConfig;
	private file: TFile;
	private fmHelper: FrontmatterHelper;
	private obsidianApp: App;
	private currentValue: string;
	private inputEl: HTMLInputElement | HTMLTextAreaElement | null = null;

	constructor(
		containerEl: HTMLElement,
		config: TextInputConfig,
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
					if (newValue !== this.currentValue && document.activeElement !== this.inputEl) {
						this.currentValue = newValue;
						if (this.inputEl) {
							this.inputEl.value = this.currentValue;
						}
					}
				}
			})
		);
	}

	private render(): void {
		this.containerEl.empty();

		const wrapper = createElement("div", {
			cls: "umos-input-wrapper umos-text-wrapper",
			parent: this.containerEl,
		});

		createElement("span", {
			cls: "umos-text-label",
			text: this.config.label,
			parent: wrapper,
		});

		if (this.config.multiline) {
			const textarea = document.createElement("textarea");
			textarea.className = "umos-text-input umos-text-textarea umos-focusable";
			textarea.placeholder = this.config.placeholder || "";
			textarea.value = this.currentValue;
			textarea.rows = 3;
			textarea.setAttribute("aria-label", this.config.label);
			wrapper.appendChild(textarea);
			this.inputEl = textarea;

			this.registerDomEvent(textarea, "blur", () => {
				this.save(textarea.value);
			});

			this.registerDomEvent(textarea, "keydown", (e: KeyboardEvent) => {
				if (e.key === "Escape") {
					textarea.blur();
				}
			});
		} else {
			const input = document.createElement("input");
			input.type = "text";
			input.className = "umos-text-input umos-focusable";
			input.placeholder = this.config.placeholder || "";
			input.value = this.currentValue;
			input.setAttribute("aria-label", this.config.label);
			wrapper.appendChild(input);
			this.inputEl = input;

			this.registerDomEvent(input, "blur", () => {
				this.save(input.value);
			});

			this.registerDomEvent(input, "keydown", (e: KeyboardEvent) => {
				if (e.key === "Enter") {
					input.blur();
				} else if (e.key === "Escape") {
					input.value = this.currentValue;
					input.blur();
				}
			});
		}
	}

	private save(value: string): void {
		if (value !== this.currentValue) {
			this.currentValue = value;
			this.fmHelper.writeProperty(this.file, this.config.property, this.currentValue);
		}
	}
}