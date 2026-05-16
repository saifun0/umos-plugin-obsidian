import { parseWidgetConfig } from "../utils/config";
import {
	WidgetDefinition,
	WidgetFieldSchema,
	WidgetRenderContext,
	WidgetValidationResult,
} from "./types";

function isPlainConfigValue(value: unknown): value is string | number | boolean | string[] {
	return typeof value === "string" ||
		typeof value === "number" ||
		typeof value === "boolean" ||
		(Array.isArray(value) && value.every((item) => typeof item === "string"));
}

export function serializeWidgetConfig(config: Record<string, unknown>): string {
	const lines: string[] = [];
	for (const [key, value] of Object.entries(config)) {
		if (value === undefined || value === null || value === "") continue;
		if (!isPlainConfigValue(value)) continue;
		if (Array.isArray(value)) {
			lines.push(`${key}: [${value.map((item) => `"${item.replace(/"/g, '\\"')}"`).join(", ")}]`);
			continue;
		}
		const needsQuote = typeof value === "string" && /[:#\[\],]/.test(value);
		lines.push(`${key}: ${needsQuote ? `"${value.replace(/"/g, '\\"')}"` : String(value)}`);
	}
	return lines.join("\n");
}

export function widgetConfigToMarkdown(blockName: string, config: Record<string, unknown>): string {
	const body = serializeWidgetConfig(config);
	return body ? `\`\`\`${blockName}\n${body}\n\`\`\`` : `\`\`\`${blockName}\n\`\`\``;
}

export class WidgetRegistry {
	private definitions = new Map<string, WidgetDefinition>();

	register(definition: WidgetDefinition): void {
		this.definitions.set(definition.blockName, definition);
	}

	get(blockName: string): WidgetDefinition | undefined {
		return this.definitions.get(blockName);
	}

	getAll(): WidgetDefinition[] {
		return Array.from(this.definitions.values());
	}

	getRenderable(): WidgetDefinition[] {
		return this.getAll().filter((definition) => typeof definition.factory === "function");
	}

	parseAndValidate(blockName: string, source: string): WidgetValidationResult {
		const definition = this.get(blockName);
		const parsed = parseWidgetConfig(source);
		if (!definition) {
			return {
				config: parsed,
				errors: [`Widget ${blockName} is not registered in umOS.`],
				warnings: [],
			};
		}
		if (definition.skipValidation) {
			return { config: { ...definition.defaults, ...parsed }, errors: [], warnings: [] };
		}
		return this.validate(definition, parsed);
	}

	validate(definition: WidgetDefinition, rawConfig: Record<string, unknown>): WidgetValidationResult {
		const config = { ...definition.defaults, ...rawConfig };
		const errors: string[] = [];
		const warnings: string[] = [];
		const schemaKeys = new Set(Object.keys(definition.schema));

		for (const key of Object.keys(rawConfig)) {
			if (!schemaKeys.has(key)) {
				warnings.push(`Unknown field "${key}" for ${definition.blockName}.`);
			}
		}

		for (const [key, field] of Object.entries(definition.schema)) {
			const value = config[key];
			if ((value === undefined || value === null || value === "") && field.required) {
				errors.push(`Field "${key}" is required.`);
				continue;
			}
			if (value === undefined || value === null || value === "") continue;
			this.validateField(key, field, value, errors);
		}

		return { config, errors, warnings };
	}

	private validateField(key: string, field: WidgetFieldSchema, value: unknown, errors: string[]): void {
		switch (field.type) {
			case "string":
				if (typeof value !== "string") errors.push(`Field "${key}" must be a string.`);
				break;
			case "number": {
				const n = typeof value === "number" ? value : Number(value);
				if (!Number.isFinite(n)) {
					errors.push(`Field "${key}" must be a number.`);
					break;
				}
				if (field.min !== undefined && n < field.min) errors.push(`Field "${key}" must be at least ${field.min}.`);
				if (field.max !== undefined && n > field.max) errors.push(`Field "${key}" must be at most ${field.max}.`);
				break;
			}
			case "boolean":
				if (typeof value !== "boolean" && value !== "true" && value !== "false") {
					errors.push(`Field "${key}" must be true or false.`);
				}
				break;
			case "array":
				if (!Array.isArray(value)) errors.push(`Field "${key}" must be an array.`);
				break;
			case "date":
				if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/.test(value)) {
					errors.push(`Field "${key}" must be a date in YYYY-MM-DD or YYYY-MM-DD HH:MM format.`);
				}
				break;
			case "enum":
				if (!field.options?.includes(String(value))) {
					errors.push(`Field "${key}" must be one of: ${(field.options ?? []).join(", ")}.`);
				}
				break;
		}
	}
}

export function createBaseWidgetDefinitions(): WidgetDefinition[] {
	const definitions: WidgetDefinition[] = [
		{
			blockName: "prayer-widget",
			title: "Prayer Widget",
			description: "Prayer times and the next prayer.",
			defaults: { show: "both", style: "full", show_sunrise: true },
			schema: {
				show: { type: "enum", options: ["times", "next", "both"], description: "What to show: the time list, only the next prayer, or both blocks." },
				style: { type: "enum", options: ["full", "compact"], description: "Widget visual size: full or compact." },
				show_sunrise: { type: "boolean", description: "Show sunrise alongside prayer times." },
			},
			examples: ["show: both\nstyle: full"],
			snippets: [
				{ id: "full", name: "Full", description: "Prayer times and the next prayer.", config: { show: "both", style: "full", show_sunrise: true } },
				{ id: "compact", name: "Compact", description: "Compact block for columns.", config: { show: "both", style: "compact", show_sunrise: true } },
				{ id: "next", name: "Next only", description: "Only the next prayer.", config: { show: "next", style: "compact" } },
			],
		},
		{
			blockName: "umos-stats",
			title: "Stats",
			description: "Daily frontmatter stats with charts.",
			defaults: { chart: "sparkline", compare: false },
			schema: {
				metrics: { type: "array", description: "Frontmatter fields to track, for example [mood, productivity, sleep]." },
				period: { type: "number", min: 1, description: "How many recent days to use when no explicit range is set." },
				range: { type: "string", description: "Named range, when supported by the widget." },
				dateFrom: { type: "date", description: "Range start date in YYYY-MM-DD format." },
				date_from: { type: "date", description: "Same as dateFrom, but in snake_case." },
				dateTo: { type: "date", description: "Range end date in YYYY-MM-DD format." },
				date_to: { type: "date", description: "Same as dateTo, but in snake_case." },
				chart: { type: "enum", options: ["sparkline", "bar", "ring", "none"], description: "Chart type for metrics." },
				compare: { type: "boolean", description: "Show comparison with the previous period." },
			},
			examples: ["chart: sparkline\ncompare: true"],
			snippets: [
				{ id: "daily-health", name: "Daily Health", description: "Mood, productivity, and sleep for a period.", config: { metrics: ["mood", "productivity", "sleep"], chart: "sparkline", compare: true } },
				{ id: "prayer-stats", name: "Prayer Stats", description: "Prayer stats as a ring chart.", config: { metrics: ["prayer_count"], chart: "ring", compare: true } },
				{ id: "no-chart", name: "Numbers", description: "Only numeric values without a chart.", config: { metrics: ["mood", "productivity"], chart: "none" } },
			],
		},
		{
			blockName: "words-of-day",
			title: "Words Of Day",
			description: "Word-of-the-day history.",
			defaults: { period: 30, field: "word_of_day" },
			schema: {
				period: { type: "number", min: 1, description: "How many history days to show." },
				field: { type: "string", description: "Frontmatter field where the word of the day is stored." },
			},
			examples: ["period: 30"],
			snippets: [
				{ id: "month", name: "30 Days", description: "Month history.", config: { period: 30, field: "word_of_day" } },
				{ id: "week", name: "7 Days", description: "Compact weekly history.", config: { period: 7, field: "word_of_day" } },
			],
		},
		{
			blockName: "schedule",
			title: "Schedule",
			description: "Class schedule with optional day tasks.",
			defaults: { show: "current", highlight: true, countdown: true, tasks: false, task_mode: "both" },
			schema: {
				show: { type: "enum", options: ["current", "week", "both"], description: "Which schedule parts to show: current day, week, or both blocks." },
				highlight: { type: "boolean", description: "Highlight the current or next class." },
				countdown: { type: "boolean", description: "Show a timer until the class starts or ends." },
				tasks: { type: "boolean", description: "Add tasks for the selected day under the schedule." },
				task_mode: { type: "enum", options: ["both", "due", "scheduled"], description: "Which tasks to pull in: due date, scheduled date, or both." },
				task_path: { type: "string", description: "Limit task search to one folder or comma-separated folders." },
			},
			examples: ["show: both\ncountdown: true\ntasks: true"],
			snippets: [
				{ id: "today", name: "Today", description: "Current day with countdown.", config: { show: "current", highlight: true, countdown: true, tasks: false } },
				{ id: "week", name: "Week", description: "Full school week.", config: { show: "week", highlight: true, countdown: false, tasks: false } },
				{ id: "with-tasks", name: "With Tasks", description: "Schedule plus due/scheduled tasks for the day.", config: { show: "both", highlight: true, countdown: true, tasks: true, task_mode: "both" } },
			],
		},
		{
			blockName: "tasks-widget",
			title: "Tasks List",
			description: "Task list with filters and quick creation.",
			defaults: { title: "Tasks", sort: "priority-asc" },
			schema: {
				title: { type: "string", description: "Title above the task list." },
				path: { type: "string", description: "Folder or comma-separated folder list to search for markdown tasks." },
				tag: { type: "string", description: "Show only tasks with this tag, for example tasks/study or #tasks/study." },
				due: { type: "string", description: "Due filter: today, overdue, or YYYY-MM-DD date." },
				priority: { type: "enum", options: ["high", "medium", "low"], description: "Show only tasks with the selected priority." },
				status: { type: "string", description: "Comma-separated statuses: todo, doing, done, cancelled." },
				scheduled: { type: "string", description: "Scheduled date filter: today or YYYY-MM-DD." },
				startDate: { type: "string", description: "Start date filter: today or YYYY-MM-DD." },
				dateFrom: { type: "date", description: "Start of the range for statistic/date filters." },
				dateTo: { type: "date", description: "End of the range for statistic/date filters." },
				sort: { type: "string", description: "Sort string such as priority-asc, priority-desc, dueDate-asc, status-asc." },
				file: { type: "string", description: "File where the plus button creates new tasks." },
				target: { type: "string", description: "Where to create tasks: current for the current note, or the default daily note." },
				create_in: { type: "string", description: "Alias for target. Often used as create_in: current." },
				use_current: { type: "boolean", description: "If true, new tasks are created in the current note." },
				default_tag: { type: "string", description: "Tag automatically added to new tasks." },
				default_tags: { type: "array", description: "Multiple tags automatically added to new tasks." },
			},
			examples: ["title: Tasks for today\ndue: today\ncreate_in: current"],
			snippets: [
				{ id: "today", name: "Today", description: "Tasks due today.", config: { title: "Today", due: "today", sort: "priority-asc", create_in: "current" } },
				{ id: "active", name: "Active", description: "Todo and doing tasks.", config: { title: "Active tasks", status: "todo,doing", sort: "priority-asc", create_in: "current" } },
				{ id: "study", name: "Study", description: "Study tasks by tag.", config: { title: "Study", tag: "tasks/study", status: "todo,doing", sort: "dueDate-asc", create_in: "current" } },
				{ id: "overdue", name: "Overdue", description: "Overdue tasks.", config: { title: "Overdue", due: "overdue", sort: "dueDate-asc" } },
			],
		},
		{
			blockName: "tasks-kanban",
			title: "Tasks Kanban",
			description: "Kanban for markdown tasks.",
			defaults: { title: "Kanban" },
			schema: {
				title: { type: "string", description: "Kanban board title." },
				path: { type: "string", description: "Folder or comma-separated folder list to search for tasks." },
				tag: { type: "string", description: "Show only tasks with this tag." },
				due: { type: "string", description: "Due filter: today, overdue, or YYYY-MM-DD." },
				status: { type: "string", description: "Initial status filter when tasks need to be limited." },
				create_in: { type: "string", description: "Where to create new tasks: current or the default daily note." },
				file: { type: "string", description: "Specific file for new tasks." },
				default_tag: { type: "string", description: "Tag added to new kanban tasks." },
				default_tags: { type: "array", description: "Multiple tags for new kanban tasks." },
			},
			examples: ["title: Projects\ncreate_in: current"],
			snippets: [
				{ id: "dashboard", name: "Dashboard Kanban", description: "Kanban that creates tasks in the current dashboard.", config: { title: "Kanban", create_in: "current" } },
				{ id: "study", name: "Study Kanban", description: "Kanban by study tag.", config: { title: "Study", tag: "tasks/study", create_in: "current" } },
			],
		},
		{
			blockName: "tasks-stats-widget",
			title: "Tasks Stats",
			description: "Task summary.",
			defaults: {},
			schema: {
				path: { type: "string", description: "Folder or comma-separated folder list for task counting." },
				tag: { type: "string", description: "Count only tasks with this tag." },
				status: { type: "string", description: "Count only the specified statuses." },
				dateFrom: { type: "date", description: "Stats range start." },
				dateTo: { type: "date", description: "Stats range end." },
			},
			examples: [""],
			snippets: [
				{ id: "all", name: "All Tasks", description: "Overall task stats.", config: {} },
				{ id: "study", name: "Study Stats", description: "Stats for study tasks.", config: { tag: "tasks/study" } },
			],
		},
		{
			blockName: "tasks-completed-widget",
			title: "Completed Tasks",
			description: "Collapsed list of tasks completed today, in 7 days, and in 30 days.",
			defaults: { title: "Completed tasks", collapsed: true, limit: 8, range: "7" },
			schema: {
				title: { type: "string", description: "Title above the completed tasks block." },
				path: { type: "string", description: "Folder or comma-separated folder list to search for completed tasks." },
				tag: { type: "string", description: "Show only completed tasks with this tag." },
				priority: { type: "enum", options: ["high", "medium", "low"], description: "Show only completed tasks with the selected priority." },
				due: { type: "string", description: "Due filter: today, overdue, or YYYY-MM-DD date." },
				scheduled: { type: "string", description: "Scheduled date filter: today or YYYY-MM-DD." },
				startDate: { type: "string", description: "Start date filter: today or YYYY-MM-DD." },
				collapsed: { type: "boolean", description: "Start the completed tasks block collapsed." },
				limit: { type: "number", min: 1, max: 50, description: "Maximum completed tasks shown in the expanded list." },
				range: { type: "enum", options: ["today", "7", "30"], description: "Expanded list range: today, 7, or 30 days." },
			},
			examples: ["collapsed: true\nrange: 7\nlimit: 8"],
			snippets: [
				{ id: "collapsed", name: "Collapsed", description: "Completed task counts with a collapsed list.", config: { title: "Completed tasks", collapsed: true, range: "7", limit: 8 } },
				{ id: "month", name: "30 Days", description: "Open the completed list on the 30 day range.", config: { title: "Completed tasks", collapsed: true, range: "30", limit: 12 } },
				{ id: "study", name: "Study Done", description: "Completed study tasks by tag.", config: { title: "Completed study", tag: "tasks/study", collapsed: true, range: "7", limit: 8 } },
			],
		},
		{
			blockName: "progress-table",
			title: "Progress Table",
			description: "Universal checklist table for any grouped work.",
			defaults: {
				id: "progress-table",
				title: "Progress Table",
				columns: "Ready, Reviewed",
				groups: "Project A: №1-№5; Project B: Step 1, Step 2, Step 3",
				mark: "+",
				summary: true,
			},
			schema: {
				id: { type: "string", description: "Storage ID for saved cell marks." },
				title: { type: "string", description: "Title above the table." },
				columns: { type: "string", description: "Comma-separated table columns." },
				groups: { type: "string", description: "Groups separated by semicolons: Group: item1, item2; Other: №1-№5." },
				mark: { type: "string", description: "Symbol shown in checked cells." },
				summary: { type: "boolean", description: "Show marked count, progress, and row count." },
			},
			skipValidation: true,
			examples: [
				"title: Progress table\ncolumns: [Ready, Reviewed]\ngroups:\n  Project A: №1-№5\n  Project B: Step 1, Step 2, Step 3",
			],
			snippets: [
				{
					id: "general",
					name: "General Progress",
					description: "Grouped checklist table for any work.",
					config: {
						id: "general-progress",
						title: "Контроль прогресса",
						columns: "Готово, Проверено",
						groups: "Проект A: №1-№5; Проект B: Шаг 1, Шаг 2, Шаг 3",
						mark: "+",
						summary: true,
					},
				},
				{
					id: "debts",
					name: "Debt Tracker",
					description: "Ready/defense style table for missing work.",
					config: {
						id: "debt-tracker",
						title: "Долги и закрытие",
						columns: "Готовность, Защита",
						groups: "Предмет 1: №1-№5; Предмет 2: №1-№4; Предмет 3: №1, №2",
						mark: "+",
						summary: true,
					},
				},
			],
		},
		{
			blockName: "content-gallery",
			title: "Content Gallery",
			description: "Content gallery.",
			defaults: { style: "grid" },
			schema: { style: { type: "enum", options: ["grid", "list"], description: "Gallery view: grid cards or compact list." } },
			examples: ["style: grid"],
			snippets: [
				{ id: "grid", name: "Grid", description: "Cards in a grid.", config: { style: "grid" } },
				{ id: "list", name: "List", description: "Compact list.", config: { style: "list" } },
			],
		},
		{
			blockName: "project-gallery",
			title: "Project Gallery",
			description: "Project gallery.",
			defaults: { style: "grid" },
			schema: { style: { type: "enum", options: ["grid", "list"], description: "Project gallery view: grid or list." } },
			examples: ["style: grid"],
			snippets: [
				{ id: "grid", name: "Grid", description: "Projects as cards.", config: { style: "grid" } },
				{ id: "list", name: "List", description: "Projects as a list.", config: { style: "list" } },
			],
		},
		{
			blockName: "daily-nav",
			title: "Daily Nav",
			description: "Daily note navigation.",
			defaults: {},
			schema: {},
			examples: [""],
			snippets: [
				{ id: "default", name: "Daily Nav", description: "Daily note navigation.", config: {} },
			],
		},
		{
			blockName: "word-of-day",
			title: "Word Of Day",
			description: "Editable word of the day.",
			defaults: { property: "word_of_day", placeholder: "Word of the day..." },
			schema: {
				property: { type: "string", description: "Frontmatter field where the value is saved." },
				placeholder: { type: "string", description: "Placeholder text while the value is empty." },
			},
			examples: ["property: word_of_day"],
			snippets: [
				{ id: "word", name: "Word", description: "Word of the day in word_of_day.", config: { property: "word_of_day", placeholder: "Word of the day..." } },
				{ id: "lesson", name: "Lesson", description: "Short lesson of the day.", config: { property: "lesson_of_day", placeholder: "What did you understand today?" } },
			],
		},
		{
			blockName: "countdown",
			title: "Countdown",
			description: "Countdown rings.",
			defaults: { title: "Countdown", view: "focus" },
			schema: {
				date: { type: "date", description: "Target date/time: YYYY-MM-DD or YYYY-MM-DD HH:MM." },
				target: { type: "date", description: "Alias for date." },
				title: { type: "string", description: "Countdown title." },
				accent: { type: "string", description: "Accent color, for example #27ae60." },
				layout: { type: "enum", options: ["grid", "nested"], description: "Grid of separate rings or nested rings." },
				nested: { type: "boolean", description: "Quick toggle for nested layout." },
				view: { type: "enum", options: ["full", "focus", "minimal"], description: "Visual density and size." },
				legend: { type: "boolean", description: "Show legend next to the nested visual." },
				show_legend: { type: "boolean", description: "Alias for legend." },
			},
			examples: ["title: Until Exams\ndate: 2026-07-01 00:00\nview: focus"],
			snippets: [
				{ id: "focus", name: "Focus", description: "Large countdown without extra legend.", config: { title: "Until Target", date: "2026-07-01 00:00", view: "focus" } },
				{ id: "minimal", name: "Minimal", description: "Minimal countdown for a side column.", config: { title: "Deadline", date: "2026-07-01 00:00", view: "minimal" } },
				{ id: "nested", name: "Nested", description: "Nested rings with legend.", config: { title: "Until Event", date: "2026-07-01 00:00", layout: "nested", view: "full", legend: true } },
			],
		},
		{
			blockName: "countdown-rings",
			title: "Countdown Rings",
			description: "Alias for countdown.",
			defaults: { title: "Countdown", layout: "nested" },
			schema: {
				date: { type: "date", description: "Target date/time: YYYY-MM-DD or YYYY-MM-DD HH:MM." },
				target: { type: "date", description: "Alias for date." },
				title: { type: "string", description: "Countdown title." },
				accent: { type: "string", description: "Accent color, for example #0ea5e9." },
				layout: { type: "enum", options: ["grid", "nested"], description: "Grid of separate rings or nested rings." },
				nested: { type: "boolean", description: "Quick toggle for nested layout." },
				view: { type: "enum", options: ["full", "focus", "minimal"], description: "Visual density and size." },
				legend: { type: "boolean", description: "Show legend next to the nested visual." },
				show_legend: { type: "boolean", description: "Alias for legend." },
			},
			examples: ["title: Until Summer\ndate: 2026-06-01 00:00\nlayout: nested"],
			snippets: [
				{ id: "nested", name: "Nested", description: "Nested countdown rings.", config: { title: "Until Event", date: "2026-07-01 00:00", layout: "nested", view: "full", legend: true } },
				{ id: "focus", name: "Focus", description: "Focused nested countdown.", config: { title: "Until Target", date: "2026-07-01 00:00", layout: "nested", view: "focus", legend: false } },
			],
		},
		{
			blockName: "kanban-board",
			title: "Free Kanban",
			description: "Free-form umOS kanban board.",
			defaults: { id: "default" },
			schema: { id: { type: "string", required: true, description: "Board ID in umOS storage. Different IDs create different boards." } },
			examples: ["id: default"],
			snippets: [
				{ id: "default", name: "Default Board", description: "Default free-form kanban board.", config: { id: "default" } },
				{ id: "content", name: "Content Board", description: "Separate board for content.", config: { id: "content" } },
			],
		},
		{
			blockName: "cols-umos",
			title: "Columns",
			description: "Markdown columns.",
			defaults: {},
			schema: { cols: { type: "number", min: 1, max: 6, description: "Column count, when it needs to be set explicitly." } },
			examples: ["cols: 2\nLeft Column\n===\nRight Column"],
			skipValidation: true,
		},
		{
			blockName: "info-umos",
			title: "Infobox",
			description: "Reference-style infobox.",
			defaults: {},
			schema: {
				title: { type: "string", description: "Main infobox title." },
				subtitle: { type: "string", description: "Subtitle under the title." },
				image: { type: "string", description: "URL or image path in the vault." },
				caption: { type: "string", description: "Image caption." },
			},
			examples: ["title: Card\nsubtitle: Example"],
			snippets: [
				{ id: "note", name: "Note Card", description: "Simple information card.", config: { title: "Note", subtitle: "Short description" } },
				{ id: "image", name: "Image Card", description: "Card with an image.", config: { title: "Card", image: "", caption: "" } },
			],
		},
		{
			blockName: "umos-input",
			title: "Input",
			description: "Frontmatter input controls.",
			defaults: { type: "text" },
			schema: {
				type: { type: "string", required: true, description: "Input type: text, number, rating, slider, and others." },
				property: { type: "string", description: "Frontmatter field for saving the value." },
				label: { type: "string", description: "Label next to the input." },
				placeholder: { type: "string", description: "Placeholder inside the text field." },
				max: { type: "number", description: "Maximum for rating/slider/number input." },
				min: { type: "number", description: "Minimum for slider/number input." },
				step: { type: "number", description: "Step for slider/number input." },
				icon: { type: "string", description: "Icon or emoji for rating/chip/toggle." },
				empty_icon: { type: "string", description: "Empty icon for rating input." },
				multiline: { type: "boolean", description: "Enable multiline text input." },
				options: { type: "array", description: "Values for select input." },
				labels: { type: "array", description: "Labels for select/toggles/chips." },
				colors: { type: "array", description: "Colors for select/chips." },
				columns: { type: "number", min: 1, max: 6, description: "Column count for grouped inputs." },
				property_current: { type: "string", description: "Frontmatter field for the current progress value." },
				property_total: { type: "string", description: "Frontmatter field for the total progress value." },
				editable: { type: "boolean", description: "Allow progress input editing." },
				suffix: { type: "string", description: "Suffix next to the number, for example %, pages, or h." },
				button_size: { type: "string", description: "Control size: sm or lg." },
			},
			examples: ["type: text\nproperty: note\nlabel: Note\nplaceholder: Write..."],
			snippets: [
				{ id: "word", name: "Text Input", description: "Regular frontmatter text input.", config: { type: "text", property: "note", label: "Note", placeholder: "Write..." } },
				{ id: "rating", name: "Rating", description: "Daily rating in frontmatter.", config: { type: "rating", property: "mood", label: "Mood", max: 5 } },
			],
		},
		{
			blockName: "daily-review",
			title: "Daily Review",
			description: "Daily or weekly reflection in frontmatter.",
			defaults: { mode: "daily" },
			schema: {
				mode: { type: "enum", options: ["daily", "weekly"], description: "Question set: daily or weekly review." },
				title: { type: "string", description: "Widget title." },
			},
			examples: ["mode: daily"],
			snippets: [
				{ id: "daily", name: "Daily", description: "Daily review.", config: { mode: "daily" } },
				{ id: "weekly", name: "Weekly", description: "Weekly review.", config: { mode: "weekly", title: "Weekly Review" } },
			],
		},
		{
			blockName: "umos-debug",
			title: "Debug",
			description: "EventBus and widget diagnostics.",
			defaults: { show: "all" },
			schema: {
				show: { type: "enum", options: ["all", "events", "widgets", "compact"], description: "What to show: everything, only events, widgets, or a compact summary." },
				limit: { type: "number", min: 1, max: 50, description: "Maximum rows in each diagnostics list." },
			},
			examples: ["show: all\nlimit: 12"],
			snippets: [
				{ id: "all", name: "All", description: "Events and widget diagnostics.", config: { show: "all", limit: 12 } },
				{ id: "events", name: "Events", description: "Only recent EventBus events.", config: { show: "events", limit: 20 } },
				{ id: "widgets", name: "Widgets", description: "Only render count and validation issues.", config: { show: "widgets", limit: 20 } },
				{ id: "compact", name: "Compact", description: "Short diagnostics summary.", config: { show: "compact", limit: 8 } },
			],
		},
	];
	return definitions.map(addFallbackDescriptions);
}

function addFallbackDescriptions(definition: WidgetDefinition): WidgetDefinition {
	const schema: Record<string, WidgetFieldSchema> = {};
	for (const [key, field] of Object.entries(definition.schema)) {
		schema[key] = {
			...field,
			description: field.description ?? buildFallbackDescription(key, field),
		};
	}
	return { ...definition, schema };
}

function buildFallbackDescription(key: string, field: WidgetFieldSchema): string {
	const required = field.required ? " Required parameter." : "";
	if (field.type === "enum") {
		return `Options: ${(field.options ?? []).join(", ")}.${required}`.trim();
	}
	if (field.type === "boolean") return `true or false.${required}`.trim();
	if (field.type === "number") {
		const bounds = [
			field.min !== undefined ? `min ${field.min}` : "",
			field.max !== undefined ? `max ${field.max}` : "",
		].filter(Boolean).join(", ");
		return `Number${bounds ? ` (${bounds})` : ""}.${required}`.trim();
	}
	if (field.type === "date") return `Date in YYYY-MM-DD or YYYY-MM-DD HH:MM format.${required}`.trim();
	if (field.type === "array") return `List of values in [a, b, c] format.${required}`.trim();
	return `Parameter ${key}.${required}`.trim();
}
