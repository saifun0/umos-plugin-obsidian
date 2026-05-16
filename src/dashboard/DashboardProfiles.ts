import { Modal, Notice, TFile, normalizePath } from "obsidian";
import type UmOSPlugin from "../main";
import {
	DashboardBlock,
	DashboardPreset,
	DashboardProfile,
	DashboardWidthMode,
} from "./types";
import { widgetConfigToMarkdown } from "./WidgetRegistry";

const EXPORT_VERSION = 1;

type ImportAction = "add" | "update" | "skip" | "invalid";

export interface DashboardProfilesImportPlanItem {
	action: ImportAction;
	profile: DashboardProfile | null;
	name: string;
	id: string;
	targetPath: string;
	reason: string;
	importedUpdatedAt: number;
	existingUpdatedAt: number | null;
}

export interface DashboardProfilesImportPlan {
	path: string;
	version: number | null;
	exportedAt: number | null;
	items: DashboardProfilesImportPlanItem[];
	added: number;
	updated: number;
	skipped: number;
	invalid: number;
	applicable: number;
	backupPath?: string;
}

export interface DashboardProfilesImportOptions {
	preview?: boolean;
	onApplied?: (plan: DashboardProfilesImportPlan) => void | Promise<void>;
}

export const DASHBOARD_PRESETS: DashboardPreset[] = [
	{
		id: "daily-os",
		name: "Daily OS",
		description: "Daily screen: navigation, prayers, schedule, tasks, and review.",
		targetPath: "05 Dashboards/Daily OS.md",
		columns: 2,
		widthMode: "soft",
		blocks: [
			{ widget: "daily-nav", config: {}, enabled: true, column: 1 },
			{ widget: "prayer-widget", config: { show: "both", style: "compact" }, enabled: true, column: 1 },
			{ widget: "schedule", config: { show: "both", countdown: true, tasks: true, task_mode: "both" }, enabled: true, column: 1 },
			{ widget: "tasks-widget", config: { title: "Today", due: "today", create_in: "current", sort: "priority-asc" }, enabled: true, column: 2 },
			{ widget: "daily-review", config: { mode: "daily" }, enabled: true, column: 2 },
		],
	},
	{
		id: "study-dashboard",
		name: "Study Dashboard",
		description: "Study dashboard: schedule, tasks, and stats.",
		targetPath: "05 Dashboards/Study.md",
		columns: 2,
		widthMode: "soft",
		blocks: [
			{ widget: "schedule", config: { show: "both", countdown: true, tasks: true, task_mode: "scheduled" }, enabled: true, column: 1 },
			{ widget: "tasks-widget", config: { title: "Study Tasks", tag: "tasks/study", create_in: "current" }, enabled: true, column: 2 },
			{ widget: "umos-stats", config: { metrics: ["productivity", "sleep"], chart: "sparkline", compare: true }, enabled: true, column: 2 },
		],
	},
	{
		id: "tasks-board",
		name: "Tasks Board",
		description: "Tasks, stats, and kanban.",
		targetPath: "05 Dashboards/Tasks Board.md",
		columns: 2,
		widthMode: "wide",
		blocks: [
			{ widget: "tasks-stats-widget", config: {}, enabled: true, column: 1 },
			{ widget: "tasks-completed-widget", config: { collapsed: true }, enabled: true, column: 1 },
			{ widget: "tasks-widget", config: { title: "Active tasks", status: "todo,doing", sort: "priority-asc" }, enabled: true, column: 1 },
			{ widget: "tasks-kanban", config: { title: "Kanban", create_in: "current" }, enabled: true, column: 2 },
		],
	},
	{
		id: "content-hub",
		name: "Content Hub",
		description: "Projects, content, and progress.",
		targetPath: "05 Dashboards/Content Hub.md",
		columns: 2,
		widthMode: "soft",
		blocks: [
			{ widget: "project-gallery", config: { style: "grid" }, enabled: true, column: 1 },
			{ widget: "content-gallery", config: { style: "grid" }, enabled: true, column: 2 },
			{ widget: "countdown", config: { title: "Next Release", date: "2026-07-01 00:00", view: "focus" }, enabled: true, column: 1 },
		],
	},
	{
		id: "review-dashboard",
		name: "Review Dashboard",
		description: "Daily/weekly review and word-of-the-day history.",
		targetPath: "05 Dashboards/Review.md",
		columns: 1,
		widthMode: "default",
		blocks: [
			{ widget: "daily-review", config: { mode: "daily" }, enabled: true, column: 1 },
			{ widget: "daily-review", config: { mode: "weekly", title: "Weekly Review" }, enabled: true, column: 1 },
			{ widget: "words-of-day", config: { period: 30 }, enabled: true, column: 1 },
		],
	},
];

export function createProfileFromPreset(preset: DashboardPreset): DashboardProfile {
	const stamp = Date.now();
	return {
		id: `${preset.id}-${stamp}`,
		name: preset.name,
		targetPath: preset.targetPath,
		columns: preset.columns,
		widthMode: preset.widthMode ?? "default",
		blocks: preset.blocks.map((block, index) => ({
			...block,
			id: `${preset.id}-block-${stamp}-${index}`,
			config: { ...block.config },
		})),
		updatedAt: stamp,
	};
}

export function createEmptyProfile(): DashboardProfile {
	const stamp = Date.now();
	return {
		id: `dashboard-${stamp}`,
		name: "New Dashboard",
		targetPath: "05 Dashboards/New Dashboard.md",
		columns: 1,
		widthMode: "default",
		blocks: [],
		updatedAt: stamp,
	};
}

export function createDashboardBlock(widget: string, defaults: Record<string, unknown>, column = 1): DashboardBlock {
	return {
		id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
		widget,
		config: { ...defaults },
		enabled: true,
		column,
	};
}

export function generateDashboardMarkdown(profile: DashboardProfile): string {
	const cssClasses = getDashboardCssClasses(profile.widthMode ?? "default");
	const frontmatter = [
		"---",
		"type: dashboard",
		"cssclasses:",
		...cssClasses.map((cls) => `  - ${cls}`),
		"generated_by: umOS Dashboard Studio",
		`dashboard_profile_id: ${profile.id}`,
		"---",
		"",
		`# ${profile.name}`,
		"",
	];

	const enabled = profile.blocks.filter((block) => block.enabled);
	if (profile.columns <= 1) {
		return [
			...frontmatter,
			...enabled.map((block) => widgetConfigToMarkdown(block.widget, block.config)),
			"",
		].join("\n\n");
	}

	const columns: string[] = [];
	for (let column = 1; column <= profile.columns; column++) {
		const body = enabled
			.filter((block) => Math.max(1, Math.min(profile.columns, block.column || 1)) === column)
			.map((block) => widgetConfigToMarkdown(block.widget, block.config))
			.join("\n\n");
		columns.push(body || "> Empty column");
	}

	return [
		...frontmatter,
		"````cols-umos",
		`cols: ${profile.columns}`,
		columns.join("\n\n===\n\n"),
		"````",
		"",
	].join("\n");
}

function getDashboardCssClasses(widthMode: DashboardWidthMode): string[] {
	const classes = ["hide"];
	if (widthMode === "soft") classes.push("umos-wide-soft");
	if (widthMode === "wide") classes.push("umos-wide");
	return classes;
}

export async function writeDashboardProfile(plugin: UmOSPlugin, profile: DashboardProfile): Promise<void> {
	const path = normalizePath(profile.targetPath || "05 Dashboards/Dashboard.md");
	await ensureVaultFolder(plugin, path);
	const content = generateDashboardMarkdown(profile);
	const existing = plugin.app.vault.getAbstractFileByPath(path);
	if (existing instanceof TFile) {
		await plugin.app.vault.modify(existing, content);
	} else {
		await plugin.app.vault.create(path, content);
	}
	plugin.eventBus.emit("dashboard:generated", { id: profile.id, path });
	new Notice(`✅ Dashboard updated: ${path}`);
	await plugin.app.workspace.openLinkText(path, "", false);
}

export async function exportDashboardProfiles(plugin: UmOSPlugin): Promise<void> {
	const path = normalizePath(plugin.settings.dashboardProfilesExportPath || "umOS/dashboard-profiles.json");
	await ensureVaultFolder(plugin, path);
	const payload = {
		version: EXPORT_VERSION,
		exportedAt: Date.now(),
		profiles: plugin.data_store.dashboardProfiles ?? [],
	};
	await plugin.app.vault.adapter.write(path, JSON.stringify(payload, null, 2));
	new Notice(`✅ Profiles exported: ${path}`);
}

export async function importDashboardProfiles(
	plugin: UmOSPlugin,
	options: DashboardProfilesImportOptions = {}
): Promise<number> {
	const plan = await analyzeDashboardProfilesImport(plugin);
	if (!plan) return 0;

	if (options.preview !== false) {
		new DashboardProfilesImportModal(plugin, plan, async (appliedPlan) => {
			if (options.onApplied) await options.onApplied(appliedPlan);
		}).open();
		return plan.applicable;
	}

	await applyDashboardProfilesImport(plugin, plan);
	if (options.onApplied) await options.onApplied(plan);
	return plan.applicable;
}

export async function analyzeDashboardProfilesImport(plugin: UmOSPlugin): Promise<DashboardProfilesImportPlan | null> {
	const path = normalizePath(plugin.settings.dashboardProfilesExportPath || "umOS/dashboard-profiles.json");
	const exists = await plugin.app.vault.adapter.exists(path);
	if (!exists) {
		new Notice(`File not found: ${path}`);
		return null;
	}

	let parsed: unknown;
	try {
		const raw = await plugin.app.vault.adapter.read(path);
		parsed = JSON.parse(raw);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		new Notice(`Could not read dashboard profiles JSON: ${message}`);
		return null;
	}

	if (!isRecord(parsed)) {
		new Notice("Dashboard profiles JSON must be an object.");
		return null;
	}

	const profilesRaw = parsed.profiles;
	if (!Array.isArray(profilesRaw)) {
		new Notice("Dashboard profiles JSON must contain profiles: [].");
		return null;
	}

	const current = plugin.data_store.dashboardProfiles ?? [];
	const currentById = new Map(current.map((profile) => [profile.id, profile]));
	const seenIncoming = new Set<string>();
	const items: DashboardProfilesImportPlanItem[] = [];

	for (let index = 0; index < profilesRaw.length; index++) {
		const normalized = normalizeImportedProfile(profilesRaw[index], index);
		if (!normalized.profile) {
			items.push({
				action: "invalid",
				profile: null,
				name: `Profile #${index + 1}`,
				id: "",
				targetPath: "",
				reason: normalized.reason,
				importedUpdatedAt: 0,
				existingUpdatedAt: null,
			});
			continue;
		}

		const profile = normalized.profile;
		if (seenIncoming.has(profile.id)) {
			items.push({
				action: "skip",
				profile,
				name: profile.name,
				id: profile.id,
				targetPath: profile.targetPath,
				reason: "Duplicate id inside imported JSON. Using the first occurrence.",
				importedUpdatedAt: profile.updatedAt || 0,
				existingUpdatedAt: currentById.get(profile.id)?.updatedAt ?? null,
			});
			continue;
		}
		seenIncoming.add(profile.id);

		const existing = currentById.get(profile.id);
		if (!existing) {
			items.push({
				action: "add",
				profile,
				name: profile.name,
				id: profile.id,
				targetPath: profile.targetPath,
				reason: "New profile.",
				importedUpdatedAt: profile.updatedAt || 0,
				existingUpdatedAt: null,
			});
			continue;
		}

		const importedUpdatedAt = profile.updatedAt || 0;
		const existingUpdatedAt = existing.updatedAt || 0;
		if (importedUpdatedAt > existingUpdatedAt) {
			items.push({
				action: "update",
				profile,
				name: profile.name,
				id: profile.id,
				targetPath: profile.targetPath,
				reason: "Imported profile is newer.",
				importedUpdatedAt,
				existingUpdatedAt,
			});
			continue;
		}

		items.push({
			action: "skip",
			profile,
			name: profile.name,
			id: profile.id,
			targetPath: profile.targetPath,
			reason: importedUpdatedAt === existingUpdatedAt
				? "The same version already exists."
				: "Local profile is newer.",
			importedUpdatedAt,
			existingUpdatedAt,
		});
	}

	const added = items.filter((item) => item.action === "add").length;
	const updated = items.filter((item) => item.action === "update").length;
	const skipped = items.filter((item) => item.action === "skip").length;
	const invalid = items.filter((item) => item.action === "invalid").length;

	return {
		path,
		version: typeof parsed.version === "number" ? parsed.version : null,
		exportedAt: typeof parsed.exportedAt === "number" ? parsed.exportedAt : null,
		items,
		added,
		updated,
		skipped,
		invalid,
		applicable: added + updated,
	};
}

export async function applyDashboardProfilesImport(
	plugin: UmOSPlugin,
	plan: DashboardProfilesImportPlan
): Promise<void> {
	if (plan.applicable === 0) {
		new Notice("No profiles to import.");
		return;
	}

	plan.backupPath = await backupDashboardProfiles(plugin, plan.path);

	const current = plugin.data_store.dashboardProfiles ?? [];
	const merged = new Map<string, DashboardProfile>();
	for (const profile of current) merged.set(profile.id, profile);

	for (const item of plan.items) {
		if ((item.action === "add" || item.action === "update") && item.profile) {
			merged.set(item.profile.id, cloneDashboardProfile(item.profile));
			plugin.eventBus.emit("dashboard:profile-saved", {
				id: item.profile.id,
				name: item.profile.name,
			});
		}
	}

	plugin.data_store.dashboardProfiles = Array.from(merged.values());
	await plugin.saveSettings();
	new Notice(`✅ Import: ${plan.added} added, ${plan.updated} updated, ${plan.skipped} skipped`);
}

export function upsertDashboardProfile(plugin: UmOSPlugin, profile: DashboardProfile): void {
	const profiles = plugin.data_store.dashboardProfiles ?? [];
	const index = profiles.findIndex((item) => item.id === profile.id);
	const next = { ...profile, updatedAt: Date.now() };
	if (index === -1) {
		profiles.push(next);
	} else {
		profiles[index] = next;
	}
	plugin.data_store.dashboardProfiles = profiles;
	plugin.eventBus.emit("dashboard:profile-saved", { id: next.id, name: next.name });
}

async function ensureVaultFolder(plugin: UmOSPlugin, filePath: string): Promise<void> {
	const normalized = normalizePath(filePath);
	const slashIndex = normalized.lastIndexOf("/");
	if (slashIndex === -1) return;
	const folderPath = normalized.slice(0, slashIndex);
	const parts = folderPath.split("/").filter(Boolean);
	let current = "";
	for (const part of parts) {
		current = current ? `${current}/${part}` : part;
		if (!plugin.app.vault.getAbstractFileByPath(current)) {
			await plugin.app.vault.createFolder(current);
		}
	}
}

async function backupDashboardProfiles(plugin: UmOSPlugin, sourcePath: string): Promise<string> {
	const normalized = normalizePath(sourcePath);
	const stamp = new Date()
		.toISOString()
		.replace(/[-:]/g, "")
		.replace(/\.\d{3}Z$/, "Z");
	const dotIndex = normalized.toLowerCase().endsWith(".json") ? normalized.length - 5 : normalized.length;
	const backupPath = `${normalized.slice(0, dotIndex)}.backup-${stamp}.json`;
	await ensureVaultFolder(plugin, backupPath);
	const payload = {
		version: EXPORT_VERSION,
		backupOf: normalized,
		createdAt: Date.now(),
		profiles: plugin.data_store.dashboardProfiles ?? [],
	};
	await plugin.app.vault.adapter.write(backupPath, JSON.stringify(payload, null, 2));
	return backupPath;
}

function normalizeImportedProfile(raw: unknown, index: number): { profile: DashboardProfile | null; reason: string } {
	if (!isRecord(raw)) {
		return { profile: null, reason: `Profile #${index + 1} is not an object.` };
	}

	const id = stringValue(raw.id);
	const name = stringValue(raw.name);
	const targetPath = stringValue(raw.targetPath);
	if (!id) return { profile: null, reason: `Profile #${index + 1}: is missing id.` };
	if (!name) return { profile: null, reason: `${id}: is missing name.` };
	if (!targetPath) return { profile: null, reason: `${id}: is missing targetPath.` };

	const blocksRaw = raw.blocks;
	if (!Array.isArray(blocksRaw)) return { profile: null, reason: `${id}: blocks must be an array.` };
	const blocks: DashboardBlock[] = [];
	for (let blockIndex = 0; blockIndex < blocksRaw.length; blockIndex++) {
		const block = normalizeImportedBlock(blocksRaw[blockIndex], blockIndex);
		if (!block) {
			return { profile: null, reason: `${id}: block #${blockIndex + 1} is invalid.` };
		}
		blocks.push(block);
	}

	const columns = numberValue(raw.columns, 1);
	const widthModeRaw = stringValue(raw.widthMode);
	const widthMode: DashboardWidthMode = widthModeRaw === "soft" || widthModeRaw === "wide" ? widthModeRaw : "default";

	return {
		profile: {
			id,
			name,
			targetPath,
			columns: Math.max(1, Math.min(6, Math.floor(columns))),
			widthMode,
			blocks,
			updatedAt: numberValue(raw.updatedAt, 0),
		},
		reason: "",
	};
}

function normalizeImportedBlock(raw: unknown, index: number): DashboardBlock | null {
	if (!isRecord(raw)) return null;
	const id = stringValue(raw.id) || `imported-block-${index + 1}`;
	const widget = stringValue(raw.widget);
	if (!widget) return null;
	const config = isRecord(raw.config) ? { ...raw.config } : {};
	return {
		id,
		widget,
		config,
		enabled: typeof raw.enabled === "boolean" ? raw.enabled : true,
		column: Math.max(1, Math.floor(numberValue(raw.column, 1))),
	};
}

function cloneDashboardProfile(profile: DashboardProfile): DashboardProfile {
	return {
		...profile,
		blocks: profile.blocks.map((block) => ({
			...block,
			config: { ...block.config },
		})),
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown, fallback: number): number {
	const next = typeof value === "number" ? value : Number(value);
	return Number.isFinite(next) ? next : fallback;
}

class DashboardProfilesImportModal extends Modal {
	constructor(
		private plugin: UmOSPlugin,
		private plan: DashboardProfilesImportPlan,
		private onApplied: (plan: DashboardProfilesImportPlan) => void | Promise<void>
	) {
		super(plugin.app);
	}

	onOpen(): void {
		this.modalEl.addClass("umos-dashboard-import-modal");
		this.render();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Import Dashboard Profiles" });

		contentEl.createDiv({
			cls: "umos-dashboard-import-path",
			text: this.plan.path,
		});

		if (this.plan.exportedAt) {
			contentEl.createDiv({
				cls: "umos-dashboard-import-meta",
				text: `Exported: ${new Date(this.plan.exportedAt).toLocaleString()}`,
			});
		}

		const stats = contentEl.createDiv({ cls: "umos-dashboard-import-stats" });
		this.renderStat(stats, "Added", this.plan.added, "is-add");
		this.renderStat(stats, "Updated", this.plan.updated, "is-update");
		this.renderStat(stats, "Skipped", this.plan.skipped, "is-skip");
		this.renderStat(stats, "Invalid", this.plan.invalid, "is-invalid");

		const list = contentEl.createDiv({ cls: "umos-dashboard-import-list" });
		for (const item of this.plan.items) {
			const row = list.createDiv({ cls: `umos-dashboard-import-row is-${item.action}` });
			const main = row.createDiv({ cls: "umos-dashboard-import-main" });
			main.createSpan({ cls: "umos-dashboard-import-name", text: item.name });
			if (item.id) main.createSpan({ cls: "umos-dashboard-import-id", text: item.id });
			if (item.targetPath) main.createSpan({ cls: "umos-dashboard-import-target", text: item.targetPath });

			row.createDiv({ cls: "umos-dashboard-import-reason", text: item.reason });
			row.createSpan({ cls: "umos-dashboard-import-action", text: item.action });
		}

		const actions = contentEl.createDiv({ cls: "umos-dashboard-import-actions" });
		actions.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());
		const applyBtn = actions.createEl("button", {
			text: this.plan.applicable > 0 ? "Import" : "Nothing to import",
			cls: "mod-cta",
		});
		applyBtn.disabled = this.plan.applicable === 0;
		applyBtn.addEventListener("click", async () => {
			applyBtn.disabled = true;
			try {
				await applyDashboardProfilesImport(this.plugin, this.plan);
				await this.onApplied(this.plan);
				this.close();
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				new Notice(`Import failed: ${message}`);
				applyBtn.disabled = false;
			}
		});
	}

	private renderStat(parent: HTMLElement, label: string, value: number, cls: string): void {
		const item = parent.createDiv({ cls: `umos-dashboard-import-stat ${cls}` });
		item.createSpan({ cls: "umos-dashboard-import-stat-value", text: String(value) });
		item.createSpan({ cls: "umos-dashboard-import-stat-label", text: label });
	}
}
