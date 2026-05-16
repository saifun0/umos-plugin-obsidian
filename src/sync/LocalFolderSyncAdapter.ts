import type { App } from "obsidian";
import type { SyncAdapter } from "./types";
import { normalizeVaultPath } from "./SyncIgnore";

export class LocalFolderSyncAdapter implements SyncAdapter {
	readonly provider = "local" as const;

	constructor(private app: App, private root: string) {}

	async testConnection(): Promise<void> {
		await this.ensureDir("");
	}

	async read(path: string): Promise<ArrayBuffer | null> {
		const full = this.fullPath(path);
		if (!await this.app.vault.adapter.exists(full)) return null;
		return this.app.vault.adapter.readBinary(full);
	}

	async write(path: string, data: ArrayBuffer): Promise<void> {
		await this.ensureDir(parentPath(path));
		await this.app.vault.adapter.writeBinary(this.fullPath(path), data);
	}

	async delete(path: string): Promise<void> {
		const full = this.fullPath(path);
		if (await this.app.vault.adapter.exists(full)) {
			await this.app.vault.adapter.remove(full);
		}
	}

	async exists(path: string): Promise<boolean> {
		return this.app.vault.adapter.exists(this.fullPath(path));
	}

	async ensureDir(path: string): Promise<void> {
		const clean = this.fullPath(path);
		const parts = clean.split("/").filter(Boolean);
		let current = "";
		for (const part of parts) {
			current = current ? `${current}/${part}` : part;
			if (!await this.app.vault.adapter.exists(current)) {
				await this.app.vault.createFolder(current);
			}
		}
	}

	private fullPath(path: string): string {
		return [normalizeVaultPath(this.root || ".umos-sync/remote"), normalizeVaultPath(path)]
			.filter(Boolean)
			.join("/");
	}
}

function parentPath(path: string): string {
	const clean = normalizeVaultPath(path);
	const index = clean.lastIndexOf("/");
	return index <= 0 ? "" : clean.slice(0, index);
}

