import { Modal, Notice, normalizePath } from "obsidian";
import { DEFAULT_SETTINGS, UmOSData } from "./Settings";
import type { SettingsContext } from "./helpers";

type DiffKind = "changed" | "missing-in-sync" | "missing-in-data";

interface JsonDiffItem {
	path: string;
	kind: DiffKind;
	dataValue: string;
	syncValue: string;
}

interface SyncSnapshot {
	path: string;
	text: string;
	exists: boolean;
}

export class DataJsonModal extends Modal {
	private editorEl: HTMLTextAreaElement | null = null;
	private overviewEl: HTMLElement | null = null;
	private diffEl: HTMLElement | null = null;
	private statusEl: HTMLElement | null = null;
	private syncSnapshot: SyncSnapshot | null = null;

	constructor(private ctx: SettingsContext) {
		super(ctx.app);
	}

	onOpen(): void {
		this.modalEl.addClass("umos-data-json-modal");
		this.renderShell();
		void this.reload();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private renderShell(): void {
		const { contentEl } = this;
		contentEl.empty();

		const header = contentEl.createDiv({ cls: "umos-data-json-header" });
		const titleWrap = header.createDiv({ cls: "umos-data-json-title-wrap" });
		titleWrap.createEl("h2", { text: "data.json Editor", cls: "umos-data-json-title" });
		titleWrap.createDiv({
			cls: "umos-data-json-subtitle",
			text: "View, edit, validate, and compare plugin data with the sync JSON file.",
		});

		const actions = header.createDiv({ cls: "umos-data-json-actions" });
		this.createButton(actions, "Reload", () => this.reload());
		this.createButton(actions, "Validate", () => this.validateEditor());
		this.createButton(actions, "Format", () => this.formatEditor());
		this.createButton(actions, "Compare", () => this.compareWithSync());
		this.createButton(actions, "Save data.json", () => this.saveLocal(), true);

		const grid = contentEl.createDiv({ cls: "umos-data-json-grid" });
		const editorPanel = grid.createDiv({ cls: "umos-data-json-editor-panel" });
		const editorHead = editorPanel.createDiv({ cls: "umos-data-json-panel-head" });
		editorHead.createSpan({ cls: "umos-data-json-panel-title", text: "Local data.json" });
		this.statusEl = editorHead.createSpan({ cls: "umos-data-json-status", text: "Loading..." });

		this.editorEl = editorPanel.createEl("textarea", {
			cls: "umos-data-json-editor",
			attr: {
				spellcheck: "false",
				"aria-label": "data.json editor",
			},
		}) as HTMLTextAreaElement;
		this.editorEl.addEventListener("input", () => this.renderOverview());

		const sidePanel = grid.createDiv({ cls: "umos-data-json-side-panel" });
		this.overviewEl = sidePanel.createDiv({ cls: "umos-data-json-overview" });

		const syncActions = sidePanel.createDiv({ cls: "umos-data-json-sync-actions" });
		this.createButton(syncActions, "Load sync into editor", () => this.loadSyncIntoEditor());
		this.createButton(syncActions, "Write editor to sync", () => this.writeEditorToSync());

		this.diffEl = sidePanel.createDiv({ cls: "umos-data-json-diff" });
	}

	private async reload(): Promise<void> {
		this.setStatus("Loading...");
		try {
			const loaded = await this.ctx.plugin.loadData() as unknown;
			const data = loaded ?? this.ctx.plugin.data_store ?? {};
			this.setEditorValue(this.stringifyJson(data));
			this.syncSnapshot = await this.readSyncSnapshot();
			this.renderOverview();
			this.renderDiff();
			this.setStatus("Loaded");
		} catch (error) {
			this.setStatus(`Load failed: ${this.getErrorMessage(error)}`, true);
		}
	}

	private validateEditor(): void {
		try {
			const parsed = this.parseEditor();
			this.setStatus(`Valid JSON · ${this.describeTopLevel(parsed)}`);
			this.renderOverview(parsed);
		} catch (error) {
			this.setStatus(`Invalid JSON: ${this.getErrorMessage(error)}`, true);
		}
	}

	private formatEditor(): void {
		try {
			this.setEditorValue(this.stringifyJson(this.parseEditor()));
			this.setStatus("Formatted");
			this.renderOverview();
			this.renderDiff();
		} catch (error) {
			this.setStatus(`Cannot format: ${this.getErrorMessage(error)}`, true);
		}
	}

	private compareWithSync(): void {
		this.renderDiff();
	}

	private async saveLocal(): Promise<void> {
		try {
			const parsed = this.parseEditor();
			await this.ctx.plugin.saveData(parsed);
			const applied = this.applyRuntimeData(parsed);
			this.setEditorValue(this.stringifyJson(parsed));
			this.renderOverview(parsed);
			this.renderDiff();
			this.setStatus(applied ? "Saved and applied to runtime" : "Saved. Reload plugin to apply malformed/partial data.");
			new Notice("data.json saved");
		} catch (error) {
			this.setStatus(`Save failed: ${this.getErrorMessage(error)}`, true);
			new Notice(`data.json save failed: ${this.getErrorMessage(error)}`);
		}
	}

	private async loadSyncIntoEditor(): Promise<void> {
		try {
			this.syncSnapshot = await this.readSyncSnapshot();
			if (!this.syncSnapshot?.exists) {
				this.setStatus(`Sync file not found: ${this.syncSnapshot?.path ?? this.getPreferredSyncPath()}`, true);
				return;
			}
			this.setEditorValue(this.stringifyJson(JSON.parse(this.syncSnapshot.text) as unknown));
			this.renderOverview();
			this.renderDiff();
			this.setStatus(`Loaded sync file: ${this.syncSnapshot.path}`);
		} catch (error) {
			this.setStatus(`Could not load sync: ${this.getErrorMessage(error)}`, true);
		}
	}

	private async writeEditorToSync(): Promise<void> {
		try {
			const parsed = this.parseEditor();
			const path = this.getWritableSyncPath();
			await this.ensureVaultFolder(path);
			const text = this.stringifyJson(parsed);
			await this.ctx.app.vault.adapter.write(path, text);
			this.syncSnapshot = { path, text, exists: true };
			this.renderOverview(parsed);
			this.renderDiff();
			this.setStatus(`Wrote sync file: ${path}`);
			new Notice(`Sync JSON written: ${path}`);
		} catch (error) {
			this.setStatus(`Sync write failed: ${this.getErrorMessage(error)}`, true);
			new Notice(`Sync write failed: ${this.getErrorMessage(error)}`);
		}
	}

	private renderOverview(parsedArg?: unknown): void {
		if (!this.overviewEl) return;
		this.overviewEl.empty();

		let parsed = parsedArg;
		let valid = true;
		try {
			if (parsed === undefined) parsed = this.parseEditor();
		} catch (error) {
			valid = false;
			this.renderOverviewRow("Local JSON", `Invalid: ${this.getErrorMessage(error)}`);
		}

		if (valid) {
			this.renderOverviewRow("Local JSON", this.describeTopLevel(parsed));
			this.renderOverviewRow("Local size", `${this.getEditorText().length.toLocaleString()} chars`);
			if (isRecord(parsed) && typeof parsed.syncedAt === "number") {
				this.renderOverviewRow("Local syncedAt", new Date(parsed.syncedAt).toLocaleString());
			}
		}

		const syncPath = this.syncSnapshot?.path ?? this.getPreferredSyncPath();
		this.renderOverviewRow("Sync path", syncPath);
		this.renderOverviewRow("Sync file", this.syncSnapshot?.exists ? "Found" : "Not found");
		if (this.syncSnapshot?.exists) {
			this.renderOverviewRow("Sync size", `${this.syncSnapshot.text.length.toLocaleString()} chars`);
		}
	}

	private renderOverviewRow(label: string, value: string): void {
		if (!this.overviewEl) return;
		const row = this.overviewEl.createDiv({ cls: "umos-data-json-overview-row" });
		row.createSpan({ cls: "umos-data-json-overview-label", text: label });
		row.createSpan({ cls: "umos-data-json-overview-value", text: value });
	}

	private renderDiff(): void {
		if (!this.diffEl) return;
		this.diffEl.empty();

		const head = this.diffEl.createDiv({ cls: "umos-data-json-diff-head" });
		head.createSpan({ cls: "umos-data-json-panel-title", text: "Diff with sync" });

		if (!this.syncSnapshot?.exists) {
			this.diffEl.createDiv({
				cls: "umos-data-json-empty",
				text: `No sync file found at ${this.syncSnapshot?.path ?? this.getPreferredSyncPath()}.`,
			});
			return;
		}

		let localJson: unknown;
		let syncJson: unknown;
		try {
			localJson = this.parseEditor();
		} catch (error) {
			this.diffEl.createDiv({ cls: "umos-data-json-error", text: `Local JSON is invalid: ${this.getErrorMessage(error)}` });
			return;
		}
		try {
			syncJson = JSON.parse(this.syncSnapshot.text) as unknown;
		} catch (error) {
			this.diffEl.createDiv({ cls: "umos-data-json-error", text: `Sync JSON is invalid: ${this.getErrorMessage(error)}` });
			return;
		}

		const diffs = diffJson(localJson, syncJson);
		const summary = head.createSpan({ cls: "umos-data-json-diff-count", text: `${diffs.length} differences` });
		if (diffs.length === 0) {
			summary.setText("No differences");
			this.diffEl.createDiv({ cls: "umos-data-json-empty", text: "data.json and sync JSON are equal." });
			return;
		}

		const list = this.diffEl.createDiv({ cls: "umos-data-json-diff-list" });
		for (const diff of diffs.slice(0, 200)) {
			const item = list.createDiv({ cls: `umos-data-json-diff-item is-${diff.kind}` });
			item.createDiv({ cls: "umos-data-json-diff-path", text: diff.path });
			item.createDiv({ cls: "umos-data-json-diff-kind", text: this.getDiffKindLabel(diff.kind) });
			const values = item.createDiv({ cls: "umos-data-json-diff-values" });
			values.createDiv({ cls: "umos-data-json-diff-value", text: `data: ${diff.dataValue}` });
			values.createDiv({ cls: "umos-data-json-diff-value", text: `sync: ${diff.syncValue}` });
		}

		if (diffs.length > 200) {
			this.diffEl.createDiv({
				cls: "umos-data-json-empty",
				text: `Showing first 200 of ${diffs.length} differences.`,
			});
		}
	}

	private async readSyncSnapshot(): Promise<SyncSnapshot> {
		const path = await this.resolveSyncPath();
		const exists = await this.ctx.app.vault.adapter.exists(path);
		if (!exists) return { path, text: "", exists: false };
		const text = await this.ctx.app.vault.adapter.read(path);
		return { path, text, exists: true };
	}

	private async resolveSyncPath(): Promise<string> {
		const candidates = this.getSyncPathCandidates();
		for (const candidate of candidates) {
			if (await this.ctx.app.vault.adapter.exists(candidate)) return candidate;
		}
		return candidates[0] ?? "syns.json";
	}

	private getSyncPathCandidates(): string[] {
		const pluginRoot = this.getPluginRootPath();
		const candidates = [
			this.ctx.settings.syncDataPath,
			pluginRoot ? `${pluginRoot}/syns.json` : "",
			"syns.json",
			pluginRoot ? `${pluginRoot}/sync.json` : "",
			"sync.json",
			"umOS/sync.json",
		]
			.map((path) => path.trim())
			.filter((path) => path.length > 0)
			.map((path) => normalizePath(path));

		return Array.from(new Set(candidates));
	}

	private getPreferredSyncPath(): string {
		const path = this.ctx.settings.syncDataPath?.trim();
		return normalizePath(path || this.getDefaultSyncPath());
	}

	private getDefaultSyncPath(): string {
		const pluginRoot = this.getPluginRootPath();
		return pluginRoot ? `${pluginRoot}/syns.json` : "syns.json";
	}

	private getPluginRootPath(): string {
		const dir = this.ctx.plugin.manifest.dir?.trim();
		return dir ? normalizePath(dir) : "";
	}

	private getWritableSyncPath(): string {
		return this.syncSnapshot?.path ?? this.getPreferredSyncPath();
	}

	private async ensureVaultFolder(filePath: string): Promise<void> {
		const normalized = normalizePath(filePath);
		const slashIndex = normalized.lastIndexOf("/");
		if (slashIndex === -1) return;

		const folderPath = normalized.slice(0, slashIndex);
		const parts = folderPath.split("/").filter(Boolean);
		let current = "";
		for (const part of parts) {
			current = current ? `${current}/${part}` : part;
			if (!(await this.ctx.app.vault.adapter.exists(current))) {
				await this.ctx.app.vault.adapter.mkdir(current);
			}
		}
	}

	private applyRuntimeData(parsed: unknown): boolean {
		if (!isUmOSDataLike(parsed)) return false;

		const settings = { ...DEFAULT_SETTINGS, ...parsed.settings };
		this.ctx.plugin.settings = settings;
		this.ctx.plugin.data_store = {
			...(parsed as UmOSData),
			settings,
		};
		this.ctx.plugin.eventBus.emit("settings:changed");
		this.ctx.display();
		return true;
	}

	private parseEditor(): unknown {
		return JSON.parse(this.getEditorText()) as unknown;
	}

	private setEditorValue(value: string): void {
		if (this.editorEl) this.editorEl.value = value;
	}

	private getEditorText(): string {
		return this.editorEl?.value ?? "";
	}

	private stringifyJson(value: unknown): string {
		return JSON.stringify(value, null, 2);
	}

	private describeTopLevel(value: unknown): string {
		if (Array.isArray(value)) return `Array · ${value.length} items`;
		if (!isRecord(value)) return `${typeof value}`;
		const keys = Object.keys(value);
		return `Object · ${keys.length} top-level keys`;
	}

	private createButton(parent: HTMLElement, label: string, onClick: () => void | Promise<void>, cta = false): HTMLButtonElement {
		const button = parent.createEl("button", {
			text: label,
			cls: cta ? "mod-cta umos-data-json-btn" : "umos-data-json-btn",
			attr: { type: "button" },
		});
		button.addEventListener("click", () => void onClick());
		return button;
	}

	private setStatus(text: string, isError = false): void {
		if (!this.statusEl) return;
		this.statusEl.setText(text);
		this.statusEl.toggleClass("is-error", isError);
	}

	private getDiffKindLabel(kind: DiffKind): string {
		if (kind === "missing-in-sync") return "Only in data.json";
		if (kind === "missing-in-data") return "Only in sync";
		return "Changed";
	}

	private getErrorMessage(error: unknown): string {
		return error instanceof Error ? error.message : String(error);
	}
}

function diffJson(dataValue: unknown, syncValue: unknown, path = "$", output: JsonDiffItem[] = []): JsonDiffItem[] {
	if (output.length >= 1000) return output;
	if (Object.is(dataValue, syncValue)) return output;

	if (isRecord(dataValue) && isRecord(syncValue)) {
		const keys = new Set([...Object.keys(dataValue), ...Object.keys(syncValue)]);
		for (const key of Array.from(keys).sort()) {
			const childPath = `${path}.${key}`;
			if (!(key in syncValue)) {
				output.push({ path: childPath, kind: "missing-in-sync", dataValue: formatJsonValue(dataValue[key]), syncValue: "undefined" });
				continue;
			}
			if (!(key in dataValue)) {
				output.push({ path: childPath, kind: "missing-in-data", dataValue: "undefined", syncValue: formatJsonValue(syncValue[key]) });
				continue;
			}
			diffJson(dataValue[key], syncValue[key], childPath, output);
		}
		return output;
	}

	if (Array.isArray(dataValue) && Array.isArray(syncValue)) {
		const length = Math.max(dataValue.length, syncValue.length);
		for (let i = 0; i < length; i++) {
			const childPath = `${path}[${i}]`;
			if (i >= syncValue.length) {
				output.push({ path: childPath, kind: "missing-in-sync", dataValue: formatJsonValue(dataValue[i]), syncValue: "undefined" });
				continue;
			}
			if (i >= dataValue.length) {
				output.push({ path: childPath, kind: "missing-in-data", dataValue: "undefined", syncValue: formatJsonValue(syncValue[i]) });
				continue;
			}
			diffJson(dataValue[i], syncValue[i], childPath, output);
		}
		return output;
	}

	output.push({
		path,
		kind: "changed",
		dataValue: formatJsonValue(dataValue),
		syncValue: formatJsonValue(syncValue),
	});
	return output;
}

function formatJsonValue(value: unknown): string {
	const text = value === undefined ? "undefined" : JSON.stringify(value);
	if (!text) return String(text);
	return text.length > 160 ? `${text.slice(0, 157)}...` : text;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUmOSDataLike(value: unknown): value is UmOSData {
	if (!isRecord(value)) return false;
	return isRecord(value.settings) &&
		isRecord(value.prayer) &&
		isRecord(value.schedule) &&
		isRecord(value.home);
}
