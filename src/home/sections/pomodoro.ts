import { HomeViewContext } from "../types";
import { createElement } from "../../utils/dom";

export function renderPomodoroSection(parent: HTMLElement, ctx: HomeViewContext): HTMLElement | null {
	if (!ctx.pomodoroService) return null;

	const section = createElement("div", {
		cls: "umos-home-section umos-home-section-anim",
		parent,
	});

	const status = ctx.pomodoroService.getStatus();

	const titleRow = createElement("div", {
		cls: "umos-home-section-title",
		parent: section,
	});
	titleRow.textContent = "🍅 Помодоро";

	let pomodoroTimerEl: HTMLElement | null = null;

	if (status.state !== "idle") {
		const stateLabels: Record<string, string> = { work: "Работа", break: "Перерыв" };
		const minutes = Math.floor(status.timeLeftSeconds / 60);
		const seconds = status.timeLeftSeconds % 60;
		const timeStr = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

		const timerCard = createElement("div", {
			cls: `umos-home-pomodoro-timer-card umos-home-pomodoro-timer-card--${status.state}`,
			parent: section,
		});

		createElement("span", {
			cls: "umos-home-pomodoro-state",
			text: stateLabels[status.state] || "",
			parent: timerCard,
		});

		pomodoroTimerEl = createElement("span", {
			cls: "umos-home-pomodoro-time",
			text: timeStr,
			parent: timerCard,
		});

		const controls = createElement("div", {
			cls: "umos-home-pomodoro-controls",
			parent: timerCard,
		});

		const toggleBtn = createElement("button", {
			cls: "umos-home-pomodoro-btn",
			text: status.isRunning ? "⏸ Пауза" : "▶ Продолжить",
			parent: controls,
		});
		toggleBtn.addEventListener("click", () => {
			ctx.pomodoroService?.toggle();
		});

		const resetBtn = createElement("button", {
			cls: "umos-home-pomodoro-btn umos-home-pomodoro-btn--reset",
			text: "✕ Сбросить",
			parent: controls,
		});
		resetBtn.addEventListener("click", () => {
			ctx.pomodoroService?.reset();
		});
	} else {
		pomodoroTimerEl = null;
		const startBtn = createElement("button", {
			cls: "umos-home-pomodoro-btn umos-home-pomodoro-btn--start",
			text: "▶ Начать сессию",
			parent: section,
		});
		startBtn.addEventListener("click", () => {
			ctx.pomodoroService?.start();
		});
	}

	const statsRow = createElement("div", {
		cls: "umos-home-pomodoro-stats",
		parent: section,
	});

	createElement("span", {
		text: `Сегодня: ${status.completedToday}`,
		parent: statsRow,
	});

	createElement("span", {
		text: `Неделя: ${status.completedThisWeek}`,
		parent: statsRow,
	});

	// Индикатор прогресса в текущем цикле (●●●○)
	const interval = ctx.pomodoroService.getLongBreakInterval();
	const sessionInCycle = ((status.currentSession - 1) % interval) + 1;
	const dotsRow = createElement("div", {
		cls: "umos-home-pomodoro-dots",
		parent: section,
	});
	for (let i = 1; i <= interval; i++) {
		createElement("span", {
			cls: `umos-home-pomodoro-dot${i < sessionInCycle ? " umos-home-pomodoro-dot--done" : i === sessionInCycle && status.state !== "idle" ? " umos-home-pomodoro-dot--active" : ""}`,
			text: i < sessionInCycle ? "●" : i === sessionInCycle && status.state !== "idle" ? "●" : "○",
			parent: dotsRow,
		});
	}

	return pomodoroTimerEl;
}

export function updatePomodoroTimer(el: HTMLElement, ctx: HomeViewContext): void {
	if (!ctx.pomodoroService) return;
	const status = ctx.pomodoroService.getStatus();
	if (status.state === "idle") return;
	const minutes = Math.floor(status.timeLeftSeconds / 60);
	const seconds = status.timeLeftSeconds % 60;
	el.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
