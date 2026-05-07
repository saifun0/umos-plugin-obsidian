import { HomeViewContext, RecentClosedNote } from "./types";
import { createElement } from "../utils/dom";
import { renderHeaderSection } from "./sections/header";
import { renderWeatherSection } from "./sections/weather";
import { renderPrayerSection } from "./sections/prayer";
import { renderNavigationSection } from "./sections/navigation";
import { renderStatsSection } from "./sections/stats";
import { renderTasksSection } from "./sections/tasks";
import { renderDeadlinesSection } from "./sections/deadlines";
import { renderProjectsSection } from "./sections/projects";
import { renderContentSection } from "./sections/content";
import { renderFooter } from "./sections/footer";

export interface DesktopHomeRenderResult {
	clockEl?: HTMLElement | null;
	countdownEl?: HTMLElement | null;
}

function hasSection(visible: Set<string>, id: string): boolean {
	return visible.has(id);
}

function formatClosedAt(closedAt: number): string {
	const diffMs = Math.max(0, Date.now() - closedAt);
	const minutes = Math.floor(diffMs / 60000);

	if (minutes < 1) return "just now";
	if (minutes < 60) return `${minutes} min ago`;

	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours} h ago`;

	const days = Math.floor(hours / 24);
	return `${days} d ago`;
}

function getNoteFolder(path: string): string {
	const normalized = path.replace(/\\/g, "/").replace(/\.md$/i, "");
	const parts = normalized.split("/").filter(Boolean);
	if (parts.length <= 1) return "vault";
	return parts.slice(0, -1).join(" / ");
}

function renderRecentClosedNotes(parent: HTMLElement, notes: RecentClosedNote[], ctx: HomeViewContext): void {
	const section = createElement("div", {
		cls: "umos-home-section umos-home-section-anim umos-home-recent-notes",
		parent,
	});

	const head = createElement("div", {
		cls: "umos-home-recent-head",
		parent: section,
	});
	createElement("span", {
		cls: "umos-home-section-title",
		text: "Recently Closed",
		parent: head,
	});
	createElement("span", {
		cls: "umos-home-recent-count",
		text: String(notes.length),
		parent: head,
	});

	if (notes.length === 0) {
		createElement("div", {
			cls: "umos-home-empty",
			text: "Closed notes will appear here",
			parent: section,
		});
		return;
	}

	const list = createElement("div", {
		cls: "umos-home-recent-list",
		parent: section,
	});

	for (const note of notes.slice(0, 5)) {
		const item = createElement("button", {
			cls: "umos-home-recent-item",
			attr: { type: "button" },
			parent: list,
		});

		createElement("span", {
			cls: "umos-home-recent-icon",
			text: "↩",
			parent: item,
		});

		const body = createElement("span", {
			cls: "umos-home-recent-body",
			parent: item,
		});
		createElement("span", {
			cls: "umos-home-recent-name",
			text: note.name,
			parent: body,
		});
		createElement("span", {
			cls: "umos-home-recent-path",
			text: getNoteFolder(note.path),
			parent: body,
		});

		createElement("span", {
			cls: "umos-home-recent-time",
			text: formatClosedAt(note.closedAt),
			parent: item,
		});

		item.addEventListener("click", () => {
			ctx.app.workspace.openLinkText(note.path, "", false);
		});
	}
}

export function renderDesktopHome(
	parent: HTMLElement,
	ctx: HomeViewContext,
	visibleSections: string[],
): DesktopHomeRenderResult {
	const visible = new Set(visibleSections);
	const result: DesktopHomeRenderResult = {};

	const shell = createElement("div", {
		cls: "umos-home-desktop-shell",
		parent,
	});

	const shouldRenderHeader = hasSection(visible, "clock") || hasSection(visible, "greeting");
	const shouldRenderTopAside = hasSection(visible, "weather") || hasSection(visible, "prayer");

	if (shouldRenderHeader || shouldRenderTopAside) {
		const top = createElement("div", {
			cls: "umos-home-desktop-top",
			parent: shell,
		});

		if (shouldRenderHeader) {
			const hero = createElement("div", {
				cls: "umos-home-desktop-hero",
				parent: top,
			});
			result.clockEl = renderHeaderSection(hero, ctx, visibleSections) || null;
			top.classList.add("has-hero");
		}

		if (shouldRenderTopAside) {
			const topAside = createElement("div", {
				cls: "umos-home-desktop-top-aside",
				parent: top,
			});

			if (hasSection(visible, "weather")) {
				renderWeatherSection(topAside, ctx);
			}

			if (hasSection(visible, "prayer")) {
				result.countdownEl = renderPrayerSection(topAside, ctx);
			}

			if (topAside.childElementCount === 0) {
				topAside.remove();
			} else {
				top.classList.add("has-aside");
			}
		}

		if (top.childElementCount === 0) {
			top.remove();
		}
	}

	const grid = createElement("div", {
		cls: "umos-home-desktop-grid",
		parent: shell,
	});

	const left = createElement("div", {
		cls: "umos-home-desktop-column umos-home-desktop-column-left",
		parent: grid,
	});

	if (hasSection(visible, "navigation")) {
		renderNavigationSection(left, ctx);
	}
	if (hasSection(visible, "content")) {
		renderContentSection(left, ctx);
	}
	if (hasSection(visible, "deadlines")) {
		renderDeadlinesSection(left, ctx);
	}

	const main = createElement("div", {
		cls: "umos-home-desktop-column umos-home-desktop-column-main",
		parent: grid,
	});

	if (hasSection(visible, "tasks")) {
		renderTasksSection(main, ctx);
	}

	const right = createElement("div", {
		cls: "umos-home-desktop-column umos-home-desktop-column-right",
		parent: grid,
	});

	if (hasSection(visible, "stats")) {
		renderStatsSection(right, ctx);
	}
	renderRecentClosedNotes(right, ctx.recentClosedNotes, ctx);
	if (hasSection(visible, "projects")) {
		renderProjectsSection(right, ctx);
	}
	if (hasSection(visible, "footer")) {
		renderFooter(right, ctx);
	}

	if (left.childElementCount === 0) {
		left.remove();
	} else {
		grid.classList.add("has-left");
	}

	if (main.childElementCount === 0) {
		main.remove();
	} else {
		grid.classList.add("has-main");
	}

	if (right.childElementCount === 0) {
		right.remove();
	} else {
		grid.classList.add("has-right");
	}

	if (grid.childElementCount === 0) {
		grid.remove();
	}

	return result;
}
