import { App, EventRef, ItemView, MarkdownView, WorkspaceLeaf, moment, setIcon, Notice } from 'obsidian';
import type UmOSPlugin from '../../main';
import { getLocale, t } from '../../i18n';
import { TaskService } from './TaskService';
import { Task } from './Task';
import { TaskEditorModal } from './TaskEditorModal';

export const TASK_CALENDAR_VIEW_TYPE = 'umos-task-calendar-view';

type CalendarViewMode = 'month' | 'list';
type CalendarEntryKind = 'due' | 'overdue' | 'scheduled' | 'start' | 'progress' | 'done' | 'cancelled' | 'daily';
type DayPanelGroupTone = 'overdue' | 'day' | 'progress' | 'closed';

interface CalendarEntry {
	task: Task;
	date: string;
	kind: CalendarEntryKind;
}

interface DayPanelGroup {
	key: string;
	label: string;
	tone: DayPanelGroupTone;
	entries: CalendarEntry[];
}

interface CalendarRange {
	start: ReturnType<typeof moment>;
	end: ReturnType<typeof moment>;
}

export class TaskCalendarView extends ItemView {
	private obsidianApp: App;
	private plugin: UmOSPlugin;
	private service: TaskService;
	private contentContainerEl: HTMLElement | null = null;
	private currentMonth = moment().startOf('month');
	private selectedDate = moment().format('YYYY-MM-DD');
	private viewMode: CalendarViewMode;
	private renderToken = 0;
	private renderTimeout: ReturnType<typeof setTimeout> | null = null;

	constructor(leaf: WorkspaceLeaf, app: App, plugin: UmOSPlugin) {
		super(leaf);
		this.obsidianApp = app;
		this.plugin = plugin;
		this.service = new TaskService(app, plugin);
		this.viewMode = this.normalizeViewMode(plugin.settings.taskCalendarDefaultView);
	}

	getViewType(): string {
		return TASK_CALENDAR_VIEW_TYPE;
	}

	getDisplayText(): string {
		return t('Task Calendar');
	}

	getIcon(): string {
		return 'calendar-check';
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.classList.add('umos-task-calendar-view-container');

		this.contentContainerEl = container.createDiv({ cls: 'umos-task-calendar-view' });
		await this.renderAsync();

		const vaultRef: EventRef = this.obsidianApp.vault.on('modify', () => this.scheduleRender(400));
		this.registerEvent(vaultRef);

		const tasksHandler = () => this.scheduleRender(120);
		this.plugin.eventBus.on('tasks:changed', tasksHandler);
		this.register(() => this.plugin.eventBus.off('tasks:changed', tasksHandler));

		const settingsHandler = () => {
			this.viewMode = this.normalizeViewMode(this.plugin.settings.taskCalendarDefaultView);
			this.scheduleRender(120);
		};
		this.plugin.eventBus.on('settings:changed', settingsHandler);
		this.register(() => this.plugin.eventBus.off('settings:changed', settingsHandler));
	}

	async onClose(): Promise<void> {
		if (this.renderTimeout) clearTimeout(this.renderTimeout);
		this.renderTimeout = null;
		this.contentContainerEl = null;
	}

	private scheduleRender(delay = 150): void {
		if (this.renderTimeout) clearTimeout(this.renderTimeout);
		this.renderTimeout = setTimeout(() => void this.renderAsync(), delay);
	}

	private async renderAsync(): Promise<void> {
		if (!this.contentContainerEl) return;
		const token = ++this.renderToken;
		this.contentContainerEl.empty();
		this.renderHeaderSkeleton();
		this.contentContainerEl.createDiv({ cls: 'umos-task-calendar-loading', text: t('Loading task calendar...') });

		const range = this.getCalendarRange();
		const tasks = await this.service.getFlatTasksWithQuery(this.getTaskQuery());
		if (token !== this.renderToken || !this.contentContainerEl) return;

		const entries = this.buildEntries(tasks, range);
		const entriesByDate = this.groupEntriesByDate(entries);

		this.contentContainerEl.empty();
		const root = this.contentContainerEl.createDiv({ cls: 'umos-task-calendar' });
		this.renderToolbar(root, entries);

		if (this.viewMode === 'list') {
			this.renderListView(root, entriesByDate);
		} else {
			const body = root.createDiv({ cls: 'umos-task-calendar-body' });
			this.renderMonthGrid(body, entriesByDate, range);
			this.renderDayPanel(body, this.getSelectedDayEntries(entriesByDate.get(this.selectedDate) ?? [], tasks));
		}
	}

	private renderHeaderSkeleton(): void {
		if (!this.contentContainerEl) return;
		const shell = this.contentContainerEl.createDiv({ cls: 'umos-task-calendar' });
		const toolbar = shell.createDiv({ cls: 'umos-task-calendar-toolbar' });
		toolbar.createDiv({ cls: 'umos-task-calendar-title', text: t('Task Calendar') });
	}

	private renderToolbar(parent: HTMLElement, entries: CalendarEntry[]): void {
		const toolbar = parent.createDiv({ cls: 'umos-task-calendar-toolbar' });
		const nav = toolbar.createDiv({ cls: 'umos-task-calendar-nav' });

		this.createIconButton(nav, 'chevron-left', 'Previous month', () => {
			this.currentMonth.subtract(1, 'month').startOf('month');
			this.selectedDate = this.currentMonth.format('YYYY-MM-DD');
			void this.renderAsync();
		});

		const titleButton = nav.createEl('button', {
			cls: 'umos-task-calendar-current',
			attr: { type: 'button' },
		});
		titleButton.createSpan({ cls: 'umos-task-calendar-current-month', text: this.formatMonthYear(this.currentMonth) });
		titleButton.createSpan({ cls: 'umos-task-calendar-current-subtitle', text: this.getMonthSummary(entries) });
		titleButton.addEventListener('click', () => {
			this.currentMonth = moment().startOf('month');
			this.selectedDate = moment().format('YYYY-MM-DD');
			void this.renderAsync();
		});

		this.createIconButton(nav, 'chevron-right', 'Next month', () => {
			this.currentMonth.add(1, 'month').startOf('month');
			this.selectedDate = this.currentMonth.format('YYYY-MM-DD');
			void this.renderAsync();
		});

		const actions = toolbar.createDiv({ cls: 'umos-task-calendar-actions' });
		this.createTextButton(actions, 'Today', () => {
			this.currentMonth = moment().startOf('month');
			this.selectedDate = moment().format('YYYY-MM-DD');
			void this.renderAsync();
		});

		const segmented = actions.createDiv({ cls: 'umos-task-calendar-segmented' });
		this.createModeButton(segmented, 'month', 'Month');
		this.createModeButton(segmented, 'list', 'List');

		this.createPathToggleButton(actions);
		this.createIconButton(actions, 'refresh-cw', 'Refresh', () => void this.renderAsync());
	}

	private renderMonthGrid(parent: HTMLElement, entriesByDate: Map<string, CalendarEntry[]>, range: CalendarRange): void {
		const grid = parent.createDiv({ cls: 'umos-task-calendar-grid' });
		for (const label of this.getWeekdayLabels()) {
			grid.createDiv({ cls: 'umos-task-calendar-weekday', text: label });
		}

		const cursor = range.start.clone();
		while (!cursor.isAfter(range.end, 'day')) {
			const date = cursor.format('YYYY-MM-DD');
			this.renderDayCell(grid, cursor.clone(), entriesByDate.get(date) ?? []);
			cursor.add(1, 'day');
		}
	}

	private renderDayCell(parent: HTMLElement, date: ReturnType<typeof moment>, entries: CalendarEntry[]): void {
		const dateISO = date.format('YYYY-MM-DD');
		const maxCellItems = this.getMaxCellItems();
		const isToday = date.isSame(moment(), 'day');
		const isCurrentMonth = date.isSame(this.currentMonth, 'month');
		const isSelected = dateISO === this.selectedDate;
		const classes = [
			'umos-task-calendar-cell',
			isToday ? 'is-today' : '',
			isCurrentMonth ? '' : 'is-outside',
			isSelected ? 'is-selected' : '',
			entries.length > 0 ? 'has-entries' : '',
		].filter(Boolean).join(' ');

		const cell = parent.createDiv({ cls: classes });
		cell.addEventListener('click', () => {
			this.selectedDate = dateISO;
			void this.renderAsync();
		});

		const top = cell.createDiv({ cls: 'umos-task-calendar-cell-top' });
		top.createSpan({ cls: 'umos-task-calendar-day-number', text: date.format('D') });
		if (entries.length > 0) {
			top.createSpan({ cls: 'umos-task-calendar-day-count', text: String(entries.length) });
		}

		const list = cell.createDiv({ cls: 'umos-task-calendar-cell-list' });
		for (const entry of entries.slice(0, maxCellItems)) {
			const chip = list.createEl('button', {
				cls: `umos-task-calendar-chip is-${entry.kind}`,
				attr: { type: 'button', title: `${this.getKindLabel(entry.kind)}: ${entry.task.description}` },
			});
			chip.createSpan({ cls: 'umos-task-calendar-chip-dot' });
			chip.createSpan({ cls: 'umos-task-calendar-chip-text', text: this.getTaskTitle(entry.task) });
		}

		if (entries.length > maxCellItems) {
			list.createDiv({
				cls: 'umos-task-calendar-more',
				text: `+${entries.length - maxCellItems}`,
			});
		}
	}

	private renderDayPanel(parent: HTMLElement, entries: CalendarEntry[]): void {
		const panel = parent.createDiv({ cls: 'umos-task-calendar-day-panel' });
		const head = panel.createDiv({ cls: 'umos-task-calendar-day-panel-head' });
		head.createDiv({
			cls: 'umos-task-calendar-day-panel-title',
			text: this.formatDateLong(this.selectedDate),
		});
		head.createDiv({ cls: 'umos-task-calendar-day-panel-count', text: `${entries.length} ${t('tasks')}` });

		if (entries.length === 0) {
			panel.createDiv({ cls: 'umos-task-calendar-empty', text: t('No tasks for this day') });
		} else {
			const list = panel.createDiv({ cls: 'umos-task-calendar-day-list' });
			for (const group of this.getDayPanelGroups(entries)) {
				this.renderDayPanelGroup(list, group);
			}
		}

		this.renderCreateTaskAction(panel);
	}

	private renderCreateTaskAction(parent: HTMLElement): void {
		const footer = parent.createDiv({ cls: 'umos-task-calendar-day-panel-footer' });
		const button = footer.createEl('button', {
			cls: 'umos-task-calendar-create-task-btn',
			attr: { type: 'button' },
		});
		const icon = button.createSpan({ cls: 'umos-task-calendar-create-task-icon' });
		setIcon(icon, 'plus');
		button.createSpan({ text: t('Create task') });
		button.addEventListener('click', () => {
			const newTask = new Task('', '', 0);
			newTask.description = '';
			newTask.dueDate = this.selectedDate;
			newTask.tags = [];

			const modal = new TaskEditorModal(this.obsidianApp, newTask, async (task, subtasks) => {
				const filePath = this.resolveCreateTargetPath(this.selectedDate);
				if (!filePath) {
					new Notice(t('Could not determine the task file.'));
					return;
				}
				const lineNum = await this.service.createTask(task, filePath);
				if (subtasks.length > 0 && lineNum >= 0) {
					await this.service.addSubtasksAfterLine(filePath, lineNum, task.indentation, subtasks);
				}
				setTimeout(() => void this.renderAsync(), 300);
			}, undefined, this.plugin);
			modal.open();
		});
	}

	private renderDayPanelGroup(parent: HTMLElement, group: DayPanelGroup): void {
		const groupEl = parent.createDiv({ cls: `umos-task-calendar-panel-group is-${group.tone}` });
		const head = groupEl.createDiv({ cls: 'umos-task-calendar-panel-group-head' });
		head.createSpan({ cls: 'umos-task-calendar-panel-group-label', text: t(group.label) });
		head.createSpan({ cls: 'umos-task-calendar-panel-group-count', text: String(group.entries.length) });

		const items = groupEl.createDiv({ cls: 'umos-task-calendar-panel-group-items' });
		for (const entry of group.entries) {
			this.renderPanelTask(items, entry);
		}
	}

	private renderPanelTask(parent: HTMLElement, entry: CalendarEntry): void {
		const item = parent.createDiv({ cls: `umos-task-calendar-panel-task is-${entry.kind}` });
		if (entry.task.indentation > 0) {
			item.style.marginLeft = `${entry.task.indentation * 16}px`;
			item.classList.add('is-subtask');
		}

		const top = item.createDiv({ cls: 'umos-task-calendar-panel-task-top' });
		top.createSpan({ cls: `umos-task-calendar-kind-dot is-${entry.kind}` });

		const title = top.createEl('button', {
			cls: 'umos-task-calendar-panel-task-title',
			text: this.getTaskTitle(entry.task),
			attr: { type: 'button' },
		});
		title.addEventListener('click', () => this.openTask(entry.task));

		const meta = item.createDiv({ cls: 'umos-task-calendar-panel-task-meta' });
		meta.createSpan({ cls: `umos-task-calendar-kind-label is-${entry.kind}`, text: this.getKindLabel(entry.kind) });
		if (entry.kind === 'overdue' && entry.task.dueDate) {
			meta.createSpan({
				cls: 'umos-task-calendar-date-badge is-overdue',
				text: `${t('Missed')}: ${this.formatDateShort(entry.task.dueDate)}`,
			});
		}
		if (entry.task.priority !== 'none') {
			meta.createSpan({ cls: `umos-task-calendar-priority is-${entry.task.priority}`, text: t(entry.task.priority) });
		}
		if (entry.task.tags.length > 0) {
			const tagsEl = meta.createSpan({ cls: 'umos-task-tags umos-task-calendar-tags' });
			for (const tag of entry.task.tags.slice(0, 4)) {
				tagsEl.createSpan({ cls: 'tag', text: `#${this.formatDisplayTag(tag)}` });
			}
		}
		if (this.plugin.settings.taskCalendarShowTaskPaths) {
			meta.createSpan({ cls: 'umos-task-calendar-file', text: entry.task.filePath });
		}
	}

	private renderListView(parent: HTMLElement, entriesByDate: Map<string, CalendarEntry[]>): void {
		const list = parent.createDiv({ cls: 'umos-task-calendar-list-view' });
		const monthStart = this.currentMonth.clone().startOf('month');
		const monthEnd = this.currentMonth.clone().endOf('month');
		const cursor = monthStart.clone();
		let rendered = 0;

		while (!cursor.isAfter(monthEnd, 'day')) {
			const date = cursor.format('YYYY-MM-DD');
			const entries = entriesByDate.get(date) ?? [];
			if (entries.length > 0) {
				const group = list.createDiv({ cls: 'umos-task-calendar-list-group' });
				const head = group.createDiv({ cls: 'umos-task-calendar-list-group-head' });
				head.createSpan({ cls: 'umos-task-calendar-list-date', text: this.formatDateLong(date, false) });
				head.createSpan({ cls: 'umos-task-calendar-list-count', text: String(entries.length) });
				for (const entry of entries) this.renderPanelTask(group, entry);
				rendered++;
			}
			cursor.add(1, 'day');
		}

		if (rendered === 0) {
			list.createDiv({ cls: 'umos-task-calendar-empty', text: t('No dated tasks in this month') });
		}
	}

	private buildEntries(tasks: Task[], range: CalendarRange): CalendarEntry[] {
		const entries: CalendarEntry[] = [];
		const today = moment().startOf('day');
		const settings = this.plugin.settings;

		for (const task of tasks) {
			if (task.status === 'done') {
				if (settings.taskCalendarShowCompleted) {
					this.addEntry(entries, task, task.doneDate ?? task.dueDate, 'done', range);
				}
				continue;
			}

			if (task.status === 'cancelled') {
				if (settings.taskCalendarShowCancelled) {
					this.addEntry(entries, task, task.dueDate ?? task.scheduledDate ?? task.startDate, 'cancelled', range);
				}
				continue;
			}

			if (task.dueDate) {
				const kind: CalendarEntryKind = moment(task.dueDate).isBefore(today, 'day') ? 'overdue' : 'due';
				this.addEntry(entries, task, task.dueDate, kind, range);
			}

			if (task.scheduledDate && task.scheduledDate !== task.dueDate) {
				this.addEntry(entries, task, task.scheduledDate, 'scheduled', range);
			}

			if (task.startDate && task.startDate !== task.dueDate && task.startDate !== task.scheduledDate) {
				this.addEntry(entries, task, task.startDate, 'start', range);
			}

			if (settings.taskCalendarShowProgress) {
				this.addProgressEntries(entries, task, range);
			}

			if (
				settings.taskCalendarShowDailyNoteTasks &&
				!task.dueDate &&
				!task.scheduledDate &&
				!task.startDate
			) {
				this.addEntry(entries, task, this.extractDailyDateFromPath(task.filePath), 'daily', range);
			}
		}

		return entries.sort((a, b) => this.compareEntries(a, b));
	}

	private addProgressEntries(entries: CalendarEntry[], task: Task, range: CalendarRange): void {
		if (!task.startDate || !task.dueDate) return;
		const start = moment(task.startDate).startOf('day');
		const end = moment(task.dueDate).startOf('day');
		const today = moment().startOf('day');
		if (!start.isValid() || !end.isValid() || start.isAfter(end, 'day')) return;
		if (today.isSame(start, 'day') || today.isSame(end, 'day')) return;
		if (today.isBefore(start, 'day') || today.isAfter(end, 'day')) return;

		this.addEntry(entries, task, today.format('YYYY-MM-DD'), 'progress', range);
	}

	private addEntry(
		entries: CalendarEntry[],
		task: Task,
		dateValue: string | null,
		kind: CalendarEntryKind,
		range: CalendarRange,
	): void {
		if (!dateValue) return;
		const date = moment(dateValue, 'YYYY-MM-DD', true);
		if (!date.isValid()) return;
		if (date.isBefore(range.start, 'day') || date.isAfter(range.end, 'day')) return;
		entries.push({
			task,
			date: date.format('YYYY-MM-DD'),
			kind,
		});
	}

	private groupEntriesByDate(entries: CalendarEntry[]): Map<string, CalendarEntry[]> {
		const grouped = new Map<string, CalendarEntry[]>();
		for (const entry of entries) {
			const list = grouped.get(entry.date) ?? [];
			list.push(entry);
			grouped.set(entry.date, list);
		}
		for (const [date, list] of grouped) {
			grouped.set(date, list.sort((a, b) => this.compareEntries(a, b)));
		}
		return grouped;
	}

	private getSelectedDayEntries(dayEntries: CalendarEntry[], tasks: Task[]): CalendarEntry[] {
		if (!moment(this.selectedDate, 'YYYY-MM-DD', true).isSame(moment(), 'day')) {
			return dayEntries;
		}

		const today = moment().startOf('day');
		const existing = new Set(dayEntries.map(entry => this.getEntryIdentity(entry)));
		const overdueEntries = tasks
			.filter(task => task.status !== 'done' && task.status !== 'cancelled')
			.filter(task => {
				if (!task.dueDate) return false;
				const due = moment(task.dueDate, 'YYYY-MM-DD', true);
				return due.isValid() && due.isBefore(today, 'day');
			})
			.map(task => ({ task, date: today.format('YYYY-MM-DD'), kind: 'overdue' as CalendarEntryKind }))
			.filter(entry => !existing.has(this.getEntryIdentity(entry)));

		return [...overdueEntries, ...dayEntries].sort((a, b) => this.compareEntries(a, b));
	}

	private getDayPanelGroups(entries: CalendarEntry[]): DayPanelGroup[] {
		const selectedIsToday = moment(this.selectedDate, 'YYYY-MM-DD', true).isSame(moment(), 'day');
		const definitions: Array<{
			key: string;
			label: string;
			tone: DayPanelGroupTone;
			kinds: CalendarEntryKind[];
		}> = [
			{ key: 'overdue', label: 'Overdue', tone: 'overdue', kinds: ['overdue'] },
			{
				key: 'day',
				label: selectedIsToday ? 'Tasks for today' : 'Tasks for this day',
				tone: 'day',
				kinds: ['due', 'scheduled', 'start', 'daily'],
			},
			{ key: 'progress', label: 'In progress', tone: 'progress', kinds: ['progress'] },
			{ key: 'closed', label: 'Done / Cancelled', tone: 'closed', kinds: ['done', 'cancelled'] },
		];

		return definitions
			.map(definition => ({
				key: definition.key,
				label: definition.label,
				tone: definition.tone,
				entries: entries.filter(entry => definition.kinds.includes(entry.kind)),
			}))
			.filter(group => group.entries.length > 0);
	}

	private getEntryIdentity(entry: CalendarEntry): string {
		return `${entry.task.filePath}:${entry.task.lineNumber}:${entry.kind}`;
	}

	private getRootTask(task: Task): Task {
		let current = task;
		while (current.parent) {
			current = current.parent as Task;
		}
		return current;
	}

	private compareEntries(a: CalendarEntry, b: CalendarEntry): number {
		const dateCompare = a.date.localeCompare(b.date);
		if (dateCompare !== 0) return dateCompare;

		const rootA = a.task.parent ? this.getRootTask(a.task) : a.task;
		const rootB = b.task.parent ? this.getRootTask(b.task) : b.task;

		if (rootA !== rootB) {
			const kindCompare = this.getKindWeight(a.kind) - this.getKindWeight(b.kind);
			if (kindCompare !== 0) return kindCompare;
			const priorityCompare = this.getPriorityWeight(rootA.priority) - this.getPriorityWeight(rootB.priority);
			if (priorityCompare !== 0) return priorityCompare;
			return rootA.description.localeCompare(rootB.description);
		}

		return a.task.lineNumber - b.task.lineNumber;
	}

	private getCalendarRange(): CalendarRange {
		const firstDay = this.getFirstDayOfWeek();
		const start = this.currentMonth.clone().startOf('month');
		while (start.day() !== firstDay) start.subtract(1, 'day');

		const end = this.currentMonth.clone().endOf('month');
		const lastDay = (firstDay + 6) % 7;
		while (end.day() !== lastDay) end.add(1, 'day');

		return { start, end };
	}

	private getWeekdayLabels(): string[] {
		const base = moment().day(this.getFirstDayOfWeek());
		const formatter = new Intl.DateTimeFormat(getLocale(), { weekday: 'short' });
		return Array.from({ length: 7 }, (_, index) => {
			const date = base.clone().add(index, 'day');
			return formatter.format(date.toDate()).replace('.', '').toUpperCase();
		});
	}

	private getMonthSummary(entries: CalendarEntry[]): string {
		const monthEntries = entries.filter(entry => moment(entry.date).isSame(this.currentMonth, 'month'));
		const due = monthEntries.filter(entry => entry.kind === 'due' || entry.kind === 'overdue').length;
		const done = monthEntries.filter(entry => entry.kind === 'done').length;
		return `${monthEntries.length} ${t('tasks')} · ${due} ${t('due')} · ${done} ${t('done')}`;
	}

	private getKindLabel(kind: CalendarEntryKind): string {
		if (kind === 'overdue') return t('Overdue');
		if (kind === 'scheduled') return t('Scheduled');
		if (kind === 'start') return t('Start');
		if (kind === 'progress') return t('In progress');
		if (kind === 'done') return t('Done');
		if (kind === 'cancelled') return t('Cancelled');
		if (kind === 'daily') return t('Daily note');
		return t('Due');
	}

	private getKindWeight(kind: CalendarEntryKind): number {
		const weights: Record<CalendarEntryKind, number> = {
			overdue: 0,
			due: 1,
			scheduled: 2,
			start: 3,
			progress: 4,
			daily: 5,
			done: 6,
			cancelled: 7,
		};
		return weights[kind];
	}

	private formatDateLong(dateValue: string, includeYear = true): string {
		const date = moment(dateValue, 'YYYY-MM-DD', true);
		if (!date.isValid()) return dateValue;
		const options: Intl.DateTimeFormatOptions = includeYear
			? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
			: { weekday: 'long', day: 'numeric', month: 'long' };
		return this.capitalizeCalendarLabel(new Intl.DateTimeFormat(getLocale(), options).format(date.toDate()));
	}

	private formatDateShort(dateValue: string): string {
		const date = moment(dateValue, 'YYYY-MM-DD', true);
		if (!date.isValid()) return dateValue;
		return new Intl.DateTimeFormat(getLocale(), { day: 'numeric', month: 'short' }).format(date.toDate());
	}

	private formatMonthYear(date: ReturnType<typeof moment>): string {
		return this.capitalizeCalendarLabel(new Intl.DateTimeFormat(getLocale(), { month: 'long', year: 'numeric' }).format(date.toDate()));
	}

	private capitalizeCalendarLabel(value: string): string {
		const chars = Array.from(value);
		if (chars.length === 0) return value;
		return `${chars[0].toLocaleUpperCase(getLocale())}${chars.slice(1).join('')}`;
	}

	private getPriorityWeight(priority: Task['priority']): number {
		if (priority === 'high') return 0;
		if (priority === 'medium') return 1;
		if (priority === 'low') return 2;
		return 3;
	}

	private getTaskTitle(task: Task): string {
		return task.description.trim() || t('Untitled task');
	}

	private formatDisplayTag(tag: string): string {
		return tag.replace(/^#?tasks\//i, '').replace(/^#/, '');
	}

	private getTaskQuery(): { path?: string } {
		const path = this.plugin.settings.taskCalendarTaskPaths.trim();
		return path.length > 0 ? { path } : {};
	}

	private getFirstDayOfWeek(): number {
		const value = Number(this.plugin.settings.taskCalendarFirstDayOfWeek);
		if (!Number.isFinite(value)) return 1;
		return Math.max(0, Math.min(6, Math.floor(value)));
	}

	private getMaxCellItems(): number {
		const value = Number(this.plugin.settings.taskCalendarMaxItemsPerDay);
		if (!Number.isFinite(value)) return 3;
		return Math.max(1, Math.min(8, Math.floor(value)));
	}

	private normalizeViewMode(value: unknown): CalendarViewMode {
		return value === 'list' ? 'list' : 'month';
	}

	private extractDailyDateFromPath(path: string): string | null {
		const normalizedPath = path.replace(/\\/g, '/');
		const dailyRoot = this.plugin.settings.dailyNotesPath.replace(/\\/g, '/').replace(/\/+$/, '');
		if (dailyRoot && !normalizedPath.startsWith(`${dailyRoot}/`)) return null;

		const basename = normalizedPath.split('/').pop()?.replace(/\.md$/i, '') ?? '';
		const format = this.plugin.settings.dailyNoteFormat || 'YYYY-MM-DD';
		const parsed = moment(basename, format, true);
		if (parsed.isValid()) return parsed.format('YYYY-MM-DD');

		const match = normalizedPath.match(/(\d{4}-\d{2}-\d{2})/);
		return match ? match[1] : null;
	}

	private resolveCreateTargetPath(dateStr: string): string | null {
		const dailyRoot = (this.plugin.settings.dailyNotesPath || '').replace(/\\/g, '/').replace(/\/+$/, '');
		const format = this.plugin.settings.dailyNoteFormat || 'YYYY-MM-DD';
		const date = moment(dateStr, 'YYYY-MM-DD');
		if (date.isValid()) {
			const filename = date.format(format);
			return dailyRoot ? `${dailyRoot}/${filename}.md` : `${filename}.md`;
		}
		
		const paths = this.plugin.settings.taskCalendarTaskPaths.split(',').map(p => p.trim()).filter(Boolean);
		if (paths.length > 0) {
			const firstPath = paths[0];
			return firstPath.endsWith('.md') ? firstPath : `${firstPath}/Tasks.md`.replace(/^\/+/, '');
		}
		
		return 'Tasks.md';
	}

	private createIconButton(parent: HTMLElement, icon: string, label: string, onClick: () => void): HTMLButtonElement {
		const button = parent.createEl('button', {
			cls: 'clickable-icon umos-task-calendar-icon-btn',
			attr: { type: 'button', 'aria-label': t(label), title: t(label) },
		});
		setIcon(button, icon);
		button.addEventListener('click', onClick);
		return button;
	}

	private createTextButton(parent: HTMLElement, label: string, onClick: () => void): HTMLButtonElement {
		const button = parent.createEl('button', {
			cls: 'umos-task-calendar-text-btn',
			text: t(label),
			attr: { type: 'button' },
		});
		button.addEventListener('click', onClick);
		return button;
	}

	private createModeButton(parent: HTMLElement, mode: CalendarViewMode, label: string): void {
		const button = parent.createEl('button', {
			cls: `umos-task-calendar-mode-btn${this.viewMode === mode ? ' is-active' : ''}`,
			text: t(label),
			attr: { type: 'button' },
		});
		button.addEventListener('click', () => {
			this.viewMode = mode;
			this.plugin.settings.taskCalendarDefaultView = mode;
			void this.plugin.saveSettings();
			void this.renderAsync();
		});
	}

	private createPathToggleButton(parent: HTMLElement): void {
		const showPaths = this.plugin.settings.taskCalendarShowTaskPaths;
		const button = this.createIconButton(
			parent,
			showPaths ? 'eye' : 'eye-off',
			showPaths ? 'Hide task paths' : 'Show task paths',
			() => {
				this.plugin.settings.taskCalendarShowTaskPaths = !this.plugin.settings.taskCalendarShowTaskPaths;
				void this.plugin.saveSettings().then(() => this.renderAsync());
			},
		);
		button.classList.toggle('is-active', showPaths);
	}

	private openTask(task: Task): void {
		void this.obsidianApp.workspace.openLinkText(task.filePath, task.filePath, false).then(() => {
			const view = this.obsidianApp.workspace.getActiveViewOfType(MarkdownView);
			if (view) view.editor.setCursor(task.lineNumber, 0);
		});
	}
}
