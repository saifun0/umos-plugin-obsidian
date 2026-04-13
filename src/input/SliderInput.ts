import { App, MarkdownRenderChild, TFile } from "obsidian";
import { FrontmatterHelper } from "./FrontmatterHelper";
import { createElement } from "../utils/dom";

export interface SliderInputConfig {
	property: string;
	label: string;
	min: number;
	max: number;
	step: number;
	style: "numeric" | "emoji";
	emojis: string[];
	suffix: string;
}

export class SliderInput extends MarkdownRenderChild {
	private config: SliderInputConfig;
	private file: TFile;
	private fmHelper: FrontmatterHelper;
	private obsidianApp: App;
	private currentValue: number;
	private displayEl: HTMLElement | null = null;
	private sliderEl: HTMLInputElement | null = null;

	constructor(
		containerEl: HTMLElement,
		config: SliderInputConfig,
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
			cls: "umos-input-wrapper umos-slider-wrapper",
			parent: this.containerEl,
		});

		createElement("span", {
			cls: "umos-slider-label",
			text: this.config.label,
			parent: wrapper,
		});

		const controlArea = createElement("div", {
			cls: "umos-slider-control",
			parent: wrapper,
		});

		this.displayEl = createElement("div", {
			cls: "umos-slider-display",
			parent: controlArea,
		});

		const slider = document.createElement("input");
		slider.type = "range";
		slider.min = String(this.config.min);
		slider.max = String(this.config.max);
		slider.step = String(this.config.step);
		slider.value = String(this.currentValue);
		slider.className = "umos-slider-input";
		slider.setAttribute("aria-label", this.config.label);
		controlArea.appendChild(slider);

		this.sliderEl = slider;
		this.updateVisual();

		this.registerDomEvent(slider, "input", () => {
			this.currentValue = parseFloat(slider.value);
			this.updateVisual();
		});

		this.registerDomEvent(slider, "change", () => {
			this.currentValue = parseFloat(slider.value);
			this.fmHelper.writeProperty(this.file, this.config.property, this.currentValue);
		});
	}

	private updateVisual(): void {
		if (!this.displayEl || !this.sliderEl) return;

		this.sliderEl.value = String(this.currentValue);

		if (this.config.style === "emoji" && this.config.emojis.length > 0) {
			const index = Math.round(
				((this.currentValue - this.config.min) / (this.config.max - this.config.min)) *
					(this.config.emojis.length - 1)
			);
			const clampedIndex = Math.max(0, Math.min(index, this.config.emojis.length - 1));
			this.displayEl.textContent = this.config.emojis[clampedIndex];
			this.displayEl.classList.add("umos-slider-display-emoji");
		} else {
			this.displayEl.textContent = String(this.currentValue) + this.config.suffix;
			this.displayEl.classList.remove("umos-slider-display-emoji");
		}

		const percent =
			((this.currentValue - this.config.min) / (this.config.max - this.config.min)) * 100;
		this.sliderEl.style.setProperty("--umos-slider-percent", `${percent}%`);
	}
}