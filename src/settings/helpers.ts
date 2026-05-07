import { App, setIcon } from "obsidian";
import type UmOSPlugin from "../main";
import type { UmOSSettings, UmOSData } from "./Settings";

export interface SettingsContext {
	app: App;
	plugin: UmOSPlugin;
	settings: UmOSSettings;
	data_store: UmOSData;
	saveSettings: () => Promise<void>;
	display: () => void;
}

export function createSection(
	containerEl: HTMLElement,
	id: string,
	title: string,
	description?: string
): HTMLElement {
	const sectionEl = containerEl.createDiv({ cls: "umos-settings-section" });
	sectionEl.id = id;

	const headerEl = sectionEl.createDiv({ cls: "umos-settings-section-header" });
	headerEl.createEl("h3", { text: title, cls: "umos-settings-section-title" });

	if (description) {
		headerEl.createEl("p", { text: description, cls: "umos-settings-section-desc" });
	}

	return sectionEl;
}

export function createSubheading(parent: HTMLElement, text: string): void {
	parent.createEl("h4", { text, cls: "umos-settings-subheading" });
}

export function createIconButton(
	container: HTMLElement,
	icon: string,
	label: string,
	onClick: () => void | Promise<void>,
	extraClasses: string[] = []
): HTMLButtonElement {
	const btn = container.createEl("button", {
		cls: "clickable-icon umos-settings-icon-btn",
		attr: {
			type: "button",
			"aria-label": label,
			title: label,
		},
	});

	extraClasses.forEach((cls) => btn.addClass(cls));
	setIcon(btn, icon);
	btn.addEventListener("click", () => void onClick());
	return btn;
}

export function renderEditableList<T extends object>(
	container: HTMLElement,
	items: T[],
	options: {
		getName: (item: T) => string;
		getDesc: (item: T) => string;
		onEdit: (container: HTMLElement, index: number) => void;
		onDelete: (index: number) => Promise<void>;
		onReorder: (from: number, to: number) => Promise<void>;
		onAdd: () => Promise<void>;
		addLabel: string;
		emptyState?: string;
	}
): void {
	container.empty();

	const listEl = container.createDiv({ cls: "umos-settings-list" });
	if (items.length === 0) {
		listEl.createDiv({
			cls: "umos-settings-empty",
			text: options.emptyState ?? "Nothing here yet.",
		});
	}

	items.forEach((item, index) => {
		const itemEl = listEl.createDiv({ cls: "umos-settings-list-item" });
		const bodyEl = itemEl.createDiv({ cls: "umos-settings-list-body" });
		bodyEl.createEl("div", {
			cls: "umos-settings-list-title",
			text: options.getName(item),
		});

		const desc = options.getDesc(item).trim();
		if (desc.length > 0) {
			bodyEl.createEl("div", {
				cls: "umos-settings-list-desc",
				text: desc,
			});
		}

		const actionsEl = itemEl.createDiv({ cls: "umos-settings-list-actions" });
		createIconButton(actionsEl, "pencil", "Change", () => options.onEdit(container, index));
		createIconButton(actionsEl, "trash-2", "Delete", async () => {
			await options.onDelete(index);
			renderEditableList(container, items, options);
		}, ["is-danger"]);

		if (index > 0) {
			createIconButton(actionsEl, "arrow-up", "Move up", async () => {
				await options.onReorder(index, index - 1);
				renderEditableList(container, items, options);
			});
		}

		if (index < items.length - 1) {
			createIconButton(actionsEl, "arrow-down", "Move down", async () => {
				await options.onReorder(index, index + 1);
				renderEditableList(container, items, options);
			});
		}
	});

	const footerEl = container.createDiv({ cls: "umos-settings-list-footer" });
	const addBtn = footerEl.createEl("button", {
		cls: "mod-cta umos-settings-add-btn",
		text: options.addLabel,
		attr: { type: "button" },
	});
	addBtn.addEventListener("click", async () => {
		await options.onAdd();
		renderEditableList(container, items, options);
	});
}

export function renderEditActions(
	container: HTMLElement,
	onBack: () => void,
	onSave: () => Promise<void>
): void {
	const actionsEl = container.createDiv({ cls: "umos-settings-editor-actions" });

	const backBtn = actionsEl.createEl("button", {
		cls: "umos-settings-secondary-btn",
		text: "Back",
		attr: { type: "button" },
	});
	backBtn.addEventListener("click", onBack);

	const saveBtn = actionsEl.createEl("button", {
		cls: "mod-cta umos-settings-primary-btn",
		text: "Save",
		attr: { type: "button" },
	});
	saveBtn.addEventListener("click", () => void onSave());
}
