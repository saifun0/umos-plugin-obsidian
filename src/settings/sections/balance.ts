import { Setting } from "obsidian";
import { SettingsContext, createSection, createSubheading, renderEditableList, renderEditActions } from "../helpers";

export function renderBalanceSection(containerEl: HTMLElement, ctx: SettingsContext): void {
	const sectionEl = createSection(
		containerEl,
		"umos-settings-balance",
		"Баланс времени",
		"Система Work-Play Balance: зарабатывай время продуктивностью, трать на развлечения."
	);

	// ── General ──────────────────────────────────────────────────────────────

	createSubheading(sectionEl, "Общие настройки");

	new Setting(sectionEl)
		.setName("Максимум баланса (мин)")
		.setDesc("Потолок накопленного баланса. 0 = без ограничений.")
		.addText(t => t
			.setValue(String(ctx.settings.balanceMaxTotal))
			.setPlaceholder("480")
			.onChange(async v => {
				const n = parseInt(v);
				if (!isNaN(n) && n >= 0) { ctx.settings.balanceMaxTotal = n; await ctx.saveSettings(); }
			})
		);

	new Setting(sectionEl)
		.setName("Дневной лимит заработка (мин)")
		.setDesc("Максимум зарабатываемых минут в день. 0 = без ограничений.")
		.addText(t => t
			.setValue(String(ctx.settings.balanceMaxDailyEarnings))
			.setPlaceholder("0")
			.onChange(async v => {
				const n = parseInt(v);
				if (!isNaN(n) && n >= 0) { ctx.settings.balanceMaxDailyEarnings = n; await ctx.saveSettings(); }
			})
		);

	new Setting(sectionEl)
		.setName("Ежедневный бонус (мин)")
		.setDesc("Бесплатные минуты раз в день. 0 = выключено.")
		.addText(t => t
			.setValue(String(ctx.settings.balanceDailyBonus))
			.setPlaceholder("0")
			.onChange(async v => {
				const n = parseInt(v);
				if (!isNaN(n) && n >= 0) { ctx.settings.balanceDailyBonus = n; await ctx.saveSettings(); }
			})
		);

	new Setting(sectionEl)
		.setName("Разрешить отрицательный баланс")
		.setDesc("Если выключено — нельзя тратить больше, чем накоплено.")
		.addToggle(t => t
			.setValue(ctx.settings.balanceAllowNegative)
			.onChange(async v => { ctx.settings.balanceAllowNegative = v; await ctx.saveSettings(); })
		);

	// ── Activity types ────────────────────────────────────────────────────────

	createSubheading(sectionEl, "Виды активности (заработок)");

	const activityContainer = sectionEl.createDiv();
	renderActivityList(activityContainer, ctx);

	// ── Entertainment types ───────────────────────────────────────────────────

	createSubheading(sectionEl, "Виды развлечений (трата)");

	const entertainmentContainer = sectionEl.createDiv();
	renderEntertainmentList(entertainmentContainer, ctx);

	// ── Daily note rules ──────────────────────────────────────────────────────

	createSubheading(sectionEl, "Автоначисление из дневных заметок");
	sectionEl.createEl("p", {
		cls: "setting-item-description",
		text: "Каждые N единиц поля в дневной заметке = +X минут баланса.",
	});

	const rulesContainer = sectionEl.createDiv();
	renderDailyNoteRulesList(rulesContainer, ctx);
}

// ── Activity list ─────────────────────────────────────────────────────────────

function renderActivityList(container: HTMLElement, ctx: SettingsContext): void {
	const items = ctx.settings.balanceActivityTypes;
	renderEditableList(container, items, {
		getName: (a) => `${a.icon} ${a.label}`,
		getDesc: (a) => `×${a.multiplier} · ${a.color}`,
		onEdit: (c, i) => editActivity(c, i, ctx, container),
		onDelete: async (i) => { items.splice(i, 1); await ctx.saveSettings(); },
		onReorder: async (from, to) => {
			const tmp = items[to]; items[to] = items[from]; items[from] = tmp;
			await ctx.saveSettings();
		},
		onAdd: async () => {
			items.push({ id: `act_${Date.now()}`, label: "Новая", icon: "⚡", color: "#7c3aed", multiplier: 1.0 });
			await ctx.saveSettings();
		},
		addLabel: "+ Добавить активность",
	});
}

function editActivity(container: HTMLElement, index: number, ctx: SettingsContext, listContainer: HTMLElement): void {
	const item = { ...ctx.settings.balanceActivityTypes[index] };
	container.empty();
	container.createEl("h4", { text: `${item.icon} ${item.label}` });

	new Setting(container).setName("Название").addText(t => t.setValue(item.label).onChange(v => { item.label = v; }));
	new Setting(container).setName("Иконка").addText(t => t.setValue(item.icon).onChange(v => { item.icon = v; }));
	new Setting(container).setName("Цвет").addText(t => t.setValue(item.color).onChange(v => { item.color = v; }));
	new Setting(container).setName("Множитель").setDesc("1.0 = 1мин работы → 1мин баланса. 1.5 = 1мин → 1.5мин.")
		.addText(t => t.setValue(String(item.multiplier)).onChange(v => {
			const n = parseFloat(v); if (!isNaN(n) && n > 0) item.multiplier = n;
		}));

	renderEditActions(container, () => renderActivityList(listContainer, ctx), async () => {
		ctx.settings.balanceActivityTypes[index] = item;
		await ctx.saveSettings();
		renderActivityList(listContainer, ctx);
	});
}

// ── Entertainment list ────────────────────────────────────────────────────────

function renderEntertainmentList(container: HTMLElement, ctx: SettingsContext): void {
	const items = ctx.settings.balanceEntertainmentTypes;
	renderEditableList(container, items, {
		getName: (e) => `${e.icon} ${e.label}`,
		getDesc: (e) => `×${e.drainMultiplier} · ${e.color}`,
		onEdit: (c, i) => editEntertainment(c, i, ctx, container),
		onDelete: async (i) => { items.splice(i, 1); await ctx.saveSettings(); },
		onReorder: async (from, to) => {
			const tmp = items[to]; items[to] = items[from]; items[from] = tmp;
			await ctx.saveSettings();
		},
		onAdd: async () => {
			items.push({ id: `ent_${Date.now()}`, label: "Новое", icon: "🎯", color: "#95a5a6", drainMultiplier: 1.0 });
			await ctx.saveSettings();
		},
		addLabel: "+ Добавить развлечение",
	});
}

function editEntertainment(container: HTMLElement, index: number, ctx: SettingsContext, listContainer: HTMLElement): void {
	const item = { ...ctx.settings.balanceEntertainmentTypes[index] };
	container.empty();
	container.createEl("h4", { text: `${item.icon} ${item.label}` });

	new Setting(container).setName("Название").addText(t => t.setValue(item.label).onChange(v => { item.label = v; }));
	new Setting(container).setName("Иконка").addText(t => t.setValue(item.icon).onChange(v => { item.icon = v; }));
	new Setting(container).setName("Цвет").addText(t => t.setValue(item.color).onChange(v => { item.color = v; }));
	new Setting(container).setName("Множитель расхода").setDesc("1.0 = 1мин развлечений = 1мин баланса. 0.5 = тратит вдвое меньше.")
		.addText(t => t.setValue(String(item.drainMultiplier)).onChange(v => {
			const n = parseFloat(v); if (!isNaN(n) && n > 0) item.drainMultiplier = n;
		}));

	renderEditActions(container, () => renderEntertainmentList(listContainer, ctx), async () => {
		ctx.settings.balanceEntertainmentTypes[index] = item;
		await ctx.saveSettings();
		renderEntertainmentList(listContainer, ctx);
	});
}

// ── Daily note rules list ─────────────────────────────────────────────────────

function renderDailyNoteRulesList(container: HTMLElement, ctx: SettingsContext): void {
	const items = ctx.settings.balanceDailyNoteRules;
	renderEditableList(container, items, {
		getName: (r) => `${r.icon} ${r.label}`,
		getDesc: (r) => `${r.field}: каждые ${r.unitsPerEarn} ед. → +${r.earnMinutes} мин`,
		onEdit: (c, i) => editDailyNoteRule(c, i, ctx, container),
		onDelete: async (i) => { items.splice(i, 1); await ctx.saveSettings(); },
		onReorder: async (from, to) => {
			const tmp = items[to]; items[to] = items[from]; items[from] = tmp;
			await ctx.saveSettings();
		},
		onAdd: async () => {
			items.push({ field: "exercise", unitsPerEarn: 5, earnMinutes: 2, label: "Новое правило", icon: "📋" });
			await ctx.saveSettings();
		},
		addLabel: "+ Добавить правило",
	});
}

function editDailyNoteRule(container: HTMLElement, index: number, ctx: SettingsContext, listContainer: HTMLElement): void {
	const item = { ...ctx.settings.balanceDailyNoteRules[index] };
	container.empty();
	container.createEl("h4", { text: `${item.icon} ${item.label}` });

	new Setting(container).setName("Поле в frontmatter").setDesc("Например: exercise, reading, water")
		.addText(t => t.setValue(item.field).onChange(v => { item.field = v.trim(); }));
	new Setting(container).setName("Название").addText(t => t.setValue(item.label).onChange(v => { item.label = v; }));
	new Setting(container).setName("Иконка").addText(t => t.setValue(item.icon).onChange(v => { item.icon = v; }));
	new Setting(container).setName("Единиц на порцию").setDesc("Сколько единиц = 1 порция зачисления")
		.addText(t => t.setValue(String(item.unitsPerEarn)).onChange(v => {
			const n = parseInt(v); if (!isNaN(n) && n > 0) item.unitsPerEarn = n;
		}));
	new Setting(container).setName("Минут за порцию").setDesc("Сколько минут баланса за 1 порцию")
		.addText(t => t.setValue(String(item.earnMinutes)).onChange(v => {
			const n = parseInt(v); if (!isNaN(n) && n > 0) item.earnMinutes = n;
		}));

	renderEditActions(container, () => renderDailyNoteRulesList(listContainer, ctx), async () => {
		ctx.settings.balanceDailyNoteRules[index] = item;
		await ctx.saveSettings();
		renderDailyNoteRulesList(listContainer, ctx);
	});
}
