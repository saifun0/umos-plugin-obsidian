import { normalizePath } from "obsidian";

export const DEFAULT_SYNC_IGNORE_PATTERNS = [
	".git/**",
	".trash/**",
	".obsidian/workspace*.json",
	".obsidian/cache/**",
	".obsidian/plugins/umos-plugin/node_modules/**",
	".obsidian/plugins/umos-plugin/.git/**",
	".obsidian/plugins/umos-plugin/.temp/**",
	".obsidian/plugins/umos-plugin/sync-secrets.local.json",
	".obsidian/plugins/umos-plugin/sync-state.local.json",
	".obsidian/plugins/umos-plugin/sync-debug.local.log",
	"sync-secrets.local.json",
	"sync-state.local.json",
	"sync-debug.local.log",
	".umos-sync/tmp/**",
	".umos-sync/remote/**",
];

export class SyncIgnore {
	private regexes: RegExp[];

	constructor(patterns: string[]) {
		this.regexes = patterns
			.map((pattern) => pattern.trim())
			.filter(Boolean)
			.map((pattern) => globToRegex(normalizeVaultPath(pattern)));
	}

	ignores(path: string): boolean {
		const clean = normalizeVaultPath(path);
		return this.regexes.some((regex) => regex.test(clean));
	}
}

export function buildIgnorePatterns(custom: string, remoteRoot = ""): string[] {
	const patterns = [...DEFAULT_SYNC_IGNORE_PATTERNS];
	if (remoteRoot.trim()) {
		const root = normalizeVaultPath(remoteRoot).replace(/\/+$/, "");
		if (root.startsWith(".umos-sync")) patterns.push(`${root}/**`, root);
	}
	for (const line of custom.split(/\r?\n|,/)) {
		const clean = line.trim();
		if (clean && !clean.startsWith("#")) patterns.push(clean);
	}
	return patterns;
}

export function normalizeVaultPath(path: string): string {
	return normalizePath(path).replace(/^\/+/, "");
}

function globToRegex(pattern: string): RegExp {
	let out = "^";
	for (let i = 0; i < pattern.length; i++) {
		const char = pattern[i];
		const next = pattern[i + 1];
		if (char === "*" && next === "*") {
			out += ".*";
			i++;
			continue;
		}
		if (char === "*") {
			out += "[^/]*";
			continue;
		}
		if (char === "?") {
			out += "[^/]";
			continue;
		}
		out += escapeRegex(char);
	}
	out += "$";
	return new RegExp(out);
}

function escapeRegex(value: string): string {
	return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}
