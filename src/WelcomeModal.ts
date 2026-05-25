import { App, Modal, Setting, setIcon } from "obsidian";
import type UmOSPlugin from "./main";
import { t } from "./i18n";
import { UMOS_ICON_ID } from "./branding";

export class WelcomeModal extends Modal {
	constructor(
		app: App,
		private plugin: UmOSPlugin
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		this.modalEl.addClass("umos-welcome-modal");

		contentEl.empty();

		const headerEl = contentEl.createDiv({ cls: "umos-welcome-header" });

		const iconEl = headerEl.createDiv({ cls: "umos-welcome-icon" });
		setIcon(iconEl, UMOS_ICON_ID);

		const titleEl = headerEl.createDiv({ cls: "umos-welcome-title-wrap" });
		titleEl.createEl("h1", { text: t("Welcome to umOS"), cls: "umos-welcome-title" });
		titleEl.createDiv({
			cls: "umos-welcome-subtitle",
			text: `${t("Version")} ${this.plugin.manifest.version} • ${t("By")} ${this.plugin.manifest.author}`
		});

		const bodyEl = contentEl.createDiv({ cls: "umos-welcome-body" });
		bodyEl.createEl("p", {
			text: t("umOS is a comprehensive life management system for Obsidian. It provides dashboards, dynamic frontmatter management, task tracking, and much more.")
		});

		bodyEl.createEl("p", {
			text: t("To get started, we highly recommend reading the Vault Guide to understand how folders and metadata interact.")
		});

		const actionsEl = contentEl.createDiv({ cls: "umos-welcome-actions" });

		new Setting(actionsEl)
			.addButton((btn) =>
				btn
					.setButtonText(t("Read Vault Guide"))
					.setCta()
					.onClick(() => {
						this.close();
						// @ts-ignore — internal Obsidian API
						this.app.setting.open();
						// @ts-ignore
						this.app.setting.openTabById(this.plugin.manifest.id);

						setTimeout(() => {
							const items = document.querySelectorAll(".umos-settings-page-title-setting");
							for (let i = 0; i < items.length; i++) {
								const el = items[i] as HTMLElement;
								if (el.innerText.includes("Vault Guide")) {
									el.click();
									break;
								}
							}
						}, 150);
					})
			)
			.addButton((btn) =>
				btn
					.setButtonText(t("Close"))
					.onClick(() => {
						this.close();
					})
			);
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
