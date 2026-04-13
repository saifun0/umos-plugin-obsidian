import { App } from "obsidian";
import { PrayerService } from "./PrayerService";
import { EventBus } from "../../EventBus";
import { BaseWidget, EventSubscription } from "../../core/BaseWidget";
import { createElement } from "../../utils/dom";
import { getFullRussianDate, formatCountdown } from "../../utils/date";
import type { UmOSSettings } from "../../settings/Settings";

export interface PrayerWidgetConfig {
	show: "times" | "next" | "both";
	style: "full" | "compact";
	showSunrise?: boolean;
}

export class PrayerWidget extends BaseWidget {
	private prayerService: PrayerService;
	protected eventBus: EventBus;
	private config: PrayerWidgetConfig;
	private settings: UmOSSettings;

	constructor(
		containerEl: HTMLElement,
		config: PrayerWidgetConfig,
		app: App,
		prayerService: PrayerService,
		eventBus: EventBus,
		settings: UmOSSettings
	) {
		super(containerEl);
		void app;
		this.prayerService = prayerService;
		this.eventBus = eventBus;
		this.config = config;
		this.settings = settings;
	}

	protected subscribeToEvents(): EventSubscription[] {
		return [{ event: "prayer:updated", handler: () => this.render() }];
	}

	protected onWidgetLoad(): void {
		this.registerInterval(window.setInterval(() => this.render(), 60000));
	}

	protected render(): void {
		this.containerEl.empty();

		const wrapper = createElement("div", {
			cls: "umos-prayer-widget",
			parent: this.containerEl,
		});

		const times = this.prayerService.getTimes();
		if (!times) {
			this.renderLoading(wrapper);
			return;
		}

		this.renderHeader(wrapper);

		if (this.config.show === "next" || this.config.show === "both") {
			this.renderNextPrayer(wrapper);
		}

		if (this.config.show === "times" || this.config.show === "both") {
			this.renderPrayerGrid(wrapper);
		}
	}

	private renderHeader(parent: HTMLElement): void {
		const header = createElement("div", {
			cls: "umos-prayer-header",
			parent,
		});

		const titleRow = createElement("div", {
			cls: "umos-prayer-title-row",
			parent: header,
		});

		createElement("span", {
			cls: "umos-prayer-title",
			text: "🕌 Времена намаза",
			parent: titleRow,
		});

		const times = this.prayerService.getTimes();
		const cityName = this.settings.locationCity;
		const isOnline = !!times && !!cityName;

		const cityRow = createElement("div", {
			cls: "umos-prayer-city-row",
			parent: header,
		});

		createElement("span", {
			cls: `umos-prayer-city-dot ${isOnline ? "umos-prayer-city-dot--ok" : "umos-prayer-city-dot--err"}`,
			parent: cityRow,
		});

		createElement("span", {
			cls: "umos-prayer-city-name",
			text: cityName || "Город не указан",
			parent: cityRow,
		});

		const hijri = this.prayerService.getHijriDate();
		if (hijri) {
			createElement("span", {
				cls: "umos-prayer-hijri umos-arabic",
				text: hijri,
				parent: header,
			});
		}

		createElement("span", {
			cls: "umos-prayer-gregorian",
			text: getFullRussianDate(),
			parent: header,
		});
	}

	private renderNextPrayer(parent: HTMLElement): void {
		const next = this.prayerService.getNextPrayer();

		const card = createElement("div", {
			cls: "umos-prayer-next-card umos-card",
			parent,
		});

		if (!next) {
			const doneWrapper = createElement("div", {
				cls: "umos-prayer-all-done",
				parent: card,
			});

			createElement("span", {
				cls: "umos-prayer-all-done-icon",
				text: "✅",
				parent: doneWrapper,
			});
			createElement("span", {
				cls: "umos-prayer-all-done-text",
				text: "Все намазы на сегодня совершены",
				parent: doneWrapper,
			});
			return;
		}

		createElement("div", {
			cls: "umos-prayer-next-icon",
			text: next.icon,
			parent: card,
		});

		const infoEl = createElement("div", {
			cls: "umos-prayer-next-info",
			parent: card,
		});

		createElement("div", {
			cls: "umos-prayer-next-label",
			text: "Следующий намаз",
			parent: infoEl,
		});

		createElement("div", {
			cls: "umos-prayer-next-name",
			text: next.nameRu,
			parent: infoEl,
		});

		const timeArea = createElement("div", {
			cls: "umos-prayer-next-time-area",
			parent: card,
		});

		createElement("div", {
			cls: "umos-prayer-next-time",
			text: next.time,
			parent: timeArea,
		});

		createElement("div", {
			cls: "umos-prayer-next-countdown",
			text: `через ${formatCountdown(next.minutesLeft)}`,
			parent: timeArea,
		});
	}

	private renderPrayerGrid(parent: HTMLElement): void {
		const times = this.prayerService.getTimes();
		if (!times) return;

		const statuses = this.prayerService.getPrayerStatuses();
		const showSunrise = this.config.showSunrise !== false;

		const grid = createElement("div", {
			cls: "umos-prayer-grid",
			parent,
		});

		const prayerOrder = PrayerService.getPrayerOrder();

		for (const name of prayerOrder) {
			if (name === "Sunrise" && !showSunrise) continue;

			const time = times[name];
			if (!time) continue;

			const status = statuses[name] || "upcoming";
			const nameRu = PrayerService.getPrayerNameRu(name);
			const icon = PrayerService.getPrayerIcon(name);

			const card = createElement("div", {
				cls: `umos-prayer-card umos-prayer-card-${status}`,
				parent: grid,
			});

			const statusIcon = this.getStatusIcon(status);

			const topRow = createElement("div", {
				cls: "umos-prayer-card-top",
				parent: card,
			});

			createElement("span", {
				cls: "umos-prayer-card-icon",
				text: icon,
				parent: topRow,
			});

			createElement("span", {
				cls: "umos-prayer-card-status-icon",
				text: statusIcon,
				parent: topRow,
			});

			createElement("div", {
				cls: "umos-prayer-card-name",
				text: nameRu,
				parent: card,
			});

			createElement("div", {
				cls: "umos-prayer-card-time",
				text: time,
				parent: card,
			});
		}
	}

	private getStatusIcon(status: string): string {
		switch (status) {
			case "passed":
				return "✓";
			case "next":
				return "●";
			case "upcoming":
				return "○";
			case "info":
				return "ℹ";
			default:
				return "○";
		}
	}

	private renderLoading(parent: HTMLElement): void {
		const loading = createElement("div", {
			cls: "umos-prayer-loading",
			parent,
		});

		createElement("div", {
			cls: "umos-prayer-loading-text",
			text: "🕌 Загрузка времён намаза...",
			parent: loading,
		});

		const grid = createElement("div", {
			cls: "umos-prayer-grid",
			parent: loading,
		});

		for (let i = 0; i < 6; i++) {
			const skeleton = createElement("div", {
				cls: "umos-prayer-card umos-prayer-card-skeleton",
				parent: grid,
			});
			createElement("div", {
				cls: "umos-skeleton-line",
				parent: skeleton,
			});
			createElement("div", {
				cls: "umos-skeleton-line",
				parent: skeleton,
			});
		}
	}
}
