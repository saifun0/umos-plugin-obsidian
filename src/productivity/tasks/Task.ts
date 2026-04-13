export type TaskStatus = 'todo' | 'doing' | 'done' | 'cancelled';

export interface ITaskQuery {
    path?: string;
    tag?: string;
    due?: 'today' | 'overdue' | string;
    priority?: 'high' | 'medium' | 'low';
    status?: TaskStatus | TaskStatus[];
    scheduled?: string;
    startDate?: string;
    sort?: string;
}

export interface ITask {
    description: string;
    status: TaskStatus;
    priority: 'high' | 'medium' | 'low' | 'none';
    dueDate: string | null;
    startDate: string | null;
    scheduledDate: string | null;
    doneDate: string | null;
    recurrence: string | null;
    tags: string[];
    filePath: string;
    lineNumber: number;
    indentation: number;
    subtasks: ITask[];
    parent: ITask | null;
    rawText: string;
}

export class Task implements ITask {
    public description: string;
    public status: TaskStatus;
    public priority: 'high' | 'medium' | 'low' | 'none';
    public dueDate: string | null;
    public startDate: string | null;
    public scheduledDate: string | null;
    public doneDate: string | null;
    public recurrence: string | null;
    public tags: string[];
    public filePath: string;
    public lineNumber: number;
    public indentation: number;
    public subtasks: ITask[];
    public parent: ITask | null;
    public rawText: string;

    constructor(
        rawText: string,
        filePath: string,
        lineNumber: number,
    ) {
        this.rawText = rawText;
        this.filePath = filePath;
        this.lineNumber = lineNumber;
        this.subtasks = [];
        this.parent = null;
        this.indentation = 0;

        // Default values
        this.description = rawText;
        this.status = 'todo';
        this.priority = 'none';
        this.dueDate = null;
        this.startDate = null;
        this.scheduledDate = null;
        this.doneDate = null;
        this.recurrence = null;
        this.tags = [];
    }
}
