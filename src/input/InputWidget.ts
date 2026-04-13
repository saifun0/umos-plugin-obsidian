import { MarkdownPostProcessorContext, MarkdownRenderChild, TFile } from "obsidian";
import type UmOSPlugin from "../main";
import { FrontmatterHelper } from "./FrontmatterHelper";
import { ToggleInput, ToggleInputConfig } from "./ToggleInput";
import { SliderInput, SliderInputConfig } from "./SliderInput";
import { RatingInput, RatingInputConfig } from "./RatingInput";
import { SelectInput, SelectInputConfig } from "./SelectInput";
import { TextInput, TextInputConfig } from "./TextInput";
import { ProgressInput, ProgressInputConfig } from "./ProgressInput";
import { NumberInput, NumberInputConfig } from "./NumberInput";
import { DateInput, DateInputConfig } from "./DateInput";
import { ChipInput, ChipInputConfig } from "./ChipInput";
import { createErrorMessage } from "../utils/dom";

export class InputWidgetManager {
	private plugin: UmOSPlugin;
	private fmHelper: FrontmatterHelper;

	constructor(plugin: UmOSPlugin) {
		this.plugin = plugin;
		this.fmHelper = new FrontmatterHelper(plugin.app, plugin.eventBus);
	}

	register(): void {
		this.plugin.registerMarkdownCodeBlockProcessor(
			"umos-input",
			(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
				this.process(source, el, ctx);
			}
		);
	}

	destroy(): void {
		this.fmHelper.destroy();
	}

	private parseConfig(source: string): Record<string, unknown> {
		const result: Record<string, unknown> = {};

		let cleaned = source;
		cleaned = cleaned.replace(/^`{3,}.*$/gm, "");
		cleaned = cleaned.trim();

		const lines = cleaned.split("\n");

		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith("#")) continue;

			const colonIndex = trimmed.indexOf(":");
			if (colonIndex === -1) continue;

			const key = trimmed.substring(0, colonIndex).trim();
			let value: string = trimmed.substring(colonIndex + 1).trim();

			if (!key) continue;

			if (
				(value.startsWith('"') && value.endsWith('"')) ||
				(value.startsWith("'") && value.endsWith("'"))
			) {
				value = value.slice(1, -1);
			}

			if (value.startsWith("[") && value.endsWith("]")) {
				const inner = value.slice(1, -1);
				if (inner.trim() === "") {
					result[key] = [];
					continue;
				}
				const items = inner.split(",").map((item) => {
					let s = item.trim();
					if (
						(s.startsWith('"') && s.endsWith('"')) ||
						(s.startsWith("'") && s.endsWith("'"))
					) {
						s = s.slice(1, -1);
					}
					return s;
				});
				result[key] = items;
				continue;
			}

			if (value === "true") {
				result[key] = true;
				continue;
			}
			if (value === "false") {
				result[key] = false;
				continue;
			}

			const num = Number(value);
			if (value !== "" && !isNaN(num)) {
				result[key] = num;
				continue;
			}

			result[key] = value;
		}

		return result;
	}

	private process(
		source: string,
		el: HTMLElement,
		ctx: MarkdownPostProcessorContext
	): void {
		let config: Record<string, unknown>;
		try {
			config = this.parseConfig(source);
		} catch (e) {
			console.error("umOS: parse failed:", e);
			createErrorMessage(
				el,
				`Ошибка парсинга конфигурации: ${e instanceof Error ? e.message : String(e)}`
			);
			return;
		}

		const type = config.type as string;
		if (!type) {
			createErrorMessage(el, "Не указан тип виджета (type)");
			return;
		}

		const filePath = ctx.sourcePath;
		const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) {
			createErrorMessage(el, "Файл не найден");
			return;
		}

		const container = el.createDiv({ cls: "umos-widget-container" });
		container.setAttribute("contenteditable", "false");
		this.applySizeClass(container, config);

		let widget: MarkdownRenderChild | null = null;

		switch (type) {
			case "toggle":
				widget = this.createToggle(container, config, file);
				break;
			case "toggles":
				this.createToggleGroup(container, config, file, ctx);
				break;
			case "chip":
				widget = this.createChip(container, config, file);
				break;
			case "chips":
				this.createChipGroup(container, config, file, ctx);
				break;
			case "slider":
				widget = this.createSlider(container, config, file);
				break;
			case "rating":
				widget = this.createRating(container, config, file);
				break;
			case "ratings":
				this.createRatingGroup(container, config, file, ctx);
				break;
			case "select":
				widget = this.createSelect(container, config, file);
				break;
			case "text":
				widget = this.createText(container, config, file);
				break;
			case "progress":
				widget = this.createProgress(container, config, file);
				break;
			case "number":
				widget = this.createNumber(container, config, file);
				break;
			case "numbers":
				this.createNumberGroup(container, config, file, ctx);
				break;
			case "date":
				widget = this.createDate(container, config, file);
				break;
			default:
				createErrorMessage(container, `Неизвестный тип виджета: ${type}`);
				return;
		}

		if (widget) {
			ctx.addChild(widget);
		}
	}

	private createToggle(
		container: HTMLElement,
		config: Record<string, unknown>,
		file: TFile
	): ToggleInput {
		const toggleConfig: ToggleInputConfig = {
			property: String(config.property || ""),
			label: String(config.label || "Toggle"),
			icon: String(config.icon || ""),
		};
		return new ToggleInput(container, toggleConfig, file, this.fmHelper, this.plugin.app);
	}

	private createToggleGroup(
		container: HTMLElement,
		config: Record<string, unknown>,
		file: TFile,
		ctx: MarkdownPostProcessorContext
	): void {
		const propertiesRaw = config.properties;
		const labelsRaw = config.labels;
		const iconsRaw = config.icons;

		const properties = Array.isArray(propertiesRaw) ? propertiesRaw.map(String) : [];
		const labels = Array.isArray(labelsRaw) ? labelsRaw.map(String) : [];
		const icons = Array.isArray(iconsRaw) ? iconsRaw.map(String) : [];

		if (properties.length === 0) {
			createErrorMessage(container, "Для type: toggles нужен массив properties");
			return;
		}

		const group = container.createDiv({ cls: "umos-toggle-group" });
		const parsedColumns = Number(config.columns);
		const columns = Number.isFinite(parsedColumns) && parsedColumns > 0 ? Math.floor(parsedColumns) : 2;
		group.style.setProperty("--umos-toggle-group-columns", String(columns));

		for (let i = 0; i < properties.length; i++) {
			const itemContainer = group.createDiv({ cls: "umos-toggle-group-item" });
			const toggleConfig: ToggleInputConfig = {
				property: properties[i],
				label: labels[i] || properties[i],
				icon: icons[i] || "",
			};
			const child = new ToggleInput(itemContainer, toggleConfig, file, this.fmHelper, this.plugin.app);
			ctx.addChild(child);
		}
	}

	private createChip(
		container: HTMLElement,
		config: Record<string, unknown>,
		file: TFile
	): ChipInput {
		const chipConfig: ChipInputConfig = {
			property: String(config.property || ""),
			label: String(config.label || "Chip"),
			icon: String(config.icon || ""),
			color: String(config.color || "var(--umos-accent)"),
		};
		return new ChipInput(container, chipConfig, file, this.fmHelper, this.plugin.app);
	}

	private createChipGroup(
		container: HTMLElement,
		config: Record<string, unknown>,
		file: TFile,
		ctx: MarkdownPostProcessorContext
	): void {
		const propertiesRaw = config.properties;
		const labelsRaw = config.labels;
		const iconsRaw = config.icons;
		const colorsRaw = config.colors;

		const properties = Array.isArray(propertiesRaw) ? propertiesRaw.map(String) : [];
		const labels = Array.isArray(labelsRaw) ? labelsRaw.map(String) : [];
		const icons = Array.isArray(iconsRaw) ? iconsRaw.map(String) : [];
		const colors = Array.isArray(colorsRaw) ? colorsRaw.map(String) : [];

		if (properties.length === 0) {
			createErrorMessage(container, "Для type: chips нужен массив properties");
			return;
		}

		const group = container.createDiv({ cls: "umos-chip-group" });
		const parsedColumns = Number(config.columns);
		const columns = Number.isFinite(parsedColumns) && parsedColumns > 0 ? Math.floor(parsedColumns) : properties.length;
		group.style.setProperty("--umos-chip-group-columns", String(columns));

		for (let i = 0; i < properties.length; i++) {
			const itemContainer = group.createDiv({ cls: "umos-chip-group-item" });
			const chipConfig: ChipInputConfig = {
				property: properties[i],
				label: labels[i] || properties[i],
				icon: icons[i] || "",
				color: colors[i] || "var(--umos-accent)",
			};
			const child = new ChipInput(itemContainer, chipConfig, file, this.fmHelper, this.plugin.app);
			ctx.addChild(child);
		}
	}

	private createSlider(
		container: HTMLElement,
		config: Record<string, unknown>,
		file: TFile
	): SliderInput {
		const emojisRaw = config.emojis;
		let emojis: string[] = [];
		if (Array.isArray(emojisRaw)) {
			emojis = emojisRaw.map(String);
		}

		const sliderConfig: SliderInputConfig = {
			property: String(config.property || ""),
			label: String(config.label || "Slider"),
			min: Number(config.min) || 0,
			max: Number(config.max) || 10,
			step: Number(config.step) || 1,
			style: config.style === "emoji" ? "emoji" : "numeric",
			emojis,
			suffix: String(config.suffix || ""),
		};
		return new SliderInput(container, sliderConfig, file, this.fmHelper, this.plugin.app);
	}

	private createRating(
		container: HTMLElement,
		config: Record<string, unknown>,
		file: TFile
	): RatingInput {
		const ratingConfig: RatingInputConfig = {
			property: String(config.property || ""),
			label: String(config.label || "Rating"),
			max: Number(config.max) || 5,
			icon: String(config.icon || "⭐"),
			emptyIcon: String(config.empty_icon || "☆"),
		};
		return new RatingInput(container, ratingConfig, file, this.fmHelper, this.plugin.app);
	}

	private createSelect(
		container: HTMLElement,
		config: Record<string, unknown>,
		file: TFile
	): SelectInput {
		const optionsRaw = config.options;
		const labelsRaw = config.labels;
		const colorsRaw = config.colors;

		const options = Array.isArray(optionsRaw) ? optionsRaw.map(String) : [];
		const labels = Array.isArray(labelsRaw) ? labelsRaw.map(String) : options;
		const colors = Array.isArray(colorsRaw) ? colorsRaw.map(String) : [];

		const selectConfig: SelectInputConfig = {
			property: String(config.property || ""),
			label: String(config.label || "Select"),
			options,
			labels,
			colors,
			style: config.style === "dropdown" ? "dropdown" : "pills",
		};
		return new SelectInput(container, selectConfig, file, this.fmHelper, this.plugin.app);
	}

	private createText(
		container: HTMLElement,
		config: Record<string, unknown>,
		file: TFile
	): TextInput {
		const textConfig: TextInputConfig = {
			property: String(config.property || ""),
			label: String(config.label || "Text"),
			placeholder: String(config.placeholder || ""),
			multiline: config.multiline === true,
		};
		return new TextInput(container, textConfig, file, this.fmHelper, this.plugin.app);
	}

	private createProgress(
		container: HTMLElement,
		config: Record<string, unknown>,
		file: TFile
	): ProgressInput {
		const progressConfig: ProgressInputConfig = {
			propertyCurrent: String(config.property_current || "current"),
			propertyTotal: String(config.property_total || "total"),
			label: String(config.label || "Progress"),
			color: String(config.color || "var(--umos-accent)"),
			editable: config.editable !== false,
		};
		return new ProgressInput(container, progressConfig, file, this.fmHelper, this.plugin.app);
	}

	private createNumber(
		container: HTMLElement,
		config: Record<string, unknown>,
		file: TFile
	): NumberInput {
		const parsedMin = Number(config.min);
		const parsedMax = Number(config.max);
		const parsedStep = Number(config.step);

		const numberConfig: NumberInputConfig = {
			property: String(config.property || ""),
			label: String(config.label || "Number"),
			min: Number.isFinite(parsedMin) ? parsedMin : 0,
			max: Number.isFinite(parsedMax) ? parsedMax : 100,
			step: Number.isFinite(parsedStep) && parsedStep > 0 ? parsedStep : 1,
			suffix: String(config.suffix || ""),
		};
		return new NumberInput(container, numberConfig, file, this.fmHelper, this.plugin.app);
	}

	private createNumberGroup(
		container: HTMLElement,
		config: Record<string, unknown>,
		file: TFile,
		ctx: MarkdownPostProcessorContext
	): void {
		const properties = Array.isArray(config.properties) ? config.properties.map(String) : [];
		const labels = Array.isArray(config.labels) ? config.labels.map(String) : [];
		const icons = Array.isArray(config.icons) ? config.icons.map(String) : [];
		const mins = Array.isArray(config.mins) ? config.mins.map(Number) : [];
		const maxes = Array.isArray(config.maxes) ? config.maxes.map(Number) : [];
		const steps = Array.isArray(config.steps) ? config.steps.map(Number) : [];
		const suffixes = Array.isArray(config.suffixes) ? config.suffixes.map(String) : [];

		if (properties.length === 0) {
			createErrorMessage(container, "Для type: numbers нужен массив properties");
			return;
		}

		const group = container.createDiv({ cls: "umos-number-group" });
		const parsedColumns = Number(config.columns);
		const columns = Number.isFinite(parsedColumns) && parsedColumns > 0 ? Math.floor(parsedColumns) : 2;
		group.style.setProperty("--umos-number-group-columns", String(columns));

		for (let i = 0; i < properties.length; i++) {
			const itemContainer = group.createDiv({ cls: "umos-number-group-item" });
			const parsedMin = mins[i];
			const parsedMax = maxes[i];
			const parsedStep = steps[i];
			const numberConfig: NumberInputConfig = {
				property: properties[i],
				label: (icons[i] ? `${icons[i]} ` : "") + (labels[i] || properties[i]),
				min: Number.isFinite(parsedMin) ? parsedMin : 0,
				max: Number.isFinite(parsedMax) ? parsedMax : 100,
				step: Number.isFinite(parsedStep) && parsedStep > 0 ? parsedStep : 1,
				suffix: suffixes[i] || "",
			};
			const child = new NumberInput(itemContainer, numberConfig, file, this.fmHelper, this.plugin.app);
			ctx.addChild(child);
		}
	}

	private createRatingGroup(
		container: HTMLElement,
		config: Record<string, unknown>,
		file: TFile,
		ctx: MarkdownPostProcessorContext
	): void {
		const properties = Array.isArray(config.properties) ? config.properties.map(String) : [];
		const labels = Array.isArray(config.labels) ? config.labels.map(String) : [];
		const maxValues = Array.isArray(config.max_values) ? config.max_values.map(Number) : [];
		const icons = Array.isArray(config.icons) ? config.icons.map(String) : [];
		const emptyIcons = Array.isArray(config.empty_icons) ? config.empty_icons.map(String) : [];

		if (properties.length === 0) {
			createErrorMessage(container, "Для type: ratings нужен массив properties");
			return;
		}

		const group = container.createDiv({ cls: "umos-rating-group" });
		const parsedColumns = Number(config.columns);
		const columns = Number.isFinite(parsedColumns) && parsedColumns > 0 ? Math.floor(parsedColumns) : 2;
		group.style.setProperty("--umos-rating-group-columns", String(columns));

		for (let i = 0; i < properties.length; i++) {
			const itemContainer = group.createDiv({ cls: "umos-rating-group-item" });
			const ratingConfig: RatingInputConfig = {
				property: properties[i],
				label: labels[i] || properties[i],
				max: Number.isFinite(maxValues[i]) && maxValues[i] > 0 ? maxValues[i] : 5,
				icon: icons[i] || "⭐",
				emptyIcon: emptyIcons[i] || "☆",
			};
			const child = new RatingInput(itemContainer, ratingConfig, file, this.fmHelper, this.plugin.app);
			ctx.addChild(child);
		}
	}

	private createDate(
		container: HTMLElement,
		config: Record<string, unknown>,
		file: TFile
	): DateInput {
		const dateConfig: DateInputConfig = {
			property: String(config.property || ""),
			label: String(config.label || "Date"),
		};
		return new DateInput(container, dateConfig, file, this.fmHelper, this.plugin.app);
	}

	private applySizeClass(container: HTMLElement, config: Record<string, unknown>): void {
		const raw = String(config.button_size || config.size || "").trim().toLowerCase();
		if (!raw) return;
		if (["sm", "small", "s"].includes(raw)) {
			container.classList.add("umos-input-size-sm");
			return;
		}
		if (["lg", "large", "l"].includes(raw)) {
			container.classList.add("umos-input-size-lg");
			return;
		}
	}
}
