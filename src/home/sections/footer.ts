import { TFile, TFolder } from "obsidian";
import { HomeViewContext } from "../types";
import { createElement } from "../../utils/dom";

export function renderFooter(parent: HTMLElement, ctx: HomeViewContext): void {
	const footer = createElement("div", {
		cls: "umos-home-footer umos-home-section-anim",
		parent,
	});

	const allFiles = ctx.app.vault.getMarkdownFiles();
	const totalNotes = allFiles.length;

	let totalTasks = 0;
	for (const file of allFiles) {
		const cache = ctx.app.metadataCache.getFileCache(file);
		if (cache?.listItems) {
			totalTasks += cache.listItems.filter((li) => li.task !== undefined).length;
		}
	}

	const projectsFolder = ctx.app.vault.getAbstractFileByPath(ctx.settings.homeProjectsPath);
	let totalProjects = 0;
	if (projectsFolder instanceof TFolder) {
		totalProjects = projectsFolder.children.filter(
			(c) => c instanceof TFile && c.extension === "md"
		).length;
	}

	const footerGrid = createElement("div", { cls: "umos-home-footer-grid", parent: footer });

	const footerItems = [
		{ icon: "📝", value: String(totalNotes), label: "заметок" },
		{ icon: "✅", value: String(totalTasks), label: "задач" },
		{ icon: "🚀", value: String(totalProjects), label: "проектов" },
	];

	for (const fi of footerItems) {
		const item = createElement("div", { cls: "umos-home-footer-item", parent: footerGrid });
		createElement("span", { cls: "umos-home-footer-item-icon", text: fi.icon, parent: item });
		createElement("span", { cls: "umos-home-footer-item-value", text: fi.value, parent: item });
		createElement("span", { cls: "umos-home-footer-item-label", text: fi.label, parent: item });
	}

	const divider = createElement("div", { cls: "umos-home-footer-divider", parent: footer });
	divider.innerHTML = `<svg viewBox="0 0 400 16" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:16px;display:block;margin:16px 0">
		<line x1="0" y1="8" x2="180" y2="8" style="stroke:var(--text-muted)" stroke-opacity="0.3" stroke-width="1"/>
		<polygon points="200,4 208,8 200,12 192,8" style="fill:var(--text-muted)" fill-opacity="0.4"/>
		<line x1="220" y1="8" x2="400" y2="8" style="stroke:var(--text-muted)" stroke-opacity="0.3" stroke-width="1"/>
	</svg>`;
}
