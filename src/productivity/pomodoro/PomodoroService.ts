import { EventBus } from "../../EventBus";
import { UmOSSettings, PomodoroData } from "../../settings/Settings";

export type PomodoroState = "idle" | "work" | "break";

export interface PomodoroStatus {
	state: PomodoroState;
	timeLeftSeconds: number;
	currentSession: number;
	isRunning: boolean;
	completedToday: number;
	completedThisWeek: number;
	totalCompleted: number;
}

export class PomodoroService {
	private eventBus: EventBus;
	private settings: UmOSSettings;
	private getData: () => PomodoroData;
	private saveData: (data: Partial<PomodoroData>) => Promise<void>;

	private state: PomodoroState = "idle";
	private timeLeftSeconds = 0;
	private currentSession = 1;
	private isRunning = false;
	private tickInterval: number | null = null;

	constructor(
		eventBus: EventBus,
		settings: UmOSSettings,
		getData: () => PomodoroData,
		saveData: (data: Partial<PomodoroData>) => Promise<void>
	) {
		this.eventBus = eventBus;
		this.settings = settings;
		this.getData = getData;
		this.saveData = saveData;
		this.timeLeftSeconds = settings.pomodoroWorkMinutes * 60;
	}

	start(): void {
		if (this.isRunning) return;

		if (this.state === "idle") {
			this.state = "work";
			this.timeLeftSeconds = this.settings.pomodoroWorkMinutes * 60;
		}

		this.isRunning = true;
		this.startTick();
		this.eventBus.emit("pomodoro:state-changed", { state: this.state });
	}

	pause(): void {
		this.isRunning = false;
		this.stopTick();
		this.eventBus.emit("pomodoro:state-changed", { state: this.state });
	}

	resume(): void {
		if (this.state === "idle") return;
		this.isRunning = true;
		this.startTick();
		this.eventBus.emit("pomodoro:state-changed", { state: this.state });
	}

	reset(): void {
		this.stopTick();
		this.state = "idle";
		this.isRunning = false;
		this.currentSession = 1;
		this.timeLeftSeconds = this.settings.pomodoroWorkMinutes * 60;
		this.eventBus.emit("pomodoro:state-changed", { state: this.state });
	}

	skip(): void {
		this.stopTick();
		if (this.state === "work") {
			this.completeWorkSession();
		} else if (this.state === "break") {
			this.state = "work";
			this.timeLeftSeconds = this.settings.pomodoroWorkMinutes * 60;
		}
		if (this.isRunning) {
			this.startTick();
		}
		this.eventBus.emit("pomodoro:state-changed", { state: this.state });
	}

	toggle(): void {
		if (this.isRunning) {
			this.pause();
		} else {
			if (this.state === "idle") {
				this.start();
			} else {
				this.resume();
			}
		}
	}

	getStatus(): PomodoroStatus {
		this.ensureTodayReset();
		const data = this.getData();
		return {
			state: this.state,
			timeLeftSeconds: this.timeLeftSeconds,
			currentSession: this.currentSession,
			isRunning: this.isRunning,
			completedToday: data.completedToday,
			completedThisWeek: data.completedThisWeek,
			totalCompleted: data.totalCompleted,
		};
	}

	destroy(): void {
		this.stopTick();
	}

	private startTick(): void {
		this.stopTick();
		this.tickInterval = window.setInterval(() => this.tick(), 1000);
	}

	private stopTick(): void {
		if (this.tickInterval !== null) {
			window.clearInterval(this.tickInterval);
			this.tickInterval = null;
		}
	}

	private tick(): void {
		if (!this.isRunning) return;

		this.timeLeftSeconds--;

		if (this.timeLeftSeconds <= 0) {
			if (this.state === "work") {
				this.completeWorkSession();
			} else if (this.state === "break") {
				this.state = "work";
				this.timeLeftSeconds = this.settings.pomodoroWorkMinutes * 60;
			}
			this.eventBus.emit("pomodoro:state-changed", { state: this.state });
		}
	}

	getDailyHistory(days: number): { date: string; count: number }[] {
		const data = this.getData();
		const history = data.dailyHistory ?? {};
		const result: { date: string; count: number }[] = [];
		const now = new Date();
		for (let i = days - 1; i >= 0; i--) {
			const d = new Date(now);
			d.setDate(d.getDate() - i);
			const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
			result.push({ date: dateStr, count: history[dateStr] ?? 0 });
		}
		return result;
	}

	private completeWorkSession(): void {
		this.ensureTodayReset();
		const data = this.getData();

		const today = this.getTodayStr();
		const newToday = data.completedToday + 1;
		const newWeek = data.completedThisWeek + 1;
		const newTotal = data.totalCompleted + 1;

		const dailyHistory = { ...(data.dailyHistory ?? {}) };
		dailyHistory[today] = newToday;

		this.saveData({
			completedToday: newToday,
			todayDate: today,
			completedThisWeek: newWeek,
			weekStart: data.weekStart || this.getWeekStartStr(),
			totalCompleted: newTotal,
			dailyHistory,
		});

		this.eventBus.emit("pomodoro:completed", { date: today, count: newToday });

		// Switch to break
		const isLongBreak = this.currentSession % this.settings.pomodoroLongBreakInterval === 0;
		this.state = "break";
		this.timeLeftSeconds = isLongBreak
			? this.settings.pomodoroLongBreakMinutes * 60
			: this.settings.pomodoroBreakMinutes * 60;
		this.currentSession++;
	}

	private ensureTodayReset(): void {
		const data = this.getData();
		const today = this.getTodayStr();
		const weekStart = this.getWeekStartStr();

		let needsSave = false;
		const updates: Partial<PomodoroData> = {};

		if (data.todayDate !== today) {
			updates.completedToday = 0;
			updates.todayDate = today;
			needsSave = true;
		}

		if (data.weekStart !== weekStart) {
			updates.completedThisWeek = 0;
			updates.weekStart = weekStart;
			needsSave = true;
		}

		if (needsSave) {
			this.saveData(updates);
		}
	}

	getLongBreakInterval(): number {
		return this.settings.pomodoroLongBreakInterval;
	}

	private getTodayStr(): string {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
	}

	private getWeekStartStr(): string {
		const d = new Date();
		const day = d.getDay();
		const diff = d.getDate() - day + (day === 0 ? -6 : 1);
		const monday = new Date(d.setDate(diff));
		return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
	}
}
