import { App, EventRef, MarkdownView, moment, setIcon } from 'obsidian';
import UmOSPlugin from '../../main';
import { BaseWidget, EventSubscription } from '../../core/BaseWidget';
import { ICompletedTaskBuckets, TaskService } from './TaskService';
import { ITaskQuery, Task } from './Task';
import { t } from '../../i18n';

type CompletedRangeKey = 'today' | 'last7' | 'last30';

export class TasksCompletedWidget extends BaseWidget {
    private app: App;
    private plugin: UmOSPlugin;
    private service: TaskService;
    private config: Record<string, unknown>;
    private renderTimeout: ReturnType<typeof setTimeout> | null = null;
    private activeRange: CompletedRangeKey;
    private isOpen: boolean;

    constructor(
        containerEl: HTMLElement,
        config: Record<string, unknown>,
        app: App,
        plugin: UmOSPlugin,
    ) {
        super(containerEl);
        this.app = app;
        this.plugin = plugin;
        this.config = config;
        this.service = new TaskService(app, plugin);
        this.eventBus = plugin.eventBus;
        this.activeRange = this.normalizeRange(config.range);
        this.isOpen = !this.isCollapsedByDefault();
    }

    protected subscribeToEvents(): EventSubscription[] {
        return [
            { event: 'tasks:changed', handler: () => this.scheduleRender() },
        ];
    }

    protected onWidgetLoad(): void {
        const ref: EventRef = this.app.vault.on('modify', () => this.scheduleRender(500));
        this.registerEvent(ref);
    }

    protected onWidgetUnload(): void {
        if (this.renderTimeout) clearTimeout(this.renderTimeout);
    }

    protected render(): void {
        void this.renderAsync();
    }

    private async renderAsync(): Promise<void> {
        const buckets = await this.service.getCompletedTaskBuckets(this.getQuery());
        if (!this.containerEl.isConnected) return;

        this.containerEl.empty();

        const wrapper = this.containerEl.createDiv({ cls: 'umos-tasks-completed' });
        const details = wrapper.createEl('details', { cls: 'umos-tasks-completed-details' }) as HTMLDetailsElement;
        details.open = this.isOpen;
        details.addEventListener('toggle', () => {
            this.isOpen = details.open;
        });

        this.renderSummary(details, buckets);
        this.renderBody(details, buckets);
    }

    private renderSummary(details: HTMLDetailsElement, buckets: ICompletedTaskBuckets): void {
        const summary = details.createEl('summary', { cls: 'umos-tasks-completed-summary' });

        const main = summary.createDiv({ cls: 'umos-tasks-completed-summary-main' });
        const chevron = main.createSpan({ cls: 'umos-tasks-completed-chevron' });
        setIcon(chevron, 'chevron-right');
        main.createSpan({
            cls: 'umos-tasks-completed-title',
            text: t(String(this.config.title || 'Completed tasks')),
        });

        const stats = summary.createDiv({ cls: 'umos-tasks-completed-summary-stats' });
        this.renderCountPill(stats, t('Today'), buckets.today.length, 'today');
        this.renderCountPill(stats, t('7 days'), buckets.last7.length, 'last7');
        this.renderCountPill(stats, t('30 days'), buckets.last30.length, 'last30');
    }

    private renderBody(details: HTMLDetailsElement, buckets: ICompletedTaskBuckets): void {
        const body = details.createDiv({ cls: 'umos-tasks-completed-body' });

        const tasks = this.getRangeTasks(buckets, this.activeRange);
        tasks.sort((a, b) => {
            const dateA = a.doneDate || a.dueDate || '';
            const dateB = b.doneDate || b.dueDate || '';
            if (dateA !== dateB) return dateB.localeCompare(dateA);
            return b.lineNumber - a.lineNumber;
        });
        if (tasks.length === 0) {
            body.createDiv({ cls: 'umos-tasks-completed-empty', text: t('No completed tasks in this range') });
            return;
        }

        const list = body.createDiv({ cls: 'umos-tasks-completed-list' });
        const limit = this.getLimit();
        
        let currentDateStr = '';
        
        for (const task of tasks.slice(0, limit)) {
            const dateStr = task.doneDate || task.dueDate || t('No date');
            if (dateStr !== currentDateStr) {
                list.createDiv({ cls: 'umos-tasks-completed-date-header', text: this.formatDateHeader(dateStr) });
                currentDateStr = dateStr;
            }
            this.renderTask(list, task);
        }

        if (tasks.length > limit) {
            list.createDiv({
                cls: 'umos-tasks-completed-more',
                text: `+${tasks.length - limit} ${t('more in this range')}`,
            });
        }
    }

    private renderTask(parent: HTMLElement, task: Task): void {
        const item = parent.createDiv({ cls: 'umos-tasks-completed-item' });
        const line = item.createDiv({ cls: 'umos-tasks-completed-line' });

        if (task.priority !== 'none') {
            line.createSpan({ cls: `umos-task-priority-dot priority-${task.priority}` });
        }

        const link = line.createEl('a', {
            cls: 'umos-tasks-completed-description',
            text: task.description.trim() || t('Untitled task'),
            attr: { title: t('Open task') },
        });
        link.addEventListener('click', () => this.openTask(task));

        const meta = item.createDiv({ cls: 'umos-tasks-completed-meta' });
        if (task.doneDate) meta.createSpan({ cls: 'umos-tasks-completed-date is-done', text: `${t('Done')}: ${task.doneDate}` });
        if (task.dueDate) meta.createSpan({ cls: 'umos-tasks-completed-date', text: `${t('Due')}: ${task.dueDate}` });
        meta.createSpan({ cls: 'umos-tasks-completed-path', text: task.filePath });

        if (task.tags.length > 0) {
            const tags = meta.createSpan({ cls: 'umos-tasks-completed-tags' });
            for (const tag of task.tags) {
                tags.createSpan({ cls: 'tag', text: `#${tag}` });
            }
        }
    }

    private openTask(task: Task): void {
        void this.app.workspace.openLinkText(task.filePath, task.filePath, false).then(() => {
            const view = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (view) view.editor.setCursor(task.lineNumber, 0);
        });
    }

    private formatDateHeader(dateStr: string): string {
        if (!dateStr || dateStr === t('No date')) return t('No date');
        const m = moment(dateStr, 'YYYY-MM-DD');
        if (!m.isValid()) return dateStr;
        
        const today = moment().startOf('day');
        const diff = m.diff(today, 'days');
        
        if (diff === 0) return t('Today');
        if (diff === -1) return t('Yesterday');
        if (diff === 1) return t('Tomorrow');
        
        return m.format('D MMMM YYYY');
    }

    private renderCountPill(parent: HTMLElement, label: string, count: number, key: CompletedRangeKey): void {
        const pill = parent.createSpan({
            cls: `umos-tasks-completed-count${this.activeRange === key ? ' is-active' : ''}`,
        });
        pill.setAttr('role', 'button');
        pill.setAttr('tabindex', '0');
        pill.setAttr('aria-pressed', String(this.activeRange === key));
        pill.setAttr('title', this.getRangeLabel(key));
        pill.createSpan({ cls: 'umos-tasks-completed-count-value', text: String(count) });
        pill.createSpan({ cls: 'umos-tasks-completed-count-label', text: label });

        const activate = (event: Event) => {
            event.preventDefault();
            event.stopPropagation();
            this.activeRange = key;
            this.isOpen = true;
            this.render();
        };

        pill.addEventListener('click', activate);
        pill.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            activate(event);
        });
    }

    private getRangeTasks(buckets: ICompletedTaskBuckets, key: CompletedRangeKey): Task[] {
        if (key === 'today') return buckets.today;
        if (key === 'last7') return buckets.last7;
        return buckets.last30;
    }

    private getRangeLabel(key: CompletedRangeKey): string {
        if (key === 'today') return t('Today');
        if (key === 'last7') return t('Last 7 days');
        return t('Last 30 days');
    }

    private normalizeRange(value: unknown): CompletedRangeKey {
        const raw = String(value ?? '').trim().toLowerCase();
        if (raw === 'today' || raw === '1' || raw === '1d') return 'today';
        if (raw === '30' || raw === '30d' || raw === '30days' || raw === 'last30') return 'last30';
        return 'last7';
    }

    private getQuery(): ITaskQuery {
        return { ...this.config } as ITaskQuery;
    }

    private getLimit(): number {
        const limit = Number(this.config.limit ?? 8);
        if (!Number.isFinite(limit)) return 8;
        return Math.max(1, Math.min(50, Math.floor(limit)));
    }

    private isCollapsedByDefault(): boolean {
        const value = this.config.collapsed;
        if (value === false || value === 'false') return false;
        return true;
    }

    private scheduleRender(delay = 150): void {
        if (this.renderTimeout) clearTimeout(this.renderTimeout);
        this.renderTimeout = setTimeout(() => this.render(), delay);
    }
}
