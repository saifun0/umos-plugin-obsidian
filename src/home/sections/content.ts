import { TFile, TFolder } from "obsidian";
import { HomeViewContext, ActiveContentItem } from "../types";
import { createElement } from "../../utils/dom";

function normalizeProjectStatus(raw: unknown): string {
	if (!raw) return "";
	const value = Array.isArray(raw) ? String(raw[0]) : String(raw);
	const normalized = value.trim().toLowerCase();
	if (normalized === "active" || normalized === "in-progress") return "active";
	if (normalized.includes("▶️ active") || normalized.includes("▶️ in-progress")) return "active";
	if (normalized.includes("в работе") || normalized.includes("в процессе")) return "active";
	return normalized;
}

function collectFolderActive(
	folderPath: string,
	result: { name: string; path: string }[],
	ctx: HomeViewContext
): void {
	const folder = ctx.app.vault.getAbstractFileByPath(folderPath);
	if (!(folder instanceof TFolder)) return;

	for (const child of folder.children) {
		if (child instanceof TFolder) {
			collectFolderActive(child.path, result, ctx);
			continue;
		}
		if (!(child instanceof TFile) || child.extension !== "md") continue;

		const cache = ctx.app.metadataCache.getFileCache(child);
		const status = cache?.frontmatter?.status;
		const normalized = normalizeProjectStatus(status);
		if (normalized === "active") {
			result.push({ name: child.basename, path: child.path });
		}
	}
}

function collectActiveContent(
	folderPath: string,
	ct: { label: string; icon: string; epField: string; totalField: string; unit: string; color: string },
	result: ActiveContentItem[],
	ctx: HomeViewContext
): void {
	const folder = ctx.app.vault.getAbstractFileByPath(folderPath);
	if (!(folder instanceof TFolder)) return;

	const activeStatuses = new Set([
		"watching", "reading", "playing", "active", "in-progress",
		"▶️ watching", "▶️ reading", "▶️ playing",
	]);

	for (const child of folder.children) {
		if (child instanceof TFolder) {
			collectActiveContent(child.path, ct, result, ctx);
			continue;
		}
		if (!(child instanceof TFile) || child.extension !== "md") continue;

		const cache = ctx.app.metadataCache.getFileCache(child);
		const fm = cache?.frontmatter;
		if (!fm?.status) continue;

		const normalized = String(fm.status).trim().toLowerCase();
		if (!activeStatuses.has(normalized) && !activeStatuses.has(String(fm.status).trim())) continue;

		const current = ct.epField ? (Number(fm[ct.epField]) || 0) : 0;
		const total = ct.totalField ? (Number(fm[ct.totalField]) || 0) : 0;

		result.push({
			name: child.basename,
			path: child.path,
			type: ct.label,
			icon: ct.icon,
			current,
			total,
			unit: ct.unit,
			color: ct.color,
		});
	}
}

export function renderContentSection(parent: HTMLElement, ctx: HomeViewContext): void {
	const section = createElement("div", {
		cls: "umos-home-section umos-home-section-anim",
		parent,
	});

	createElement("div", {
		cls: "umos-home-section-title",
		text: "🎬 Текущий контент",
		parent: section,
	});

	// Scan all content type folders for active items
	const activeFiles: ActiveContentItem[] = [];
	const contentRoot = ctx.settings.homeContentPath;

	for (const ct of ctx.settings.contentTypes) {
		const folderPath = `${contentRoot}/${ct.folder}`;
		collectActiveContent(folderPath, ct, activeFiles, ctx);
	}

	if (activeFiles.length === 0) {
		createElement("div", {
			cls: "umos-home-empty",
			text: "Нет активного контента",
			parent: section,
		});
		return;
	}

	const grid = createElement("div", {
		cls: "umos-home-folder-grid",
		parent: section,
	});

	for (const item of activeFiles.slice(0, 6)) {
		const card = createElement("div", {
			cls: "umos-home-folder-card umos-card",
			parent: grid,
		});

		createElement("div", {
			cls: "umos-home-folder-card-name",
			text: `${item.icon} ${item.name}`,
			parent: card,
		});

		const metaRow = createElement("div", { cls: "umos-home-content-meta", parent: card });
		createElement("span", {
			cls: "umos-home-folder-card-status",
			text: `▶ ${item.type}`,
			parent: metaRow,
		});

		if (item.current > 0 || item.total > 0) {
			const progressText = item.total > 0
				? `${item.current}/${item.total} ${item.unit}`
				: `${item.current} ${item.unit}`;
			createElement("span", {
				cls: "umos-home-content-progress-text",
				text: progressText,
				parent: metaRow,
			});
		}

		if (item.total > 0) {
			const pct = Math.min(100, Math.round((item.current / item.total) * 100));
			const bar = createElement("div", { cls: "umos-home-content-bar", parent: card });
			bar.style.setProperty("--umos-content-color", item.color);
			const fill = createElement("div", { cls: "umos-home-content-bar-fill", parent: bar });
			fill.style.width = `${pct}%`;
		}

		card.addEventListener("click", () => {
			ctx.app.workspace.openLinkText(item.path, "", false);
		});
	}
}
