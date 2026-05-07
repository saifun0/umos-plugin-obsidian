import { Notice, Setting, TFile } from "obsidian";
import { SettingsContext, createSection } from "../helpers";

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
		"# umOS Formatting Debug",
		"",
		"## Columns",
		"",
		"```cols-umos",
		"Left Column",
		"",
		"---",
		"",
		"Right Column",
		"```",
		"",
		"## Infobox",
		"",
		"```info-umos",
		"title: Demo",
		"subtitle: Debug",
		"",
		"- item 1",
		"- item 2",
		"```",
		"",
		"## Input",
		"",
		"```umos-input",
		"type: rating",
		"property: mood",
		"label: Mood",
		"max: 5",
		"```",
		"",
	].join("\n");
}
