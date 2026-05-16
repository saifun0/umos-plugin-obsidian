import { Modal, Notice, setIcon, TFile } from "obsidian";
import type { MarkdownPostProcessorContext } from "obsidian";
import { BaseWidget } from "../../core/BaseWidget";
import type { EventSubscription } from "../../core/BaseWidget";
import { EventBus } from "../../EventBus";
import { t } from "../../i18n";
import type UmOSPlugin from "../../main";

interface ProgressColumn {
	id: string;
	label: string;
}

interface ProgressRow {
	id: string;
	label: string;
}

interface ProgressGroup {
	id: string;
	title: string;
	rows: ProgressRow[];
}

interface ProgressTableConfig {
	id: string;
	title: string;
	columns: ProgressColumn[];
	groups: ProgressGroup[];
	mark: string;
	showSummary: boolean;
}

interface ProgressTableEditGroup {
	title: string;
	rows: string[];
}

interface ProgressTableEditState {
	id: string;
	title: string;
	columns: string[];
	groups: ProgressTableEditGroup[];
	mark: string;
	showSummary: boolean;
}

export class ProgressTableWidget extends BaseWidget {
	private readonly config: ProgressTableConfig;

	constructor(
		containerEl: HTMLElement,
		private readonly source: string,
		private readonly sourcePath: string | undefined,
		private readonly plugin: UmOSPlugin,
		eventBus: EventBus,
		private readonly markdownContext?: MarkdownPostProcessorContext,
		private readonly sectionEl?: HTMLElement,
	) {
		super(containerEl);
		this.eventBus = eventBus;
		this.config = this.parseConfig(source, sourcePath);
	}

	protected subscribeToEvents(): EventSubscription[] {
		return [
			{
				event: "progress-table:changed",
				handler: (data) => {
					if (data.id === this.config.id) this.render();
				},
			},
		];
	}

	protected render(): void {
		this.containerEl.empty();

		const wrapper = this.containerEl.createDiv({ cls: "umos-progress-table" });
		this.renderHeader(wrapper);

		if (this.config.groups.length === 0 || this.config.columns.length === 0) {
			this.renderEmpty(wrapper);
			return;
		}

		const groupsEl = wrapper.createDiv({ cls: "umos-progress-table-groups" });
		for (const group of this.config.groups) {
			this.renderGroup(groupsEl, group);
		}
	}

	private renderHeader(parent: HTMLElement): void {
		const header = parent.createDiv({ cls: "umos-progress-table-header" });
		const titleRow = header.createDiv({ cls: "umos-progress-table-title-row" });
		const icon = titleRow.createSpan({ cls: "umos-progress-table-icon" });
		setIcon(icon, "table-2");
		titleRow.createDiv({ cls: "umos-progress-table-title", text: this.config.title });

		const actions = header.createDiv({ cls: "umos-progress-table-actions" });

		if (this.config.showSummary) {
			const stats = this.getStats();
			const summary = actions.createDiv({ cls: "umos-progress-table-summary" });
			this.createSummaryChip(summary, `${stats.done}/${stats.total}`, t("Marked"));
			this.createSummaryChip(summary, `${stats.percent}%`, t("Progress"));
			this.createSummaryChip(summary, String(stats.rows), t("Rows"));
		}

		const editButton = actions.createEl("button", {
			cls: "umos-progress-table-edit-btn",
			attr: { type: "button", title: t("Edit table"), "aria-label": t("Edit table") },
		});
		setIcon(editButton, "pencil");
		editButton.addEventListener("click", () => this.openEditor());
	}

	private renderEmpty(parent: HTMLElement): void {
		const empty = parent.createDiv({ cls: "umos-progress-table-empty" });
		empty.createDiv({ cls: "umos-progress-table-empty-title", text: t("Nothing to track yet") });
		empty.createDiv({
			cls: "umos-progress-table-empty-text",
			text: t("Add columns and groups to the progress-table block."),
		});
	}

	private renderGroup(parent: HTMLElement, group: ProgressGroup): void {
		const groupStats = this.getGroupStats(group);
		const groupEl = parent.createDiv({ cls: "umos-progress-table-group" });
		const head = groupEl.createDiv({ cls: "umos-progress-table-group-head" });
		head.createDiv({ cls: "umos-progress-table-group-title", text: group.title });
		head.createDiv({
			cls: "umos-progress-table-group-count",
			text: `${groupStats.done}/${groupStats.total}`,
			attr: { "aria-label": t("Marked") },
		});

		const scroll = groupEl.createDiv({ cls: "umos-progress-table-scroll" });
		const table = scroll.createEl("table", { cls: "umos-progress-table-grid" });
		const thead = table.createEl("thead");
		const headRow = thead.createEl("tr");
		headRow.createEl("th", { text: t("Item") });
		for (const column of this.config.columns) {
			headRow.createEl("th", { text: column.label });
		}

		const tbody = table.createEl("tbody");
		for (const row of group.rows) {
			const tr = tbody.createEl("tr");
			tr.createEl("th", { cls: "umos-progress-table-row-label", text: row.label });
			for (const column of this.config.columns) {
				const td = tr.createEl("td");
				this.renderCell(td, group, row, column);
			}
		}
	}

	private renderCell(parent: HTMLElement, group: ProgressGroup, row: ProgressRow, column: ProgressColumn): void {
		const key = this.getCellKey(group, row, column);
		const checked = this.isChecked(key);
		const btn = parent.createEl("button", {
			cls: `umos-progress-table-cell${checked ? " is-checked" : ""}`,
			text: checked ? this.config.mark : "",
			attr: {
				type: "button",
				"aria-pressed": String(checked),
				"aria-label": `${column.label}: ${row.label}`,
				title: t("Click to toggle"),
			},
		});
		btn.addEventListener("click", () => this.toggleCell(key));
	}

	private createSummaryChip(parent: HTMLElement, value: string, label: string): void {
		const chip = parent.createDiv({ cls: "umos-progress-table-chip" });
		chip.createSpan({ cls: "umos-progress-table-chip-value", text: value });
		chip.createSpan({ cls: "umos-progress-table-chip-label", text: label });
	}

	private openEditor(): void {
		new ProgressTableEditModal(this.plugin, this.toEditState(), async (state) => {
			await this.replaceSourceBlock(this.serializeEditState(state));
		}).open();
	}

	private toEditState(): ProgressTableEditState {
		return {
			id: this.config.id,
			title: this.config.title,
			columns: this.config.columns.map((column) => column.label),
			groups: this.config.groups.map((group) => ({
				title: group.title,
				rows: group.rows.map((row) => row.label),
			})),
			mark: this.config.mark,
			showSummary: this.config.showSummary,
		};
	}

	private async replaceSourceBlock(nextSource: string): Promise<void> {
		if (!this.sourcePath) {
			new Notice(t("Could not find source note."));
			return;
		}
		const file = this.plugin.app.vault.getAbstractFileByPath(this.sourcePath);
		if (!(file instanceof TFile)) {
			new Notice(t("Could not find source note."));
			return;
		}

		const content = await this.plugin.app.vault.read(file);
		const nextBlock = `\`\`\`progress-table\n${nextSource}\n\`\`\``;
		const replaced = this.replaceBySectionInfo(content, nextBlock) ?? this.replaceByMatchingSource(content, nextBlock);
		if (!replaced) {
			new Notice(t("Could not update this progress table block."));
			return;
		}

		await this.plugin.app.vault.modify(file, replaced);
		new Notice(t("Progress table updated"));
	}

	private replaceBySectionInfo(content: string, nextBlock: string): string | null {
		const section = this.markdownContext?.getSectionInfo(this.sectionEl ?? this.containerEl);
		if (!section || section.lineStart < 0 || section.lineEnd < section.lineStart) return null;
		const newline = content.includes("\r\n") ? "\r\n" : "\n";
		const lines = content.split(/\r?\n/);
		if (section.lineStart >= lines.length) return null;
		lines.splice(section.lineStart, section.lineEnd - section.lineStart + 1, ...nextBlock.split("\n"));
		return lines.join(newline);
	}

	private replaceByMatchingSource(content: string, nextBlock: string): string | null {
		const normalizedContent = content.replace(/\r\n/g, "\n");
		const normalizedSource = this.source.replace(/\r\n/g, "\n").trim();
		const regex = /```progress-table[^\n]*\n([\s\S]*?)\n```/g;
		let match: RegExpExecArray | null;
		while ((match = regex.exec(normalizedContent)) !== null) {
			if (match[1].trim() !== normalizedSource) continue;
			return `${normalizedContent.slice(0, match.index)}${nextBlock}${normalizedContent.slice(match.index + match[0].length)}`;
		}
		return null;
	}

	private serializeEditState(state: ProgressTableEditState): string {
		const lines = [
			`id: ${state.id.trim() || this.config.id}`,
			`title: ${state.title.trim() || t("Progress Table")}`,
			`columns: [${state.columns.map((column) => column.trim()).filter(Boolean).join(", ")}]`,
			`mark: ${state.mark.trim() || "+"}`,
			`summary: ${state.showSummary ? "true" : "false"}`,
			"groups:",
		];
		for (const group of state.groups) {
			const title = group.title.trim();
			const rows = group.rows.map((row) => row.trim()).filter(Boolean);
			if (!title || rows.length === 0) continue;
			lines.push(`  ${title}: ${rows.join(", ")}`);
		}
		return lines.join("\n");
	}

	private toggleCell(key: string): void {
		if (!this.plugin.data_store.progressTables) {
			this.plugin.data_store.progressTables = {};
		}
		const table = this.plugin.data_store.progressTables[this.config.id] ?? {
			id: this.config.id,
			cells: {},
			updatedAt: Date.now(),
		};
		if (table.cells[key]) {
			delete table.cells[key];
		} else {
			table.cells[key] = true;
		}
		table.updatedAt = Date.now();
		this.plugin.data_store.progressTables[this.config.id] = table;
		this.render();
		void this.plugin.saveSettings()
			.then(() => this.plugin.eventBus.emit("progress-table:changed", { id: this.config.id }))
			.catch((error) => console.error("umOS: failed to save progress table:", error));
	}

	private isChecked(key: string): boolean {
		return Boolean(this.plugin.data_store.progressTables?.[this.config.id]?.cells?.[key]);
	}

	private getStats(): { done: number; total: number; rows: number; percent: number } {
		let done = 0;
		let total = 0;
		let rows = 0;
		for (const group of this.config.groups) {
			rows += group.rows.length;
			for (const row of group.rows) {
				for (const column of this.config.columns) {
					total++;
					if (this.isChecked(this.getCellKey(group, row, column))) done++;
				}
			}
		}
		return { done, total, rows, percent: total > 0 ? Math.round((done / total) * 100) : 0 };
	}

	private getGroupStats(group: ProgressGroup): { done: number; total: number } {
		let done = 0;
		let total = 0;
		for (const row of group.rows) {
			for (const column of this.config.columns) {
				total++;
				if (this.isChecked(this.getCellKey(group, row, column))) done++;
			}
		}
		return { done, total };
	}

	private getCellKey(group: ProgressGroup, row: ProgressRow, column: ProgressColumn): string {
		return `${group.id}::${row.id}::${column.id}`;
	}

	private parseConfig(source: string, sourcePath?: string): ProgressTableConfig {
		const lines = source.split(/\r?\n/);
		let id = "";
		let title = t("Progress Table");
		let columns = [this.createColumn(t("Done"), 0)];
		let mark = "+";
		let showSummary = true;
		const groups: ProgressGroup[] = [];
		let insideGroups = false;

		for (const rawLine of lines) {
			const trimmed = rawLine.trim();
			if (!trimmed || trimmed.startsWith("#")) continue;

			if (insideGroups) {
				const nextKey = this.readKeyValue(trimmed);
				if (nextKey && this.isTopLevelKey(nextKey.key)) {
					insideGroups = false;
				} else {
					for (const group of this.parseGroupLines(trimmed, groups.length)) {
						groups.push(group);
					}
					continue;
				}
			}

			const kv = this.readKeyValue(trimmed);
			if (!kv) continue;

			switch (kv.key) {
				case "id":
					id = kv.value;
					break;
				case "title":
					title = kv.value || title;
					break;
				case "columns":
				case "cols":
				case "labels":
					columns = this.parseList(kv.value).map((label, index) => this.createColumn(label, index));
					break;
				case "mark":
				case "symbol":
					mark = kv.value || mark;
					break;
				case "summary":
				case "show_summary":
					showSummary = this.parseBoolean(kv.value, true);
					break;
				case "items": {
					const rows = this.parseList(kv.value).map((label, index) => this.createRow(label, index));
					if (rows.length > 0) {
						groups.push({
							id: `0-${this.hash("items")}`,
							title: t("Items"),
							rows,
						});
					}
					break;
				}
				case "groups":
					insideGroups = true;
					if (kv.value) {
						for (const group of this.parseGroupLines(kv.value, groups.length)) {
							groups.push(group);
						}
					}
					break;
			}
		}

		const normalizedColumns = columns.filter((column) => column.label.trim());
		return {
			id: id || `progress-${this.hash(`${sourcePath ?? ""}\n${source}`)}`,
			title,
			columns: normalizedColumns.length > 0 ? normalizedColumns : [this.createColumn(t("Done"), 0)],
			groups,
			mark: mark.slice(0, 3),
			showSummary,
		};
	}

	private parseGroupLines(value: string, startIndex: number): ProgressGroup[] {
		return value
			.split(";")
			.map((part) => part.trim())
			.filter(Boolean)
			.map((part, offset) => this.parseGroupLine(part, startIndex + offset))
			.filter((group): group is ProgressGroup => Boolean(group));
	}

	private parseGroupLine(line: string, index: number): ProgressGroup | null {
		const cleaned = line.replace(/^-+\s*/, "").trim();
		const separator = cleaned.indexOf(":");
		if (separator === -1) return null;
		const title = cleaned.slice(0, separator).trim();
		const rows = this.parseList(cleaned.slice(separator + 1))
			.map((label, rowIndex) => this.createRow(label, rowIndex));
		if (!title || rows.length === 0) return null;
		return {
			id: `${index}-${this.hash(title)}`,
			title,
			rows,
		};
	}

	private parseList(value: string): string[] {
		const cleaned = value.trim().replace(/^\[/, "").replace(/\]$/, "");
		if (!cleaned) return [];
		return cleaned
			.split(",")
			.flatMap((part) => this.expandRange(this.stripQuotes(part.trim())))
			.filter(Boolean);
	}

	private expandRange(value: string): string[] {
		const match = value.match(/^(.*?)(\d+)\s*[-–—]\s*(?:.*?)(\d+)$/);
		if (!match) return [value];
		const prefix = match[1];
		const start = Number(match[2]);
		const end = Number(match[3]);
		if (!Number.isFinite(start) || !Number.isFinite(end) || end < start || end - start > 200) {
			return [value];
		}
		const width = Math.max(match[2].length, match[3].length);
		const result: string[] = [];
		for (let current = start; current <= end; current++) {
			result.push(`${prefix}${String(current).padStart(width, "0")}`);
		}
		return result;
	}

	private createColumn(label: string, index: number): ProgressColumn {
		return { id: `${index}-${this.hash(label)}`, label };
	}

	private createRow(label: string, index: number): ProgressRow {
		return { id: `${index}-${this.hash(label)}`, label };
	}

	private readKeyValue(line: string): { key: string; value: string } | null {
		const separator = line.indexOf(":");
		if (separator === -1) return null;
		return {
			key: line.slice(0, separator).trim().toLowerCase(),
			value: this.stripQuotes(line.slice(separator + 1).trim()),
		};
	}

	private isTopLevelKey(key: string): boolean {
		return ["id", "title", "columns", "cols", "labels", "mark", "symbol", "summary", "show_summary", "items"].includes(key);
	}

	private parseBoolean(value: string, fallback: boolean): boolean {
		const normalized = value.trim().toLowerCase();
		if (["true", "yes", "1", "on"].includes(normalized)) return true;
		if (["false", "no", "0", "off"].includes(normalized)) return false;
		return fallback;
	}

	private stripQuotes(value: string): string {
		return value.replace(/^["']/, "").replace(/["']$/, "").trim();
	}

	private hash(value: string): string {
		let hash = 2166136261;
		for (let i = 0; i < value.length; i++) {
			hash ^= value.charCodeAt(i);
			hash = Math.imul(hash, 16777619);
		}
		return (hash >>> 0).toString(36);
	}
}

class ProgressTableEditModal extends Modal {
	private state: ProgressTableEditState;
	private saving = false;

	constructor(
		private readonly plugin: UmOSPlugin,
		initialState: ProgressTableEditState,
		private readonly onSave: (state: ProgressTableEditState) => Promise<void>,
	) {
		super(plugin.app);
		this.state = {
			...initialState,
			columns: [...initialState.columns],
			groups: initialState.groups.map((group) => ({
				title: group.title,
				rows: [...group.rows],
			})),
		};
	}

	onOpen(): void {
		this.modalEl.addClass("umos-progress-table-edit-modal");
		this.contentEl.addClass("umos-progress-table-edit-content");
		this.render();
	}

	onClose(): void {
		this.contentEl.empty();
		this.contentEl.removeClass("umos-progress-table-edit-content");
	}

	private render(): void {
		this.contentEl.empty();

		const shell = this.contentEl.createDiv({ cls: "umos-progress-table-editor" });
		const header = shell.createDiv({ cls: "umos-progress-table-editor-header" });
		const titleRow = header.createDiv({ cls: "umos-progress-table-editor-title-row" });
		const icon = titleRow.createSpan({ cls: "umos-progress-table-editor-icon" });
		setIcon(icon, "table-2");
		titleRow.createDiv({ cls: "umos-progress-table-editor-title", text: t("Edit progress table") });
		header.createDiv({
			cls: "umos-progress-table-editor-subtitle",
			text: t("Edit columns, groups, and rows. Cell marks are kept when IDs stay the same."),
		});

		const body = shell.createDiv({ cls: "umos-progress-table-editor-body" });
		this.renderBasics(body);
		this.renderColumns(body);
		this.renderGroups(body);
		this.renderFooter(shell);
	}

	private renderBasics(parent: HTMLElement): void {
		const section = parent.createDiv({ cls: "umos-progress-table-editor-section" });
		section.createDiv({ cls: "umos-progress-table-editor-section-title", text: t("Table") });
		const grid = section.createDiv({ cls: "umos-progress-table-editor-grid" });
		this.createTextField(grid, t("Title"), this.state.title, (value) => {
			this.state.title = value;
		});
		this.createTextField(grid, t("Table ID"), this.state.id, (value) => {
			this.state.id = value;
		});
		this.createTextField(grid, t("Mark symbol"), this.state.mark, (value) => {
			this.state.mark = value.slice(0, 3);
		});
		const toggle = grid.createEl("label", { cls: "umos-progress-table-editor-toggle" });
		const input = toggle.createEl("input", { attr: { type: "checkbox" } });
		input.checked = this.state.showSummary;
		input.addEventListener("change", () => {
			this.state.showSummary = input.checked;
		});
		toggle.createSpan({ text: t("Show summary") });
	}

	private renderColumns(parent: HTMLElement): void {
		const section = parent.createDiv({ cls: "umos-progress-table-editor-section" });
		const head = section.createDiv({ cls: "umos-progress-table-editor-section-head" });
		head.createDiv({ cls: "umos-progress-table-editor-section-title", text: t("Columns") });
		this.createTextButton(head, "plus", t("Add column"), () => {
			this.state.columns.push(t("New column"));
			this.render();
		});

		const list = section.createDiv({ cls: "umos-progress-table-editor-list" });
		this.state.columns.forEach((column, index) => {
			const row = list.createDiv({ cls: "umos-progress-table-editor-row" });
			const input = row.createEl("input", {
				cls: "umos-progress-table-editor-input",
				attr: { type: "text", "aria-label": t("Column name") },
			});
			input.value = column;
			input.addEventListener("input", () => {
				this.state.columns[index] = input.value;
			});
			const actions = row.createDiv({ cls: "umos-progress-table-editor-row-actions" });
			this.createIconButton(actions, "arrow-up", t("Move up"), () => this.moveColumn(index, -1), index === 0);
			this.createIconButton(actions, "arrow-down", t("Move down"), () => this.moveColumn(index, 1), index === this.state.columns.length - 1);
			this.createIconButton(actions, "trash-2", t("Delete"), () => {
				this.state.columns.splice(index, 1);
				this.render();
			}, this.state.columns.length <= 1);
		});
	}

	private renderGroups(parent: HTMLElement): void {
		const section = parent.createDiv({ cls: "umos-progress-table-editor-section" });
		const head = section.createDiv({ cls: "umos-progress-table-editor-section-head" });
		head.createDiv({ cls: "umos-progress-table-editor-section-title", text: t("Groups") });
		this.createTextButton(head, "plus", t("Add group"), () => {
			this.state.groups.push({ title: t("New group"), rows: [t("New item")] });
			this.render();
		});

		const groups = section.createDiv({ cls: "umos-progress-table-editor-groups" });
		this.state.groups.forEach((group, index) => {
			const card = groups.createDiv({ cls: "umos-progress-table-editor-group" });
			const cardHead = card.createDiv({ cls: "umos-progress-table-editor-group-head" });
			const titleInput = cardHead.createEl("input", {
				cls: "umos-progress-table-editor-input",
				attr: { type: "text", "aria-label": t("Group title") },
			});
			titleInput.value = group.title;
			titleInput.addEventListener("input", () => {
				group.title = titleInput.value;
			});
			const actions = cardHead.createDiv({ cls: "umos-progress-table-editor-row-actions" });
			this.createIconButton(actions, "arrow-up", t("Move up"), () => this.moveGroup(index, -1), index === 0);
			this.createIconButton(actions, "arrow-down", t("Move down"), () => this.moveGroup(index, 1), index === this.state.groups.length - 1);
			this.createIconButton(actions, "trash-2", t("Delete group"), () => {
				this.state.groups.splice(index, 1);
				this.render();
			}, this.state.groups.length <= 1);

			const rowsLabel = card.createDiv({ cls: "umos-progress-table-editor-label", text: t("Rows, one per line") });
			rowsLabel.setAttr("aria-hidden", "true");
			const textarea = card.createEl("textarea", {
				cls: "umos-progress-table-editor-textarea",
				attr: { "aria-label": t("Rows, one per line"), rows: "5" },
			});
			textarea.value = group.rows.join("\n");
			textarea.addEventListener("input", () => {
				group.rows = this.parseRowsInput(textarea.value);
			});
			const rowActions = card.createDiv({ cls: "umos-progress-table-editor-card-actions" });
			this.createTextButton(rowActions, "plus", t("Add row"), () => {
				group.rows.push(t("New item"));
				this.render();
			});
		});
	}

	private renderFooter(parent: HTMLElement): void {
		const footer = parent.createDiv({ cls: "umos-progress-table-editor-footer" });
		const cancel = footer.createEl("button", {
			cls: "umos-progress-table-editor-secondary",
			text: t("Cancel"),
			attr: { type: "button" },
		});
		cancel.addEventListener("click", () => this.close());

		const save = footer.createEl("button", {
			cls: "umos-progress-table-editor-primary",
			text: this.saving ? t("Saving...") : t("Save table"),
			attr: { type: "button" },
		});
		save.disabled = this.saving;
		save.addEventListener("click", () => void this.save());
	}

	private createTextField(parent: HTMLElement, label: string, value: string, onInput: (value: string) => void): void {
		const field = parent.createEl("label", { cls: "umos-progress-table-editor-field" });
		field.createSpan({ cls: "umos-progress-table-editor-label", text: label });
		const input = field.createEl("input", {
			cls: "umos-progress-table-editor-input",
			attr: { type: "text" },
		});
		input.value = value;
		input.addEventListener("input", () => onInput(input.value));
	}

	private createTextButton(parent: HTMLElement, iconName: string, label: string, onClick: () => void): HTMLButtonElement {
		const button = parent.createEl("button", {
			cls: "umos-progress-table-editor-add-btn",
			attr: { type: "button" },
		});
		const icon = button.createSpan({ cls: "umos-progress-table-editor-btn-icon" });
		setIcon(icon, iconName);
		button.createSpan({ text: label });
		button.addEventListener("click", onClick);
		return button;
	}

	private createIconButton(parent: HTMLElement, iconName: string, label: string, onClick: () => void, disabled = false): HTMLButtonElement {
		const button = parent.createEl("button", {
			cls: "umos-progress-table-editor-icon-btn",
			attr: { type: "button", title: label, "aria-label": label },
		});
		button.disabled = disabled;
		setIcon(button, iconName);
		button.addEventListener("click", onClick);
		return button;
	}

	private moveColumn(index: number, direction: number): void {
		const nextIndex = index + direction;
		if (nextIndex < 0 || nextIndex >= this.state.columns.length) return;
		const [column] = this.state.columns.splice(index, 1);
		this.state.columns.splice(nextIndex, 0, column);
		this.render();
	}

	private moveGroup(index: number, direction: number): void {
		const nextIndex = index + direction;
		if (nextIndex < 0 || nextIndex >= this.state.groups.length) return;
		const [group] = this.state.groups.splice(index, 1);
		this.state.groups.splice(nextIndex, 0, group);
		this.render();
	}

	private parseRowsInput(value: string): string[] {
		const lineRows = value.split(/\r?\n/).map((row) => row.trim()).filter(Boolean);
		if (lineRows.length > 1) return lineRows;
		return value.split(",").map((row) => row.trim()).filter(Boolean);
	}

	private normalizeState(): ProgressTableEditState {
		return {
			id: this.state.id.trim() || "progress-table",
			title: this.state.title.trim() || t("Progress Table"),
			columns: this.state.columns.map((column) => column.trim()).filter(Boolean),
			groups: this.state.groups
				.map((group) => ({
					title: group.title.trim(),
					rows: group.rows.map((row) => row.trim()).filter(Boolean),
				}))
				.filter((group) => group.title && group.rows.length > 0),
			mark: this.state.mark.trim().slice(0, 3) || "+",
			showSummary: this.state.showSummary,
		};
	}

	private validate(state: ProgressTableEditState): string | null {
		if (state.columns.length === 0) return t("At least one column is required.");
		if (state.groups.length === 0) return t("At least one group with rows is required.");
		return null;
	}

	private async save(): Promise<void> {
		const state = this.normalizeState();
		const error = this.validate(state);
		if (error) {
			new Notice(error);
			return;
		}
		this.saving = true;
		this.render();
		try {
			await this.onSave(state);
			this.close();
		} finally {
			this.saving = false;
		}
	}
}
