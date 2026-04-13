import { HomeViewContext } from "../types";
import { createElement } from "../../utils/dom";
import { formatCountdown } from "../../utils/date";

function timeToMinutes(timeStr: string): number {
	const parts = timeStr.split(":");
	return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

export function renderRamadanSection(parent: HTMLElement, ctx: HomeViewContext): void {
	if (!ctx.prayerService || !ctx.prayerService.isRamadan()) return;

	const section = createElement("div", {
		cls: "umos-home-section umos-home-section-anim",
		parent,
	});

	const hijriDay = ctx.prayerService.getHijriDay();

	const titleRow = createElement("div", {
		cls: "umos-home-section-title",
		parent: section,
	});
	titleRow.textContent = `🌙 Рамадан — День ${hijriDay} из 30`;

	// Countdown to iftar
	const times = ctx.prayerService.getTimes();
	if (times) {
		const now = new Date();
		const currentMinutes = now.getHours() * 60 + now.getMinutes();
		const iftarMinutes = timeToMinutes(times.Maghrib);

		if (currentMinutes < iftarMinutes) {
			const diff = iftarMinutes - currentMinutes;
			createElement("div", {
				cls: "umos-home-ramadan-countdown",
				text: `До ифтара: ${formatCountdown(diff)}`,
				parent: section,
			});
		}
	}

	// Mini progress
	const data = ctx.getData();
	const fastCount = Object.values(data.ramadan.fastTracker).filter(Boolean).length;
	const tarawihCount = Object.values(data.ramadan.tarawihTracker).filter(Boolean).length;

	const statsRow = createElement("div", {
		cls: "umos-home-ramadan-stats",
		parent: section,
	});

	createElement("span", {
		text: `🕌 Пост: ${fastCount}/30`,
		parent: statsRow,
	});

	createElement("span", {
		text: `🤲 Таравих: ${tarawihCount}/30`,
		parent: statsRow,
	});
}
