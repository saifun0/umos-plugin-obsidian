import { setIcon } from "obsidian";
import { SettingsContext, createSection } from "../helpers";
import { t } from "../../i18n";

/* ─── types ─── */

interface GuideFolder {
	name: string;
	icon: string;
	type: string;
	desc: string;
	details: string[];
}

interface GuideWidget {
	block: string;
	desc: string;
}

interface GuideCommand {
	name: string;
	desc: string;
}

/* ─── data ─── */

const FOLDERS: GuideFolder[] = [
	{
		name: "00 Files",
		icon: "folder-archive",
		type: "system",
		desc: "System files, assets, attachments, and global templates.",
		details: [
			"Store images, PDFs, and other attachments here.",
			"Global templates and reusable snippets go in this folder.",
			"The Image Index is auto-generated here by Graph Maps.",
		],
	},
	{
		name: "05 Dashboards",
		icon: "layout-dashboard",
		type: "system",
		desc: "System dashboards, graph maps, and interactive views.",
		details: [
			"Contains auto-generated dashboard notes (Prayer, Stats, Tasks, etc.).",
			"The Maps/ subfolder holds generated Graph Map files.",
			"Graph Index.md is rebuilt automatically when vault changes.",
		],
	},
	{
		name: "10 Inbox",
		icon: "inbox",
		type: "system",
		desc: "Default landing zone for quick captures and unsorted notes.",
		details: [
			"Quick Capture sends new notes here by default.",
			"Use the Triage Center to sort items into proper folders.",
			"Think of this as your 'processing queue'.",
		],
	},
	{
		name: "11 Journal",
		icon: "book-open",
		type: "journal",
		desc: "Daily notes and chronological logs.",
		details: [
			"Daily/ subfolder stores auto-generated daily notes.",
			"Each daily note includes prayers, habits, tasks, and schedule.",
			"umOS creates today's note automatically on startup.",
		],
	},
	{
		name: "20 Projects",
		icon: "rocket",
		type: "project",
		desc: "Active work, actionable goals, and ongoing projects.",
		details: [
			"Each subfolder = one project (shown in Project Gallery).",
			"Projects can have their own tasks, kanban boards, and notes.",
			"Completed projects should be moved to 50 Archive.",
		],
	},
	{
		name: "30 Content",
		icon: "clapperboard",
		type: "content",
		desc: "Media library — books, movies, anime, series, games.",
		details: [
			"Each subfolder maps to a content type (Anime/, Books/, etc.).",
			"Content Gallery reads progress from frontmatter fields.",
			"Content types are fully configurable in plugin settings.",
		],
	},
	{
		name: "40 Resources",
		icon: "library",
		type: "resource",
		desc: "Reference material, snippets, and reusable information.",
		details: [
			"Programming guides, cheat sheets, how-to articles.",
			"Organize by topic subfolders (e.g. Programming/, Design/).",
			"The first subfolder becomes the 'topic' in frontmatter.",
		],
	},
	{
		name: "45 Study",
		icon: "graduation-cap",
		type: "study",
		desc: "Educational content — courses, labs, university notes.",
		details: [
			"Lecture notes, lab reports, exam preparation materials.",
			"Works together with the Schedule widget for school timetables.",
			"Organize by subject or semester subfolders.",
		],
	},
	{
		name: "50 Archive",
		icon: "archive",
		type: "archive",
		desc: "Completed projects and archived items.",
		details: [
			"Move finished projects here to keep 20 Projects clean.",
			"Archived items are still searchable and visible in Graph.",
			"Nothing is deleted — just out of the active workflow.",
		],
	},
	{
		name: "99 Trash",
		icon: "trash-2",
		type: "—",
		desc: "Items marked for deletion.",
		details: [
			"Soft-delete: move notes here before permanent removal.",
			"Ignored by Graph Maps, frontmatter sync, and widgets.",
		],
	},
];

const WIDGETS: GuideWidget[] = [
	{ block: "prayer-widget", desc: "Prayer times with tracking and Hijri date." },
	{ block: "umos-stats", desc: "Daily frontmatter stats with sparkline charts." },
	{ block: "schedule", desc: "Class schedule with auto-advance and tasks." },
	{ block: "tasks-widget", desc: "Task list with filters and inline editing." },
	{ block: "tasks-stats-widget", desc: "Task completion overview with counts." },
	{ block: "tasks-kanban", desc: "Kanban board for markdown tasks." },
	{ block: "content-gallery", desc: "Media library with progress tracking." },
	{ block: "project-gallery", desc: "Active projects grid with status." },
	{ block: "kanban-board", desc: "Free-form kanban board with labels." },
	{ block: "countdown", desc: "Countdown timer to a target date." },
	{ block: "countdown-rings", desc: "Visual ring countdown." },
	{ block: "daily-nav", desc: "Navigation between daily notes." },
	{ block: "word-of-day", desc: "Editable word of the day widget." },
	{ block: "words-of-day", desc: "Daily review and word-of-the-day history." },
	{ block: "umos-input", desc: "Frontmatter input controls (text, rating, slider, etc.)." },
	{ block: "cols-umos", desc: "Multi-column markdown layout." },
	{ block: "info-umos", desc: "Wikipedia-style infobox card." },
];

const COMMANDS: GuideCommand[] = [
	{ name: "Open Home", desc: "Open the main umOS dashboard." },
	{ name: "Quick Capture", desc: "Fast note/task capture modal." },
	{ name: "Task Calendar", desc: "Open the calendar view for tasks." },
	{ name: "Inbox / Triage Center", desc: "Sort and organize inbox items." },
	{ name: "Better Search", desc: "Omni-search across the vault." },
	{ name: "Focus Session", desc: "Start a timed focus session." },
	{ name: "Dashboard Studio", desc: "Build dashboards from widgets visually." },
	{ name: "Schedule Editor", desc: "Edit the weekly class schedule." },
	{ name: "Create Daily Note", desc: "Create today's daily note manually." },
	{ name: "Sync Frontmatter with Folders", desc: "Re-sync type & topic for all files." },
	{ name: "Text Formatting", desc: "Quick formatting picker (marks, callouts, etc.)." },
];

/* ─── renderer ─── */

export function renderVaultGuideSection(containerEl: HTMLElement, ctx: SettingsContext): void {
	const root = containerEl.createDiv({ cls: "umos-guide-root" });

	/* ── 1. Intro ── */
	renderIntroBlock(root);

	/* ── 2. Folder structure ── */
	renderFolderSection(root);

	/* ── 3. Dynamic Frontmatter ── */
	renderFrontmatterSection(root);

	/* ── 4. Widgets ── */
	renderWidgetSection(root);

	/* ── 5. Commands ── */
	renderCommandSection(root);

	/* ── 6. Tips ── */
	renderTipsSection(root);
}

/* ─── blocks ─── */

function renderIntroBlock(root: HTMLElement): void {
	const block = root.createDiv({ cls: "umos-guide-block" });
	block.createEl("h3", { text: t("What is umOS?"), cls: "umos-guide-heading" });
	block.createEl("p", {
		text: t("umOS is a full life-management layer for Obsidian. It turns your vault into a structured personal operating system with dashboards, task tracking, content management, prayer times, study schedules, and more."),
		cls: "umos-guide-text",
	});
	block.createEl("p", {
		text: t("This guide explains the default folder layout, the dynamic metadata system, available widgets, and useful commands. Read it once and you will understand the entire architecture."),
		cls: "umos-guide-text",
	});
}

function renderFolderSection(root: HTMLElement): void {
	const block = root.createDiv({ cls: "umos-guide-block" });
	block.createEl("h3", { text: t("Folder Structure"), cls: "umos-guide-heading" });
	block.createEl("p", {
		text: t("The vault uses numbered prefixes (00, 05, 10 …) to keep folders in a logical order. Each folder has a specific purpose and determines the automatic 'type' assigned to notes inside it."),
		cls: "umos-guide-text",
	});

	for (const f of FOLDERS) {
		const card = block.createDiv({ cls: "umos-guide-folder-card" });

		const headerRow = card.createDiv({ cls: "umos-guide-folder-header" });
		const iconEl = headerRow.createDiv({ cls: "umos-guide-folder-icon" });
		setIcon(iconEl, f.icon);
		headerRow.createEl("strong", { text: f.name, cls: "umos-guide-folder-name" });
		headerRow.createEl("span", { text: `type: ${f.type}`, cls: "umos-guide-folder-type" });

		card.createEl("p", { text: t(f.desc), cls: "umos-guide-folder-desc" });

		if (f.details.length > 0) {
			const ul = card.createEl("ul", { cls: "umos-guide-folder-details" });
			for (const d of f.details) {
				ul.createEl("li", { text: t(d) });
			}
		}
	}
}

function renderFrontmatterSection(root: HTMLElement): void {
	const block = root.createDiv({ cls: "umos-guide-block" });
	block.createEl("h3", { text: t("Dynamic Frontmatter"), cls: "umos-guide-heading" });

	block.createEl("p", {
		text: t("umOS automatically manages two frontmatter properties — type and topic — based on a file's location in the vault."),
		cls: "umos-guide-text",
	});

	const table = block.createEl("table", { cls: "umos-guide-table" });
	const thead = table.createEl("thead");
	const headRow = thead.createEl("tr");
	headRow.createEl("th", { text: t("Property") });
	headRow.createEl("th", { text: t("Source") });
	headRow.createEl("th", { text: t("Example") });

	const tbody = table.createEl("tbody");

	const typeRow = tbody.createEl("tr");
	typeRow.createEl("td").createEl("code", { text: "type" });
	typeRow.createEl("td", { text: t("Determined by the root area folder (20 Projects → project, 30 Content → content type key).") });
	typeRow.createEl("td").createEl("code", { text: "type: book" });

	const topicRow = tbody.createEl("tr");
	topicRow.createEl("td").createEl("code", { text: "topic" });
	topicRow.createEl("td", { text: t("The first subfolder inside the area root.") });
	topicRow.createEl("td").createEl("code", { text: "topic: JavaScript" });

	block.createEl("p", {
		text: t("When you move a file from one folder to another, umOS instantly updates its type and topic. You can also run 'Sync Frontmatter with Folders' from Debug Tools to re-sync the entire vault at once."),
		cls: "umos-guide-text",
	});

	const exBlock = block.createDiv({ cls: "umos-guide-example" });
	exBlock.createEl("strong", { text: t("Example:") });
	exBlock.createEl("p", {
		text: "40 Resources/Programming/JavaScript.md → type: resource, topic: Programming",
		cls: "umos-guide-mono",
	});
	exBlock.createEl("p", {
		text: "30 Content/Books/Dune.md → type: book, topic: Books",
		cls: "umos-guide-mono",
	});
	exBlock.createEl("p", {
		text: "20 Projects/umOS Plugin/README.md → type: project, topic: umOS Plugin",
		cls: "umos-guide-mono",
	});
}

function renderWidgetSection(root: HTMLElement): void {
	const block = root.createDiv({ cls: "umos-guide-block" });
	block.createEl("h3", { text: t("Widgets"), cls: "umos-guide-heading" });

	block.createEl("p", {
		text: t("Widgets are markdown code blocks that render interactive UI. Insert them into any note using triple backticks and the widget name."),
		cls: "umos-guide-text",
	});

	const grid = block.createDiv({ cls: "umos-guide-widget-grid" });
	for (const w of WIDGETS) {
		const item = grid.createDiv({ cls: "umos-guide-widget-item" });
		item.createEl("code", { text: w.block, cls: "umos-guide-widget-name" });
		item.createEl("span", { text: t(w.desc), cls: "umos-guide-widget-desc" });
	}
}

function renderCommandSection(root: HTMLElement): void {
	const block = root.createDiv({ cls: "umos-guide-block" });
	block.createEl("h3", { text: t("Commands"), cls: "umos-guide-heading" });

	block.createEl("p", {
		text: t("All commands are available via the Command Palette (Ctrl+P / Cmd+P). Search for 'umOS' to see the full list."),
		cls: "umos-guide-text",
	});

	const table = block.createEl("table", { cls: "umos-guide-table" });
	const thead = table.createEl("thead");
	const headRow = thead.createEl("tr");
	headRow.createEl("th", { text: t("Command") });
	headRow.createEl("th", { text: t("Description") });

	const tbody = table.createEl("tbody");
	for (const c of COMMANDS) {
		const row = tbody.createEl("tr");
		row.createEl("td").createEl("code", { text: c.name });
		row.createEl("td", { text: t(c.desc) });
	}
}

function renderTipsSection(root: HTMLElement): void {
	const block = root.createDiv({ cls: "umos-guide-block" });
	block.createEl("h3", { text: t("Tips & Best Practices"), cls: "umos-guide-heading" });

	const tips = [
		"Use the Scaffold button (Settings → Vault Setup) to create all default folders at once.",
		"Quick Capture (Ctrl+P → Quick Capture) is the fastest way to get ideas into the vault.",
		"The Home dashboard auto-refreshes — pin it as a tab for an always-on overview.",
		"Content Gallery supports custom types — add your own in Settings → Content Gallery.",
		"Focus Sessions log time to the daily note automatically.",
		"Graph Maps rebuild in the background — you never need to run them manually.",
		"If something looks wrong, go to Settings → Debug Tools → Sync Frontmatter with Folders.",
	];

	const ul = block.createEl("ul", { cls: "umos-guide-tips-list" });
	for (const tip of tips) {
		ul.createEl("li", { text: t(tip), cls: "umos-guide-tip-item" });
	}
}
