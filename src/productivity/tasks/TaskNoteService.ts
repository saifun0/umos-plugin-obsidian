import { App, Notice, TFile, moment, normalizePath } from 'obsidian';
import type UmOSPlugin from '../../main';
import { t } from '../../i18n';
import { Task } from './Task';

const TASK_NOTE_TYPE = 'task-note';

function stripMdExtension(path: string): string {
    return path.replace(/\.md$/i, '');
}

function cleanFolderPath(path: string): string {
    return normalizePath(path.trim()).replace(/^\/+|\/+$/g, '');
}

function quoteYaml(value: string): string {
    return JSON.stringify(value);
}

function slugify(value: string): string {
    const clean = value
        .replace(/\[\[[^\]]+\]\]/g, '')
        .replace(/[#*`~>|[\]{}:;?\\/<>"']/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 72);
    return clean || 'task-note';
}

function normalizeTaskNoteLink(path: string): string {
    return stripMdExtension(path);
}

export class TaskNoteService {
    constructor(
        private app: App,
        private plugin: UmOSPlugin | null = null,
    ) {}

    public async createOrOpenTaskNote(task: Task): Promise<TFile | null> {
        const existing = await this.findTaskNote(task);
        if (existing) {
            await this.openFile(existing);
            return existing;
        }

        const inboxFolder = this.getInboxTaskNotesFolder();
        await this.ensureFolder(inboxFolder);
        const filePath = this.getUniquePath(inboxFolder, `${moment().format('YYYY-MM-DD')} ${slugify(task.description)}.md`);
        const file = await this.app.vault.create(filePath, this.buildTaskNoteContent(task, filePath));
        await this.openFile(file);
        new Notice(t('Task note created'));
        return file;
    }

    public async archiveTaskNoteForTask(task: Task): Promise<void> {
        if (task.status !== 'done') return;
        const note = await this.findTaskNote(task);
        if (!note) return;

        const archiveFolder = this.getArchiveTaskNotesFolder();
        if (note.path.startsWith(`${archiveFolder}/`)) {
            await this.markTaskNoteDone(note, task);
            return;
        }

        await this.ensureFolder(archiveFolder);
        await this.markTaskNoteDone(note, task);
        const targetPath = this.getUniquePath(archiveFolder, note.name);
        if (targetPath !== note.path) {
            await this.app.fileManager.renameFile(note, targetPath);
        }
    }

    private buildTaskNoteContent(task: Task, filePath: string): string {
        const created = moment().format('YYYY-MM-DD HH:mm');
        const sourceLink = stripMdExtension(task.filePath);
        return [
            '---',
            `type: ${TASK_NOTE_TYPE}`,
            'task_status: active',
            `task_title: ${quoteYaml(task.description)}`,
            `task_source: ${quoteYaml(task.filePath)}`,
            `task_line: ${task.lineNumber + 1}`,
            `task_note_path: ${quoteYaml(filePath)}`,
            `created: ${quoteYaml(created)}`,
            'tags:',
            '  - task-note',
            '  - inbox',
            '---',
            '',
            `# ${task.description.replace(/\[\[[^\]]+\]\]/g, '').trim() || t('Task note')}`,
            '',
            `Task: [[${sourceLink}]]`,
            '',
            '## Notes',
            '',
        ].join('\n');
    }

    private async markTaskNoteDone(file: TFile, task: Task): Promise<void> {
        await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
            frontmatter.type = TASK_NOTE_TYPE;
            frontmatter.task_status = 'done';
            frontmatter.task_done = task.doneDate || moment().format('YYYY-MM-DD');
            frontmatter.task_source = task.filePath;
            frontmatter.task_line = task.lineNumber + 1;
            frontmatter.triage = 'done';
            const existing = frontmatter.tags;
            const tags = new Set<string>();
            if (Array.isArray(existing)) {
                for (const tag of existing) tags.add(String(tag).replace(/^#/, ''));
            } else if (typeof existing === 'string') {
                for (const tag of existing.split(/[,\s]+/)) {
                    if (tag.trim()) tags.add(tag.trim().replace(/^#/, ''));
                }
            }
            tags.delete('inbox');
            tags.add('task-note');
            tags.add('archive');
            frontmatter.tags = Array.from(tags);
        });
    }

    private async findTaskNote(task: Task): Promise<TFile | null> {
        const linked = this.findLinkedTaskNote(task);
        if (linked) return linked;

        const markdownFiles = this.app.vault.getMarkdownFiles();
        for (const file of markdownFiles) {
            const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
            if (!frontmatter || frontmatter.type !== TASK_NOTE_TYPE) continue;
            if (frontmatter.task_source === task.filePath && Number(frontmatter.task_line) === task.lineNumber + 1) {
                return file;
            }
        }

        return null;
    }

    private findLinkedTaskNote(task: Task): TFile | null {
        const links = this.extractWikiLinks(task.description);
        for (const link of links) {
            const file = this.app.metadataCache.getFirstLinkpathDest(link, task.filePath);
            if (!(file instanceof TFile)) continue;
            const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
            if (file.path.includes('/Task Notes/')) return file;
            if (frontmatter?.type === TASK_NOTE_TYPE || frontmatter?.task_source === task.filePath) return file;
        }
        return null;
    }

    private extractWikiLinks(text: string): string[] {
        const links: string[] = [];
        const regex = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g;
        let match: RegExpExecArray | null;
        while ((match = regex.exec(text)) !== null) {
            links.push(match[1].trim());
        }
        return links;
    }



    private async openFile(file: TFile): Promise<void> {
        const leaf = this.app.workspace.getLeaf('tab');
        await leaf.openFile(file);
        this.app.workspace.revealLeaf(leaf);
    }

    private getInboxTaskNotesFolder(): string {
        const root = cleanFolderPath(this.plugin?.settings.inboxFolder || '10 Inbox');
        return `${root}/Task Notes`;
    }

    private getArchiveTaskNotesFolder(): string {
        return '50 Archive/Task Notes';
    }

    private async ensureFolder(folder: string): Promise<void> {
        const parts = cleanFolderPath(folder).split('/').filter(Boolean);
        let current = '';
        for (const part of parts) {
            current = current ? `${current}/${part}` : part;
            if (!this.app.vault.getAbstractFileByPath(current)) {
                await this.app.vault.createFolder(current);
            }
        }
    }

    private getUniquePath(folder: string, fileName: string): string {
        const cleanName = fileName.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
        const baseName = cleanName.replace(/\.md$/i, '');
        const firstPath = normalizePath(`${folder}/${baseName}.md`);
        if (!this.app.vault.getAbstractFileByPath(firstPath)) return firstPath;

        for (let index = 2; index < 1000; index++) {
            const candidate = normalizePath(`${folder}/${baseName}-${index}.md`);
            if (!this.app.vault.getAbstractFileByPath(candidate)) return candidate;
        }
        return normalizePath(`${folder}/${baseName}-${Date.now()}.md`);
    }
}
