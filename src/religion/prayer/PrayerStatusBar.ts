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
	 * :   +   .
	 */
	init(registerInterval: (id: number) => void): void {
		this.update();

		//   30 seconds
		const id = window.setInterval(() => {
			this.update();
		}, 30000);
		registerInterval(id);

		//
		this.eventBus.on("prayer:updated", () => {
			this.update();
		});

		//   StatusBar —
		this.statusBarEl.addEventListener("click", () => {
			this.openDashboard();
		});

		this.statusBarEl.classList.add("umos-prayer-statusbar");
		this.statusBarEl.setAttribute("aria-label", "Next prayer");
	}

	private update(): void {
		const next = this.prayerService.getNextPrayer();

		if (!next) {
			if (this.prayerService.getTimes()) {
				// All prayers completed
				this.statusBarEl.textContent = "🕌 All prayers completed";
			} else {
				// None
				this.statusBarEl.textContent = "🕌 Loading...";
			}
			return;
		}

		const countdown = formatCountdown(next.minutesLeft);
		this.statusBarEl.textContent = `🕌 ${next.nameRu} ${next.time} (in ${countdown})`;
	}

	private openDashboard(): void {
		const path = this.settings.prayerDashboardPath;
		if (path && path.trim()) {
			this.app.workspace.openLinkText(path, "", false);
		}
	}

	destroy(): void {
		//   in registerInterval  main.ts
	}
}