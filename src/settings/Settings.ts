import { Goal } from '../productivity/goals/Goal';

// ─── Balance types ─────────────────────────────
export interface BalanceActivityType {
	id: string;
	label: string;
	icon: string;
	color: string;
	/** Minutes of balance earned per minute of activity. Default 1.0. */
	multiplier: number;
}

export interface BalanceEntertainmentType {
	id: string;
	label: string;
	icon: string;
	color: string;
	/** Minutes of balance drained per minute of entertainment. Default 1.0. */
	drainMultiplier: number;
}

export interface BalanceEntry {
	id: string;
	date: string; // "YYYY-MM-DD"
	timestamp: number; // unix ms
	type: "earn" | "spend";
	activityId: string;
	label: string;
	icon: string;
	durationMinutes: number;
	balanceMinutes: number; // effective balance change (after multiplier)
	note?: string;
}

export interface BalanceDailyNoteRule {
	field: string;        // frontmatter field name, e.g. "exercise"
	unitsPerEarn: number; // how many units = earnMinutes, e.g. 5
	earnMinutes: number;  // minutes earned per batch, e.g. 2
	label: string;
	icon: string;
}

export interface BalanceData {
	entries: BalanceEntry[];
	lastBonusDate: string;
	/** date → field → number of batches already credited (prevents double-counting) */
	dailyNoteCredits: Record<string, Record<string, number>>;
}

export interface HabitDefinition {
	id: string;
	name: string;
	icon: string;
	color: string;
}

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

export interface CachedAyahData {
	number: number;
	surahNumber: number;
	ayahInSurah: number;
	arabicText: string;
	translationText: string;
	surahNameRu: string;
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

export interface PomodoroData {
	completedToday: number;
	todayDate: string;
	completedThisWeek: number;
	weekStart: string;
	totalCompleted: number;
	dailyHistory: Record<string, number>; // "YYYY-MM-DD" → count
}

export interface ExamTopic {
	id: string;
	text: string;
	completed: boolean;
	day: string;
}

export interface ExamEntry {
	id: string;
	name: string;
	date: string;
	priority: "high" | "medium" | "low";
	topics: ExamTopic[];
	notes?: string;
	score?: number;
}

export interface DailySections {
	prayers: boolean;
	habits: boolean;
	ratings: boolean;
	schedule: boolean;
	tasks: boolean;
	notes: boolean;
}

export interface FinanceCategory {
	id: string;
	name: string;
	icon: string;
	color: string;
}

export interface FinanceTransaction {
	id: string;
	date: string;
	type: "income" | "expense";
	amount: number;
	categoryId: string;
	description: string;
}

export interface FinanceMonthlyBudget {
	month: string; // "YYYY-MM"
	budget: number;
	spent: number;
}

export interface FinanceRecurring {
	id: string;
	name: string;
	icon?: string;       // emoji override
	amount: number;
	categoryId: string;
	type: "expense" | "income";
	dayOfMonth: number;  // 1-28
}

export interface SavedLocation {
	name: string;
	latitude: number;
	longitude: number;
	city: string;
}

export interface UmOSSettings {
	// Местоположение
	locationLatitude: number;
	locationLongitude: number;
	locationCity: string;
	savedLocations: SavedLocation[];

	// Намаз
	prayerMethod: number;
	prayerShowStatusBar: boolean;
	prayerShowSunrise: boolean;
	prayerDashboardPath: string;

	// Коран
	quranTranslation: string;
	quranShowArabic: boolean;
	quranAyatCount: number;

	// Статистика
	dailyNotesPath: string;
	dailyNoteFormat: string;

	// Расписание
	scheduleAnchorDate: string;
	scheduleSlotsPerDay: number;
	scheduleSlotDuration: number;
	scheduleBreakDuration: number;
	scheduleFirstSlotStart: string;

	// Быстрый ввод
	captureInboxPath: string;
	captureMode: "file" | "append";
	captureFileTemplate: string;

	// Привычки
	habits: HabitDefinition[];

	// Контент
	contentTypes: ContentTypeDefinition[];

	// Главная
	homeNavCards: NavCard[];
	homeVisibleSections: string[];
	homeProjectsPath: string;
	homeContentPath: string;

	// Рамадан
	ramadanEnabled: boolean;

	// Помодоро
	pomodoroWorkMinutes: number;
	pomodoroBreakMinutes: number;
	pomodoroLongBreakMinutes: number;
	pomodoroLongBreakInterval: number;

	// Дневная заметка
	dailySections: DailySections;

	// Финансы
	financeCategories: FinanceCategory[];
	financeDefaultMonthlyBudget: number;
	financeCurrency: string;

	// Цели
	goals: Goal[];

	// Баланс времени
	balanceMaxDailyEarnings: number;    // 0 = no cap
	balanceMaxTotal: number;            // 0 = no cap
	balanceAllowNegative: boolean;
	balanceDailyBonus: number;          // free minutes per day, 0 = disabled
	balanceActivityTypes: BalanceActivityType[];
	balanceEntertainmentTypes: BalanceEntertainmentType[];
	balanceDailyNoteRules: BalanceDailyNoteRule[];

	// Статистика (HomeView)
	homeStatsMetrics: string[];

	// Синхронизация
	syncDataPath: string;

	// Профиль пользователя
	userNickname: string;
	userAvatarUrl: string;

	// GIF-оверлей
	gifEnabled: boolean;
	gifPath: string;
	gifPosition: "bottom-left" | "bottom-right" | "top-left" | "top-right";
	gifSize: number; // px
	gifAnimation: "none" | "float" | "swing"; // покачивание
	gifGlass: boolean;  // стеклянный контейнер
	gifGlow: boolean;   // свечение в цвет акцента
	gifDividerSvg: string; // путь к SVG или инлайн-код; пусто = градиент по умолчанию

	// Инфобокс
	infoboxSticky: boolean; // следовать за экраном при скролле

	// Расписание — номер первой пары
	scheduleFirstSlotNumber: number;
}

export interface UmOSData {
	settings: UmOSSettings;

	prayer: {
		cache: PrayerCacheData | null;
	};

	quran: {
		ayatCache: {
			date: string;
			ayahs: CachedAyahData[];
		} | null;
		completedJuz: number[];
		juzStatus: Record<number, "not-started" | "in-progress" | "completed">;
		dailyPages: number;
		lastReadDate: string;
		streak: number;
		longestStreak: number;
	};

	schedule: {
		anchorDate: string;
		week1: Record<string, ScheduleSlot[]>;
		week2: Record<string, ScheduleSlot[]>;
	};

	habits: {
		definitions: HabitDefinition[];
	};

	home: {
		navCards: NavCard[];
		visibleSections: string[];
	};

	capture: {
		mode: "file" | "append";
		inboxPath: string;
	};

	ramadan: {
		fastTracker: Record<string, boolean>;
		tarawihTracker: Record<string, boolean>;
	};

	pomodoro: PomodoroData;
	exams: ExamEntry[];

	finance: {
		balance: number;
		transactions: FinanceTransaction[];
		monthlyBudgets: FinanceMonthlyBudget[];
		recurringPayments: FinanceRecurring[];
	};

	goals: Goal[];

	balance: BalanceData;

	kanbanBoards: Record<string, { columns: { id: string; title: string; color: string; cards: { id: string; title: string; description: string; coverUrl: string; labels: string[]; createdAt: number }[] }[]; labels: { id: string; text: string; color: string }[] }>;

	syncedAt?: number;
}

export const DEFAULT_SETTINGS: UmOSSettings = {
	// Местоположение
	locationLatitude: 55.7558,
	locationLongitude: 37.6173,
	locationCity: "Москва",
	savedLocations: [],

	// Намаз
	prayerMethod: 2,
	prayerShowStatusBar: true,
	prayerShowSunrise: true,
	prayerDashboardPath: "",

	// Коран
	quranTranslation: "ru.kuliev",
	quranShowArabic: true,
	quranAyatCount: 5,

	// Статистика
	dailyNotesPath: "11 Journal/Daily",
	dailyNoteFormat: "YYYY-MM-DD",

	// Расписание
	scheduleAnchorDate: "",
	scheduleSlotsPerDay: 6,
	scheduleSlotDuration: 90,
	scheduleBreakDuration: 10,
	scheduleFirstSlotStart: "08:00",

	// Быстрый ввод
	captureInboxPath: "10 Inbox",
	captureMode: "append",
	captureFileTemplate: "YYYY-MM-DD_HHmmss",

	// Привычки
	habits: [
		{ id: "exercise", name: "Упражнения", icon: "🏋️", color: "#e74c3c" },
		{ id: "reading", name: "Чтение", icon: "📚", color: "#3498db" },
		{ id: "water", name: "Вода", icon: "💧", color: "#1abc9c" },
		{ id: "quran", name: "Коран", icon: "📖", color: "#27ae60" },
		{ id: "study", name: "Учёба", icon: "🎓", color: "#9b59b6" },
	],

	// Контент
	contentTypes: [
		{ key: "anime",  label: "Аниме",   icon: "🎌", folder: "Anime",  color: "#e74c3c", epField: "current_episode", totalField: "total_episodes", unit: "эп." },
		{ key: "book",   label: "Книга",   icon: "📚", folder: "Books",  color: "#3498db", epField: "current_page",    totalField: "total_pages",    unit: "стр." },
		{ key: "movie",  label: "Фильм",   icon: "🎬", folder: "Movies", color: "#f39c12", epField: "",                totalField: "",               unit: "" },
		{ key: "series", label: "Сериал",  icon: "📺", folder: "Series", color: "#9b59b6", epField: "current_episode", totalField: "total_episodes", unit: "эп." },
		{ key: "game",   label: "Игра",    icon: "🎮", folder: "Games",  color: "#27ae60", epField: "hours_played",    totalField: "",               unit: "ч." },
	],

	// Главная
	homeNavCards: [
		{ name: "Inbox", path: "10 Inbox/inbox", icon: "📥", color: "#607d8b" },
		{ name: "Намаз", path: "05 Dashboards/Prayer", icon: "🕌", color: "#f39c12" },
		{ name: "Коран", path: "05 Dashboards/Quran", icon: "📖", color: "#27ae60" },
		{ name: "Статистика", path: "05 Dashboards/Stats", icon: "📊", color: "#e74c3c" },
		{ name: "Расписание", path: "05 Dashboards/Schedule", icon: "📅", color: "#9b59b6" },
		{ name: "Задачи", path: "05 Dashboards/Tasks", icon: "✅", color: "#27ae60" },
		{ name: "Цели", path: "05 Dashboards/Goals", icon: "🎯", color: "#f39c12" },
		{ name: "Помодоро", path: "05 Dashboards/Pomodoro", icon: "⏳", color: "#e67e22" },
		{ name: "Проекты", path: "05 Dashboards/Projects", icon: "🚀", color: "#3498db" },
		{ name: "Контент", path: "05 Dashboards/Content", icon: "🎬", color: "#e91e63" },
		{ name: "Финансы", path: "05 Dashboards/Finance", icon: "💰", color: "#f39c12" },
		{ name: "Баланс", path: "05 Dashboards/Balance", icon: "⚖️", color: "#27ae60" },
	],
	homeVisibleSections: [
		"clock",
		"greeting",
		"weather",
		"prayer",
		"ramadan",
		"navigation",
		"stats",
		"tasks",
		"deadlines",
		"projects",
		"exams",
		"finance",
		"goals",
		"balance",
		"content",
		"footer",
	],
	homeProjectsPath: "20 Projects",
	homeContentPath: "30 Content",

	// Рамадан
	ramadanEnabled: false,

	// Помодоро
	pomodoroWorkMinutes: 25,
	pomodoroBreakMinutes: 5,
	pomodoroLongBreakMinutes: 15,
	pomodoroLongBreakInterval: 4,

	// Дневная заметка
	dailySections: {
		prayers: true,
		habits: true,
		ratings: true,
		schedule: true,
		tasks: true,
		notes: true,
	},

	// Финансы
	financeCategories: [
		{ id: "food", name: "Еда", icon: "🍔", color: "#e74c3c" },
		{ id: "transport", name: "Транспорт", icon: "🚗", color: "#3498db" },
		{ id: "study", name: "Учёба", icon: "📚", color: "#9b59b6" },
		{ id: "subscriptions", name: "Подписки", icon: "🔔", color: "#1abc9c" },
		{ id: "entertainment", name: "Развлечения", icon: "🎮", color: "#f39c12" },
		{ id: "health", name: "Здоровье", icon: "💊", color: "#27ae60" },
		{ id: "other", name: "Прочее", icon: "📦", color: "#95a5a6" },
	],
	financeDefaultMonthlyBudget: 10000,
	financeCurrency: "₽",

	// Цели
	goals: [],

	// Баланс времени
	balanceMaxDailyEarnings: 0,
	balanceMaxTotal: 480,
	balanceAllowNegative: false,
	balanceDailyBonus: 0,
	balanceActivityTypes: [
		{ id: "study",   label: "Учёба",   icon: "📚", color: "#3498db", multiplier: 1.0 },
		{ id: "work",    label: "Работа",  icon: "💼", color: "#9b59b6", multiplier: 1.2 },
		{ id: "reading", label: "Чтение",  icon: "📖", color: "#27ae60", multiplier: 1.0 },
		{ id: "sport",   label: "Спорт",   icon: "🏃", color: "#e74c3c", multiplier: 1.5 },
		{ id: "other",   label: "Прочее",  icon: "⚡", color: "#95a5a6", multiplier: 1.0 },
	],
	balanceEntertainmentTypes: [
		{ id: "gaming",  label: "Игры",    icon: "🎮", color: "#e74c3c", drainMultiplier: 1.0 },
		{ id: "youtube", label: "YouTube", icon: "📺", color: "#f39c12", drainMultiplier: 1.0 },
		{ id: "social",  label: "Соцсети", icon: "📱", color: "#1abc9c", drainMultiplier: 1.0 },
		{ id: "other",   label: "Прочее",  icon: "🎯", color: "#95a5a6", drainMultiplier: 1.0 },
	],
	balanceDailyNoteRules: [
		{ field: "exercise", unitsPerEarn: 5, earnMinutes: 2, label: "Упражнения", icon: "🏋️" },
	],

	// Статистика (HomeView)
	homeStatsMetrics: ["mood", "productivity", "sleep", "prayer_count"],

	// Синхронизация
	syncDataPath: "",

	// Профиль
	userNickname: "",
	userAvatarUrl: "",

	// GIF-оверлей
	gifEnabled: false,
	gifPath: "",
	gifPosition: "bottom-left",
	gifSize: 160,
	gifAnimation: "float",
	gifGlass: false,
	gifGlow: false,
	gifDividerSvg: "",

	// Инфобокс
	infoboxSticky: false,

	// Расписание
	scheduleFirstSlotNumber: 1,
};

export const DEFAULT_DATA: UmOSData = {
	settings: { ...DEFAULT_SETTINGS },

	prayer: {
		cache: null,
	},

	quran: {
		ayatCache: null,
		completedJuz: [],
		juzStatus: {},
		dailyPages: 0,
		lastReadDate: "",
		streak: 0,
		longestStreak: 0,
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

	habits: {
		definitions: [...DEFAULT_SETTINGS.habits],
	},

	home: {
		navCards: [...DEFAULT_SETTINGS.homeNavCards],
		visibleSections: [...DEFAULT_SETTINGS.homeVisibleSections],
	},

	capture: {
		mode: "append",
		inboxPath: "10 Inbox",
	},

	ramadan: {
		fastTracker: {},
		tarawihTracker: {},
	},

	pomodoro: {
		completedToday: 0,
		todayDate: "",
		completedThisWeek: 0,
		weekStart: "",
		totalCompleted: 0,
		dailyHistory: {},
	},

	exams: [],

	finance: {
		balance: 0,
		transactions: [],
		monthlyBudgets: [],
		recurringPayments: [],
	},

	goals: [],

	balance: {
		entries: [],
		lastBonusDate: "",
		dailyNoteCredits: {},
	},

	kanbanBoards: {},

	syncedAt: 0,
};
