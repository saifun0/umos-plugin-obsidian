import { App, Notice, TFile, normalizePath } from "obsidian";
import type UmOSPlugin from "../main";
import { t } from "../i18n";
import { DropboxSyncAdapter } from "./DropboxSyncAdapter";
import { GoogleDriveSyncAdapter } from "./GoogleDriveSyncAdapter";
import { LocalFolderSyncAdapter } from "./LocalFolderSyncAdapter";
import { OneDriveSyncAdapter } from "./OneDriveSyncAdapter";
import { S3SyncAdapter } from "./S3SyncAdapter";
import {
	arrayBufferToString,
	decryptBytes,
	decryptJson,
	encryptBytes,
	encryptJson,
	sha256Hex,
	sha256TextHex,
	stringToArrayBuffer,
} from "./SyncCrypto";
import { SyncIgnore, buildIgnorePatterns, normalizeVaultPath } from "./SyncIgnore";
import { createEmptyManifest, createEmptySecrets, createEmptyState, isSyncManifest } from "./SyncManifest";
import { planSync } from "./SyncPlanner";
import { WebDavSyncAdapter } from "./WebDavSyncAdapter";
import { SYNC_PROVIDER_DEFINITIONS } from "./providers";
import type {
	LocalFileSnapshot,
	RemoteFileEntry,
	SyncAdapter,
	SyncLogEntry,
	SyncManifest,
	SyncMode,
	SyncProgress,
	SyncProvider,
	SyncRunOptions,
	SyncRunResult,
	SyncRunStatus,
	SyncSecrets,
	SyncState,
} from "./types";

const REMOTE_SYNC_ROOT = "_umos-sync";
const LEGACY_REMOTE_SYNC_ROOT = ".umos-sync";
const MANIFEST_JSON_PATH = `${REMOTE_SYNC_ROOT}/manifest.json`;
const MANIFEST_ENCRYPTED_PATH = `${REMOTE_SYNC_ROOT}/manifest.umenc`;
const LEGACY_MANIFEST_JSON_PATH = `${LEGACY_REMOTE_SYNC_ROOT}/manifest.json`;
const LEGACY_MANIFEST_ENCRYPTED_PATH = `${LEGACY_REMOTE_SYNC_ROOT}/manifest.umenc`;
const OBJECTS_ROOT = `${REMOTE_SYNC_ROOT}/objects`;
const STATE_FILE_NAME = "sync-state.local.json";
const SECRETS_FILE_NAME = "sync-secrets.local.json";
const DEBUG_LOG_FILE_NAME = "sync-debug.local.log";
const DEBUG_LOG_MAX_CHARS = 240_000;
type SyncDebugLevel = "debug" | "info" | "warn" | "error";

export class VaultSyncService {
	private running = false;
	private cancelled = false;
	private logWriteQueue: Promise<void> = Promise.resolve();

	constructor(private app: App, private plugin: UmOSPlugin) {}

	isRunning(): boolean {
		return this.running;
	}

	cancel(): void {
		this.cancelled = true;
	}

	async loadSecrets(): Promise<SyncSecrets> {
		const path = this.getSecretsPath();
		try {
			if (!await this.app.vault.adapter.exists(path)) return createEmptySecrets();
			const parsed = JSON.parse(await this.app.vault.adapter.read(path)) as Partial<SyncSecrets>;
			return { ...createEmptySecrets(), ...parsed, version: 1 };
		} catch (error) {
			console.warn("umOS sync: failed to load local secrets", error);
			return createEmptySecrets();
		}
	}

	async saveSecrets(next: Partial<SyncSecrets>): Promise<void> {
		const current = await this.loadSecrets();
		const merged: SyncSecrets = { ...current, ...next, version: 1 };
		await this.ensureLocalFolder(this.getPluginDir());
		await this.app.vault.adapter.write(this.getSecretsPath(), JSON.stringify(merged, null, 2));
	}

	async testConnection(): Promise<void> {
		const runId = this.createRunId("test");
		await this.appendDebugLog(runId, "info", "connection-test:start", {
			provider: this.plugin.settings.syncProvider,
			remoteRoot: this.plugin.settings.syncRemoteRoot,
		});
		try {
			const adapter = await this.createAdapter(undefined, runId);
			await adapter.testConnection();
			await this.appendDebugLog(runId, "info", "connection-test:success");
		} catch (error) {
			await this.appendDebugLog(runId, "error", "connection-test:failed", {
				error: getErrorMessage(error),
			});
			throw error;
		}
	}

	async readDebugLog(lines = 160): Promise<string[]> {
		const path = this.getDebugLogPath();
		await this.logWriteQueue.catch(() => undefined);
		if (!await this.app.vault.adapter.exists(path)) return [];
		const text = await this.app.vault.adapter.read(path);
		return text.split(/\r?\n/).filter(Boolean).slice(-lines);
	}

	async clearDebugLog(): Promise<void> {
		const path = this.getDebugLogPath();
		await this.logWriteQueue.catch(() => undefined);
		if (await this.app.vault.adapter.exists(path)) {
			await this.app.vault.adapter.remove(path);
		}
	}

	async run(options: SyncRunOptions = {}): Promise<SyncRunResult> {
		if (this.running) throw new Error("Vault sync is already running");
		this.running = true;
		this.cancelled = false;
		const startedAt = Date.now();
		const mode = options.mode ?? this.plugin.settings.syncMode ?? "bidirectional";
		const dryRun = options.dryRun ?? this.plugin.settings.syncDryRun ?? false;
		const errors: string[] = [];
		let result: SyncRunResult | null = null;
		const progress = createProgressEmitter(options.onProgress);
		const runId = this.createRunId("sync");

		this.updateRuntimeStatus("running", t("Vault sync is running..."));
		try {
			await this.appendDebugLog(runId, "info", "run:start", {
				mode,
				dryRun,
				reason: options.reason ?? "manual",
				provider: this.plugin.settings.syncProvider,
				remoteRoot: this.plugin.settings.syncRemoteRoot,
				encryption: this.plugin.settings.syncEncryptionEnabled,
				maxFileSizeMb: this.plugin.settings.syncMaxFileSizeMb,
			});
			progress("Preparing", "Preparing sync...", 0, 100);
			this.throwIfCancelled();
			progress("Connection", "Connecting to remote provider...", 8, 100);
			await this.appendDebugLog(runId, "info", "connection:prepare");
			const secrets = await this.loadSecrets();
			const adapter = await this.createAdapter(secrets, runId);
			await this.appendDebugLog(runId, "info", "connection:adapter-ready", { provider: adapter.provider });
			await this.ensureRemoteRoot(adapter);
			await this.appendDebugLog(runId, "info", "connection:remote-root-ready");
			this.throwIfCancelled();

			progress("State", "Loading sync state...", 18, 100);
			await this.appendDebugLog(runId, "info", "state:load:start");
			const state = await this.loadState();
			await this.appendDebugLog(runId, "info", "state:load:done", {
				deviceId: state.deviceId,
				vaultId: state.vaultId,
				entries: Object.keys(state.entries).length,
			});
			await this.appendDebugLog(runId, "info", "manifest:load:start");
			const manifest = await this.loadRemoteManifest(adapter, secrets, state);
			await this.appendDebugLog(runId, "info", "manifest:load:done", {
				encrypted: manifest.encrypted,
				entries: Object.keys(manifest.entries).length,
				tombstones: Object.keys(manifest.tombstones).length,
			});
			this.throwIfCancelled();

			await this.appendDebugLog(runId, "info", "scan:start");
			const localFiles = await this.scanLocalFiles((current, total, path) => {
				const scanPercent = total > 0 ? 20 + (current / total) * 35 : 55;
				progress("Scanning", "Scanning local vault...", scanPercent, 100, path);
			});
			await this.appendDebugLog(runId, "info", "scan:done", { files: localFiles.length });
			this.throwIfCancelled();

			progress("Planning", "Planning sync changes...", 58, 100);
			await this.appendDebugLog(runId, "info", "plan:start");
			const plan = planSync(mode, localFiles, manifest.entries, manifest.tombstones, state);
			progress("Planning", "Planning sync changes...", 64, 100);
			await this.appendDebugLog(runId, "info", "plan:done", plan.summary);

			if (!dryRun) {
				await this.applyPlan(plan.actions, manifest, state, adapter, secrets, (current, total, path, message) => {
					const applyPercent = total > 0 ? 66 + (current / total) * 26 : 88;
					progress("Syncing", message, applyPercent, 100, path);
				}, runId);
				this.throwIfCancelled();
				progress("Saving", "Saving remote manifest...", 94, 100);
				await this.appendDebugLog(runId, "info", "manifest:save:start");
				await this.saveRemoteManifest(adapter, manifest, secrets);
				await this.appendDebugLog(runId, "info", "manifest:save:done");
				this.throwIfCancelled();
				progress("Saving", "Saving local sync state...", 98, 100);
				await this.appendDebugLog(runId, "info", "state:save:start");
				await this.saveState(state, manifest.updatedAt);
				await this.appendDebugLog(runId, "info", "state:save:done");
			}

			const status: SyncRunStatus = dryRun ? "idle" : "success";
			const message = dryRun
				? t("Dry run complete")
				: this.describeSummary(plan.summary);
			result = {
				ok: true,
				status,
				mode,
				dryRun,
				startedAt,
				finishedAt: Date.now(),
				message,
				plan,
				errors,
			};
			await this.recordResult(result, state);
			await this.appendDebugLog(runId, "info", "run:success", {
				message: result.message,
				durationMs: result.finishedAt - result.startedAt,
			});
			progress(result.status, result.message, 100, 100);
			return result;
		} catch (error) {
			const message = getErrorMessage(error);
			errors.push(message);
			await this.appendDebugLog(runId, this.cancelled ? "warn" : "error", "run:failed", {
				cancelled: this.cancelled,
				error: message,
			});
			const emptyState = await this.loadState().catch(() => createEmptyState(this.createDeviceId(), this.createVaultId()));
			const emptyManifest = createEmptyManifest(emptyState.vaultId, emptyState.deviceId, this.plugin.settings.syncEncryptionEnabled);
			const plan = planSync(mode, [], emptyManifest.entries, emptyManifest.tombstones, emptyState);
			plan.summary.errors = 1;
			result = {
				ok: false,
				status: this.cancelled ? "cancelled" : "failed",
				mode,
				dryRun,
				startedAt,
				finishedAt: Date.now(),
				message,
				plan,
				errors,
			};
			await this.recordResult(result, emptyState).catch((recordError) => {
				console.warn("umOS sync: failed to record sync result", recordError);
			});
			progress(result.status, message, this.cancelled ? 100 : 0, 100);
			throw error;
		} finally {
			this.running = false;
			this.cancelled = false;
			if (result) this.updateRuntimeStatus(result.status, result.message);
		}
	}

	private async applyPlan(
		actions: ReturnType<typeof planSync>["actions"],
		manifest: SyncManifest,
		state: SyncState,
		adapter: SyncAdapter,
		secrets: SyncSecrets,
		onProgress?: (current: number, total: number, path: string, message: string) => void,
		runId?: string
	): Promise<void> {
		const total = Math.max(1, actions.length);
		let current = 0;
		for (const action of actions) {
			this.throwIfCancelled();
			current++;
			onProgress?.(current, total, action.path, getActionProgressMessage(action.type));
			if (runId) {
				await this.appendDebugLog(runId, "info", "action:start", {
					index: current,
					total,
					type: action.type,
					path: action.path,
					localSize: action.local?.size,
					remoteSize: action.remote?.size,
					conflict: action.conflict ?? false,
				});
			}
			switch (action.type) {
				case "upload":
					if (!action.local) break;
					await this.uploadFile(action.local, manifest, state, adapter, secrets);
					break;
				case "download":
					if (!action.remote) break;
					await this.downloadFile(action.remote, state, adapter, secrets);
					break;
				case "delete-local":
					await this.deleteLocalFile(action.path, state);
					break;
				case "delete-remote":
					if (!action.remote) break;
					await this.deleteRemoteFile(action.remote, manifest, state, adapter);
					break;
				case "skip":
					break;
			}
			if (runId) {
				await this.appendDebugLog(runId, "info", "action:done", {
					index: current,
					total,
					type: action.type,
					path: action.path,
				});
			}
		}
		manifest.updatedAt = Date.now();
		manifest.deviceId = state.deviceId;
	}

	private async uploadFile(
		local: LocalFileSnapshot,
		manifest: SyncManifest,
		state: SyncState,
		adapter: SyncAdapter,
		secrets: SyncSecrets
	): Promise<void> {
		const raw = await this.app.vault.adapter.readBinary(local.path);
		const encrypted = this.plugin.settings.syncEncryptionEnabled;
		const remotePath = await this.getRemoteObjectPath(local.path, encrypted, secrets);
		let payload = raw;
		let cryptoInfo: RemoteFileEntry["crypto"] | undefined;
		if (encrypted) {
			const encryptedPayload = await encryptBytes(raw, secrets.encryptionPassphrase);
			payload = encryptedPayload.payload;
			cryptoInfo = {
				algorithm: "AES-256-GCM/PBKDF2-SHA256",
				salt: encryptedPayload.salt,
				iv: encryptedPayload.iv,
			};
		}
		await adapter.write(remotePath, payload);
		const entry: RemoteFileEntry = {
			path: local.path,
			remotePath,
			size: local.size,
			mtime: local.mtime,
			sha256: local.sha256,
			updatedAt: Date.now(),
			deviceId: state.deviceId,
			encrypted,
			crypto: cryptoInfo,
		};
		manifest.entries[local.path] = entry;
		delete manifest.tombstones[local.path];
		state.entries[local.path] = {
			path: local.path,
			size: local.size,
			mtime: local.mtime,
			sha256: local.sha256,
			remoteUpdatedAt: entry.updatedAt,
			deleted: false,
			updatedAt: Date.now(),
		};
	}

	private async downloadFile(
		remote: RemoteFileEntry,
		state: SyncState,
		adapter: SyncAdapter,
		secrets: SyncSecrets
	): Promise<void> {
		const payload = await adapter.read(remote.remotePath);
		if (!payload) throw new Error(`Remote file missing: ${remote.path}`);
		let raw = payload;
		if (remote.encrypted) {
			if (!remote.crypto) throw new Error(`Missing crypto metadata for ${remote.path}`);
			raw = await decryptBytes(payload, secrets.encryptionPassphrase, remote.crypto.salt, remote.crypto.iv);
		}
		const hash = await sha256Hex(raw);
		if (hash !== remote.sha256) {
			throw new Error(`Checksum mismatch after download: ${remote.path}`);
		}
		await this.ensureLocalFolder(parentPath(remote.path));
		await this.app.vault.adapter.writeBinary(remote.path, raw);
		state.entries[remote.path] = {
			path: remote.path,
			size: remote.size,
			mtime: remote.mtime,
			sha256: remote.sha256,
			remoteUpdatedAt: remote.updatedAt,
			deleted: false,
			updatedAt: Date.now(),
		};
	}

	private async deleteLocalFile(path: string, state: SyncState): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile) {
			await this.app.vault.trash(file, true);
		} else if (await this.app.vault.adapter.exists(path)) {
			await this.app.vault.adapter.remove(path);
		}
		state.entries[path] = {
			path,
			deleted: true,
			updatedAt: Date.now(),
		};
	}

	private async deleteRemoteFile(
		remote: RemoteFileEntry,
		manifest: SyncManifest,
		state: SyncState,
		adapter: SyncAdapter
	): Promise<void> {
		await adapter.delete(remote.remotePath);
		delete manifest.entries[remote.path];
		manifest.tombstones[remote.path] = {
			path: remote.path,
			sha256: remote.sha256,
			deletedAt: Date.now(),
			deviceId: state.deviceId,
		};
		state.entries[remote.path] = {
			path: remote.path,
			sha256: remote.sha256,
			deleted: true,
			updatedAt: Date.now(),
		};
	}

	private async scanLocalFiles(onProgress?: (current: number, total: number, path: string) => void): Promise<LocalFileSnapshot[]> {
		const maxBytes = Math.max(1, this.plugin.settings.syncMaxFileSizeMb || 50) * 1024 * 1024;
		const ignore = new SyncIgnore(buildIgnorePatterns(
			this.plugin.settings.syncIgnorePatterns || "",
			this.plugin.settings.syncProvider === "local" ? this.plugin.settings.syncRemoteRoot : ""
		));
		const result: LocalFileSnapshot[] = [];
		const files = this.app.vault.getFiles();
		let current = 0;
		for (const file of files) {
			this.throwIfCancelled();
			current++;
			const path = normalizeVaultPath(file.path);
			onProgress?.(current, files.length, path);
			if (ignore.ignores(path)) continue;
			if (file.stat.size > maxBytes) continue;
			const data = await this.app.vault.adapter.readBinary(path);
			result.push({
				path,
				size: file.stat.size,
				mtime: file.stat.mtime,
				sha256: await sha256Hex(data),
			});
		}
		return result;
	}

	private async loadRemoteManifest(adapter: SyncAdapter, secrets: SyncSecrets, state: SyncState): Promise<SyncManifest> {
		const encrypted = this.plugin.settings.syncEncryptionEnabled;
		const encryptedRaw = await adapter.read(MANIFEST_ENCRYPTED_PATH);
		const legacyEncryptedRaw = encryptedRaw ? null : await adapter.read(LEGACY_MANIFEST_ENCRYPTED_PATH);
		const activeEncryptedRaw = encryptedRaw ?? legacyEncryptedRaw;
		const plainRaw = activeEncryptedRaw ? null : await adapter.read(MANIFEST_JSON_PATH);
		const legacyPlainRaw = activeEncryptedRaw || plainRaw ? null : await adapter.read(LEGACY_MANIFEST_JSON_PATH);
		const activePlainRaw = plainRaw ?? legacyPlainRaw;

		if (activeEncryptedRaw) {
			if (!encrypted) throw new Error("Remote manifest is encrypted. Enable encryption and enter the password.");
			try {
				const parsed = await decryptJson<unknown>(activeEncryptedRaw, secrets.encryptionPassphrase);
				if (!isSyncManifest(parsed)) throw new Error("Invalid remote manifest");
				return parsed;
			} catch (error) {
				throw new Error(`Could not decrypt remote manifest: ${getErrorMessage(error)}`);
			}
		}

		if (activePlainRaw) {
			if (encrypted) {
				const parsed = JSON.parse(arrayBufferToString(activePlainRaw)) as unknown;
				if (isSyncManifest(parsed) && Object.keys(parsed.entries).length > 0) {
					throw new Error("Remote manifest is not encrypted. Disable encryption or re-encrypt remote first.");
				}
			}
			const parsed = JSON.parse(arrayBufferToString(activePlainRaw)) as unknown;
			if (!isSyncManifest(parsed)) throw new Error("Invalid remote manifest");
			return parsed;
		}

		return createEmptyManifest(state.vaultId, state.deviceId, encrypted);
	}

	private async saveRemoteManifest(adapter: SyncAdapter, manifest: SyncManifest, secrets: SyncSecrets): Promise<void> {
		manifest.encrypted = this.plugin.settings.syncEncryptionEnabled;
		manifest.updatedAt = Date.now();
		if (manifest.encrypted) {
			await adapter.write(MANIFEST_ENCRYPTED_PATH, await encryptJson(manifest, secrets.encryptionPassphrase));
			if (await adapter.exists(MANIFEST_JSON_PATH)) await adapter.delete(MANIFEST_JSON_PATH);
			if (await adapter.exists(LEGACY_MANIFEST_JSON_PATH)) await adapter.delete(LEGACY_MANIFEST_JSON_PATH);
			return;
		}
		await adapter.write(MANIFEST_JSON_PATH, stringToArrayBuffer(JSON.stringify(manifest, null, 2)));
		if (await adapter.exists(MANIFEST_ENCRYPTED_PATH)) await adapter.delete(MANIFEST_ENCRYPTED_PATH);
		if (await adapter.exists(LEGACY_MANIFEST_ENCRYPTED_PATH)) await adapter.delete(LEGACY_MANIFEST_ENCRYPTED_PATH);
	}

	private async loadState(): Promise<SyncState> {
		const path = this.getStatePath();
		if (!await this.app.vault.adapter.exists(path)) {
			return createEmptyState(this.createDeviceId(), this.createVaultId());
		}
		try {
			const parsed = JSON.parse(await this.app.vault.adapter.read(path)) as Partial<SyncState>;
			const deviceId = typeof parsed.deviceId === "string" ? parsed.deviceId : this.createDeviceId();
			const vaultId = typeof parsed.vaultId === "string" ? parsed.vaultId : this.createVaultId();
			return {
				version: 1,
				deviceId,
				vaultId,
				updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
				lastRemoteUpdatedAt: typeof parsed.lastRemoteUpdatedAt === "number" ? parsed.lastRemoteUpdatedAt : 0,
				entries: parsed.entries && typeof parsed.entries === "object" ? parsed.entries : {},
				logs: Array.isArray(parsed.logs) ? parsed.logs : [],
			};
		} catch {
			return createEmptyState(this.createDeviceId(), this.createVaultId());
		}
	}

	private async saveState(state: SyncState, remoteUpdatedAt: number): Promise<void> {
		state.updatedAt = Date.now();
		state.lastRemoteUpdatedAt = remoteUpdatedAt;
		await this.ensureLocalFolder(this.getPluginDir());
		await this.app.vault.adapter.write(this.getStatePath(), JSON.stringify(state, null, 2));
	}

	private async recordResult(result: SyncRunResult, state: SyncState): Promise<void> {
		const entry: SyncLogEntry = {
			id: `${result.startedAt}-${Math.random().toString(36).slice(2, 8)}`,
			startedAt: result.startedAt,
			finishedAt: result.finishedAt,
			mode: result.mode,
			dryRun: result.dryRun,
			status: result.status,
			message: result.message,
			summary: result.plan.summary,
		};
		state.logs = [entry, ...(state.logs ?? [])].slice(0, 30);
		await this.saveState(state, state.lastRemoteUpdatedAt);

		this.plugin.data_store.sync = {
			...(this.plugin.data_store.sync ?? {}),
			lastRunAt: result.finishedAt,
			lastStatus: result.status,
			lastMessage: result.message,
			lastSummary: result.plan.summary,
		};
		await this.plugin.saveSettings();
	}

	private updateRuntimeStatus(status: SyncRunStatus, message: string): void {
		this.plugin.data_store.sync = {
			...(this.plugin.data_store.sync ?? {}),
			lastStatus: status,
			lastMessage: message,
		};
		this.plugin.updateVaultSyncStatusBar?.();
	}

	private throwIfCancelled(): void {
		if (this.cancelled) throw new Error("Vault sync cancelled");
	}

	private async createAdapter(secretsArg?: SyncSecrets, runId?: string): Promise<SyncAdapter> {
		const secrets = secretsArg ?? await this.loadSecrets();
		const provider = this.plugin.settings.syncProvider ?? "webdav";
		const definition = SYNC_PROVIDER_DEFINITIONS.find((item) => item.id === provider);
		if (!definition?.implemented) {
			throw new Error(`${definition?.label ?? provider} sync adapter is planned but not implemented yet`);
		}
		if (provider === "local") {
			return new LocalFolderSyncAdapter(this.app, this.plugin.settings.syncRemoteRoot || ".umos-sync/remote");
		}
		if (provider === "dropbox") {
			return new DropboxSyncAdapter({
				remoteRoot: this.plugin.settings.syncRemoteRoot || "umOS Sync",
				secrets,
				saveSecrets: (next) => this.saveSecrets(next),
				log: (message, meta) => this.appendDebugLog(runId ?? "dropbox", "debug", message, meta),
			});
		}
		if (provider === "google-drive") {
			return new GoogleDriveSyncAdapter({
				remoteRoot: this.plugin.settings.syncRemoteRoot || "umOS Sync",
				secrets,
				saveSecrets: (next) => this.saveSecrets(next),
				log: (message, meta) => this.appendDebugLog(runId ?? "google-drive", "debug", message, meta),
			});
		}
		if (provider === "onedrive") {
			return new OneDriveSyncAdapter({
				remoteRoot: this.plugin.settings.syncRemoteRoot || "umOS Sync",
				secrets,
				saveSecrets: (next) => this.saveSecrets(next),
				log: (message, meta) => this.appendDebugLog(runId ?? "onedrive", "debug", message, meta),
			});
		}
		if (provider === "s3") {
			return new S3SyncAdapter({
				remoteRoot: this.plugin.settings.syncRemoteRoot || "umOS Sync",
				secrets,
				log: (message, meta) => this.appendDebugLog(runId ?? "s3", "debug", message, meta),
			});
		}
		return new WebDavSyncAdapter({
			provider,
			remoteRoot: this.plugin.settings.syncRemoteRoot || "umOS Sync",
			secrets,
			log: (message, meta) => this.appendDebugLog(runId ?? "webdav", "debug", message, meta),
		});
	}

	private async ensureRemoteRoot(adapter: SyncAdapter): Promise<void> {
		await adapter.ensureDir("");
		await adapter.ensureDir(OBJECTS_ROOT);
	}

	private async getRemoteObjectPath(path: string, encrypted: boolean, secrets: SyncSecrets): Promise<string> {
		if (!encrypted) {
			return `files/${path.split("/").map(encodeURIComponent).join("/")}`;
		}
		const hash = await sha256TextHex(`umos-sync-object:${secrets.encryptionPassphrase}:${path}`);
		return `${OBJECTS_ROOT}/${hash.slice(0, 2)}/${hash}.bin`;
	}

	private async ensureLocalFolder(folder: string): Promise<void> {
		const clean = normalizePath(folder).replace(/^\/+|\/+$/g, "");
		if (!clean) return;
		const parts = clean.split("/").filter(Boolean);
		let current = "";
		for (const part of parts) {
			current = current ? `${current}/${part}` : part;
			if (!await this.app.vault.adapter.exists(current)) {
				await this.app.vault.createFolder(current);
			}
		}
	}

	private getPluginDir(): string {
		return this.plugin.manifest.dir ?? ".obsidian/plugins/umos-plugin";
	}

	private getSecretsPath(): string {
		return normalizePath(`${this.getPluginDir()}/${SECRETS_FILE_NAME}`);
	}

	private getStatePath(): string {
		return normalizePath(`${this.getPluginDir()}/${STATE_FILE_NAME}`);
	}

	private getDebugLogPath(): string {
		return normalizePath(`${this.getPluginDir()}/${DEBUG_LOG_FILE_NAME}`);
	}

	private createRunId(prefix: string): string {
		return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
	}

	private appendDebugLog(runId: string, level: SyncDebugLevel, message: string, meta?: unknown): Promise<void> {
		const line = formatDebugLine(runId, level, message, meta);
		this.logWriteQueue = this.logWriteQueue
			.catch(() => undefined)
			.then(async () => {
				await this.ensureLocalFolder(this.getPluginDir());
				const path = this.getDebugLogPath();
				let current = "";
				if (await this.app.vault.adapter.exists(path)) {
					current = await this.app.vault.adapter.read(path);
					if (current.length > DEBUG_LOG_MAX_CHARS) {
						current = current.slice(-Math.floor(DEBUG_LOG_MAX_CHARS * 0.75));
						const firstLineEnd = current.indexOf("\n");
						if (firstLineEnd >= 0) current = current.slice(firstLineEnd + 1);
					}
				}
				await this.app.vault.adapter.write(path, `${current}${line}\n`);
			})
			.catch((error) => {
				console.warn("umOS sync: failed to write debug log", error);
			});
		return this.logWriteQueue;
	}

	private createDeviceId(): string {
		const seed = `${navigator.userAgent}:${Date.now()}:${Math.random()}`;
		return `device-${Math.abs(hashCode(seed)).toString(36)}`;
	}

	private createVaultId(): string {
		const adapter = this.app.vault.adapter;
		const seed = "getName" in adapter && typeof adapter.getName === "function"
			? String(adapter.getName())
			: "umOS-vault";
		return `vault-${Math.abs(hashCode(seed)).toString(36)}`;
	}

	private describeSummary(summary: SyncRunResult["plan"]["summary"]): string {
		return [
			`${summary.uploaded} ${t("uploaded")}`,
			`${summary.downloaded} ${t("downloaded")}`,
			`${summary.deletedLocal + summary.deletedRemote} ${t("deleted")}`,
			summary.conflicts ? `${summary.conflicts} ${t("conflicts")}` : "",
		].filter(Boolean).join(" · ");
	}
}

function createProgressEmitter(callback?: (progress: SyncProgress) => void): (
	phase: string,
	message: string,
	current: number,
	total: number,
	path?: string
) => void {
	return (phase, message, current, total, path) => {
		if (!callback) return;
		const safeTotal = Math.max(1, total);
		const safeCurrent = Math.max(0, Math.min(safeTotal, current));
		callback({
			status: phase === "success" || phase === "failed" || phase === "cancelled" || phase === "idle" || phase === "warning"
				? phase
				: "running",
			phase,
			message,
			current: safeCurrent,
			total: safeTotal,
			percent: (safeCurrent / safeTotal) * 100,
			path,
			cancellable: true,
		});
	};
}

function getActionProgressMessage(type: ReturnType<typeof planSync>["actions"][number]["type"]): string {
	switch (type) {
		case "upload":
			return "Uploading file...";
		case "download":
			return "Downloading file...";
		case "delete-local":
			return "Deleting local file...";
		case "delete-remote":
			return "Deleting remote file...";
		case "skip":
			return "Skipping file...";
	}
}

function formatDebugLine(runId: string, level: SyncDebugLevel, message: string, meta?: unknown): string {
	const timestamp = new Date().toISOString();
	const suffix = meta === undefined ? "" : ` ${JSON.stringify(sanitizeDebugMeta(meta))}`;
	return `[${timestamp}] [${level.toUpperCase()}] [${runId}] ${message}${suffix}`;
}

function sanitizeDebugMeta(value: unknown, depth = 0): unknown {
	if (value === null || value === undefined) return value;
	if (typeof value === "string") return sanitizeDebugString(value);
	if (typeof value === "number" || typeof value === "boolean") return value;
	if (Array.isArray(value)) {
		return depth > 3 ? `[array:${value.length}]` : value.slice(0, 20).map((item) => sanitizeDebugMeta(item, depth + 1));
	}
	if (typeof value === "object") {
		if (depth > 3) return "[object]";
		const out: Record<string, unknown> = {};
		for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
			if (/password|passphrase|token|authorization|secret|refresh/i.test(key)) {
				out[key] = "[redacted]";
				continue;
			}
			out[key] = sanitizeDebugMeta(item, depth + 1);
		}
		return out;
	}
	return String(value);
}

function sanitizeDebugString(value: string): string {
	if (value.length > 420) return `${value.slice(0, 420)}...`;
	return value;
}

function parentPath(path: string): string {
	const clean = normalizeVaultPath(path);
	const index = clean.lastIndexOf("/");
	return index <= 0 ? "" : clean.slice(0, index);
}

function hashCode(value: string): number {
	let hash = 0;
	for (let i = 0; i < value.length; i++) {
		hash = ((hash << 5) - hash) + value.charCodeAt(i);
		hash |= 0;
	}
	return hash;
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
