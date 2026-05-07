import { Setting } from "obsidian";
import {
	SettingsContext,
	createSection,
	createSubheading,
	renderEditableList,
	renderEditActions,
} from "../helpers";

export function renderContentSection(containerEl: HTMLElement, ctx: SettingsContext): void {
	const sectionEl = createSection(
		containerEl,
		"umos-settings-content",
		"Content Gallery",
		"Content types for the media library. Each type has its own subfolder and progress rules."
	);

	createSubheading(sectionEl, "Content Types");

	const listContainer = sectionEl.createDiv();
	renderContentTypesList(listContainer, ctx);
}

function renderContentTypesList(container: HTMLElement, ctx: SettingsContext): void {
	const types = ctx.settings.contentTypes;

	renderEditableList(container, types, {
		getName: (ct) => `${ct.icon} ${ct.label}`,
		getDesc: (ct) => `${ct.folder} • ${ct.key} • ${ct.color}`,
		onEdit: (innerContainer, index) => editContentType(innerContainer, index, ctx),
		onDelete: async (index) => {
			types.splice(index, 1);
			await ctx.saveSettings();
		},
		onReorder: async (from, to) => {
			const temp = types[to];
			types[to] = types[from];
			types[from] = temp;
			await ctx.saveSettings();
		},
		onAdd: async () => {
			types.push({
				key: `type_${Date.now()}`,
				label: "New Type",
				icon: "📄",
				folder: "NewType",
				color: "#7c3aed",
				epField: "",
				totalField: "",
				unit: "",
			});
			await ctx.saveSettings();
		},
		addLabel: "+ Add Content Type",
		emptyState: "No content types yet. Add at least one so the gallery is not empty.",
	});
}

function editContentType(container: HTMLElement, index: number, ctx: SettingsContext): void {
	const contentType = { ...ctx.settings.contentTypes[index] };
	container.empty();

	const editor = container.createDiv({ cls: "umos-settings-editor" });
	editor.createEl("h4", {
		text: `${contentType.icon} ${contentType.label || "Content Type"}`,
		cls: "umos-settings-editor-title",
	});
	editor.createEl("p", {
		text: "The key is used in frontmatter and should not change after notes of this type have been created.",
		cls: "umos-settings-editor-desc",
	});

	new Setting(editor)
		.setName("Key")
		.setDesc("Internal frontmatter identifier.")
		.addText((text) =>
			text.setValue(contentType.key).onChange((value) => {
				contentType.key = value;
			})
		);

	new Setting(editor)
		.setName("Title")
		.addText((text) =>
			text.setValue(contentType.label).onChange((value) => {
				contentType.label = value;
			})
		);

	new Setting(editor)
		.setName("Icon")
		.addText((text) =>
			text.setValue(contentType.icon).onChange((value) => {
				contentType.icon = value;
			})
		);

	new Setting(editor)
		.setName("Folder")
		.setDesc("Subfolder inside the root content folder.")
		.addText((text) =>
			text.setValue(contentType.folder).onChange((value) => {
				contentType.folder = value;
			})
		);

	new Setting(editor)
		.setName("Color")
		.setDesc("HEX accent color for cards.")
		.addText((text) =>
			text.setValue(contentType.color).onChange((value) => {
				contentType.color = value;
			})
		);

	createSubheading(editor, "Progress");

	new Setting(editor)
		.setName("Current Value Field")
		.setDesc("For example: current_episode, current_page")
		.addText((text) =>
			text
				.setPlaceholder("current_episode")
				.setValue(contentType.epField)
				.onChange((value) => {
					contentType.epField = value;
				})
		);

	new Setting(editor)
		.setName("Total Value Field")
		.setDesc("For example: total_episodes, total_pages")
		.addText((text) =>
			text
				.setPlaceholder("total_episodes")
				.setValue(contentType.totalField)
				.onChange((value) => {
					contentType.totalField = value;
				})
		);

	new Setting(editor)
		.setName("Unit")
		.setDesc("For example: ep., pages, h")
		.addText((text) =>
			text
				.setPlaceholder("ep.")
				.setValue(contentType.unit)
				.onChange((value) => {
					contentType.unit = value;
				})
		);

	renderEditActions(
		editor,
		() => renderContentTypesList(container, ctx),
		async () => {
			ctx.settings.contentTypes[index] = contentType;
			await ctx.saveSettings();
			renderContentTypesList(container, ctx);
		}
	);
}
