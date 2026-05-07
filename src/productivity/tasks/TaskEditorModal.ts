import { App, Modal, Setting } from 'obsidian';
import { Task, TaskStatus } from './Task';

interface SuggestedTag {
    name: string;
    count: number;
}

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

        // Subtasks
        const subtasksHeader = contentEl.createDiv({ cls: 'umos-modal-subtasks-header' });
        subtasksHeader.createEl('span', { text: 'Subtasks', cls: 'umos-modal-subtasks-title' });

        if (!this.isCreateMode && this.task.subtasks.length > 0) {
            subtasksHeader.createEl('span', {
                text: `(${this.task.subtasks.length} existing)`,
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

    private renderTagsField(container: HTMLElement): void {
        const setting = new Setting(container)
            .setName('Tags');

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
            attr: { type: 'text', placeholder: 'Add tag…' },
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

        const createSuggestionOption = (suggestion: SuggestedTag) => {
            const opt = dropdown.createDiv({ cls: 'umos-tag-dropdown-item' });
            opt.setAttribute('tabindex', '0');
            opt.createSpan({ cls: 'umos-tag-dropdown-hash', text: '#' });
            opt.createSpan({ cls: 'umos-tag-dropdown-name', text: suggestion.name });
            opt.createSpan({ cls: 'umos-tag-dropdown-count', text: String(suggestion.count) });
            opt.addEventListener('mousedown', (e) => { e.preventDefault(); addTag(suggestion.name); });
        };

        const createCreateOption = (tag: string) => {
            const opt = dropdown.createDiv({ cls: 'umos-tag-dropdown-item umos-tag-dropdown-create' });
            opt.setAttribute('tabindex', '0');
            opt.textContent = `+ \u0421\u043E\u0437\u0434\u0430\u0442\u044C "#${tag}"`;
            opt.addEventListener('mousedown', (e) => { e.preventDefault(); addTag(tag); });
        };

        const updateDropdown = (query: string) => {
            dropdown.empty();
            const q = query.toLowerCase().replace(/^tasks\//, '').replace(/^#/, '').trim();
            const existing = displayTags();
            const existingLower = new Set(existing.map(t => t.toLowerCase()));
            const matches = suggestions
                .filter(s => !existingLower.has(s.name.toLowerCase()))
                .filter(s => !q || s.name.toLowerCase().includes(q))
                .slice(0, q ? 8 : suggestions.length);

            if (!q) {
                for (const m of matches) createSuggestionOption(m);
                dropdown.style.display = matches.length > 0 ? 'block' : 'none';
                return;
            }

            if (matches.length === 0 && !existingLower.has(q)) {
                createCreateOption(q);
            } else {
                for (const m of matches) createSuggestionOption(m);
                // Also offer creating the typed value if not exact match
                if (q && !matches.some(m => m.name.toLowerCase() === q) && !existingLower.has(q)) {
                    createCreateOption(q);
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

    }

    /** Collect only tasks/* tags from the vault metadata cache, stripped of the tasks/ prefix */
    private getSuggestedTags(): SuggestedTag[] {
        const cache = this.app.metadataCache as any;
        const all: Record<string, number> = typeof cache.getTags === 'function' ? cache.getTags() : {};
        const map = new Map<string, number>();
        for (const [tag, count] of Object.entries(all)) {
            const clean = tag.replace(/^#/, '');
            // Only include tags that actually start with tasks/
            if (clean.startsWith('tasks/')) {
                const name = clean.slice('tasks/'.length);
                map.set(name, (map.get(name) ?? 0) + count);
            }
        }
        return [...map.entries()]
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
