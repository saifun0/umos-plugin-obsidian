import { Notice, Setting } from "obsidian";
import { DashboardStudioModal } from "../../dashboard/DashboardStudioModal";
import { exportDashboardProfiles, importDashboardProfiles } from "../../dashboard/DashboardProfiles";
import { SettingsContext, createSection } from "../helpers";

export function renderDashboardSection(containerEl: HTMLElement, ctx: SettingsContext): void {
	const sectionEl = createSection(
		containerEl,
		"umos-settings-dashboard-studio",
		"Dashboard Studio",
		"Dashboard profiles, presets, preview, note generation, and JSON transfer."
	);

	new Setting(sectionEl)
		.setName("Open Dashboard Studio")
		.setDesc("Build a dashboard from widgets, preview it, and write the result to a markdown note.")
		.addButton((button) => button
			.setButtonText("Open")
			.setCta()
			.onClick(() => new DashboardStudioModal(ctx.plugin).open()));

	new Setting(sectionEl)
		.setName("Profile Export Path")
		.setDesc("JSON file inside the vault.")
		.addText((text) => text
			.setPlaceholder("umOS/dashboard-profiles.json")
			.setValue(ctx.settings.dashboardProfilesExportPath || "umOS/dashboard-profiles.json")
			.onChange(async (value) => {
				ctx.settings.dashboardProfilesExportPath = value.trim() || "umOS/dashboard-profiles.json";
				await ctx.saveSettings();
			}));

	const count = ctx.data_store.dashboardProfiles?.length ?? 0;
	new Setting(sectionEl)
		.setName("Profiles")
		.setDesc(`Currently saved: ${count}`)
		.addButton((button) => button
			.setButtonText("Export")
			.onClick(() => void exportDashboardProfiles(ctx.plugin)))
		.addButton((button) => button
			.setButtonText("Import")
			.onClick(async () => {
				await importDashboardProfiles(ctx.plugin, {
					onApplied: () => ctx.display(),
				});
			}));
}

export function renderDiagnosticsSection(containerEl: HTMLElement, ctx: SettingsContext): void {
	const sectionEl = createSection(
		containerEl,
		"umos-settings-diagnostics",
		"Diagnostics",
		"Recent EventBus events, widget configuration errors, and render count."
	);

	const diagnostics = ctx.plugin.eventBus.getDiagnostics();
	new Setting(sectionEl)
		.setName("Rendered widgets")
		.setDesc(`${diagnostics.renderedWidgets} total · ${Object.keys(diagnostics.renderedByBlock).length} block types`)
		.addButton((button) => button
			.setButtonText("Refresh")
			.onClick(() => ctx.display()))
		.addButton((button) => button
			.setButtonText("Clear")
			.onClick(() => {
				ctx.plugin.eventBus.clearDiagnostics();
				new Notice("Diagnostics cleared");
				ctx.display();
			}))
		.addButton((button) => button
			.setButtonText("Copy JSON")
			.onClick(async () => {
				try {
					await navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2));
					new Notice("Diagnostics copied");
				} catch {
					new Notice("Clipboard is unavailable");
				}
			}));

	new Setting(sectionEl)
		.setName("Widget validation issues")
		.setDesc(`${diagnostics.widgetErrors.length} recent warnings/errors`);

	const renderedEl = sectionEl.createDiv({ cls: "umos-settings-diagnostics-block" });
	renderedEl.createEl("h3", { text: "Rendered by block", cls: "umos-settings-diagnostics-section-title" });
	const renderedRows = Object.entries(diagnostics.renderedByBlock).sort((a, b) => b[1] - a[1]).slice(0, 12);
	if (renderedRows.length === 0) {
		renderedEl.createDiv({ cls: "umos-settings-empty", text: "No render events yet." });
	} else {
		const list = renderedEl.createDiv({ cls: "umos-settings-diagnostics-list" });
		for (const [blockName, count] of renderedRows) {
			const row = list.createDiv({ cls: "umos-settings-diagnostics-row" });
			row.createSpan({ cls: "umos-settings-diagnostics-main", text: blockName });
			row.createSpan({ cls: "umos-settings-diagnostics-badge", text: String(count) });
		}
	}

	const issuesEl = sectionEl.createDiv({ cls: "umos-settings-diagnostics-block" });
	issuesEl.createEl("h3", { text: "Validation issues", cls: "umos-settings-diagnostics-section-title" });
	if (diagnostics.widgetErrors.length === 0) {
		issuesEl.createDiv({ cls: "umos-settings-empty", text: "No configuration errors yet." });
	} else {
		const list = issuesEl.createDiv({ cls: "umos-settings-diagnostics-list" });
		for (const issue of diagnostics.widgetErrors.slice(0, 10)) {
			const row = list.createDiv({ cls: "umos-settings-diagnostics-row is-issue" });
			const main = row.createDiv({ cls: "umos-settings-diagnostics-main" });
			main.createSpan({ text: issue.blockName });
			if (issue.sourcePath) {
				main.createSpan({ cls: "umos-settings-diagnostics-path", text: issue.sourcePath });
			}
			const details = [...issue.errors, ...issue.warnings].join(" · ");
			row.createDiv({ cls: "umos-settings-diagnostics-detail", text: details || "No details." });
			row.createSpan({
				cls: "umos-settings-diagnostics-time",
				text: new Date(issue.timestamp).toLocaleTimeString(),
			});
			if (issue.sourcePath) {
				const openButton = row.createEl("button", {
					text: "Open",
					cls: "umos-settings-diagnostics-action",
					attr: { type: "button" },
				});
				openButton.addEventListener("click", () => {
					void ctx.app.workspace.openLinkText(issue.sourcePath ?? "", "", false);
				});
			}
		}
	}

	const eventsBlock = sectionEl.createDiv({ cls: "umos-settings-diagnostics-block" });
	eventsBlock.createEl("h3", { text: "Recent events", cls: "umos-settings-diagnostics-section-title" });
	const eventsEl = eventsBlock.createDiv({ cls: "umos-settings-diagnostics-list" });
	for (const event of diagnostics.recentEvents.slice(0, 8)) {
		const row = eventsEl.createDiv({ cls: "umos-settings-diagnostics-row" });
		row.createSpan({ cls: "umos-settings-diagnostics-main", text: event.event });
		row.createSpan({ cls: "umos-settings-diagnostics-time", text: new Date(event.timestamp).toLocaleTimeString() });
	}
	if (diagnostics.recentEvents.length === 0) {
		eventsEl.createDiv({ cls: "umos-settings-empty", text: "No events yet." });
	}
}
