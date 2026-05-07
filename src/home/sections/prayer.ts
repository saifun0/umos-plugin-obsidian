import { HomeViewContext } from "../types";
import { createElement } from "../../utils/dom";
import { formatCountdown, getTodayDateString } from "../../utils/date";
import { PrayerService } from "../../religion/prayer/PrayerService";
import type { PrayerTimesData } from "../../EventBus";

const PRAYER_COMPLETION_KEYS: Record<string, string> = {
	Fajr: "fajr",
	Dhuhr: "dhuhr",
	Asr: "asr",
	Maghrib: "maghrib",
	Isha: "isha",
};

interface PrayerCompletionState {
	completed: Set<string>;
	available: boolean;
	count: number;
	total: number;
}

function getTodayPrayerCompletion(ctx: HomeViewContext): PrayerCompletionState {
	const completed = new Set<string>();
	const today = getTodayDateString();
	let available = false;

	if (ctx.statsEngine) {
		for (const [prayerName, metricKey] of Object.entries(PRAYER_COMPLETION_KEYS)) {
			const value = ctx.statsEngine.getValueForDate(today, metricKey);
			if (value !== null) {
				available = true;
			}
			if (value !== null && value > 0) {
				completed.add(prayerName);
			}
		}
	}

	return {
		completed,
		available,
		count: completed.size,
		total: Object.keys(PRAYER_COMPLETION_KEYS).length,
	};
}

function getPrayerVisualStatus(
	name: string,
	timeStatus: "passed" | "next" | "upcoming" | "info",
	completion: PrayerCompletionState,
): "completed" | "missed" | "passed" | "next" | "upcoming" | "info" {
	if (completion.completed.has(name)) {
		return "completed";
	}

	if (completion.available && name in PRAYER_COMPLETION_KEYS && timeStatus === "passed") {
		return "missed";
	}

	return timeStatus;
}

function timeToMinutes(timeStr: string): number {
	const [hours, minutes] = timeStr.split(":").map(Number);
	if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;
	return hours * 60 + minutes;
}

function getMinutesUntilTomorrowTime(timeStr: string): number {
	const now = new Date();
	const currentMinutes = now.getHours() * 60 + now.getMinutes();
	return 24 * 60 - currentMinutes + timeToMinutes(timeStr);
}

function getNextFajrAfterCompleted(
	times: PrayerTimesData | null,
	completion: PrayerCompletionState,
): { name: string; nameRu: string; icon: string; time: string; minutesLeft: number } | null {
	if (!times || !completion.available || completion.count !== completion.total || !times.Fajr) {
		return null;
	}

	return {
		name: "Fajr",
		nameRu: PrayerService.getPrayerNameRu("Fajr"),
		icon: PrayerService.getPrayerIcon("Fajr"),
		time: times.Fajr,
		minutesLeft: getMinutesUntilTomorrowTime(times.Fajr),
	};
}

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
	const completion = getTodayPrayerCompletion(ctx);
	const nextFajrAfterCompleted = getNextFajrAfterCompleted(times, completion);

	let countdownEl: HTMLElement | null = null;

	// Next prayer highlight card
	if (nextFajrAfterCompleted) {
		const card = createElement("div", {
			cls: "umos-home-prayer-next",
			parent: section,
		});

		const left = createElement("div", { cls: "umos-home-prayer-next-left", parent: card });
		createElement("span", {
			cls: "umos-home-prayer-next-icon",
			text: nextFajrAfterCompleted.icon,
			parent: left,
		});
		const info = createElement("div", { cls: "umos-home-prayer-next-info", parent: left });
		createElement("span", {
			cls: "umos-home-prayer-next-name",
			text: nextFajrAfterCompleted.nameRu,
			parent: info,
		});
		createElement("span", {
			cls: "umos-home-prayer-next-time",
			text: nextFajrAfterCompleted.time,
			parent: info,
		});

		countdownEl = createElement("div", {
			cls: "umos-home-prayer-next-countdown",
			text: `in ${formatCountdown(nextFajrAfterCompleted.minutesLeft)}`,
			parent: card,
		});
	} else if (next) {
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
			text: `in ${formatCountdown(next.minutesLeft)}`,
			parent: card,
		});
	} else if (ctx.prayerService.allPrayersDone()) {
		let pendingPrayer: string | null = null;
		if (times && completion.available) {
			const currentTimes = times;
			pendingPrayer = PrayerService.getObligatoryPrayers().find(
				(name) => !completion.completed.has(name) && Boolean(currentTimes[name])
			) ?? null;
		}

		if (pendingPrayer && times) {
			const card = createElement("div", {
				cls: "umos-home-prayer-next",
				parent: section,
			});

			const left = createElement("div", { cls: "umos-home-prayer-next-left", parent: card });
			createElement("span", {
				cls: "umos-home-prayer-next-icon",
				text: PrayerService.getPrayerIcon(pendingPrayer),
				parent: left,
			});
			const info = createElement("div", { cls: "umos-home-prayer-next-info", parent: left });
			createElement("span", {
				cls: "umos-home-prayer-next-name",
				text: PrayerService.getPrayerNameRu(pendingPrayer),
				parent: info,
			});
			createElement("span", {
				cls: "umos-home-prayer-next-time",
				text: times[pendingPrayer],
				parent: info,
			});
			createElement("div", {
				cls: "umos-home-prayer-next-countdown",
				text: "not checked",
				parent: card,
			});
		} else {
			const card = createElement("div", {
				cls: "umos-home-prayer-next umos-home-prayer-all-done",
				parent: section,
			});
			createElement("span", { text: "✅", parent: card });
			createElement("span", { cls: "umos-home-prayer-done-text", text: "All prayers completed", parent: card });
		}
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
			const visualStatus = getPrayerVisualStatus(name, status, completion);
			const time = times[name as keyof typeof times];
			if (!time) continue;
			const property = PRAYER_COMPLETION_KEYS[name];
			const isToggleable = Boolean(property && ctx.setPrayerCompletion);

			const pill = createElement(isToggleable ? "button" : "div", {
				cls: `umos-home-prayer-pill umos-home-prayer-pill-${visualStatus}${isToggleable ? " is-toggleable" : ""}`,
				attr: isToggleable ? {
					type: "button",
					"aria-pressed": String(completion.completed.has(name)),
					"aria-label": `${PrayerService.getPrayerNameRu(name)}: ${completion.completed.has(name) ? "checked" : "not checked"}`,
					title: completion.completed.has(name) ? "Uncheck" : "Mark as completed",
				} : undefined,
				parent: timeline,
			});

			if (isToggleable && property && ctx.setPrayerCompletion) {
				pill.addEventListener("click", () => {
					void ctx.setPrayerCompletion?.(property, !completion.completed.has(name));
				});
			}

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
	const completion = getTodayPrayerCompletion(ctx);
	const nextFajrAfterCompleted = getNextFajrAfterCompleted(ctx.prayerService.getTimes(), completion);
	if (nextFajrAfterCompleted) {
		el.textContent = `in ${formatCountdown(nextFajrAfterCompleted.minutesLeft)}`;
		return;
	}

	const next = ctx.prayerService.getNextPrayer();
	if (next) {
		el.textContent = `in ${formatCountdown(next.minutesLeft)}`;
	}
}
