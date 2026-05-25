import { App, Modal, setIcon } from "obsidian";
import { t } from "../i18n";
import { SYNC_PROVIDER_DEFINITIONS } from "./providers";
import type { SyncProvider } from "./types";

interface SyncProviderGuideSection {
	title: string;
	items: string[];
}

interface SyncProviderGuide {
	subtitle: string;
	fields: string[];
	sections: SyncProviderGuideSection[];
}

const SYNC_PROVIDER_GUIDES: Record<SyncProvider, SyncProviderGuide> = {
	webdav: {
		subtitle: "Use this for Nextcloud, Synology, InfiniCLOUD, own servers, and compatible WebDAV storage.",
		fields: ["WebDAV URL", "Auth type", "Username", "Password / app password", "Remote root"],
		sections: [
			{
				title: "Setup steps",
				items: [
					"Paste the direct WebDAV endpoint from your provider.",
					"Use Basic password for username plus password or app password.",
					"Keep Remote root as a dedicated folder, for example umOS Sync.",
					"Click Test connection, then run Dry run before the first real sync.",
				],
			},
			{
				title: "Common fixes",
				items: [
					"Remove a trailing slash from the WebDAV URL if folder checks behave strangely.",
					"If listing works but upload fails, try an app password instead of the regular account password.",
				],
			},
		],
	},
	"yandex-webdav": {
		subtitle: "Yandex Disk uses the WebDAV adapter with Yandex-specific defaults.",
		fields: ["WebDAV URL", "Auth type", "Username", "Password / app password", "Remote root"],
		sections: [
			{
				title: "Setup steps",
				items: [
					"Use https://webdav.yandex.com or https://webdav.yandex.ru as the WebDAV URL.",
					"Enter your Yandex login as Username.",
					"Use an app password for Yandex Disk when your account blocks the regular password.",
					"Test connection first, then Push from the device that currently has the best vault copy.",
				],
			},
			{
				title: "Common fixes",
				items: [
					"If PROPFIND succeeds but PUT fails, reload Obsidian and retry after checking the Sync Center logs.",
					"Keep Remote root simple, for example umOS Sync, without nested special characters.",
				],
			},
		],
	},
	dropbox: {
		subtitle: "Dropbox uses a one-click OAuth connection to securely link your account.",
		fields: ["Remote root"],
		sections: [
			{
				title: "Setup steps",
				items: [
					"Click 'Connect to Dropbox' to securely link your account.",
					"Use Test connection after the account is linked.",
				],
			},
			{
				title: "Common fixes",
				items: [
					"If connection fails, check your internet or firewall.",
				],
			},
		],
	},
	"google-drive": {
		subtitle: "Google Drive uses OAuth and the hidden appDataFolder space.",
		fields: ["Google OAuth client ID", "Google redirect URI", "Google auth code or redirect URL", "Remote root"],
		sections: [
			{
				title: "Setup steps",
				items: [
					"Enable the Google Drive API in Google Cloud Console.",
					"Create an OAuth Desktop client and paste its client ID.",
					"Keep the redirect URI as http://127.0.0.1:42813/oauth2callback unless you changed it in Google Cloud.",
					"Generate the auth link, approve access, then paste the code or the full localhost redirect URL.",
				],
			},
			{
				title: "Common fixes",
				items: [
					"If the browser ends on a localhost error page, copy the full address bar URL back into umOS.",
					"The adapter uses drive.appdata, so synced files are hidden from your normal Drive file list.",
				],
			},
		],
	},
	onedrive: {
		subtitle: "OneDrive uses Microsoft Graph OAuth and the app folder permission.",
		fields: ["OneDrive client ID", "OneDrive redirect URI", "OneDrive auth code or redirect URL", "Remote root"],
		sections: [
			{
				title: "Setup steps",
				items: [
					"Create a public client app in Microsoft Entra.",
					"Add http://localhost:42814/oauth2callback as a desktop redirect URI.",
					"Allow offline_access, Files.ReadWrite.AppFolder, and User.Read permissions.",
					"Paste the client ID, generate the auth link, approve it, then exchange the returned code.",
				],
			},
			{
				title: "Common fixes",
				items: [
					"If Microsoft redirects to an error page on localhost, copy the full URL and paste it into umOS.",
					"If token refresh fails, clear OneDrive auth and reconnect.",
				],
			},
		],
	},
	s3: {
		subtitle: "S3-compatible sync works with AWS S3, Cloudflare R2, Backblaze B2, MinIO, and similar path-style storage.",
		fields: ["S3 endpoint", "S3 region", "S3 bucket", "S3 access key ID", "S3 secret access key", "S3 session token", "Remote root"],
		sections: [
			{
				title: "Setup steps",
				items: [
					"Create a bucket or choose an existing bucket dedicated to umOS sync.",
					"Paste the endpoint, region, bucket, access key, and secret key.",
					"Use a restricted key that can list, read, write, and delete objects only in this bucket.",
					"Run Test connection, then Dry run before a real Push.",
				],
			},
			{
				title: "Common fixes",
				items: [
					"Use a path-style compatible endpoint: endpoint / bucket / remote root / object key.",
					"If the provider requires a temporary token, fill S3 session token too.",
				],
			},
		],
	},
	local: {
		subtitle: "Local folder sync is mainly a debug adapter for testing the sync engine without a cloud account.",
		fields: ["Remote root", "Sync mode", "Dry run"],
		sections: [
			{
				title: "Setup steps",
				items: [
					"Choose a folder inside this vault as Remote root.",
					"Run Dry run to inspect the planned local copy.",
					"Use Push to write the remote test structure into that folder.",
					"Switch back to a real provider before syncing between devices.",
				],
			},
			{
				title: "Common fixes",
				items: [
					"Do not point Remote root at a folder with real notes unless you intentionally want sync objects there.",
					"Local mode is useful for UI checks, planner checks, and encryption checks.",
				],
			},
		],
	},
};

export class SyncProviderGuideModal extends Modal {
	constructor(app: App, private provider: SyncProvider) {
		super(app);
	}

	onOpen(): void {
		this.modalEl.addClass("umos-sync-guide-modal");
		this.contentEl.empty();
		this.contentEl.addClass("umos-sync-guide-content");

		const definition = SYNC_PROVIDER_DEFINITIONS.find((item) => item.id === this.provider);
		const guide = SYNC_PROVIDER_GUIDES[this.provider];
		const shell = this.contentEl.createDiv({ cls: "umos-sync-guide" });
		const header = shell.createDiv({ cls: "umos-sync-guide-header" });
		const icon = header.createSpan({ cls: "umos-sync-guide-icon" });
		setIcon(icon, definition?.icon ?? "cloud");
		const copy = header.createDiv({ cls: "umos-sync-guide-copy" });
		copy.createEl("h2", { cls: "umos-sync-guide-title", text: `${t(definition?.label ?? this.provider)} ${t("guide")}` });
		copy.createDiv({ cls: "umos-sync-guide-subtitle", text: t(guide.subtitle) });

		const fields = shell.createDiv({ cls: "umos-sync-guide-fields" });
		fields.createDiv({ cls: "umos-sync-guide-section-title", text: t("Fields to fill") });
		const fieldList = fields.createDiv({ cls: "umos-sync-guide-field-list" });
		for (const field of guide.fields) {
			fieldList.createSpan({ cls: "umos-sync-guide-field", text: t(field) });
		}

		for (const section of guide.sections) {
			const sectionEl = shell.createDiv({ cls: "umos-sync-guide-section" });
			sectionEl.createDiv({ cls: "umos-sync-guide-section-title", text: t(section.title) });
			const list = sectionEl.createEl("ol", { cls: "umos-sync-guide-list" });
			for (const item of section.items) {
				list.createEl("li", { text: t(item) });
			}
		}
	}

	onClose(): void {
		this.modalEl.removeClass("umos-sync-guide-modal");
		this.contentEl.removeClass("umos-sync-guide-content");
		this.contentEl.empty();
	}
}
