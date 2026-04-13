import { Setting } from "obsidian";
import { SettingsContext, createSection, createSubheading, renderEditableList, renderEditActions } from "../helpers";

const ALL_SECTIONS: { id: string; label: string }[] = [
	{ id: "clock",      label: "🕐 Часы" },
	{ id: "greeting",   label: "👋 Приветствие" },
	{ id: "weather",    label: "🌤 Погода" },
	{ id: "prayer",     label: "🕌 Намаз" },
	{ id: "ramadan",    label: "🌙 Рамадан" },
	{ id: "navigation", label: "🧭 Навигация" },
	{ id: "stats",      label: "📊 Показатели дня" },
	{ id: "tasks",      label: "✅ Задачи" },
	{ id: "pomodoro",   label: "⏳ Помодоро" },
	{ id: "exams",      label: "📝 Экзамены" },
	{ id: "deadlines",  label: "⚠️ Дедлайны" },
	{ id: "goals",      label: "🎯 Цели" },
	{ id: "balance",    label: "⚖️ Баланс времени" },
	{ id: "finance",    label: "💰 Финансы" },
	{ id: "projects",   label: "🚀 Проекты" },
	{ id: "content",    label: "🎬 Контент" },
	{ id: "footer",     label: "📁 Статистика vault" },
];

function renderSectionsList(container: HTMLElement, ctx: SettingsContext): void {
	container.empty();

	const visible = ctx.settings.homeVisibleSections;

	// Visible sections — ordered, with toggle + ↑/↓
	visible.forEach((id, index) => {
		const meta  = ALL_SECTIONS.find(s => s.id === id);
		const label = meta?.label ?? id;

		const setting = new Setting(container)
			.setName(label)
			.addToggle(t => t.setValue(true).setTooltip("Скрыть").onChange(async () => {
				ctx.settings.homeVisibleSections = visible.filter(s => s !== id);
				await ctx.saveSettings();
				renderSectionsList(container, ctx);
			}));

		if (index > 0) {
			setting.addButton(btn => btn.setButtonText("↑").setTooltip("Выше").onClick(async () => {
				[visible[index - 1], visible[index]] = [visible[index], visible[index - 1]];
				await ctx.saveSettings();
				renderSectionsList(container, ctx);
			}));
		}

		if (index < visible.length - 1) {
			setting.addButton(btn => btn.setButtonText("↓").setTooltip("Ниже").onClick(async () => {
				[visible[index], visible[index + 1]] = [visible[index + 1], visible[index]];
				await ctx.saveSettings();
				renderSectionsList(container, ctx);
			}));
		}
	});

	// Hidden sections — at the bottom, toggle to show
	const hidden = ALL_SECTIONS.filter(s => !visible.includes(s.id));
	if (hidden.length > 0) {
		createSubheading(container, "Скрытые");
		for (const section of hidden) {
			new Setting(container)
				.setName(section.label)
				.addToggle(t => t.setValue(false).setTooltip("Показать").onChange(async () => {
					ctx.settings.homeVisibleSections.push(section.id);
					await ctx.saveSettings();
					renderSectionsList(container, ctx);
				}));
		}
	}
}

export function renderHomeSection(containerEl: HTMLElement, ctx: SettingsContext): void {
	const sectionEl = createSection(
		containerEl,
		"umos-settings-home",
		"Главная",
		"Home-дашборд: пути, видимые блоки и навигация."
	);

	createSubheading(sectionEl, "Пути");

	new Setting(sectionEl)
		.setName("Папка проектов")
		.addText((text) =>
			text.setPlaceholder("20 Projects").setValue(ctx.settings.homeProjectsPath)
				.onChange(async (value) => { ctx.settings.homeProjectsPath = value; await ctx.saveSettings(); })
		);

	new Setting(sectionEl)
		.setName("Папка контента")
		.addText((text) =>
			text.setPlaceholder("30 Content").setValue(ctx.settings.homeContentPath)
				.onChange(async (value) => { ctx.settings.homeContentPath = value; await ctx.saveSettings(); })
		);

	createSubheading(sectionEl, "Секции и порядок");

	const sectionsContainer = sectionEl.createDiv();
	renderSectionsList(sectionsContainer, ctx);

	createSubheading(sectionEl, "Навигационные карточки");

	const navContainer = sectionEl.createDiv();
	renderNavCardsList(navContainer, ctx);
}

function renderNavCardsList(container: HTMLElement, ctx: SettingsContext): void {
	const cards = ctx.settings.homeNavCards;

	renderEditableList(container, cards, {
		getName: (c) => `${c.icon} ${c.name}`,
		getDesc: (c) => `${c.path} | ${c.color}`,
		onEdit: (cont, i) => editNavCard(cont, i, ctx),
		onDelete: async (i) => {
			cards.splice(i, 1);
			await ctx.saveSettings();
		},
		onReorder: async (from, to) => {
			const temp = cards[to];
			cards[to] = cards[from];
			cards[from] = temp;
			await ctx.saveSettings();
		},
		onAdd: async () => {
			cards.push({ name: "Новая", path: "", icon: "📄", color: "#7c3aed" });
			await ctx.saveSettings();
		},
		addLabel: "+ Добавить карточку",
	});
}

function editNavCard(container: HTMLElement, index: number, ctx: SettingsContext): void {
	const card = { ...ctx.settings.homeNavCards[index] };
	container.empty();
	container.createEl("h4", { text: `${card.icon} ${card.name}` });

	new Setting(container).setName("Название").addText((t) => t.setValue(card.name).onChange((v) => { card.name = v; }));
	new Setting(container).setName("Путь").addText((t) => t.setValue(card.path).onChange((v) => { card.path = v; }));
	new Setting(container).setName("Иконка").addText((t) => t.setValue(card.icon).onChange((v) => { card.icon = v; }));
	new Setting(container).setName("Цвет").addText((t) => t.setValue(card.color).onChange((v) => { card.color = v; }));

	renderEditActions(container,
		() => renderNavCardsList(container, ctx),
		async () => {
			ctx.settings.homeNavCards[index] = card;
			await ctx.saveSettings();
			renderNavCardsList(container, ctx);
		}
	);
}
