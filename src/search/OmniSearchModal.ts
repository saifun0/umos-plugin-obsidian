import { App, MarkdownView, Modal, Notice, TFile, setIcon } from "obsidian";
import type UmOSPlugin from "../main";
import { t } from "../i18n";
import { createElement } from "../utils/dom";
import { CommandService } from "../input/CommandService";
import {
	OmniSearchService,
	type OmniSearchAction,
	type OmniSearchKind,
	type OmniSearchResult,
} from "./OmniSearchService";

const FILTERS: Array<{ id: OmniSearchKind | "all"; label: string; icon: string }> = [
	{ id: "all", label: "All entities", icon: "sparkles" },
	{ id: "task", label: "Tasks", icon: "check-square" },
	{ id: "project", label: "Projects", icon: "rocket" },
	{ id: "image", label: "Images", icon: "images" },
	{ id: "content", label: "Content", icon: "boxes" },
	{ id: "setting", label: "Settings", icon: "settings-2" },
	{ id: "command", label: "Commands", icon: "terminal" },
	{ id: "widget", label: "Widgets", icon: "blocks" },
	{ id: "file", label: "Files", icon: "file-text" },
];

const KIND_LABEL: Record<OmniSearchKind, string> = {
	task: "Task",
	project: "Project",
	image: "Image",
	content: "Content",
	setting: "Setting",
	command: "Command",
	widget: "Widget",
	file: "File",
};

export class OmniSearchModal extends Modal {
	private service: OmniSearchService;
	private index: OmniSearchResult[] = [];
	private results: OmniSearchResult[] = [];
	private activeFilter: OmniSearchKind | "all" = "all";
	private selectedIndex = 0;
	private inputEl: HTMLInputElement | null = null;
	private inputWrapEl: HTMLElement | null = null;
	private inputIconEl: HTMLElement | null = null;
	private filtersEl: HTMLElement | null = null;
	private resultsEl: HTMLElement | null = null;
	private statusEl: HTMLElement | null = null;

	constructor(
		app: App,
		private plugin: UmOSPlugin,
	) {
		super(app);
		this.service = new OmniSearchService(app, plugin);
	}

	onOpen(): void {
		this.modalEl.addClass("umos-omni-search-modal");
		this.contentEl.addClass("umos-omni-search-content");
		this.renderShell();
		void this.buildIndex();
	}

	onClose(): void {
		this.contentEl.empty();
		this.contentEl.removeClass("umos-omni-search-content");
	}

	private renderShell(): void {
		this.contentEl.empty();
		const shell = createElement("div", { cls: "umos-omni-shell", parent: this.contentEl });

		const header = createElement("div", { cls: "umos-omni-header", parent: shell });
		const titleWrap = createElement("div", { cls: "umos-omni-title-wrap", parent: header });
		const titleIcon = createElement("span", { cls: "umos-omni-title-icon", parent: titleWrap });
		setIcon(titleIcon, "search");
		const titleText = createElement("div", { cls: "umos-omni-title-text", parent: titleWrap });
		createElement("div", { cls: "umos-omni-title", text: t("Better Search"), parent: titleText });
		createElement("div", {
			cls: "umos-omni-subtitle",
			text: t("Search tasks, projects, images, content, settings, commands, and widgets."),
			parent: titleText,
		});

		const searchWrap = createElement("div", { cls: "umos-omni-input-wrap", parent: shell });
		this.inputWrapEl = searchWrap;
		this.inputIconEl = createElement("span", { cls: "umos-omni-input-icon", parent: searchWrap });
		setIcon(this.inputIconEl, "search");
		this.inputEl = searchWrap.createEl("input", {
			cls: "umos-omni-input",
			attr: {
				type: "search",
				placeholder: t("Search notes, or type > for commands..."),
				autocomplete: "off",
				spellcheck: "false",
			},
		}) as HTMLInputElement;

		this.filtersEl = createElement("div", { cls: "umos-omni-filters", parent: shell });
		this.resultsEl = createElement("div", { cls: "umos-omni-results", parent: shell });
		this.statusEl = createElement("div", { cls: "umos-omni-status", text: t("Building search index..."), parent: shell });

		this.inputEl.addEventListener("input", () => this.refreshResults());
		this.inputEl.addEventListener("keydown", (event) => this.handleKeydown(event));
		setTimeout(() => this.inputEl?.focus(), 40);
	}

	private async buildIndex(): Promise<void> {
		this.index = await this.service.buildIndex();
		this.renderFilters();
		this.refreshResults();
	}

	private renderFilters(): void {
		if (!this.filtersEl) return;
		this.filtersEl.empty();
		const counts = this.getKindCounts();

		for (const filter of FILTERS) {
			const count = filter.id === "all" ? this.index.length : counts[filter.id] ?? 0;
			const button = createElement("button", {
				cls: `umos-omni-filter${this.activeFilter === filter.id ? " is-active" : ""}`,
				attr: { type: "button" },
				parent: this.filtersEl,
			});
			const icon = createElement("span", { cls: "umos-omni-filter-icon", parent: button });
			setIcon(icon, filter.icon);
			createElement("span", { cls: "umos-omni-filter-label", text: t(filter.label), parent: button });
			createElement("span", { cls: "umos-omni-filter-count", text: String(count), parent: button });
			button.addEventListener("click", () => {
				this.activeFilter = filter.id;
				this.selectedIndex = 0;
				this.renderFilters();
				this.refreshResults();
			});
		}
	}

	private refreshResults(): void {
		const query = this.inputEl?.value ?? "";
		const isCommandMode = isCommandQuery(query);
		this.inputWrapEl?.toggleClass("is-command-mode", isCommandMode);
		if (this.inputIconEl) setIcon(this.inputIconEl, isCommandMode ? "terminal" : "search");
		this.results = this.service.search(this.index, query, this.activeFilter);
		this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, this.results.length - 1));
		this.renderResults();
	}

	private renderResults(): void {
		if (!this.resultsEl || !this.statusEl) return;
		this.resultsEl.empty();

		if (this.index.length === 0) {
			this.renderEmpty("No entities indexed", "Try again after Obsidian finishes loading the vault.");
			this.statusEl.textContent = t("Building search index...");
			return;
		}

		if (this.results.length === 0) {
			this.renderEmpty("No matching entities", "Try another query or filter.");
			this.statusEl.textContent = `${this.index.length} ${t("entities indexed")}`;
			return;
		}

		for (const [index, result] of this.results.entries()) {
			this.renderResult(result, index);
		}

		this.statusEl.textContent = `${this.results.length} ${t("results")} · ${this.index.length} ${t("entities indexed")} · ${t("Enter to open")}`;
		this.scrollSelectedIntoView();
	}

	private renderResult(result: OmniSearchResult, index: number): void {
		if (!this.resultsEl) return;
		const highlightTerms = getHighlightTerms(this.inputEl?.value ?? "");
		const row = createElement("button", {
			cls: `umos-omni-result is-${result.kind}${index === this.selectedIndex ? " is-selected" : ""}`,
			attr: { type: "button", title: result.path ?? result.detail ?? result.title },
			parent: this.resultsEl,
		});
		if (result.accent) row.style.setProperty("--umos-omni-accent", result.accent);

		if (result.thumbnail) {
			const thumb = createElement("span", { cls: "umos-omni-thumb", parent: row });
			const img = thumb.createEl("img", { attr: { src: result.thumbnail, alt: "" } });
			img.addEventListener("error", () => {
				thumb.empty();
				setIcon(thumb, result.icon);
				thumb.addClass("is-fallback");
			}, { once: true });
		 } else {
			const icon = createElement("span", { cls: "umos-omni-result-icon", parent: row });
			setIcon(icon, result.icon);
		}

		const body = createElement("span", { cls: "umos-omni-result-body", parent: row });
		const top = createElement("span", { cls: "umos-omni-result-top", parent: body });
		const titleEl = createElement("span", { cls: "umos-omni-result-title", parent: top });
		renderHighlightedText(titleEl, result.title, highlightTerms);
		createElement("span", { cls: "umos-omni-kind", text: t(KIND_LABEL[result.kind]), parent: top });
		createElement("span", { cls: "umos-omni-result-subtitle", text: t(result.subtitle), parent: body });
		if (result.detail) {
			const detailEl = createElement("span", { cls: "umos-omni-result-detail", parent: body });
			renderHighlightedText(detailEl, translateSearchDetail(result.detail), highlightTerms);
		}

		const badges = (result.badges ?? []).filter(Boolean).slice(0, 4);
		if (badges.length > 0) {
			const badgeWrap = createElement("span", { cls: "umos-omni-badges", parent: body });
			for (const badge of badges) {
				const badgeEl = createElement("span", { cls: "umos-omni-badge", parent: badgeWrap });
				renderHighlightedText(badgeEl, t(badge), highlightTerms);
			}
		}

		const action = createElement("span", { cls: "umos-omni-action", parent: row });
		setIcon(action, result.action.type === "copy-text" ? "copy" : "corner-down-left");

		row.addEventListener("mouseenter", () => {
			this.selectedIndex = index;
			this.updateSelectedClass();
		});
		row.addEventListener("click", () => void this.activate(result));
	}

	private renderEmpty(title: string, detail: string): void {
		if (!this.resultsEl) return;
		const empty = createElement("div", { cls: "umos-omni-empty", parent: this.resultsEl });
		const icon = createElement("span", { cls: "umos-omni-empty-icon", parent: empty });
		setIcon(icon, "search-x");
		createElement("div", { cls: "umos-omni-empty-title", text: t(title), parent: empty });
		createElement("div", { cls: "umos-omni-empty-detail", text: t(detail), parent: empty });
	}

	private handleKeydown(event: KeyboardEvent): void {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			this.selectedIndex = Math.min(this.results.length - 1, this.selectedIndex + 1);
			this.updateSelectedClass();
			this.scrollSelectedIntoView();
			return;
		}
		if (event.key === "ArrowUp") {
			event.preventDefault();
			this.selectedIndex = Math.max(0, this.selectedIndex - 1);
			this.updateSelectedClass();
			this.scrollSelectedIntoView();
			return;
		}
		if (event.key === "Enter") {
			event.preventDefault();
			const result = this.results[this.selectedIndex];
			if (result) void this.activate(result);
		}
		if (event.key === "Tab") {
			const result = this.results[this.selectedIndex];
			if (result?.action.type === "fill-query") {
				event.preventDefault();
				void this.activate(result);
			}
		}
	}

	private updateSelectedClass(): void {
		if (!this.resultsEl) return;
		Array.from(this.resultsEl.children).forEach((child, index) => {
			child.toggleClass("is-selected", index === this.selectedIndex);
		});
	}

	private scrollSelectedIntoView(): void {
		if (!this.resultsEl) return;
		const selected = this.resultsEl.children[this.selectedIndex] as HTMLElement | undefined;
		selected?.scrollIntoView({ block: "nearest" });
	}

	private async activate(result: OmniSearchResult): Promise<void> {
		await this.runAction(result.action);
	}

	private async runAction(action: OmniSearchAction): Promise<void> {
		if (action.type === "open-file") {
			this.close();
			await this.openFile(action.path, action.line);
			return;
		}

		if (action.type === "plugin-command") {
			this.close();
			this.runPluginCommand(action.commandId);
			return;
		}

		if (action.type === "open-settings") {
			this.close();
			this.openSettings(action.section);
			return;
		}

		if (action.type === "execute-command") {
			await this.executeCommand(action.raw);
			return;
		}

		if (action.type === "fill-query") {
			this.fillQuery(action.raw);
			return;
		}

		await navigator.clipboard.writeText(action.text);
		new Notice(t(action.message));
	}

	private async executeCommand(raw: string): Promise<void> {
		const service = new CommandService(this.plugin);
		const activeFile = this.app.workspace.getActiveFile();
		const command = stripCommandPrefix(raw);
		const result = await service.execute(command, {
			sourcePath: activeFile?.path ?? null,
			config: { target: "current" },
			notify: true,
		});
		if (this.statusEl) {
			this.statusEl.textContent = result.ok ? result.message : `${t("Command failed")}: ${result.message}`;
			this.statusEl.toggleClass("is-error", !result.ok);
		}
		if (result.ok) {
			if (this.inputEl) this.inputEl.value = "";
			await this.buildIndex();
		}
	}

	private fillQuery(raw: string): void {
		if (!this.inputEl) return;
		this.inputEl.value = raw;
		this.inputEl.focus();
		this.inputEl.setSelectionRange(raw.length, raw.length);
		this.refreshResults();
	}

	private async openFile(path: string, line?: number): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) {
			new Notice(`${t("Not found")}: ${path}`);
			return;
		}
		const leaf = this.app.workspace.getLeaf(false);
		await leaf.openFile(file, {
			active: true,
			state: file.extension === "md" ? { mode: "source", source: false } : undefined,
		});
		this.app.workspace.setActiveLeaf(leaf, { focus: true });
		if (typeof line === "number" && leaf.view instanceof MarkdownView) {
			const editor = leaf.view.editor;
			const targetLine = Math.max(0, Math.min(line, Math.max(0, editor.lineCount() - 1)));
			editor.focus();
			editor.setCursor({ line: targetLine, ch: 0 });
			editor.scrollIntoView({ from: { line: targetLine, ch: 0 }, to: { line: targetLine, ch: 0 } }, true);
			this.flashOpenedLine(leaf.view);
		}
	}

	private flashOpenedLine(view: MarkdownView): void {
		let attempts = 0;
		const flash = () => {
			attempts++;
			const lineEl = this.findOpenedEditorLine(view);
			if (!lineEl) {
				if (attempts < 10) window.setTimeout(flash, 80);
				return;
			}
			lineEl.classList.add("umos-omni-open-line-highlight");
			window.setTimeout(() => lineEl.classList.remove("umos-omni-open-line-highlight"), 2600);
		};
		window.setTimeout(flash, 80);
	}

	private findOpenedEditorLine(view: MarkdownView): HTMLElement | null {
		const active = view.containerEl.querySelector<HTMLElement>(".cm-activeLine, .cm-active");
		if (active) return active.closest<HTMLElement>(".cm-line") ?? active;

		const cm = (view.editor as unknown as {
			cm?: {
				domAtPos?: (pos: number) => { node: Node; offset: number };
				state?: { doc?: { line: (lineNumber: number) => { from: number } } };
			};
		}).cm;
		const cursor = view.editor.getCursor();
		const line = cm?.state?.doc?.line(cursor.line + 1);
		if (!line || !cm?.domAtPos) return null;
		const node = cm.domAtPos(line.from).node;
		const element = node instanceof HTMLElement ? node : node.parentElement;
		return element?.closest<HTMLElement>(".cm-line") ?? null;
	}

	private runPluginCommand(commandId: string): void {
		const commands = (this.app as unknown as { commands?: { executeCommandById?: (id: string) => boolean } }).commands;
		const fullId = `${this.plugin.manifest.id}:${commandId}`;
		const ok = commands?.executeCommandById?.(fullId);
		if (!ok) commands?.executeCommandById?.(commandId);
	}

	private openSettings(_section?: string): void {
		const setting = (this.app as unknown as {
			setting?: {
				open?: () => void;
				openTabById?: (id: string) => void;
			};
		}).setting;
		setting?.open?.();
		setting?.openTabById?.(this.plugin.manifest.id);
	}

	private getKindCounts(): Partial<Record<OmniSearchKind, number>> {
		return this.index.reduce<Partial<Record<OmniSearchKind, number>>>((acc, result) => {
			acc[result.kind] = (acc[result.kind] ?? 0) + 1;
			return acc;
		}, {});
	}
}

function isCommandQuery(query: string): boolean {
	return query.trimStart().startsWith(">");
}

function stripCommandPrefix(raw: string): string {
	const trimmed = raw.trim();
	return trimmed.startsWith(">") ? trimmed.slice(1).trim() : trimmed;
}

function translateSearchDetail(detail: string): string {
	return detail.split(" - ").map((part) => t(part)).join(" - ");
}

interface HighlightRange {
	start: number;
	end: number;
}

function getHighlightTerms(query: string): string[] {
	const normalizedTerms = new Set<string>();
	for (const term of query.split(/\s+/)) {
		const normalized = normalizeHighlightText(term);
		if (normalized.length >= 2) normalizedTerms.add(normalized);
	}
	return Array.from(normalizedTerms).sort((a, b) => b.length - a.length);
}

function renderHighlightedText(parent: HTMLElement, text: string, terms: string[]): void {
	parent.empty();
	if (terms.length === 0 || !text) {
		parent.appendText(text);
		return;
	}
	const ranges = findHighlightRanges(text, terms);
	if (ranges.length === 0) {
		parent.appendText(text);
		return;
	}

	let cursor = 0;
	for (const range of ranges) {
		if (range.start > cursor) parent.appendText(text.slice(cursor, range.start));
		createElement("mark", {
			cls: "umos-omni-match",
			text: text.slice(range.start, range.end),
			parent,
		});
		cursor = range.end;
	}
	if (cursor < text.length) parent.appendText(text.slice(cursor));
}

function findHighlightRanges(text: string, terms: string[]): HighlightRange[] {
	const { normalized, indexMap } = buildNormalizedIndex(text);
	const ranges: HighlightRange[] = [];
	for (const term of terms) {
		let from = 0;
		while (from < normalized.length) {
			const found = normalized.indexOf(term, from);
			if (found === -1) break;
			const start = indexMap[found] ?? 0;
			const end = (indexMap[found + term.length - 1] ?? start) + 1;
			ranges.push({ start, end });
			from = found + Math.max(1, term.length);
		}
	}
	return mergeHighlightRanges(ranges);
}

function buildNormalizedIndex(text: string): { normalized: string; indexMap: number[] } {
	let normalized = "";
	const indexMap: number[] = [];
	for (let i = 0; i < text.length; i++) {
		const next = normalizeHighlightText(text[i]);
		for (let j = 0; j < next.length; j++) {
			normalized += next[j];
			indexMap.push(i);
		}
	}
	return { normalized, indexMap };
}

function mergeHighlightRanges(ranges: HighlightRange[]): HighlightRange[] {
	return ranges
		.sort((a, b) => a.start - b.start || b.end - a.end)
		.reduce<HighlightRange[]>((merged, range) => {
			const last = merged[merged.length - 1];
			if (!last || range.start > last.end) {
				merged.push({ ...range });
				return merged;
			}
			last.end = Math.max(last.end, range.end);
			return merged;
		}, []);
}

function normalizeHighlightText(value: string): string {
	return value
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/ё/g, "е");
}
