import { MarkdownRenderChild } from "obsidian";
import { EventBus, UmOSEventMap } from "../EventBus";

export type EventSubscription = {
	[K in keyof UmOSEventMap]: {
		event: K;
		handler: (...args: UmOSEventMap[K]) => void;
	};
}[keyof UmOSEventMap];

/**
 * BaseWidget — базовый класс для всех виджетов umOS.
 * Берёт на себя lifecycle: render при загрузке, подписку на EventBus события,
 * их автоматическую очистку при выгрузке.
 *
 * Подклассы реализуют:
 *   - render()            — отрисовка содержимого
 *   - subscribeToEvents() — список событий EventBus для авто-подписки
 *   - onWidgetLoad()      — хук для доп. инициализации (интервалы, Obsidian-события)
 *   - onWidgetUnload()    — хук для очистки ресурсов из onWidgetLoad
 *
 * eventBus не обязателен — виджеты без EventBus просто не объявляют его,
 * и подписок не будет.
 */
export abstract class BaseWidget extends MarkdownRenderChild {
	protected eventBus?: EventBus;

	/** Возвращает список событий EventBus, на которые подписывается виджет. */
	protected subscribeToEvents(): EventSubscription[] {
		return [];
	}

	/** Вызывается после подписки на события. Используй для интервалов и Obsidian-событий. */
	protected onWidgetLoad(): void {}

	/** Вызывается перед очисткой подписок. Используй для clearInterval и т.п. */
	protected onWidgetUnload(): void {}

	/** Отрисовка содержимого виджета. */
	protected abstract render(): void;

	onload(): void {
		this.render();
		if (this.eventBus) {
			for (const sub of this.subscribeToEvents()) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(this.eventBus.on as (e: string, h: (...a: any[]) => void) => void)(sub.event, sub.handler);
				this.register(() => {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					(this.eventBus!.off as (e: string, h: (...a: any[]) => void) => void)(sub.event, sub.handler);
				});
			}
		}
		this.onWidgetLoad();
	}

	onunload(): void {
		this.onWidgetUnload();
		super.onunload();
	}
}
