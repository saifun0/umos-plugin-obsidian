import { App, setIcon, EventRef, moment, Menu, Notice } from 'obsidian';
import UmOSPlugin from '../../main';
import { BaseWidget } from '../../core/BaseWidget';
import { TaskService } from './TaskService';
import { Task, TaskStatus, ITaskQuery } from './Task';
import { TaskEditorModal } from './TaskEditorModal';

interface KanbanColumn {
    status: TaskStatus;
    label: string;
    color: string;
    tasks: Task[];
}

export class TasksKanbanWidget extends BaseWidget {
    private app: App;
    private plugin: UmOSPlugin;
    private service: TaskService;
    private config: any;
    private sourcePath: string | null = null;
    private vaultModifyRef: EventRef | null = null;
    private renderTimeout: ReturnType<typeof setTimeout> | null = null;
    private isUpdating = false;
    private draggedTask: Task | null = null;

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

    protected render(): void {
        void this.renderAsync();
    }

    private async renderAsync() {
        this.isUpdating = false;
        this.containerEl.empty();

        if (this.config.title) {
            this.containerEl.createEl('h3', { text: this.config.title });
        }

        const query: ITaskQuery = { ...this.config };
        const allTasks = await this.service.getTasksWithQuery(query);
        const tasks = allTasks.filter(t => t.indentation === 0);

        const columns: KanbanColumn[] = [
            { status: 'todo',  label: 'К выполнению', color: '#f39c12', tasks: [] },
            { status: 'doing', label: 'В процессе',   color: '#7c5cbf', tasks: [] },
            { status: 'done',  label: 'Выполнено',    color: '#27ae60', tasks: [] },
        ];

        for (const task of tasks) {
            if (task.status === 'todo') columns[0].tasks.push(task);
            else if (task.status === 'doing') columns[1].tasks.push(task);
            else if (task.status === 'done' || task.status === 'cancelled') columns[2].tasks.push(task);
        }

        const board = this.containerEl.createDiv({ cls: 'umos-kanban-board' });

        for (const col of columns) {
            this.renderColumn(board, col);
        }
    }

    private renderColumn(board: HTMLElement, column: KanbanColumn) {
        const colEl = board.createDiv({ cls: 'umos-kanban-column' });

        // Header
        const header = colEl.createDiv({ cls: 'umos-kanban-column-header' });
        header.style.borderTopColor = column.color;

        const left = header.createDiv({ cls: 'umos-kanban-column-header-left' });
        left.createSpan({ text: column.label, cls: 'umos-kanban-column-title' });
        left.createSpan({ text: `${column.tasks.length}`, cls: 'umos-kanban-column-count' });

        const addBtn = header.createEl('button', { cls: 'umos-kanban-add-btn', attr: { 'aria-label': 'Добавить задачу' } });
        setIcon(addBtn, 'plus');
        addBtn.addEventListener('click', () => this.openCreateModal(column.status));

        // Drop zone
        const list = colEl.createDiv({ cls: 'umos-kanban-column-list' });

        list.addEventListener('dragover', (e) => {
            e.preventDefault();
            list.addClass('is-drag-over');
        });
        list.addEventListener('dragleave', () => {
            list.removeClass('is-drag-over');
        });
        list.addEventListener('drop', async (e) => {
            e.preventDefault();
            list.removeClass('is-drag-over');
            if (!this.draggedTask || this.draggedTask.status === column.status) return;
            this.draggedTask.status = column.status;
            this.isUpdating = true;
            await this.service.updateTask(this.draggedTask);
            this.draggedTask = null;
            setTimeout(() => { this.isUpdating = false; this.render(); }, 300);
        });

        // Cards
        for (const task of column.tasks) {
            this.renderCard(list, task);
        }

        if (column.tasks.length === 0) {
            list.createDiv({ cls: 'umos-kanban-empty', text: 'Пусто' });
        }
    }

    private renderCard(list: HTMLElement, task: Task) {
        const today = moment().startOf('day');
        const isOverdue = task.status !== 'done' && task.status !== 'cancelled'
            && task.dueDate != null && moment(task.dueDate).isBefore(today);

        const card = list.createDiv({
            cls: `umos-kanban-card${isOverdue ? ' is-overdue' : ''}`,
            attr: { draggable: 'true' }
        });

        card.addEventListener('dragstart', () => { this.draggedTask = task; card.addClass('is-dragging'); });
        card.addEventListener('dragend', () => { card.removeClass('is-dragging'); });

        // Top row: priority badge + menu button
        const topRow = card.createDiv({ cls: 'umos-kanban-card-top' });

        if (task.priority !== 'none') {
            const priorityLabels: Record<string, string> = { high: 'Важно', medium: 'Средне', low: 'Не срочно' };
            topRow.createSpan({
                cls: `umos-kanban-priority-badge priority-${task.priority}`,
                text: priorityLabels[task.priority]
            });
        } else {
            topRow.createSpan(); // spacer
        }

        const menuBtn = topRow.createEl('button', { cls: 'umos-kanban-card-menu', text: '···' });
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showCardMenu(e, task);
        });

        // Description
        card.createDiv({
            cls: 'umos-kanban-card-desc',
            text: task.description.replace(/[⏫🔼🔽\uFFFD]/g, '').trim()
        });

        // Subtask progress
        if (task.subtasks.length > 0) {
            const done = task.subtasks.filter(s => s.status === 'done' || s.status === 'cancelled').length;
            const total = task.subtasks.length;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;

            const subtaskRow = card.createDiv({ cls: 'umos-kanban-subtask-row' });
            subtaskRow.createSpan({ cls: 'umos-kanban-subtask-count', text: `${done}/${total}` });
            const bar = subtaskRow.createDiv({ cls: 'umos-kanban-subtask-bar' });
            bar.createDiv({ cls: 'umos-kanban-subtask-fill' }).style.width = `${pct}%`;
        }

        // Metadata: due date + tags
        const meta = card.createDiv({ cls: 'umos-kanban-card-meta' });
        if (task.dueDate) {
            meta.createSpan({
                cls: isOverdue ? 'umos-task-date-badge is-overdue' : 'umos-task-date-badge',
                text: `срок: ${task.dueDate}`
            });
        }
        task.tags.forEach(tag => {
            const label = tag.startsWith('tasks/') ? tag.slice('tasks/'.length) : tag;
            meta.createEl('span', { cls: 'umos-kanban-tag', text: `#${label}` });
        });

        // Click card body → open editor
        card.addEventListener('click', () => {
            new TaskEditorModal(this.app, task,
                async (updated, subtasks) => {
                    this.isUpdating = true;
                    await this.service.updateTask(updated);
                    if (subtasks.length > 0) {
                        await this.service.addSubtasksAfterLine(
                            updated.filePath, updated.lineNumber, updated.indentation, subtasks
                        );
                    }
                    setTimeout(() => { this.isUpdating = false; this.render(); }, 300);
                },
                async (deleted) => {
                    this.isUpdating = true;
                    await this.service.deleteTask(deleted);
                    setTimeout(() => { this.isUpdating = false; this.render(); }, 300);
                }
            ).open();
        });
    }

    private showCardMenu(e: MouseEvent, task: Task) {
        const menu = new Menu();

        menu.addItem(item => item
            .setTitle('Редактировать').setIcon('pencil')
            .onClick(() => {
                new TaskEditorModal(this.app, task,
                    async (updated, subtasks) => {
                        this.isUpdating = true;
                        await this.service.updateTask(updated);
                        if (subtasks.length > 0) {
                            await this.service.addSubtasksAfterLine(
                                updated.filePath, updated.lineNumber, updated.indentation, subtasks
                            );
                        }
                        setTimeout(() => { this.isUpdating = false; this.render(); }, 300);
                    },
                    async (deleted) => {
                        this.isUpdating = true;
                        await this.service.deleteTask(deleted);
                        setTimeout(() => { this.isUpdating = false; this.render(); }, 300);
                    }
                ).open();
            }));

        if (task.status !== 'doing') {
            menu.addItem(item => item
                .setTitle('→ В процессе').setIcon('play')
                .onClick(async () => {
                    task.status = 'doing';
                    this.isUpdating = true;
                    await this.service.updateTask(task);
                    setTimeout(() => { this.isUpdating = false; this.render(); }, 300);
                }));
        }
        if (task.status !== 'done') {
            menu.addItem(item => item
                .setTitle('→ Выполнено').setIcon('check')
                .onClick(async () => {
                    task.status = 'done';
                    this.isUpdating = true;
                    await this.service.updateTask(task);
                    setTimeout(() => { this.isUpdating = false; this.render(); }, 300);
                }));
        }
        if (task.status !== 'todo') {
            menu.addItem(item => item
                .setTitle('→ К выполнению').setIcon('circle')
                .onClick(async () => {
                    task.status = 'todo';
                    this.isUpdating = true;
                    await this.service.updateTask(task);
                    setTimeout(() => { this.isUpdating = false; this.render(); }, 300);
                }));
        }

        menu.addSeparator();

        menu.addItem(item => item
            .setTitle('Удалить').setIcon('trash')
            .onClick(async () => {
                this.isUpdating = true;
                await this.service.deleteTask(task);
                setTimeout(() => { this.isUpdating = false; this.render(); }, 300);
            }));

        menu.showAtMouseEvent(e);
    }

    private openCreateModal(status: TaskStatus) {
        const newTask = new Task('', '', 0);
        newTask.status = status;
        this.applyDefaultTags(newTask);

        new TaskEditorModal(this.app, newTask, async (task, subtasks) => {
            const filePath = this.resolveCreateTargetPath();
            if (!filePath) {
                new Notice('Не удалось определить файл для создания задачи');
                return;
            }
            const lineNum = await this.service.createTask(task, filePath);
            if (subtasks.length > 0) {
                await this.service.addSubtasksAfterLine(filePath, lineNum, task.indentation, subtasks);
            }
            setTimeout(() => this.render(), 300);
        }).open();
    }

    private getTodayDailyNotePath(): string {
        const settings = this.plugin.settings;
        const format = settings.dailyNoteFormat || 'YYYY-MM-DD';
        const fileName = moment().format(format);
        return `${settings.dailyNotesPath}/${fileName}.md`;
    }

    private resolveCreateTargetPath(): string | null {
        const file = typeof this.config.file === 'string' ? this.config.file.trim() : '';
        if (file) return file;

        const targetRaw = String(this.config.target || this.config.create_in || '').toLowerCase();
        if (targetRaw === 'current' || this.config.use_current === true) {
            return this.sourcePath;
        }

        return this.getTodayDailyNotePath();
    }

    private applyDefaultTags(task: Task): void {
        const tags: string[] = [];
        const tagRaw = this.config.tag;
        if (typeof tagRaw === 'string' && tagRaw.trim().length > 0) {
            tags.push(tagRaw.replace(/^#/, '').trim());
        }
        const defaultTag = this.config.default_tag;
        if (typeof defaultTag === 'string' && defaultTag.trim().length > 0) {
            tags.push(defaultTag.replace(/^#/, '').trim());
        }
        const defaultTags = this.config.default_tags;
        if (Array.isArray(defaultTags)) {
            for (const t of defaultTags) {
                if (t) tags.push(String(t).replace(/^#/, '').trim());
            }
        }
        if (tags.length > 0) {
            const merged = new Set([...(task.tags || []), ...tags.filter(t => t.length > 0)]);
            task.tags = Array.from(merged);
        }
    }
}
