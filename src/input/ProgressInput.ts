import { App, MarkdownRenderChild, TFile } from "obsidian";
import { FrontmatterHelper } from "./FrontmatterHelper";
import { createElement } from "../utils/dom";

export interface ProgressInputConfig {
	propertyCurrent: string;
	propertyTotal: string;
	label: string;
	color: string;
	editable: boolean;
}

export class ProgressInput extends MarkdownRenderChild {
	private config: ProgressInputConfig;
	private file: TFile;
	private fmHelper: FrontmatterHelper;
	private obsidianApp: App;
	private currentValue: number;
	private totalValue: number;
	private barEl: HTMLElement | null = null;
	private percentEl: HTMLElement | null = null;
	private currentDisplayEl: HTMLElement | null = null;
	private totalDisplayEl: HTMLElement | null = null;

	constructor(
		containerEl: HTMLElement,
		config: ProgressInputConfig,
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
		this.totalValue = 100;
	}

	onload(): void {
		const rawCurrent = this.fmHelper.readProperty(this.file, this.config.propertyCurrent);
		const rawTotal = this.fmHelper.readProperty(this.file, this.config.propertyTotal);
		this.currentValue = typeof rawCurrent === "number" ? rawCurrent : 0;
		this.totalValue = typeof rawTotal === "number" ? rawTotal : 100;
		this.render();

		this.registerEvent(
			this.obsidianApp.metadataCache.on("changed", (changedFile) => {
				if (changedFile.path === this.file.path) {
					const newCurrent = this.fmHelper.readProperty(this.file, this.config.propertyCurrent);
					const newTotal = this.fmHelper.readProperty(this.file, this.config.propertyTotal);
					const c = typeof newCurrent === "number" ? newCurrent : 0;
					const t = typeof newTotal === "number" ? newTotal : 100;
					if (c !== this.currentValue || t !== this.totalValue) {
						this.currentValue = c;
						this.totalValue = t;
						this.updateVisual();
					}
				}
			})
		);
	}

	private render(): void {
		this.containerEl.empty();

		const wrapper = createElement("div", {
			cls: "umos-input-wrapper umos-progress-wrapper",
			parent: this.containerEl,
		});

		const header = createElement("div", {
			cls: "umos-progress-header",
			parent: wrapper,
		});

		createElement("span", {
			cls: "umos-progress-label",
			text: this.config.label,
			parent: header,
		});

		const numbers = createElement("div", {
			cls: "umos-progress-numbers",
			parent: header,
		});

		this.currentDisplayEl = createElement("span", {
			cls: `umos-progress-current ${this.config.editable ? "umos-progress-editable" : ""}`,
			text: String(this.currentValue),
			parent: numbers,
		});

		createElement("span", {
			cls: "umos-progress-separator",
			text: " / ",
			parent: numbers,
		});

		this.totalDisplayEl = createElement("span", {
			cls: `umos-progress-total ${this.config.editable ? "umos-progress-editable" : ""}`,
			text: String(this.totalValue),
			parent: numbers,
		});

		this.percentEl = createElement("span", {
			cls: "umos-progress-percent",
			parent: numbers,
		});

		const barContainer = createElement("div", {
			cls: "umos-progress-container",
			parent: wrapper,
		});

		this.barEl = createElement("div", {
			cls: "umos-progress-bar",
			parent: barContainer,
		});

		this.barEl.style.background = this.config.color || "var(--umos-accent)";

		this.updateVisual();

		if (this.config.editable && this.currentDisplayEl && this.totalDisplayEl) {
			this.registerDomEvent(this.currentDisplayEl, "click", () => {
				this.editNumber("current");
			});
			this.registerDomEvent(this.totalDisplayEl, "click", () => {
				this.editNumber("total");
			});
		}
	}

	private editNumber(which: "current" | "total"): void {
		const displayEl = which === "current" ? this.currentDisplayEl : this.totalDisplayEl;
		if (!displayEl) return;

		const currentVal = which === "current" ? this.currentValue : this.totalValue;

		const input = document.createElement("input");
		input.type = "number";
		input.className = "umos-progress-inline-input";
		input.value = String(currentVal);
		input.min = "0";

		displayEl.textContent = "";
		displayEl.appendChild(input);
		input.focus();
		input.select();

		const save = () => {
			const newVal = parseInt(input.value, 10);
			if (!isNaN(newVal) && newVal >= 0) {
				if (which === "current") {
					this.currentValue = newVal;
					this.fmHelper.writeProperty(this.file, this.config.propertyCurrent, newVal);
				} else {
					this.totalValue = newVal;
					this.fmHelper.writeProperty(this.file, this.config.propertyTotal, newVal);
				}
			}
			this.updateVisual();
		};

		this.registerDomEvent(input, "blur", save);
		this.registerDomEvent(input, "keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter") {
				input.blur();
			} else if (e.key === "Escape") {
				input.value = String(currentVal);
				input.blur();
			}
		});
	}

	private updateVisual(): void {
		const percent = this.totalValue > 0
			? Math.min(100, Math.round((this.currentValue / this.totalValue) * 100))
			: 0;

		if (this.barEl) {
			this.barEl.style.width = `${percent}%`;
		}

		if (this.percentEl) {
			this.percentEl.textContent = ` (${percent}%)`;
		}

		if (this.currentDisplayEl && !this.currentDisplayEl.querySelector("input")) {
			this.currentDisplayEl.textContent = String(this.currentValue);
		}

		if (this.totalDisplayEl && !this.totalDisplayEl.querySelector("input")) {
			this.totalDisplayEl.textContent = String(this.totalValue);
		}
	}
}