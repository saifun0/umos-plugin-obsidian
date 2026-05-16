import { Notice, setIcon } from "obsidian";
import type UmOSPlugin from "../main";
import { t } from "../i18n";
import { UMOS_SYNC_ICON_ID } from "../branding";
import type { SyncProgress } from "./types";

export class SyncProgressNotice {
	private notice: Notice;
	private titleEl: HTMLElement;
	private detailEl: HTMLElement;
	private pathEl: HTMLElement;
	private fillEl: HTMLElement;
	private percentEl: HTMLElement;
	private closed = false;

	constructor(private plugin: UmOSPlugin) {
		this.notice = new Notice("", 0);
		this.notice.noticeEl.empty();
		this.notice.noticeEl.addClass("umos-sync-progress-notice");

		const shell = this.notice.noticeEl.createDiv({ cls: "umos-sync-progress-toast" });
		const top = shell.createDiv({ cls: "umos-sync-progress-toast-top" });
		const icon = top.createSpan({ cls: "umos-sync-progress-toast-icon" });
		setIcon(icon, UMOS_SYNC_ICON_ID);

		const body = top.createDiv({ cls: "umos-sync-progress-toast-body" });
		const head = body.createDiv({ cls: "umos-sync-progress-toast-head" });
		this.titleEl = head.createSpan({ cls: "umos-sync-progress-toast-title", text: t("Vault Sync") });
		this.percentEl = head.createSpan({ cls: "umos-sync-progress-toast-percent", text: "0%" });
		this.detailEl = body.createDiv({ cls: "umos-sync-progress-toast-detail", text: t("Preparing sync...") });
		this.pathEl = body.createDiv({ cls: "umos-sync-progress-toast-path" });

		const bar = shell.createDiv({ cls: "umos-sync-progress-toast-bar" });
		this.fillEl = bar.createDiv({ cls: "umos-sync-progress-toast-fill" });
	}

	update(progress: SyncProgress): void {
		if (this.closed) return;
		this.notice.noticeEl.toggleClass("is-running", progress.status === "running");
		this.notice.noticeEl.toggleClass("is-success", progress.status === "success");
		this.notice.noticeEl.toggleClass("is-failed", progress.status === "failed");
		this.notice.noticeEl.toggleClass("is-cancelled", progress.status === "cancelled");

		this.titleEl.setText(t(getProgressTitle(progress)));
		this.detailEl.setText(t(progress.message));
		if (progress.path) {
			this.pathEl.setText(getShortPath(progress.path));
			this.pathEl.title = progress.path;
			this.pathEl.show();
		} else {
			this.pathEl.empty();
			this.pathEl.hide();
		}
		const percent = Math.max(0, Math.min(100, Math.round(progress.percent)));
		this.percentEl.setText(`${percent}%`);
		this.fillEl.style.width = `${percent}%`;

		if (progress.status === "success" || progress.status === "failed" || progress.status === "cancelled" || (progress.status === "idle" && percent >= 100)) {
			window.setTimeout(() => this.hide(), 3500);
		}
	}

	hide(): void {
		if (this.closed) return;
		this.closed = true;
		this.notice.hide();
	}
}

function getShortPath(path: string): string {
	const clean = path.replace(/\\/g, "/");
	const parts = clean.split("/").filter(Boolean);
	if (parts.length <= 2) return clean;
	return `${parts[0]}/…/${parts[parts.length - 1]}`;
}

function getProgressTitle(progress: SyncProgress): string {
	if (progress.status === "success") return "Success";
	if (progress.status === "failed") return "Failed";
	if (progress.status === "cancelled") return "Cancelled";
	if (progress.status === "warning") return "Warning";
	if (progress.status === "idle" && progress.percent >= 100) return "Idle";
	return progress.phase || "Vault Sync";
}
