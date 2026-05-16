import { Setting, TFile, moment, normalizePath, setIcon } from "obsidian";
import { SettingsContext, createSection, createSubheading } from "../helpers";
import { TaskService } from "../../productivity/tasks/TaskService";
import { VaultHealthIssue, VaultHealthScanResult, VaultHealthService } from "../../health/VaultHealthService";
import { t } from "../../i18n";

function getTodayDailyNotePath(ctx: SettingsContext): string {
	const fileName = moment().format(ctx.settings.dailyNoteFormat || "YYYY-MM-DD");
	return normalizePath(`${ctx.settings.dailyNotesPath}/${fileName}.md`);
}

function createInfoRow(parent: HTMLElement, title: string, detail: string, iconName: string, tone = "info"): void {
	const row = parent.createDiv({ cls: `umos-settings-health-row is-${tone}` });
	const icon = row.createSpan({ cls: "umos-settings-health-row-icon" });
	setIcon(icon, iconName);
	const body = row.createDiv({ cls: "umos-settings-health-row-body" });
	body.createDiv({ cls: "umos-settings-health-row-title", text: t(title) });
	if (/^\d+$/.test(detail.trim())) {
		row.createDiv({ cls: "umos-settings-health-row-badge", text: detail.trim() });
	} else {
		body.createDiv({ cls: "umos-settings-health-row-detail", text: detail });
	}
}

function getSyncAlertMessage(message: string | undefined): string {
	const clean = (message ?? "").trim();
	if (!clean) return t("Open Sync Center to inspect the error.");
	if (/^net::/i.test(clean)) return t("Provider request failed. Open Sync Center logs for details.");
	if (clean.length > 96) return `${clean.slice(0, 96)}...`;
	return clean;
}

function renderIssue(parent: HTMLElement, ctx: SettingsContext, issue: VaultHealthIssue): void {
	const row = parent.createEl("button", {
		cls: `umos-settings-health-issue is-${issue.severity}`,
		attr: { type: "button" },
	});
	if (!issue.filePath) row.disabled = true;

	const icon = row.createSpan({ cls: "umos-settings-health-row-icon" });
	setIcon(icon, issue.kind === "broken-link" ? "unlink" : issue.kind === "orphan-image" ? "image-off" : "circle-alert");

	const body = row.createSpan({ cls: "umos-settings-health-row-body" });
	body.createSpan({ cls: "umos-settings-health-row-title", text: t(issue.title) });
	body.createSpan({ cls: "umos-settings-health-row-detail", text: issue.detail });

	row.addEventListener("click", () => {
		if (!issue.filePath) return;
		void ctx.app.workspace.openLinkText(issue.filePath, issue.filePath, false);
	});
}

function renderHealthResult(parent: HTMLElement, ctx: SettingsContext, result: VaultHealthScanResult): void {
	parent.empty();
	const grid = parent.createDiv({ cls: "umos-settings-health-grid" });
	createInfoRow(grid, "Critical", String(result.summary.critical), "shield-alert", "critical");
	createInfoRow(grid, "Warnings", String(result.summary.warning), "triangle-alert", "warning");
	createInfoRow(grid, "Broken links", String(result.summary.brokenLinks), "unlink", "critical");
	createInfoRow(grid, "Orphan images", String(result.summary.orphanImages), "image-off", "info");
	createInfoRow(grid, "Undated tasks", String(result.summary.tasksWithoutDates), "calendar-clock", "warning");
	createInfoRow(grid, "Content metadata missing", String(result.summary.contentMetadata), "badge-info", "info");

	const list = parent.createDiv({ cls: "umos-settings-health-list" });
	if (result.issues.length === 0) {
		list.createDiv({ cls: "umos-settings-empty", text: t("Vault looks healthy.") });
		return;
	}

	for (const issue of result.issues.slice(0, 14)) {
		renderIssue(list, ctx, issue);
	}
}

export function renderAlertsSettingsSection(containerEl: HTMLElement, ctx: SettingsContext): void {
	const sectionEl = createSection(
		containerEl,
		"umos-settings-home-alerts",
		"Home Alerts",
		"Current dashboard warnings and how they are calculated."
	);

	new Setting(sectionEl)
		.setName("Include Vault Health in alerts")
		.setDesc("Home Alerts can surface critical Vault Health issues in this settings panel.")
		.addToggle((toggle) =>
			toggle
				.setValue(ctx.settings.homeAlertsIncludeVaultHealth)
				.onChange(async (value) => {
					ctx.settings.homeAlertsIncludeVaultHealth = value;
					await ctx.saveSettings();
					ctx.display();
				})
		);

	createSubheading(sectionEl, "Current Alerts");
	const preview = sectionEl.createDiv({ cls: "umos-settings-health-list umos-settings-alert-preview" });
	preview.createDiv({ cls: "umos-settings-empty", text: t("Checking alerts...") });

	void Promise.all([
		new TaskService(ctx.app, ctx.plugin).getHomeTasks(),
		ctx.settings.homeAlertsIncludeVaultHealth
			? new VaultHealthService(ctx.app, ctx.plugin).scan({
				lookbackDays: ctx.settings.homeVaultHealthLookbackDays,
				maxIssuesPerKind: 2,
			})
			: Promise.resolve(null),
	]).then(([tasks, health]) => {
		if (!preview.isConnected) return;
		preview.empty();

		const todayPath = getTodayDailyNotePath(ctx);
		const todayFile = ctx.app.vault.getAbstractFileByPath(todayPath);
		let rendered = 0;

		if (!(todayFile instanceof TFile)) {
			createInfoRow(preview, "Daily note not created", todayPath, "file-warning", "critical");
			rendered++;
		}

		if (tasks.overdue.length > 0) {
			createInfoRow(preview, "Overdue tasks", `${tasks.overdue.length}`, "flame", "critical");
			rendered++;
		}

		if (tasks.dueTomorrow.length > 0) {
			createInfoRow(preview, "Tomorrow is already forming", `${tasks.dueTomorrow.length}`, "calendar-days", "info");
			rendered++;
		}

		if (health && health.summary.critical > 0) {
			createInfoRow(preview, "Vault health warning", `${health.summary.critical}`, "shield-alert", "warning");
			rendered++;
		}

		const sync = ctx.data_store.sync;
		if (sync?.lastStatus === "failed") {
			createInfoRow(preview, "Vault sync failed", getSyncAlertMessage(sync.lastMessage), "circle-alert", "critical");
			rendered++;
		} else if (!sync?.lastRunAt) {
			createInfoRow(preview, "Vault sync has never run", t("Open Sync Center when you are ready to connect devices."), "cloud", "info");
			rendered++;
		} else if (Date.now() - sync.lastRunAt > 7 * 24 * 60 * 60 * 1000) {
			createInfoRow(preview, "Vault sync is stale", new Date(sync.lastRunAt).toLocaleString(), "circle-alert", "warning");
			rendered++;
		}

		if (rendered === 0) {
			createInfoRow(preview, "All clear", t("No urgent Home alerts right now."), "check-circle-2", "success");
		}
	}).catch((error) => {
		if (!preview.isConnected) return;
		preview.empty();
		preview.createDiv({
			cls: "umos-settings-empty",
			text: error instanceof Error ? error.message : String(error),
		});
	});
}

export function renderVaultHealthSettingsSection(containerEl: HTMLElement, ctx: SettingsContext): void {
	const sectionEl = createSection(
		containerEl,
		"umos-settings-vault-health",
		"Vault Health",
		"Broken links, orphan images, missing daily notes, undated tasks, and content metadata checks."
	);

	new Setting(sectionEl)
		.setName("Daily-note lookback")
		.setDesc("How many recent daily notes Vault Health checks for missing or empty notes.")
		.addSlider((slider) =>
			slider
				.setLimits(1, 30, 1)
				.setValue(ctx.settings.homeVaultHealthLookbackDays)
				.setDynamicTooltip()
				.onChange(async (value) => {
					ctx.settings.homeVaultHealthLookbackDays = value;
					await ctx.saveSettings();
				})
		);

	const resultEl = sectionEl.createDiv({ cls: "umos-settings-health-result" });

	new Setting(sectionEl)
		.setName("Run Vault Health scan")
		.setDesc("Scan now and show the result here. This does not modify files.")
		.addButton((button) =>
			button
				.setButtonText("Run scan")
				.setCta()
				.onClick(async () => {
					resultEl.empty();
					resultEl.createDiv({ cls: "umos-settings-empty", text: t("Scanning vault...") });
					const result = await new VaultHealthService(ctx.app, ctx.plugin).scan({
						lookbackDays: ctx.settings.homeVaultHealthLookbackDays,
						maxIssuesPerKind: 10,
					});
					renderHealthResult(resultEl, ctx, result);
				})
		);
}
