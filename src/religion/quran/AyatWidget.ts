import { App } from "obsidian";
import { QuranService } from "./QuranService";
import { EventBus, CachedAyah } from "../../EventBus";
import { UmOSSettings } from "../../settings/Settings";
import { createElement, createSkeletonLoader, createErrorMessage } from "../../utils/dom";
import { BaseWidget, EventSubscription } from "../../core/BaseWidget";

export interface AyatWidgetConfig {
	count: number;
	language: string;
	showArabic: boolean;
}

export class AyatWidget extends BaseWidget {
	private obsidianApp: App;
	private quranService: QuranService;
	protected eventBus: EventBus;
	private settings: UmOSSettings;
	private config: AyatWidgetConfig;
	private loaded: boolean = false;

	constructor(
		containerEl: HTMLElement,
		config: AyatWidgetConfig,
		app: App,
		quranService: QuranService,
		eventBus: EventBus,
		settings: UmOSSettings
	) {
		super(containerEl);
		this.obsidianApp = app;
		this.quranService = quranService;
		this.eventBus = eventBus;
		this.settings = settings;
		this.config = config;
	}

	protected subscribeToEvents(): EventSubscription[] {
		const handler = () => {
			if (!this.loaded) return;
			void this.loadAyahs();
		};
		return [{ event: "quran:ayat-loaded", handler }];
	}

	protected onWidgetLoad(): void {
		void this.loadAyahs();
	}

	protected render(): void {
		this.renderLoading();
	}

	private async loadAyahs(): Promise<void> {
		try {
			const ayahs = await this.quranService.getAyatOfDay(
				this.config.count,
				this.config.language,
				this.config.showArabic
			);

			if (ayahs.length > 0) {
				this.loaded = true;
				this.renderAyahs(ayahs);
			} else {
				// Попробуем кеш
				const cached = this.quranService.getCachedAyahs();
				if (cached && cached.length > 0) {
					this.loaded = true;
					this.renderAyahs(cached.slice(0, this.config.count));
				} else {
					this.renderError("Не удалось загрузить аяты. Проверьте подключение к интернету.");
				}
			}
		} catch (error) {
			console.error("umOS Ayat: render error:", error);

			// Fallback на кеш
			const cached = this.quranService.getCachedAyahs();
			if (cached && cached.length > 0) {
				this.loaded = true;
				this.renderAyahs(cached.slice(0, this.config.count));
			} else {
				this.renderError("Нет соединения с интернетом");
			}
		}
	}

	private renderLoading(): void {
		this.containerEl.empty();

		const wrapper = createElement("div", {
			cls: "umos-ayat-widget",
			parent: this.containerEl,
		});

		this.renderHeader(wrapper, 0);
		createSkeletonLoader(wrapper, 5);
	}

	private renderAyahs(ayahs: CachedAyah[]): void {
		this.containerEl.empty();

		const wrapper = createElement("div", {
			cls: "umos-ayat-widget",
			parent: this.containerEl,
		});

		this.renderHeader(wrapper, ayahs.length);

		// Бисмилля
		this.renderBismillah(wrapper);

		// Карточки аятов
		ayahs.forEach((ayah, index) => {
			this.renderAyahCard(wrapper, ayah, index + 1);
		});

		// Футер
		this.renderFooter(wrapper);
	}

	private renderHeader(parent: HTMLElement, count: number): void {
		const header = createElement("div", {
			cls: "umos-ayat-header",
			parent,
		});

		createElement("div", {
			cls: "umos-ayat-title",
			text: "📖 Аяты дня",
			parent: header,
		});

		if (count > 0) {
			const today = new Date();
			const dateStr = today.toLocaleDateString("ru-RU", {
				day: "numeric",
				month: "long",
				year: "numeric",
			});

			createElement("div", {
				cls: "umos-ayat-subtitle",
				text: `${dateStr} • ${count} аятов`,
				parent: header,
			});
		}
	}

	private renderBismillah(parent: HTMLElement): void {
		const bismillah = createElement("div", {
			cls: "umos-ayat-bismillah",
			parent,
		});

		createElement("div", {
			cls: "umos-ayat-bismillah-arabic umos-arabic",
			text: "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ",
			parent: bismillah,
		});

		createElement("div", {
			cls: "umos-ayat-bismillah-translation",
			text: "Во имя Аллаха, Милостивого, Милосердного",
			parent: bismillah,
		});
	}

	private renderAyahCard(parent: HTMLElement, ayah: CachedAyah, index: number): void {
		const card = createElement("div", {
			cls: "umos-ayat-card umos-card",
			parent,
		});

		// Верхняя строка: номер + ссылка
		const topRow = createElement("div", {
			cls: "umos-ayat-card-top",
			parent: card,
		});

		createElement("span", {
			cls: "umos-ayat-card-badge",
			text: String(index),
			parent: topRow,
		});

		const link = createElement("a", {
			cls: "umos-ayat-card-link",
			text: `${ayah.surahNameRu} (${ayah.surahNumber}:${ayah.ayahInSurah})`,
			parent: topRow,
			attr: {
				href: `https://quran.com/${ayah.surahNumber}/${ayah.ayahInSurah}`,
				target: "_blank",
				rel: "noopener noreferrer",
			},
		});

		// Арабский текст
		if (ayah.arabicText) {
			createElement("div", {
				cls: "umos-ayat-card-arabic umos-arabic",
				text: ayah.arabicText,
				parent: card,
			});

			createElement("div", {
				cls: "umos-ayat-card-divider",
				parent: card,
			});
		}

		// Перевод
		createElement("div", {
			cls: "umos-ayat-card-translation",
			text: ayah.translationText,
			parent: card,
		});
	}

	private renderFooter(parent: HTMLElement): void {
		createElement("div", {
			cls: "umos-ayat-footer",
			text: "Новые аяты появятся завтра ✨",
			parent,
		});
	}

	private renderError(message: string): void {
		this.containerEl.empty();

		const wrapper = createElement("div", {
			cls: "umos-ayat-widget",
			parent: this.containerEl,
		});

		this.renderHeader(wrapper, 0);
		createErrorMessage(wrapper, message);
	}
}