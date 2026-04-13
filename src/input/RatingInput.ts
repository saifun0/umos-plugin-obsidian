import { App, MarkdownRenderChild, TFile } from "obsidian";
import { FrontmatterHelper } from "./FrontmatterHelper";
import { createElement } from "../utils/dom";

export interface RatingInputConfig {
	property: string;
	label: string;
	max: number;
	icon: string;
	emptyIcon: string;
}

export class RatingInput extends MarkdownRenderChild {
	private config: RatingInputConfig;
	private file: TFile;
	private fmHelper: FrontmatterHelper;
	private obsidianApp: App;
	private currentValue: number;
	private starsContainer: HTMLElement | null = null;
	private starEls: HTMLElement[] = [];

	constructor(
		containerEl: HTMLElement,
		config: RatingInputConfig,
		file: TFile,
		fmHelper: FrontmatterHelper,
		app: App
	) {
		super(containerEl);
		this.config = config;
		this.file = file;
		this.fmHelper = fmHelper;
		this.obsidianApp = app;
		this.currentValue = 0;
	}

	onload(): void {
		const raw = this.fmHelper.readProperty(this.file, this.config.property);
		this.currentValue = typeof raw === "number" ? raw : 0;
		this.render();

		this.registerEvent(
			this.obsidianApp.metadataCache.on("changed", (changedFile) => {
				if (changedFile.path === this.file.path) {
					const newRaw = this.fmHelper.readProperty(this.file, this.config.property);
					const newValue = typeof newRaw === "number" ? newRaw : 0;
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
			cls: "umos-input-wrapper umos-rating-wrapper",
			parent: this.containerEl,
		});

		createElement("span", {
			cls: "umos-rating-label",
			text: this.config.label,
			parent: wrapper,
		});

		this.starsContainer = createElement("div", {
			cls: "umos-rating-stars",
			parent: wrapper,
			attr: {
				role: "radiogroup",
				"aria-label": this.config.label,
			},
		});

		this.starEls = [];

		for (let i = 1; i <= this.config.max; i++) {
			const star = createElement("span", {
				cls: `umos-rating-star ${i <= this.currentValue ? "umos-rating-star-filled" : ""}`,
				text: i <= this.currentValue ? this.config.icon : this.config.emptyIcon,
				parent: this.starsContainer,
				attr: {
					role: "radio",
					"aria-checked": String(i === this.currentValue),
					"aria-label": `${i} из ${this.config.max}`,
					tabindex: "0",
				},
			});

			star.classList.add("umos-focusable");
			this.starEls.push(star);

			this.registerDomEvent(star, "click", () => {
				this.setValue(i);
			});

			this.registerDomEvent(star, "keydown", (e: KeyboardEvent) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					this.setValue(i);
				} else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
					e.preventDefault();
					const next = Math.min(i + 1, this.config.max);
					this.setValue(next);
					this.starEls[next - 1]?.focus();
				} else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
					e.preventDefault();
					const prev = Math.max(i - 1, 1);
					this.setValue(prev);
					this.starEls[prev - 1]?.focus();
				}
			});

			this.registerDomEvent(star, "mouseenter", () => {
				this.highlightStars(i);
			});

			this.registerDomEvent(star, "mouseleave", () => {
				this.updateVisual();
			});
		}

		createElement("span", {
			cls: "umos-rating-value",
			text: `${this.currentValue}/${this.config.max}`,
			parent: wrapper,
		});
	}

	private setValue(value: number): void {
		if (value === this.currentValue) {
			this.currentValue = 0;
		} else {
			this.currentValue = value;
		}
		this.updateVisual();
		this.fmHelper.writeProperty(this.file, this.config.property, this.currentValue);
	}

	private highlightStars(upTo: number): void {
		this.starEls.forEach((el, idx) => {
			const filled = idx < upTo;
			el.textContent = filled ? this.config.icon : this.config.emptyIcon;
			el.classList.toggle("umos-rating-star-filled", filled);
			el.classList.toggle("umos-rating-star-hover", filled);
		});
	}

	private updateVisual(): void {
		this.starEls.forEach((el, idx) => {
			const filled = idx < this.currentValue;
			el.textContent = filled ? this.config.icon : this.config.emptyIcon;
			el.classList.toggle("umos-rating-star-filled", filled);
			el.classList.remove("umos-rating-star-hover");
			el.setAttribute("aria-checked", String(idx + 1 === this.currentValue));
		});

		const valueEl = this.containerEl.querySelector(".umos-rating-value");
		if (valueEl) {
			valueEl.textContent = `${this.currentValue}/${this.config.max}`;
		}
	}
}