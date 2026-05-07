import { App, TFile } from "obsidian";
import { EventBus } from "../EventBus";
import { debounce } from "../utils/dom";

/**
 * FrontmatterHelper — thu/ frontmatter  debounce  optimistic update.
 *     input-.
 */
export class FrontmatterHelper {
	private app: App;
	private eventBus: EventBus;
	private debouncedWriters: Map<string, (value: unknown) => void>;

	constructor(app: App, eventBus: EventBus) {
		this.app = app;
		this.eventBus = eventBus;
		this.debouncedWriters = new Map();
	}

	/**
	 *   of frontmatter  .
	 */
	readProperty(file: TFile, property: string): unknown {
		const cache = this.app.metadataCache.getFileCache(file);
		if (!cache?.frontmatter) return undefined;
		return cache.frontmatter[property];
	}

	/**
	 *    frontmatter  debounce 300.
	 *  frontmatter:changed  EventBus.
	 */
	writeProperty(file: TFile, property: string, value: unknown): void {
		const key = `${file.path}::${property}`;

		let writer = this.debouncedWriters.get(key);
		if (!writer) {
			writer = debounce((val: unknown) => {
				this.doWrite(file, property, val);
			}, 300);
			this.debouncedWriters.set(key, writer);
		}

		writer(value);
	}

	/**
	 *   ( debounce).    .
	 */
	writePropertyImmediate(file: TFile, property: string, value: unknown): void {
		this.doWrite(file, property, value);
	}

	/**
	 *   in processFrontMatter.
	 */
	private async doWrite(file: TFile, property: string, value: unknown): Promise<void> {
		try {
			await this.app.fileManager.processFrontMatter(file, (fm) => {
				fm[property] = value;
			});

			this.eventBus.emit("frontmatter:changed", {
				path: file.path,
				property,
				value,
			});
		} catch (error) {
			console.error(`umOS: failed to write frontmatter [${property}]:`, error);
		}
	}

	/**
	 *   .
	 */
	destroy(): void {
		this.debouncedWriters.clear();
	}
}