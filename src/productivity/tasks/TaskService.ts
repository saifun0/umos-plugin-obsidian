import { App, TFile, moment } from 'obsidian';
import UmOSPlugin from '../../main';
import { Task, ITask, TaskStatus, ITaskQuery } from './Task';
import { TaskParser } from './TaskParser';
import { DailyNoteEnhancer } from '../../daily/DailyNoteEnhancer';
import { getTodayISO } from '../../utils/date';

export interface ITaskStats {
    total: number;
    done: number;
    doing: number;
    pending: number;
    overdue: number;
    completionPercentage: number;
}

export class TaskService {
    private app: App;
    private plugin: UmOSPlugin | null;

    constructor(app: App, plugin?: UmOSPlugin | null) {
        this.app = app;
        this.plugin = plugin || null;
    }

    public async getTasksStats(query: ITaskQuery): Promise<ITaskStats> {
        const tasks = await this.getTasksWithQuery(query);
        const flatTasks = this.flattenTasks(tasks);

        const total = flatTasks.length;
        const done = flatTasks.filter(t => t.status === 'done').length;
        const doing = flatTasks.filter(t => t.status === 'doing').length;
        const pending = total - done;

        const today = moment().startOf('day');
        const overdue = flatTasks.filter(t => t.status !== 'done' && t.status !== 'cancelled' && t.dueDate && moment(t.dueDate).isBefore(today)).length;

        const completionPercentage = total > 0 ? Math.round((done / total) * 100) : 0;

        return { total, done, doing, pending, overdue, completionPercentage };
    }

    /** Extended stats for trends widget */
    public async getExtendedStats(query: ITaskQuery): Promise<{
        base: ITaskStats;
        completedLast7: number;
        completedLast30: number;
        avgCompletionDays: number | null;
        streak: number;
        dailyCompleted: { date: string; count: number }[];
    }> {
        const tasks = await this.getTasksWithQuery({ ...query, status: undefined });
        const flatTasks = this.flattenTasks(tasks);
        const base = await this.getTasksStats(query);

        const today = moment().startOf('day');

        // Completed in last N days
        const doneTasks = flatTasks.filter(t => t.status === 'done' && t.doneDate);
        const completedLast7 = doneTasks.filter(t => moment(t.doneDate).isAfter(today.clone().subtract(7, 'days'))).length;
        const completedLast30 = doneTasks.filter(t => moment(t.doneDate).isAfter(today.clone().subtract(30, 'days'))).length;

        // Average completion time (startDate → doneDate)
        const tasksWithBothDates = doneTasks.filter(t => t.startDate);
        let avgCompletionDays: number | null = null;
        if (tasksWithBothDates.length > 0) {
            const totalDays = tasksWithBothDates.reduce((sum, t) => {
                return sum + moment(t.doneDate).diff(moment(t.startDate), 'days');
            }, 0);
            avgCompletionDays = Math.round((totalDays / tasksWithBothDates.length) * 10) / 10;
        }

        // Streak: consecutive days with at least 1 completed task
        const doneDateSet = new Set(doneTasks.map(t => t.doneDate!));
        let streak = 0;
        const checkDay = today.clone();
        while (doneDateSet.has(checkDay.format('YYYY-MM-DD'))) {
            streak++;
            checkDay.subtract(1, 'day');
        }

        // Daily completed for last 30 days (for bar chart)
        const dailyCompleted: { date: string; count: number }[] = [];
        for (let i = 29; i >= 0; i--) {
            const date = today.clone().subtract(i, 'days').format('YYYY-MM-DD');
            const count = doneTasks.filter(t => t.doneDate === date).length;
            dailyCompleted.push({ date, count });
        }

        return { base, completedLast7, completedLast30, avgCompletionDays, streak, dailyCompleted };
    }

    private flattenTasks(tasks: Task[]): Task[] {
        let flat: Task[] = [];
        for (const task of tasks) {
            flat.push(task);
            if (task.subtasks.length > 0) {
                flat = flat.concat(this.flattenTasks(task.subtasks));
            }
        }
        return flat;
    }

    public async getTasksWithQuery(query: ITaskQuery): Promise<Task[]> {
        let allTasks: Task[] = [];
        const files = this.getFilesToScan(query);

        for (const file of files) {
            const fileTasks = await this.getTasksFromFile(file);
            allTasks.push(...fileTasks);
        }

        allTasks = this.filterTasks(allTasks, query);

        return allTasks;
    }

    public async updateTask(task: Task): Promise<void> {
        const file = this.app.vault.getAbstractFileByPath(task.filePath) as TFile;
        if (!file) {
            console.error(`umOS: Could not find file to update task: ${task.filePath}`);
            return;
        }

        try {
            const content = await this.app.vault.read(file);
            const lines = content.split(/\r?\n/);

            if (lines.length > task.lineNumber) {
                lines[task.lineNumber] = this.reconstructTaskString(task);
                await this.app.vault.modify(file, lines.join('\n'));
            }
        } catch (e) {
            console.error(`umOS: Error updating task in ${task.filePath}`, e);
        }
    }

    public async createTask(task: Task, filePath: string): Promise<number> {
        let file = this.app.vault.getAbstractFileByPath(filePath) as TFile;
        if (!file) {
            try {
                // If this is a daily note, create it via DailyNoteEnhancer (uses template)
                if (this.plugin && this.isDailyNotePath(filePath)) {
                    const enhancer = new DailyNoteEnhancer(
                        this.app,
                        () => this.plugin!.settings,
                        this.plugin.eventBus,
                        () => this.plugin!.data_store
                    );
                    await enhancer.createDailyNote(getTodayISO());
                    file = this.app.vault.getAbstractFileByPath(filePath) as TFile;
                }

                if (!file) {
                    await this.ensureParentFolder(filePath);
                    const initial = "## Задачи\n\n";
                    file = await this.app.vault.create(filePath, initial);
                }
            } catch (e) {
                console.error(`umOS: Could not create file for task: ${filePath}`, e);
                return -1;
            }
        }

        try {
            const content = await this.app.vault.read(file);
            const lines = content.split(/\r?\n/);
            const taskLine = this.reconstructTaskString(task);

            const insertIdx = this.findTasksSectionInsertIndex(lines);
            let actualLine: number;
            if (insertIdx !== -1) {
                lines.splice(insertIdx, 0, taskLine);
                actualLine = insertIdx;
            } else {
                actualLine = lines.length;
                lines.push(taskLine);
            }

            await this.app.vault.modify(file, lines.join('\n'));
            return actualLine;
        } catch (e) {
            console.error(`umOS: Error creating task in ${filePath}`, e);
            return -1;
        }
    }

    public async addSubtasksAfterLine(
        filePath: string,
        parentLine: number,
        parentIndentation: number,
        descriptions: string[]
    ): Promise<void> {
        const file = this.app.vault.getAbstractFileByPath(filePath) as TFile;
        if (!file || descriptions.length === 0 || parentLine < 0) return;

        try {
            const content = await this.app.vault.read(file);
            const lines = content.split(/\r?\n/);
            const childIndent = parentIndentation + 1;

            const subtaskLines = descriptions
                .filter(d => d.trim())
                .map(desc => {
                    const t = new Task('', filePath, 0);
                    t.description = desc.trim();
                    t.indentation = childIndent;
                    return this.reconstructTaskString(t);
                });

            lines.splice(parentLine + 1, 0, ...subtaskLines);
            await this.app.vault.modify(file, lines.join('\n'));
        } catch (e) {
            console.error('umOS: Error adding subtasks', e);
        }
    }

    private async ensureParentFolder(filePath: string): Promise<void> {
        const parts = filePath.split('/').filter(Boolean);
        if (parts.length <= 1) return;
        parts.pop();
        let current = '';
        for (const part of parts) {
            current = current ? `${current}/${part}` : part;
            const existing = this.app.vault.getAbstractFileByPath(current);
            if (!existing) {
                await this.app.vault.createFolder(current);
            }
        }
    }

    private isDailyNotePath(filePath: string): boolean {
        if (!this.plugin) return false;
        const dailyRoot = (this.plugin.settings.dailyNotesPath || '').replace(/\\/g, '/').replace(/\/+$/, '');
        const target = filePath.replace(/\\/g, '/');
        return dailyRoot.length > 0 && target.startsWith(dailyRoot + '/');
    }

    public async deleteTask(task: Task): Promise<void> {
        const file = this.app.vault.getAbstractFileByPath(task.filePath) as TFile;
        if (!file) return;

        try {
            const content = await this.app.vault.read(file);
            const lines = content.split(/\r?\n/);

            if (lines.length > task.lineNumber) {
                lines.splice(task.lineNumber, 1);
                await this.app.vault.modify(file, lines.join('\n'));
            }
        } catch (e) {
            console.error(`umOS: Error deleting task in ${task.filePath}`, e);
        }
    }

    /**
     * Find the line index to insert a new task under "## Задачи" section.
     * Returns the index of the last task line + 1 in that section,
     * or right after the heading if no tasks exist yet.
     * Returns -1 if no such heading found.
     */
    private findTasksSectionInsertIndex(lines: string[]): number {
        // Find "## Задачи" heading (case-insensitive for the heading level)
        let headingIdx = -1;
        for (let i = 0; i < lines.length; i++) {
            if (/^#{1,3}\s+Задачи(\s+проекта)?\s*$/i.test(lines[i])) {
                headingIdx = i;
                break;
            }
        }
        if (headingIdx === -1) return -1;

        // Scan forward past the heading to find insert position:
        // skip blank lines, then find the last task line (or first non-task content)
        let insertIdx = headingIdx + 1;

        // Skip immediate blank lines after heading
        while (insertIdx < lines.length && lines[insertIdx].trim() === '') {
            insertIdx++;
        }

        let inCodeBlock = false;
        let lastTaskIdx = -1;

        while (insertIdx < lines.length) {
            const line = lines[insertIdx];

            // Stop at next heading or horizontal rule
            if (!inCodeBlock && (/^#{1,6}\s/.test(line) || /^---\s*$/.test(line))) {
                break;
            }

            // Code block handling
            if (/^```/.test(line.trim())) {
                inCodeBlock = !inCodeBlock;
                insertIdx++;
                continue;
            }

            if (inCodeBlock) {
                insertIdx++;
                continue;
            }

            // Track last task line in this section
            if (/^\s*- \[.\]/.test(line)) {
                lastTaskIdx = insertIdx;
                insertIdx++;
                continue;
            }

            // Skip empty lines inside section
            if (line.trim() === '') {
                insertIdx++;
                continue;
            }

            // Any other content ends the section
            break;
        }

        if (lastTaskIdx !== -1) return lastTaskIdx + 1;
        return insertIdx;
    }

    public async getTagStats(query: ITaskQuery): Promise<{ tag: string; count: number; done: number }[]> {
        const tasks = await this.getTasksWithQuery({ ...query, status: undefined, tag: undefined });
        const flat = this.flattenTasks(tasks);

        const map = new Map<string, { count: number; done: number }>();
        for (const task of flat) {
            for (const tag of task.tags) {
                const entry = map.get(tag) ?? { count: 0, done: 0 };
                entry.count++;
                if (task.status === 'done') entry.done++;
                map.set(tag, entry);
            }
        }

        return Array.from(map.entries())
            .map(([tag, { count, done }]) => ({ tag, count, done }))
            .sort((a, b) => b.count - a.count);
    }

    public async bulkUpdate(tasks: Task[], changes: Partial<Pick<Task, 'status' | 'dueDate'>>): Promise<void> {
        for (const task of tasks) {
            if (changes.status !== undefined) task.status = changes.status;
            if (changes.dueDate !== undefined) task.dueDate = changes.dueDate;
            await this.updateTask(task);
        }
    }

    public async cycleTaskStatus(task: Task): Promise<void> {
        const file = this.app.vault.getAbstractFileByPath(task.filePath) as TFile;
        if (!file) {
            console.error(`umOS: Could not find file to update task: ${task.filePath}`);
            return;
        }

        try {
            const content = await this.app.vault.read(file);
            const lines = content.split(/\r?\n/);

            if (lines.length > task.lineNumber) {
                const line = lines[task.lineNumber];
                let nextStatus: TaskStatus;
                let newStatusMarker: string;

                switch (task.status) {
                    case 'todo':
                        nextStatus = 'doing';
                        newStatusMarker = '[/]';
                        break;
                    case 'doing':
                        nextStatus = 'done';
                        newStatusMarker = '[x]';
                        break;
                    case 'done':
                        nextStatus = 'cancelled';
                        newStatusMarker = '[-]';
                        break;
                    case 'cancelled':
                    default:
                        nextStatus = 'todo';
                        newStatusMarker = '[ ]';
                        break;
                }

                lines[task.lineNumber] = line.replace(/\[[ \/xX\-]\]/, newStatusMarker);

                // Handle doneDate: stamp on completion, strip when un-completing
                if (nextStatus === 'done') {
                    const today = moment().format('YYYY-MM-DD');
                    lines[task.lineNumber] = lines[task.lineNumber]
                        .replace(/\s*\(done:\d{4}-\d{2}-\d{2}\)/g, '')
                        .replace(/\s*✅\s*\d{4}-\d{2}-\d{2}/g, '')
                        .trimEnd() + ` (done:${today})`;
                    // Complete all subtasks in the same write
                    if (task.subtasks.length > 0) {
                        this.completeSubtasksInLines(lines, task.subtasks, today);
                    }
                } else if (task.status === 'done') {
                    lines[task.lineNumber] = lines[task.lineNumber]
                        .replace(/\s*\(done:\d{4}-\d{2}-\d{2}\)/g, '')
                        .replace(/\s*✅\s*\d{4}-\d{2}-\d{2}/g, '');
                }

                // Handle recurrence: if completing a recurring task, create next occurrence
                if (nextStatus === 'done' && task.recurrence) {
                    const newTaskLine = this.createRecurringTaskLine(task);
                    if (newTaskLine) {
                        lines.splice(task.lineNumber + 1, 0, newTaskLine);
                    }
                }

                await this.app.vault.modify(file, lines.join('\n'));
                task.status = nextStatus;
            }
        } catch (e) {
            console.error(`umOS: Error updating task in ${task.filePath}`, e);
        }
    }

    private completeSubtasksInLines(lines: string[], subtasks: ITask[], today: string): void {
        for (const subtask of subtasks) {
            if (subtask.status !== 'done' && subtask.status !== 'cancelled' && lines.length > subtask.lineNumber) {
                lines[subtask.lineNumber] = lines[subtask.lineNumber].replace(/\[[ \/xX\-]\]/, '[x]');
                lines[subtask.lineNumber] = lines[subtask.lineNumber]
                    .replace(/\s*\(done:\d{4}-\d{2}-\d{2}\)/g, '')
                    .replace(/\s*✅\s*\d{4}-\d{2}-\d{2}/g, '')
                    .trimEnd() + ` (done:${today})`;
            }
            if (subtask.subtasks.length > 0) {
                this.completeSubtasksInLines(lines, subtask.subtasks, today);
            }
        }
    }

    private createRecurringTaskLine(task: Task): string | null {
        if (!task.recurrence || !task.dueDate) return null;

        const baseDue = moment(task.dueDate);
        let nextDue: ReturnType<typeof moment>;

        const rec = task.recurrence.toLowerCase().trim();
        if (rec === 'daily') {
            nextDue = baseDue.add(1, 'day');
        } else if (rec === 'weekly') {
            nextDue = baseDue.add(1, 'week');
        } else if (rec === 'monthly') {
            nextDue = baseDue.add(1, 'month');
        } else {
            const match = rec.match(/every\s+(\d+)\s+days?/);
            if (match) {
                nextDue = baseDue.add(parseInt(match[1]), 'days');
            } else {
                return null;
            }
        }

        const newTask = new Task('', task.filePath, task.lineNumber + 1);
        newTask.description = task.description;
        newTask.status = 'todo';
        newTask.priority = task.priority;
        newTask.dueDate = nextDue.format('YYYY-MM-DD');
        newTask.startDate = task.startDate;
        newTask.scheduledDate = task.scheduledDate;
        newTask.recurrence = task.recurrence;
        newTask.tags = [...task.tags];
        newTask.indentation = task.indentation;

        return this.reconstructTaskString(newTask);
    }

    /** Get overdue + due today tasks for notifications */
    public async getUrgentTasks(): Promise<{ overdue: Task[]; dueToday: Task[] }> {
        const allTasks = await this.getTasksWithQuery({});
        const flatTasks = this.flattenTasks(allTasks);
        const today = moment().startOf('day');

        const active = flatTasks.filter(t => t.status !== 'done' && t.status !== 'cancelled');
        const overdue = active.filter(t => t.dueDate && moment(t.dueDate).isBefore(today));
        const dueToday = active.filter(t => t.dueDate && moment(t.dueDate).isSame(today, 'day'));

        return { overdue, dueToday };
    }

    private getFilesToScan(query: ITaskQuery): TFile[] {
        const allMarkdownFiles = this.app.vault.getMarkdownFiles();

        if (query.path) {
            // Support multiple paths separated by comma
            const paths = query.path.split(',').map(p => p.trim()).filter(p => p.length > 0);
            if (paths.length > 0) {
                return allMarkdownFiles.filter(file =>
                    paths.some(p => file.path.startsWith(p))
                );
            }
        }

        return allMarkdownFiles;
    }

    private async getTasksFromFile(file: TFile): Promise<Task[]> {
        const tasks: Task[] = [];
        try {
            const content = await this.app.vault.cachedRead(file);
            const lines = content.split(/\r?\n/);
            const allParsedTasks: Task[] = [];
            lines.forEach((line, index) => {
                if (/- \[[ \/xX\-]\]/.test(line)) {
                    allParsedTasks.push(TaskParser.parse(line, file.path, index));
                }
            });

            tasks.push(...this.buildTaskTree(allParsedTasks));

        } catch (e) {
            console.error(`umOS: Error reading or parsing tasks from ${file.path}`, e);
        }
        return tasks;
    }

    private buildTaskTree(tasks: Task[]): Task[] {
        const rootTasks: Task[] = [];
        const taskStack: Task[] = [];

        tasks.forEach(task => {
            while (taskStack.length > 0 && task.indentation <= taskStack[taskStack.length - 1].indentation) {
                taskStack.pop();
            }

            if (taskStack.length > 0) {
                const parent = taskStack[taskStack.length - 1];
                parent.subtasks.push(task);
                task.parent = parent;
            } else {
                rootTasks.push(task);
            }
            taskStack.push(task);
        });

        return rootTasks;
    }


    private filterTasks(tasks: Task[], query: ITaskQuery): Task[] {
        let filteredTasks = tasks;

        if (query.tag) {
            const tag = query.tag.replace(/^#/, '');
            filteredTasks = filteredTasks.filter(task => task.tags.includes(tag));
        }

        if (query.priority) {
            filteredTasks = filteredTasks.filter(task => task.priority === query.priority);
        }

        if (query.status) {
            const statuses = Array.isArray(query.status) ? query.status : [query.status];
            filteredTasks = filteredTasks.filter(task => statuses.includes(task.status));
        }

        if (query.due) {
            const today = moment().startOf('day');
            if (query.due === 'today') {
                filteredTasks = filteredTasks.filter(task => task.dueDate && moment(task.dueDate).isSame(today, 'day'));
            } else if (query.due === 'overdue') {
                filteredTasks = filteredTasks.filter(task => task.status !== 'done' && task.status !== 'cancelled' && task.dueDate && moment(task.dueDate).isBefore(today, 'day'));
            } else {
                filteredTasks = filteredTasks.filter(task => task.dueDate && moment(task.dueDate).isSame(moment(query.due), 'day'));
            }
        }

        if (query.scheduled) {
            const today = moment().startOf('day');
            if (query.scheduled === 'today') {
                filteredTasks = filteredTasks.filter(task => task.scheduledDate && moment(task.scheduledDate).isSame(today, 'day'));
            } else {
                filteredTasks = filteredTasks.filter(task => task.scheduledDate && moment(task.scheduledDate).isSame(moment(query.scheduled), 'day'));
            }
        }

        if (query.startDate) {
            const today = moment().startOf('day');
            if (query.startDate === 'today') {
                filteredTasks = filteredTasks.filter(task => task.startDate && moment(task.startDate).isSame(today, 'day'));
            } else {
                filteredTasks = filteredTasks.filter(task => task.startDate && moment(task.startDate).isSame(moment(query.startDate), 'day'));
            }
        }

        return filteredTasks;
    }

    public reconstructTaskString(task: Task): string {
        const indent = '    '.repeat(task.indentation);

        let statusMarker = '[ ]';
        if (task.status === 'done') statusMarker = '[x]';
        if (task.status === 'doing') statusMarker = '[/]';
        if (task.status === 'cancelled') statusMarker = '[-]';

        let metadata = '';
        if (task.priority !== 'none') metadata += ` (priority:${task.priority})`;
        if (task.startDate) metadata += ` (start:${task.startDate})`;
        if (task.scheduledDate) metadata += ` (scheduled:${task.scheduledDate})`;
        if (task.dueDate) metadata += ` (due:${task.dueDate})`;
        if (task.status === 'done' && task.doneDate) metadata += ` (done:${task.doneDate})`;
        if (task.recurrence) metadata += ` (rec:${task.recurrence})`;
        if (task.tags.length > 0) metadata += ` ${task.tags.map(t => `#${t}`).join(' ')}`;

        return `${indent}- ${statusMarker} ${task.description}${metadata}`;
    }
}
