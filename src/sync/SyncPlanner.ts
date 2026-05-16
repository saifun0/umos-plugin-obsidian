import { createEmptySummary } from "./SyncManifest";
import type {
	LocalFileSnapshot,
	RemoteFileEntry,
	RemoteTombstone,
	SyncAction,
	SyncMode,
	SyncPlan,
	SyncState,
} from "./types";

export function planSync(
	mode: SyncMode,
	localFiles: LocalFileSnapshot[],
	remoteEntries: Record<string, RemoteFileEntry>,
	tombstones: Record<string, RemoteTombstone>,
	state: SyncState
): SyncPlan {
	const actions: SyncAction[] = [];
	const summary = createEmptySummary();
	const localMap = new Map(localFiles.map((file) => [file.path, file]));
	const allPaths = new Set<string>([
		...localMap.keys(),
		...Object.keys(remoteEntries),
		...Object.keys(tombstones),
		...Object.keys(state.entries),
	]);

	for (const path of Array.from(allPaths).sort((a, b) => a.localeCompare(b))) {
		const local = localMap.get(path);
		const remote = remoteEntries[path];
		const tombstone = tombstones[path];
		const previous = state.entries[path];

		if (mode === "push") {
			if (local) {
				if (remote && remote.sha256 === local.sha256) continue;
				pushAction(actions, "upload", path, "Local source of truth", local, remote);
			} else if (remote) {
				pushAction(actions, "delete-remote", path, "Deleted locally in push mode", undefined, remote);
			}
			continue;
		}

		if (mode === "pull") {
			if (remote) {
				if (local && local.sha256 === remote.sha256) continue;
				pushAction(actions, "download", path, "Remote source of truth", local, remote);
			} else if (local && tombstone) {
				pushAction(actions, "delete-local", path, "Remote tombstone", local, undefined, tombstone);
			} else if (local && previous) {
				pushAction(actions, "delete-local", path, "Missing remotely in pull mode", local);
			}
			continue;
		}

		if (remote && tombstone && tombstone.deletedAt > remote.updatedAt) {
			if (local && isTombstoneNewerThanLocal(tombstone, local, previous)) {
				pushAction(actions, "delete-local", path, "Remote delete is newer", local, remote, tombstone);
			}
			continue;
		}

		if (local && remote) {
			const localChanged = previous?.sha256 !== local.sha256;
			const remoteChanged = previous?.sha256 !== remote.sha256;
			if (!localChanged && !remoteChanged) continue;
			if (local.sha256 === remote.sha256) continue;

			if (localChanged && remoteChanged) {
				const uploadWins = local.mtime >= remote.mtime;
				pushAction(
					actions,
					uploadWins ? "upload" : "download",
					path,
					uploadWins ? "Conflict: local is newer" : "Conflict: remote is newer",
					local,
					remote,
					undefined,
					true
				);
			} else if (localChanged) {
				pushAction(actions, "upload", path, "Changed locally", local, remote);
			} else if (remoteChanged) {
				pushAction(actions, "download", path, "Changed remotely", local, remote);
			}
			continue;
		}

		if (local && !remote) {
			if (tombstone && tombstone.deletedAt > (previous?.updatedAt ?? 0) && !isLocalChanged(local, previous)) {
				pushAction(actions, "delete-local", path, "Remote tombstone", local, undefined, tombstone);
			} else {
				pushAction(actions, "upload", path, previous ? "Re-created locally" : "New local file", local);
			}
			continue;
		}

		if (!local && remote) {
			if (previous && previous.sha256 === remote.sha256) {
				pushAction(actions, "delete-remote", path, "Deleted locally", undefined, remote);
			} else {
				pushAction(actions, "download", path, previous ? "Re-created remotely" : "New remote file", undefined, remote);
			}
		}
	}

	for (const action of actions) {
		if (action.conflict) summary.conflicts++;
		switch (action.type) {
			case "upload":
				summary.uploaded++;
				summary.bytesUploaded += action.local?.size ?? 0;
				break;
			case "download":
				summary.downloaded++;
				summary.bytesDownloaded += action.remote?.size ?? 0;
				break;
			case "delete-local":
				summary.deletedLocal++;
				break;
			case "delete-remote":
				summary.deletedRemote++;
				break;
			case "skip":
				summary.skipped++;
				break;
		}
	}

	return { mode, actions, summary };
}

function pushAction(
	actions: SyncAction[],
	type: SyncAction["type"],
	path: string,
	reason: string,
	local?: LocalFileSnapshot,
	remote?: RemoteFileEntry,
	tombstone?: RemoteTombstone,
	conflict = false
): void {
	actions.push({ type, path, reason, local, remote, tombstone, conflict });
}

function isLocalChanged(local: LocalFileSnapshot, previous: SyncState["entries"][string] | undefined): boolean {
	return previous?.sha256 !== local.sha256;
}

function isTombstoneNewerThanLocal(
	tombstone: RemoteTombstone,
	local: LocalFileSnapshot,
	previous: SyncState["entries"][string] | undefined
): boolean {
	if (isLocalChanged(local, previous)) return tombstone.deletedAt >= local.mtime;
	return tombstone.deletedAt > (previous?.updatedAt ?? 0);
}
