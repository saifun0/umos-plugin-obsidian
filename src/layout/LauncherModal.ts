import { App, Modal, setIcon, Notice, MarkdownView } from "obsidian";
import type UmOSPlugin from "../main";
import { UMOS_ICON_ID, UMOS_SYNC_ICON_ID } from "../branding";
import { TaskEditorModal } from "../productivity/tasks/TaskEditorModal";
import { Task } from "../productivity/tasks/Task";
import { TaskService } from "../productivity/tasks/TaskService";
import { t } from "../i18n";

interface LauncherAction {
	id: string;
	name: string;
	icon: string;
	action: () => void | Promise<void>;
}

export class LauncherModal extends Modal {
	private actions: LauncherAction[];

	constructor(app: App, private plugin: UmOSPlugin) {
		super(app);

		this.actions = [
			{ id: "home", name: "Home", icon: UMOS_ICON_ID, action: () => this.plugin.activateHomeView() },
			{ id: "calendar", name: "Calendar", icon: "calendar-check", action: () => this.plugin.activateTaskCalendarView() },
			{ id: "gallery", name: "Gallery", icon: "images", action: () => this.plugin.activateImageGalleryView() },
			{ id: "search", name: "Search", icon: "search", action: () => this.plugin.openOmniSearchModal() },
			{ id: "sync", name: "Sync", icon: UMOS_SYNC_ICON_ID, action: () => this.plugin.openSyncCenterModal() },
			{
				id: "add-task", name: t("Add task"), icon: "check-square", action: () => {
					const newTask = new Task('', '', 0);
					newTask.description = '';
					
					const modal = new TaskEditorModal(this.app, newTask, async (task, subtasks) => {
						const taskService = new TaskService(this.app, this.plugin);
						const taskString = taskService.reconstructTaskString(task);
						
						const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
						if (activeView && activeView.editor) {
							const editor = activeView.editor;
							
							let fullString = taskString;
							if (subtasks && subtasks.length > 0) {
								const indentation = task.indentation + 1;
								const spaces = '\t'.repeat(indentation);
								for (const sub of subtasks) {
									fullString += `\n${spaces}- [ ] ${sub}`;
								}
							}
							
							const cursor = editor.getCursor();
							const line = editor.getLine(cursor.line);
							
							if (line.trim() === '') {
								editor.replaceSelection(fullString);
							} else {
								editor.replaceSelection('\n' + fullString);
							}
						} else {
							new Notice(t("No active note to insert task"));
						}
					}, undefined, this.plugin);
					modal.open();
				}
			},
			{
				id: "daily", name: "Daily Note", icon: "calendar", action: async () => {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const enhancer = (this.plugin as any).dailyNoteEnhancer;
					if (enhancer) {
						await enhancer.createDailyNote();
					} else {
						new Notice("❌ DailyNoteEnhancer is not initialized");
					}
				}
			},
		];
	}

	onOpen(): void {
		this.modalEl.addClass("umos-launcher-modal");
		this.contentEl.empty();

		this.contentEl.createEl("div", { text: "umOS Menu", cls: "umos-launcher-title" });

		const grid = this.contentEl.createDiv({ cls: "umos-launcher-grid" });

		for (const action of this.actions) {
			const btn = grid.createDiv({ cls: "umos-launcher-btn" });
			
			const iconWrap = btn.createDiv({ cls: "umos-launcher-icon" });
			setIcon(iconWrap, action.icon);
			
			btn.createDiv({ cls: "umos-launcher-label", text: action.name });

			btn.addEventListener("click", () => {
				this.close();
				void action.action();
			});
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
