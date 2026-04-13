import { HomeViewContext } from "../types";
import { createElement } from "../../utils/dom";
import { formatCountdown } from "../../utils/date";
import { PrayerService } from "../../religion/prayer/PrayerService";

export function renderPrayerSection(parent: HTMLElement, ctx: HomeViewContext): HTMLElement | null {
	if (!ctx.prayerService) return null;

	const section = createElement("div", {
		cls: "umos-home-section umos-home-section-anim",
		parent,
	});

	const times = ctx.prayerService.getTimes();
	const statuses = ctx.prayerService.getPrayerStatuses();
	const next = ctx.prayerService.getNextPrayer();
	const showSunrise = ctx.settings.prayerShowSunrise;

	let countdownEl: HTMLElement | null = null;

	// Next prayer highlight card
	if (next) {
		const card = createElement("div", {
			cls: "umos-home-prayer-next",
			parent: section,
		});

		const left = createElement("div", { cls: "umos-home-prayer-next-left", parent: card });
		createElement("span", { cls: "umos-home-prayer-next-icon", text: next.icon, parent: left });
		const info = createElement("div", { cls: "umos-home-prayer-next-info", parent: left });
		createElement("span", { cls: "umos-home-prayer-next-name", text: next.nameRu, parent: info });
		createElement("span", { cls: "umos-home-prayer-next-time", text: next.time, parent: info });

		countdownEl = createElement("div", {
			cls: "umos-home-prayer-next-countdown",
			text: `через ${formatCountdown(next.minutesLeft)}`,
			parent: card,
		});
	} else if (ctx.prayerService.allPrayersDone()) {
		const card = createElement("div", {
			cls: "umos-home-prayer-next umos-home-prayer-all-done",
			parent: section,
		});
		createElement("span", { text: "✅", parent: card });
		createElement("span", { cls: "umos-home-prayer-done-text", text: "Все намазы совершены", parent: card });
	}

	// Prayer timeline — all times in a row
	if (times) {
		const timeline = createElement("div", {
			cls: "umos-home-prayer-timeline",
			parent: section,
		});

		const prayers = showSunrise
			? PrayerService.getPrayerOrder()
			: PrayerService.getObligatoryPrayers();

		for (const name of prayers) {
			const status = statuses[name] || "upcoming";
			const time = times[name as keyof typeof times];
			if (!time) continue;

			const pill = createElement("div", {
				cls: `umos-home-prayer-pill umos-home-prayer-pill-${status}`,
				parent: timeline,
			});

			createElement("span", {
				cls: "umos-home-prayer-pill-name",
				text: PrayerService.getPrayerNameRu(name),
				parent: pill,
			});
			createElement("span", {
				cls: "umos-home-prayer-pill-time",
				text: time,
				parent: pill,
			});
		}
	}

	return countdownEl;
}

export function updatePrayerCountdown(el: HTMLElement, ctx: HomeViewContext): void {
	if (!ctx.prayerService) return;
	const next = ctx.prayerService.getNextPrayer();
	if (next) {
		el.textContent = `через ${formatCountdown(next.minutesLeft)}`;
	}
}
