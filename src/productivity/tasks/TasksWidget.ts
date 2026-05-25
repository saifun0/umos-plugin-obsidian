import { MarkdownView, App, setIcon, EventRef, moment, Notice } from 'obsidian';
import UmOSPlugin from '../../main';
import { BaseWidget } from '../../core/BaseWidget';
import { TaskService } from './TaskService';
import { Task, ITask, TaskStatus, ITaskQuery } from './Task';
import { TaskEditorModal } from './TaskEditorModal';

type SortField = 'dueDate' | 'priority' | 'created' | 'status';
type SortDir   = 'asc' | 'desc';

type StatusFilter   = 'all' | 'active' | 'doing' | 'done';
type PriorityFilter = 'all' | 'high' | 'medium' | 'low';
type DueFilter      = 'all' | 'today' | 'overdue' | 'week' | 'no-date';

export class TasksWidget extends BaseWidget {
    private app: App;
    private plugin: UmOSPlugin;
    private service: TaskService;
    private config: any;
    private vaultModifyRef: EventRef | null = null;
    private renderTimeout: ReturnType<typeof setTimeout> | null = null;
    private isUpdating = false;

    // ── Filter state ──────────────────────────────────────────────────────
    private statusFilter:   StatusFilter   = 'active';
    private priorityFilter: PriorityFilter = 'all';
    private dueFilter:      DueFilter      = 'all';
    private activeTagFilter: string        = '';
    private searchQuery: string            = '';
    private sortField: SortField           = 'priority';
    private sortDir: SortDir               = 'asc';
    private filtersOpen                    = false;

    // Search focus state
    private searchFocused = false;
    private searchCursorStart: number | null = null;
    private searchCursorEnd: number | null = null;

    // ── Bulk selection ────────────────────────────────────────────────────
    private selectedTasks: Set<Task> = new Set();
    private selectionMode = false;
    private allTasks: Task[] = [];
    private sourcePath: string | null = null;

    // DOM Containers
    private headerContainer: HTMLElement;
    private filtersContainer: HTMLElement;
    private listContainer: HTMLElement;

    constructor(
        containerEl: HTMLElement,
        config: any,
        app: App,
        plugin: UmOSPlugin,
        sourcePath?: string,
    ) {
        super(containerEl);
        this.app = app;
        this.plugin = plugin;
        this.config = config;
        this.service = new TaskService(app, plugin);
        this.sourcePath = sourcePath || null;

        if (config.status) {
            const statuses = config.status.split(',').map((s: string) => s.trim());
            if (statuses.length === 1 && statuses[0] === 'done') {
                this.statusFilter = 'done';
            } else if (statuses.every((s: string) => s === 'todo' || s === 'doing')) {
                this.statusFilter = 'active';
            }
        }

        if (config.sort) {
            const parts = config.sort.split('-');
            if (['dueDate','priority','created','status'].includes(parts[0])) {
                this.sortField = parts[0] as SortField;
            }
            if (parts[1] === 'desc') this.sortDir = 'desc';
        }

        this.headerContainer = this.containerEl.createDiv({ cls: 'umos-tasks-header-wrapper' });
        this.filtersContainer = this.containerEl.createDiv({ cls: 'umos-tasks-filters-wrapper' });
        this.listContainer = this.containerEl.createDiv({ cls: 'umos-tasks-list-wrapper' });
    }

    protected onWidgetLoad(): void {
        this.vaultModifyRef = this.app.vault.on('modify', () => {
            if (this.isUpdating) return;
            if (this.renderTimeout) clearTimeout(this.renderTimeout);
            this.renderTimeout = setTimeout(() => this.render(), 500);
        });
        this.registerEvent(this.vaultModifyRef);
    }

    protected onWidgetUnload(): void {
        if (this.renderTimeout) clearTimeout(this.renderTimeout);
    }

    protected render(): void { void this.renderAsync(); }

    // ═════════════════════════════════════════════════════════════════════
    //  MAIN RENDER
    // ═════════════════════════════════════════════════════════════════════
    private async renderAsync(full = true) {
        this.isUpdating = false;

        if (full) {
            this.headerContainer.empty();
            this.filtersContainer.empty();

            // ── Header ──────────────────────────────────────────────────────
            const header = this.headerContainer.createDiv({ cls: 'umos-tasks-header' });

            if (this.config.title) {
                header.createEl('h3', { text: this.config.title, cls: 'umos-tasks-title' });
            }

            const headerActions = header.createDiv({ cls: 'umos-tasks-header-actions' });

            const filterToggleBtn = headerActions.createEl('button', {
                cls: `clickable-icon${this.filtersOpen ? ' is-active' : ''}`,
                attr: { 'aria-label': 'Filters' },
            });
            setIcon(filterToggleBtn, 'sliders-horizontal');
            filterToggleBtn.addEventListener('click', () => {
                this.filtersOpen = !this.filtersOpen;
                this.render();
            });

            const selectBtn = headerActions.createEl('button', {
                cls: `clickable-icon${this.selectionMode ? ' is-active' : ''}`,
                attr: { 'aria-label': 'Selection' },
            });
            setIcon(selectBtn, 'list-checks');
            selectBtn.addEventListener('click', () => {
                this.selectionMode = !this.selectionMode;
                if (!this.selectionMode) this.selectedTasks.clear();
                this.render();
            });

            const createBtn = headerActions.createEl('button', { cls: 'clickable-icon', attr: { 'aria-label': 'New Task' } });
            setIcon(createBtn, 'plus');
            createBtn.addEventListener('click', () => this.openCreateModal());

            // ── Active-filter chips row ──
            this.renderActiveFilterChips(this.headerContainer);

            // ── Status quick-filter bar ─────────────────────
            const statusBar = this.headerContainer.createDiv({ cls: 'umos-tasks-filter-bar' });
            const statusFilters: { key: StatusFilter; label: string }[] = [
                { key: 'all',    label: 'All' },
                { key: 'active', label: 'Active' },
                { key: 'doing',  label: 'In Progress' },
                { key: 'done',   label: 'Done' },
            ];
            for (const f of statusFilters) {
                const btn = statusBar.createEl('button', {
                    text: f.label,
                    cls: `umos-tasks-filter-btn${this.statusFilter === f.key ? ' is-active' : ''}`,
                });
                btn.addEventListener('click', () => { this.statusFilter = f.key; this.render(); });
            }

            // ── Extended filter panel ────────────────────────────────────────
            if (this.filtersOpen) {
                this.renderFilterPanel(this.filtersContainer);
            }
        }

        // ── Load tasks ──────────────────────────────────────────────────
        const query: ITaskQuery = { ...this.config };
        if (this.config.status) {
            query.status = this.config.status.split(',').map((s: string) => s.trim()) as TaskStatus[];
        }

        const tasks = await this.service.getTasksWithQuery(query);
        this.allTasks = tasks;

        this.listContainer.empty();

        let filtered = this.applyFilters(tasks);
        this.sortTasks(filtered);

        // ── Bulk bar ────────────────────────────────────────────────────
        if (this.selectionMode) this.renderBulkBar(this.listContainer);

        // ── Empty state ─────────────────────────────────────────────────
        if (filtered.length === 0) {
            const empty = this.listContainer.createDiv({ cls: 'umos-tasks-empty' });
            empty.innerHTML = `<span>No tasks found</span>`;
            if (this.hasActiveExtraFilters()) {
                const reset = empty.createEl('button', { text: 'Reset filters', cls: 'umos-tasks-filter-reset-btn' });
                reset.addEventListener('click', () => this.resetAllFilters());
            }
            return;
        }

        // ── Stats summary bar ───────────────────────────────────────────
        this.renderStatsSummary(this.listContainer, tasks, filtered);

        // ── Task list ───────────────────────────────────────────────────
        const rootList = this.listContainer.createEl('ul', { cls: 'umos-tasks-widget' });
        this.renderTaskTree(filtered, rootList, false);
    }

    // ═════════════════════════════════════════════════════════════════════
    //  FILTER PANEL
    // ═════════════════════════════════════════════════════════════════════

    private renderFilterPanel(container: HTMLElement): void {
        const panel = container.createDiv({ cls: 'umos-tasks-filter-panel' });

        // Search
        const searchRow = panel.createDiv({ cls: 'umos-tasks-filter-row' });
        searchRow.createSpan({ cls: 'umos-tasks-filter-row-label', text: 'Search' });
        const searchInput = searchRow.createEl('input', {
            cls: 'umos-tasks-search-input',
            attr: { type: 'text', placeholder: 'Search by description...', value: this.searchQuery },
        }) as HTMLInputElement;

        searchInput.addEventListener('input', () => {
            this.searchQuery = searchInput.value;
            // UPDATE CHIPS AND LIST ONLY
            this.updateActiveFilterChipsInHeader();
            void this.renderAsync(false);
        });

        searchInput.addEventListener('blur', () => this.searchFocused = false);
        searchInput.addEventListener('focus', () => this.searchFocused = true);

        if (this.filtersOpen && this.searchFocused) {
            requestAnimationFrame(() => searchInput.focus());
        }

        // Priority filter
        const priRow = panel.createDiv({ cls: 'umos-tasks-filter-row' });
        priRow.createSpan({ cls: 'umos-tasks-filter-row-label', text: 'Priority' });
        const priBar = priRow.createDiv({ cls: 'umos-tasks-filter-pills' });
        const priBtns: { key: PriorityFilter; label: string; dot?: string }[] = [
            { key: 'all',    label: 'All' },
            { key: 'high',   label: 'High',  dot: 'priority-high' },
            { key: 'medium', label: 'Medium',   dot: 'priority-medium' },
            { key: 'low',    label: 'Low',    dot: 'priority-low' },
        ];
        for (const p of priBtns) {
            const btn = priBar.createEl('button', {
                cls: `umos-tasks-filter-pill${this.priorityFilter === p.key ? ' is-active' : ''}`,
            });
            if (p.dot) btn.createSpan({ cls: `umos-task-priority-dot ${p.dot}` });
            btn.createSpan({ text: p.label });
            btn.addEventListener('click', () => { this.priorityFilter = p.key; this.render(); });
        }

        // Due date filter
        const dueRow = panel.createDiv({ cls: 'umos-tasks-filter-row' });
        dueRow.createSpan({ cls: 'umos-tasks-filter-row-label', text: 'Due' });
        const dueBar = dueRow.createDiv({ cls: 'umos-tasks-filter-pills' });
        const dueBtns: { key: DueFilter; label: string }[] = [
            { key: 'all',     label: 'All' },
            { key: 'today',   label: 'Today' },
            { key: 'overdue', label: '🔥 Overdue' },
            { key: 'week',    label: 'This week' },
            { key: 'no-date', label: 'No date' },
        ];
        for (const d of dueBtns) {
            const btn = dueBar.createEl('button', {
                text: d.label,
                cls: `umos-tasks-filter-pill${this.dueFilter === d.key ? ' is-active' : ''}`,
            });
            btn.addEventListener('click', () => { this.dueFilter = d.key; this.render(); });
        }

        // Tags (from all loaded tasks)
        const allTags = this.collectAllTags(this.allTasks);
        if (allTags.length > 0) {
            const tagRow = panel.createDiv({ cls: 'umos-tasks-filter-row' });
            tagRow.createSpan({ cls: 'umos-tasks-filter-row-label', text: 'Tag' });
            const tagBar = tagRow.createDiv({ cls: 'umos-tasks-filter-pills umos-tasks-filter-tags' });

            const allTagBtn = tagBar.createEl('button', {
                text: 'All',
                cls: `umos-tasks-filter-pill${this.activeTagFilter === '' ? ' is-active' : ''}`,
            });
            allTagBtn.addEventListener('click', () => { this.activeTagFilter = ''; this.render(); });

            for (const tag of allTags) {
                const btn = tagBar.createEl('button', {
                    text: `#${tag}`,
                    cls: `umos-tasks-filter-pill umos-tasks-tag-pill${this.activeTagFilter === tag ? ' is-active' : ''}`,
                });
                btn.addEventListener('click', () => {
                    this.activeTagFilter = this.activeTagFilter === tag ? '' : tag;
                    this.render();
                });
            }
        }

        // Sort
        const sortRow = panel.createDiv({ cls: 'umos-tasks-filter-row' });
        sortRow.createSpan({ cls: 'umos-tasks-filter-row-label', text: 'Sort' });
        const sortBar = sortRow.createDiv({ cls: 'umos-tasks-filter-pills' });
        const sortBtns: { field: SortField; label: string }[] = [
            { field: 'priority', label: 'Priority' },
            { field: 'dueDate',  label: 'Date' },
            { field: 'created',  label: 'Created' },
            { field: 'status',   label: 'Status' },
        ];
        for (const s of sortBtns) {
            const isActive = this.sortField === s.field;
            const btn = sortBar.createEl('button', {
                cls: `umos-tasks-filter-pill${isActive ? ' is-active' : ''}`,
            });
            btn.createSpan({ text: s.label });
            if (isActive) {
                btn.createSpan({ cls: 'umos-tasks-sort-dir', text: this.sortDir === 'asc' ? ' ↑' : ' ↓' });
            }
            btn.addEventListener('click', () => {
                if (this.sortField === s.field) {
                    this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
                } else {
                    this.sortField = s.field;
                    this.sortDir = 'asc';
                }
                this.render();
            });
        }

        // Reset button
        if (this.hasActiveExtraFilters()) {
            const resetRow = panel.createDiv({ cls: 'umos-tasks-filter-reset-row' });
            const resetBtn = resetRow.createEl('button', { text: '✕ Reset filters', cls: 'umos-tasks-filter-reset-btn' });
            resetBtn.addEventListener('click', () => this.resetAllFilters());
        }
    }

    /** Chips above the status bar showing active non-default filters */
    private renderActiveFilterChips(container: HTMLElement): void {
        if (!this.hasActiveExtraFilters()) return;
        
        const row = document.createElement('div');
        row.className = 'umos-tasks-active-filters';
        
        const statusBar = container.querySelector('.umos-tasks-filter-bar');
        if (statusBar) {
            container.insertBefore(row, statusBar);
        } else {
            container.appendChild(row);
        }

        const add = (label: string, onClose: () => void) => {
            const chip = row.createSpan({ cls: 'umos-tasks-active-chip' });
            chip.createSpan({ text: label });
            const x = chip.createEl('button', { text: '×', cls: 'umos-tasks-active-chip-close' });
            x.addEventListener('click', (e) => { e.stopPropagation(); onClose(); this.render(); });
        };

        if (this.priorityFilter !== 'all') {
            const labels: Record<string, string> = { high: '🔴 High', medium: '🟡 Medium', low: '🟢 Low' };
            add(labels[this.priorityFilter] ?? this.priorityFilter, () => { this.priorityFilter = 'all'; });
        }
        if (this.dueFilter !== 'all') {
            const labels: Record<string, string> = { today: 'Today', overdue: '🔥 Overdue', week: 'This week', 'no-date': 'No date' };
            add(labels[this.dueFilter] ?? this.dueFilter, () => { this.dueFilter = 'all'; });
        }
        if (this.activeTagFilter) {
            add(`#${this.activeTagFilter}`, () => { this.activeTagFilter = ''; });
        }
        if (this.searchQuery) {
            add(`"${this.searchQuery}"`, () => { this.searchQuery = ''; });
        }
    }

    private applyFilters(tasks: Task[]): Task[] {
        const today = moment().startOf('day');
        let result = tasks;

        // Status
        if (this.statusFilter === 'active') {
            result = result.filter(t => t.status === 'todo' || t.status === 'doing');
        } else if (this.statusFilter === 'doing') {
            result = result.filter(t => t.status === 'doing');
        } else if (this.statusFilter === 'done') {
            result = result.filter(t => t.status === 'done' || t.status === 'cancelled');
        }

        // Priority
        if (this.priorityFilter !== 'all') {
            result = result.filter(t => t.priority === this.priorityFilter);
        }

        // Due date
        if (this.dueFilter === 'today') {
            result = result.filter(t => t.dueDate === today.format('YYYY-MM-DD'));
        } else if (this.dueFilter === 'overdue') {
            result = result.filter(t =>
                t.status !== 'done' && t.status !== 'cancelled' &&
                t.dueDate && moment(t.dueDate).isBefore(today)
            );
        } else if (this.dueFilter === 'week') {
            const weekEnd = moment().endOf('isoWeek');
            result = result.filter(t =>
                t.dueDate && moment(t.dueDate).isSameOrBefore(weekEnd) &&
                !moment(t.dueDate).isBefore(today)
            );
        } else if (this.dueFilter === 'no-date') {
            result = result.filter(t => !t.dueDate);
        }

        // Tag
        if (this.activeTagFilter) {
            result = result.filter(t => t.tags.includes(this.activeTagFilter));
        }

        // Search
        if (this.searchQuery.trim()) {
            const q = this.searchQuery.toLowerCase();
            result = result.filter(t => t.description.toLowerCase().includes(q));
        }

        return result;
    }

    private updateActiveFilterChipsInHeader(): void {
        const existing = this.headerContainer.querySelector('.umos-tasks-active-filters');
        if (existing) existing.remove();
        this.renderActiveFilterChips(this.headerContainer);
    }

    private hasActiveExtraFilters(): boolean {
        return this.priorityFilter !== 'all' ||
            this.dueFilter !== 'all' ||
            this.activeTagFilter !== '' ||
            this.searchQuery !== '';
    }

    private resetAllFilters(): void {
        this.priorityFilter  = 'all';
        this.dueFilter       = 'all';
        this.activeTagFilter = '';
        this.searchQuery     = '';
        this.render();
    }

    private collectAllTags(tasks: Task[]): string[] {
        const set = new Set<string>();
        const walk = (list: Task[]) => { for (const t of list) { t.tags.forEach(tag => set.add(tag)); walk(t.subtasks as Task[]); } };
        walk(tasks);
        return [...set].sort();
    }

    // ═════════════════════════════════════════════════════════════════════
    //  STATS SUMMARY
    // ═════════════════════════════════════════════════════════════════════

    private renderStatsSummary(container: HTMLElement, all: Task[], filtered: Task[]): void {
        const today = moment().startOf('day');
        const weekStart = today.clone().subtract(6, 'days');
        const allInRange = all.filter(t => this.isTaskInSummaryRange(t, weekStart, today));
        const filteredInRange = filtered.filter(t => this.isTaskInSummaryRange(t, weekStart, today));

        const total   = allInRange.filter(t => t.status !== 'cancelled').length;
        const done    = allInRange.filter(t => t.status === 'done').length;
        const doing   = allInRange.filter(t => t.status === 'doing').length;
        const overdue = allInRange.filter(t =>
            t.status !== 'done' && t.status !== 'cancelled' &&
            t.dueDate && moment(t.dueDate).isBefore(today)
        ).length;

        if (total === 0) return;

        const bar = container.createDiv({ cls: 'umos-tasks-summary-bar' });

        const addStat = (icon: string, val: number, label: string, cls = '') => {
            if (val === 0 && cls !== 'umos-tasks-stat--total') return;
            const s = bar.createSpan({ cls: `umos-tasks-stat${cls ? ' ' + cls : ''}` });
            s.createSpan({ cls: 'umos-tasks-stat-icon', text: icon });
            s.createSpan({ cls: 'umos-tasks-stat-val', text: String(val) });
            s.createSpan({ cls: 'umos-tasks-stat-label', text: label });
        };

        addStat('📋', filtered.length !== all.length ? filteredInRange.length : total, 'tasks', 'umos-tasks-stat--total');
        addStat('▶', doing, 'active', 'umos-tasks-stat--doing');
        addStat('✅', done, 'done', 'umos-tasks-stat--done');
        if (overdue > 0) addStat('🔥', overdue, 'overdue', 'umos-tasks-stat--overdue');

        if (done > 0 && total > 0) {
            const pct = Math.round((done / total) * 100);
            const progressWrap = bar.createDiv({ cls: 'umos-tasks-stat-progress' });
            const progressFill = progressWrap.createDiv({ cls: 'umos-tasks-stat-progress-fill' });
            progressFill.style.width = `${pct}%`;
        }
    }

    private isTaskInSummaryRange(task: Task, from: ReturnType<typeof moment>, to: ReturnType<typeof moment>): boolean {
        const rawDate = this.getTaskSummaryDate(task);
        if (!rawDate) return false;

        const date = moment(rawDate, 'YYYY-MM-DD', true).startOf('day');
        return date.isValid() && !date.isBefore(from, 'day') && !date.isAfter(to, 'day');
    }

    private getTaskSummaryDate(task: Task): string | null {
        return task.doneDate
            || task.dueDate
            || task.scheduledDate
            || task.startDate
            || this.extractDateFromPath(task.filePath);
    }

    private extractDateFromPath(path: string): string | null {
        const match = path.match(/(\d{4}-\d{2}-\d{2})/);
        return match ? match[1] : null;
    }

    // ═════════════════════════════════════════════════════════════════════
    //  BULK BAR
    // ═════════════════════════════════════════════════════════════════════

    private renderBulkBar(container: HTMLElement) {
        const bar = container.createDiv({ cls: 'umos-tasks-bulk-bar' });
        bar.createSpan({ text: `Selected: ${this.selectedTasks.size}`, cls: 'umos-tasks-bulk-count' });

        const completeBtn = bar.createEl('button', { text: 'Complete', cls: 'umos-tasks-bulk-btn' });
        completeBtn.addEventListener('click', async () => {
            if (this.selectedTasks.size === 0) return;
            await this.service.bulkUpdate([...this.selectedTasks], { status: 'done' });
            this.selectedTasks.clear();
            this.selectionMode = false;
            setTimeout(() => this.render(), 300);
        });

        const postponeBtn = bar.createEl('button', { text: 'Tomorrow', cls: 'umos-tasks-bulk-btn' });
        postponeBtn.addEventListener('click', async () => {
            if (this.selectedTasks.size === 0) return;
            const tomorrow = moment().add(1, 'day').format('YYYY-MM-DD');
            await this.service.bulkUpdate([...this.selectedTasks], { dueDate: tomorrow });
            this.selectedTasks.clear();
            this.selectionMode = false;
            setTimeout(() => this.render(), 300);
        });
    }

    // ═════════════════════════════════════════════════════════════════════
    //  TASK TREE
    // ═════════════════════════════════════════════════════════════════════

    private renderTaskTree(tasks: Task[], parentUl: HTMLUListElement, isSubtask = false) {
        let currentDateStr = '';
        const shouldGroup = !isSubtask && (this.statusFilter === 'done' || this.sortField === 'dueDate');

        for (const task of tasks) {
            if (shouldGroup) {
                const rawDate = this.statusFilter === 'done' 
                    ? (task.doneDate || task.dueDate || '') 
                    : (task.dueDate || task.scheduledDate || task.doneDate || '');
                const dateStr = rawDate || 'No date';
                if (dateStr !== currentDateStr) {
                    parentUl.createEl('li', { cls: 'umos-tasks-date-header', text: this.formatDateHeader(dateStr) });
                    currentDateStr = dateStr;
                }
            }

            const today = moment().startOf('day');
            const isOverdue = task.status !== 'done' && task.status !== 'cancelled' && task.dueDate && moment(task.dueDate).isBefore(today);

            let taskChar = ' ';
            if (task.status === 'done')      taskChar = 'x';
            if (task.status === 'doing')     taskChar = '/';
            if (task.status === 'cancelled') taskChar = '-';

            let itemCls = `umos-task-item task-list-item${isOverdue ? ' is-overdue' : ''}`;
            if (task.status === 'done') itemCls += ' is-checked';

            const item = parentUl.createEl('li', {
                cls: itemCls,
                attr: { 'data-umos-status': task.status, 'data-task': taskChar },
            });
            if (isSubtask) item.addClass('is-subtask');

            const self = item.createDiv({ cls: 'umos-task-item-self' });

            // Bulk selection checkbox
            if (this.selectionMode && !isSubtask) {
                const cb = self.createEl('input', { type: 'checkbox', cls: 'umos-task-select-checkbox' }) as HTMLInputElement;
                cb.checked = this.selectedTasks.has(task);
                cb.addEventListener('change', () => {
                    if (cb.checked) this.selectedTasks.add(task); else this.selectedTasks.delete(task);
                    const countEl = this.containerEl.querySelector('.umos-tasks-bulk-count');
                    if (countEl) countEl.textContent = `Selected: ${this.selectedTasks.size}`;
                });
            }

            // Checkbox
            const checkboxWrap = self.createDiv({ cls: 'umos-task-checkbox-container' });
            const checkbox = checkboxWrap.createEl('input', { type: 'checkbox', cls: 'task-list-item-checkbox' }) as HTMLInputElement;
            checkbox.checked = task.status === 'done';
            checkbox.dataset.task = taskChar;
            checkbox.style.cursor = 'pointer';

            checkbox.addEventListener('click', async (e) => {
                e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
                if (this.isUpdating) return;
                this.isUpdating = true;
                await this.service.cycleTaskStatus(task);
                setTimeout(() => { this.isUpdating = false; this.render(); }, 300);
            });
            checkboxWrap.addEventListener('click', (e) => { if (e.target !== checkbox) checkbox.click(); });

            // Content
            const content = self.createDiv({ cls: 'umos-task-content' });
            const mainRow = content.createDiv({ cls: 'umos-task-main' });

            // Priority dot
            if (task.priority !== 'none') {
                mainRow.createSpan({ cls: `umos-task-priority-dot priority-${task.priority}` });
            }

            // Status badge
            if (task.status === 'doing') {
                mainRow.createSpan({ cls: 'umos-task-status-badge is-doing', text: 'in progress' });
            } else if (task.status === 'cancelled') {
                mainRow.createSpan({ cls: 'umos-task-status-badge is-cancelled', text: 'cancelled' });
            }

            // Highlight search match in description
            const descEl = mainRow.createEl('a', { cls: 'umos-task-description' });
            const cleanDesc = task.description.replace(/[⏫🔼🔽\uFFFD]/g, '').trim();
            if (this.searchQuery.trim()) {
                this.renderHighlightedText(descEl, cleanDesc, this.searchQuery);
            } else {
                descEl.setText(cleanDesc);
            }

            descEl.addEventListener('click', () => {
                this.app.workspace.openLinkText(task.filePath, task.filePath, false).then(() => {
                    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
                    if (view) view.editor.setCursor(task.lineNumber, 0);
                });
            });

            // Inline edit on double-click
            descEl.addEventListener('dblclick', (e) => {
                e.preventDefault(); e.stopPropagation();
                const input = document.createElement('input');
                input.type = 'text';
                input.value = task.description;
                input.className = 'umos-task-inline-edit';
                descEl.replaceWith(input);
                input.focus(); input.select();

                const save = async () => {
                    const newDesc = input.value.trim();
                    if (newDesc && newDesc !== task.description) {
                        task.description = newDesc;
                        this.isUpdating = true;
                        await this.service.updateTask(task);
                        setTimeout(() => { this.isUpdating = false; this.render(); }, 300);
                    } else {
                        input.replaceWith(descEl);
                    }
                };
                input.addEventListener('keydown', (ev) => {
                    if (ev.key === 'Enter') { ev.preventDefault(); void save(); }
                    if (ev.key === 'Escape') input.replaceWith(descEl);
                });
                input.addEventListener('blur', () => void save());
            });

            // Metadata row
            if (task.dueDate || task.tags.length > 0 || task.scheduledDate || task.startDate || task.recurrence || task.doneDate) {
                const meta = content.createDiv({ cls: 'umos-task-metadata' });

                if (task.dueDate) {
                    meta.createSpan({ cls: `umos-task-date-badge${isOverdue ? ' is-overdue' : ''}`, text: `due: ${task.dueDate}` });
                }
                if (task.scheduledDate) meta.createSpan({ cls: 'umos-task-date-badge', text: `scheduled: ${task.scheduledDate}` });
                if (task.startDate)     meta.createSpan({ cls: 'umos-task-date-badge', text: `start: ${task.startDate}` });
                if (task.doneDate)      meta.createSpan({ cls: 'umos-task-date-badge is-done', text: `✅ ${task.doneDate}` });
                if (task.recurrence)    meta.createSpan({ cls: 'umos-task-date-badge is-rec', text: `repeat: ${task.recurrence}` });

                if (task.tags.length > 0) {
                    const tagsSpan = meta.createSpan({ cls: 'umos-task-tags' });
                    task.tags.forEach(tag => {
                        const tagEl = tagsSpan.createEl('span', { cls: 'tag', text: `#${tag}` });
                        tagEl.addEventListener('click', (e) => {
                            e.stopPropagation();
                            this.activeTagFilter = this.activeTagFilter === tag ? '' : tag;
                            this.filtersOpen = true;
                            this.render();
                        });
                        tagEl.style.cursor = 'pointer';
                    });
                }
            }

            // Progress badge (startDate + dueDate) — shown in metadata row
            if (task.startDate && task.dueDate && task.status !== 'done' && task.status !== 'cancelled' && !isSubtask) {
                const start = moment(task.startDate);
                const due   = moment(task.dueDate);
                const now   = moment();
                const totalDays   = due.diff(start, 'days');
                const elapsedDays = now.diff(start, 'days');
                const daysLeft    = due.diff(now, 'days');
                const isLate      = now.isAfter(due);

                if (totalDays > 0) {
                    const pct = Math.min(Math.max(elapsedDays / totalDays, 0), 1);
                    const pctRound = Math.round(pct * 100);
                    const statusCls = isLate ? 'is-overdue' : pct >= 0.75 ? 'is-warn' : 'is-ok';

                    // Ensure metadata row exists
                    let meta = content.querySelector<HTMLElement>('.umos-task-metadata');
                    if (!meta) {
                        meta = content.createDiv({ cls: 'umos-task-metadata' });
                    }

                    const badge = meta.createDiv({ cls: `umos-task-progress-badge ${statusCls}` });

                    // Mini inline progress track inside the badge
                    const miniTrack = badge.createDiv({ cls: 'umos-task-progress-badge-track' });
                    const miniFill  = miniTrack.createDiv({ cls: 'umos-task-progress-badge-fill' });
                    miniFill.style.width = `${pctRound}%`;

                    // Text label
                    const labelEl = badge.createSpan({ cls: 'umos-task-progress-badge-label' });
                    if (isLate) {
                        labelEl.textContent = `🔥 Overdue by ${Math.abs(daysLeft)} d`;
                    } else if (daysLeft === 0) {
                        labelEl.textContent = `⚡ Due today`;
                    } else {
                        labelEl.textContent = `⏱ ${daysLeft} d · ${pctRound}%`;
                    }
                }
            }

            // Controls
            const ctrl = self.createDiv({ cls: 'umos-task-controls' });
            const editBtn = ctrl.createEl('button', { cls: 'clickable-icon', attr: { 'aria-label': 'Edit' } });
            setIcon(editBtn, 'pencil');
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const modal = new TaskEditorModal(this.app, task, async (updatedTask, subtasks) => {
                    this.isUpdating = true;
                    await this.service.updateTask(updatedTask);
                    if (subtasks.length > 0) {
                        await this.service.addSubtasksAfterLine(updatedTask.filePath, updatedTask.lineNumber, updatedTask.indentation, subtasks);
                    }
                    setTimeout(() => { this.isUpdating = false; this.render(); }, 300);
                }, async (deletedTask) => {
                    this.isUpdating = true;
                    await this.service.deleteTask(deletedTask);
                    setTimeout(() => { this.isUpdating = false; this.render(); }, 300);
                }, this.plugin);
                modal.open();
            });

            const delBtn = ctrl.createEl('button', { cls: 'clickable-icon', attr: { 'aria-label': 'Delete' } });
            setIcon(delBtn, 'trash');
            delBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!window.confirm('Delete task?')) return;
                this.isUpdating = true;
                await this.service.deleteTask(task);
                setTimeout(() => { this.isUpdating = false; this.render(); }, 300);
            });

            // Subtasks
            if (task.subtasks.length > 0) {
                const sublist = item.createEl('ul', { cls: 'umos-tasks-sublist' });
                this.renderTaskTree(task.subtasks, sublist, true);
            }
        }
    }

    /** Highlight search matches in text */
    private renderHighlightedText(el: HTMLElement, text: string, query: string): void {
        const q = query.toLowerCase();
        let i = 0;
        while (i < text.length) {
            const idx = text.toLowerCase().indexOf(q, i);
            if (idx === -1) { el.appendText(text.slice(i)); break; }
            if (idx > i) el.appendText(text.slice(i, idx));
            const mark = el.createEl('mark', { cls: 'umos-tasks-search-highlight', text: text.slice(idx, idx + q.length) });
            i = idx + q.length;
        }
    }

    // ═════════════════════════════════════════════════════════════════════
    //  SORTING
    // ═════════════════════════════════════════════════════════════════════

    private sortTasks(tasks: Task[]) {
        const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2, none: 3 };
        const statusOrder: Record<string, number>   = { doing: 0, todo: 1, done: 2, cancelled: 3 };
        const today = moment().startOf('day');
        const dir = this.sortDir === 'desc' ? -1 : 1;
        const field = this.sortField;

        tasks.sort((a, b) => {
            // Done/cancelled always at bottom
            if (field !== 'status') {
                const aFin = a.status === 'done' || a.status === 'cancelled';
                const bFin = b.status === 'done' || b.status === 'cancelled';
                if (aFin && !bFin) return 1;
                if (!aFin && bFin) return -1;
            }

            // Overdue first by default
            if (field === 'priority' && dir === 1) {
                const aOv = a.status !== 'done' && a.status !== 'cancelled' && a.dueDate && moment(a.dueDate).isBefore(today);
                const bOv = b.status !== 'done' && b.status !== 'cancelled' && b.dueDate && moment(b.dueDate).isBefore(today);
                if (aOv && !bOv) return -1;
                if (!aOv && bOv) return 1;
            }

            switch (field) {
                case 'dueDate': {
                    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate) * dir;
                    if (a.dueDate) return -dir;
                    if (b.dueDate) return dir;
                    break;
                }
                case 'priority': {
                    const diff = (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3);
                    if (diff !== 0) return diff * dir;
                    break;
                }
                case 'created': return (a.lineNumber - b.lineNumber) * dir;
                case 'status': {
                    const diff = (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3);
                    if (diff !== 0) return diff * dir;
                    break;
                }
            }

            // Fallback
            const priDiff = (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3);
            if (priDiff !== 0) return priDiff;
            if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
            if (a.dueDate) return -1;
            if (b.dueDate) return 1;
            return 0;
        });

        for (const task of tasks) {
            if (task.subtasks.length > 0) this.sortTasks(task.subtasks as Task[]);
        }
    }

    // ═════════════════════════════════════════════════════════════════════
    //  HELPERS
    // ═════════════════════════════════════════════════════════════════════

    private scheduleRender(): void {
        if (this.renderTimeout) clearTimeout(this.renderTimeout);
        this.renderTimeout = setTimeout(() => this.render(), 200);
    }

    private formatDateHeader(dateStr: string): string {
        if (!dateStr || dateStr === 'No date') return 'No date';
        const m = moment(dateStr, 'YYYY-MM-DD');
        if (!m.isValid()) return dateStr;
        
        const today = moment().startOf('day');
        const diff = m.diff(today, 'days');
        
        if (diff === 0) return 'Today';
        if (diff === -1) return 'Yesterday';
        if (diff === 1) return 'Tomorrow';
        
        return m.format('D MMMM YYYY');
    }

    private openCreateModal() {
        const newTask = new Task('', '', 0);
        newTask.description = '';
        this.applyDefaultTags(newTask);

        const modal = new TaskEditorModal(this.app, newTask, async (task, subtasks) => {
            const filePath = this.resolveCreateTargetPath();
            if (!filePath) { new Notice('Could not determine the file for creating a task'); return; }
            const lineNum = await this.service.createTask(task, filePath);
            if (subtasks.length > 0) {
                await this.service.addSubtasksAfterLine(filePath, lineNum, task.indentation, subtasks);
            }
            setTimeout(() => this.render(), 300);
        }, undefined, this.plugin);
        modal.open();
    }

    private getTodayDailyNotePath(): string {
        const s = this.plugin.settings;
        return `${s.dailyNotesPath}/${moment().format(s.dailyNoteFormat || 'YYYY-MM-DD')}.md`;
    }

    private resolveCreateTargetPath(): string | null {
        const file = typeof this.config.file === 'string' ? this.config.file.trim() : '';
        if (file) return file;
        const targetRaw = String(this.config.target || this.config.create_in || '').toLowerCase();
        if (targetRaw === 'current' || this.config.use_current === true) return this.sourcePath;
        const tagRaw = typeof this.config.tag === 'string' ? this.config.tag.trim() : '';
        if (tagRaw.startsWith('projectTasks/') && this.sourcePath) return this.sourcePath;
        return this.getTodayDailyNotePath();
    }

    private applyDefaultTags(task: Task): void {
        const tags: string[] = [];
        if (typeof this.config.tag === 'string' && this.config.tag.trim()) tags.push(this.config.tag.replace(/^#/, '').trim());
        if (typeof this.config.default_tag === 'string' && this.config.default_tag.trim()) tags.push(this.config.default_tag.replace(/^#/, '').trim());
        if (Array.isArray(this.config.default_tags)) {
            for (const t of this.config.default_tags) { if (t) tags.push(String(t).replace(/^#/, '').trim()); }
        }
        if (tags.length > 0) task.tags = Array.from(new Set([...(task.tags || []), ...tags.filter(t => t.length > 0)]));
    }
}
