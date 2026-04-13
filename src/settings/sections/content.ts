import { Setting } from "obsidian";
import { SettingsContext, createSection, createSubheading, renderEditableList, renderEditActions } from "../helpers";

export function renderContentSection(containerEl: HTMLElement, ctx: SettingsContext): void {
	const sectionEl = createSection(
		containerEl,
		"umos-settings-content",
		"Галерея контента",
		"Типы контента для медиатеки. Каждый тип = подпапка."
	);

	const listContainer = sectionEl.createDiv();
	renderContentTypesList(listContainer, ctx);
}

function renderContentTypesList(container: HTMLElement, ctx: SettingsContext): void {
	const types = ctx.settings.contentTypes;

	renderEditableList(container, types, {
		getName: (ct) => `${ct.icon} ${ct.label}`,
		getDesc: (ct) => `${ct.folder} | ${ct.key} | ${ct.color}`,
		onEdit: (c, i) => editContentType(c, i, ctx),
		onDelete: async (i) => {
			types.splice(i, 1);
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
				label: "Новый тип",
				icon: "📄",
				folder: "NewType",
				color: "#7c3aed",
				epField: "",
				totalField: "",
				unit: "",
			});
			await ctx.saveSettings();
		},
		addLabel: "+ Добавить тип контента",
	});
}

function editContentType(container: HTMLElement, index: number, ctx: SettingsContext): void {
	const ct = { ...ctx.settings.contentTypes[index] };
	container.empty();
	container.createEl("h4", { text: `${ct.icon} ${ct.label}` });

	new Setting(container).setName("Ключ").setDesc("Не менять после создания заметок")
		.addText((t) => t.setValue(ct.key).onChange((v) => { ct.key = v; }));
	new Setting(container).setName("Название")
		.addText((t) => t.setValue(ct.label).onChange((v) => { ct.label = v; }));
	new Setting(container).setName("Иконка")
		.addText((t) => t.setValue(ct.icon).onChange((v) => { ct.icon = v; }));
	new Setting(container).setName("Папка").setDesc("Подпапка в папке контента")
		.addText((t) => t.setValue(ct.folder).onChange((v) => { ct.folder = v; }));
	new Setting(container).setName("Цвет")
		.addText((t) => t.setValue(ct.color).onChange((v) => { ct.color = v; }));

	createSubheading(container, "Прогресс");

	new Setting(container).setName("Поле текущего значения").setDesc("current_episode, current_page...")
		.addText((t) => t.setPlaceholder("current_episode").setValue(ct.epField).onChange((v) => { ct.epField = v; }));
	new Setting(container).setName("Поле общего количества").setDesc("total_episodes, total_pages...")
		.addText((t) => t.setPlaceholder("total_episodes").setValue(ct.totalField).onChange((v) => { ct.totalField = v; }));
	new Setting(container).setName("Единица").setDesc("эп., стр., ч.")
		.addText((t) => t.setPlaceholder("эп.").setValue(ct.unit).onChange((v) => { ct.unit = v; }));

	renderEditActions(container,
		() => renderContentTypesList(container, ctx),
		async () => {
			ctx.settings.contentTypes[index] = ct;
			await ctx.saveSettings();
			renderContentTypesList(container, ctx);
		}
	);
}
