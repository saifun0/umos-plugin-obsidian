import { App, Modal, setIcon } from "obsidian";
import { t } from "../i18n";
import { createCodeLanguageIconElement, getCodeLanguageIconGalleryItems } from "./CodeBlockStyler";

export class CodeIconGalleryModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen(): void {
		this.modalEl.addClass("umos-code-icon-gallery-modal");
		this.contentEl.empty();
		this.contentEl.addClass("umos-code-icon-gallery-content");

		const shell = this.contentEl.createDiv({ cls: "umos-code-icon-gallery" });
		const header = shell.createDiv({ cls: "umos-code-icon-gallery-header" });
		const icon = header.createDiv({ cls: "umos-code-icon-gallery-header-icon" });
		setIcon(icon, "code-2");
		const copy = header.createDiv({ cls: "umos-code-icon-gallery-header-copy" });
		copy.createEl("h2", { cls: "umos-code-icon-gallery-title", text: t("Code Icon Gallery") });
		copy.createDiv({
			cls: "umos-code-icon-gallery-subtitle",
			text: t("Bundled SVG icons used by umOS code block headers."),
		});

		const grid = shell.createDiv({ cls: "umos-code-icon-gallery-grid" });
		for (const item of getCodeLanguageIconGalleryItems()) {
			const card = grid.createDiv({ cls: "umos-code-icon-gallery-card" });
			card.style.setProperty("--umos-code-accent", item.color);
			const iconWrap = card.createDiv({ cls: "umos-code-icon-gallery-card-icon" });
			iconWrap.appendChild(createCodeLanguageIconElement(item.language));

			const body = card.createDiv({ cls: "umos-code-icon-gallery-card-body" });
			body.createDiv({ cls: "umos-code-icon-gallery-card-title", text: t(item.label) });
			body.createDiv({ cls: "umos-code-icon-gallery-card-lang", text: `\`\`\`${item.language}` });

			const badge = card.createSpan({
				cls: `umos-code-icon-gallery-badge ${item.hasSvg ? "is-svg" : "is-fallback"}`,
				text: item.hasSvg ? t("SVG icon") : t("Fallback"),
			});
			badge.setAttr("aria-label", item.hasSvg ? t("SVG icon") : t("Fallback"));
		}
	}

	onClose(): void {
		this.modalEl.removeClass("umos-code-icon-gallery-modal");
		this.contentEl.removeClass("umos-code-icon-gallery-content");
		this.contentEl.empty();
	}
}
