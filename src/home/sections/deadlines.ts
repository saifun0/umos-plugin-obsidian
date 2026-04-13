import { HomeViewContext } from "../types";
import { createElement } from "../../utils/dom";
import { getTodayDateString, formatDate } from "../../utils/date";

export function renderDeadlinesSection(parent: HTMLElement, ctx: HomeViewContext): void {
	const section = createElement("div", {
		cls: "umos-home-section umos-home-section-anim",
		parent,
	});

	createElement("div", {
		cls: "umos-home-section-title",
		text: "🔥 Горящие дедлайны",
		parent: section,
	});

	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const todayStr = getTodayDateString();

	const limitDate = new Date(today);
	limitDate.setDate(limitDate.getDate() + 7);
	const limitStr = formatDate(limitDate);

	const overdueFrom = new Date(today);
	overdueFrom.setDate(overdueFrom.getDate() - 3);
	const overdueFromStr = formatDate(overdueFrom);

	const upcoming: { name: string; deadline: string; daysLeft: number; path: string }[] = [];
	const overdue: { name: string; deadline: string; daysOverdue: number; path: string }[] = [];

	const files = ctx.app.vault.getMarkdownFiles();
	for (const file of files) {
		const cache = ctx.app.metadataCache.getFileCache(file);
		const raw = cache?.frontmatter?.deadline;
		if (!raw) continue;

		let dl: string;
		if (raw instanceof Date) {
			dl = formatDate(raw);
		} else {
			dl = String(raw).trim().slice(0, 10);
		}

		if (!/^\d{4}-\d{2}-\d{2}$/.test(dl)) continue;

		const dlDate = new Date(dl + "T00:00:00");
		const diff = Math.round((dlDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

		if (dl >= todayStr && dl <= limitStr) {
			upcoming.push({ name: file.basename, deadline: dl, daysLeft: Math.max(0, diff), path: file.path });
		} else if (dl >= overdueFromStr && dl < todayStr) {
			overdue.push({ name: file.basename, deadline: dl, daysOverdue: Math.abs(diff), path: file.path });
		}
	}

	upcoming.sort((a, b) => a.daysLeft - b.daysLeft);
	overdue.sort((a, b) => a.daysOverdue - b.daysOverdue);

	if (upcoming.length === 0 && overdue.length === 0) {
		createElement("div", {
			cls: "umos-home-empty",
			text: "Нет горящих дедлайнов 🎉",
			parent: section,
		});
		return;
	}

	const list = createElement("div", {
		cls: "umos-home-deadlines-list",
		parent: section,
	});

	// Просроченные — сначала
	if (overdue.length > 0) {
		createElement("div", {
			cls: "umos-home-deadlines-group-label",
			text: "⚠️ Просрочено",
			parent: list,
		});
		for (const dl of overdue.slice(0, 3)) {
			const item = createElement("div", {
				cls: "umos-home-deadline umos-home-deadline-overdue",
				parent: list,
			});
			createElement("span", { cls: "umos-home-deadline-icon", text: "🔴", parent: item });
			createElement("span", { cls: "umos-home-deadline-name", text: dl.name, parent: item });
			createElement("span", {
				cls: "umos-home-deadline-days umos-home-deadline-days--overdue",
				text: `${dl.daysOverdue} дн. назад`,
				parent: item,
			});
			item.addEventListener("click", () => ctx.app.workspace.openLinkText(dl.path, "", false));
		}
	}

	// Предстоящие
	if (upcoming.length > 0) {
		if (overdue.length > 0) {
			createElement("div", {
				cls: "umos-home-deadlines-group-label",
				text: "📅 Предстоящие",
				parent: list,
			});
		}
		for (const dl of upcoming.slice(0, 5)) {
			const item = createElement("div", {
				cls: `umos-home-deadline ${dl.daysLeft === 0 ? "umos-home-deadline-today" : ""}`,
				parent: list,
			});
			createElement("span", {
				cls: "umos-home-deadline-icon",
				text: dl.daysLeft === 0 ? "🔴" : dl.daysLeft === 1 ? "🟡" : "🟠",
				parent: item,
			});
			createElement("span", { cls: "umos-home-deadline-name", text: dl.name, parent: item });
			const daysText = dl.daysLeft === 0 ? "Сегодня!" : dl.daysLeft === 1 ? "Завтра" : `${dl.daysLeft} дн.`;
			createElement("span", { cls: "umos-home-deadline-days", text: daysText, parent: item });
			item.addEventListener("click", () => ctx.app.workspace.openLinkText(dl.path, "", false));
		}
	}
}
