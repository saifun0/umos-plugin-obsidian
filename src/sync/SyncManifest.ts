import type { SyncManifest, SyncRunSummary, SyncSecrets, SyncState } from "./types";

export function createEmptySummary(): SyncRunSummary {
	return {
		uploaded: 0,
		downloaded: 0,
		deletedLocal: 0,
		deletedRemote: 0,
		skipped: 0,
		conflicts: 0,
		errors: 0,
		bytesUploaded: 0,
		bytesDownloaded: 0,
	};
}

export function createEmptyManifest(vaultId: string, deviceId: string, encrypted: boolean): SyncManifest {
	return {
		version: 1,
		vaultId,
		deviceId,
		encrypted,
		updatedAt: Date.now(),
		entries: {},
		tombstones: {},
	};
}

export function createEmptyState(deviceId: string, vaultId: string): SyncState {
	return {
		version: 1,
		deviceId,
		vaultId,
		updatedAt: Date.now(),
		lastRemoteUpdatedAt: 0,
		entries: {},
		logs: [],
	};
}

export function createEmptySecrets(): SyncSecrets {
	return {
		version: 1,
		webdavUrl: "",
		webdavAuthType: "basic",
		webdavUsername: "",
		webdavPassword: "",
		webdavToken: "",
		encryptionPassphrase: "",
		dropboxAppKey: "",
		dropboxCodeVerifier: "",
		dropboxAccessToken: "",
		dropboxAccessTokenExpiresAt: 0,
		dropboxRefreshToken: "",
		dropboxAccountId: "",
		googleClientId: "",
		googleRedirectUri: "http://127.0.0.1:42813/oauth2callback",
		googleCodeVerifier: "",
		googleAccessToken: "",
		googleAccessTokenExpiresAt: 0,
		googleRefreshToken: "",
		onedriveClientId: "",
		onedriveRedirectUri: "http://localhost:42814/oauth2callback",
		onedriveCodeVerifier: "",
		onedriveAccessToken: "",
		onedriveAccessTokenExpiresAt: 0,
		onedriveRefreshToken: "",
		s3Endpoint: "",
		s3Region: "us-east-1",
		s3Bucket: "",
		s3AccessKeyId: "",
		s3SecretAccessKey: "",
		s3SessionToken: "",
	};
}

export function isSyncManifest(value: unknown): value is SyncManifest {
	if (!value || typeof value !== "object") return false;
	const candidate = value as Partial<SyncManifest>;
	return candidate.version === 1
		&& typeof candidate.vaultId === "string"
		&& typeof candidate.entries === "object"
		&& typeof candidate.tombstones === "object";
}
