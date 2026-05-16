import { requestUrl } from "obsidian";
import { normalizeVaultPath } from "./SyncIgnore";
import { refreshDropboxAccessToken } from "./DropboxOAuth";
import type { SyncAdapter, SyncSecrets } from "./types";

interface DropboxAdapterOptions {
	remoteRoot: string;
	secrets: SyncSecrets;
	saveSecrets?: (next: Partial<SyncSecrets>) => Promise<void>;
	log?: (message: string, meta?: Record<string, unknown>) => void | Promise<void>;
}

interface DropboxUploadArg {
	path: string;
	mode: "overwrite";
	autorename: boolean;
	mute: boolean;
	strict_conflict: boolean;
}

export class DropboxSyncAdapter implements SyncAdapter {
	readonly provider = "dropbox" as const;
	private remoteRoot: string;
	private secrets: SyncSecrets;
	private saveSecrets?: DropboxAdapterOptions["saveSecrets"];
	private logFn?: DropboxAdapterOptions["log"];
	private requestTimeoutMs = 90_000;
	private writeTimeoutMs = 180_000;
	private ensuredDirs = new Set<string>();

	constructor(options: DropboxAdapterOptions) {
		this.remoteRoot = normalizeDropboxRelativePath(options.remoteRoot || "umOS Sync");
		this.secrets = options.secrets;
		this.saveSecrets = options.saveSecrets;
		this.logFn = options.log;
	}

	async testConnection(): Promise<void> {
		await this.jsonRequest("currentAccount", "https://api.dropboxapi.com/2/users/get_current_account", "null", {});
		await this.ensureDir("");
	}

	async read(path: string): Promise<ArrayBuffer | null> {
		const dropboxPath = this.fullPath(path);
		const response = await this.request("read", {
			url: "https://content.dropboxapi.com/2/files/download",
			method: "POST",
			headers: {
				...(await this.authHeaders()),
				"Dropbox-API-Arg": JSON.stringify({ path: dropboxPath }),
			},
			throw: false,
		}, { path, dropboxPath });
		if (response.status === 409) return null;
		if (response.status < 200 || response.status >= 300) {
			throw new Error(`Dropbox read failed for ${path}: HTTP ${response.status}`);
		}
		return response.arrayBuffer;
	}

	async write(path: string, data: ArrayBuffer): Promise<void> {
		await this.ensureDir(parentPath(path));
		const dropboxPath = this.fullPath(path);
		const arg: DropboxUploadArg = {
			path: dropboxPath,
			mode: "overwrite",
			autorename: false,
			mute: true,
			strict_conflict: false,
		};
		const response = await this.request("write", {
			url: "https://content.dropboxapi.com/2/files/upload",
			method: "POST",
			contentType: "application/octet-stream",
			headers: {
				...(await this.authHeaders()),
				"Content-Type": "application/octet-stream",
				"Dropbox-API-Arg": JSON.stringify(arg),
			},
			body: data,
			throw: false,
		}, { path, dropboxPath, bytes: data.byteLength }, this.writeTimeoutMs);
		if (response.status < 200 || response.status >= 300) {
			throw new Error(`Dropbox write failed for ${path}: HTTP ${response.status} ${readErrorBody(response.text)}`);
		}
	}

	async delete(path: string): Promise<void> {
		const dropboxPath = this.fullPath(path);
		const response = await this.jsonRequest("delete", "https://api.dropboxapi.com/2/files/delete_v2", JSON.stringify({ path: dropboxPath }), { path, dropboxPath });
		if (response.status === 409) return;
		if (response.status < 200 || response.status >= 300) {
			throw new Error(`Dropbox delete failed for ${path}: HTTP ${response.status} ${readErrorBody(response.text)}`);
		}
	}

	async exists(path: string): Promise<boolean> {
		const dropboxPath = this.fullPath(path);
		const response = await this.jsonRequest("exists", "https://api.dropboxapi.com/2/files/get_metadata", JSON.stringify({
			path: dropboxPath,
			include_deleted: false,
		}), { path, dropboxPath });
		if (response.status === 409) return false;
		if (response.status >= 200 && response.status < 300) return true;
		throw new Error(`Dropbox stat failed for ${path}: HTTP ${response.status} ${readErrorBody(response.text)}`);
	}

	async ensureDir(path: string): Promise<void> {
		const clean = normalizeDropboxRelativePath(path);
		const parts = [this.remoteRoot, ...clean.split("/").filter(Boolean)].filter(Boolean);
		let current = "";
		for (const part of parts) {
			current = current ? `${current}/${part}` : part;
			if (this.ensuredDirs.has(current)) continue;
			await this.createFolder(current);
			this.ensuredDirs.add(current);
		}
	}

	private async createFolder(relativePath: string): Promise<void> {
		const clean = normalizeDropboxRelativePath(relativePath);
		if (!clean) return;
		const dropboxPath = toDropboxPath(clean);
		if (await this.existsDropboxPath(dropboxPath)) return;
		const response = await this.jsonRequest("mkdir", "https://api.dropboxapi.com/2/files/create_folder_v2", JSON.stringify({
			path: dropboxPath,
			autorename: false,
		}), { path: clean, dropboxPath, body: { path: dropboxPath, autorename: false } });
		if ([200, 201].includes(response.status)) return;
		if (response.status === 409 && await this.existsDropboxPath(dropboxPath)) return;
		throw new Error(`Dropbox mkdir failed for ${clean}: HTTP ${response.status} ${readErrorBody(response.text)}`);
	}

	private async existsDropboxPath(dropboxPath: string): Promise<boolean> {
		const response = await this.jsonRequest("metadata", "https://api.dropboxapi.com/2/files/get_metadata", JSON.stringify({
			path: dropboxPath,
			include_deleted: false,
		}), { dropboxPath });
		if (response.status === 409) return false;
		if (response.status >= 200 && response.status < 300) return true;
		throw new Error(`Dropbox metadata failed for ${dropboxPath}: HTTP ${response.status} ${readErrorBody(response.text)}`);
	}

	private async jsonRequest(label: string, url: string, body: string, meta: Record<string, unknown>) {
		return this.request(label, {
			url,
			method: "POST",
			contentType: "application/json",
			headers: {
				...(await this.authHeaders()),
				"Content-Type": "application/json",
			},
			body,
			throw: false,
		}, meta);
	}

	private async authHeaders(): Promise<Record<string, string>> {
		return { Authorization: `Bearer ${await this.getAccessToken()}` };
	}

	private async getAccessToken(): Promise<string> {
		const current = this.secrets.dropboxAccessToken?.trim();
		const expiresAt = this.secrets.dropboxAccessTokenExpiresAt ?? 0;
		if (current && expiresAt > Date.now() + 60_000) return current;

		const token = await refreshDropboxAccessToken(
			this.secrets.dropboxAppKey ?? "",
			this.secrets.dropboxRefreshToken ?? ""
		);
		this.secrets = {
			...this.secrets,
			dropboxAccessToken: token.accessToken,
			dropboxAccessTokenExpiresAt: token.expiresAt,
			dropboxRefreshToken: token.refreshToken ?? this.secrets.dropboxRefreshToken,
			dropboxAccountId: token.accountId ?? this.secrets.dropboxAccountId,
		};
		await this.saveSecrets?.({
			dropboxAccessToken: this.secrets.dropboxAccessToken,
			dropboxAccessTokenExpiresAt: this.secrets.dropboxAccessTokenExpiresAt,
			dropboxRefreshToken: this.secrets.dropboxRefreshToken,
			dropboxAccountId: this.secrets.dropboxAccountId,
		});
		return this.secrets.dropboxAccessToken ?? "";
	}

	private fullPath(path: string): string {
		const relative = normalizeDropboxRelativePath(path);
		const full = [this.remoteRoot, relative].filter(Boolean).join("/");
		return toDropboxPath(full);
	}

	private async request(
		label: string,
		options: Parameters<typeof requestUrl>[0],
		meta: Record<string, unknown>,
		timeoutMs = this.requestTimeoutMs
	) {
		const started = Date.now();
		await this.log(`${label}:start`, meta);
		try {
			const response = await withTimeout(
				requestUrl(options),
				timeoutMs,
				`Dropbox ${label} timed out after ${Math.round(timeoutMs / 1000)}s`
			);
			await this.log(`${label}:done`, {
				...meta,
				status: response.status,
				durationMs: Date.now() - started,
				errorBody: response.status >= 300 ? readErrorBody(response.text) : undefined,
			});
			return response;
		} catch (error) {
			await this.log(`${label}:error`, {
				...meta,
				durationMs: Date.now() - started,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	private async log(message: string, meta?: Record<string, unknown>): Promise<void> {
		await this.logFn?.(`dropbox:${message}`, meta);
	}
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
		promise.then(
			(value) => {
				window.clearTimeout(timer);
				resolve(value);
			},
			(error) => {
				window.clearTimeout(timer);
				reject(error);
			}
		);
	});
}

function normalizeDropboxRelativePath(path: string): string {
	return normalizeVaultPath(path).replace(/^\/+|\/+$/g, "");
}

function toDropboxPath(path: string): string {
	const clean = normalizeDropboxRelativePath(path);
	return clean ? `/${clean}` : "";
}

function parentPath(path: string): string {
	const clean = normalizeDropboxRelativePath(path);
	const index = clean.lastIndexOf("/");
	return index <= 0 ? "" : clean.slice(0, index);
}

function readErrorBody(text: string): string {
	const trimmed = text.trim();
	if (!trimmed) return "";
	return trimmed.length > 240 ? `${trimmed.slice(0, 240)}...` : trimmed;
}
