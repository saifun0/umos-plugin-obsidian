import { Notice, Setting, setIcon } from "obsidian";
import { SettingsContext, createSection } from "../helpers";
import { DataJsonModal } from "../DataJsonModal";
import { t } from "../../i18n";
import { createDropboxAuthUrl, exchangeDropboxAuthCode } from "../../sync/DropboxOAuth";
import {
	DEFAULT_GOOGLE_REDIRECT_URI,
	createGoogleDriveAuthUrl,
	exchangeGoogleDriveAuthCode,
} from "../../sync/GoogleDriveOAuth";
import {
	DEFAULT_ONEDRIVE_REDIRECT_URI,
	createOneDriveAuthUrl,
	exchangeOneDriveAuthCode,
} from "../../sync/OneDriveOAuth";
import { SyncCenterModal } from "../../sync/SyncCenterModal";
import { SyncProviderGuideModal } from "../../sync/SyncProviderGuideModal";
import { SYNC_PROVIDER_DEFINITIONS } from "../../sync/providers";
import type { SyncAuthType, SyncMode, SyncSecrets } from "../../sync/types";

export function renderSyncSection(containerEl: HTMLElement, ctx: SettingsContext): void {
	renderVaultSyncSection(containerEl, ctx);
}

function renderVaultSyncSection(containerEl: HTMLElement, ctx: SettingsContext): void {
	const sectionEl = createSection(
		containerEl,
		"umos-settings-vault-sync",
		"Vault Sync",
		"Sync the whole vault through WebDAV, Yandex Disk, and future cloud adapters."
	);

	const providerGrid = sectionEl.createDiv({ cls: "umos-sync-provider-grid" });
	for (const provider of SYNC_PROVIDER_DEFINITIONS) {
		const tile = providerGrid.createDiv({ cls: "umos-sync-provider-tile" });
		const button = tile.createEl("button", {
			cls: `umos-sync-provider-card${ctx.settings.syncProvider === provider.id ? " is-active" : ""}${provider.implemented ? "" : " is-planned"}`,
			attr: { type: "button" },
		});
		const icon = button.createSpan({ cls: "umos-sync-provider-icon" });
		setIcon(icon, provider.icon);
		const text = button.createSpan({ cls: "umos-sync-provider-text" });
		text.createSpan({ cls: "umos-sync-provider-label", text: provider.label });
		text.createSpan({ cls: "umos-sync-provider-desc", text: provider.implemented ? provider.description : `${provider.description} · Planned` });
		button.disabled = !provider.implemented;
		button.addEventListener("click", async () => {
			if (!provider.implemented) return;
			ctx.settings.syncProvider = provider.id;
			if (provider.id === "yandex-webdav") {
				const service = ctx.plugin.vaultSyncService;
				const secrets = await service.loadSecrets();
				await service.saveSecrets({
					webdavUrl: secrets.webdavUrl || "https://webdav.yandex.com",
					webdavAuthType: secrets.webdavAuthType === "bearer" ? "oauth" : secrets.webdavAuthType,
				});
			}
			if (provider.id === "google-drive") {
				const service = ctx.plugin.vaultSyncService;
				const secrets = await service.loadSecrets();
				await service.saveSecrets({
					googleRedirectUri: secrets.googleRedirectUri || DEFAULT_GOOGLE_REDIRECT_URI,
				});
			}
			if (provider.id === "onedrive") {
				const service = ctx.plugin.vaultSyncService;
				const secrets = await service.loadSecrets();
				await service.saveSecrets({
					onedriveRedirectUri: secrets.onedriveRedirectUri || DEFAULT_ONEDRIVE_REDIRECT_URI,
				});
			}
			await ctx.saveSettings();
			ctx.display();
		});
		const guideButton = tile.createEl("button", {
			cls: "umos-sync-provider-guide-btn",
			attr: {
				type: "button",
				"aria-label": `${t("Open guide")}: ${t(provider.label)}`,
				title: `${t("Open guide")}: ${t(provider.label)}`,
			},
		});
		setIcon(guideButton, "circle-help");
		guideButton.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
			new SyncProviderGuideModal(ctx.app, provider.id).open();
		});
	}

	new Setting(sectionEl)
		.setName("Sync mode")
		.setDesc("Pull, push, or bidirectional sync. Bidirectional uses newer-wins conflict handling.")
		.addDropdown((dropdown) =>
			dropdown
				.addOption("bidirectional", "Bidirectional")
				.addOption("pull", "Pull")
				.addOption("push", "Push")
				.setValue(ctx.settings.syncMode)
				.onChange(async (value) => {
					ctx.settings.syncMode = normalizeMode(value);
					await ctx.saveSettings();
				})
		);

	if (!["dropbox", "onedrive", "google-drive"].includes(ctx.settings.syncProvider)) {
		new Setting(sectionEl)
			.setName("Remote root")
			.setDesc("Folder inside the remote provider used as the sync broker.")
			.addText((text) =>
				text
					.setPlaceholder("umOS Sync")
					.setValue(ctx.settings.syncRemoteRoot)
					.onChange(async (value) => {
						ctx.settings.syncRemoteRoot = value.trim() || "umOS Sync";
						await ctx.saveSettings();
					})
			);
	}

	const secretsWrap = sectionEl.createDiv({ cls: "umos-sync-secrets" });
	secretsWrap.createDiv({ cls: "umos-sync-subheading", text: "Provider credentials" });
	void renderSecretsFields(secretsWrap, ctx);

	const encryptionSection = createSyncSettingsGroup(sectionEl, "Remote encryption");
	new Setting(encryptionSection)
		.setName("Remote encryption")
		.setDesc("Local files stay normal. Remote manifest and files are encrypted with the password.")
		.addToggle((toggle) =>
			toggle
				.setValue(ctx.settings.syncEncryptionEnabled)
				.onChange(async (value) => {
					ctx.settings.syncEncryptionEnabled = value;
					await ctx.saveSettings();
					ctx.display();
				})
		);

	const encryptionWrap = encryptionSection.createDiv({ cls: "umos-sync-secrets is-nested" });
	void renderEncryptionField(encryptionWrap, ctx);

	const automationSection = createSyncSettingsGroup(sectionEl, "Automation");
	new Setting(automationSection)
		.setName("Sync on startup")
		.setDesc("Run sync after Obsidian layout is ready.")
		.addToggle((toggle) =>
			toggle
				.setValue(ctx.settings.syncOnStartup)
				.onChange(async (value) => {
					ctx.settings.syncOnStartup = value;
					await ctx.saveSettings();
				})
		);

	new Setting(automationSection)
		.setName("Auto-sync interval")
		.setDesc("Minutes between automatic sync runs. 0 disables interval sync.")
		.addText((text) =>
			text
				.setPlaceholder("0")
				.setValue(String(ctx.settings.syncIntervalMinutes ?? 0))
				.onChange(async (value) => {
					ctx.settings.syncIntervalMinutes = clampNumber(value, 0, 1440, 0);
					await ctx.saveSettings();
				})
		);

	new Setting(automationSection)
		.setName("Change debounce")
		.setDesc("Seconds after vault changes before auto-sync. 0 disables change-triggered sync.")
		.addText((text) =>
			text
				.setPlaceholder("0")
				.setValue(String(ctx.settings.syncDebounceSeconds ?? 0))
				.onChange(async (value) => {
					ctx.settings.syncDebounceSeconds = clampNumber(value, 0, 3600, 0);
					await ctx.saveSettings();
				})
		);

	const limitsSection = createSyncSettingsGroup(sectionEl, "Limits and safety");
	new Setting(limitsSection)
		.setName("Max file size")
		.setDesc("Files larger than this many MB are skipped.")
		.addText((text) =>
			text
				.setPlaceholder("50")
				.setValue(String(ctx.settings.syncMaxFileSizeMb ?? 50))
				.onChange(async (value) => {
					ctx.settings.syncMaxFileSizeMb = clampNumber(value, 1, 2048, 50);
					await ctx.saveSettings();
				})
		);

	new Setting(limitsSection)
		.setName("Dry run by default")
		.setDesc("Build the sync plan without writing files unless disabled.")
		.addToggle((toggle) =>
			toggle
				.setValue(ctx.settings.syncDryRun)
				.onChange(async (value) => {
					ctx.settings.syncDryRun = value;
					await ctx.saveSettings();
				})
		);

	const ignoreSetting = new Setting(limitsSection)
		.setName("Ignore patterns")
		.setDesc("One glob per line. Default ignores for secrets, cache, trash, and temp files are always applied.");
	const ignoreControl = ignoreSetting.controlEl.createEl("textarea", {
		cls: "umos-sync-ignore-textarea",
		attr: { rows: "6", spellcheck: "false" },
	});
	ignoreControl.value = ctx.settings.syncIgnorePatterns || "";
	ignoreControl.addEventListener("change", async () => {
		ctx.settings.syncIgnorePatterns = ignoreControl.value;
		await ctx.saveSettings();
	});

	const status = ctx.data_store.sync;
	const statusEl = sectionEl.createDiv({ cls: "umos-sync-settings-status" });
	statusEl.createDiv({ cls: `umos-sync-settings-status-pill is-${status?.lastStatus ?? "idle"}`, text: status?.lastStatus ?? "idle" });
	statusEl.createDiv({
		cls: "umos-sync-settings-status-text",
		text: status?.lastRunAt
			? `${status.lastMessage || "No message"} · ${new Date(status.lastRunAt).toLocaleString()}`
			: "Vault sync has not run yet.",
	});

	const centerCard = sectionEl.createDiv({ cls: "umos-sync-settings-center-card" });
	const centerCopy = centerCard.createDiv({ cls: "umos-sync-settings-center-copy" });
	centerCopy.createDiv({ cls: "umos-sync-settings-center-title", text: t("Sync Center") });
	centerCopy.createDiv({
		cls: "umos-sync-settings-center-desc",
		text: t("Preview changes, run pull/push/bidirectional sync, test connection, and inspect logs."),
	});
	const centerActions = centerCard.createDiv({ cls: "umos-sync-settings-center-actions" });
	createSyncCenterButton(centerActions, "Open Sync Center", "external-link", true, () => new SyncCenterModal(ctx.plugin).open());
	createSyncCenterButton(centerActions, "Test connection", "plug-zap", false, async () => {
		try {
			await ctx.plugin.vaultSyncService.testConnection();
			new Notice("Sync connection works");
		} catch (error) {
			new Notice(error instanceof Error ? error.message : String(error));
		}
	});
}

function createSyncSettingsGroup(parent: HTMLElement, title: string): HTMLElement {
	const group = parent.createDiv({ cls: "umos-sync-settings-group" });
	group.createDiv({ cls: "umos-sync-settings-group-title", text: title });
	return group;
}

function createSyncCenterButton(
	parent: HTMLElement,
	label: string,
	iconName: string,
	primary: boolean,
	onClick: () => void | Promise<void>
): HTMLButtonElement {
	const button = parent.createEl("button", {
		cls: `umos-sync-settings-center-button${primary ? " is-primary" : ""}`,
		attr: { type: "button" },
	});
	const icon = button.createSpan({ cls: "umos-sync-settings-center-button-icon" });
	setIcon(icon, iconName);
	button.createSpan({ cls: "umos-sync-settings-center-button-label", text: t(label) });
	button.addEventListener("click", () => {
		void onClick();
	});
	return button;
}



async function renderSecretsFields(container: HTMLElement, ctx: SettingsContext): Promise<void> {
	const service = ctx.plugin.vaultSyncService;
	const secrets = await service.loadSecrets();
	container.empty();
	container.createDiv({ cls: "umos-sync-subheading", text: "Provider credentials" });

	if (ctx.settings.syncProvider === "dropbox") {
		renderDropboxFields(container, ctx, secrets);
		return;
	}

	if (ctx.settings.syncProvider === "google-drive") {
		renderGoogleDriveFields(container, ctx, secrets);
		return;
	}

	if (ctx.settings.syncProvider === "onedrive") {
		renderOneDriveFields(container, ctx, secrets);
		return;
	}

	if (ctx.settings.syncProvider === "s3") {
		renderS3Fields(container, ctx, secrets);
		return;
	}

	if (ctx.settings.syncProvider === "local") {
		container.createDiv({
			cls: "umos-sync-secret-note",
			text: "Local folder sync does not need provider credentials.",
		});
		return;
	}

	createSecretInput(container, "WebDAV URL", secrets.webdavUrl, "https://webdav.example.com/remote.php/dav/files/user", async (value) => {
		await service.saveSecrets({ webdavUrl: value.trim() });
	}, false);

	createSelect(container, "Auth type", secrets.webdavAuthType, [
		["basic", "Basic password"],
		["bearer", "Bearer token"],
		["oauth", "OAuth token"],
	], async (value) => {
		await service.saveSecrets({ webdavAuthType: normalizeAuthType(value) });
	});

	createSecretInput(container, "Username", secrets.webdavUsername, "user@example.com", async (value) => {
		await service.saveSecrets({ webdavUsername: value });
	}, false);

	createSecretInput(container, "Password / app password", secrets.webdavPassword, secrets.webdavPassword ? "Stored locally" : "", async (value) => {
		await service.saveSecrets({ webdavPassword: value });
	}, true);

	createSecretInput(container, "Token", secrets.webdavToken, secrets.webdavToken ? "Stored locally" : "OAuth or bearer token", async (value) => {
		await service.saveSecrets({ webdavToken: value });
	}, true);
}

function renderGoogleDriveFields(container: HTMLElement, ctx: SettingsContext, secrets: SyncSecrets): void {
	const service = ctx.plugin.vaultSyncService;
	createSecretInput(container, "Google OAuth client ID", secrets.googleClientId ?? "", "Desktop OAuth client ID from Google Cloud Console", async (value) => {
		await service.saveSecrets({ googleClientId: value.trim() });
	}, false);

	createSecretInput(container, "Google redirect URI", secrets.googleRedirectUri || DEFAULT_GOOGLE_REDIRECT_URI, DEFAULT_GOOGLE_REDIRECT_URI, async (value) => {
		await service.saveSecrets({ googleRedirectUri: value.trim() || DEFAULT_GOOGLE_REDIRECT_URI });
	}, false);

	const status = container.createDiv({ cls: "umos-sync-oauth-status" });
	status.createSpan({
		cls: `umos-sync-oauth-dot${secrets.googleRefreshToken ? " is-connected" : ""}`,
	});
	status.createSpan({
		cls: "umos-sync-oauth-text",
		text: secrets.googleRefreshToken ? "Google Drive connected" : "Google Drive is not connected",
	});

	const authCodeInput = createSecretInput(
		container,
		"Google auth code or redirect URL",
		"",
		"Paste the code or full localhost redirect URL",
		async () => undefined,
		true
	);

	const oauthCard = container.createDiv({ cls: "umos-sync-oauth-card" });
	const oauthCopy = oauthCard.createDiv({ cls: "umos-sync-oauth-copy" });
	oauthCopy.createDiv({ cls: "umos-sync-oauth-title", text: "Google Drive OAuth" });
	oauthCopy.createDiv({
		cls: "umos-sync-oauth-desc",
		text: "Use a Desktop OAuth client. If the browser ends on a localhost error page, copy the full address bar URL here.",
	});
	const actions = oauthCard.createDiv({ cls: "umos-sync-oauth-actions" });
	createOauthButton(actions, "Generate auth link", "", async () => {
		try {
			const latest = await service.loadSecrets();
			const auth = await createGoogleDriveAuthUrl(
				latest.googleClientId ?? "",
				latest.googleRedirectUri || DEFAULT_GOOGLE_REDIRECT_URI
			);
			await service.saveSecrets({
				googleCodeVerifier: auth.codeVerifier,
				googleRedirectUri: auth.redirectUri,
			});
			await copyToClipboard(auth.url);
			window.open(auth.url);
			new Notice(t("Google auth link copied"));
		} catch (error) {
			new Notice(t(error instanceof Error ? error.message : String(error)));
		}
	});
	createOauthButton(actions, "Exchange code", "mod-cta", async () => {
		try {
			const latest = await service.loadSecrets();
			const token = await exchangeGoogleDriveAuthCode(
				latest.googleClientId ?? "",
				authCodeInput.value,
				latest.googleRedirectUri || DEFAULT_GOOGLE_REDIRECT_URI,
				latest.googleCodeVerifier ?? ""
			);
			await service.saveSecrets({
				googleAccessToken: token.accessToken,
				googleAccessTokenExpiresAt: token.expiresAt,
				googleRefreshToken: token.refreshToken ?? latest.googleRefreshToken,
				googleCodeVerifier: "",
			});
			authCodeInput.value = "";
			new Notice(t("Google Drive authorization saved"));
			ctx.display();
		} catch (error) {
			new Notice(t(error instanceof Error ? error.message : String(error)));
		}
	});
	createOauthButton(actions, "Clear Google Drive auth", "is-danger", async () => {
		await service.saveSecrets({
			googleAccessToken: "",
			googleAccessTokenExpiresAt: 0,
			googleRefreshToken: "",
			googleCodeVerifier: "",
		});
		new Notice(t("Google Drive auth cleared"));
		ctx.display();
	});
}

function renderOneDriveFields(container: HTMLElement, ctx: SettingsContext, secrets: SyncSecrets): void {
	const service = ctx.plugin.vaultSyncService;
	createSecretInput(container, "OneDrive client ID", secrets.onedriveClientId ?? "", "Public client ID from Microsoft Entra", async (value) => {
		await service.saveSecrets({ onedriveClientId: value.trim() });
	}, false);

	createSecretInput(container, "OneDrive redirect URI", secrets.onedriveRedirectUri || DEFAULT_ONEDRIVE_REDIRECT_URI, DEFAULT_ONEDRIVE_REDIRECT_URI, async (value) => {
		await service.saveSecrets({ onedriveRedirectUri: value.trim() || DEFAULT_ONEDRIVE_REDIRECT_URI });
	}, false);

	const status = container.createDiv({ cls: "umos-sync-oauth-status" });
	status.createSpan({
		cls: `umos-sync-oauth-dot${secrets.onedriveRefreshToken ? " is-connected" : ""}`,
	});
	status.createSpan({
		cls: "umos-sync-oauth-text",
		text: secrets.onedriveRefreshToken ? "OneDrive connected" : "OneDrive is not connected",
	});

	const authCodeInput = createSecretInput(
		container,
		"OneDrive auth code or redirect URL",
		"",
		"Paste the code or full localhost redirect URL",
		async () => undefined,
		true
	);

	const oauthCard = container.createDiv({ cls: "umos-sync-oauth-card" });
	const oauthCopy = oauthCard.createDiv({ cls: "umos-sync-oauth-copy" });
	oauthCopy.createDiv({ cls: "umos-sync-oauth-title", text: "OneDrive OAuth" });
	oauthCopy.createDiv({
		cls: "umos-sync-oauth-desc",
		text: "Use a public desktop client with Files.ReadWrite.AppFolder and offline_access permissions.",
	});
	const actions = oauthCard.createDiv({ cls: "umos-sync-oauth-actions" });
	createOauthButton(actions, "Generate auth link", "", async () => {
		try {
			const latest = await service.loadSecrets();
			const auth = await createOneDriveAuthUrl(
				latest.onedriveClientId ?? "",
				latest.onedriveRedirectUri || DEFAULT_ONEDRIVE_REDIRECT_URI
			);
			await service.saveSecrets({
				onedriveCodeVerifier: auth.codeVerifier,
				onedriveRedirectUri: auth.redirectUri,
			});
			await copyToClipboard(auth.url);
			window.open(auth.url);
			new Notice(t("OneDrive auth link copied"));
		} catch (error) {
			new Notice(t(error instanceof Error ? error.message : String(error)));
		}
	});
	createOauthButton(actions, "Exchange code", "mod-cta", async () => {
		try {
			const latest = await service.loadSecrets();
			const token = await exchangeOneDriveAuthCode(
				latest.onedriveClientId ?? "",
				authCodeInput.value,
				latest.onedriveRedirectUri || DEFAULT_ONEDRIVE_REDIRECT_URI,
				latest.onedriveCodeVerifier ?? ""
			);
			await service.saveSecrets({
				onedriveAccessToken: token.accessToken,
				onedriveAccessTokenExpiresAt: token.expiresAt,
				onedriveRefreshToken: token.refreshToken ?? latest.onedriveRefreshToken,
				onedriveCodeVerifier: "",
			});
			authCodeInput.value = "";
			new Notice(t("OneDrive authorization saved"));
			ctx.display();
		} catch (error) {
			new Notice(t(error instanceof Error ? error.message : String(error)));
		}
	});
	createOauthButton(actions, "Clear OneDrive auth", "is-danger", async () => {
		await service.saveSecrets({
			onedriveAccessToken: "",
			onedriveAccessTokenExpiresAt: 0,
			onedriveRefreshToken: "",
			onedriveCodeVerifier: "",
		});
		new Notice(t("OneDrive auth cleared"));
		ctx.display();
	});
}

function renderS3Fields(container: HTMLElement, ctx: SettingsContext, secrets: SyncSecrets): void {
	const service = ctx.plugin.vaultSyncService;
	createSecretInput(container, "S3 endpoint", secrets.s3Endpoint ?? "", "https://s3.amazonaws.com or https://<account>.r2.cloudflarestorage.com", async (value) => {
		await service.saveSecrets({ s3Endpoint: value.trim() });
	}, false);
	createSecretInput(container, "S3 region", secrets.s3Region ?? "us-east-1", "us-east-1", async (value) => {
		await service.saveSecrets({ s3Region: value.trim() || "us-east-1" });
	}, false);
	createSecretInput(container, "S3 bucket", secrets.s3Bucket ?? "", "umos-sync", async (value) => {
		await service.saveSecrets({ s3Bucket: value.trim() });
	}, false);
	createSecretInput(container, "S3 access key ID", secrets.s3AccessKeyId ?? "", "AKIA...", async (value) => {
		await service.saveSecrets({ s3AccessKeyId: value.trim() });
	}, false);
	createSecretInput(container, "S3 secret access key", secrets.s3SecretAccessKey ?? "", secrets.s3SecretAccessKey ? "Stored locally" : "Secret key", async (value) => {
		await service.saveSecrets({ s3SecretAccessKey: value });
	}, true);
	createSecretInput(container, "S3 session token", secrets.s3SessionToken ?? "", secrets.s3SessionToken ? "Stored locally" : "Optional", async (value) => {
		await service.saveSecrets({ s3SessionToken: value });
	}, true);

	const note = container.createDiv({ cls: "umos-sync-secret-note" });
	note.createSpan({ text: "S3 uses path-style requests: endpoint / bucket / remote root / object key." });
}

function renderDropboxFields(container: HTMLElement, ctx: SettingsContext, secrets: SyncSecrets): void {
	const service = ctx.plugin.vaultSyncService;

	const status = container.createDiv({ cls: "umos-sync-oauth-status" });
	status.createSpan({
		cls: `umos-sync-oauth-dot${secrets.dropboxRefreshToken ? " is-connected" : ""}`,
	});
	const statusText = status.createSpan({ cls: "umos-sync-oauth-text" });
	statusText.createSpan({ text: secrets.dropboxRefreshToken ? "Dropbox connected" : "Dropbox is not connected" });
	if (secrets.dropboxRefreshToken && secrets.dropboxAccountId) {
		statusText.createSpan({ text: ` · ${secrets.dropboxAccountId}` });
	}

	const oauthCard = container.createDiv({ cls: "umos-sync-oauth-card" });
	const oauthCopy = oauthCard.createDiv({ cls: "umos-sync-oauth-copy" });
	oauthCopy.createDiv({ cls: "umos-sync-oauth-title", text: "Dropbox" });
	oauthCopy.createDiv({
		cls: "umos-sync-oauth-desc",
		text: "Securely sync your vault to Dropbox.",
	});
	const actions = oauthCard.createDiv({ cls: "umos-sync-oauth-actions" });

	if (!secrets.dropboxRefreshToken) {
		createOauthButton(actions, "Sign in with Dropbox", "mod-cta", async () => {
			try {
				const auth = await createDropboxAuthUrl();
				await service.saveSecrets({ dropboxCodeVerifier: auth.codeVerifier });
				window.open(auth.url);
			} catch (error) {
				new Notice(t(error instanceof Error ? error.message : String(error)));
			}
		});
	} else {
		createOauthButton(actions, "Sign out", "is-danger", async () => {
			await service.saveSecrets({
				dropboxAccessToken: "",
				dropboxAccessTokenExpiresAt: 0,
				dropboxRefreshToken: "",
				dropboxAccountId: "",
				dropboxCodeVerifier: "",
			});
			new Notice(t("Dropbox auth cleared"));
			ctx.display();
		});
	}
}

async function renderEncryptionField(container: HTMLElement, ctx: SettingsContext): Promise<void> {
	container.empty();
	if (!ctx.settings.syncEncryptionEnabled) return;
	const service = ctx.plugin.vaultSyncService;
	const secrets = await service.loadSecrets();
	createSecretInput(container, "Encryption password", secrets.encryptionPassphrase, secrets.encryptionPassphrase ? "Stored locally" : "Required for encrypted remote sync", async (value) => {
		await service.saveSecrets({ encryptionPassphrase: value });
	}, true);
}

function createSecretInput(
	parent: HTMLElement,
	label: string,
	value: string,
	placeholder: string,
	onChange: (value: string) => Promise<void>,
	password: boolean
): HTMLInputElement {
	const field = parent.createDiv({ cls: "umos-sync-secret-field" });
	field.createSpan({ cls: "umos-sync-secret-label", text: label });
	const input = field.createEl("input", {
		cls: "umos-sync-secret-input",
		attr: {
			type: password ? "password" : "text",
			placeholder,
			spellcheck: "false",
		},
	}) as HTMLInputElement;
	input.value = value;
	input.addEventListener("change", () => void onChange(input.value));
	return input;
}

function createSelect(
	parent: HTMLElement,
	label: string,
	value: string,
	options: Array<[string, string]>,
	onChange: (value: string) => Promise<void>
): void {
	const field = parent.createDiv({ cls: "umos-sync-secret-field" });
	field.createSpan({ cls: "umos-sync-secret-label", text: label });
	const select = field.createEl("select", { cls: "umos-sync-secret-input" }) as HTMLSelectElement;
	for (const [optionValue, text] of options) {
		select.createEl("option", { value: optionValue, text });
	}
	select.value = value;
	select.addEventListener("change", () => void onChange(select.value));
}

function createOauthButton(parent: HTMLElement, text: string, cls: string, onClick: () => Promise<void>): HTMLButtonElement {
	const button = parent.createEl("button", {
		cls: `umos-sync-oauth-button ${cls}`.trim(),
		text,
		attr: { type: "button" },
	});
	button.addEventListener("click", () => void onClick());
	return button;
}

function normalizeMode(value: string): SyncMode {
	return value === "pull" || value === "push" ? value : "bidirectional";
}

function normalizeAuthType(value: string): SyncAuthType {
	if (value === "bearer" || value === "oauth") return value;
	return "basic";
}

function clampNumber(value: string, min: number, max: number, fallback: number): number {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return fallback;
	return Math.max(min, Math.min(max, Math.round(parsed)));
}

async function copyToClipboard(value: string): Promise<void> {
	if (!navigator.clipboard) throw new Error("Clipboard is unavailable");
	await navigator.clipboard.writeText(value);
}
