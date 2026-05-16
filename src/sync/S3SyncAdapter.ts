import { requestUrl } from "obsidian";
import { normalizeVaultPath } from "./SyncIgnore";
import type { SyncAdapter, SyncSecrets } from "./types";

interface S3AdapterOptions {
	remoteRoot: string;
	secrets: SyncSecrets;
	log?: (message: string, meta?: Record<string, unknown>) => void | Promise<void>;
}

interface SignedRequest {
	url: string;
	headers: Record<string, string>;
}

const EMPTY_BODY_HASH = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

export class S3SyncAdapter implements SyncAdapter {
	readonly provider = "s3" as const;
	private remoteRoot: string;
	private endpoint: string;
	private bucket: string;
	private region: string;
	private accessKeyId: string;
	private secretAccessKey: string;
	private sessionToken: string;
	private logFn?: S3AdapterOptions["log"];
	private requestTimeoutMs = 90_000;
	private writeTimeoutMs = 180_000;

	constructor(options: S3AdapterOptions) {
		this.remoteRoot = normalizeS3Key(options.remoteRoot || "umOS Sync");
		this.endpoint = normalizeEndpoint(options.secrets.s3Endpoint ?? "");
		this.bucket = (options.secrets.s3Bucket ?? "").trim();
		this.region = (options.secrets.s3Region ?? "us-east-1").trim() || "us-east-1";
		this.accessKeyId = (options.secrets.s3AccessKeyId ?? "").trim();
		this.secretAccessKey = options.secrets.s3SecretAccessKey ?? "";
		this.sessionToken = options.secrets.s3SessionToken ?? "";
		this.logFn = options.log;
	}

	async testConnection(): Promise<void> {
		this.assertConfigured();
		const response = await this.s3Request("list", "GET", "", undefined, {
			"list-type": "2",
			"max-keys": "1",
			prefix: this.remoteRoot ? `${this.remoteRoot}/` : "",
		});
		if (response.status < 200 || response.status >= 300) {
			throw new Error(`S3 connection failed: HTTP ${response.status} ${readErrorBody(response.text)}`);
		}
	}

	async read(path: string): Promise<ArrayBuffer | null> {
		const key = this.fullKey(path);
		const response = await this.s3Request("read", "GET", key);
		if ([403, 404].includes(response.status)) return null;
		if (response.status < 200 || response.status >= 300) {
			throw new Error(`S3 read failed for ${path}: HTTP ${response.status} ${readErrorBody(response.text)}`);
		}
		return response.arrayBuffer;
	}

	async write(path: string, data: ArrayBuffer): Promise<void> {
		const key = this.fullKey(path);
		const response = await this.s3Request("write", "PUT", key, data, undefined, this.writeTimeoutMs);
		if (response.status < 200 || response.status >= 300) {
			throw new Error(`S3 write failed for ${path}: HTTP ${response.status} ${readErrorBody(response.text)}`);
		}
	}

	async delete(path: string): Promise<void> {
		const key = this.fullKey(path);
		const response = await this.s3Request("delete", "DELETE", key);
		if ([403, 404].includes(response.status)) return;
		if (response.status < 200 || response.status >= 300) {
			throw new Error(`S3 delete failed for ${path}: HTTP ${response.status} ${readErrorBody(response.text)}`);
		}
	}

	async exists(path: string): Promise<boolean> {
		const key = this.fullKey(path);
		const response = await this.s3Request("exists", "HEAD", key);
		if ([403, 404].includes(response.status)) return false;
		if (response.status >= 200 && response.status < 300) return true;
		throw new Error(`S3 stat failed for ${path}: HTTP ${response.status} ${readErrorBody(response.text)}`);
	}

	async ensureDir(_path: string): Promise<void> {
		// Object stores do not need explicit directories.
	}

	private async s3Request(
		label: string,
		method: string,
		key: string,
		body?: ArrayBuffer,
		query?: Record<string, string>,
		timeoutMs = this.requestTimeoutMs
	) {
		this.assertConfigured();
		const payload = body ?? new ArrayBuffer(0);
		const signed = await this.signRequest(method, key, payload, query);
		const started = Date.now();
		await this.log(`${label}:start`, { key, method, bytes: body?.byteLength, query });
		try {
			const response = await withTimeout(
				requestUrl({
					url: signed.url,
					method,
					headers: signed.headers,
					contentType: body ? "application/octet-stream" : undefined,
					body,
					throw: false,
				}),
				timeoutMs,
				`S3 ${label} timed out after ${Math.round(timeoutMs / 1000)}s`
			);
			await this.log(`${label}:done`, {
				key,
				method,
				status: response.status,
				durationMs: Date.now() - started,
				errorBody: response.status >= 300 ? readErrorBody(response.text) : undefined,
			});
			return response;
		} catch (error) {
			await this.log(`${label}:error`, {
				key,
				method,
				durationMs: Date.now() - started,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	private async signRequest(method: string, key: string, body: ArrayBuffer, query?: Record<string, string>): Promise<SignedRequest> {
		const endpoint = new URL(this.endpoint);
		const host = endpoint.host;
		const amzDate = toAmzDate(new Date());
		const dateStamp = amzDate.slice(0, 8);
		const payloadHash = body.byteLength ? await sha256Hex(body) : EMPTY_BODY_HASH;
		const canonicalUri = `/${encodeS3Segment(this.bucket)}${key ? `/${encodeS3Key(key)}` : ""}`;
		const canonicalQuery = canonicalQueryString(query);
		const headers: Record<string, string> = {
			host,
			"x-amz-content-sha256": payloadHash,
			"x-amz-date": amzDate,
		};
		if (body.byteLength) headers["content-type"] = "application/octet-stream";
		if (this.sessionToken.trim()) headers["x-amz-security-token"] = this.sessionToken.trim();

		const signedHeaderNames = Object.keys(headers).sort();
		const canonicalHeaders = signedHeaderNames.map((name) => `${name}:${headers[name].trim()}\n`).join("");
		const signedHeaders = signedHeaderNames.join(";");
		const canonicalRequest = [
			method,
			canonicalUri,
			canonicalQuery,
			canonicalHeaders,
			signedHeaders,
			payloadHash,
		].join("\n");
		const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;
		const stringToSign = [
			"AWS4-HMAC-SHA256",
			amzDate,
			credentialScope,
			await sha256TextHex(canonicalRequest),
		].join("\n");
		const signingKey = await deriveSigningKey(this.secretAccessKey, dateStamp, this.region);
		const signature = await hmacHex(signingKey, stringToSign);
		const url = `${this.endpoint}${canonicalUri}${canonicalQuery ? `?${canonicalQuery}` : ""}`;
		return {
			url,
			headers: {
				...headers,
				Authorization: `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
			},
		};
	}

	private fullKey(path: string): string {
		return [this.remoteRoot, normalizeS3Key(path)].filter(Boolean).join("/");
	}

	private assertConfigured(): void {
		if (!this.endpoint) throw new Error("S3 endpoint is required");
		if (!this.bucket) throw new Error("S3 bucket is required");
		if (!this.region) throw new Error("S3 region is required");
		if (!this.accessKeyId) throw new Error("S3 access key ID is required");
		if (!this.secretAccessKey) throw new Error("S3 secret access key is required");
	}

	private async log(message: string, meta?: Record<string, unknown>): Promise<void> {
		await this.logFn?.(`s3:${message}`, meta);
	}
}

function normalizeEndpoint(value: string): string {
	return value.trim().replace(/\/+$/, "");
}

function normalizeS3Key(path: string): string {
	return normalizeVaultPath(path).replace(/^\/+|\/+$/g, "");
}

function encodeS3Key(key: string): string {
	return normalizeS3Key(key).split("/").filter(Boolean).map(encodeS3Segment).join("/");
}

function encodeS3Segment(value: string): string {
	return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function canonicalQueryString(query?: Record<string, string>): string {
	if (!query) return "";
	return Object.entries(query)
		.filter(([, value]) => value !== undefined)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([key, value]) => `${encodeS3Segment(key)}=${encodeS3Segment(value)}`)
		.join("&");
}

function toAmzDate(date: Date): string {
	return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

async function deriveSigningKey(secret: string, dateStamp: string, region: string): Promise<ArrayBuffer> {
	const kDate = await hmacBytes(stringToBytes(`AWS4${secret}`), dateStamp);
	const kRegion = await hmacBytes(kDate, region);
	const kService = await hmacBytes(kRegion, "s3");
	return hmacBytes(kService, "aws4_request");
}

async function hmacBytes(keyBytes: ArrayBuffer, message: string): Promise<ArrayBuffer> {
	const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
	return crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
}

async function hmacHex(keyBytes: ArrayBuffer, message: string): Promise<string> {
	return hex(await hmacBytes(keyBytes, message));
}

async function sha256TextHex(value: string): Promise<string> {
	return sha256Hex(new TextEncoder().encode(value).buffer);
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
	return hex(await crypto.subtle.digest("SHA-256", buffer));
}

function stringToBytes(value: string): ArrayBuffer {
	return new TextEncoder().encode(value).buffer;
}

function hex(buffer: ArrayBuffer): string {
	return Array.from(new Uint8Array(buffer))
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
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

function readErrorBody(text: string): string {
	const trimmed = text.trim();
	if (!trimmed) return "";
	return trimmed.length > 240 ? `${trimmed.slice(0, 240)}...` : trimmed;
}
