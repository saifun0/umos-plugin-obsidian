import { requestUrl } from "obsidian";
import { refreshOneDriveAccessToken } from "./OneDriveOAuth";
import { normalizeVaultPath } from "./SyncIgnore";
import type { SyncAdapter, SyncSecrets } from "./types";

interface OneDriveAdapterOptions {
	remoteRoot: string;
	secrets: SyncSecrets;
	saveSecrets?: (next: Partial<SyncSecrets>) => Promise<void>;
	log?: (message: string, meta?: Record<string, unknown>) => void | Promise<void>;
}

const GRAPH_URL = "https://graph.microsoft.com/v1.0";

export class OneDriveSyncAdapter implements SyncAdapter {
	readonly provider = "onedrive" as const;
	private remoteRoot: string;
	private secrets: SyncSecrets;
	private saveSecrets?: OneDriveAdapterOptions["saveSecrets"];
	private logFn?: OneDriveAdapterOptions["log"];
	private requestTimeoutMs = 90_000;
	private writeTimeoutMs = 180_000;
	private ensuredDirs = new Set<string>();

	constructor(options: OneDriveAdapterOptions) {
		this.remoteRoot = normalizeOneDrivePath(options.remoteRoot || "umOS Sync");
		this.secrets = options.secrets;
		this.saveSecrets = options.saveSecrets;
		this.logFn = options.log;
	}

	async testConnection(): Promise<void> {
		const response = await this.request("approot", {
			url: `${GRAPH_URL}/me/drive/special/approot`,
			method: "GET",
			headers: await this.authHeaders(),
			throw: false,
		}, {});
		if (response.status < 200 || response.status >= 300) {
			throw new Error(`OneDrive connection failed: HTTP ${response.status} ${readErrorBody(response.text)}`);
		}
		await this.ensureDir("");
	}

	async read(path: string): Promise<ArrayBuffer | null> {
		const fullPath = this.fullPath(path);
		const response = await this.request("read", {
			url: `${this.itemUrl(fullPath)}:/content`,
			method: "GET",
			headers: await this.authHeaders(),
			throw: false,
		}, { path, fullPath });
		if (response.status === 404) return null;
		if (response.status < 200 || response.status >= 300) {
			throw new Error(`OneDrive read failed for ${path}: HTTP ${response.status} ${readErrorBody(response.text)}`);
		}
		return response.arrayBuffer;
	}

	async write(path: string, data: ArrayBuffer): Promise<void> {
		await this.ensureDir(parentPath(path));
		const fullPath = this.fullPath(path);
		const response = await this.request("write", {
			url: `${this.itemUrl(fullPath)}:/content`,
			method: "PUT",
			contentType: "application/octet-stream",
			headers: {
				...(await this.authHeaders()),
				"Content-Type": "application/octet-stream",
			},
			body: data,
			throw: false,
		}, { path, fullPath, bytes: data.byteLength }, this.writeTimeoutMs);
		if (response.status < 200 || response.status >= 300) {
			throw new Error(`OneDrive write failed for ${path}: HTTP ${response.status} ${readErrorBody(response.text)}`);
		}
	}

	async delete(path: string): Promise<void> {
		const fullPath = this.fullPath(path);
		const response = await this.request("delete", {
			url: this.itemUrl(fullPath),
			method: "DELETE",
			headers: await this.authHeaders(),
			throw: false,
		}, { path, fullPath });
		if (response.status === 404) return;
		if (response.status < 200 || response.status >= 300) {
			throw new Error(`OneDrive delete failed for ${path}: HTTP ${response.status} ${readErrorBody(response.text)}`);
		}
	}

	async exists(path: string): Promise<boolean> {
		return this.existsOneDrivePath(this.fullPath(path));
	}

	async ensureDir(path: string): Promise<void> {
		const clean = normalizeOneDrivePath(path);
		const parts = [this.remoteRoot, ...clean.split("/").filter(Boolean)].filter(Boolean);
		let current = "";
		for (const part of parts) {
			const parent = current;
			current = current ? `${current}/${part}` : part;
			if (this.ensuredDirs.has(current)) continue;
			if (!await this.existsOneDrivePath(current)) {
				await this.createFolder(parent, part);
			}
			this.ensuredDirs.add(current);
		}
	}

	private async createFolder(parentPath: string, name: string): Promise<void> {
		const response = await this.request("mkdir", {
			url: this.childrenUrl(parentPath),
			method: "POST",
			contentType: "application/json",
			headers: {
				...(await this.authHeaders()),
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				name,
				folder: {},
				"@microsoft.graph.conflictBehavior": "fail",
			}),
			throw: false,
		}, { parentPath, name });
		if ([200, 201].includes(response.status)) return;
		if (response.status === 409 && await this.existsOneDrivePath([parentPath, name].filter(Boolean).join("/"))) return;
		throw new Error(`OneDrive mkdir failed for ${name}: HTTP ${response.status} ${readErrorBody(response.text)}`);
	}

	private async existsOneDrivePath(path: string): Promise<boolean> {
		const clean = normalizeOneDrivePath(path);
		if (!clean) return true;
		const response = await this.request("metadata", {
			url: this.itemUrl(clean),
			method: "GET",
			headers: await this.authHeaders(),
			throw: false,
		}, { path: clean });
		if (response.status === 404) return false;
		if (response.status >= 200 && response.status < 300) return true;
		throw new Error(`OneDrive metadata failed for ${clean}: HTTP ${response.status} ${readErrorBody(response.text)}`);
	}

	private async authHeaders(): Promise<Record<string, string>> {
		return { Authorization: `Bearer ${await this.getAccessToken()}` };
	}

	private async getAccessToken(): Promise<string> {
		const current = this.secrets.onedriveAccessToken?.trim();
		const expiresAt = this.secrets.onedriveAccessTokenExpiresAt ?? 0;
		if (current && expiresAt > Date.now() + 60_000) return current;

		const token = await refreshOneDriveAccessToken(
			this.secrets.onedriveClientId ?? "",
			this.secrets.onedriveRefreshToken ?? ""
		);
		this.secrets = {
			...this.secrets,
			onedriveAccessToken: token.accessToken,
			onedriveAccessTokenExpiresAt: token.expiresAt,
			onedriveRefreshToken: token.refreshToken ?? this.secrets.onedriveRefreshToken,
		};
		await this.saveSecrets?.({
			onedriveAccessToken: this.secrets.onedriveAccessToken,
			onedriveAccessTokenExpiresAt: this.secrets.onedriveAccessTokenExpiresAt,
			onedriveRefreshToken: this.secrets.onedriveRefreshToken,
		});
		return this.secrets.onedriveAccessToken ?? "";
	}

	private fullPath(path: string): string {
		return [this.remoteRoot, normalizeOneDrivePath(path)].filter(Boolean).join("/");
	}

	private itemUrl(path: string): string {
		const clean = normalizeOneDrivePath(path);
		if (!clean) return `${GRAPH_URL}/me/drive/special/approot`;
		return `${GRAPH_URL}/me/drive/special/approot:/${encodePathSegments(clean)}`;
	}

	private childrenUrl(parentPath: string): string {
		const clean = normalizeOneDrivePath(parentPath);
		if (!clean) return `${GRAPH_URL}/me/drive/special/approot/children`;
		return `${this.itemUrl(clean)}:/children`;
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
				`OneDrive ${label} timed out after ${Math.round(timeoutMs / 1000)}s`
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
		await this.logFn?.(`onedrive:${message}`, meta);
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

function normalizeOneDrivePath(path: string): string {
	return normalizeVaultPath(path).replace(/^\/+|\/+$/g, "");
}

function encodePathSegments(path: string): string {
	return normalizeOneDrivePath(path)
		.split("/")
		.filter(Boolean)
		.map((segment) => encodeURIComponent(segment))
		.join("/");
}

function parentPath(path: string): string {
	const clean = normalizeOneDrivePath(path);
	const index = clean.lastIndexOf("/");
	return index <= 0 ? "" : clean.slice(0, index);
}

function readErrorBody(text: string): string {
	const trimmed = text.trim();
	if (!trimmed) return "";
	return trimmed.length > 240 ? `${trimmed.slice(0, 240)}...` : trimmed;
}
