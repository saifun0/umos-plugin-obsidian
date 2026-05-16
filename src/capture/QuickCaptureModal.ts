import { App, Modal } from "obsidian";
import type UmOSPlugin from "../main";
import { renderQuickCaptureSection } from "./QuickCapturePanel";
import type { QuickCaptureOptions } from "./QuickCapturePanel";

export class QuickCaptureModal extends Modal {
	constructor(
		app: App,
		private plugin: UmOSPlugin,
		private options: QuickCaptureOptions = {},
	) {
		super(app);
	}

	onOpen(): void {
		this.modalEl.addClass("umos-quick-capture-modal");
		this.contentEl.empty();
		this.contentEl.addClass("umos-quick-capture-modal-content");
		renderQuickCaptureSection(this.contentEl, {
			app: this.app,
			plugin: this.plugin,
			settings: this.plugin.settings,
			eventBus: this.plugin.eventBus,
			initial: this.options.initial,
			onSuccess: this.options.onSuccess,
		});
	}

	onClose(): void {
		this.contentEl.empty();
		this.contentEl.removeClass("umos-quick-capture-modal-content");
	}
}
