import { Notice, Setting, TAbstractFile } from "obsidian";
import { DEFAULT_SETTINGS, DEFAULT_DATA } from "../Settings";
import { SettingsContext, createSection } from "../helpers";

export function renderScaffoldSection(containerEl: HTMLElement, ctx: SettingsContext): void {
	const sectionEl = createSection(
		containerEl,
		"umos-settings-scaffold",
		"Vault Structure",
		"Move all contents to temp/ and create default directories."
	);

	new Setting(sectionEl)
		.setName("Create Structure")
		.setDesc("Existing files and folders will be moved to temp/")
		.addButton((btn) =>
			btn
				.setButtonText("Create Directories")
				.setCta()
				.onClick(async () => {
					btn.setDisabled(true);
					btn.setButtonText("Created...");
					try {
						await scaffoldVault(ctx);
						new Notice("✅ Vault Structure created");
					} catch (error) {
						console.error("umOS: failed to scaffold vault:", error);
						new Notice("❌ Failed to create structure");
					} finally {
						btn.setDisabled(false);
						btn.setButtonText("Create Directories");
					}
				})
		);

	new Setting(sectionEl)
		.setName("Reset Settings")
		.setDesc("Restore all settings to their defaults")
		.addButton((btn) =>
			btn
				.setButtonText("Reset")
				.setWarning()
				.onClick(async () => {
					ctx.plugin.settings = { ...DEFAULT_SETTINGS };
					ctx.plugin.data_store = { ...DEFAULT_DATA };
					await ctx.saveSettings();
					ctx.display();
					new Notice("✅ Settings reset");
				})
		);
}

async function scaffoldVault(ctx: SettingsContext): Promise<void> {
	const vault = ctx.app.vault;

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

	const root = vault.getRoot();
	const children = root.children.filter(
		(file: TAbstractFile) => file.name !== ".obsidian" && file.name !== "temp"
	);

	if (children.length > 0) {
		if (!vault.getAbstractFileByPath("temp")) {
			await vault.createFolder("temp");
		}

		for (const child of children) {
			const dest = `temp/${child.name}`;
			let finalDest = dest;
			let counter = 1;
			while (vault.getAbstractFileByPath(finalDest)) {
				const ext = child.name.includes(".") ? `.${child.name.split(".").pop()}` : "";
				const base = ext ? child.name.slice(0, -ext.length) : child.name;
				finalDest = `temp/${base}_${counter}${ext}`;
				counter++;
			}
			await vault.rename(child, finalDest);
		}
	}

	for (const dir of dirs) {
		if (!vault.getAbstractFileByPath(dir)) {
			await vault.createFolder(dir);
		}
	}

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
				"# Prayer",
				"",
				"```prayer-widget",
				"show: both",
				"style: full",
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
				"# Stats",
				"",
				"```umos-stats",
				"chart: sparkline",
				"compare: true",
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
				"# Schedule",
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
				"# Tasks",
				"",
				"```tasks-stats-widget",
				"```",
				"",
				"```tasks-completed-widget",
				"collapsed: true",
				"```",
				"",
				"```tasks-widget",
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
				"# Projects",
				"",
				"```project-gallery",
				"style: grid",
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
				"# Content",
				"",
				"```content-gallery",
				"style: grid",
				"```",
				"",
			].join("\n"),
		},
	];

	for (const file of files) {
		const existing = vault.getAbstractFileByPath(file.path);
		if (!existing) {
			await vault.create(file.path, file.content);
		}
	}
}
