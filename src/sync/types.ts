export type SyncProvider =
	| "webdav"
	| "yandex-webdav"
	| "dropbox"
	| "google-drive"
	| "onedrive"
	| "s3"
	| "local";

export type SyncMode = "pull" | "push" | "bidirectional";
export type SyncRunStatus = "idle" | "running" | "success" | "warning" | "failed" | "cancelled";
export type SyncActionType = "upload" | "download" | "delete-local" | "delete-remote" | "skip";
export type SyncAuthType = "basic" | "bearer" | "oauth";

export interface SyncProviderDefinition {
	id: SyncProvider;
	label: string;
	description: string;
	icon: string;
	implemented: boolean;
}

export interface LocalFileSnapshot {
	path: string;
	size: number;
	mtime: number;
	sha256: string;
}

export interface RemoteFileEntry {
	path: string;
	remotePath: string;
	size: number;
	mtime: number;
	sha256: string;
	updatedAt: number;
	deviceId: string;
	encrypted: boolean;
	crypto?: {
		algorithm: "AES-256-GCM/PBKDF2-SHA256";
		salt: string;
		iv: string;
	};
}

export interface RemoteTombstone {
	path: string;
	sha256?: string;
	deletedAt: number;
	deviceId: string;
}

export interface SyncManifest {
	version: 1;
	vaultId: string;
	encrypted: boolean;
	updatedAt: number;
	deviceId: string;
	entries: Record<string, RemoteFileEntry>;
	tombstones: Record<string, RemoteTombstone>;
}

export interface SyncStateEntry {
	path: string;
	size?: number;
	mtime?: number;
	sha256?: string;
	remoteUpdatedAt?: number;
	deleted?: boolean;
	updatedAt: number;
}

export interface SyncLogEntry {
	id: string;
	startedAt: number;
	finishedAt: number;
	mode: SyncMode;
	dryRun: boolean;
	status: SyncRunStatus;
	message: string;
	summary: SyncRunSummary;
}

export interface SyncState {
	version: 1;
	deviceId: string;
	vaultId: string;
	updatedAt: number;
	lastRemoteUpdatedAt: number;
	entries: Record<string, SyncStateEntry>;
	logs: SyncLogEntry[];
}

export interface SyncSecrets {
	version: 1;
	webdavUrl: string;
	webdavAuthType: SyncAuthType;
	webdavUsername: string;
	webdavPassword: string;
	webdavToken: string;
	encryptionPassphrase: string;
	dropboxAppKey?: string;
	dropboxCodeVerifier?: string;
	dropboxAccessToken?: string;
	dropboxAccessTokenExpiresAt?: number;
	dropboxRefreshToken?: string;
	dropboxAccountId?: string;
	googleClientId?: string;
	googleRedirectUri?: string;
	googleCodeVerifier?: string;
	googleAccessToken?: string;
	googleAccessTokenExpiresAt?: number;
	googleRefreshToken?: string;
	onedriveClientId?: string;
	onedriveRedirectUri?: string;
	onedriveCodeVerifier?: string;
	onedriveAccessToken?: string;
	onedriveAccessTokenExpiresAt?: number;
	onedriveRefreshToken?: string;
	s3Endpoint?: string;
	s3Region?: string;
	s3Bucket?: string;
	s3AccessKeyId?: string;
	s3SecretAccessKey?: string;
	s3SessionToken?: string;
}

export interface SyncAction {
	type: SyncActionType;
	path: string;
	reason: string;
	local?: LocalFileSnapshot;
	remote?: RemoteFileEntry;
	tombstone?: RemoteTombstone;
	conflict?: boolean;
}

export interface SyncPlan {
	mode: SyncMode;
	actions: SyncAction[];
	summary: SyncRunSummary;
}

export interface SyncRunSummary {
	uploaded: number;
	downloaded: number;
	deletedLocal: number;
	deletedRemote: number;
	skipped: number;
	conflicts: number;
	errors: number;
	bytesUploaded: number;
	bytesDownloaded: number;
}

export interface SyncRunResult {
	ok: boolean;
	status: SyncRunStatus;
	mode: SyncMode;
	dryRun: boolean;
	startedAt: number;
	finishedAt: number;
	message: string;
	plan: SyncPlan;
	errors: string[];
}

export interface SyncProgress {
	status: SyncRunStatus;
	phase: string;
	message: string;
	current: number;
	total: number;
	percent: number;
	path?: string;
	speed?: string;
	cancellable: boolean;
}

export interface SyncAdapter {
	readonly provider: SyncProvider;
	testConnection(): Promise<void>;
	read(path: string): Promise<ArrayBuffer | null>;
	write(path: string, data: ArrayBuffer): Promise<void>;
	delete(path: string): Promise<void>;
	exists(path: string): Promise<boolean>;
	ensureDir(path: string): Promise<void>;
}

export interface EncryptedPayload {
	version: 1;
	algorithm: "AES-256-GCM/PBKDF2-SHA256";
	salt: string;
	iv: string;
	data: string;
}

export interface SyncRunOptions {
	mode?: SyncMode;
	dryRun?: boolean;
	reason?: string;
	onProgress?: (progress: SyncProgress) => void;
}
