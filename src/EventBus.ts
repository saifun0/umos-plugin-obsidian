import { Events } from "obsidian";

export interface PrayerTimesData {
	Fajr: string;
	Sunrise: string;
	Dhuhr: string;
	Asr: string;
	Maghrib: string;
	Isha: string;
	[key: string]: string;
}

export interface UmOSEventMap {
	"prayer:updated": [data: { times: PrayerTimesData; hijriDate: string }];
	"frontmatter:changed": [data: { path: string; property: string; value: unknown }];
	"stats:recalculated": [data: { period: number }];
	"daily:created": [data: { path: string; date: string }];
	"schedule:changed": [];
	"tasks:changed": [data?: { action?: string; path?: string }];
	"dashboard:profile-saved": [data: { id: string; name: string }];
	"dashboard:generated": [data: { id: string; path: string }];
	"widget:config-invalid": [data: { blockName: string; sourcePath?: string; errors: string[]; warnings: string[] }];
	"command:executed": [data: { command: string; target?: string }];
	"command:failed": [data: { command: string; reason: string }];
	"weather:updated": [];
	"location:updated": [];
	"settings:changed": [];
}

export interface UmOSDiagnosticEvent {
	event: string;
	timestamp: number;
	payload?: unknown;
}

export interface UmOSWidgetDiagnostic {
	blockName: string;
	sourcePath?: string;
	errors: string[];
	warnings: string[];
	timestamp: number;
}

export interface UmOSDiagnosticsSnapshot {
	recentEvents: UmOSDiagnosticEvent[];
	widgetErrors: UmOSWidgetDiagnostic[];
	renderedWidgets: number;
	renderedByBlock: Record<string, number>;
}

export class EventBus {
	private events: Events;
	private recentEvents: UmOSDiagnosticEvent[] = [];
	private widgetErrors: UmOSWidgetDiagnostic[] = [];
	private renderedWidgets = 0;
	private renderedByBlock: Record<string, number> = {};
	private readonly diagnosticLimit = 80;

	constructor() {
		this.events = new Events();
	}

	on<K extends keyof UmOSEventMap>(
		event: K,
		callback: (...args: UmOSEventMap[K]) => void,
		ctx?: unknown
	): void {
		this.events.on(
			event as string,
			callback as (...args: unknown[]) => void,
			ctx
		);
	}

	off<K extends keyof UmOSEventMap>(
		event: K,
		callback: (...args: UmOSEventMap[K]) => void
	): void {
		this.events.off(
			event as string,
			callback as (...args: unknown[]) => void
		);
	}

	emit<K extends keyof UmOSEventMap>(
		event: K,
		...args: UmOSEventMap[K]
	): void {
		this.recordEvent(event as string, args[0]);
		this.events.trigger(event as string, ...args);
	}

	offAll(): void {
		this.events = new Events();
	}

	recordWidgetRender(blockName: string): void {
		this.renderedWidgets++;
		this.renderedByBlock[blockName] = (this.renderedByBlock[blockName] ?? 0) + 1;
	}

	recordWidgetConfigInvalid(data: {
		blockName: string;
		sourcePath?: string;
		errors: string[];
		warnings: string[];
	}): void {
		this.widgetErrors.unshift({ ...data, timestamp: Date.now() });
		this.widgetErrors = this.widgetErrors.slice(0, this.diagnosticLimit);
	}

	getDiagnostics(): UmOSDiagnosticsSnapshot {
		return {
			recentEvents: [...this.recentEvents],
			widgetErrors: [...this.widgetErrors],
			renderedWidgets: this.renderedWidgets,
			renderedByBlock: { ...this.renderedByBlock },
		};
	}

	clearDiagnostics(): void {
		this.recentEvents = [];
		this.widgetErrors = [];
		this.renderedWidgets = 0;
		this.renderedByBlock = {};
	}

	private recordEvent(event: string, payload?: unknown): void {
		this.recentEvents.unshift({ event, timestamp: Date.now(), payload });
		this.recentEvents = this.recentEvents.slice(0, this.diagnosticLimit);
	}
}
