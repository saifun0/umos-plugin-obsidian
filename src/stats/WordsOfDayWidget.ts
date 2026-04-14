import { App } from "obsidian";
import { StatsEngine } from "./StatsEngine";
import { EventBus } from "../EventBus";
import { BaseWidget, EventSubscription } from "../core/BaseWidget";
import { createElement } from "../utils/dom";

export interface WordsOfDayConfig {
	period: number;
	field: string;
}

const MONTH_SHORT_RU = [
	"янв", "фев", "мар", "апр", "май", "июн",
	"июл", "авг", "сен", "окт", "ноя", "дек",
];

export class WordsOfDayWidget extends BaseWidget {
	private statsEngine: StatsEngine;
	protected eventBus: EventBus;
	private config: WordsOfDayConfig;

	constructor(
		containerEl: HTMLElement,
		config: WordsOfDayConfig,
		statsEngine: StatsEngine,
		eventBus: EventBus,
	) {
		super(containerEl);
		this.statsEngine = statsEngine;
		this.eventBus = eventBus;
		this.config = config;
	}

	protected subscribeToEvents(): EventSubscription[] {
		const rerender = () => this.render();
		return [
			{ event: "stats:recalculated", handler: rerender },
			{ event: "frontmatter:changed", handler: rerender },
		];
	}

	protected render(): void {
		this.containerEl.empty();

		const wrapper = createElement("div", {
			cls: "umos-wod-widget",
			parent: this.containerEl,
		});

		const data = this.statsEngine.getTextDataForPeriod(this.config.field, this.config.period);

		// Header
		const header = createElement("div", {
			cls: "umos-wod-header",
			parent: wrapper,
		});

		createElement("div", {
			cls: "umos-wod-title",
			text: "📝 Слова дня",
			parent: header,
		});

		createElement("div", {
			cls: "umos-wod-subtitle",
			text: `${data.length} за последние ${this.config.period} дней`,
			parent: header,
		});

		if (data.length === 0) {
			createElement("div", {
				cls: "umos-wod-empty",
				text: "Нет записей за этот период",
				parent: wrapper,
			});
			return;
		}

		// Word cards grid
		const grid = createElement("div", {
			cls: "umos-wod-grid",
			parent: wrapper,
		});

		for (const entry of data) {
			const [, m, d] = entry.date.split("-");
			const monthIdx = parseInt(m, 10) - 1;
			const dayNum = parseInt(d, 10);
			const dateLabel = `${dayNum} ${MONTH_SHORT_RU[monthIdx]}`;

			const card = createElement("div", {
				cls: "umos-wod-card",
				parent: grid,
			});

			createElement("div", {
				cls: "umos-wod-card-word",
				text: entry.value,
				parent: card,
			});

			createElement("div", {
				cls: "umos-wod-card-date",
				text: dateLabel,
				parent: card,
			});
		}
	}
}
