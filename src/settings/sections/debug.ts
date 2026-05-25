import { Notice, Setting } from "obsidian";
import { DEFAULT_DATA, DEFAULT_SETTINGS } from "../Settings";
import { SettingsContext, createSection } from "../helpers";
import { t } from "../../i18n";
import { WelcomeModal } from "../../WelcomeModal";

export function renderDebugSection(containerEl: HTMLElement, ctx: SettingsContext): void {
	const sectionEl = createSection(
		containerEl,
		"umos-settings-debug",
		"Debug Tools",
		"Tools for troubleshooting and maintaining your vault."
	);

	new Setting(sectionEl)
		.setName(t("Show Welcome Screen"))
		.setDesc(t("Re-open the initial welcome screen with the Vault Guide."))
		.addButton((btn) =>
			btn
				.setButtonText(t("Show"))
				.onClick(() => {
					new WelcomeModal(ctx.app, ctx.plugin).open();
				})
		);

	new Setting(sectionEl)
		.setName(t("Sync Frontmatter with Folders"))
		.setDesc(t("Dynamically clean and set type and topic across the whole vault based on folder structure."))
		.addButton((btn) =>
			btn
				.setButtonText(t("Run Sync"))
				.onClick(async () => {
					if (ctx.plugin.dynamicFrontmatterService) {
						await ctx.plugin.dynamicFrontmatterService.syncAllFiles(true);
					}
				})
		);

	new Setting(sectionEl)
		.setName(t("Generate Debug Tasks"))
		.setDesc(t("Create a 'Debug Tasks.md' file in the vault root with dynamically dated tasks for testing."))
		.addButton((btn) =>
			btn
				.setButtonText(t("Generate"))
				.onClick(async () => {
					// @ts-ignore
					const { moment } = window;
					const today = moment().format("YYYY-MM-DD");
					const yesterday = moment().subtract(1, "days").format("YYYY-MM-DD");
					const past = moment().subtract(3, "days").format("YYYY-MM-DD");
					const tomorrow = moment().add(1, "days").format("YYYY-MM-DD");
					const future = moment().add(4, "days").format("YYYY-MM-DD");

					const content = `# Задачи для дебага

## Срочные / Просроченные
- [ ] Оплатить интернет (просрочено) (due:${past}) (priority:high)
- [ ] Ответить на важное письмо (due:${yesterday}) #work

## На сегодня (${today})
- [ ] Сделать хотя бы 3 лабы по проектной деятельности (due:${today}) (priority:high)
- [ ] Сходить в магазин за продуктами (due:${today})
- [ ] Подготовить презентацию для встречи (due:${today}) (priority:medium) #presentation

## На завтра (${tomorrow})
- [ ] Встреча с научным руководителем (due:${tomorrow}) (priority:high)
- [ ] Начать читать новую книгу (due:${tomorrow}) (priority:low)

## В процессе (без привязки ко времени или на будущее)
- [/] Писать код для нового виджета задач #umos
- [/] Пройти 5 уроков по React (due:${future}) (priority:medium)
- [/] Длинная задача без срока

## Завершённые сегодня
- [x] Утренняя тренировка (done:${today})
- [x] Проверить пул-реквесты коллег (done:${today})

## Прочие (без срока / старые завершенные / отмененные)
- [ ] Просто задача в бэклоге без даты
- [-] Отмененная встреча с клиентом (due:${past})
- [x] Старая завершенная задача (done:2024-01-01)
`;

					const file = ctx.app.vault.getAbstractFileByPath("Debug Tasks.md");
					if (file) {
						// @ts-ignore
						await ctx.app.vault.modify(file, content);
					} else {
						await ctx.app.vault.create("Debug Tasks.md", content);
					}
					new Notice(t("✅ Debug Tasks generated"));
				})
		);

	new Setting(sectionEl)
		.setName(t("Reset Settings"))
		.setDesc(t("Restore all settings to their defaults."))
		.addButton((btn) =>
			btn
				.setButtonText(t("Reset"))
				.setWarning()
				.onClick(async () => {
					ctx.plugin.settings = { ...DEFAULT_SETTINGS };
					ctx.plugin.data_store = { ...DEFAULT_DATA };
					await ctx.saveSettings();
					ctx.display();
					new Notice(t("✅ Settings reset"));
				})
		);
}
