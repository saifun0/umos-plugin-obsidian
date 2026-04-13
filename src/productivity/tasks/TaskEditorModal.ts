import { App, Modal, Setting } from 'obsidian';
import { Task, TaskStatus } from './Task';

export class TaskEditorModal extends Modal {
    private task: Task;
    private onSave: (updatedTask: Task, subtasks: string[]) => void;
    private onDelete: ((task: Task) => void) | null;
    private isCreateMode: boolean;
    private pendingSubtasks: string[] = [];

    constructor(app: App, task: Task, onSave: (updatedTask: Task, subtasks: string[]) => void, onDelete?: (task: Task) => void) {
        super(app);
        this.task = task;
        this.onSave = onSave;
        this.onDelete = onDelete || null;
        this.isCreateMode = !task.rawText;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: this.isCreateMode ? 'Новая задача' : 'Редактировать задачу' });

        // Description
        new Setting(contentEl)
            .setName('Описание')
            .addText(text => {
                text.setValue(this.task.description === this.task.rawText && this.isCreateMode ? '' : this.task.description)
                    .setPlaceholder('Введите описание задачи...')
                    .onChange(value => {
                        this.task.description = value;
                    });
                text.inputEl.style.width = '100%';
            });

        // Status
        new Setting(contentEl)
            .setName('Статус')
            .addDropdown(dropdown => {
                dropdown
                    .addOption('todo', 'К выполнению')
                    .addOption('doing', 'В процессе')
                    .addOption('done', 'Выполнено')
                    .addOption('cancelled', 'Отменено')
                    .setValue(this.task.status)
                    .onChange(value => {
                        this.task.status = value as TaskStatus;
                    });
            });

        // Priority
        new Setting(contentEl)
            .setName('Приоритет')
            .addDropdown(dropdown => {
                dropdown
                    .addOption('none', 'Нет')
                    .addOption('low', 'Низкий 🔽')
                    .addOption('medium', 'Средний 🔼')
                    .addOption('high', 'Высокий ⏫')
                    .setValue(this.task.priority)
                    .onChange(value => {
                        this.task.priority = value as 'high' | 'medium' | 'low' | 'none';
                    });
            });

        // Due Date
        new Setting(contentEl)
            .setName('Срок')
            .addText(text => {
                text.inputEl.type = 'date';
                text.setValue(this.task.dueDate || '')
                    .onChange(value => {
                        this.task.dueDate = value || null;
                    });
            });

        // Start Date
        new Setting(contentEl)
            .setName('Дата начала')
            .addText(text => {
                text.inputEl.type = 'date';
                text.setValue(this.task.startDate || '')
                    .onChange(value => {
                        this.task.startDate = value || null;
                    });
            });

        // Scheduled Date
        new Setting(contentEl)
            .setName('Запланировано')
            .addText(text => {
                text.inputEl.type = 'date';
                text.setValue(this.task.scheduledDate || '')
                    .onChange(value => {
                        this.task.scheduledDate = value || null;
                    });
            });

        // Done Date
        new Setting(contentEl)
            .setName('Дата завершения')
            .setDesc('Проставляется автоматически при выполнении задачи')
            .addText(text => {
                text.inputEl.type = 'date';
                text.setValue(this.task.doneDate || '')
                    .onChange(value => {
                        this.task.doneDate = value || null;
                    });
            });

        // Tags — with autocomplete
        this.renderTagsField(contentEl);

        // Recurrence
        new Setting(contentEl)
            .setName('Повторение')
            .setDesc('daily, weekly, monthly, every N days')
            .addText(text => {
                text.setValue(this.task.recurrence || '')
                    .setPlaceholder('weekly')
                    .onChange(value => {
                        this.task.recurrence = value || null;
                    });
            });

        // Subtasks
        const subtasksHeader = contentEl.createDiv({ cls: 'umos-modal-subtasks-header' });
        subtasksHeader.createEl('span', { text: 'Подзадачи', cls: 'umos-modal-subtasks-title' });

        if (!this.isCreateMode && this.task.subtasks.length > 0) {
            subtasksHeader.createEl('span', {
                text: `(${this.task.subtasks.length} существующих)`,
                cls: 'umos-modal-subtasks-existing',
            });
        }

        const subtasksList = contentEl.createDiv({ cls: 'umos-modal-subtasks-list' });

        const renderSubtasks = () => {
            subtasksList.empty();
            this.pendingSubtasks.forEach((desc, i) => {
                const row = subtasksList.createDiv({ cls: 'umos-modal-subtask-row' });
                const input = row.createEl('input', { cls: 'umos-modal-subtask-input' });
                (input as HTMLInputElement).type = 'text';
                (input as HTMLInputElement).value = desc;
                (input as HTMLInputElement).placeholder = 'Описание подзадачи...';
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
            text: '+ Добавить подзадачу',
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
                    .setButtonText(this.isCreateMode ? 'Создать' : 'Сохранить')
                    .setCta()
                    .onClick(() => {
                        if (!this.task.description.trim()) return;
                        const validSubtasks = this.pendingSubtasks.filter(s => s.trim());
                        this.onSave(this.task, validSubtasks);
                        this.close();
                    });
            });

        if (!this.isCreateMode && this.onDelete) {
            actionsSetting.addButton(button => {
                button
                    .setButtonText('Удалить')
                    .setWarning()
                    .onClick(() => {
                        this.onDelete!(this.task);
                        this.close();
                    });
            });
        }
    }

    // ── Tag field with autocomplete ───────────────────────────────────────

    private renderTagsField(container: HTMLElement): void {
        const setting = new Setting(container)
            .setName('Теги')
            .setDesc('tasks/ добавляется автоматически. Нажмите Enter или запятую для добавления.');

        const fieldWrap = setting.controlEl.createDiv({ cls: 'umos-tag-field-wrap' });

        // Chips container
        const chipsEl = fieldWrap.createDiv({ cls: 'umos-tag-chips' });

        // Current tags (stripped of tasks/ prefix for display)
        const displayTags = (): string[] =>
            this.task.tags.map(t => t.startsWith('tasks/') ? t.slice('tasks/'.length) : t);

        const rebuildChips = () => {
            chipsEl.empty();
            for (const tag of displayTags()) {
                const chip = chipsEl.createSpan({ cls: 'umos-tag-chip' });
                chip.createSpan({ text: `#${tag}` });
                const x = chip.createEl('button', { text: '×', cls: 'umos-tag-chip-remove' });
                x.addEventListener('click', () => {
                    const fullTag = tag.startsWith('tasks/') ? tag : `tasks/${tag}`;
                    this.task.tags = this.task.tags.filter(t => t !== fullTag && t !== `tasks/${tag}` && t !== tag);
                    rebuildChips();
                });
            }
        };

        rebuildChips();

        // Input + dropdown wrapper
        const inputWrap = fieldWrap.createDiv({ cls: 'umos-tag-input-wrap' });
        const input = inputWrap.createEl('input', {
            cls: 'umos-tag-input',
            attr: { type: 'text', placeholder: 'Добавить тег…' },
        }) as HTMLInputElement;

        const dropdown = inputWrap.createDiv({ cls: 'umos-tag-dropdown' });
        dropdown.style.display = 'none';

        const suggestions = this.getSuggestedTags();

        const addTag = (raw: string) => {
            const tag = raw.trim().replace(/^#/, '').replace(/^tasks\//, '');
            if (!tag) return;
            const full = `tasks/${tag}`;
            if (!this.task.tags.includes(full)) {
                this.task.tags = [...this.task.tags, full];
                rebuildChips();
            }
            input.value = '';
            dropdown.style.display = 'none';
        };

        const updateDropdown = (query: string) => {
            dropdown.empty();
            const q = query.toLowerCase().replace(/^tasks\//, '').replace(/^#/, '');
            if (!q) { dropdown.style.display = 'none'; return; }

            const existing = displayTags();
            const matches = suggestions.filter(s =>
                s.toLowerCase().includes(q) && !existing.includes(s)
            ).slice(0, 8);

            if (matches.length === 0 && !existing.includes(q)) {
                // "Create" option
                const opt = dropdown.createDiv({ cls: 'umos-tag-dropdown-item umos-tag-dropdown-create' });
                opt.textContent = `+ Создать "#${q}"`;
                opt.addEventListener('mousedown', (e) => { e.preventDefault(); addTag(q); });
            } else {
                for (const m of matches) {
                    const opt = dropdown.createDiv({ cls: 'umos-tag-dropdown-item' });
                    opt.createSpan({ cls: 'umos-tag-dropdown-hash', text: '#' });
                    opt.createSpan({ text: m });
                    opt.addEventListener('mousedown', (e) => { e.preventDefault(); addTag(m); });
                }
                // Also offer creating the typed value if not exact match
                if (q && !matches.map(m => m.toLowerCase()).includes(q.toLowerCase()) && !existing.includes(q)) {
                    const opt = dropdown.createDiv({ cls: 'umos-tag-dropdown-item umos-tag-dropdown-create' });
                    opt.textContent = `+ Создать "#${q}"`;
                    opt.addEventListener('mousedown', (e) => { e.preventDefault(); addTag(q); });
                }
            }

            dropdown.style.display = matches.length > 0 || q ? 'block' : 'none';
        };

        input.addEventListener('input', () => updateDropdown(input.value));
        input.addEventListener('focus', () => updateDropdown(input.value));
        input.addEventListener('blur', () => { setTimeout(() => { dropdown.style.display = 'none'; }, 150); });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                addTag(input.value);
            } else if (e.key === 'Backspace' && input.value === '' && this.task.tags.length > 0) {
                // Remove last tag
                this.task.tags = this.task.tags.slice(0, -1);
                rebuildChips();
            } else if (e.key === 'Escape') {
                dropdown.style.display = 'none';
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                const items = dropdown.querySelectorAll<HTMLElement>('.umos-tag-dropdown-item');
                if (items.length > 0) (items[0] as HTMLElement).focus();
            }
        });

        // Keyboard navigation inside dropdown
        dropdown.addEventListener('keydown', (e) => {
            const items = Array.from(dropdown.querySelectorAll<HTMLElement>('.umos-tag-dropdown-item'));
            const focused = document.activeElement as HTMLElement;
            const idx = items.indexOf(focused);
            if (e.key === 'ArrowDown') { e.preventDefault(); items[idx + 1]?.focus(); }
            if (e.key === 'ArrowUp')   { e.preventDefault(); if (idx <= 0) input.focus(); else items[idx - 1]?.focus(); }
            if (e.key === 'Enter')     { e.preventDefault(); focused.dispatchEvent(new MouseEvent('mousedown')); }
            if (e.key === 'Escape')    { dropdown.style.display = 'none'; input.focus(); }
        });

        dropdown.querySelectorAll('.umos-tag-dropdown-item').forEach(el => (el as HTMLElement).setAttribute('tabindex', '0'));
    }

    /** Collect only tasks/* tags from the vault metadata cache, stripped of the tasks/ prefix */
    private getSuggestedTags(): string[] {
        const cache = this.app.metadataCache as any;
        const all: Record<string, number> = typeof cache.getTags === 'function' ? cache.getTags() : {};
        const set = new Set<string>();
        for (const tag of Object.keys(all)) {
            const clean = tag.replace(/^#/, '');
            // Only include tags that actually start with tasks/
            if (clean.startsWith('tasks/')) {
                set.add(clean.slice('tasks/'.length));
            }
        }
        return [...set].sort();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
