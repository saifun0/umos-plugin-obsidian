import { Notice, Setting, TFile } from "obsidian";
import { SettingsContext, createSection } from "../helpers";
import { CodeIconGalleryModal } from "../../formatting/CodeIconGalleryModal";

const DEMO_NOTE_PATH = "05 Dashboards/umOS-Demo.md";
const DEBUG_FORMATTING_NOTE_PATH = "99 Trash/umOS-Formatting-Debug.md";

export function renderDemoNoteSection(containerEl: HTMLElement, ctx: SettingsContext): void {
	const sectionEl = createSection(
		containerEl,
		"umos-settings-demo-note",
		"Demo Note",
		"Create a note with current plugin widgets and configuration examples."
	);

	new Setting(sectionEl)
		.setName("Create Demo Note")
		.setDesc(`This file will be created ${DEMO_NOTE_PATH}.`)
		.addButton((btn) =>
			btn
				.setButtonText("Create")
				.setCta()
				.onClick(async () => {
					btn.setDisabled(true);
					btn.setButtonText("Created...");
					try {
						await createDemoNote(ctx);
						new Notice(`✅ Demo note created: ${DEMO_NOTE_PATH}`);
					} catch (error) {
						console.error("umOS: failed to create demo note:", error);
						new Notice("❌ Failed to create demo note");
					} finally {
						btn.setDisabled(false);
						btn.setButtonText("Create");
					}
				})
		);

	new Setting(sectionEl)
		.setName("Create debug-note")
		.setDesc(`This file will be created ${DEBUG_FORMATTING_NOTE_PATH}.`)
		.addButton((btn) =>
			btn
				.setButtonText("Create")
				.onClick(async () => {
					btn.setDisabled(true);
					btn.setButtonText("Created...");
					try {
						await createFormattingDebugNote(ctx);
						new Notice(`✅ Debug note created: ${DEBUG_FORMATTING_NOTE_PATH}`);
					} catch (error) {
						console.error("umOS: failed to create formatting debug note:", error);
						new Notice("❌ Failed to create debug note");
					} finally {
						btn.setDisabled(false);
						btn.setButtonText("Create");
					}
				})
		);

	new Setting(sectionEl)
		.setName("Code block icons")
		.setDesc("Preview bundled language icons used by styled code blocks.")
		.addButton((btn) =>
			btn
				.setButtonText("Open gallery")
				.onClick(() => new CodeIconGalleryModal(ctx.app).open())
		);
}

async function createDemoNote(ctx: SettingsContext): Promise<void> {
	const vault = ctx.app.vault;
	const dir = "05 Dashboards";
	if (!vault.getAbstractFileByPath(dir)) {
		await vault.createFolder(dir);
	}

	const content = buildDemoNoteContent();
	const existing = vault.getAbstractFileByPath(DEMO_NOTE_PATH);
	if (existing instanceof TFile) {
		await vault.modify(existing, content);
	} else {
		await vault.create(DEMO_NOTE_PATH, content);
	}

	await ctx.app.workspace.openLinkText(DEMO_NOTE_PATH, "", false);
}

async function createFormattingDebugNote(ctx: SettingsContext): Promise<void> {
	const vault = ctx.app.vault;
	const dir = "99 Trash";
	if (!vault.getAbstractFileByPath(dir)) {
		await vault.createFolder(dir);
	}

	const content = buildFormattingDebugNoteContent();
	const existing = vault.getAbstractFileByPath(DEBUG_FORMATTING_NOTE_PATH);
	if (existing instanceof TFile) {
		await vault.modify(existing, content);
	} else {
		await vault.create(DEBUG_FORMATTING_NOTE_PATH, content);
	}

	await ctx.app.workspace.openLinkText(DEBUG_FORMATTING_NOTE_PATH, "", false);
}

function buildDemoNoteContent(): string {
	return [
		"---",
		"type: demo",
		"cssclasses:",
		"  - umos-demo",
		"---",
		"",
		"# umOS — Demo",
		"",
		"> This note was created automatically and shows only the current widgets after plugin cleanup.",
		"",
		"## 🕌 Prayer",
		"",
		"```prayer-widget",
		"show: both",
		"style: full",
		"show_sunrise: true",
		"```",
		"",
		"---",
		"",
		"## 📅 Schedule",
		"",
		"```schedule",
		"show: both",
		"highlight: true",
		"countdown: true",
		"```",
		"",
		"---",
		"",
		"## ✅ Tasks",
		"",
		"```tasks-stats-widget",
		"```",
		"",
		"```tasks-completed-widget",
		"collapsed: true",
		"range: 7",
		"limit: 8",
		"```",
		"",
		"```tasks-widget",
		"title: Tasks for today",
		"due: today",
		"sort: priority-desc",
		"create_in: current",
		"```",
		"",
		"```tasks-kanban",
		"title: My Projects",
		"create_in: current",
		"```",
		"",
		"---",
		"",
		"## 📊 Stats",
		"",
		"```umos-stats",
		"chart: sparkline",
		"compare: true",
		"```",
		"",
		"```words-of-day",
		"period: 30",
		"```",
		"",
		"---",
		"",
		"## 🎬 Content and Projects",
		"",
		"```content-gallery",
		"style: grid",
		"```",
		"",
		"```project-gallery",
		"style: grid",
		"```",
		"",
		"---",
		"",
		"## 📆 Daily",
		"",
		"```daily-nav",
		"```",
		"",
		"```word-of-day",
		"property: word_of_day",
		"placeholder: Word of the day...",
		"```",
		"",
		"---",
		"",
		"## ⏳ Countdown",
		"",
		"```countdown",
		"title: Until Summer",
		"date: 2026-06-01 00:00:00",
		"accent: #27ae60",
		"view: focus",
		"```",
		"",
		"```countdown-rings",
		"title: Until Exams",
		"date: 2026-07-01 00:00:00",
		"layout: nested",
		"legend: true",
		"```",
		"",
		"---",
		"",
		"## 🧱 Layout",
		"",
		"```cols-umos",
		"# Left Column",
		"",
		"Text on the left.",
		"",
		"---",
		"",
		"# Right Column",
		"",
		"Text on the right.",
		"```",
		"",
		"```info-umos",
		"title: Card",
		"subtitle: Infobox example",
		"image: https://placehold.co/480x320",
		"",
		"- Row 1",
		"- Row 2",
		"```",
		"",
	].join("\n");
}

function buildFormattingDebugNoteContent(): string {
	return [
		"---",
		"type: debug-formatting",
		"aliases:",
		"  - umOS Formatting Demo",
		"tags:",
		"  - umos",
		"  - formatting",
		"  - demo",
		"cssclasses:",
		"  - umos-wide-soft",
		"  - umos-reading",
		"  - umos-headings-accent",
		"  - umos-accent-links",
		"  - umos-divider-gradient",
		"source: umOS formatting demo",
		"updated: 2026-05-12",
		"---",
		"",
		"# umOS Formatting Demo",
		"",
		"> Эта заметка проверяет новые возможности команды **umOS: Text Formatting**. Выдели любой текст, открой форматтер и выбери стиль: inline-форматы теперь оборачивают выделение, а блоки аккуратно вставляются с отступами.",
		"",
		"<div class=\"umos-divider-label\">Markdown basics</div>",
		"",
		"## Базовое форматирование",
		"",
		"Обычный текст, **жирный**, *курсив*, ***жирный курсив***, ~~зачеркнутый~~, ==нативная подсветка Obsidian== и `inline code`.",
		"",
		"Ссылки: [[Home]] и [Obsidian Help](https://obsidian.md/help).",
		"",
		"> Цитата для проверки обычного markdown blockquote. Она должна быть спокойной, читаемой и не конфликтовать с callouts.",
		"",
		"```text",
		"Fenced code block",
		"with several lines",
		"and a plain text language marker.",
		"```",
		"",
		"| Формат | Пример | Смысл |",
		"| --- | --- | --- |",
		"| Bold | **важно** | сильный акцент |",
		"| Highlight | ==запомнить== | заметка на полях |",
		"| Inline code | `const value = 42` | код или точный термин |",
		"",
		"<hr class=\"umos-hr-soft\">",
		"",
		"## Inline-украшения umOS",
		"",
		"Маркеры: <mark class=\"umos-mark-red\">critical</mark> <mark class=\"umos-mark-green\">done</mark> <mark class=\"umos-mark-blue\">idea</mark> <mark class=\"umos-mark-yellow\">note</mark> <mark class=\"umos-mark-purple\">question</mark>",
		"",
		"Пилюли и бейджи: <span class=\"umos-pill\">pill</span> <span class=\"umos-badge umos-badge-info\">info</span> <span class=\"umos-badge umos-badge-success\">success</span> <span class=\"umos-badge umos-badge-warning\">warning</span> <span class=\"umos-badge umos-badge-danger\">danger</span>",
		"",
		"Текстовые эффекты: <span class=\"umos-text-muted\">muted side note</span>, <span class=\"umos-text-underline\">accent underline</span>, <span class=\"umos-text-wavy\">wavy underline</span>, <span class=\"umos-text-double\">double underline</span>, <span class=\"umos-text-glow\">soft glow</span>.",
		"",
		"HTML-семантика: нажми <kbd>Ctrl</kbd> + <kbd>K</kbd>, формула H<sub>2</sub>O, степень x<sup>2</sup>, <small>маленькое примечание</small>.",
		"",
		"<hr class=\"umos-hr-glow\">",
		"",
		"## Разделители",
		"",
		"<div class=\"umos-divider-label\">Label divider</div>",
		"",
		"Обычный `<hr>` ниже будет стилизоваться через cssclass `umos-divider-gradient` из frontmatter.",
		"",
		"---",
		"",
		"<hr class=\"umos-hr-soft\">",
		"",
		"<hr class=\"umos-hr-glow\">",
		"",
		"## Callouts",
		"",
		"> [!note] Native Note",
		"> Нативный callout Obsidian. Подходит для спокойных заметок.",
		"",
		"> [!tip] Native Tip",
		"> Полезная подсказка или короткий вывод.",
		"",
		"> [!warning] Native Warning",
		"> Место, где нужно быть внимательнее.",
		"",
		"> [!question] Native Question",
		"> Вопрос, сомнение или тема для разбора.",
		"",
		"> [!success] Native Success",
		"> Результат, победа или завершенная идея.",
		"",
		"> [!danger] Native Danger",
		"> Критичное предупреждение.",
		"",
		"> [!focus-umos] Фокус",
		"> Главная мысль, которую надо увидеть первой.",
		"",
		"> [!focus-umos|center] Центрированный фокус",
		"> Короткий тезис, который хорошо смотрится по центру.",
		"",
		"> [!reflect-umos] Мысль дня",
		"> Интерфейс становится лучше, когда он помогает думать, а не требует внимания к себе.",
		"",
		"> [!goal-umos] Цель",
		"> Сделать заметки визуально богаче, но не превратить их в шум.",
		"",
		"> [!verse-umos]",
		"> Хороший стиль не кричит, а держит форму.",
		"",
		"> [!verse-umos|center]",
		"> Иногда центр нужен не для красоты, а для паузы.",
		"",
		"> [!arabic-umos] Ayah",
		"> السلام عليكم ورحمة الله وبركاته",
		"",
		"> [!stat-umos] Сводка",
		"> **42** tasks",
		"> **7** habits",
		"> **3** projects",
		"",
		"> [!definition-umos] Definition",
		"> **Форматирование** — это способ показать структуру мысли: акцент, статус, связь, пример или предупреждение.",
		"",
		"> [!method-umos] Method",
		"> 1. Выдели текст.",
		"> 2. Открой `umOS: Text Formatting`.",
		"> 3. Выбери нужный стиль.",
		"> 4. Проверь результат в reading view.",
		"",
		"> [!compare-umos] Compare",
		"> **Markdown:** переносимый и простой.",
		"> **HTML/CSS:** красивее и точнее внутри Obsidian.",
		"> **Conclusion:** базовое оставляем markdown, декоративное делаем umOS-классами.",
		"",
		"> [!checklist-umos] Checklist",
		"> - Проверить inline-эффекты.",
		"> - Проверить callouts.",
		"> - Проверить мобильный вид.",
		"",
		"## Layout-блоки",
		"",
		"```cols-umos",
		"cols: 2",
		"",
		"## Левая колонка",
		"**Markdown**, <span class=\"umos-badge umos-badge-info\">badge</span> и <span class=\"umos-text-underline\">underline</span>.",
		"",
		"===",
		"",
		"## Правая колонка",
		"- Список",
		"- Теги",
		"- Мини-сводки",
		"```",
		"",
		"```cols-umos",
		"cols: 3",
		"",
		"## One",
		"Короткий блок.",
		"",
		"===",
		"",
		"## Two",
		"<mark class=\"umos-mark-blue\">Идея</mark>",
		"",
		"===",
		"",
		"## Three",
		"<span class=\"umos-pill\">compact</span>",
		"```",
		"",
		"```info-umos",
		"title: Formatting Card",
		"caption: Проверка info-umos",
		"---",
		"Информация",
		"Статус         | Active",
		"Палитра        | umOS",
		"Форматтер      | Expanded",
		"",
		"Проверка",
		"Inline         | badges, marks, kbd",
		"Blocks         | callouts, columns, tables",
		"```",
		"",
		"<details>",
		"<summary>Details Toggle</summary>",
		"",
		"Этот блок можно свернуть. Он полезен для длинных примеров, дополнительных источников и второстепенных заметок.",
		"",
		"</details>",
		"",
		"## Image Embed",
		"",
		"```md",
		"![[00 Files/image.png|420]]",
		"```",
		"",
		"## Mermaid",
		"",
		"```mermaid",
		"graph TD",
		"  A[Выделить текст] --> B[Открыть Format Picker]",
		"  B --> C{Inline или Block?}",
		"  C -->|Inline| D[Обернуть выделение]",
		"  C -->|Block| E[Вставить блок]",
		"```",
		"",
		"## MathJax",
		"",
		"Inline: $e^{i\\pi} + 1 = 0$",
		"",
		"$$",
		"\\int_a^b f(x)\\,dx = F(b) - F(a)",
		"$$",
		"",
		"## Kanban Board Widget",
		"",
		"```kanban-board",
		"id: formatting-demo",
		"```",
		"",
		"## Сниппеты для ручной проверки",
		"",
		"```html",
		"<mark class=\"umos-mark-blue\">accent</mark>",
		"<span class=\"umos-pill\">pill</span>",
		"<span class=\"umos-badge umos-badge-success\">success</span>",
		"<span class=\"umos-text-wavy\">needs review</span>",
		"<kbd>Ctrl</kbd>",
		"```",
		"",
		"```yaml",
		"---",
		"cssclasses:",
		"  - umos-wide",
		"  - umos-wide-soft",
		"  - umos-reading",
		"  - umos-dropcap",
		"  - umos-paper",
		"  - umos-compact-note",
		"  - umos-accent-links",
		"  - umos-no-title",
		"  - umos-columns",
		"  - umos-headings-accent",
		"  - umos-divider-dots",
		"  - umos-divider-ornament",
		"  - umos-divider-gradient",
		"---",
		"```",
		"",
	].join("\n");
}
