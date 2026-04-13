import { Notice, Setting, TAbstractFile, TFile } from "obsidian";
import { DEFAULT_SETTINGS, DEFAULT_DATA } from "../Settings";
import { SettingsContext, createSection } from "../helpers";

export function renderScaffoldSection(containerEl: HTMLElement, ctx: SettingsContext): void {
	const sectionEl = createSection(
		containerEl,
		"umos-settings-scaffold",
		"Структура хранилища",
		"Переместить всё содержимое в temp/ и создать директории по умолчанию."
	);

	new Setting(sectionEl)
		.setName("Создать структуру")
		.setDesc("Существующие файлы и папки будут перемещены в temp/")
		.addButton((btn) =>
			btn
				.setButtonText("Создать директории")
				.setCta()
				.onClick(async () => {
					btn.setDisabled(true);
					btn.setButtonText("Создание...");
					try {
						await scaffoldVault(ctx);
						new Notice("✅ Структура хранилища создана");
					} catch (error) {
						console.error("umOS: failed to scaffold vault:", error);
						new Notice("❌ Ошибка при создании структуры");
					} finally {
						btn.setDisabled(false);
						btn.setButtonText("Создать директории");
					}
				})
		);

	new Setting(sectionEl)
		.setName("Сбросить настройки")
		.setDesc("Вернуть все настройки к значениям по умолчанию")
		.addButton((btn) =>
			btn
				.setButtonText("Сбросить")
				.setWarning()
				.onClick(async () => {
					ctx.plugin.settings = { ...DEFAULT_SETTINGS };
					ctx.plugin.data_store = { ...DEFAULT_DATA };
					await ctx.saveSettings();
					ctx.display();
					new Notice("✅ Настройки сброшены");
				})
		);
}

async function scaffoldVault(ctx: SettingsContext): Promise<void> {
	const vault = ctx.app.vault;

	// Фиксированная структура хранилища
	const dirs: string[] = [
		"00 Files",
		"05 Dashboards",
		"10 Inbox",
		"11 Journal",
		"11 Journal/Daily",
		"20 Projects",
		"30 Content",
		"30 Content/Anime",
		"30 Content/Books",
		"30 Content/Movies",
		"30 Content/Series",
		"30 Content/Games",
		"40 Resources",
		"45 Study",
		"50 Archive",
		"99 Trash",
	];

	// ── Шаг 1: Переместить всё существующее в temp/ ──
	const root = vault.getRoot();
	const children = root.children.filter(
		(f: TAbstractFile) => f.name !== ".obsidian" && f.name !== "temp"
	);

	if (children.length > 0) {
		// Создаём temp/ если нет
		if (!vault.getAbstractFileByPath("temp")) {
			await vault.createFolder("temp");
		}

		for (const child of children) {
			const dest = `temp/${child.name}`;
			// Если в temp/ уже есть файл/папка с таким именем — добавляем суффикс
			let finalDest = dest;
			let counter = 1;
			while (vault.getAbstractFileByPath(finalDest)) {
				const ext = child.name.includes(".")
					? "." + child.name.split(".").pop()
					: "";
				const base = ext
					? child.name.slice(0, -ext.length)
					: child.name;
				finalDest = `temp/${base}_${counter}${ext}`;
				counter++;
			}
			await vault.rename(child, finalDest);
		}
	}

	// ── Шаг 2: Создать директории ──
	for (const dir of dirs) {
		if (!vault.getAbstractFileByPath(dir)) {
			await vault.createFolder(dir);
		}
	}

	// ── Шаг 3: Создать дашборды с виджетами ──
	await createDashboardFiles(ctx);
}

async function createDashboardFiles(ctx: SettingsContext): Promise<void> {
	const vault = ctx.app.vault;
	const files: { path: string; content: string }[] = [
		{
			path: "05 Dashboards/Prayer.md",
			content: [
				"---",
				"type: dashboard",
				"cssclasses:",
				"  - hide",
				"---",
				"",
				"# Намаз",
				"",
				"```prayer-widget",
				"show: both",
				"style: full",
				"```",
				"",
				"```ayat-daily",
				"```",
				"",
			].join("\n"),
		},
		{
			path: "05 Dashboards/Quran.md",
			content: [
				"---",
				"type: dashboard",
				"cssclasses:",
				"  - hide",
				"---",
				"",
				"# Коран",
				"",
				"```ayat-daily",
				"count: 5",
				"show_arabic: true",
				"```",
				"",
				"## Прогресс чтения",
				"",
				"```quran-tracker",
				"style: both",
				"```",
				"",
			].join("\n"),
		},
		{
			path: "05 Dashboards/Stats.md",
			content: [
				"---",
				"type: dashboard",
				"cssclasses:",
				"  - hide",
				"---",
				"",
				"# Статистика",
				"",
				"## Показатели",
				"",
				"```umos-stats",
				'metrics: ["mood", "productivity", "sleep", "prayer_count"]',
				"period: 14",
				"chart: sparkline",
				"compare: true",
				"```",
				"",
				"## Привычки",
				"",
				"```umos-stats",
				'metrics: ["exercise", "reading", "water", "quran", "study"]',
				"period: 30",
				"chart: bar",
				"```",
				"",
			].join("\n"),
		},
		{
			path: "05 Dashboards/Habits.md",
			content: [
				"---",
				"type: dashboard",
				"cssclasses:",
				"  - hide",
				"---",
				"",
				"# Привычки",
				"",
				"```habits",
				"style: grid",
				"```",
				"",
				"## Календарь — Упражнения",
				"",
				"```habit-calendar",
				"habit: exercise",
				"months: 3",
				"```",
				"",
				"## Календарь — Чтение",
				"",
				"```habit-calendar",
				"habit: reading",
				"months: 3",
				"```",
				"",
				"## Календарь — Коран",
				"",
				"```habit-calendar",
				"habit: quran",
				"months: 3",
				"```",
				"",
			].join("\n"),
		},
		{
			path: "05 Dashboards/Schedule.md",
			content: [
				"---",
				"type: dashboard",
				"cssclasses:",
				"  - hide",
				"---",
				"",
				"# Расписание",
				"",
				"```schedule",
				"show: both",
				"highlight: true",
				"countdown: true",
				"```",
				"",
			].join("\n"),
		},
		{
			path: "05 Dashboards/Tasks.md",
			content: [
				"---",
				"type: dashboard",
				"cssclasses:",
				"  - hide",
				"---",
				"",
				"# Задачи",
				"",
				"```tasks-stats-widget",
				"```",
				"",
				"```tasks-widget",
				"```",
				"",
			].join("\n"),
		},
		{
			path: "05 Dashboards/Goals.md",
			content: [
				"---",
				"type: dashboard",
				"cssclasses:",
				"  - hide",
				"---",
				"",
				"```umos-goals",
				"```",
				"",
			].join("\n"),
		},
		{
			path: "05 Dashboards/Projects.md",
			content: [
				"---",
				"type: dashboard",
				"cssclasses:",
				"  - hide",
				"---",
				"",
				"# Проекты",
				"",
				"```project-gallery",
				"style: grid",
				"```",
				"",
			].join("\n"),
		},
		{
			path: "05 Dashboards/Ramadan.md",
			content: [
				"---",
				"type: dashboard",
				"cssclasses:",
				"  - hide",
				"---",
				"",
				"# Рамадан",
				"",
				"```ramadan-widget",
				"style: full",
				"```",
				"",
			].join("\n"),
		},
		{
			path: "05 Dashboards/Pomodoro.md",
			content: [
				"---",
				"type: dashboard",
				"cssclasses:",
				"  - hide",
				"---",
				"",
				"# Помодоро",
				"",
				"```pomodoro",
				"style: full",
				"```",
				"",
			].join("\n"),
		},
		{
			path: "05 Dashboards/Exams.md",
			content: [
				"---",
				"type: dashboard",
				"cssclasses:",
				"  - hide",
				"---",
				"",
				"# Экзамены",
				"",
				"```exam-tracker",
				"show: upcoming",
				"style: full",
				"```",
				"",
			].join("\n"),
		},
		{
			path: "05 Dashboards/Content.md",
			content: [
				"---",
				"type: dashboard",
				"cssclasses:",
				"  - hide",
				"---",
				"",
				"# Контент",
				"",
				"```content-gallery",
				"style: grid",
				"```",
				"",
			].join("\n"),
		},
		{
			path: "05 Dashboards/Balance.md",
			content: [
				"---",
				"type: dashboard",
				"cssclasses:",
				"  - hide",
				"---",
				"",
				"# Баланс времени",
				"",
				"```balance-tracker",
				"style: full",
				"```",
				"",
			].join("\n"),
		},
		{
			path: "05 Dashboards/Finance.md",
			content: [
				"---",
				"type: dashboard",
				"cssclasses:",
				"  - hide",
				"---",
				"",
				"# Финансы",
				"",
				"```finance-tracker",
				"style: full",
				"```",
				"",
			].join("\n"),
		},
	];

	for (const file of files) {
		const existing = vault.getAbstractFileByPath(file.path);
		if (!existing) {
			await vault.create(file.path, file.content);
			continue;
		}

		if (file.path === "05 Dashboards/Goals.md" && existing instanceof TFile) {
			await ensureGoalsCodeBlock(ctx, existing);
		}
	}
}

async function ensureGoalsCodeBlock(ctx: SettingsContext, file: TFile): Promise<void> {
	const content = await ctx.app.vault.read(file);
	if (content.includes("```umos-goals")) return;
	const trimmed = content.trimEnd();
	const separator = trimmed.length > 0 ? "\n\n" : "";
	const insert = "```umos-goals\n```\n";
	await ctx.app.vault.modify(file, `${trimmed}${separator}${insert}`);
}
