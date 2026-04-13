import { Setting } from "obsidian";
import { SettingsContext, createSection } from "../helpers";

export function renderProfileSection(containerEl: HTMLElement, ctx: SettingsContext): void {
	const sectionEl = createSection(
		containerEl,
		"umos-settings-profile",
		"Профиль",
		"Никнейм, аватарка и GIF-оверлей."
	);

	new Setting(sectionEl)
		.setName("Никнейм")
		.setDesc("Отображается в Quick Hub")
		.addText((text) =>
			text.setPlaceholder("Имя пользователя")
				.setValue(ctx.settings.userNickname ?? "")
				.onChange(async (value) => { ctx.settings.userNickname = value; await ctx.saveSettings(); })
		);

	new Setting(sectionEl)
		.setName("Аватарка")
		.setDesc("URL или путь к файлу в хранилище (например: 00 Files/avatar.png)")
		.addText((text) =>
			text.setPlaceholder("https://... или 00 Files/avatar.png")
				.setValue(ctx.settings.userAvatarUrl ?? "")
				.onChange(async (value) => { ctx.settings.userAvatarUrl = value; await ctx.saveSettings(); })
		);

	// ── GIF overlay ──────────────────────────────────────────────────────

	new Setting(sectionEl)
		.setName("GIF-оверлей")
		.setDesc("Показывать GIF поверх интерфейса")
		.addToggle((toggle) =>
			toggle.setValue(ctx.settings.gifEnabled ?? false)
				.onChange(async (value) => {
					ctx.settings.gifEnabled = value;
					await ctx.saveSettings();
				})
		);

	new Setting(sectionEl)
		.setName("Путь / URL GIF")
		.setDesc("URL или путь в хранилище (например: 00 Files/anim.gif)")
		.addText((text) =>
			text.setPlaceholder("https://... или 00 Files/anim.gif")
				.setValue(ctx.settings.gifPath ?? "")
				.onChange(async (value) => { ctx.settings.gifPath = value; await ctx.saveSettings(); })
		);

	new Setting(sectionEl)
		.setName("Максимальная высота GIF")
		.setDesc("px — ограничивает высоту картинки в сайдбаре (ширина всегда 100%)")
		.addSlider((slider) =>
			slider.setLimits(80, 500, 10)
				.setValue(ctx.settings.gifSize ?? 240)
				.setDynamicTooltip()
				.onChange(async (value) => { ctx.settings.gifSize = value; await ctx.saveSettings(); })
		);

	new Setting(sectionEl)
		.setName("Анимация GIF")
		.setDesc("Плавное покачивание персонажа")
		.addDropdown((dd) =>
			dd.addOption("none",  "Нет")
				.addOption("float", "Парение (вверх-вниз)")
				.addOption("swing", "Покачивание")
				.setValue(ctx.settings.gifAnimation ?? "float")
				.onChange(async (value) => {
					ctx.settings.gifAnimation = value as "none" | "float" | "swing";
					await ctx.saveSettings();
				})
		);

	new Setting(sectionEl)
		.setName("Стеклянный контейнер")
		.setDesc("Матовый полупрозрачный фрейм вокруг GIF")
		.addToggle((toggle) =>
			toggle.setValue(ctx.settings.gifGlass ?? false)
				.onChange(async (value) => {
					ctx.settings.gifGlass = value;
					await ctx.saveSettings();
				})
		);

	new Setting(sectionEl)
		.setName("Свечение")
		.setDesc("Подсветка в цвет акцента плагина")
		.addToggle((toggle) =>
			toggle.setValue(ctx.settings.gifGlow ?? false)
				.onChange(async (value) => {
					ctx.settings.gifGlow = value;
					await ctx.saveSettings();
				})
		);

	new Setting(sectionEl)
		.setName("SVG-разделитель")
		.setDesc("Путь к .svg в хранилище (00 Files/div.svg) или инлайн-код <svg…/>. Пусто — градиентная линия по умолчанию.")
		.addText((text) =>
			text.setPlaceholder("<svg…> или 00 Files/divider.svg")
				.setValue(ctx.settings.gifDividerSvg ?? "")
				.onChange(async (value) => {
					ctx.settings.gifDividerSvg = value;
					await ctx.saveSettings();
				})
		);

	// ── Инфобокс ─────────────────────────────────────────────────────

	const infoboxEl = createSection(
		containerEl,
		"umos-settings-infobox",
		"Инфобокс (info-umos)",
		"Настройки блока ```info-umos``` — карточка в стиле Википедии."
	);

	new Setting(infoboxEl)
		.setName("Следовать за экраном")
		.setDesc("Инфобокс остаётся виден при скролле (позиция фиксируется на экране)")
		.addToggle((toggle) =>
			toggle.setValue(ctx.settings.infoboxSticky ?? false)
				.onChange(async (value) => {
					ctx.settings.infoboxSticky = value;
					await ctx.saveSettings();
				})
		);
}
