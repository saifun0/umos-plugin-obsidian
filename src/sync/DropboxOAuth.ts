import { requestUrl } from "obsidian";

const DROPBOX_AUTH_URL = "https://www.dropbox.com/oauth2/authorize";
const DROPBOX_TOKEN_URL = "https://api.dropboxapi.com/oauth2/token";
const DROPBOX_SCOPES = [
	"account_info.read",
	"files.metadata.read",
	"files.content.read",
	"files.content.write",
];

export interface DropboxAuthUrl {
	url: string;
	codeVerifier: string;
}

export interface DropboxTokenResult {
	accessToken: string;
	refreshToken?: string;
	expiresAt: number;
	accountId?: string;
}

export async function createDropboxAuthUrl(appKey: string): Promise<DropboxAuthUrl> {
	const cleanAppKey = appKey.trim();
	if (!cleanAppKey) throw new Error("Dropbox app key is required");
	const codeVerifier = createCodeVerifier();
	const codeChallenge = await createCodeChallenge(codeVerifier);
	const params = new URLSearchParams({
		client_id: cleanAppKey,
		response_type: "code",
		token_access_type: "offline",
		code_challenge: codeChallenge,
		code_challenge_method: "S256",
		scope: DROPBOX_SCOPES.join(" "),
	});
	return {
		url: `${DROPBOX_AUTH_URL}?${params.toString()}`,
		codeVerifier,
	};
}

export async function exchangeDropboxAuthCode(
	appKey: string,
	code: string,
	codeVerifier: string
): Promise<DropboxTokenResult> {
	const cleanAppKey = appKey.trim();
	const cleanCode = code.trim();
	const cleanVerifier = codeVerifier.trim();
	if (!cleanAppKey) throw new Error("Dropbox app key is required");
	if (!cleanCode) throw new Error("Dropbox authorization code is required");
	if (!cleanVerifier) throw new Error("Generate a Dropbox auth link before exchanging the code");

	const params = new URLSearchParams({
		grant_type: "authorization_code",
		code: cleanCode,
		client_id: cleanAppKey,
		code_verifier: cleanVerifier,
	});
	return parseTokenResponse(await requestDropboxToken(params));
}

export async function refreshDropboxAccessToken(appKey: string, refreshToken: string): Promise<DropboxTokenResult> {
	const cleanAppKey = appKey.trim();
	const cleanRefreshToken = refreshToken.trim();
	if (!cleanAppKey) throw new Error("Dropbox app key is required");
	if (!cleanRefreshToken) throw new Error("Dropbox refresh token is missing. Reconnect Dropbox in settings.");

	const params = new URLSearchParams({
		grant_type: "refresh_token",
		refresh_token: cleanRefreshToken,
		client_id: cleanAppKey,
	});
	return parseTokenResponse(await requestDropboxToken(params));
}

async function requestDropboxToken(params: URLSearchParams): Promise<unknown> {
	const response = await requestUrl({
		url: DROPBOX_TOKEN_URL,
		method: "POST",
		contentType: "application/x-www-form-urlencoded",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: params.toString(),
		throw: false,
	});
	if (response.status < 200 || response.status >= 300) {
		throw new Error(`Dropbox authorization failed: HTTP ${response.status} ${readErrorBody(response.text)}`);
	}
	return response.json;
}

function parseTokenResponse(raw: unknown): DropboxTokenResult {
	if (!raw || typeof raw !== "object") throw new Error("Dropbox returned an empty token response");
	const value = raw as Record<string, unknown>;
	const accessToken = typeof value.access_token === "string" ? value.access_token : "";
	if (!accessToken) throw new Error("Dropbox did not return an access token");
	const expiresIn = typeof value.expires_in === "number" ? value.expires_in : 14_400;
	return {
		accessToken,
		refreshToken: typeof value.refresh_token === "string" ? value.refresh_token : undefined,
		expiresAt: Date.now() + Math.max(60, expiresIn - 60) * 1000,
		accountId: typeof value.account_id === "string" ? value.account_id : undefined,
	};
}

async function createCodeChallenge(codeVerifier: string): Promise<string> {
	const bytes = new TextEncoder().encode(codeVerifier);
	const hash = await crypto.subtle.digest("SHA-256", bytes);
	return base64Url(hash);
}

function createCodeVerifier(): string {
	const bytes = new Uint8Array(48);
	crypto.getRandomValues(bytes);
	return base64Url(bytes.buffer);
}

function base64Url(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/g, "");
}

function readErrorBody(text: string): string {
	const trimmed = text.trim();
	if (!trimmed) return "";
	return trimmed.length > 240 ? `${trimmed.slice(0, 240)}...` : trimmed;
}
