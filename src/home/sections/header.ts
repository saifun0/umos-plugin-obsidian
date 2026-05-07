import { TFile } from "obsidian";
import { HomeViewContext } from "../types";
import { createElement } from "../../utils/dom";
import {
	getCurrentTimeStringWithSeconds,
	getFullRussianDate,
	getGreeting,
	getTodayDateString,
} from "../../utils/date";

function getDailyNotePathForDate(dateISO: string, ctx: HomeViewContext): string {
	const parts = dateISO.split("-");
	if (parts.length !== 3) {
		return `${ctx.settings.dailyNotesPath}/${dateISO}.md`;
	}
	const [year, month, day] = parts;
	const format = ctx.settings.dailyNoteFormat || "YYYY-MM-DD";
	const fileName = format.replace("YYYY", year).replace("MM", month).replace("DD", day);
	return `${ctx.settings.dailyNotesPath}/${fileName}.md`;
}

function resolveProfileAvatarUrl(ctx: HomeViewContext): string {
	const raw = (ctx.settings.userAvatarUrl ?? "").trim();
	if (!raw) return "";
	if (/^(https?:)?\/\//i.test(raw) || raw.startsWith("data:") || raw.startsWith("app://")) {
		return raw;
	}

	const clean = raw
		.replace(/^!?\[\[/, "")
		.replace(/\]\]$/, "")
		.replace(/^!?\[.*?\]\(/, "")
		.replace(/\)$/, "")
		.split("|")[0]
		.trim();
	if (!clean) return "";

	const target = ctx.app.vault.getAbstractFileByPath(clean)
		|| ctx.app.metadataCache.getFirstLinkpathDest(clean, "");
	return target instanceof TFile ? ctx.app.vault.getResourcePath(target) : "";
}

function renderProfileCard(parent: HTMLElement, ctx: HomeViewContext): void {
	const nickname = (ctx.settings.userNickname ?? "").trim();
	const avatarUrl = resolveProfileAvatarUrl(ctx);
	if (!nickname && !avatarUrl) return;

	const card = createElement("div", {
		cls: "umos-home-profile-card",
		parent,
	});

	if (avatarUrl) {
		const avatar = card.createEl("img", {
			cls: "umos-home-profile-avatar",
			attr: { alt: nickname || "Avatar", src: avatarUrl },
		});
		avatar.addEventListener("error", () => {
			const fallback = document.createElement("span");
			fallback.className = "umos-home-profile-avatar umos-home-profile-avatar-fallback";
			fallback.textContent = getProfileInitial(nickname);
			avatar.replaceWith(fallback);
		}, { once: true });
	} else {
		createElement("span", {
			cls: "umos-home-profile-avatar umos-home-profile-avatar-fallback",
			text: getProfileInitial(nickname),
			parent: card,
		});
	}

	const body = createElement("div", {
		cls: "umos-home-profile-body",
		parent: card,
	});

	createElement("span", {
		cls: "umos-home-profile-name",
		text: nickname || "Profile",
		parent: body,
	});
	createElement("span", {
		cls: "umos-home-profile-subtitle",
		text: "umOS dashboard",
		parent: body,
	});
}

function getProfileInitial(nickname: string): string {
	const trimmed = nickname.trim();
	return trimmed ? trimmed.charAt(0).toUpperCase() : "U";
}

export function renderHeaderSection(parent: HTMLElement, ctx: HomeViewContext, visible: string[]): HTMLElement {
	const header = createElement("div", {
		cls: "umos-home-header umos-home-section-anim",
		parent,
	});

	renderProfileCard(header, ctx);

	let clockEl: HTMLElement | null = null;

	if (visible.includes("clock")) {
		clockEl = createElement("div", {
			cls: "umos-home-clock",
			text: getCurrentTimeStringWithSeconds(),
			parent: header,
		});
	}

	if (visible.includes("greeting")) {
		const greeting = getGreeting();
		createElement("div", {
			cls: "umos-home-greeting",
			text: `${greeting.text} ${greeting.emoji}`,
			parent: header,
		});
	}

	// Dates
	const datesRow = createElement("div", {
		cls: "umos-home-dates",
		parent: header,
	});

	createElement("div", {
		cls: "umos-home-date-gregorian",
		text: getFullRussianDate(),
		parent: datesRow,
	});

	if (ctx.prayerService) {
		const hijri = ctx.prayerService.getHijriDate();
		if (hijri) {
			createElement("div", {
				cls: "umos-home-date-hijri",
				text: hijri,
				parent: datesRow,
			});
		}
	}

	// Quick action: open daily note
	const quickRow = createElement("div", {
		cls: "umos-home-quick-actions",
		parent: header,
	});

	const dailyBtn = createElement("button", {
		cls: "umos-home-quick-btn",
		parent: quickRow,
	});
	createElement("span", { cls: "umos-home-quick-btn-icon", text: "📝", parent: dailyBtn });
	createElement("span", { text: "Daily Note", parent: dailyBtn });
	dailyBtn.addEventListener("click", async () => {
		if (ctx.createDailyNote) {
			await ctx.createDailyNote();
		} else {
			const today = getTodayDateString();
			const path = getDailyNotePathForDate(today, ctx);
			await ctx.app.workspace.openLinkText(path, "", false);
		}
	});

	return clockEl as HTMLElement;
}

export function updateClock(el: HTMLElement): void {
	el.textContent = getCurrentTimeStringWithSeconds();
}
