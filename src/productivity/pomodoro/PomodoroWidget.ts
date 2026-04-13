import { EventBus } from "../../EventBus";
import { BaseWidget, EventSubscription } from "../../core/BaseWidget";
import { PomodoroService } from "./PomodoroService";
import { createElement } from "../../utils/dom";
import { renderSparkline } from "../../stats/Charts";

export interface PomodoroWidgetConfig {
	style: "full" | "compact";
}

export class PomodoroWidget extends BaseWidget {
	protected eventBus: EventBus;
	private pomodoroService: PomodoroService;
	private config: PomodoroWidgetConfig;
	private tickInterval: number | null = null;

	constructor(
		containerEl: HTMLElement,
		config: PomodoroWidgetConfig,
		eventBus: EventBus,
		pomodoroService: PomodoroService
	) {
		super(containerEl);
		this.eventBus = eventBus;
		this.pomodoroService = pomodoroService;
		this.config = config;
	}

	protected subscribeToEvents(): EventSubscription[] {
		return [{ event: "pomodoro:state-changed", handler: () => this.render() }];
	}

	protected onWidgetLoad(): void {
		this.tickInterval = window.setInterval(() => this.render(), 1000);
	}

	protected onWidgetUnload(): void {
		if (this.tickInterval !== null) {
			window.clearInterval(this.tickInterval);
			this.tickInterval = null;
		}
	}

	protected render(): void {
		this.containerEl.empty();

		const status = this.pomodoroService.getStatus();

		const wrapper = createElement("div", {
			cls: "umos-pomodoro-widget",
			parent: this.containerEl,
		});

		// State label
		const stateLabels: Record<string, string> = {
			idle: "Готов",
			work: "Работа",
			break: "Перерыв",
		};

		const stateLabel = stateLabels[status.state] || "Готов";
		const stateCls = `umos-pomodoro-state umos-pomodoro-state--${status.state}`;

		createElement("div", {
			cls: stateCls,
			text: stateLabel,
			parent: wrapper,
		});

		// Timer display
		const minutes = Math.floor(status.timeLeftSeconds / 60);
		const seconds = status.timeLeftSeconds % 60;
		const timeStr = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

		const timerEl = createElement("div", {
			cls: `umos-pomodoro-timer${status.isRunning && status.state === "work" ? " umos-pomodoro-timer--pulse" : ""}`,
			text: timeStr,
			parent: wrapper,
		});

		// Session counter
		const interval = this.pomodoroService.getLongBreakInterval();
		const sessionInCycle = ((status.currentSession - 1) % interval) + 1;
		createElement("div", {
			cls: "umos-pomodoro-session",
			text: `Сессия ${sessionInCycle}/${interval}`,
			parent: wrapper,
		});

		// Controls
		const controls = createElement("div", {
			cls: "umos-pomodoro-controls",
			parent: wrapper,
		});

		if (status.state === "idle") {
			const startBtn = createElement("button", {
				cls: "umos-pomodoro-btn umos-pomodoro-btn--start",
				text: "▶ Старт",
				parent: controls,
			});
			startBtn.addEventListener("click", () => {
				this.pomodoroService.start();
			});
		} else {
			if (status.isRunning) {
				const pauseBtn = createElement("button", {
					cls: "umos-pomodoro-btn umos-pomodoro-btn--pause",
					text: "⏸ Пауза",
					parent: controls,
				});
				pauseBtn.addEventListener("click", () => {
					this.pomodoroService.pause();
				});
			} else {
				const resumeBtn = createElement("button", {
					cls: "umos-pomodoro-btn umos-pomodoro-btn--start",
					text: "▶ Продолжить",
					parent: controls,
				});
				resumeBtn.addEventListener("click", () => {
					this.pomodoroService.resume();
				});
			}

			const skipBtn = createElement("button", {
				cls: "umos-pomodoro-btn umos-pomodoro-btn--skip",
				text: "⏭ Пропустить",
				parent: controls,
			});
			skipBtn.addEventListener("click", () => {
				this.pomodoroService.skip();
			});

			const resetBtn = createElement("button", {
				cls: "umos-pomodoro-btn umos-pomodoro-btn--reset",
				text: "↺ Сброс",
				parent: controls,
			});
			resetBtn.addEventListener("click", () => {
				this.pomodoroService.reset();
			});
		}

		// Stats
		if (this.config.style === "full") {
			const stats = createElement("div", {
				cls: "umos-pomodoro-stats",
				parent: wrapper,
			});

			this.renderStatItem(stats, "Сегодня", String(status.completedToday));
			this.renderStatItem(stats, "Неделя", String(status.completedThisWeek));
			this.renderStatItem(stats, "Всего", String(status.totalCompleted));

			// Sparkline за последние 14 дней
			const history = this.pomodoroService.getDailyHistory(14);
			const values = history.map(d => d.count);
			const hasData = values.some(v => v > 0);
			if (hasData) {
				const sparkWrap = createElement("div", {
					cls: "umos-pomodoro-sparkline",
					parent: wrapper,
				});
				createElement("div", {
					cls: "umos-pomodoro-sparkline-label",
					text: "14 дней",
					parent: sparkWrap,
				});
				const sparkContainer = createElement("div", {
					cls: "umos-pomodoro-sparkline-chart",
					parent: sparkWrap,
				});
				renderSparkline(sparkContainer, values, {
					width: 200,
					height: 32,
					color: "var(--umos-accent)",
				});
			}
		}
	}

	private renderStatItem(parent: HTMLElement, label: string, value: string): void {
		const item = createElement("div", {
			cls: "umos-pomodoro-stat-item",
			parent,
		});
		createElement("div", { cls: "umos-pomodoro-stat-value", text: value, parent: item });
		createElement("div", { cls: "umos-pomodoro-stat-label", text: label, parent: item });
	}
}
