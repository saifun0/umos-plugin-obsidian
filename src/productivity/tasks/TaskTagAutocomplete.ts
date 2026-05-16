import type { App } from "obsidian";

interface SuggestedTag {
	name: string;
	count: number;
}

export interface TaskTagFieldController {
	getTags(): string[];
	setTags(tags: string[]): void;
	focus(): void;
	clear(): void;
}

export interface TaskTagFieldOptions {
	initialTags?: string[];
	placeholder?: string;
	onChange?: (tags: string[]) => void;
}

export function displayTaskTag(tag: string): string {
	return tag.startsWith("tasks/") ? tag.slice("tasks/".length) : tag;
}

export function normalizeTaskTag(raw: string): string | null {
	const tag = raw.trim().replace(/^#/, "").replace(/^tasks\//, "");
	if (!tag) return null;
	return `tasks/${tag}`;
}

export function parseTaskTagsInput(value: string): string[] {
	return value
		.split(/[\s,]+/)
		.map(normalizeTaskTag)
		.filter((tag): tag is string => Boolean(tag));
}

export function getSuggestedTaskTags(app: App): SuggestedTag[] {
	const cache = app.metadataCache as unknown as { getTags?: () => Record<string, number> };
	const all = typeof cache.getTags === "function" ? cache.getTags() : {};
	const map = new Map<string, number>();

	for (const [tag, count] of Object.entries(all)) {
		const clean = tag.replace(/^#/, "");
		if (clean.startsWith("tasks/")) {
			const name = clean.slice("tasks/".length);
			map.set(name, (map.get(name) ?? 0) + Number(count));
		}
	}

	return [...map.entries()]
		.map(([name, count]) => ({ name, count }))
		.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function renderTaskTagField(
	parent: HTMLElement,
	app: App,
	options: TaskTagFieldOptions = {},
): TaskTagFieldController {
	let tags = dedupeTags(options.initialTags ?? []);
	const suggestions = getSuggestedTaskTags(app);

	const fieldWrap = parent.createDiv({ cls: "umos-tag-field-wrap" });
	const chipsEl = fieldWrap.createDiv({ cls: "umos-tag-chips" });
	const inputWrap = fieldWrap.createDiv({ cls: "umos-tag-input-wrap" });
	const input = inputWrap.createEl("input", {
		cls: "umos-tag-input",
		attr: { type: "text", placeholder: options.placeholder ?? "Add tag…" },
	}) as HTMLInputElement;
	const dropdown = inputWrap.createDiv({ cls: "umos-tag-dropdown" });
	dropdown.style.display = "none";

	const notify = () => options.onChange?.([...tags]);

	const setTags = (nextTags: string[]) => {
		tags = dedupeTags(nextTags);
		rebuildChips();
		notify();
	};

	const addTag = (raw: string) => {
		const full = normalizeTaskTag(raw);
		if (!full) return;
		if (!tags.includes(full)) {
			tags = [...tags, full];
			rebuildChips();
			notify();
		}
		input.value = "";
		dropdown.style.display = "none";
	};

	const createSuggestionOption = (suggestion: SuggestedTag) => {
		const opt = dropdown.createDiv({ cls: "umos-tag-dropdown-item" });
		opt.setAttribute("tabindex", "0");
		opt.createSpan({ cls: "umos-tag-dropdown-hash", text: "#" });
		opt.createSpan({ cls: "umos-tag-dropdown-name", text: suggestion.name });
		opt.createSpan({ cls: "umos-tag-dropdown-count", text: String(suggestion.count) });
		opt.addEventListener("mousedown", (event) => {
			event.preventDefault();
			addTag(suggestion.name);
		});
	};

	const createCreateOption = (tag: string) => {
		const opt = dropdown.createDiv({ cls: "umos-tag-dropdown-item umos-tag-dropdown-create" });
		opt.setAttribute("tabindex", "0");
		opt.textContent = `+ Создать "#${tag}"`;
		opt.addEventListener("mousedown", (event) => {
			event.preventDefault();
			addTag(tag);
		});
	};

	function rebuildChips(): void {
		chipsEl.empty();
		for (const fullTag of tags) {
			const tag = displayTaskTag(fullTag);
			const chip = chipsEl.createSpan({ cls: "umos-tag-chip" });
			chip.createSpan({ text: `#${tag}` });
			const remove = chip.createEl("button", { text: "×", cls: "umos-tag-chip-remove" });
			remove.addEventListener("click", () => {
				tags = tags.filter((item) => item !== fullTag);
				rebuildChips();
				notify();
			});
		}
	}

	const updateDropdown = (query: string) => {
		dropdown.empty();
		const q = query.toLowerCase().replace(/^tasks\//, "").replace(/^#/, "").trim();
		const existingLower = new Set(tags.map((tag) => displayTaskTag(tag).toLowerCase()));
		const matches = suggestions
			.filter((suggestion) => !existingLower.has(suggestion.name.toLowerCase()))
			.filter((suggestion) => !q || suggestion.name.toLowerCase().includes(q))
			.slice(0, q ? 8 : suggestions.length);

		if (!q) {
			for (const match of matches) createSuggestionOption(match);
			dropdown.style.display = matches.length > 0 ? "block" : "none";
			return;
		}

		if (matches.length === 0 && !existingLower.has(q)) {
			createCreateOption(q);
		} else {
			for (const match of matches) createSuggestionOption(match);
			if (q && !matches.some((match) => match.name.toLowerCase() === q) && !existingLower.has(q)) {
				createCreateOption(q);
			}
		}

		dropdown.style.display = matches.length > 0 || q ? "block" : "none";
	};

	input.addEventListener("input", () => updateDropdown(input.value));
	input.addEventListener("focus", () => updateDropdown(input.value));
	input.addEventListener("blur", () => {
		setTimeout(() => {
			dropdown.style.display = "none";
		}, 150);
	});

	input.addEventListener("keydown", (event) => {
		if (event.key === "Enter" || event.key === ",") {
			event.preventDefault();
			addTag(input.value);
		} else if (event.key === "Backspace" && input.value === "" && tags.length > 0) {
			tags = tags.slice(0, -1);
			rebuildChips();
			notify();
		} else if (event.key === "Escape") {
			dropdown.style.display = "none";
		} else if (event.key === "ArrowDown") {
			event.preventDefault();
			const items = dropdown.querySelectorAll<HTMLElement>(".umos-tag-dropdown-item");
			if (items.length > 0) items[0].focus();
		}
	});

	dropdown.addEventListener("keydown", (event) => {
		const items = Array.from(dropdown.querySelectorAll<HTMLElement>(".umos-tag-dropdown-item"));
		const focused = document.activeElement as HTMLElement;
		const idx = items.indexOf(focused);
		if (event.key === "ArrowDown") {
			event.preventDefault();
			items[idx + 1]?.focus();
		}
		if (event.key === "ArrowUp") {
			event.preventDefault();
			if (idx <= 0) input.focus();
			else items[idx - 1]?.focus();
		}
		if (event.key === "Enter") {
			event.preventDefault();
			focused.dispatchEvent(new MouseEvent("mousedown"));
		}
		if (event.key === "Escape") {
			dropdown.style.display = "none";
			input.focus();
		}
	});

	rebuildChips();

	return {
		getTags: () => [...tags],
		setTags,
		focus: () => input.focus(),
		clear: () => setTags([]),
	};
}

function dedupeTags(tags: string[]): string[] {
	const result: string[] = [];
	for (const raw of tags) {
		const tag = normalizeTaskTag(raw);
		if (tag && !result.includes(tag)) result.push(tag);
	}
	return result;
}
