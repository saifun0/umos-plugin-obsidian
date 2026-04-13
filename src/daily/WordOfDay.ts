import { App, MarkdownRenderChild, TFile } from "obsidian";
import { FrontmatterHelper } from "../input/FrontmatterHelper";
import { createElement } from "../utils/dom";

export class WordOfDayWidget extends MarkdownRenderChild {
	private obsidianApp: App;
	private file: TFile;
	private fmHelper: FrontmatterHelper;
	private property: string;
	private placeholder: string;
	private currentValue = "";
	private wordEl: HTMLElement | null = null;

	constructor(
		containerEl: HTMLElement,
		app: App,
		file: TFile,
		fmHelper: FrontmatterHelper,
		property: string,
		placeholder: string,
	) {
		super(containerEl);
		this.obsidianApp = app;
		this.file = file;
		this.fmHelper = fmHelper;
		this.property = property;
		this.placeholder = placeholder;
	}

	onload(): void {
		const raw = this.fmHelper.readProperty(this.file, this.property);
		this.currentValue = typeof raw === "string" ? raw : "";
		this.render();

		this.registerEvent(
			this.obsidianApp.metadataCache.on("changed", (changedFile) => {
				if (changedFile.path === this.file.path) {
					const newRaw = this.fmHelper.readProperty(this.file, this.property);
					const newValue = typeof newRaw === "string" ? newRaw : "";
					if (newValue !== this.currentValue) {
						this.currentValue = newValue;
						this.updateDisplay();
					}
				}
			})
		);
	}

	private render(): void {
		this.containerEl.empty();

		const card = createElement("div", {
			cls: "umos-word-of-day",
			parent: this.containerEl,
		});

		const header = createElement("div", {
			cls: "umos-word-of-day-header",
			parent: card,
		});

		createElement("span", {
			cls: "umos-word-of-day-icon",
			text: "💬",
			parent: header,
		});

		createElement("span", {
			cls: "umos-word-of-day-title",
			text: "Слово дня",
			parent: header,
		});

		this.wordEl = createElement("div", {
			cls: `umos-word-of-day-value ${this.currentValue ? "" : "is-empty"}`,
			text: this.currentValue || this.placeholder,
			parent: card,
		});

		this.registerDomEvent(this.wordEl, "click", () => {
			this.startEdit();
		});
	}

	private updateDisplay(): void {
		if (!this.wordEl) return;
		this.wordEl.textContent = this.currentValue || this.placeholder;
		this.wordEl.classList.toggle("is-empty", !this.currentValue);
	}

	private startEdit(): void {
		if (!this.wordEl) return;

		const input = document.createElement("input");
		input.type = "text";
		input.className = "umos-word-of-day-input";
		input.value = this.currentValue;
		input.placeholder = this.placeholder;

		this.wordEl.textContent = "";
		this.wordEl.appendChild(input);
		this.wordEl.classList.remove("is-empty");
		input.focus();

		const save = () => {
			const newVal = input.value.trim();
			this.currentValue = newVal;
			this.fmHelper.writeProperty(this.file, this.property, newVal || null);
			this.updateDisplay();
		};

		this.registerDomEvent(input, "blur", save);
		this.registerDomEvent(input, "keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter") {
				e.preventDefault();
				input.blur();
			} else if (e.key === "Escape") {
				this.updateDisplay();
			}
		});
	}
}
