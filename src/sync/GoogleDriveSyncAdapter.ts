import { requestUrl } from "obsidian";
import { refreshGoogleDriveAccessToken } from "./GoogleDriveOAuth";
import { normalizeVaultPath } from "./SyncIgnore";
import type { SyncAdapter, SyncSecrets } from "./types";

interface GoogleDriveAdapterOptions {
	remoteRoot: string;
	secrets: SyncSecrets;
	saveSecrets?: (next: Partial<SyncSecrets>) => Promise<void>;
	log?: (message: string, meta?: Record<string, unknown>) => void | Promise<void>;
}

interface DriveFileListResponse {
	files?: Array<{
		id?: string;
		name?: string;
		size?: string;
		modifiedTime?: string;
		appProperties?: Record<string, string>;
	}>;
}

interface MultipartBody {
	body: ArrayBuffer;
	contentType: string;
}

const DRIVE_API_URL = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3";
const PATH_HASH_PROPERTY = "umosPathHash";

export class GoogleDriveSyncAdapter implements SyncAdapter {
	readonly provider = "google-drive" as const;
	private remoteRoot: string;
	private secrets: SyncSecrets;
	private saveSecrets?: GoogleDriveAdapterOptions["saveSecrets"];
	private logFn?: GoogleDriveAdapterOptions["log"];
	private requestTimeoutMs = 90_000;
	private writeTimeoutMs = 180_000;
	private fileIdByPath = new Map<string, string | null>();

	constructor(options: GoogleDriveAdapterOptions) {
		this.remoteRoot = "";
		this.secrets = options.secrets;
		this.saveSecrets = options.saveSecrets;
		this.logFn = options.log;
	}

	async testConnection(): Promise<void> {
		const response = await this.request("list", {
			url: `${DRIVE_API_URL}/files?spaces=appDataFolder&pageSize=1&fields=files(id,name)`,
			method: "GET",
			headers: await this.authHeaders(),
			throw: false,
		}, {});
		if (response.status < 200 || response.status >= 300) {
			throw new Error(`Google Drive connection failed: HTTP ${response.status} ${readErrorBody(response.text)}`);
		}
		await this.ensureDir("");
	}

	async read(path: string): Promise<ArrayBuffer | null> {
		const fullPath = this.fullPath(path);
		const fileId = await this.findFileId(fullPath);
		if (!fileId) return null;
		const response = await this.request("read", {
			url: `${DRIVE_API_URL}/files/${encodeURIComponent(fileId)}?alt=media`,
			method: "GET",
			headers: await this.authHeaders(),
			throw: false,
		}, { path, fullPath, fileId });
		if (response.status === 404) return null;
		if (response.status < 200 || response.status >= 300) {
			throw new Error(`Google Drive read failed for ${path}: HTTP ${response.status} ${readErrorBody(response.text)}`);
		}
		return response.arrayBuffer;
	}

	async write(path: string, data: ArrayBuffer): Promise<void> {
		const fullPath = this.fullPath(path);
		const pathHash = await pathHashKey(fullPath);
		const fileId = await this.findFileId(fullPath);
		const metadata = {
			name: buildDriveFileName(fullPath, pathHash),
			parents: fileId ? undefined : ["appDataFolder"],
			appProperties: {
				[PATH_HASH_PROPERTY]: pathHash,
			},
		};
		const multipart = createMultipartBody(metadata, data);
		const response = await this.request("write", {
			url: fileId
				? `${DRIVE_UPLOAD_URL}/files/${encodeURIComponent(fileId)}?uploadType=multipart&fields=id`
				: `${DRIVE_UPLOAD_URL}/files?uploadType=multipart&fields=id`,
			method: fileId ? "PATCH" : "POST",
			contentType: multipart.contentType,
			headers: {
				...(await this.authHeaders()),
				"Content-Type": multipart.contentType,
			},
			body: multipart.body,
			throw: false,
		}, { path, fullPath, fileId: fileId ?? "[new]", bytes: data.byteLength }, this.writeTimeoutMs);
		if (response.status < 200 || response.status >= 300) {
			throw new Error(`Google Drive write failed for ${path}: HTTP ${response.status} ${readErrorBody(response.text)}`);
		}
		const id = readDriveFileId(response.json);
		this.fileIdByPath.set(fullPath, id || fileId || null);
	}

	async delete(path: string): Promise<void> {
		const fullPath = this.fullPath(path);
		const fileId = await this.findFileId(fullPath);
		if (!fileId) return;
		const response = await this.request("delete", {
			url: `${DRIVE_API_URL}/files/${encodeURIComponent(fileId)}`,
			method: "DELETE",
			headers: await this.authHeaders(),
			throw: false,
		}, { path, fullPath, fileId });
		if (response.status === 404) return;
		if (response.status < 200 || response.status >= 300) {
			throw new Error(`Google Drive delete failed for ${path}: HTTP ${response.status} ${readErrorBody(response.text)}`);
		}
		this.fileIdByPath.set(fullPath, null);
	}

	async exists(path: string): Promise<boolean> {
		return (await this.findFileId(this.fullPath(path))) !== null;
	}

	async ensureDir(_path: string): Promise<void> {
		// Google Drive appDataFolder is a flat app-owned space. Paths are mapped by appProperties.
	}

	private async findFileId(fullPath: string): Promise<string | null> {
		if (this.fileIdByPath.has(fullPath)) return this.fileIdByPath.get(fullPath) ?? null;
		const pathHash = await pathHashKey(fullPath);
		const query = `${PATH_HASH_PROPERTY_QUERY(pathHash)} and trashed=false`;
		const response = await this.request("metadata", {
			url: `${DRIVE_API_URL}/files?spaces=appDataFolder&pageSize=1&fields=files(id,name,size,modifiedTime,appProperties)&q=${encodeURIComponent(query)}`,
			method: "GET",
			headers: await this.authHeaders(),
			throw: false,
		}, { fullPath, pathHash });
		if (response.status === 404) {
			this.fileIdByPath.set(fullPath, null);
			return null;
		}
		if (response.status < 200 || response.status >= 300) {
			throw new Error(`Google Drive metadata failed for ${fullPath}: HTTP ${response.status} ${readErrorBody(response.text)}`);
		}
		const parsed = response.json as DriveFileListResponse;
		const id = parsed.files?.[0]?.id ?? null;
		this.fileIdByPath.set(fullPath, id);
		return id;
	}

	private async authHeaders(): Promise<Record<string, string>> {
		return { Authorization: `Bearer ${await this.getAccessToken()}` };
	}

	private async getAccessToken(): Promise<string> {
		const current = this.secrets.googleAccessToken?.trim();
		const expiresAt = this.secrets.googleAccessTokenExpiresAt ?? 0;
		if (current && expiresAt > Date.now() + 60_000) return current;

		const token = await refreshGoogleDriveAccessToken(
			this.secrets.googleClientId ?? "",
			this.secrets.googleRefreshToken ?? ""
		);
		this.secrets = {
			...this.secrets,
			googleAccessToken: token.accessToken,
			googleAccessTokenExpiresAt: token.expiresAt,
			googleRefreshToken: token.refreshToken ?? this.secrets.googleRefreshToken,
		};
		await this.saveSecrets?.({
			googleAccessToken: this.secrets.googleAccessToken,
			googleAccessTokenExpiresAt: this.secrets.googleAccessTokenExpiresAt,
			googleRefreshToken: this.secrets.googleRefreshToken,
		});
		return this.secrets.googleAccessToken ?? "";
	}

	private fullPath(path: string): string {
		return [this.remoteRoot, normalizeDrivePath(path)].filter(Boolean).join("/");
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
				`Google Drive ${label} timed out after ${Math.round(timeoutMs / 1000)}s`
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
		await this.logFn?.(`google-drive:${message}`, meta);
	}
}

function PATH_HASH_PROPERTY_QUERY(pathHash: string): string {
	return `appProperties has { key='${PATH_HASH_PROPERTY}' and value='${escapeDriveQuery(pathHash)}' }`;
}

function createMultipartBody(metadata: Record<string, unknown>, data: ArrayBuffer): MultipartBody {
	const boundary = `umos_sync_${Date.now()}_${Math.random().toString(36).slice(2)}`;
	const encoder = new TextEncoder();
	const cleanMetadata = removeUndefinedProperties(metadata);
	const prefix = encoder.encode(
		`--${boundary}\r\n`
		+ "Content-Type: application/json; charset=UTF-8\r\n\r\n"
		+ `${JSON.stringify(cleanMetadata)}\r\n`
		+ `--${boundary}\r\n`
		+ "Content-Type: application/octet-stream\r\n\r\n"
	);
	const suffix = encoder.encode(`\r\n--${boundary}--`);
	const body = new Uint8Array(prefix.byteLength + data.byteLength + suffix.byteLength);
	body.set(prefix, 0);
	body.set(new Uint8Array(data), prefix.byteLength);
	body.set(suffix, prefix.byteLength + data.byteLength);
	return {
		body: body.buffer,
		contentType: `multipart/related; boundary=${boundary}`,
	};
}

function removeUndefinedProperties(value: Record<string, unknown>): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [key, item] of Object.entries(value)) {
		if (item !== undefined) out[key] = item;
	}
	return out;
}

async function pathHashKey(path: string): Promise<string> {
	const bytes = new TextEncoder().encode(`umos-google-drive-path:${path}`);
	const hash = await crypto.subtle.digest("SHA-256", bytes);
	return hex(hash);
}

function hex(buffer: ArrayBuffer): string {
	return Array.from(new Uint8Array(buffer))
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

function buildDriveFileName(path: string, pathHash: string): string {
	const leaf = normalizeDrivePath(path).split("/").filter(Boolean).pop() || "object";
	const cleanLeaf = leaf.replace(/[\\/:*?"<>|#%{}~&]/g, "_").slice(0, 80) || "object";
	return `${pathHash.slice(0, 12)}-${cleanLeaf}`;
}

function readDriveFileId(raw: unknown): string {
	if (!raw || typeof raw !== "object") return "";
	const value = raw as Record<string, unknown>;
	return typeof value.id === "string" ? value.id : "";
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

function normalizeDrivePath(path: string): string {
	return normalizeVaultPath(path).replace(/^\/+|\/+$/g, "");
}

function escapeDriveQuery(value: string): string {
	return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function readErrorBody(text: string): string {
	const trimmed = text.trim();
	if (!trimmed) return "";
	return trimmed.length > 240 ? `${trimmed.slice(0, 240)}...` : trimmed;
}
