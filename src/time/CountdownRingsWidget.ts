import { BaseWidget } from "../core/BaseWidget";
import { createElement, createErrorMessage, createSvgElement } from "../utils/dom";

export interface CountdownRingsWidgetConfig {
	target?: string;
	date?: string;
	title?: string;
	accent?: string;
	layout?: "grid" | "nested";
	nested?: boolean;
	view?: "full" | "focus" | "minimal";
	legend?: boolean;
	showLegend?: boolean;
}

type CountdownLayoutMode = "grid" | "nested";
type CountdownNestedViewMode = "full" | "focus" | "minimal";

type CountdownUnitKey =
	| "years"
	| "months"
	| "weeks"
	| "days"
	| "hours"
	| "minutes"
	| "seconds";

interface CountdownBreakdown {
	years: number;
	months: number;
	weeks: number;
	days: number;
	hours: number;
	minutes: number;
	seconds: number;
	finished: boolean;
}

interface CountdownResolution {
	date: Date | null;
	raw: string;
	includesTime: boolean;
}

interface CountdownUnitDisplay {
	key: CountdownUnitKey;
	label: string;
	value: number;
	max: number;
	progress: number;
	color: string;
}

interface CountdownNestedView {
	mode: CountdownNestedViewMode;
	showLegend: boolean;
}

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

const UNIT_COLORS: Record<CountdownUnitKey, string> = {
	years: "#f59e0b",
	months: "#f97316",
	weeks: "#22c55e",
	days: "#14b8a6",
	hours: "#0ea5e9",
	minutes: "#3b82f6",
	seconds: "#ec4899",
};

export class CountdownRingsWidget extends BaseWidget {
	private config: CountdownRingsWidgetConfig;
	private tickInterval: number | null = null;
	private target: CountdownResolution;
	private yearsMax: number;

	constructor(containerEl: HTMLElement, config: CountdownRingsWidgetConfig) {
		super(containerEl);
		this.config = config;
		this.target = resolveTarget(config);
		this.yearsMax = 1;

		if (this.target.date) {
			const initial = getCountdownBreakdown(new Date(), this.target.date);
			this.yearsMax = Math.max(1, initial.years || 1);
		}
	}

	protected render(): void {
		this.renderCountdown();
	}

	protected onWidgetLoad(): void {
		if (!this.target.date) return;
		this.tickInterval = window.setInterval(() => this.renderCountdown(), 1000);
	}

	protected onWidgetUnload(): void {
		if (this.tickInterval !== null) {
			window.clearInterval(this.tickInterval);
			this.tickInterval = null;
		}
	}

	private renderCountdown(): void {
		this.containerEl.empty();

		if (!this.target.raw) {
			createErrorMessage(
				this.containerEl,
				"For countdown, set date: YYYY-MM-DD or target: YYYY-MM-DD HH:mm"
			);
			return;
		}

		if (!this.target.date) {
			createErrorMessage(
				this.containerEl,
				`Could not parse date: ${this.target.raw}`
			);
			return;
		}

		const breakdown = getCountdownBreakdown(new Date(), this.target.date);
		if (breakdown.finished && this.tickInterval !== null) {
			window.clearInterval(this.tickInterval);
			this.tickInterval = null;
		}
		const layout = this.getLayoutMode();

		const wrapper = createElement("div", {
			cls: `umos-countdown-widget umos-countdown-widget--${layout}${breakdown.finished ? " is-finished" : ""}`,
			parent: this.containerEl,
		});

		const accent = typeof this.config.accent === "string" && this.config.accent.trim()
			? this.config.accent.trim()
			: "";
		if (accent) {
			wrapper.style.setProperty("--umos-countdown-highlight", accent);
		}

		const header = createElement("div", {
			cls: "umos-countdown-header",
			parent: wrapper,
		});

		createElement("div", {
			cls: "umos-countdown-title",
			text: typeof this.config.title === "string" && this.config.title.trim()
				? this.config.title.trim()
				: "Countdown",
			parent: header,
		});

		createElement("div", {
			cls: "umos-countdown-target",
			text: formatTargetDate(this.target.date, this.target.includesTime),
			parent: header,
		});

		createElement("div", {
			cls: "umos-countdown-status",
			text: breakdown.finished ? "Event reached" : "Time to target",
			parent: header,
		});

		const rings = createElement("div", {
			cls: `umos-countdown-rings umos-countdown-rings--${layout}`,
			parent: wrapper,
		});

		const units = buildUnitDisplay(breakdown, this.yearsMax);
		if (layout === "nested") {
			this.renderNestedRings(rings, units, breakdown);
			return;
		}

		for (const unit of units) {
			this.renderRing(rings, unit);
		}
	}

	private getLayoutMode(): CountdownLayoutMode {
		if (this.config.nested === true) return "nested";
		if (this.config.layout === "nested") return "nested";
		return "grid";
	}

	private getNestedView(): CountdownNestedView {
		const mode = this.config.view ?? "full";
		let showLegend = mode === "full";

		if (typeof this.config.legend === "boolean") {
			showLegend = this.config.legend;
		}
		if (typeof this.config.showLegend === "boolean") {
			showLegend = this.config.showLegend;
		}

		return { mode, showLegend };
	}

	private renderRing(parent: HTMLElement, unit: CountdownUnitDisplay): void {
		const card = createElement("div", {
			cls: `umos-countdown-ring-card umos-countdown-ring-card--${unit.key}`,
			parent,
		});
		card.style.setProperty("--umos-countdown-accent", unit.color);

		const ring = createElement("div", {
			cls: "umos-countdown-ring",
			parent: card,
		});
		ring.style.setProperty("--umos-countdown-progress", unit.progress.toFixed(4));

		const svg = createSvgElement(
			"svg",
			{
				viewBox: "0 0 120 120",
				class: "umos-countdown-ring-svg",
				"aria-hidden": "true",
			},
			ring
		);
		const radius = 46;
		const circumference = 2 * Math.PI * radius;
		const dashOffset = circumference * (1 - unit.progress);

		createSvgElement("circle", {
			cx: "60",
			cy: "60",
			r: String(radius),
			class: "umos-countdown-ring-track",
		}, svg);
		createSvgElement("circle", {
			cx: "60",
			cy: "60",
			r: String(radius),
			class: "umos-countdown-ring-progress",
			style: `stroke-dasharray:${circumference};stroke-dashoffset:${dashOffset};`,
		}, svg);

		const center = createElement("div", {
			cls: "umos-countdown-ring-center",
			parent: ring,
		});

		createElement("div", {
			cls: "umos-countdown-ring-value",
			text: formatUnitValue(unit),
			parent: center,
		});

		createElement("div", {
			cls: "umos-countdown-ring-label",
			text: unit.label,
			parent: card,
		});
	}

	private renderNestedRings(
		parent: HTMLElement,
		units: CountdownUnitDisplay[],
		breakdown: CountdownBreakdown
	): void {
		const nestedView = this.getNestedView();
		const card = createElement("div", {
			cls: `umos-countdown-nested-card umos-countdown-nested-card--${nestedView.mode}${nestedView.showLegend ? "" : " is-legend-hidden"}`,
			parent,
		});

		const visual = createElement("div", {
			cls: "umos-countdown-nested-visual",
			parent: card,
		});

		const svg = createSvgElement(
			"svg",
			{
				viewBox: "0 0 360 360",
				class: "umos-countdown-nested-svg",
				"aria-hidden": "true",
			},
			visual
		);

		const baseRadius = 154;
		const step = 13;
		const strokeWidth = 6;

		for (const [index, unit] of units.entries()) {
			const radius = baseRadius - index * step;
			this.renderNestedCircle(svg, unit, radius, strokeWidth);
		}

		const center = createElement("div", {
			cls: "umos-countdown-nested-center",
			parent: visual,
		});
		center.style.setProperty("--umos-countdown-center-glow", units[0]?.color ?? "#f59e0b");

		createElement("div", {
			cls: "umos-countdown-nested-center-orbit",
			parent: center,
		});

		const centerStack = createElement("div", {
			cls: "umos-countdown-nested-center-stack",
			parent: center,
		});

		createElement("div", {
			cls: "umos-countdown-nested-center-title",
			text: breakdown.finished ? "Event" : "Remaining",
			parent: centerStack,
		});

		const centerSummary = getCenterSummary(units, breakdown);
		const valueWrap = createElement("div", {
			cls: "umos-countdown-nested-center-value",
			parent: centerStack,
		});

		createElement("div", {
			cls: "umos-countdown-nested-center-primary-value",
			text: centerSummary.primaryValue,
			parent: valueWrap,
		});

		createElement("div", {
			cls: "umos-countdown-nested-center-primary-label",
			text: centerSummary.primaryLabel,
			parent: valueWrap,
		});

		if (centerSummary.secondary.length > 0) {
			createElement("div", {
				cls: "umos-countdown-nested-center-secondary",
				text: centerSummary.secondary
					.map((item) => `${item.value} ${item.label}`)
					.join(" · "),
				parent: centerStack,
			});
		}

		if (!nestedView.showLegend) {
			return;
		}

		const legend = createElement("div", {
			cls: "umos-countdown-nested-legend",
			parent: card,
		});

		for (const [index, unit] of units.entries()) {
			const item = createElement("div", {
				cls: `umos-countdown-nested-legend-item${units.length % 2 === 1 && index === units.length - 1 ? " is-last-single" : ""}`,
				parent: legend,
			});
			item.style.setProperty("--umos-countdown-accent", unit.color);
			item.style.setProperty("--umos-countdown-progress", unit.progress.toFixed(4));

			createElement("div", {
				cls: "umos-countdown-nested-legend-dot",
				parent: item,
			});

			const text = createElement("div", {
				cls: "umos-countdown-nested-legend-text",
				parent: item,
			});

			createElement("div", {
				cls: "umos-countdown-nested-legend-value",
				text: formatUnitValue(unit),
				parent: text,
			});

			createElement("div", {
				cls: "umos-countdown-nested-legend-label",
				text: unit.label,
				parent: text,
			});
		}
	}

	private renderNestedCircle(
		svg: SVGElement,
		unit: CountdownUnitDisplay,
		radius: number,
		strokeWidth: number
	): void {
		const circumference = 2 * Math.PI * radius;
		const dashOffset = circumference * (1 - unit.progress);

		createSvgElement("circle", {
			cx: "180",
			cy: "180",
			r: String(radius),
			class: "umos-countdown-nested-track",
			style: `stroke-width:${strokeWidth};`,
		}, svg);

		createSvgElement("circle", {
			cx: "180",
			cy: "180",
			r: String(radius),
			class: "umos-countdown-nested-progress",
			style: `stroke:${unit.color};stroke-width:${strokeWidth};stroke-dasharray:${circumference};stroke-dashoffset:${dashOffset};filter:drop-shadow(0 0 8px ${unit.color}55);`,
		}, svg);
	}
}

function resolveTarget(config: CountdownRingsWidgetConfig): CountdownResolution {
	const raw = typeof config.target === "string" && config.target.trim()
		? config.target.trim()
		: typeof config.date === "string" && config.date.trim()
			? config.date.trim()
			: "";

	return {
		date: raw ? parseTargetDate(raw) : null,
		raw,
		includesTime: /(?:[ T]\d{1,2}:\d{2})|(?:T\d{2}:?\d{2})/.test(raw),
	};
}

function parseTargetDate(raw: string): Date | null {
	const direct = raw.trim();
	if (!direct) return null;

	if (/([zZ]|[+\-]\d{2}:\d{2})$/.test(direct)) {
		const withTimezone = new Date(direct);
		return Number.isNaN(withTimezone.getTime()) ? null : withTimezone;
	}

	const match = direct.match(
		/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T](\d{1,2})(?::(\d{1,2})(?::(\d{1,2}))?)?)?$/
	);
	if (match) {
		const year = Number(match[1]);
		const month = Number(match[2]) - 1;
		const day = Number(match[3]);
		const hours = Number(match[4] || 0);
		const minutes = Number(match[5] || 0);
		const seconds = Number(match[6] || 0);
		const parsed = new Date(year, month, day, hours, minutes, seconds, 0);

		if (
			parsed.getFullYear() === year &&
			parsed.getMonth() === month &&
			parsed.getDate() === day &&
			parsed.getHours() === hours &&
			parsed.getMinutes() === minutes &&
			parsed.getSeconds() === seconds
		) {
			return parsed;
		}
		return null;
	}

	const fallback = new Date(direct);
	return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function getCountdownBreakdown(now: Date, target: Date): CountdownBreakdown {
	if (target.getTime() <= now.getTime()) {
		return {
			years: 0,
			months: 0,
			weeks: 0,
			days: 0,
			hours: 0,
			minutes: 0,
			seconds: 0,
			finished: true,
		};
	}

	let years = Math.max(0, target.getFullYear() - now.getFullYear());
	while (years > 0 && addYears(now, years).getTime() > target.getTime()) {
		years -= 1;
	}

	let cursor = addYears(now, years);
	let months = Math.max(
		0,
		(target.getFullYear() - cursor.getFullYear()) * 12 + (target.getMonth() - cursor.getMonth())
	);
	while (months > 0 && addMonths(cursor, months).getTime() > target.getTime()) {
		months -= 1;
	}

	cursor = addMonths(cursor, months);

	let remainingMs = target.getTime() - cursor.getTime();
	const weeks = Math.floor(remainingMs / WEEK_MS);
	remainingMs -= weeks * WEEK_MS;
	const days = Math.floor(remainingMs / DAY_MS);
	remainingMs -= days * DAY_MS;
	const hours = Math.floor(remainingMs / HOUR_MS);
	remainingMs -= hours * HOUR_MS;
	const minutes = Math.floor(remainingMs / MINUTE_MS);
	remainingMs -= minutes * MINUTE_MS;
	const seconds = Math.floor(remainingMs / SECOND_MS);

	return {
		years,
		months,
		weeks,
		days,
		hours,
		minutes,
		seconds,
		finished: false,
	};
}

function buildUnitDisplay(
	breakdown: CountdownBreakdown,
	yearsMax: number
): CountdownUnitDisplay[] {
	const yearsProgress = clamp01((breakdown.years + breakdown.months / 12) / yearsMax);
	const monthsProgress = clamp01(
		(breakdown.months + breakdown.weeks / 4 + breakdown.days / 30) / 12
	);
	const weeksProgress = clamp01((breakdown.weeks + breakdown.days / 7) / 4);
	const daysProgress = clamp01((breakdown.days + breakdown.hours / 24) / 7);
	const hoursProgress = clamp01((breakdown.hours + breakdown.minutes / 60) / 24);
	const minutesProgress = clamp01((breakdown.minutes + breakdown.seconds / 60) / 60);
	const secondsProgress = clamp01(breakdown.seconds / 60);

	return [
		makeUnit("years", "years", breakdown.years, yearsMax, yearsProgress),
		makeUnit("months", "months", breakdown.months, 12, monthsProgress),
		makeUnit("weeks", "weeks", breakdown.weeks, 4, weeksProgress),
		makeUnit("days", "days", breakdown.days, 7, daysProgress),
		makeUnit("hours", "hours", breakdown.hours, 24, hoursProgress),
		makeUnit("minutes", "minutes", breakdown.minutes, 60, minutesProgress),
		makeUnit("seconds", "seconds", breakdown.seconds, 60, secondsProgress),
	];
}

function makeUnit(
	key: CountdownUnitKey,
	label: string,
	value: number,
	max: number,
	progress: number
): CountdownUnitDisplay {
	return {
		key,
		label,
		value,
		max,
		progress,
		color: UNIT_COLORS[key],
	};
}

function formatUnitValue(unit: CountdownUnitDisplay): string {
	return String(unit.value).padStart(
		unit.key === "hours" || unit.key === "minutes" || unit.key === "seconds" ? 2 : 1,
		"0"
	);
}

function getCenterSummary(
	units: CountdownUnitDisplay[],
	breakdown: CountdownBreakdown
): {
	primaryValue: string;
	primaryLabel: string;
	secondary: Array<{ value: string; label: string }>;
} {
	if (breakdown.finished) {
		return {
			primaryValue: "00",
			primaryLabel: "sec",
			secondary: [],
		};
	}

	const majorUnits = units.filter((unit) => unit.value > 0);
	const primary = majorUnits[0] ?? units[units.length - 1];
	const secondaryUnits = majorUnits.slice(1, 3);

	return {
		primaryValue: formatUnitValue(primary),
		primaryLabel: getShortUnitLabel(primary.key),
		secondary: secondaryUnits.map((unit) => ({
			value: formatUnitValue(unit),
			label: getShortUnitLabel(unit.key),
		})),
	};
}

function getShortUnitLabel(key: CountdownUnitKey): string {
	switch (key) {
		case "years":
			return "y";
		case "months":
			return "mo";
		case "weeks":
			return "wk";
		case "days":
			return "d";
		case "hours":
			return "h";
		case "minutes":
			return "min";
		case "seconds":
			return "sec";
	}
}

function formatTargetDate(date: Date, includesTime: boolean): string {
	const formatter = new Intl.DateTimeFormat("en-US", includesTime
		? { dateStyle: "long", timeStyle: "short" }
		: { dateStyle: "long" }
	);
	return formatter.format(date);
}

function addYears(date: Date, years: number): Date {
	const year = date.getFullYear() + years;
	const month = date.getMonth();
	const day = Math.min(date.getDate(), daysInMonth(year, month));
	return new Date(
		year,
		month,
		day,
		date.getHours(),
		date.getMinutes(),
		date.getSeconds(),
		date.getMilliseconds()
	);
}

function addMonths(date: Date, months: number): Date {
	const totalMonths = date.getMonth() + months;
	const year = date.getFullYear() + Math.floor(totalMonths / 12);
	const month = ((totalMonths % 12) + 12) % 12;
	const day = Math.min(date.getDate(), daysInMonth(year, month));
	return new Date(
		year,
		month,
		day,
		date.getHours(),
		date.getMinutes(),
		date.getSeconds(),
		date.getMilliseconds()
	);
}

function daysInMonth(year: number, month: number): number {
	return new Date(year, month + 1, 0).getDate();
}

function clamp01(value: number): number {
	if (value <= 0) return 0;
	if (value >= 1) return 1;
	return value;
}
