import { App, Notice, TFile, TFolder, normalizePath } from "obsidian";
import { UmOSSettings } from "../settings/Settings";
import { QuickCaptureModal } from "./QuickCaptureModal";

/**
 * URI Handler: obsidian://umos/capture?type=task&text=...
 */
export class URIHandler {
	private app: App;
	private settings: UmOSSettings;

	constructor(app: App, settings: UmOSSettings) {
		this.app = app;
		this.settings = settings;
	}

	register(registerFn: (action: string, handler: (params: Record<string, string>) => void) => void): void {
		registerFn("capture", (params) => {
			this.handleCapture(params);
		});
	}

	private handleCapture(params: Record<string, string>): void {
		const type = params.type === "note" ? "note" : "task";
		const text = params.text || "";

		if (text) {
			void this.quickSave(type, text, params.priority || "none");
		} else {
			new QuickCaptureModal(this.app, this.settings, type).open();
		}
	}

	private async quickSave(type: "task" | "note", text: string, priority: string): Promise<void> {
		try {
			const inboxPath = normalizePath(this.settings.captureInboxPath);
			const filePath = normalizePath(`${inboxPath}/inbox.md`);

			await this.ensureFolder(inboxPath);

			let content: string;
			if (type === "task") {
				const priorityMarkers: Record<string, string> = {
					high: " ⏫",
					medium: " 🔼",
					low: " 🔽",
					none: "",
				};
				content = `- [ ] ${text}${priorityMarkers[priority] || ""}`;
			} else {
				content = text;
			}

			const existing = this.app.vault.getAbstractFileByPath(filePath);
			if (existing instanceof TFile) {
				const currentContent = await this.app.vault.read(existing);
				const separator = currentContent.trimEnd().length > 0 ? "\n" : "";
				await this.app.vault.modify(existing, `${currentContent}${separator}${content}`);
			} else {
				await this.app.vault.create(filePath, content);
			}

			new Notice(`✅ ${type === "task" ? "Задача" : "Заметка"} добавлена через URI`);
		} catch (error) {
			console.error("umOS URI Capture:", error);
			new Notice(`❌ Ошибка: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	private async ensureFolder(path: string): Promise<void> {
		const existing = this.app.vault.getAbstractFileByPath(path);
		if (existing instanceof TFolder) return;

		const parts = path.split("/").filter(Boolean);
		let current = "";
		for (const part of parts) {
			current = current ? `${current}/${part}` : part;
			const folder = this.app.vault.getAbstractFileByPath(current);
			if (!folder) {
				await this.app.vault.createFolder(current);
			}
		}
	}
}
