import { TFile, TFolder } from "obsidian";
import { HomeViewContext } from "../types";
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

function renderFolderCards(parent: HTMLElement, title: string, folderPath: string, ctx: HomeViewContext): void {
	const section = createElement("div", {
		cls: "umos-home-section umos-home-section-anim",
		parent,
	});

	createElement("div", {
		cls: "umos-home-section-title",
		text: title,
		parent: section,
	});

	const activeFiles: { name: string; path: string }[] = [];
	collectFolderActive(folderPath, activeFiles, ctx);

	if (activeFiles.length === 0) {
		createElement("div", {
			cls: "umos-home-empty",
			text: "Нет активных элементов",
			parent: section,
		});
		return;
	}

	const grid = createElement("div", {
		cls: "umos-home-folder-grid",
		parent: section,
	});

	for (const item of activeFiles.slice(0, 4)) {
		const card = createElement("div", {
			cls: "umos-home-folder-card umos-card",
			parent: grid,
		});

		createElement("div", {
			cls: "umos-home-folder-card-name",
			text: item.name,
			parent: card,
		});

		createElement("div", {
			cls: "umos-home-folder-card-status",
			text: "▶ В процессе",
			parent: card,
		});

		card.addEventListener("click", () => {
			ctx.app.workspace.openLinkText(item.path, "", false);
		});
	}
}

export function renderProjectsSection(parent: HTMLElement, ctx: HomeViewContext): void {
	renderFolderCards(parent, "🚀 Активные проекты", ctx.settings.homeProjectsPath, ctx);
}
