import { App, Modal, Notice, Setting } from 'obsidian';
import { Task, TaskStatus } from './Task';
import { renderTaskTagField } from './TaskTagAutocomplete';
import { TaskService } from './TaskService';
import { TaskNoteService } from './TaskNoteService';
import { t } from '../../i18n';
import type UmOSPlugin from '../../main';

interface TaskSubtaskSyncOptions {
    dueDate: boolean;
    startDate: boolean;
    scheduledDate: boolean;
    priority: boolean;
    tags: boolean;
    recurrence: boolean;
    status: boolean;
    includeNested: boolean;
    replaceTags: boolean;
    clearEmptyValues: boolean;
}

export class TaskEditorModal extends Modal {
    private task: Task;
    private onSave: (updatedTask: Task, subtasks: string[]) => void | Promise<void>;
    private onDelete: ((task: Task) => void) | null;
    private isCreateMode: boolean;
    private plugin: UmOSPlugin | null;
    private pendingSubtasks: string[] = [];
    private syncOptions: TaskSubtaskSyncOptions = {
        dueDate: true,
        startDate: true,
        scheduledDate: true,
        priority: true,
        tags: true,
        recurrence: false,
        status: false,
        includeNested: true,
        replaceTags: false,
        clearEmptyValues: false,
    };

    constructor(
        app: App,
        task: Task,
        onSave: (updatedTask: Task, subtasks: string[]) => void | Promise<void>,
        onDelete?: (task: Task) => void,
        plugin?: UmOSPlugin | null,
    ) {
        super(app);
        this.task = task;
        this.onSave = onSave;
        this.onDelete = onDelete || null;
        this.plugin = plugin || null;
        this.isCreateMode = !task.rawText;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: this.isCreateMode ? 'New Task' : 'Edit Task' });

        // Description
        new Setting(contentEl)
            .setName('Description')
            .addText(text => {
                text.setValue(this.task.description === this.task.rawText && this.isCreateMode ? '' : this.task.description)
                    .setPlaceholder('Enter a task description...')
                    .onChange(value => {
                        this.task.description = value;
                    });
                text.inputEl.style.width = '100%';
            });

        // Status
        new Setting(contentEl)
            .setName('Status')
            .addDropdown(dropdown => {
                dropdown
                    .addOption('todo', 'To Do')
                    .addOption('doing', 'In Progress')
                    .addOption('done', 'Done')
                    .addOption('cancelled', 'Cancelled')
                    .setValue(this.task.status)
                    .onChange(value => {
                        this.task.status = value as TaskStatus;
                    });
            });

        // Priority
        new Setting(contentEl)
            .setName('Priority')
            .addDropdown(dropdown => {
                dropdown
                    .addOption('none', 'None')
                    .addOption('low', 'Low 🔽')
                    .addOption('medium', 'Medium 🔼')
                    .addOption('high', 'High ⏫')
                    .setValue(this.task.priority)
                    .onChange(value => {
                        this.task.priority = value as 'high' | 'medium' | 'low' | 'none';
                    });
            });

        // Tags — with autocomplete
        this.renderTagsField(contentEl);

        // Due Date
        new Setting(contentEl)
            .setName('Due')
            .addText(text => {
                text.inputEl.type = 'date';
                text.setValue(this.task.dueDate || '')
                    .onChange(value => {
                        this.task.dueDate = value || null;
                    });
            });

        // Start Date
        new Setting(contentEl)
            .setName('Start Date')
            .addText(text => {
                text.inputEl.type = 'date';
                text.setValue(this.task.startDate || '')
                    .onChange(value => {
                        this.task.startDate = value || null;
                    });
            });

        // Scheduled Date
        new Setting(contentEl)
            .setName('Scheduled')
            .addText(text => {
                text.inputEl.type = 'date';
                text.setValue(this.task.scheduledDate || '')
                    .onChange(value => {
                        this.task.scheduledDate = value || null;
                    });
            });

        // Done Date
        new Setting(contentEl)
            .setName('Completion Date')
            .setDesc('Set automatically when the task is completed')
            .addText(text => {
                text.inputEl.type = 'date';
                text.setValue(this.task.doneDate || '')
                    .onChange(value => {
                        this.task.doneDate = value || null;
                    });
            });

        // Recurrence
        new Setting(contentEl)
            .setName('Recurrence')
            .setDesc('daily, weekly, monthly, every N days')
            .addText(text => {
                text.setValue(this.task.recurrence || '')
                    .setPlaceholder('weekly')
                    .onChange(value => {
                        this.task.recurrence = value || null;
                    });
            });

        this.renderTaskNoteSetting(contentEl);

        // Subtasks
        const subtasksHeader = contentEl.createDiv({ cls: 'umos-modal-subtasks-header' });
        subtasksHeader.createEl('span', { text: 'Subtasks', cls: 'umos-modal-subtasks-title' });

        if (!this.isCreateMode && this.task.subtasks.length > 0) {
            subtasksHeader.createEl('span', {
                text: `(${this.task.subtasks.length} existing)`,
                cls: 'umos-modal-subtasks-existing',
            });
        }

        this.renderSubtaskSyncPanel(contentEl);

        const subtasksList = contentEl.createDiv({ cls: 'umos-modal-subtasks-list' });

        const renderSubtasks = () => {
            subtasksList.empty();
            this.pendingSubtasks.forEach((desc, i) => {
                const row = subtasksList.createDiv({ cls: 'umos-modal-subtask-row' });
                const input = row.createEl('input', { cls: 'umos-modal-subtask-input' });
                (input as HTMLInputElement).type = 'text';
                (input as HTMLInputElement).value = desc;
                (input as HTMLInputElement).placeholder = 'Subtask description...';
                input.addEventListener('input', () => {
                    this.pendingSubtasks[i] = (input as HTMLInputElement).value;
                });
                const removeBtn = row.createEl('button', { text: '✕', cls: 'umos-modal-subtask-remove' });
                removeBtn.addEventListener('click', () => {
                    this.pendingSubtasks.splice(i, 1);
                    renderSubtasks();
                });
            });
        };

        renderSubtasks();

        const addSubtaskBtn = contentEl.createEl('button', {
            text: '+ Add Subtask',
            cls: 'umos-modal-subtask-add',
        });
        addSubtaskBtn.addEventListener('click', () => {
            this.pendingSubtasks.push('');
            renderSubtasks();
            // Focus the last input
            const inputs = subtasksList.querySelectorAll<HTMLInputElement>('.umos-modal-subtask-input');
            inputs[inputs.length - 1]?.focus();
        });

        // Action buttons
        const actionsSetting = new Setting(contentEl)
            .addButton(button => {
                button
                    .setButtonText(this.isCreateMode ? 'Create' : 'Save')
                    .setCta()
                    .onClick(async () => {
                        if (!this.task.description.trim()) return;
                        const validSubtasks = this.pendingSubtasks.filter(s => s.trim());
                        await this.onSave(this.task, validSubtasks);
                        this.close();
                    });
            });

        if (!this.isCreateMode && this.onDelete) {
            actionsSetting.addButton(button => {
                button
                    .setButtonText('Delete')
                    .setWarning()
                    .onClick(() => {
                        this.onDelete!(this.task);
                        this.close();
                    });
            });
        }
    }

    // ── Tag field with autocomplete ───────────────────────────────────────

    private renderSubtaskSyncPanel(container: HTMLElement): void {
        if (this.isCreateMode || this.task.subtasks.length === 0) return;

        const subtasks = this.collectSubtasks(this.task, true);
        const panel = container.createDiv({ cls: 'umos-modal-subtask-sync' });
        const head = panel.createDiv({ cls: 'umos-modal-subtask-sync-head' });
        const title = head.createDiv({ cls: 'umos-modal-subtask-sync-title' });
        title.createSpan({ text: t('Sync metadata to subtasks') });
        title.createSpan({
            cls: 'umos-modal-subtask-sync-count',
            text: `${subtasks.length} ${t('subtasks')}`,
        });
        panel.createDiv({
            cls: 'umos-modal-subtask-sync-desc',
            text: t('Copy selected fields from the parent task to its subtasks.'),
        });

        const fields = panel.createDiv({ cls: 'umos-modal-subtask-sync-fields' });
        this.createSyncToggle(fields, 'Due', 'dueDate');
        this.createSyncToggle(fields, 'Start Date', 'startDate');
        this.createSyncToggle(fields, 'Scheduled', 'scheduledDate');
        this.createSyncToggle(fields, 'Priority', 'priority');
        this.createSyncToggle(fields, 'Tags', 'tags');
        this.createSyncToggle(fields, 'Recurrence', 'recurrence');
        this.createSyncToggle(fields, 'Status', 'status');

        const options = panel.createDiv({ cls: 'umos-modal-subtask-sync-options' });
        this.createSyncToggle(options, 'Include nested subtasks', 'includeNested');
        this.createSyncToggle(options, 'Replace tags instead of merging', 'replaceTags');
        this.createSyncToggle(options, 'Clear empty values', 'clearEmptyValues');

        const apply = panel.createEl('button', {
            text: t('Sync to subtasks'),
            cls: 'umos-modal-subtask-sync-apply',
        });
        apply.addEventListener('click', () => void this.syncMetadataToSubtasks());
    }

    private createSyncToggle(
        parent: HTMLElement,
        label: string,
        key: keyof TaskSubtaskSyncOptions,
    ): void {
        const toggle = parent.createEl('label', { cls: 'umos-modal-subtask-sync-toggle' });
        const checkbox = toggle.createEl('input', { attr: { type: 'checkbox' } });
        checkbox.checked = this.syncOptions[key];
        checkbox.addEventListener('change', () => {
            this.syncOptions[key] = checkbox.checked;
        });
        toggle.createSpan({ text: t(label) });
    }

    private async syncMetadataToSubtasks(): Promise<void> {
        const subtasks = this.collectSubtasks(this.task, this.syncOptions.includeNested);
        if (subtasks.length === 0) return;

        const service = new TaskService(this.app, this.plugin);
        for (const subtask of subtasks) {
            this.applyMetadataToSubtask(subtask);
            await service.updateTask(subtask);
        }

        new Notice(`${t('Synced subtasks')}: ${subtasks.length}`);
    }

    private collectSubtasks(task: Task, includeNested: boolean): Task[] {
        const result: Task[] = [];
        for (const subtask of task.subtasks) {
            const typed = subtask as Task;
            result.push(typed);
            if (includeNested && typed.subtasks.length > 0) {
                result.push(...this.collectSubtasks(typed, true));
            }
        }
        return result;
    }

    private applyMetadataToSubtask(subtask: Task): void {
        if (this.syncOptions.dueDate && (this.task.dueDate || this.syncOptions.clearEmptyValues)) {
            subtask.dueDate = this.task.dueDate;
        }
        if (this.syncOptions.startDate && (this.task.startDate || this.syncOptions.clearEmptyValues)) {
            subtask.startDate = this.task.startDate;
        }
        if (this.syncOptions.scheduledDate && (this.task.scheduledDate || this.syncOptions.clearEmptyValues)) {
            subtask.scheduledDate = this.task.scheduledDate;
        }
        if (this.syncOptions.priority) {
            subtask.priority = this.task.priority;
        }
        if (this.syncOptions.recurrence && (this.task.recurrence || this.syncOptions.clearEmptyValues)) {
            subtask.recurrence = this.task.recurrence;
        }
        if (this.syncOptions.status) {
            subtask.status = this.task.status;
            subtask.doneDate = this.task.doneDate;
        }
        if (this.syncOptions.tags) {
            subtask.tags = this.syncOptions.replaceTags
                ? [...this.task.tags]
                : Array.from(new Set([...subtask.tags, ...this.task.tags]));
        }
    }

    private renderTagsField(container: HTMLElement): void {
        const setting = new Setting(container)
            .setName('Tags');

        renderTaskTagField(setting.controlEl, this.app, {
            initialTags: this.task.tags,
            onChange: (tags) => {
                this.task.tags = tags;
            },
        });
    }

    private renderTaskNoteSetting(container: HTMLElement): void {
        if (this.isCreateMode) return;

        new Setting(container)
            .setName(t('Task note'))
            .setDesc(t('Create or open an inbox note linked to this task. It moves to archive when the task is completed.'))
            .addButton(button => {
                button
                    .setButtonText(t('Open task note'))
                    .onClick(async () => {
                        const file = await new TaskNoteService(this.app, this.plugin).createOrOpenTaskNote(this.task);
                        if (!file) return;
                        await new TaskService(this.app, this.plugin).updateTask(this.task);
                    });
            });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
