import { App, MarkdownRenderChild, TFile } from "obsidian";
import { FrontmatterHelper } from "./FrontmatterHelper";
import { createElement } from "../utils/dom";

export interface SelectInputConfig {
	property: string;
	label: string;
	options: string[];
	labels: string[];
	colors: string[];
	style: "pills" | "dropdown";
}

export class SelectInput extends MarkdownRenderChild {
	private config: SelectInputConfig;
	private file: TFile;
	private fmHelper: FrontmatterHelper;
	private obsidianApp: App;
	private currentValue: string;
	private pillEls: HTMLElement[] = [];

	constructor(
		containerEl: HTMLElement,
		config: SelectInputConfig,
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
			cls: "umos-input-wrapper umos-select-wrapper",
			parent: this.containerEl,
		});

		createElement("span", {
			cls: "umos-select-label",
			text: this.config.label,
			parent: wrapper,
		});

		if (this.config.style === "dropdown") {
			this.renderDropdown(wrapper);
		} else {
			this.renderPills(wrapper);
		}
	}

	private renderPills(parent: HTMLElement): void {
		const container = createElement("div", {
			cls: "umos-select-pills",
			parent,
			attr: { role: "radiogroup", "aria-label": this.config.label },
		});

		this.pillEls = [];

		this.config.options.forEach((option, idx) => {
			const label = this.config.labels[idx] || option;
			const color = this.config.colors[idx] || "var(--umos-accent)";

			const pill = createElement("button", {
				cls: `umos-select-pill ${this.currentValue === option ? "umos-select-pill-active" : ""}`,
				text: label,
				parent: container,
				attr: {
					role: "radio",
					"aria-checked": String(this.currentValue === option),
					"aria-label": label,
					tabindex: "0",
				},
			});

			pill.style.setProperty("--umos-pill-color", color);
			pill.classList.add("umos-focusable");

			this.pillEls.push(pill);

			this.registerDomEvent(pill, "click", () => {
				this.setValue(option);
			});

			this.registerDomEvent(pill, "keydown", (e: KeyboardEvent) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					this.setValue(option);
				}
			});
		});
	}

	private renderDropdown(parent: HTMLElement): void {
		const select = document.createElement("select");
		select.className = "umos-select-dropdown";
		select.setAttribute("aria-label", this.config.label);
		parent.appendChild(select);

		const emptyOpt = document.createElement("option");
		emptyOpt.value = "";
		emptyOpt.textContent = "— Выбрать —";
		select.appendChild(emptyOpt);

		this.config.options.forEach((option, idx) => {
			const opt = document.createElement("option");
			opt.value = option;
			opt.textContent = this.config.labels[idx] || option;
			if (this.currentValue === option) {
				opt.selected = true;
			}
			select.appendChild(opt);
		});

		this.registerDomEvent(select, "change", () => {
			this.currentValue = select.value;
			this.fmHelper.writeProperty(this.file, this.config.property, this.currentValue);
		});
	}

	private setValue(option: string): void {
		this.currentValue = option;
		this.updateVisual();
		this.fmHelper.writeProperty(this.file, this.config.property, this.currentValue);
	}

	private updateVisual(): void {
		this.pillEls.forEach((pill, idx) => {
			const option = this.config.options[idx];
			const isActive = this.currentValue === option;
			pill.classList.toggle("umos-select-pill-active", isActive);
			pill.setAttribute("aria-checked", String(isActive));
		});
	}
}