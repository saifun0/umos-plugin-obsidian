import { App, TFile, moment } from 'obsidian';
import UmOSPlugin from '../../main';
import { Task, ITask, TaskStatus, ITaskQuery } from './Task';
import { TaskParser } from './TaskParser';
import { TaskNoteService } from './TaskNoteService';
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

export interface ICompletedTaskBuckets {
    today: Task[];
    last7: Task[];
    last30: Task[];
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
        activeDays: number;
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

        const range = this.resolveDateRange(query);
        const chartEnd = range?.to ?? today.clone();
        const chartStart = range?.from ?? today.clone().subtract(29, 'days');
        const chartDays = Math.min(Math.max(chartEnd.diff(chartStart, 'days') + 1, 1), 366);

        // Daily completed for the selected range (for bar chart)
        const dailyCompleted: { date: string; count: number }[] = [];
        for (let i = chartDays - 1; i >= 0; i--) {
            const date = chartEnd.clone().subtract(i, 'days').format('YYYY-MM-DD');
            const count = doneTasks.filter(t => t.doneDate === date).length;
            dailyCompleted.push({ date, count });
        }
        const activeDays = new Set(doneTasks.map(t => t.doneDate!)).size;

        return { base, completedLast7, completedLast30, activeDays, avgCompletionDays, streak, dailyCompleted };
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

    public async getFlatTasksWithQuery(query: ITaskQuery): Promise<Task[]> {
        let allTasks: Task[] = [];
        const files = this.getFilesToScan(query);

        for (const file of files) {
            const fileTasks = await this.getTasksFromFile(file);
            allTasks.push(...this.flattenTasks(fileTasks));
        }

        return this.filterTasks(allTasks, query);
    }

    public async getCompletedTaskBuckets(query: ITaskQuery): Promise<ICompletedTaskBuckets> {
        const tasks = await this.getFlatTasksWithQuery({
            ...query,
            status: undefined,
            dateFrom: undefined,
            dateTo: undefined,
        });
        const doneTasks = tasks
            .filter(task => task.status === 'done' && task.doneDate && moment(task.doneDate, 'YYYY-MM-DD', true).isValid())
            .sort((a, b) => this.compareCompletedTasks(a, b));

        return {
            today: this.filterCompletedWithinDays(doneTasks, 1),
            last7: this.filterCompletedWithinDays(doneTasks, 7),
            last30: this.filterCompletedWithinDays(doneTasks, 30),
        };
    }

    private filterCompletedWithinDays(tasks: Task[], days: number): Task[] {
        const today = moment().startOf('day');
        const from = today.clone().subtract(Math.max(days - 1, 0), 'days');

        return tasks.filter(task => {
            const doneDate = moment(task.doneDate).startOf('day');
            return !doneDate.isBefore(from, 'day') && !doneDate.isAfter(today, 'day');
        });
    }

    private compareCompletedTasks(a: Task, b: Task): number {
        const doneCompare = (b.doneDate ?? '').localeCompare(a.doneDate ?? '');
        if (doneCompare !== 0) return doneCompare;

        const fileCompare = a.filePath.localeCompare(b.filePath);
        if (fileCompare !== 0) return fileCompare;

        return a.lineNumber - b.lineNumber;
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
            this.normalizeDoneDateForStatus(task);

            if (lines.length > task.lineNumber) {
                lines[task.lineNumber] = this.reconstructTaskString(task);
                await this.app.vault.modify(file, lines.join('\n'));
                if (task.status === 'done') {
                    await new TaskNoteService(this.app, this.plugin).archiveTaskNoteForTask(task);
                }
                this.emitTasksChanged('update', task.filePath);
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
                    const initial = "## Tasks\n\n";
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
            this.normalizeDoneDateForStatus(task);
            const taskLine = this.reconstructTaskString(task);

            let insertIdx = this.findTasksSectionInsertIndex(lines);
            if (insertIdx === -1 && this.isDailyNotePath(file.path)) {
                insertIdx = this.ensureTasksSection(lines);
            }
            let actualLine: number;
            if (insertIdx !== -1) {
                lines.splice(insertIdx, 0, taskLine);
                if (this.needsBlankAfterInsertedTask(lines, insertIdx)) {
                    lines.splice(insertIdx + 1, 0, '');
                }
                actualLine = insertIdx;
            } else {
                actualLine = lines.length;
                lines.push(taskLine);
            }

            await this.app.vault.modify(file, lines.join('\n'));
            this.emitTasksChanged('create', filePath);
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
            this.emitTasksChanged('subtasks', filePath);
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

            if (lines.length > task.lineNumber && this.isTaskLine(lines[task.lineNumber])) {
                const deleteCount = this.getTaskTreeDeleteCount(lines, task.lineNumber);
                lines.splice(task.lineNumber, deleteCount);
                await this.app.vault.modify(file, lines.join('\n'));
                this.emitTasksChanged('delete', task.filePath);
            }
        } catch (e) {
            console.error(`umOS: Error deleting task in ${task.filePath}`, e);
        }
    }

    /**
     * Find the line index to insert a new task under a Tasks section.
     * Returns the index of the last task line + 1 in that section,
     * or right after the heading if no tasks exist yet.
     * Returns -1 if no such heading found.
     */
    private findTasksSectionInsertIndex(lines: string[]): number {
        // Find "## Tasks" / "## Задачи", including headings with emoji prefixes.
        let headingIdx = -1;
        for (let i = 0; i < lines.length; i++) {
            if (this.isTasksSectionHeading(lines[i])) {
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
            if (this.isTaskLine(line)) {
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

    private ensureTasksSection(lines: string[]): number {
        const heading = this.plugin?.settings.language === 'ru' ? '## Задачи' : '## Tasks';
        const beforeIdx = this.findDailyTaskSectionFallbackIndex(lines);

        if (beforeIdx !== -1) {
            const sectionLines: string[] = [];
            if (beforeIdx > 0 && lines[beforeIdx - 1].trim() !== '') sectionLines.push('');
            sectionLines.push(heading, '', '');
            lines.splice(beforeIdx, 0, ...sectionLines);
            return beforeIdx + sectionLines.length - 1;
        }

        if (lines.length > 0 && lines[lines.length - 1].trim() !== '') lines.push('');
        lines.push(heading, '', '');
        return lines.length - 1;
    }

    private findDailyTaskSectionFallbackIndex(lines: string[]): number {
        const boundaryHeadings = new Set(['review', 'notes', 'рецензия', 'ревью', 'заметки']);

        for (let i = 0; i < lines.length; i++) {
            const title = this.getHeadingTitle(lines[i]);
            if (!title) continue;
            if (boundaryHeadings.has(this.normalizeHeadingTitle(title))) return i;
        }

        return -1;
    }

    private isTasksSectionHeading(line: string): boolean {
        const title = this.getHeadingTitle(line);
        if (!title) return false;

        return new Set([
            'task',
            'tasks',
            'tasks projects',
            'project tasks',
            'задача',
            'задачи',
            'задачи проекта',
            'проектные задачи',
        ]).has(this.normalizeHeadingTitle(title));
    }

    private getHeadingTitle(line: string): string | null {
        const match = line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/);
        return match ? match[1] : null;
    }

    private normalizeHeadingTitle(title: string): string {
        return title
            .replace(/[`*_~]/g, '')
            .replace(/[^\p{L}\p{N}\s-]/gu, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    private getTaskTreeDeleteCount(lines: string[], startIndex: number): number {
        const parentIndent = this.getTaskLineIndent(lines[startIndex]);
        if (parentIndent === null) return 1;

        let count = 1;
        for (let i = startIndex + 1; i < lines.length; i++) {
            const childIndent = this.getTaskLineIndent(lines[i]);
            if (childIndent === null || childIndent <= parentIndent) break;
            count++;
        }
        return count;
    }

    private isTaskLine(line: string): boolean {
        return this.getTaskLineIndent(line) !== null;
    }

    private getTaskLineIndent(line: string): number | null {
        const match = line.match(/^(\s*)- \[[ \/xX\-]\]/);
        if (!match) return null;
        return match[1].replace(/\t/g, '    ').length;
    }

    private needsBlankAfterInsertedTask(lines: string[], taskIndex: number): boolean {
        const nextLine = lines[taskIndex + 1];
        return !!nextLine && nextLine.trim() !== '' && (/^#{1,6}\s/.test(nextLine) || /^---\s*$/.test(nextLine));
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

    public async getStatusStats(query: ITaskQuery): Promise<{ status: TaskStatus; count: number }[]> {
        const tasks = await this.getTasksWithQuery({ ...query, status: undefined });
        const flat = this.flattenTasks(tasks);
        const order: TaskStatus[] = ['todo', 'doing', 'done', 'cancelled'];
        const map = new Map<TaskStatus, number>();

        for (const task of flat) {
            map.set(task.status, (map.get(task.status) ?? 0) + 1);
        }

        return order
            .map(status => ({ status, count: map.get(status) ?? 0 }))
            .filter(entry => entry.count > 0);
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
                if (nextStatus === 'done') {
                    await new TaskNoteService(this.app, this.plugin).archiveTaskNoteForTask(task);
                }
                this.emitTasksChanged('status', task.filePath);
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
        const { overdue, dueToday } = await this.getHomeTasks();
        return { overdue, dueToday };
    }

    public async getHomeTasks(): Promise<{ overdue: Task[]; dueToday: Task[]; dueTomorrow: Task[]; inProgress: Task[]; completedToday: Task[] }> {
        const allTasks = await this.getTasksWithQuery({});
        const flatTasks = this.flattenTasks(allTasks);
        const today = moment().startOf('day');
        const tomorrow = today.clone().add(1, 'day');

        const active = flatTasks.filter(t => t.status !== 'done' && t.status !== 'cancelled');
        const overdue = active.filter(t => t.dueDate && moment(t.dueDate).isBefore(today));
        const dueToday = active.filter(t => t.dueDate && moment(t.dueDate).isSame(today, 'day'));
        const dueTomorrow = active.filter(t => t.dueDate && moment(t.dueDate).isSame(tomorrow, 'day'));
        const urgentKeys = new Set(
            [...overdue, ...dueToday, ...dueTomorrow].map(task => `${task.filePath}:${task.lineNumber}`)
        );
        const inProgress = active.filter(
            t => t.status === 'doing' && !urgentKeys.has(`${t.filePath}:${t.lineNumber}`)
        );

        const todayStr = today.format('YYYY-MM-DD');
        const completedToday = flatTasks.filter(
            t => t.status === 'done' && t.doneDate === todayStr
        );

        return { overdue, dueToday, dueTomorrow, inProgress, completedToday };
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

        const range = this.resolveDateRange(query);
        if (range) {
            filteredTasks = filteredTasks.filter(task => {
                const rawDate = this.getTaskRangeDate(task);
                if (!rawDate) return false;
                const date = moment(rawDate).startOf('day');
                return !date.isBefore(range.from, 'day') && !date.isAfter(range.to, 'day');
            });
        }

        return filteredTasks;
    }

    private resolveDateRange(query: ITaskQuery): { from: ReturnType<typeof moment>; to: ReturnType<typeof moment> } | null {
        if (!query.dateFrom && !query.dateTo) return null;

        const from = query.dateFrom ? moment(query.dateFrom).startOf('day') : moment('1900-01-01').startOf('day');
        const to = query.dateTo ? moment(query.dateTo).startOf('day') : moment().startOf('day');
        if (!from.isValid() || !to.isValid()) return null;

        return from.isAfter(to) ? { from: to, to: from } : { from, to };
    }

    private getTaskRangeDate(task: Task): string | null {
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

    private normalizeDoneDateForStatus(task: Task): void {
        if (task.status === 'done') {
            if (!task.doneDate) task.doneDate = moment().format('YYYY-MM-DD');
            return;
        }

        task.doneDate = null;
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

    private emitTasksChanged(action: string, path?: string): void {
        this.plugin?.eventBus.emit('tasks:changed', { action, path });
    }
}
