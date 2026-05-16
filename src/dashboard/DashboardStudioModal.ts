import { Component, MarkdownRenderer, Modal, Notice, Setting, setIcon } from "obsidian";
import type UmOSPlugin from "../main";
import { UMOS_ICON_ID } from "../branding";
import {
	DASHBOARD_PRESETS,
	createDashboardBlock,
	createEmptyProfile,
	createProfileFromPreset,
	exportDashboardProfiles,
	generateDashboardMarkdown,
	importDashboardProfiles,
	upsertDashboardProfile,
	writeDashboardProfile,
} from "./DashboardProfiles";
import type { DashboardBlock, DashboardProfile, DashboardWidthMode, WidgetDefinition, WidgetFieldSchema, WidgetPresetSnippet } from "./types";

interface DashboardProfileValidationItem {
	blockId: string;
	widget: string;
	title: string;
	type: "error" | "warning";
	message: string;
}

const WIDGET_CATEGORIES: { id: string; label: string }[] = [
	{ id: "all", label: "All" },
	{ id: "productivity", label: "Productivity" },
	{ id: "daily", label: "Daily" },
	{ id: "content", label: "Content" },
	{ id: "layout", label: "Layout" },
	{ id: "time", label: "Time" },
	{ id: "system", label: "System" },
];

export class DashboardStudioModal extends Modal {
	private selectedProfileId: string | null = null;
	private expandedBlockId: string | null = null;
	private previewComponent: Component | null = null;
	private addWidgetName: string | null = null;
	private addWidgetSearch = "";
	private addWidgetCategory = "all";
	private restoreAddWidgetSearchFocus = false;

	constructor(private plugin: UmOSPlugin) {
		super(plugin.app);
	}

	onOpen(): void {
		this.modalEl.addClass("umos-dashboard-studio-modal");
		this.render();
	}

	onClose(): void {
		this.previewComponent?.unload();
		this.previewComponent = null;
		this.contentEl.empty();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		const header = contentEl.createDiv({ cls: "umos-dashboard-studio-header" });
		const mark = header.createDiv({ cls: "umos-dashboard-studio-logo" });
		setIcon(mark, UMOS_ICON_ID);
		const titleWrap = header.createDiv({ cls: "umos-dashboard-studio-title-wrap" });
		titleWrap.createEl("h2", { text: "Dashboard Studio" });
		titleWrap.createDiv({
			cls: "umos-dashboard-studio-subtitle",
			text: "Build, preview, and ship your umOS dashboards.",
		});

		const profiles = this.ensureProfiles();
		if (!this.selectedProfileId && profiles.length > 0) {
			this.selectedProfileId = profiles[0].id;
		}
		const selected = profiles.find((profile) => profile.id === this.selectedProfileId) ?? profiles[0] ?? null;

		const shell = contentEl.createDiv({ cls: "umos-dashboard-studio" });
		const sidebar = shell.createDiv({ cls: "umos-dashboard-sidebar" });
		const main = shell.createDiv({ cls: "umos-dashboard-main" });

		this.renderSidebar(sidebar, profiles, selected);
		if (selected) {
			this.renderProfileEditor(main, selected);
		} else {
			main.createDiv({ cls: "umos-settings-empty", text: "Create a profile from a preset or empty dashboard." });
		}
	}

	private renderSidebar(parent: HTMLElement, profiles: DashboardProfile[], selected: DashboardProfile | null): void {
		const actions = parent.createDiv({ cls: "umos-dashboard-sidebar-actions" });
		const emptyBtn = actions.createEl("button", { text: "New", cls: "mod-cta" });
		emptyBtn.addEventListener("click", async () => {
			const profile = createEmptyProfile();
			upsertDashboardProfile(this.plugin, profile);
			await this.plugin.saveSettings();
			this.selectedProfileId = profile.id;
			this.render();
		});

		parent.createEl("h3", { text: "Presets" });
		for (const preset of DASHBOARD_PRESETS) {
			const btn = parent.createEl("button", { cls: "umos-dashboard-preset-btn" });
			btn.createSpan({ text: preset.name, cls: "umos-dashboard-preset-title" });
			btn.createSpan({ text: preset.description, cls: "umos-dashboard-preset-desc" });
			btn.addEventListener("click", async () => {
				const profile = createProfileFromPreset(preset);
				upsertDashboardProfile(this.plugin, profile);
				await this.plugin.saveSettings();
				this.selectedProfileId = profile.id;
				this.render();
			});
		}

		parent.createEl("h3", { text: "Profiles" });
		if (profiles.length === 0) {
			parent.createDiv({ cls: "umos-settings-empty", text: "No profiles yet." });
		}
		for (const profile of profiles) {
			const btn = parent.createEl("button", {
				cls: `umos-dashboard-profile-btn${selected?.id === profile.id ? " is-active" : ""}`,
			});
			btn.createSpan({ text: profile.name, cls: "umos-dashboard-profile-title" });
			btn.createSpan({ text: profile.targetPath, cls: "umos-dashboard-profile-path" });
			btn.addEventListener("click", () => {
				this.selectedProfileId = profile.id;
				this.render();
			});
		}

		parent.createEl("h3", { text: "Import / Export" });
		new Setting(parent)
			.setName("JSON path")
			.addText((text) => text
				.setValue(this.plugin.settings.dashboardProfilesExportPath || "umOS/dashboard-profiles.json")
				.onChange(async (value) => {
					this.plugin.settings.dashboardProfilesExportPath = value.trim() || "umOS/dashboard-profiles.json";
					await this.plugin.saveSettings();
				}));

		const io = parent.createDiv({ cls: "umos-dashboard-io-actions" });
		io.createEl("button", { text: "Export" }).addEventListener("click", () => void exportDashboardProfiles(this.plugin));
		io.createEl("button", { text: "Import" }).addEventListener("click", async () => {
			await importDashboardProfiles(this.plugin, {
				onApplied: (plan) => {
					const profiles = this.ensureProfiles();
					const importedId = plan.items.find((item) =>
						(item.action === "add" || item.action === "update") && item.profile
					)?.id;
					this.selectedProfileId = importedId ?? profiles[0]?.id ?? null;
					this.render();
				},
			});
		});
	}

	private renderProfileEditor(parent: HTMLElement, profile: DashboardProfile): void {
		const top = parent.createDiv({ cls: "umos-dashboard-profile-editor" });
		new Setting(top)
			.setName("Name")
			.addText((text) => text.setValue(profile.name).onChange((value) => {
				profile.name = value.trim() || "Dashboard";
				this.touch(profile);
			}));

		new Setting(top)
			.setName("Target note")
			.addText((text) => text.setValue(profile.targetPath).onChange((value) => {
				profile.targetPath = value.trim() || "05 Dashboards/Dashboard.md";
				this.touch(profile);
			}));

		new Setting(top)
			.setName("Note width")
			.setDesc("Adds a cssclass to the generated dashboard note.")
			.addDropdown((dropdown) => dropdown
				.addOption("default", "Default")
				.addOption("soft", "Soft wide")
				.addOption("wide", "Full width")
				.setValue(profile.widthMode ?? "default")
				.onChange((value) => {
					profile.widthMode = value as DashboardWidthMode;
					this.touch(profile);
					this.renderPreviewOnly();
				}));

		new Setting(top)
			.setName("Columns")
			.addDropdown((dropdown) => dropdown
				.addOption("1", "1")
				.addOption("2", "2")
				.addOption("3", "3")
				.setValue(String(profile.columns || 1))
				.onChange((value) => {
					profile.columns = Number(value) || 1;
					for (const block of profile.blocks) {
						block.column = Math.max(1, Math.min(profile.columns, block.column || 1));
					}
					this.touch(profile);
					this.render();
				}));

		const commandRow = top.createDiv({ cls: "umos-dashboard-command-row" });
		commandRow.createEl("button", { text: "Save", cls: "mod-cta" }).addEventListener("click", async () => {
			upsertDashboardProfile(this.plugin, profile);
			await this.plugin.saveSettings();
			new Notice("✅ Profile saved");
			this.render();
		});
		commandRow.createEl("button", { text: "Generate / Update" }).addEventListener("click", async () => {
			upsertDashboardProfile(this.plugin, profile);
			await this.plugin.saveSettings();
			await writeDashboardProfile(this.plugin, profile);
		});
		commandRow.createEl("button", { text: "Duplicate" }).addEventListener("click", async () => {
			const copy = this.cloneProfile(profile);
			upsertDashboardProfile(this.plugin, copy);
			await this.plugin.saveSettings();
			this.selectedProfileId = copy.id;
			this.render();
		});
		commandRow.createEl("button", { text: "Delete", cls: "mod-warning" }).addEventListener("click", async () => {
			if (!window.confirm(`Delete profile "${profile.name}"?`)) return;
			this.plugin.data_store.dashboardProfiles = (this.plugin.data_store.dashboardProfiles ?? []).filter((item) => item.id !== profile.id);
			await this.plugin.saveSettings();
			this.selectedProfileId = null;
			this.render();
		});

		this.renderAddBlock(parent, profile);
		this.renderBlocks(parent, profile);
		this.renderPreview(parent, profile);
	}

	private renderAddBlock(parent: HTMLElement, profile: DashboardProfile): void {
		const add = parent.createDiv({ cls: "umos-dashboard-add-block" });
		const definitions = this.plugin.widgetRegistry.getAll();
		const query = this.addWidgetSearch.trim().toLowerCase();
		const filteredDefinitions = definitions.filter((definition) =>
			this.matchesWidgetCategory(definition) && this.matchesWidgetSearch(definition, query)
		);

		this.renderWidgetFinder(add, definitions);

		if (!this.addWidgetName || !filteredDefinitions.some((definition) => definition.blockName === this.addWidgetName)) {
			this.addWidgetName = filteredDefinitions[0]?.blockName ?? definitions[0]?.blockName ?? "";
		}
		const selectedWidget = this.addWidgetName;
		const definition = this.plugin.widgetRegistry.get(selectedWidget);

		if (filteredDefinitions.length === 0) {
			add.createDiv({ cls: "umos-settings-empty", text: "Nothing found. Try another query or category." });
			return;
		}

		new Setting(add)
			.setName("Add widget")
			.addDropdown((dropdown) => {
				for (const definition of filteredDefinitions) {
					dropdown.addOption(definition.blockName, definition.title);
				}
				dropdown.setValue(selectedWidget).onChange((value) => {
					this.addWidgetName = value;
					this.render();
				});
			})
			.addButton((button) => button
				.setButtonText("Add defaults")
				.setCta()
				.onClick(() => {
					if (!definition) return;
					this.addBlockFromConfig(profile, definition.blockName, definition.defaults);
				}));

		if (!definition) {
			add.createDiv({ cls: "umos-settings-empty", text: "Choose a widget to see snippets." });
			return;
		}

		const details = add.createDiv({ cls: "umos-dashboard-add-details" });
		const head = details.createDiv({ cls: "umos-dashboard-add-details-head" });
		head.createSpan({ cls: "umos-dashboard-add-details-title", text: definition.title });
		head.createSpan({ cls: "umos-dashboard-add-details-block", text: definition.blockName });
		details.createDiv({ cls: "umos-dashboard-add-details-desc", text: definition.description });

		const snippets = this.getVisibleSnippets(definition, query);
		if (snippets.length === 0) {
			details.createDiv({ cls: "umos-settings-empty", text: "This widget has no quick snippets yet." });
			return;
		}

		const grid = details.createDiv({ cls: "umos-dashboard-snippet-grid" });
		for (const snippet of snippets) {
			const button = grid.createEl("button", {
				cls: "umos-dashboard-snippet-btn",
				attr: { type: "button", title: snippet.description },
			});
			button.createSpan({ cls: "umos-dashboard-snippet-title", text: snippet.name });
			button.createSpan({ cls: "umos-dashboard-snippet-desc", text: snippet.description });
			button.addEventListener("click", () => {
				this.addSnippetBlock(profile, definition.blockName, definition.defaults, snippet);
			});
		}
	}

	private addSnippetBlock(
		profile: DashboardProfile,
		blockName: string,
		defaults: Record<string, unknown>,
		snippet: WidgetPresetSnippet
	): void {
		this.addBlockFromConfig(profile, blockName, { ...defaults, ...snippet.config });
	}

	private addBlockFromConfig(
		profile: DashboardProfile,
		blockName: string,
		config: Record<string, unknown>
	): void {
		const block = createDashboardBlock(blockName, config, 1);
		profile.blocks.push(block);
		this.expandedBlockId = block.id;
		this.touch(profile);
		this.render();
	}

	private renderBlocks(parent: HTMLElement, profile: DashboardProfile): void {
		parent.createEl("h3", { text: "Blocks" });
		const list = parent.createDiv({ cls: "umos-dashboard-block-list" });
		if (profile.blocks.length === 0) {
			list.createDiv({ cls: "umos-settings-empty", text: "No blocks yet." });
		}

		profile.blocks.forEach((block, index) => {
			const definition = this.plugin.widgetRegistry.get(block.widget);
			const item = list.createDiv({ cls: "umos-dashboard-block-item" });
			const header = item.createDiv({ cls: "umos-dashboard-block-header" });
			const title = header.createEl("button", { text: definition?.title ?? block.widget, cls: "umos-dashboard-block-title" });
			title.addEventListener("click", () => {
				this.expandedBlockId = this.expandedBlockId === block.id ? null : block.id;
				this.render();
			});
			header.createSpan({ text: block.widget, cls: "umos-dashboard-block-name" });

			const controls = header.createDiv({ cls: "umos-dashboard-block-controls" });
			this.smallButton(controls, block.enabled ? "On" : "Off", () => {
				block.enabled = !block.enabled;
				this.touch(profile);
				this.render();
			});
			this.smallButton(controls, "↑", () => this.moveBlock(profile, index, index - 1), index === 0);
			this.smallButton(controls, "↓", () => this.moveBlock(profile, index, index + 1), index === profile.blocks.length - 1);
			this.smallButton(controls, "Copy", () => this.duplicateBlock(profile, block, index));
			this.smallButton(controls, "Delete", () => {
				profile.blocks.splice(index, 1);
				this.touch(profile);
				this.render();
			});

			if (this.expandedBlockId === block.id) {
				this.renderBlockEditor(item, profile, block);
			}
		});
	}

	private renderWidgetFinder(parent: HTMLElement, definitions: WidgetDefinition[]): void {
		const finder = parent.createDiv({ cls: "umos-dashboard-widget-finder" });
		const input = finder.createEl("input", {
			cls: "umos-dashboard-widget-search",
			attr: {
				type: "search",
				placeholder: "Search widgets or snippets...",
				value: this.addWidgetSearch,
			},
		});
		input.addEventListener("input", () => {
			this.addWidgetSearch = input.value;
			this.restoreAddWidgetSearchFocus = true;
			this.render();
		});
		if (this.restoreAddWidgetSearchFocus) {
			this.restoreAddWidgetSearchFocus = false;
			window.requestAnimationFrame(() => {
				input.focus();
				input.setSelectionRange(input.value.length, input.value.length);
			});
		}

		const categories = finder.createDiv({ cls: "umos-dashboard-widget-categories" });
		for (const category of WIDGET_CATEGORIES) {
			const count = category.id === "all"
				? definitions.length
				: definitions.filter((definition) => this.getWidgetCategory(definition) === category.id).length;
			if (category.id !== "all" && count === 0) continue;
			const button = categories.createEl("button", {
				cls: `umos-dashboard-widget-category${this.addWidgetCategory === category.id ? " is-active" : ""}`,
				attr: { type: "button" },
			});
			button.createSpan({ cls: "umos-dashboard-widget-category-label", text: category.label });
			button.createSpan({ cls: "umos-dashboard-widget-category-count", text: String(count) });
			button.addEventListener("click", () => {
				this.addWidgetCategory = category.id;
				this.render();
			});
		}
	}

	private matchesWidgetCategory(definition: WidgetDefinition): boolean {
		return this.addWidgetCategory === "all" || this.getWidgetCategory(definition) === this.addWidgetCategory;
	}

	private matchesWidgetSearch(definition: WidgetDefinition, query: string): boolean {
		if (!query) return true;
		return this.getWidgetSearchText(definition).includes(query)
			|| (definition.snippets ?? []).some((snippet) => this.getSnippetSearchText(snippet).includes(query));
	}

	private getVisibleSnippets(definition: WidgetDefinition, query: string): WidgetPresetSnippet[] {
		const snippets = definition.snippets ?? [];
		if (!query) return snippets;
		const widgetMatches = this.getWidgetSearchText(definition).includes(query);
		if (widgetMatches) return snippets;
		return snippets.filter((snippet) => this.getSnippetSearchText(snippet).includes(query));
	}

	private getWidgetSearchText(definition: WidgetDefinition): string {
		return [
			definition.blockName,
			definition.title,
			definition.description,
			this.getWidgetCategory(definition),
		].join(" ").toLowerCase();
	}

	private getSnippetSearchText(snippet: WidgetPresetSnippet): string {
		return [snippet.id, snippet.name, snippet.description].join(" ").toLowerCase();
	}

	private getWidgetCategory(definition: WidgetDefinition): string {
		const blockName = definition.blockName;
		if (["schedule", "tasks-widget", "tasks-kanban", "tasks-stats-widget", "tasks-completed-widget", "kanban-board", "umos-input", "progress-table"].includes(blockName)) {
			return "productivity";
		}
		if (["daily-nav", "word-of-day", "words-of-day", "daily-review", "umos-stats", "prayer-widget"].includes(blockName)) {
			return "daily";
		}
		if (["content-gallery", "project-gallery"].includes(blockName)) return "content";
		if (["cols-umos", "info-umos"].includes(blockName)) return "layout";
		if (["countdown", "countdown-rings"].includes(blockName)) return "time";
		if (["umos-debug"].includes(blockName)) return "system";
		return "system";
	}

	private renderBlockEditor(parent: HTMLElement, profile: DashboardProfile, block: DashboardBlock): void {
		const definition = this.plugin.widgetRegistry.get(block.widget);
		const editor = parent.createDiv({ cls: "umos-dashboard-block-editor" });
		if (!definition) {
			editor.createDiv({ cls: "umos-error-message", text: `Widget ${block.widget} not found.` });
			return;
		}

		if (profile.columns > 1) {
			new Setting(editor)
				.setName("Column")
				.addDropdown((dropdown) => {
					for (let i = 1; i <= profile.columns; i++) dropdown.addOption(String(i), String(i));
					dropdown.setValue(String(block.column || 1)).onChange((value) => {
						block.column = Number(value) || 1;
						this.touch(profile);
						this.render();
					});
				});
		}

		for (const [key, field] of Object.entries(definition.schema)) {
			this.renderField(editor, field, key, block.config, () => {
				this.touch(profile);
				this.renderPreviewOnly();
			});
		}

		const validation = this.plugin.widgetRegistry.validate(definition, block.config);
		if (validation.errors.length > 0 || validation.warnings.length > 0) {
			const panel = editor.createDiv({ cls: "umos-dashboard-validation" });
			for (const error of validation.errors) panel.createDiv({ cls: "umos-dashboard-validation-error", text: error });
			for (const warning of validation.warnings) panel.createDiv({ cls: "umos-dashboard-validation-warning", text: warning });
		}
	}

	private renderField(
		parent: HTMLElement,
		field: WidgetFieldSchema,
		key: string,
		config: Record<string, unknown>,
		onChange: () => void
	): void {
		const setting = new Setting(parent).setName(field.label || key);
		setting.setDesc(this.describeField(field));
		if (field.type === "boolean") {
			setting.addToggle((toggle) => toggle
				.setValue(config[key] === true || config[key] === "true")
				.onChange((value) => {
					config[key] = value;
					onChange();
				}));
			return;
		}
		if (field.type === "enum" && field.options) {
			setting.addDropdown((dropdown) => {
				for (const option of field.options ?? []) dropdown.addOption(option, option);
				dropdown.setValue(String(config[key] ?? field.default ?? field.options?.[0] ?? "")).onChange((value) => {
					config[key] = value;
					onChange();
				});
			});
			return;
		}
		if (field.type === "number") {
			setting.addText((text) => {
				text.inputEl.type = "number";
				text.setPlaceholder(this.placeholderForField(field));
				text.setValue(String(config[key] ?? "")).onChange((value) => {
					config[key] = Number(value);
					onChange();
				});
			});
			return;
		}
		setting.addText((text) => text
			.setPlaceholder(this.placeholderForField(field))
			.setValue(Array.isArray(config[key]) ? (config[key] as string[]).join(", ") : String(config[key] ?? ""))
			.onChange((value) => {
				config[key] = field.type === "array"
					? value.split(",").map((item) => item.trim()).filter(Boolean)
					: value;
				onChange();
			}));
	}

	private describeField(field: WidgetFieldSchema): DocumentFragment {
		const fragment = document.createDocumentFragment();
		const desc = document.createElement("span");
		desc.textContent = field.description || "";
		fragment.appendChild(desc);

		const metaParts = [
			field.type,
			field.required ? "required" : "",
			field.options?.length ? `options: ${field.options.join(", ")}` : "",
		].filter(Boolean);
		if (metaParts.length > 0) {
			const meta = document.createElement("span");
			meta.className = "umos-dashboard-field-meta";
			meta.textContent = metaParts.join(" · ");
			fragment.appendChild(meta);
		}
		return fragment;
	}

	private placeholderForField(field: WidgetFieldSchema): string {
		if (field.type === "date") return "2026-06-01 or 2026-06-01 09:00";
		if (field.type === "array") return "mood, productivity, sleep";
		if (field.type === "number") return field.min !== undefined ? String(field.min) : "0";
		if (field.type === "string") return "value";
		return "";
	}

	private renderPreview(parent: HTMLElement, profile: DashboardProfile): void {
		parent.createEl("h3", { text: "Preview" });
		const validation = parent.createDiv({
			cls: "umos-dashboard-profile-validation",
			attr: { "data-profile-validation": profile.id },
		});
		this.renderProfileValidation(validation, profile);
		const preview = parent.createDiv({ cls: "umos-dashboard-preview", attr: { "data-profile-id": profile.id } });
		void MarkdownRenderer.render(this.app, generateDashboardMarkdown(profile), preview, profile.targetPath || "", this.createPreviewComponent());
	}

	private renderPreviewOnly(): void {
		const profile = this.ensureProfiles().find((item) => item.id === this.selectedProfileId);
		const preview = this.contentEl.querySelector<HTMLElement>(".umos-dashboard-preview");
		if (!profile || !preview) return;
		const validation = this.contentEl.querySelector<HTMLElement>(".umos-dashboard-profile-validation");
		if (validation) {
			this.renderProfileValidation(validation, profile);
		}
		preview.empty();
		void MarkdownRenderer.render(this.app, generateDashboardMarkdown(profile), preview, profile.targetPath || "", this.createPreviewComponent());
	}

	private renderProfileValidation(parent: HTMLElement, profile: DashboardProfile): void {
		parent.empty();
		const items = this.collectProfileValidation(profile);
		const errors = items.filter((item) => item.type === "error");
		const warnings = items.filter((item) => item.type === "warning");

		const summary = parent.createDiv({
			cls: `umos-dashboard-profile-validation-summary${errors.length > 0 ? " has-errors" : warnings.length > 0 ? " has-warnings" : " is-ok"}`,
		});
		summary.createSpan({
			cls: "umos-dashboard-profile-validation-title",
			text: errors.length > 0
				? `${errors.length} errors`
				: warnings.length > 0
					? `${warnings.length} warnings`
					: "Validation OK",
		});
		summary.createSpan({
			cls: "umos-dashboard-profile-validation-subtitle",
			text: errors.length > 0
				? "Preview may show an error block until the profile is fixed."
				: warnings.length > 0
					? "The profile will generate, but some fields are ignored by widgets."
					: "All enabled blocks pass schema validation.",
		});

		if (items.length === 0) return;

		const list = parent.createDiv({ cls: "umos-dashboard-profile-validation-list" });
		for (const item of items.slice(0, 10)) {
			const row = list.createDiv({ cls: `umos-dashboard-profile-validation-item is-${item.type}` });
			row.createSpan({ cls: "umos-dashboard-profile-validation-block", text: item.title });
			row.createSpan({ cls: "umos-dashboard-profile-validation-message", text: item.message });
		}
		if (items.length > 10) {
			list.createDiv({
				cls: "umos-dashboard-profile-validation-more",
				text: `+ more ${items.length - 10}`,
			});
		}
	}

	private collectProfileValidation(profile: DashboardProfile): DashboardProfileValidationItem[] {
		const items: DashboardProfileValidationItem[] = [];
		for (const block of profile.blocks) {
			if (!block.enabled) continue;
			const definition = this.plugin.widgetRegistry.get(block.widget);
			if (!definition) {
				items.push({
					blockId: block.id,
					widget: block.widget,
					title: block.widget,
					type: "error",
					message: `Widget ${block.widget} is not registered.`,
				});
				continue;
			}
			if (definition.skipValidation) continue;

			const validation = this.plugin.widgetRegistry.validate(definition, block.config);
			for (const error of validation.errors) {
				items.push({
					blockId: block.id,
					widget: block.widget,
					title: definition.title,
					type: "error",
					message: error,
				});
			}
			for (const warning of validation.warnings) {
				items.push({
					blockId: block.id,
					widget: block.widget,
					title: definition.title,
					type: "warning",
					message: warning,
				});
			}
		}
		return items;
	}

	private createPreviewComponent(): Component {
		this.previewComponent?.unload();
		const component = new Component();
		component.load();
		this.previewComponent = component;
		return component;
	}

	private ensureProfiles(): DashboardProfile[] {
		if (!Array.isArray(this.plugin.data_store.dashboardProfiles)) {
			this.plugin.data_store.dashboardProfiles = [];
		}
		return this.plugin.data_store.dashboardProfiles;
	}

	private touch(profile: DashboardProfile): void {
		profile.updatedAt = Date.now();
		upsertDashboardProfile(this.plugin, profile);
	}

	private moveBlock(profile: DashboardProfile, from: number, to: number): void {
		if (to < 0 || to >= profile.blocks.length) return;
		const [block] = profile.blocks.splice(from, 1);
		profile.blocks.splice(to, 0, block);
		this.touch(profile);
		this.render();
	}

	private duplicateBlock(profile: DashboardProfile, block: DashboardBlock, index: number): void {
		const stamp = Date.now();
		const copy: DashboardBlock = {
			...block,
			id: `${block.id}-copy-${stamp}`,
			config: { ...block.config },
		};
		profile.blocks.splice(index + 1, 0, copy);
		this.expandedBlockId = copy.id;
		this.touch(profile);
		this.render();
	}

	private smallButton(parent: HTMLElement, text: string, onClick: () => void, disabled = false): void {
		const button = parent.createEl("button", { text, attr: { type: "button" } });
		button.disabled = disabled;
		button.addEventListener("click", onClick);
	}

	private cloneProfile(profile: DashboardProfile): DashboardProfile {
		const stamp = Date.now();
		return {
			...profile,
			id: `${profile.id}-copy-${stamp}`,
			name: `${profile.name} Copy`,
			widthMode: profile.widthMode ?? "default",
			blocks: profile.blocks.map((block, index) => ({
				...block,
				id: `${block.id}-copy-${stamp}-${index}`,
				config: { ...block.config },
			})),
			updatedAt: stamp,
		};
	}
}
