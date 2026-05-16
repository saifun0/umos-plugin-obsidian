import { requestUrl } from "obsidian";
import type { SyncAdapter, SyncProvider, SyncSecrets } from "./types";
import { normalizeVaultPath } from "./SyncIgnore";

interface WebDavAdapterOptions {
	provider: SyncProvider;
	remoteRoot: string;
	secrets: SyncSecrets;
	log?: (message: string, meta?: Record<string, unknown>) => void | Promise<void>;
}

export class WebDavSyncAdapter implements SyncAdapter {
	readonly provider: SyncProvider;
	private baseUrl: string;
	private remoteRoot: string;
	private secrets: SyncSecrets;
	private logFn?: WebDavAdapterOptions["log"];
	private requestTimeoutMs = 90_000;
	private writeTimeoutMs = 180_000;
	private ensuredDirs = new Set<string>();

	constructor(options: WebDavAdapterOptions) {
		this.provider = options.provider;
		this.secrets = options.secrets;
		this.logFn = options.log;
		this.baseUrl = this.normalizeBaseUrl(
			options.provider === "yandex-webdav"
				? (options.secrets.webdavUrl.trim() || "https://webdav.yandex.com")
				: options.secrets.webdavUrl
		);
		this.remoteRoot = normalizeRemotePath(options.remoteRoot || "umOS Sync");
	}

	async testConnection(): Promise<void> {
		if (!this.baseUrl) throw new Error("WebDAV URL is required");
		const response = await this.request("testConnection:remoteRoot", {
			url: this.buildUrl(""),
			method: "PROPFIND",
			headers: {
				...this.authHeaders(),
				Depth: "0",
			},
			throw: false,
		}, { path: this.remoteRoot, method: "PROPFIND" });
		if (response.status === 404) {
			const root = await this.request("testConnection:base", {
				url: this.baseUrl,
				method: "PROPFIND",
				headers: {
					...this.authHeaders(),
					Depth: "0",
				},
				throw: false,
			}, { path: "/", method: "PROPFIND" });
			if (root.status >= 200 && root.status < 300) return;
			throw new Error("Remote root does not exist and the WebDAV base path is not reachable.");
		}
		if (response.status < 200 || response.status >= 300) {
			throw new Error(`WebDAV connection failed: HTTP ${response.status}`);
		}
	}

	async read(path: string): Promise<ArrayBuffer | null> {
		const response = await this.request("read", {
			url: this.buildUrl(path),
			method: "GET",
			headers: this.authHeaders(),
			throw: false,
		}, { path, method: "GET" });
		if (response.status === 404) return null;
		if (response.status < 200 || response.status >= 300) {
			throw new Error(`WebDAV read failed for ${path}: HTTP ${response.status}`);
		}
		return response.arrayBuffer;
	}

	async write(path: string, data: ArrayBuffer): Promise<void> {
		await this.ensureDir(parentPath(path));
		const url = this.buildUrl(path);
		const body = cloneArrayBuffer(data);
		let response;
		try {
			response = await this.request("write", {
				url,
				method: "PUT",
				headers: this.authHeaders(),
				contentType: "application/octet-stream",
				body,
				throw: false,
			}, { path, method: "PUT", bytes: body.byteLength }, this.writeTimeoutMs);
		} catch (error) {
			if (!isInvalidArgumentError(error)) throw error;
			await this.log("write:retry-with-minimal-headers", {
				path,
				method: "PUT",
				bytes: body.byteLength,
				reason: getErrorMessage(error),
			});
			response = await this.request("write:minimal", {
				url,
				method: "PUT",
				headers: this.authHeaders(),
				body: cloneArrayBuffer(data),
				throw: false,
			}, { path, method: "PUT", bytes: data.byteLength }, this.writeTimeoutMs);
		}
		if (response.status < 200 || response.status >= 300) {
			throw new Error(`WebDAV write failed for ${path}: HTTP ${response.status}`);
		}
	}

	async delete(path: string): Promise<void> {
		const response = await this.request("delete", {
			url: this.buildUrl(path),
			method: "DELETE",
			headers: this.authHeaders(),
			throw: false,
		}, { path, method: "DELETE" });
		if (response.status === 404) return;
		if (response.status < 200 || response.status >= 300) {
			throw new Error(`WebDAV delete failed for ${path}: HTTP ${response.status}`);
		}
	}

	async exists(path: string): Promise<boolean> {
		const response = await this.request("exists:head", {
			url: this.buildUrl(path),
			method: "HEAD",
			headers: this.authHeaders(),
			throw: false,
		}, { path, method: "HEAD" });
		if (response.status === 404) return false;
		if (response.status >= 200 && response.status < 300) return true;
		const propfind = await this.request("exists:propfind", {
			url: this.buildUrl(path),
			method: "PROPFIND",
			headers: {
				...this.authHeaders(),
				Depth: "0",
			},
			throw: false,
		}, { path, method: "PROPFIND" });
		if (propfind.status === 404) return false;
		return propfind.status >= 200 && propfind.status < 300;
	}

	async ensureDir(path: string): Promise<void> {
		const clean = normalizeRemotePath(path);
		const parts = [this.remoteRoot, ...clean.split("/").filter(Boolean)].filter(Boolean);
		let current = "";
		for (const part of parts) {
			current = current ? `${current}/${part}` : part;
			if (this.ensuredDirs.has(current)) continue;
			await this.mkcol(current);
			this.ensuredDirs.add(current);
		}
	}

	private async mkcol(path: string): Promise<void> {
		if (!path) return;
		const url = this.buildUrlFromFullRemotePath(path);
		const exists = await this.existsFullRemotePath(path);
		if (exists) return;
		const response = await this.request("mkcol", {
			url,
			method: "MKCOL",
			headers: this.authHeaders(),
			throw: false,
		}, { path, method: "MKCOL" });
		if ([200, 201, 204, 405].includes(response.status)) return;
		throw new Error(`WebDAV mkdir failed for ${path}: HTTP ${response.status}`);
	}

	private async existsFullRemotePath(path: string): Promise<boolean> {
		const response = await this.request("existsFullRemotePath", {
			url: this.buildUrlFromFullRemotePath(path),
			method: "PROPFIND",
			headers: {
				...this.authHeaders(),
				Depth: "0",
			},
			throw: false,
		}, { path, method: "PROPFIND" });
		if (response.status === 404) return false;
		return response.status >= 200 && response.status < 300;
	}

	private buildUrl(path: string): string {
		const relative = normalizeRemotePath(path);
		const full = [this.remoteRoot, relative].filter(Boolean).join("/");
		return this.buildUrlFromFullRemotePath(full);
	}

	private buildUrlFromFullRemotePath(path: string): string {
		const encodedPath = normalizeRemotePath(path)
			.split("/")
			.filter(Boolean)
			.map(encodeURIComponent)
			.join("/");
		return encodedPath ? `${this.baseUrl}/${encodedPath}` : this.baseUrl;
	}

	private authHeaders(): Record<string, string> {
		if (this.secrets.webdavToken.trim()) {
			const scheme = this.provider === "yandex-webdav" || this.secrets.webdavAuthType === "oauth" ? "OAuth" : "Bearer";
			return { Authorization: `${scheme} ${this.secrets.webdavToken.trim()}` };
		}
		if (this.secrets.webdavUsername.trim() || this.secrets.webdavPassword.trim()) {
			return {
				Authorization: `Basic ${btoa(`${this.secrets.webdavUsername}:${this.secrets.webdavPassword}`)}`,
			};
		}
		return {};
	}

	private normalizeBaseUrl(value: string): string {
		return value.trim().replace(/\/+$/, "");
	}

	private async request(label: string, options: Parameters<typeof requestUrl>[0], meta: Record<string, unknown>, timeoutMs = this.requestTimeoutMs) {
		const started = Date.now();
		await this.log(`${label}:start`, meta);
		try {
			const response = await withTimeout(
				requestUrl(options),
				timeoutMs,
				`WebDAV ${label} timed out after ${Math.round(timeoutMs / 1000)}s`
			);
			await this.log(`${label}:done`, {
				...meta,
				status: response.status,
				durationMs: Date.now() - started,
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
		await this.logFn?.(`webdav:${message}`, meta);
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

function normalizeRemotePath(path: string): string {
	return normalizeVaultPath(path).replace(/\/+$/, "");
}

function parentPath(path: string): string {
	const clean = normalizeRemotePath(path);
	const index = clean.lastIndexOf("/");
	return index <= 0 ? "" : clean.slice(0, index);
}

function cloneArrayBuffer(buffer: ArrayBuffer): ArrayBuffer {
	const copy = new Uint8Array(buffer.byteLength);
	copy.set(new Uint8Array(buffer));
	return copy.buffer;
}

function isInvalidArgumentError(error: unknown): boolean {
	return getErrorMessage(error).includes("ERR_INVALID_ARGUMENT");
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
