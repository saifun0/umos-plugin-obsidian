import { requestUrl } from "obsidian";

export const DEFAULT_GOOGLE_REDIRECT_URI = "http://127.0.0.1:42813/oauth2callback";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_SCOPES = [
	"https://www.googleapis.com/auth/drive.appdata",
];

export interface GoogleAuthUrl {
	url: string;
	codeVerifier: string;
	redirectUri: string;
}

export interface GoogleTokenResult {
	accessToken: string;
	refreshToken?: string;
	expiresAt: number;
}

export async function createGoogleDriveAuthUrl(clientId: string, redirectUri: string): Promise<GoogleAuthUrl> {
	const cleanClientId = clientId.trim();
	const cleanRedirectUri = normalizeRedirectUri(redirectUri);
	if (!cleanClientId) throw new Error("Google OAuth client ID is required");
	const codeVerifier = createCodeVerifier();
	const codeChallenge = await createCodeChallenge(codeVerifier);
	const params = new URLSearchParams({
		client_id: cleanClientId,
		redirect_uri: cleanRedirectUri,
		response_type: "code",
		scope: GOOGLE_SCOPES.join(" "),
		access_type: "offline",
		prompt: "consent",
		include_granted_scopes: "true",
		code_challenge: codeChallenge,
		code_challenge_method: "S256",
	});
	return {
		url: `${GOOGLE_AUTH_URL}?${params.toString()}`,
		codeVerifier,
		redirectUri: cleanRedirectUri,
	};
}

export async function exchangeGoogleDriveAuthCode(
	clientId: string,
	codeOrRedirectUrl: string,
	redirectUri: string,
	codeVerifier: string
): Promise<GoogleTokenResult> {
	const cleanClientId = clientId.trim();
	const cleanCode = extractGoogleAuthCode(codeOrRedirectUrl);
	const cleanRedirectUri = normalizeRedirectUri(redirectUri);
	const cleanVerifier = codeVerifier.trim();
	if (!cleanClientId) throw new Error("Google OAuth client ID is required");
	if (!cleanCode) throw new Error("Google authorization code is required");
	if (!cleanVerifier) throw new Error("Generate a Google auth link before exchanging the code");

	const params = new URLSearchParams({
		grant_type: "authorization_code",
		code: cleanCode,
		client_id: cleanClientId,
		redirect_uri: cleanRedirectUri,
		code_verifier: cleanVerifier,
	});
	return parseTokenResponse(await requestGoogleToken(params));
}

export async function refreshGoogleDriveAccessToken(clientId: string, refreshToken: string): Promise<GoogleTokenResult> {
	const cleanClientId = clientId.trim();
	const cleanRefreshToken = refreshToken.trim();
	if (!cleanClientId) throw new Error("Google OAuth client ID is required");
	if (!cleanRefreshToken) throw new Error("Google Drive refresh token is missing. Reconnect Google Drive in settings.");

	const params = new URLSearchParams({
		grant_type: "refresh_token",
		refresh_token: cleanRefreshToken,
		client_id: cleanClientId,
	});
	return parseTokenResponse(await requestGoogleToken(params));
}

export function extractGoogleAuthCode(value: string): string {
	const clean = value.trim();
	if (!clean) return "";
	try {
		const url = new URL(clean);
		return url.searchParams.get("code") ?? "";
	} catch {
		const queryStart = clean.indexOf("?");
		if (queryStart >= 0) {
			const params = new URLSearchParams(clean.slice(queryStart + 1));
			return params.get("code") ?? "";
		}
		const hashStart = clean.indexOf("#");
		if (hashStart >= 0) {
			const params = new URLSearchParams(clean.slice(hashStart + 1));
			return params.get("code") ?? "";
		}
		return clean;
	}
}

function normalizeRedirectUri(value: string): string {
	return value.trim() || DEFAULT_GOOGLE_REDIRECT_URI;
}

async function requestGoogleToken(params: URLSearchParams): Promise<unknown> {
	const response = await requestUrl({
		url: GOOGLE_TOKEN_URL,
		method: "POST",
		contentType: "application/x-www-form-urlencoded",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: params.toString(),
		throw: false,
	});
	if (response.status < 200 || response.status >= 300) {
		throw new Error(`Google authorization failed: HTTP ${response.status} ${readErrorBody(response.text)}`);
	}
	return response.json;
}

function parseTokenResponse(raw: unknown): GoogleTokenResult {
	if (!raw || typeof raw !== "object") throw new Error("Google returned an empty token response");
	const value = raw as Record<string, unknown>;
	const accessToken = typeof value.access_token === "string" ? value.access_token : "";
	if (!accessToken) throw new Error("Google did not return an access token");
	const expiresIn = typeof value.expires_in === "number" ? value.expires_in : 3600;
	return {
		accessToken,
		refreshToken: typeof value.refresh_token === "string" ? value.refresh_token : undefined,
		expiresAt: Date.now() + Math.max(60, expiresIn - 60) * 1000,
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
