import type { SyncProviderDefinition } from "./types";

export const SYNC_PROVIDER_DEFINITIONS: SyncProviderDefinition[] = [
	{
		id: "webdav",
		label: "WebDAV",
		description: "Generic WebDAV server, Nextcloud, Synology, InfiniCLOUD, and compatible services.",
		icon: "server",
		implemented: true,
	},
	{
		id: "yandex-webdav",
		label: "Yandex Disk",
		description: "Yandex Disk through its WebDAV endpoint.",
		icon: "hard-drive",
		implemented: true,
	},
	{
		id: "dropbox",
		label: "Dropbox",
		description: "OAuth app-folder adapter through the Dropbox API.",
		icon: "box",
		implemented: true,
	},
	{
		id: "google-drive",
		label: "Google Drive",
		description: "Drive API adapter using the hidden appDataFolder space.",
		icon: "triangle",
		implemented: true,
	},
	{
		id: "onedrive",
		label: "OneDrive",
		description: "Microsoft Graph adapter using the app folder.",
		icon: "cloud",
		implemented: true,
	},
	{
		id: "s3",
		label: "S3-compatible",
		description: "AWS S3, R2, B2, MinIO, and path-style compatible object storage.",
		icon: "database",
		implemented: true,
	},
	{
		id: "local",
		label: "Local folder",
		description: "Debug adapter that writes to a vault folder.",
		icon: "folder",
		implemented: true,
	},
];
