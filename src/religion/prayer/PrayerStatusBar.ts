import { App } from "obsidian";
import { PrayerService } from "./PrayerService";
import { EventBus } from "../../EventBus";
import { UmOSSettings } from "../../settings/Settings";
import { formatCountdown } from "../../utils/date";

export class PrayerStatusBar {
	private app: App;
	private prayerService: PrayerService;
	private eventBus: EventBus;
	private settings: UmOSSettings;
	private statusBarEl: HTMLElement;
	private updateIntervalId: number | null = null;

	constructor(
		app: App,
		statusBarEl: HTMLElement,
		prayerService: PrayerService,
		eventBus: EventBus,
		settings: UmOSSettings
	) {
		this.app = app;
		this.statusBarEl = statusBarEl;
		this.prayerService = prayerService;
		this.eventBus = eventBus;
		this.settings = settings;
	}

	/**
	 * Инициализация: первый рендер + подписка на обновления.
	 */
	init(registerInterval: (id: number) => void): void {
		this.update();

		// Обновление каждые 30 секунд
		const id = window.setInterval(() => {
			this.update();
		}, 30000);
		registerInterval(id);

		// Подписка на обновления данных
		this.eventBus.on("prayer:updated", () => {
			this.update();
		});

		// Клик по StatusBar — открыть дашборд
		this.statusBarEl.addEventListener("click", () => {
			this.openDashboard();
		});

		this.statusBarEl.classList.add("umos-prayer-statusbar");
		this.statusBarEl.setAttribute("aria-label", "Следующий намаз");
	}

	private update(): void {
		const next = this.prayerService.getNextPrayer();

		if (!next) {
			if (this.prayerService.getTimes()) {
				// Все намазы завершены
				this.statusBarEl.textContent = "🕌 Все намазы завершены";
			} else {
				// Нет данных
				this.statusBarEl.textContent = "🕌 Загрузка...";
			}
			return;
		}

		const countdown = formatCountdown(next.minutesLeft);
		this.statusBarEl.textContent = `🕌 ${next.nameRu} ${next.time} (через ${countdown})`;
	}

	private openDashboard(): void {
		const path = this.settings.prayerDashboardPath;
		if (path && path.trim()) {
			this.app.workspace.openLinkText(path, "", false);
		}
	}

	destroy(): void {
		// Интервал очищается через registerInterval в main.ts
	}
}