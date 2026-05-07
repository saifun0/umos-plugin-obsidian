import { BaseWidget } from "../core/BaseWidget";
import { EventBus } from "../EventBus";

export interface DebugWidgetConfig {
	show: "all" | "events" | "widgets" | "compact";
	limit: number;
}

export class DebugWidget extends BaseWidget {
	protected eventBus: EventBus;
	private config: DebugWidgetConfig;

	constructor(containerEl: HTMLElement, eventBus: EventBus, config: DebugWidgetConfig) {
		super(containerEl);
		this.eventBus = eventBus;
		this.config = config;
	}

	protected render(): void {
		this.containerEl.empty();
		const diagnostics = this.eventBus.getDiagnostics();
		const root = this.containerEl.createDiv({ cls: "umos-debug-widget" });
		const header = root.createDiv({ cls: "umos-debug-header" });
		header.createEl("h3", { text: "umOS Debug" });
		const actions = header.createDiv({ cls: "umos-debug-header-actions" });
		actions.createSpan({ text: `${diagnostics.renderedWidgets} renders`, cls: "umos-debug-counter" });
		const clearBtn = actions.createEl("button", { text: "Clear", cls: "umos-debug-clear", attr: { type: "button" } });
		clearBtn.addEventListener("click", () => {
			this.eventBus.clearDiagnostics();
			this.render();
		});

		if (this.config.show === "compact") {
			const compact = root.createDiv({ cls: "umos-debug-compact" });
			this.renderCompactMetric(compact, "Events", String(diagnostics.recentEvents.length));
			this.renderCompactMetric(compact, "Issues", String(diagnostics.widgetErrors.length));
			this.renderCompactMetric(compact, "Blocks", String(Object.keys(diagnostics.renderedByBlock).length));
			const latest = diagnostics.recentEvents[0];
			root.createDiv({
				cls: "umos-debug-muted",
				text: latest ? `Latest: ${latest.event} · ${new Date(latest.timestamp).toLocaleTimeString()}` : "No events yet.",
			});
			return;
		}

		if (this.config.show === "all" || this.config.show === "widgets") {
			const widgets = root.createDiv({ cls: "umos-debug-section" });
			widgets.createEl("h4", { text: "Widgets" });
			const rows = Object.entries(diagnostics.renderedByBlock)
				.sort((a, b) => b[1] - a[1])
				.slice(0, this.config.limit);
			if (rows.length === 0) widgets.createDiv({ cls: "umos-debug-empty", text: "No render events." });
			for (const [block, count] of rows) {
				const row = widgets.createDiv({ cls: "umos-debug-row" });
				row.createSpan({ text: block });
				row.createSpan({ text: String(count), cls: "umos-debug-muted" });
			}

			if (diagnostics.widgetErrors.length > 0) {
				const errors = root.createDiv({ cls: "umos-debug-section" });
				errors.createEl("h4", { text: "Config warnings/errors" });
				for (const issue of diagnostics.widgetErrors.slice(0, this.config.limit)) {
					const item = errors.createDiv({ cls: "umos-debug-issue" });
					item.createDiv({ cls: "umos-debug-issue-title", text: `${issue.blockName}${issue.sourcePath ? ` · ${issue.sourcePath}` : ""}` });
					const details = [...issue.errors, ...issue.warnings].join(" · ");
					item.createDiv({ cls: "umos-debug-muted", text: details || "No details." });
				}
			}
		}

		if (this.config.show === "all" || this.config.show === "events") {
			const events = root.createDiv({ cls: "umos-debug-section" });
			events.createEl("h4", { text: "Recent events" });
			const recent = diagnostics.recentEvents.slice(0, this.config.limit);
			if (recent.length === 0) events.createDiv({ cls: "umos-debug-empty", text: "No events yet." });
			for (const event of recent) {
				const row = events.createDiv({ cls: "umos-debug-row" });
				row.createSpan({ text: event.event });
				row.createSpan({
					text: new Date(event.timestamp).toLocaleTimeString(),
					cls: "umos-debug-muted",
				});
			}
		}
	}

	private renderCompactMetric(parent: HTMLElement, label: string, value: string): void {
		const item = parent.createDiv({ cls: "umos-debug-compact-item" });
		item.createSpan({ cls: "umos-debug-compact-value", text: value });
		item.createSpan({ cls: "umos-debug-compact-label", text: label });
	}
}
