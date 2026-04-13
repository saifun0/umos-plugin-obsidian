import { Setting } from "obsidian";
import { SettingsContext, createSection, renderEditableList, renderEditActions } from "../helpers";

export function renderFinanceSection(containerEl: HTMLElement, ctx: SettingsContext): void {
	const sectionEl = createSection(
		containerEl,
		"umos-settings-finance",
		"Финансы",
		"Управление категориями расходов и бюджетом."
	);

	new Setting(sectionEl)
		.setName("Валюта")
		.setDesc("Символ валюты для отображения")
		.addText((text) =>
			text.setValue(ctx.settings.financeCurrency)
				.setPlaceholder("₽")
				.onChange(async (value) => {
					ctx.settings.financeCurrency = value || "₽";
					await ctx.saveSettings();
				})
		);

	new Setting(sectionEl)
		.setName("Средний месячный бюджет")
		.setDesc(ctx.settings.financeCurrency || "₽")
		.addSlider((slider) =>
			slider.setLimits(1000, 100000, 1000)
				.setValue(ctx.settings.financeDefaultMonthlyBudget)
				.setDynamicTooltip()
				.onChange(async (value) => {
					ctx.settings.financeDefaultMonthlyBudget = value;
					await ctx.saveSettings();
				})
		);

	const listContainer = sectionEl.createDiv();
	renderFinanceCategoriesList(listContainer, ctx);
}

function renderFinanceCategoriesList(container: HTMLElement, ctx: SettingsContext): void {
	const categories = ctx.settings.financeCategories;

	renderEditableList(container, categories, {
		getName: (c) => `${c.icon} ${c.name}`,
		getDesc: (c) => `${c.id}`,
		onEdit: (c, i) => editFinanceCategory(c, i, ctx),
		onDelete: async (i) => {
			categories.splice(i, 1);
			await ctx.saveSettings();
		},
		onReorder: async (from, to) => {
			const temp = categories[to];
			categories[to] = categories[from];
			categories[from] = temp;
			await ctx.saveSettings();
		},
		onAdd: async () => {
			categories.push({
				id: `cat_${Date.now()}`,
				name: "Новая категория",
				icon: "📦",
				color: "#95a5a6",
			});
			await ctx.saveSettings();
		},
		addLabel: "+ Добавить категорию",
	});
}

function editFinanceCategory(container: HTMLElement, index: number, ctx: SettingsContext): void {
	const category = ctx.settings.financeCategories[index];
	container.empty();
	container.createEl("h4", { text: `${category.icon} ${category.name}` });

	new Setting(container)
		.setName("ID (в коде)")
		.addText((t) => t.setValue(category.id).onChange((v) => { category.id = v; }));

	new Setting(container)
		.setName("Название")
		.addText((t) => t.setValue(category.name).onChange((v) => { category.name = v; }));

	new Setting(container)
		.setName("Иконка")
		.addText((t) => t.setValue(category.icon).onChange((v) => { category.icon = v; }));

	new Setting(container)
		.setName("Цвет")
		.addText((t) => t.setValue(category.color).onChange((v) => { category.color = v; }));

	renderEditActions(
		container,
		() => renderFinanceCategoriesList(container, ctx),
		async () => {
			ctx.settings.financeCategories[index] = category;
			await ctx.saveSettings();
			renderFinanceCategoriesList(container, ctx);
		}
	);
}
