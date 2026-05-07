import { MarkdownRenderChild } from "obsidian";
import { EventBus, UmOSEventMap } from "../EventBus";

export type EventSubscription = {
	[K in keyof UmOSEventMap]: {
		event: K;
		handler: (...args: UmOSEventMap[K]) => void;
	};
}[keyof UmOSEventMap];

/**
 * BaseWidget —      umOS.
 *    lifecycle: render  ,   EventBus ,
 *  automatic   .
 *
 *  :
 *   - render()            —
 *   - subscribeToEvents() —   EventBus  tue-
 *   - onWidgetLoad()      —   .  (, Obsidian-)
 *   - onWidgetUnload()    —     of onWidgetLoad
 *
 * eventBus   —   EventBus    ,
 *    .
 */
export abstract class BaseWidget extends MarkdownRenderChild {
	protected eventBus?: EventBus;

	/**    EventBus,    . */
	protected subscribeToEvents(): EventSubscription[] {
		return [];
	}

	/**     .     Obsidian-. */
	protected onWidgetLoad(): void {}

	/**    .   clearInterval  .. */
	protected onWidgetUnload(): void {}

	/**   . */
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
