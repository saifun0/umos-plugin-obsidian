import { Task, TaskStatus } from './Task';

export class TaskParser {
    // Text-based markers (primary)
    private static readonly priorityTextRegex = /\(priority:(high|medium|low)\)/;
    private static readonly dueDateTextRegex = /\(due:(\d{4}-\d{2}-\d{2})\)/;
    private static readonly startDateTextRegex = /\(start:(\d{4}-\d{2}-\d{2})\)/;
    private static readonly scheduledDateTextRegex = /\(scheduled:(\d{4}-\d{2}-\d{2})\)/;
    private static readonly doneDateTextRegex = /\(done:(\d{4}-\d{2}-\d{2})\)/;
    private static readonly recurrenceTextRegex = /\(rec:([^)]+)\)/;

    // Legacy emoji markers (backward-compat)
    private static readonly priorityEmojiRegex = /([⏫🔼🔽])/;
    private static readonly dueDateEmojiRegex = /📅\s*(\d{4}-\d{2}-\d{2})/;
    private static readonly startDateEmojiRegex = /🛫\s*(\d{4}-\d{2}-\d{2})/;
    private static readonly scheduledDateEmojiRegex = /⏳\s*(\d{4}-\d{2}-\d{2})/;
    private static readonly doneDateEmojiRegex = /✅\s*(\d{4}-\d{2}-\d{2})/;
    private static readonly recurrenceEmojiRegex = /🔁\s*([^📅🛫⏳✅#(]+)/;

    private static readonly tagRegex = /#([\w\p{L}\p{N}_\-\/]+)/gu;

    private static getTagRegex() {
        return /#([\w\p{L}\p{N}_\-\/]+)/gu;
    }

    public static parse(line: string, filePath: string, lineNumber: number): Task {
        const task = new Task(line, filePath, lineNumber);

        // 1. Indentation
        const indentationMatch = line.match(/^(\s*)/);
        if (indentationMatch) {
            const indentationText = indentationMatch[1].replace(/\t/g, '    ');
            task.indentation = Math.floor(indentationText.length / 4);
        }

        // 2. Status
        if (/- \[[xX]\]/.test(line)) {
            task.status = 'done';
        } else if (/- \[\/\]/.test(line)) {
            task.status = 'doing';
        } else if (/- \[-\]/.test(line)) {
            task.status = 'cancelled';
        } else {
            task.status = 'todo';
        }

        // 3. Extract raw description and metadata parts
        let description = line.replace(/^(\s*)- \[[xX \/\-]\]\s*/, '').trim();
        const partsToRemove: string[] = [];

        // Priority — text first, fallback emoji
        const priorityTextMatch = description.match(TaskParser.priorityTextRegex);
        if (priorityTextMatch) {
            task.priority = priorityTextMatch[1] as 'high' | 'medium' | 'low';
            partsToRemove.push(priorityTextMatch[0]);
        } else {
            const priorityEmojiMatch = description.match(TaskParser.priorityEmojiRegex);
            if (priorityEmojiMatch) {
                const sign = priorityEmojiMatch[1];
                if (sign === '⏫') task.priority = 'high';
                else if (sign === '🔼') task.priority = 'medium';
                else if (sign === '🔽') task.priority = 'low';
                partsToRemove.push(priorityEmojiMatch[0]);
            }
        }

        // Due date
        const dueTextMatch = description.match(TaskParser.dueDateTextRegex);
        if (dueTextMatch) {
            task.dueDate = dueTextMatch[1];
            partsToRemove.push(dueTextMatch[0]);
        } else {
            const dueEmojiMatch = description.match(TaskParser.dueDateEmojiRegex);
            if (dueEmojiMatch) {
                task.dueDate = dueEmojiMatch[1];
                partsToRemove.push(dueEmojiMatch[0]);
            }
        }

        // Start date
        const startTextMatch = description.match(TaskParser.startDateTextRegex);
        if (startTextMatch) {
            task.startDate = startTextMatch[1];
            partsToRemove.push(startTextMatch[0]);
        } else {
            const startEmojiMatch = description.match(TaskParser.startDateEmojiRegex);
            if (startEmojiMatch) {
                task.startDate = startEmojiMatch[1];
                partsToRemove.push(startEmojiMatch[0]);
            }
        }

        // Scheduled date
        const schedTextMatch = description.match(TaskParser.scheduledDateTextRegex);
        if (schedTextMatch) {
            task.scheduledDate = schedTextMatch[1];
            partsToRemove.push(schedTextMatch[0]);
        } else {
            const schedEmojiMatch = description.match(TaskParser.scheduledDateEmojiRegex);
            if (schedEmojiMatch) {
                task.scheduledDate = schedEmojiMatch[1];
                partsToRemove.push(schedEmojiMatch[0]);
            }
        }

        // Done date
        const doneTextMatch = description.match(TaskParser.doneDateTextRegex);
        if (doneTextMatch) {
            task.doneDate = doneTextMatch[1];
            partsToRemove.push(doneTextMatch[0]);
        } else {
            const doneEmojiMatch = description.match(TaskParser.doneDateEmojiRegex);
            if (doneEmojiMatch) {
                task.doneDate = doneEmojiMatch[1];
                partsToRemove.push(doneEmojiMatch[0]);
            }
        }

        // Recurrence
        const recTextMatch = description.match(TaskParser.recurrenceTextRegex);
        if (recTextMatch) {
            task.recurrence = recTextMatch[1].trim();
            partsToRemove.push(recTextMatch[0]);
        } else {
            const recEmojiMatch = description.match(TaskParser.recurrenceEmojiRegex);
            if (recEmojiMatch) {
                task.recurrence = recEmojiMatch[1].trim();
                partsToRemove.push(recEmojiMatch[0]);
            }
        }

        // Tags
        const tagsMatch = description.match(TaskParser.getTagRegex());
        if (tagsMatch) {
            task.tags = tagsMatch.map(tag => tag.substring(1));
            partsToRemove.push(...tagsMatch);
        }

        // 4. Clean the description by removing all metadata parts
        for (const part of partsToRemove) {
            description = description.replaceAll(part, '');
        }

        task.description = description.trim().replace(/ +/g, ' ');

        return task;
    }
}
