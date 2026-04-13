import { App, Setting } from "obsidian";
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
	sectionEl.createEl("h3", { text: title, cls: "umos-settings-section-title" });

	return sectionEl;
}

export function createSubheading(parent: HTMLElement, text: string): void {
	parent.createEl("h4", { text, cls: "umos-settings-subheading" });
}

/** Reusable list with edit/delete/reorder for array settings */
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
	}
): void {
	container.empty();

	items.forEach((item, index) => {
		const setting = new Setting(container)
			.setName(options.getName(item))
			.setDesc(options.getDesc(item));

		setting.addButton((btn) =>
			btn.setButtonText("✏️").onClick(() => options.onEdit(container, index))
		);

		setting.addButton((btn) =>
			btn.setButtonText("🗑️").setWarning().onClick(async () => {
				await options.onDelete(index);
				renderEditableList(container, items, options);
			})
		);

		if (index > 0) {
			setting.addButton((btn) =>
				btn.setButtonText("↑").onClick(async () => {
					await options.onReorder(index, index - 1);
					renderEditableList(container, items, options);
				})
			);
		}

		if (index < items.length - 1) {
			setting.addButton((btn) =>
				btn.setButtonText("↓").onClick(async () => {
					await options.onReorder(index, index + 1);
					renderEditableList(container, items, options);
				})
			);
		}
	});

	new Setting(container).addButton((btn) =>
		btn
			.setButtonText(options.addLabel)
			.setCta()
			.onClick(async () => {
				await options.onAdd();
				renderEditableList(container, items, options);
			})
	);
}

/** Render back/save buttons for edit views */
export function renderEditActions(
	container: HTMLElement,
	onBack: () => void,
	onSave: () => Promise<void>
): void {
	new Setting(container)
		.addButton((btn) => btn.setButtonText("← Назад").onClick(onBack))
		.addButton((btn) => btn.setButtonText("Сохранить").setCta().onClick(onSave));
}
