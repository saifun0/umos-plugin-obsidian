import { App, MarkdownRenderChild, TFile } from "obsidian";
import { FrontmatterHelper } from "./FrontmatterHelper";
import { createElement } from "../utils/dom";

export interface NumberInputConfig {
	property: string;
	label: string;
	min: number;
	max: number;
	step: number;
	suffix: string;
}

export class NumberInput extends MarkdownRenderChild {
	private config: NumberInputConfig;
	private file: TFile;
	private fmHelper: FrontmatterHelper;
	private obsidianApp: App;
	private currentValue: number;
	private displayEl: HTMLElement | null = null;

	constructor(
		containerEl: HTMLElement,
		config: NumberInputConfig,
		file: TFile,
		fmHelper: FrontmatterHelper,
		app: App
	) {
		super(containerEl);
		this.config = config;
		this.file = file;
		this.fmHelper = fmHelper;
		this.obsidianApp = app;
		this.currentValue = config.min;
	}

	onload(): void {
		const raw = this.fmHelper.readProperty(this.file, this.config.property);
		this.currentValue = typeof raw === "number" ? raw : this.config.min;
		this.render();

		this.registerEvent(
			this.obsidianApp.metadataCache.on("changed", (changedFile) => {
				if (changedFile.path === this.file.path) {
					const newRaw = this.fmHelper.readProperty(this.file, this.config.property);
					const newValue = typeof newRaw === "number" ? newRaw : this.config.min;
					if (newValue !== this.currentValue) {
						this.currentValue = newValue;
						this.updateVisual();
					}
				}
			})
		);
	}

	private render(): void {
		this.containerEl.empty();

		const wrapper = createElement("div", {
			cls: "umos-input-wrapper umos-number-wrapper",
			parent: this.containerEl,
		});

		createElement("span", {
			cls: "umos-number-label",
			text: this.config.label,
			parent: wrapper,
		});

		const controls = createElement("div", {
			cls: "umos-number-controls",
			parent: wrapper,
		});

		const minusBtn = createElement("button", {
			cls: "umos-number-btn umos-number-btn-minus umos-focusable",
			text: "−",
			parent: controls,
			attr: { "aria-label": "Уменьшить", tabindex: "0" },
		});

		this.displayEl = createElement("span", {
			cls: "umos-number-display",
			parent: controls,
		});

		const plusBtn = createElement("button", {
			cls: "umos-number-btn umos-number-btn-plus umos-focusable",
			text: "+",
			parent: controls,
			attr: { "aria-label": "Увеличить", tabindex: "0" },
		});

		this.updateVisual();

		this.registerDomEvent(minusBtn, "click", () => {
			this.adjust(-this.config.step);
		});

		this.registerDomEvent(plusBtn, "click", () => {
			this.adjust(this.config.step);
		});

		this.registerDomEvent(this.displayEl, "click", () => {
			this.editInline();
		});
	}

	private adjust(delta: number): void {
		const newValue = Math.round((this.currentValue + delta) * 100) / 100;
		if (newValue >= this.config.min && newValue <= this.config.max) {
			this.currentValue = newValue;
			this.updateVisual();
			this.fmHelper.writeProperty(this.file, this.config.property, this.currentValue);
		}
	}

	private editInline(): void {
		if (!this.displayEl) return;

		const input = document.createElement("input");
		input.type = "number";
		input.className = "umos-number-inline-input";
		input.value = String(this.currentValue);
		input.min = String(this.config.min);
		input.max = String(this.config.max);
		input.step = String(this.config.step);

		this.displayEl.textContent = "";
		this.displayEl.appendChild(input);
		input.focus();
		input.select();

		const save = () => {
			const newVal = parseFloat(input.value);
			if (!isNaN(newVal) && newVal >= this.config.min && newVal <= this.config.max) {
				this.currentValue = newVal;
				this.fmHelper.writeProperty(this.file, this.config.property, this.currentValue);
			}
			this.updateVisual();
		};

		this.registerDomEvent(input, "blur", save);
		this.registerDomEvent(input, "keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter") {
				input.blur();
			} else if (e.key === "Escape") {
				this.updateVisual();
			}
		});
	}

	private updateVisual(): void {
		if (!this.displayEl) return;
		const suffix = this.config.suffix ? ` ${this.config.suffix}` : "";
		this.displayEl.textContent = `${this.currentValue}${suffix}`;
	}
}