import { App, MarkdownRenderChild, TFile } from "obsidian";
import { FrontmatterHelper } from "./FrontmatterHelper";
import { createElement } from "../utils/dom";

export interface ChipInputConfig {
	property: string;
	label: string;
	icon: string;
	color: string;
}

/**
 * ChipInput — compact toggle chip: icon + label, tap to toggle.
 * When active, background fills with the configured color.
 */
export class ChipInput extends MarkdownRenderChild {
	private config: ChipInputConfig;
	private file: TFile;
	private fmHelper: FrontmatterHelper;
	private obsidianApp: App;
	private currentValue: boolean;
	private chipEl: HTMLElement | null = null;

	constructor(
		containerEl: HTMLElement,
		config: ChipInputConfig,
		file: TFile,
		fmHelper: FrontmatterHelper,
		app: App
	) {
		super(containerEl);
		this.config = config;
		this.file = file;
		this.fmHelper = fmHelper;
		this.obsidianApp = app;
		this.currentValue = false;
	}

	onload(): void {
		this.currentValue = !!this.fmHelper.readProperty(this.file, this.config.property);
		this.render();

		this.registerEvent(
			this.obsidianApp.metadataCache.on("changed", (changedFile) => {
				if (changedFile.path === this.file.path) {
					const newValue = !!this.fmHelper.readProperty(this.file, this.config.property);
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

		const chip = createElement("div", {
			cls: `umos-chip ${this.currentValue ? "umos-chip-on" : ""}`,
			parent: this.containerEl,
		});

		chip.style.setProperty("--umos-chip-color", this.config.color);
		this.chipEl = chip;

		if (this.config.icon) {
			createElement("span", { cls: "umos-chip-icon", text: this.config.icon, parent: chip });
		}

		createElement("span", { cls: "umos-chip-label", text: this.config.label, parent: chip });

		chip.setAttribute("role", "switch");
		chip.setAttribute("aria-checked", String(this.currentValue));
		chip.setAttribute("aria-label", this.config.label);
		chip.setAttribute("tabindex", "0");
		chip.classList.add("umos-focusable");

		this.registerDomEvent(chip, "click", () => this.toggle());
		this.registerDomEvent(chip, "keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				this.toggle();
			}
		});
	}

	private toggle(): void {
		this.currentValue = !this.currentValue;
		this.updateVisual();
		this.fmHelper.writeProperty(this.file, this.config.property, this.currentValue);
	}

	private updateVisual(): void {
		if (!this.chipEl) return;
		this.chipEl.classList.toggle("umos-chip-on", this.currentValue);
		this.chipEl.setAttribute("aria-checked", String(this.currentValue));
	}
}
