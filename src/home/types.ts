import { App } from "obsidian";
import { EventBus } from "../EventBus";
import { UmOSSettings, UmOSData } from "../settings/Settings";
import { PrayerService } from "../religion/prayer/PrayerService";
import { StatsEngine } from "../stats/StatsEngine";
import { WeatherService } from "../weather/WeatherService";

export interface ActiveContentItem {
	name: string;
	path: string;
	coverUrl?: string;
	type: string;
	icon: string;
	current: number;
	total: number;
	unit: string;
	color: string;
}

export interface RecentClosedNote {
	name: string;
	path: string;
	closedAt: number;
}

export interface HomeViewContext {
	app: App;
	eventBus: EventBus;
	settings: UmOSSettings;
	getData: () => UmOSData;
	prayerService: PrayerService | null;
	statsEngine: StatsEngine | null;
	weatherService: WeatherService | null;
	recentClosedNotes: RecentClosedNote[];
	saveSettings: (() => Promise<void>) | null;
	createDailyNote: (() => Promise<void>) | null;
	setPrayerCompletion: ((property: string, value: boolean) => Promise<void>) | null;
}
