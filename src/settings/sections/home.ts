import { Setting } from "obsidian";
import {
	SettingsContext,
	createIconButton,
	createSection,
	createSubheading,
	renderEditableList,
	renderEditActions,
} from "../helpers";

const ALL_SECTIONS: { id: string; label: string }[] = [
	{ id: "clock", label: "🕐 Clock" },
	{ id: "greeting", label: "👋 Greeting" },
	{ id: "weather", label: "🌤 Weather" },
	{ id: "prayer", label: "🕌 Prayer" },
	{ id: "navigation", label: "🧭 Navigation" },
	{ id: "stats", label: "📊 Daily Metrics" },
	{ id: "tasks", label: "✅ Tasks" },
	{ id: "deadlines", label: "⚠️ Deadlines" },
	{ id: "projects", label: "🚀 Projects" },
	{ id: "content", label: "🎬 Content" },
	{ id: "footer", label: "📃 Stats vault" },
];

function renderSectionsList(container: HTMLElement, ctx: SettingsContext): void {
	container.empty();

	const visible = ctx.settings.homeVisibleSections;
	container.createEl("div", {
		cls: "umos-settings-inline-note",
		text: `Enabled ${visible.length} of ${ALL_SECTIONS.length} blocks.`,
	});

	const visibleList = container.createDiv({ cls: "umos-settings-list" });
	for (const [index, id] of visible.entries()) {
		const meta = ALL_SECTIONS.find((section) => section.id === id);
		const label = meta?.label ?? id;

		const itemEl = visibleList.createDiv({ cls: "umos-settings-list-item" });
		const bodyEl = itemEl.createDiv({ cls: "umos-settings-list-body" });
		bodyEl.createEl("div", {
			cls: "umos-settings-list-title",
			text: label,
		});
		bodyEl.createEl("div", {
			cls: "umos-settings-list-desc",
			text: `Position in display order: ${index + 1}.`,
		});

		const actionsEl = itemEl.createDiv({ cls: "umos-settings-list-actions" });
		createIconButton(actionsEl, "eye-off", "Hide", async () => {
			ctx.settings.homeVisibleSections = visible.filter((sectionId) => sectionId !== id);
			await ctx.saveSettings();
			renderSectionsList(container, ctx);
		});

		if (index > 0) {
			createIconButton(actionsEl, "arrow-up", "Move up", async () => {
				[visible[index - 1], visible[index]] = [visible[index], visible[index - 1]];
				await ctx.saveSettings();
				renderSectionsList(container, ctx);
			});
		}

		if (index < visible.length - 1) {
			createIconButton(actionsEl, "arrow-down", "Move down", async () => {
				[visible[index], visible[index + 1]] = [visible[index + 1], visible[index]];
				await ctx.saveSettings();
				renderSectionsList(container, ctx);
			});
		}
	}

	const hidden = ALL_SECTIONS.filter((section) => !visible.includes(section.id));
	if (hidden.length > 0) {
		createSubheading(container, "Hidden");
		const hiddenList = container.createDiv({ cls: "umos-settings-list" });
		for (const section of hidden) {
			const itemEl = hiddenList.createDiv({ cls: "umos-settings-list-item is-muted" });
			const bodyEl = itemEl.createDiv({ cls: "umos-settings-list-body" });
			bodyEl.createEl("div", {
				cls: "umos-settings-list-title",
				text: section.label,
			});
			bodyEl.createEl("div", {
				cls: "umos-settings-list-desc",
				text: "Hidden from Home. Restore it with one click.",
			});

			const actionsEl = itemEl.createDiv({ cls: "umos-settings-list-actions" });
			createIconButton(actionsEl, "eye", "Show", async () => {
				ctx.settings.homeVisibleSections.push(section.id);
				await ctx.saveSettings();
				renderSectionsList(container, ctx);
			});
		}
	}
}

export function renderHomeSection(containerEl: HTMLElement, ctx: SettingsContext): void {
	const sectionEl = createSection(
		containerEl,
		"umos-settings-home",
		"Home",
		"Home dashboard setup: folders, section order, and navigation cards."
	);

	createSubheading(sectionEl, "Folders");

	new Setting(sectionEl)
		.setName("Folder projects")
		.addText((text) =>
			text
				.setPlaceholder("20 Projects")
				.setValue(ctx.settings.homeProjectsPath)
				.onChange(async (value) => {
					ctx.settings.homeProjectsPath = value;
					await ctx.saveSettings();
				})
		);

	new Setting(sectionEl)
		.setName("Content Folder")
		.addText((text) =>
			text
				.setPlaceholder("30 Content")
				.setValue(ctx.settings.homeContentPath)
				.onChange(async (value) => {
					ctx.settings.homeContentPath = value;
					await ctx.saveSettings();
				})
		);

	createSubheading(sectionEl, "Mini Schedule");

	new Setting(sectionEl)
		.setName("Advance to Next School Day")
		.setDesc("How many minutes after the last class Home starts showing the next school day.")
		.addSlider((slider) =>
			slider
				.setLimits(0, 180, 5)
				.setValue(ctx.settings.homeScheduleAdvanceDelayMinutes)
				.setDynamicTooltip()
				.onChange(async (value) => {
					ctx.settings.homeScheduleAdvanceDelayMinutes = value;
					await ctx.saveSettings();
				})
		);

	new Setting(sectionEl)
		.setName("Show Past Classes")
		.setDesc("When off, mini schedule keeps only current and upcoming classes for the day.")
		.addToggle((toggle) =>
			toggle
				.setValue(ctx.settings.homeScheduleShowPastLessons)
				.onChange(async (value) => {
					ctx.settings.homeScheduleShowPastLessons = value;
					await ctx.saveSettings();
				})
		);

	createSubheading(sectionEl, "Home Blocks");

	const sectionsContainer = sectionEl.createDiv();
	renderSectionsList(sectionsContainer, ctx);

	createSubheading(sectionEl, "Navigation Cards");

	const navContainer = sectionEl.createDiv();
	renderNavCardsList(navContainer, ctx);
}

function renderNavCardsList(container: HTMLElement, ctx: SettingsContext): void {
	const cards = ctx.settings.homeNavCards;

	renderEditableList(container, cards, {
		getName: (card) => `${card.icon} ${card.name}`,
		getDesc: (card) => `${card.path} • ${card.color}`,
		onEdit: (innerContainer, index) => editNavCard(innerContainer, index, ctx),
		onDelete: async (index) => {
			cards.splice(index, 1);
			await ctx.saveSettings();
		},
		onReorder: async (from, to) => {
			const temp = cards[to];
			cards[to] = cards[from];
			cards[from] = temp;
			await ctx.saveSettings();
		},
		onAdd: async () => {
			cards.push({ name: "New Card", path: "", icon: "📄", color: "#7c3aed" });
			await ctx.saveSettings();
		},
		addLabel: "+ Add Card",
		emptyState: "No cards yet. Add the first Home link.",
	});
}

function editNavCard(container: HTMLElement, index: number, ctx: SettingsContext): void {
	const card = { ...ctx.settings.homeNavCards[index] };
	container.empty();

	const editor = container.createDiv({ cls: "umos-settings-editor" });
	editor.createEl("h4", {
		text: `${card.icon} ${card.name || "Card"}`,
		cls: "umos-settings-editor-title",
	});
	editor.createEl("p", {
		text: "Set the card label, path, icon, and accent color.",
		cls: "umos-settings-editor-desc",
	});

	new Setting(editor)
		.setName("Title")
		.addText((text) =>
			text.setValue(card.name).onChange((value) => {
				card.name = value;
			})
		);

	new Setting(editor)
		.setName("Path")
		.setDesc("Note or folder opened on click.")
		.addText((text) =>
			text.setValue(card.path).onChange((value) => {
				card.path = value;
			})
		);

	new Setting(editor)
		.setName("Icon")
		.setDesc("Emoji and short symbols are supported.")
		.addText((text) =>
			text.setValue(card.icon).onChange((value) => {
				card.icon = value;
			})
		);

	new Setting(editor)
		.setName("Color")
		.setDesc("HEX accent color, for example: #3498db")
		.addText((text) =>
			text.setValue(card.color).onChange((value) => {
				card.color = value;
			})
		);

	renderEditActions(
		editor,
		() => renderNavCardsList(container, ctx),
		async () => {
			ctx.settings.homeNavCards[index] = card;
			await ctx.saveSettings();
			renderNavCardsList(container, ctx);
		}
	);
}
