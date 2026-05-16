import { Modal, Notice, setIcon } from "obsidian";
import type UmOSPlugin from "../main";
import { t } from "../i18n";
import { UMOS_SYNC_ICON_ID } from "../branding";
import { SyncProgressNotice } from "./SyncProgressNotice";
import type { SyncAction, SyncMode, SyncProgress, SyncRunResult, SyncRunStatus } from "./types";

const ACTION_LABEL: Record<SyncAction["type"], string> = {
	upload: "Upload",
	download: "Download",
	"delete-local": "Delete local",
	"delete-remote": "Delete remote",
	skip: "Skip",
};

export class SyncCenterModal extends Modal {
	private bodyEl: HTMLElement | null = null;
	private result: SyncRunResult | null = null;
	private progress: SyncProgress | null = null;
	private progressEl: HTMLElement | null = null;
	private logs: string[] = [];
	private logsLoading = false;
	private status: SyncRunStatus = "idle";

	constructor(private plugin: UmOSPlugin) {
		super(plugin.app);
	}

	onOpen(): void {
		this.modalEl.addClass("umos-sync-center-modal");
		this.contentEl.addClass("umos-sync-center-content");
		this.render();
		void this.refreshLogs(true);
	}

	onClose(): void {
		this.contentEl.empty();
		this.contentEl.removeClass("umos-sync-center-content");
	}

	private render(): void {
		this.contentEl.empty();
		const shell = this.contentEl.createDiv({ cls: "umos-sync-center" });

		const header = shell.createDiv({ cls: "umos-sync-center-header" });
		const icon = header.createSpan({ cls: "umos-sync-center-icon" });
		setIcon(icon, UMOS_SYNC_ICON_ID);
		const titleWrap = header.createDiv({ cls: "umos-sync-center-title-wrap" });
		titleWrap.createEl("h2", { cls: "umos-sync-center-title", text: t("Vault Sync") });
		titleWrap.createDiv({ cls: "umos-sync-center-subtitle", text: t("Sync this vault through a remote cloud broker.") });

		const statusPill = header.createSpan({ cls: `umos-sync-center-status is-${this.status}` });
		statusPill.setText(t(this.getStatusText()));

		const actions = shell.createDiv({ cls: "umos-sync-center-actions" });
		this.createActionButton(actions, "Sync", "refresh-cw", () => this.run(this.plugin.settings.syncMode));
		this.createActionButton(actions, "Pull", "download", () => this.run("pull"));
		this.createActionButton(actions, "Push", "upload", () => this.run("push"));
		this.createActionButton(actions, "Dry run", "scan-search", () => this.run(this.plugin.settings.syncMode, true));
		this.createActionButton(actions, "Test", "plug-zap", () => this.testConnection());
		this.createActionButton(actions, "Cancel", "square", () => this.cancel(), false, true);

		this.bodyEl = shell.createDiv({ cls: "umos-sync-center-body" });
		this.renderBody();
	}

	private renderBody(): void {
		if (!this.bodyEl) return;
		this.bodyEl.empty();
		const data = this.plugin.data_store.sync;
		const overview = this.bodyEl.createDiv({ cls: "umos-sync-overview-grid" });
		this.renderOverviewCard(overview, "Provider", this.plugin.settings.syncProvider);
		this.renderOverviewCard(overview, "Mode", this.plugin.settings.syncMode);
		this.renderOverviewCard(overview, "Encryption", this.plugin.settings.syncEncryptionEnabled ? "Enabled" : "Disabled");
		this.renderOverviewCard(overview, "Last sync", data?.lastRunAt ? new Date(data.lastRunAt).toLocaleString() : "Never");
		this.renderProgress(this.bodyEl);

		if (this.result) {
			this.renderSummary(this.bodyEl, this.result);
			this.renderActions(this.bodyEl, this.result.plan.actions);
			this.renderErrors(this.bodyEl, this.result.errors);
		} else {
			const empty = this.bodyEl.createDiv({ cls: "umos-sync-center-empty" });
			empty.createDiv({ cls: "umos-sync-center-empty-title", text: t("No sync run in this window yet.") });
			empty.createDiv({ cls: "umos-sync-center-empty-desc", text: data?.lastMessage || t("Run a dry run first if you want to preview changes.") });
		}

		this.renderDebugLogs(this.bodyEl);
	}

	private renderProgress(parent: HTMLElement): void {
		if (!this.progress && this.status !== "running") {
			this.progressEl = null;
			return;
		}
		this.progressEl = parent.createDiv({ cls: "umos-sync-progress-panel" });
		this.updateProgressPanel();
	}

	private updateProgressPanel(): void {
		if (!this.progressEl) return;
		const progress = this.progress ?? {
			status: this.status,
			phase: "Vault Sync",
			message: this.getStatusText(),
			current: 0,
			total: 100,
			percent: this.status === "success" ? 100 : 0,
			cancellable: this.status === "running",
		};
		this.progressEl.empty();
		this.progressEl.toggleClass("is-running", progress.status === "running");
		this.progressEl.toggleClass("is-success", progress.status === "success");
		this.progressEl.toggleClass("is-failed", progress.status === "failed");
		this.progressEl.toggleClass("is-cancelled", progress.status === "cancelled");

		const head = this.progressEl.createDiv({ cls: "umos-sync-progress-head" });
		const title = head.createDiv({ cls: "umos-sync-progress-title" });
		title.createSpan({ text: t(progress.phase) });
		if (progress.path) title.createSpan({ cls: "umos-sync-progress-path", text: progress.path });
		head.createSpan({ cls: "umos-sync-progress-percent", text: `${Math.round(progress.percent)}%` });

		this.progressEl.createDiv({ cls: "umos-sync-progress-detail", text: t(progress.message) });
		const bar = this.progressEl.createDiv({ cls: "umos-sync-progress-bar" });
		bar.createDiv({ cls: "umos-sync-progress-fill" }).style.width = `${Math.max(0, Math.min(100, progress.percent))}%`;
	}

	private renderOverviewCard(parent: HTMLElement, label: string, value: string): void {
		const card = parent.createDiv({ cls: "umos-sync-overview-card" });
		card.createDiv({ cls: "umos-sync-overview-label", text: t(label) });
		card.createDiv({ cls: "umos-sync-overview-value", text: t(value) });
	}

	private renderSummary(parent: HTMLElement, result: SyncRunResult): void {
		const summary = result.plan.summary;
		const wrap = parent.createDiv({ cls: "umos-sync-summary" });
		this.renderSummaryChip(wrap, "Uploaded", String(summary.uploaded));
		this.renderSummaryChip(wrap, "Downloaded", String(summary.downloaded));
		this.renderSummaryChip(wrap, "Deleted", String(summary.deletedLocal + summary.deletedRemote));
		this.renderSummaryChip(wrap, "Conflicts", String(summary.conflicts));
		this.renderSummaryChip(wrap, "Errors", String(result.errors.length));
	}

	private renderSummaryChip(parent: HTMLElement, label: string, value: string): void {
		const chip = parent.createDiv({ cls: "umos-sync-summary-chip" });
		chip.createSpan({ cls: "umos-sync-summary-value", text: value });
		chip.createSpan({ cls: "umos-sync-summary-label", text: t(label) });
	}

	private renderActions(parent: HTMLElement, actions: SyncAction[]): void {
		const section = parent.createDiv({ cls: "umos-sync-change-section" });
		const head = section.createDiv({ cls: "umos-sync-change-head" });
		head.createSpan({ cls: "umos-sync-change-title", text: t("Planned changes") });
		head.createSpan({ cls: "umos-sync-change-count", text: String(actions.length) });

		if (actions.length === 0) {
			section.createDiv({ cls: "umos-sync-center-empty-desc", text: t("Nothing to sync.") });
			return;
		}

		const list = section.createDiv({ cls: "umos-sync-change-list" });
		for (const action of actions.slice(0, 300)) {
			const item = list.createDiv({ cls: `umos-sync-change-item is-${action.type}` });
			const badge = item.createSpan({ cls: "umos-sync-change-badge", text: t(ACTION_LABEL[action.type]) });
			if (action.conflict) badge.addClass("is-conflict");
			const text = item.createSpan({ cls: "umos-sync-change-text" });
			text.createSpan({ cls: "umos-sync-change-path", text: action.path });
			text.createSpan({ cls: "umos-sync-change-reason", text: t(action.reason) });
		}
	}

	private renderErrors(parent: HTMLElement, errors: string[]): void {
		if (errors.length === 0) return;
		const section = parent.createDiv({ cls: "umos-sync-errors" });
		section.createDiv({ cls: "umos-sync-change-title", text: t("Errors") });
		for (const error of errors) {
			section.createDiv({ cls: "umos-sync-error", text: error });
		}
	}

	private renderDebugLogs(parent: HTMLElement): void {
		const section = parent.createDiv({ cls: "umos-sync-debug-log-section" });
		const head = section.createDiv({ cls: "umos-sync-debug-log-head" });
		const title = head.createDiv({ cls: "umos-sync-debug-log-title" });
		title.createSpan({ text: t("Debug logs") });
		title.createSpan({ cls: "umos-sync-debug-log-count", text: this.logsLoading ? t("Loading...") : String(this.logs.length) });
		const actions = head.createDiv({ cls: "umos-sync-debug-log-actions" });
		this.createSmallLogButton(actions, "Refresh logs", "refresh-cw", () => this.refreshLogs());
		this.createSmallLogButton(actions, "Copy logs", "copy", () => this.copyLogs());
		this.createSmallLogButton(actions, "Clear logs", "trash-2", () => this.clearLogs(), true);

		if (this.logsLoading) {
			section.createDiv({ cls: "umos-sync-debug-log-empty", text: t("Loading sync logs...") });
			return;
		}

		if (this.logs.length === 0) {
			section.createDiv({ cls: "umos-sync-debug-log-empty", text: t("No sync logs yet.") });
			return;
		}

		const pre = section.createEl("pre", { cls: "umos-sync-debug-log-list" });
		pre.setText(this.logs.join("\n"));
	}

	private createSmallLogButton(
		parent: HTMLElement,
		label: string,
		iconName: string,
		onClick: () => void | Promise<void>,
		danger = false
	): HTMLButtonElement {
		const button = parent.createEl("button", {
			cls: `umos-sync-debug-log-button${danger ? " is-danger" : ""}`,
			attr: { type: "button", "aria-label": t(label), title: t(label) },
		});
		setIcon(button, iconName);
		button.addEventListener("click", () => void onClick());
		return button;
	}

	private async refreshLogs(rerender = true): Promise<void> {
		this.logsLoading = true;
		if (rerender) this.render();
		this.logs = await this.plugin.vaultSyncService.readDebugLog(180);
		this.logsLoading = false;
		if (rerender) this.render();
	}

	private async copyLogs(): Promise<void> {
		if (this.logs.length === 0) {
			new Notice(t("No sync logs yet."));
			return;
		}
		await navigator.clipboard.writeText(this.logs.join("\n"));
		new Notice(t("Logs copied"));
	}

	private async clearLogs(): Promise<void> {
		await this.plugin.vaultSyncService.clearDebugLog();
		this.logs = [];
		new Notice(t("Logs cleared"));
		this.render();
	}

	private createActionButton(
		parent: HTMLElement,
		label: string,
		iconName: string,
		onClick: () => void | Promise<void>,
		primary = false,
		danger = false
	): HTMLButtonElement {
		const button = parent.createEl("button", {
			cls: `umos-sync-action${primary ? " is-primary" : ""}${danger ? " is-danger" : ""}`,
			attr: { type: "button", "aria-label": t(label), title: t(label) },
		});
		const icon = button.createSpan({ cls: "umos-sync-action-icon" });
		setIcon(icon, iconName);
		button.createSpan({ cls: "umos-sync-action-label", text: t(label) });
		button.addEventListener("click", () => void onClick());
		return button;
	}

	private async run(mode: SyncMode, dryRun = false): Promise<void> {
		this.status = "running";
		this.result = null;
		this.progress = {
			status: "running",
			phase: "Preparing",
			message: "Preparing sync...",
			current: 0,
			total: 100,
			percent: 0,
			cancellable: true,
		};
		const progressNotice = new SyncProgressNotice(this.plugin);
		this.render();
		try {
			const result = await this.plugin.vaultSyncService.run({
				mode,
				dryRun,
				reason: "manual",
				onProgress: (progress) => {
					this.progress = progress;
					this.status = progress.status;
					this.updateProgressPanel();
					progressNotice.update(progress);
				},
			});
			this.result = result;
			this.status = result.status;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			const cancelled = message.toLowerCase().includes("cancelled");
			this.status = cancelled ? "cancelled" : "failed";
			this.progress = {
				status: this.status,
				phase: cancelled ? "Cancelled" : "Failed",
				message,
				current: cancelled ? 100 : 0,
				total: 100,
				percent: cancelled ? 100 : 0,
				cancellable: false,
			};
			progressNotice.update(this.progress);
		}
		await this.refreshLogs(false);
		this.render();
	}

	private async testConnection(): Promise<void> {
		this.status = "running";
		this.render();
		try {
			await this.plugin.vaultSyncService.testConnection();
			this.status = "success";
			new Notice(t("Sync connection works"));
		} catch (error) {
			this.status = "failed";
			new Notice(error instanceof Error ? error.message : String(error));
		}
		await this.refreshLogs(false);
		this.render();
	}

	private cancel(): void {
		this.plugin.vaultSyncService.cancel();
		this.status = "cancelled";
		this.render();
	}

	private getStatusText(): string {
		if (this.status === "running") return "Running";
		if (this.status === "success") return "Success";
		if (this.status === "failed") return "Failed";
		if (this.status === "cancelled") return "Cancelled";
		return "Idle";
	}
}
