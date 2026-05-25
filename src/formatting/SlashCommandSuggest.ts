import {
	App,
	Editor,
	EditorPosition,
	EditorSuggest,
	EditorSuggestContext,
	EditorSuggestTriggerInfo,
	TFile,
} from "obsidian";
import { t } from "../i18n";
import { FormatItem, ITEMS, KanbanBoardPickerModal } from "./FormatPickerModal";

export class SlashCommandSuggest extends EditorSuggest<FormatItem> {
	private existingBoardIds: string[] = [];

	constructor(app: App) {
		super(app);
	}

	setBoardIds(boardIds: string[]) {
		this.existingBoardIds = boardIds;
	}

	onTrigger(
		cursor: EditorPosition,
		editor: Editor,
		file: TFile
	): EditorSuggestTriggerInfo | null {
		const line = editor.getLine(cursor.line);
		const prefix = line.substring(0, cursor.ch);

		// Match `/` at the beginning of a line or after a space
		// It will capture the text after `/` as the query
		const match = prefix.match(/(?:^|\s)\/([^\s]*)$/);
		if (match) {
			return {
				start: { line: cursor.line, ch: match.index! + (prefix.endsWith(match[0]) && match[0].startsWith(" ") ? 1 : 0) },
				end: cursor,
				query: match[1],
			};
		}

		return null;
	}

	getSuggestions(context: EditorSuggestContext): FormatItem[] {
		const q = context.query.toLowerCase().trim();
		if (!q) return ITEMS;

		return ITEMS.filter((item) => {
			const textToSearch = [
				item.name,
				t(item.name),
				item.desc,
				t(item.desc),
				...(item.keywords ?? []),
			]
				.join(" ")
				.toLowerCase();
			return textToSearch.includes(q);
		});
	}

	renderSuggestion(item: FormatItem, el: HTMLElement): void {
		el.addClass("umos-slash-item");

		const iconEl = el.createSpan({ cls: "umos-slash-icon" });
		iconEl.textContent = item.icon;

		const textEl = el.createDiv({ cls: "umos-slash-text" });
		textEl.createDiv({ cls: "umos-slash-name", text: t(item.name) });
		textEl.createDiv({ cls: "umos-slash-desc", text: t(item.desc) });
	}

	selectSuggestion(item: FormatItem, evt: MouseEvent | KeyboardEvent): void {
		const context = this.context;
		if (!context) return;

		const editor = context.editor;

		// Remove the typed `/query`
		editor.replaceRange("", context.start, context.end);

		// Kanban specific
		if (item.id === "kanban-board") {
			new KanbanBoardPickerModal(this.app, this.existingBoardIds, (boardId) => {
				const snippet = "```kanban-board\nid: " + boardId + "\n```";
				this.insertBlockSnippet(editor, snippet);
			}).open();
			return;
		}

		if (item.isCssClass) {
			this.addCssClass(item.snippet);
		} else {
			const snippet = this.prepareSnippet(item, "");
			if (item.isBlock) {
				this.insertBlockSnippet(editor, snippet);
			} else {
				editor.replaceSelection(snippet);
			}
		}
	}

	private insertBlockSnippet(editor: Editor, snippet: string) {
		const cursor = editor.getCursor();
		const lineText = editor.getLine(cursor.line);
		const beforeCursor = lineText.slice(0, cursor.ch);

		if (beforeCursor.trim() !== "") {
			editor.replaceSelection("\n\n" + snippet);
		} else if (cursor.line > 0) {
			const prevLine = editor.getLine(cursor.line - 1);
			if (prevLine.trim() !== "") {
				editor.replaceSelection("\n" + snippet);
			} else {
				editor.replaceSelection(snippet);
			}
		} else {
			editor.replaceSelection(snippet);
		}
	}

	private prepareSnippet(item: FormatItem, selection: string): string {
		const fallback = item.placeholder ?? "text";
		const selectedText = selection.trim().length > 0 ? selection : fallback;
		const blockquote = selectedText
			.split("\n")
			.map((line) => `> ${line}`)
			.join("\n");

		return t(item.snippet)
			.replaceAll("{{selection}}", selectedText)
			.replaceAll("{{blockquote}}", blockquote);
	}

	private addCssClass(cls: string): void {
		const file = this.app.workspace.getActiveFile();
		if (!file) return;

		this.app.fileManager.processFrontMatter(file, (fm) => {
			if (!fm.cssclasses) {
				fm.cssclasses = [cls];
			} else if (Array.isArray(fm.cssclasses)) {
				if (!fm.cssclasses.includes(cls)) fm.cssclasses.push(cls);
			} else if (typeof fm.cssclasses === "string") {
				if (fm.cssclasses !== cls) fm.cssclasses = [fm.cssclasses, cls];
			}
		});
	}
}
