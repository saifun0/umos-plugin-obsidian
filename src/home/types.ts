import { App } from "obsidian";
import { EventBus } from "../EventBus";
import { UmOSSettings, UmOSData } from "../settings/Settings";
import { PrayerService } from "../religion/prayer/PrayerService";
import { StatsEngine } from "../stats/StatsEngine";
import { PomodoroService } from "../productivity/pomodoro/PomodoroService";
import { ExamService } from "../productivity/exam/ExamService";
import { FinanceService } from "../finance/FinanceService";
import { WeatherService } from "../weather/WeatherService";
import { GoalsService } from "../productivity/goals/GoalsService";
import { BalanceService } from "../balance/BalanceService";

export interface ActiveContentItem {
	name: string;
	path: string;
	type: string;
	icon: string;
	current: number;
	total: number;
	unit: string;
	color: string;
}

export interface HomeViewContext {
	app: App;
	eventBus: EventBus;
	settings: UmOSSettings;
	getData: () => UmOSData;
	prayerService: PrayerService | null;
	statsEngine: StatsEngine | null;
	weatherService: WeatherService | null;
	financeService: FinanceService | null;
	examService: ExamService | null;
	pomodoroService: PomodoroService | null;
	goalsService: GoalsService | null;
	balanceService: BalanceService | null;
	saveSettings: (() => Promise<void>) | null;
	createDailyNote: (() => Promise<void>) | null;
}
