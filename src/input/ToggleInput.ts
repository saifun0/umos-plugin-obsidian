import { App, MarkdownRenderChild, TFile } from "obsidian";
import { FrontmatterHelper } from "./FrontmatterHelper";
import { createElement } from "../utils/dom";

export interface ToggleInputConfig {
	property: string;
	label: string;
	icon: string;
}

export class ToggleInput extends MarkdownRenderChild {
	private config: ToggleInputConfig;
	private file: TFile;
	private fmHelper: FrontmatterHelper;
	private obsidianApp: App;
	private currentValue: boolean;
	private toggleEl: HTMLElement | null = null;

	constructor(
		containerEl: HTMLElement,
		config: ToggleInputConfig,
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

		const wrapper = createElement("div", {
			cls: "umos-input-wrapper umos-toggle-wrapper",
			parent: this.containerEl,
		});

		if (this.config.icon) {
			createElement("span", {
				cls: "umos-toggle-icon",
				text: this.config.icon,
				parent: wrapper,
			});
		}

		createElement("span", {
			cls: "umos-toggle-label",
			text: this.config.label,
			parent: wrapper,
		});

		const track = createElement("div", {
			cls: `umos-toggle-track ${this.currentValue ? "umos-toggle-on" : ""}`,
			parent: wrapper,
		});

		this.toggleEl = track;

		createElement("div", {
			cls: "umos-toggle-thumb",
			parent: track,
		});

		track.setAttribute("role", "switch");
		track.setAttribute("aria-checked", String(this.currentValue));
		track.setAttribute("aria-label", this.config.label);
		track.setAttribute("tabindex", "0");
		track.classList.add("umos-focusable");

		this.registerDomEvent(track, "click", () => {
			this.toggle();
		});

		this.registerDomEvent(track, "keydown", (e: KeyboardEvent) => {
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
		if (!this.toggleEl) return;
		if (this.currentValue) {
			this.toggleEl.classList.add("umos-toggle-on");
		} else {
			this.toggleEl.classList.remove("umos-toggle-on");
		}
		this.toggleEl.setAttribute("aria-checked", String(this.currentValue));
	}
}