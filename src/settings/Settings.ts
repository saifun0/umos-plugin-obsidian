import type { DashboardProfile } from "../dashboard/types";
import type { SyncMode, SyncProvider, SyncRunStatus, SyncRunSummary } from "../sync/types";

export interface NavCard {
	name: string;
	path: string;
	icon: string;
	color: string;
}

export interface ScheduleSlot {
	subject: string;
	teacher: string;
	room: string;
	startTime: string;
	endTime: string;
	type: "lecture" | "seminar" | "lab" | "practice" | "exam";
}

export interface PrayerCacheData {
	date: string;
	times: Record<string, string>;
	hijriDate: string;
	gregorianDate: string;
}

export interface ContentTypeDefinition {
	key: string;
	label: string;
	icon: string;
	folder: string;
	color: string;
	epField: string;
	totalField: string;
	unit: string;
}

export interface HabitDefinition {
	id: string;
	name: string;
	icon: string;
	color: string;
}

export interface DailySections {
	prayers: boolean;
	ratings: boolean;
	habits: boolean;
	schedule: boolean;
	tasks: boolean;
	review: boolean;
	notes: boolean;
}

export interface SavedLocation {
	name: string;
	latitude: number;
	longitude: number;
	city: string;
}

export interface GifLibraryItem {
	id: string;
	name: string;
	path: string;
}

export interface CommandHistoryItem {
	raw: string;
	command: string;
	target?: string;
	status: "success" | "failed";
	message: string;
	executedAt: number;
}

export interface ProgressTableData {
	id: string;
	cells: Record<string, boolean>;
	updatedAt: number;
}

export interface FocusSessionActive {
	id: string;
	title: string;
	taskFilePath?: string;
	taskLineNumber?: number;
	plannedMinutes: number;
	startedAt: number;
	pausedAt?: number;
	pausedSeconds: number;
	state: "running" | "paused";
	logToDaily: boolean;
}

export interface FocusSessionRecord {
	id: string;
	title: string;
	taskFilePath?: string;
	taskLineNumber?: number;
	plannedMinutes: number;
	startedAt: number;
	endedAt: number;
	durationSeconds: number;
	status: "completed" | "cancelled";
	notePath?: string;
}

export interface FocusSessionData {
	active: FocusSessionActive | null;
	sessions: FocusSessionRecord[];
}

export interface TriageResolvedItem {
	resolvedAt: number;
	projectPath?: string;
	kind?: "task" | "note" | "image" | "file" | "capture";
	title?: string;
	subtitle?: string;
	detail?: string;
	reason?: string;
	icon?: string;
	accent?: string;
	updatedAt?: number;
	path?: string;
	line?: number;
}

export interface TriageData {
	resolved: Record<string, TriageResolvedItem>;
	snoozedUntil: Record<string, number>;
	linkedProjects: Record<string, string>;
	reopened: Record<string, TriageResolvedItem>;
}

export interface VaultSyncData {
	lastRunAt: number;
	lastStatus: SyncRunStatus;
	lastMessage: string;
	lastSummary: SyncRunSummary | null;
}

export interface UmOSSettings {
	language: "en" | "ru";

	locationLatitude: number;
	locationLongitude: number;
	locationCity: string;
	savedLocations: SavedLocation[];

	prayerMethod: number;
	prayerShowStatusBar: boolean;
	prayerShowSunrise: boolean;
	prayerDashboardPath: string;

	dailyNotesPath: string;
	dailyNoteFormat: string;
	dailyAutoCreate: boolean;

	scheduleAnchorDate: string;
	scheduleSlotsPerDay: number;
	scheduleSlotDuration: number;
	scheduleBreakDuration: number;
	scheduleFirstSlotStart: string;
	scheduleFirstSlotNumber: number;

	habits: HabitDefinition[];
	contentTypes: ContentTypeDefinition[];

	homeNavCards: NavCard[];
	homeVisibleSections: string[];
	homeProjectsPath: string;
	homeContentPath: string;
	homeStatsMetrics: string[];
	homeScheduleAdvanceDelayMinutes: number;
	homeScheduleShowPastLessons: boolean;
	homeQuickCaptureDefaultNoteFolder: string;
	homeVaultHealthLookbackDays: number;
	homeAlertsIncludeVaultHealth: boolean;

	graphMapsAutoUpdate: boolean;
	graphMapsDebounceSeconds: number;
	graphMapsRootPath: string;
	graphMapsMapsPath: string;
	graphMapsIncludeImageIndex: boolean;
	graphMapsImageIndexPath: string;

	dailySections: DailySections;

	taskCalendarDefaultView: "month" | "list";
	taskCalendarFirstDayOfWeek: number;
	taskCalendarTaskPaths: string;
	taskCalendarMaxItemsPerDay: number;
	taskCalendarShowCompleted: boolean;
	taskCalendarShowCancelled: boolean;
	taskCalendarShowProgress: boolean;
	taskCalendarShowDailyNoteTasks: boolean;
	taskCalendarShowTaskPaths: boolean;

	syncDataPath: string;
	syncProvider: SyncProvider;
	syncRemoteRoot: string;
	syncMode: SyncMode;
	syncEncryptionEnabled: boolean;
	syncOnStartup: boolean;
	syncIntervalMinutes: number;
	syncDebounceSeconds: number;
	syncIgnorePatterns: string;
	syncMaxFileSizeMb: number;
	syncDryRun: boolean;
	dashboardProfilesExportPath: string;
	userNickname: string;
	userAvatarUrl: string;

	gifEnabled: boolean;
	gifPath: string;
	gifPosition: "bottom-left" | "bottom-right" | "top-left" | "top-right";
	gifSize: number;
	gifAnimation: "none" | "float" | "swing";
	gifGlass: boolean;
	gifGlow: boolean;
	gifDividerSvg: string;
	gifLibrary: GifLibraryItem[];

	infoboxSticky: boolean;
	softWideLineWidth: number;
}

export interface UmOSData {
	settings: UmOSSettings;

	prayer: {
		cache: PrayerCacheData | null;
	};

	schedule: {
		anchorDate: string;
		week1: Record<string, ScheduleSlot[]>;
		week2: Record<string, ScheduleSlot[]>;
	};

	home: {
		navCards: NavCard[];
		visibleSections: string[];
	};

	kanbanBoards: Record<string, {
		columns: {
			id: string;
			title: string;
			color: string;
			cards: {
				id: string;
				title: string;
				description: string;
				coverUrl: string;
				labels: string[];
				createdAt: number;
			}[];
		}[];
		labels: {
			id: string;
			text: string;
			color: string;
		}[];
	}>;

	dashboardProfiles: DashboardProfile[];
	commandHistory: CommandHistoryItem[];
	progressTables: Record<string, ProgressTableData>;
	focus: FocusSessionData;
	triage: TriageData;
	sync: VaultSyncData;

	syncedAt?: number;
}

export const DEFAULT_SETTINGS: UmOSSettings = {
	language: "en",

	locationLatitude: 55.7558,
	locationLongitude: 37.6173,
	locationCity: "Moscow",
	savedLocations: [],

	prayerMethod: 2,
	prayerShowStatusBar: true,
	prayerShowSunrise: true,
	prayerDashboardPath: "",

	dailyNotesPath: "11 Journal/Daily",
	dailyNoteFormat: "YYYY-MM-DD",
	dailyAutoCreate: true,

	scheduleAnchorDate: "",
	scheduleSlotsPerDay: 6,
	scheduleSlotDuration: 90,
	scheduleBreakDuration: 10,
	scheduleFirstSlotStart: "08:00",
	scheduleFirstSlotNumber: 1,

	contentTypes: [
		{ key: "anime", label: "Anime", icon: "🎌", folder: "Anime", color: "#e74c3c", epField: "current_episode", totalField: "total_episodes", unit: "ep." },
		{ key: "book", label: "Book", icon: "📚", folder: "Books", color: "#3498db", epField: "current_page", totalField: "total_pages", unit: "pages" },
		{ key: "movie", label: "Movie", icon: "🎬", folder: "Movies", color: "#f39c12", epField: "", totalField: "", unit: "" },
		{ key: "series", label: "Series", icon: "📺", folder: "Series", color: "#9b59b6", epField: "current_episode", totalField: "total_episodes", unit: "ep." },
		{ key: "game", label: "Game", icon: "🎮", folder: "Games", color: "#27ae60", epField: "hours_played", totalField: "", unit: "h" },
	],

	homeNavCards: [
		{ name: "Inbox", path: "10 Inbox/inbox", icon: "📥", color: "#607d8b" },
		{ name: "Prayer", path: "05 Dashboards/Prayer", icon: "🕌", color: "#f39c12" },
		{ name: "Stats", path: "05 Dashboards/Stats", icon: "📊", color: "#e74c3c" },
		{ name: "Schedule", path: "05 Dashboards/Schedule", icon: "📅", color: "#9b59b6" },
		{ name: "Tasks", path: "05 Dashboards/Tasks", icon: "✅", color: "#27ae60" },
		{ name: "Projects", path: "05 Dashboards/Projects", icon: "🚀", color: "#3498db" },
		{ name: "Content", path: "05 Dashboards/Content", icon: "🎬", color: "#e91e63" },
	],
	homeVisibleSections: [
		"clock",
		"greeting",
		"weather",
		"prayer",
		"navigation",
		"stats",
		"tasks",
		"deadlines",
		"projects",
		"content",
		"footer",
	],
	homeProjectsPath: "20 Projects",
	homeContentPath: "30 Content",
	homeStatsMetrics: ["mood", "productivity", "sleep", "prayer_count"],
	homeScheduleAdvanceDelayMinutes: 60,
	homeScheduleShowPastLessons: true,
	homeQuickCaptureDefaultNoteFolder: "10 Inbox",
	homeVaultHealthLookbackDays: 7,
	homeAlertsIncludeVaultHealth: true,

	graphMapsAutoUpdate: true,
	graphMapsDebounceSeconds: 5,
	graphMapsRootPath: "05 Dashboards",
	graphMapsMapsPath: "05 Dashboards/Maps",
	graphMapsIncludeImageIndex: true,
	graphMapsImageIndexPath: "00 Files/Image Index.md",

	habits: [
		{ id: "exercise", name: "Exercise", icon: "🏋️", color: "#e74c3c" },
		{ id: "reading", name: "Reading", icon: "📚", color: "#3498db" },
	],

	dailySections: {
		prayers: true,
		ratings: true,
		habits: true,
		schedule: true,
		tasks: true,
		review: true,
		notes: true,
	},

	taskCalendarDefaultView: "month",
	taskCalendarFirstDayOfWeek: 1,
	taskCalendarTaskPaths: "",
	taskCalendarMaxItemsPerDay: 3,
	taskCalendarShowCompleted: true,
	taskCalendarShowCancelled: false,
	taskCalendarShowProgress: true,
	taskCalendarShowDailyNoteTasks: true,
	taskCalendarShowTaskPaths: true,

	syncDataPath: "",
	syncProvider: "webdav",
	syncRemoteRoot: "umOS Sync",
	syncMode: "bidirectional",
	syncEncryptionEnabled: false,
	syncOnStartup: false,
	syncIntervalMinutes: 0,
	syncDebounceSeconds: 0,
	syncIgnorePatterns: "",
	syncMaxFileSizeMb: 50,
	syncDryRun: false,
	dashboardProfilesExportPath: "umOS/dashboard-profiles.json",
	userNickname: "",
	userAvatarUrl: "",

	gifEnabled: false,
	gifPath: "",
	gifPosition: "bottom-left",
	gifSize: 160,
	gifAnimation: "float",
	gifGlass: false,
	gifGlow: false,
	gifDividerSvg: "",
	gifLibrary: [],

	infoboxSticky: false,
	softWideLineWidth: 980,
};

export const DEFAULT_DATA: UmOSData = {
	settings: { ...DEFAULT_SETTINGS },

	prayer: {
		cache: null,
	},

	schedule: {
		anchorDate: "",
		week1: {
			monday: [],
			tuesday: [],
			wednesday: [],
			thursday: [],
			friday: [],
			saturday: [],
		},
		week2: {
			monday: [],
			tuesday: [],
			wednesday: [],
			thursday: [],
			friday: [],
			saturday: [],
		},
	},

	home: {
		navCards: [...DEFAULT_SETTINGS.homeNavCards],
		visibleSections: [...DEFAULT_SETTINGS.homeVisibleSections],
	},

	kanbanBoards: {},
	dashboardProfiles: [],
	commandHistory: [],
	progressTables: {},
	focus: {
		active: null,
		sessions: [],
	},
	triage: {
		resolved: {},
		snoozedUntil: {},
		linkedProjects: {},
		reopened: {},
	},
	sync: {
		lastRunAt: 0,
		lastStatus: "idle",
		lastMessage: "",
		lastSummary: null,
	},

	syncedAt: 0,
};
