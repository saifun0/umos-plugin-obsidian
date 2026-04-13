import { App, MarkdownRenderer } from "obsidian";
import { BaseWidget } from "../core/BaseWidget";

export class InfoboxWidget extends BaseWidget {
	private source: string;
	private sourcePath: string;

	constructor(
		containerEl: HTMLElement,
		private app: App,
		source: string,
		sourcePath: string
	) {
		super(containerEl);
		this.source = source;
		this.sourcePath = sourcePath;
	}

	protected render(): void {
		this.containerEl.empty();

		const lines = this.source.split("\n");

		// ── Parse metadata (before "---") ────────────────────────────
		let meta: Record<string, string> = {};
		let dataLines: string[] = lines;

		const sepIdx = lines.findIndex(l => l.trim() === "---");
		if (sepIdx !== -1) {
			const metaLines = lines.slice(0, sepIdx);
			dataLines       = lines.slice(sepIdx + 1);
			for (const line of metaLines) {
				const colon = line.indexOf(":");
				if (colon === -1) continue;
				const key = line.slice(0, colon).trim().toLowerCase();
				const val = line.slice(colon + 1).trim();
				meta[key] = val;
			}
		}

		// Нулевой float-якорь: занимает 0px в потоке,
		// но float: right ставит его у правого края контентной колонки.
		// Инфобокс — абсолютно внутри якоря, left = зазор.
		const anchor = this.containerEl.createDiv({ cls: "umos-infobox-anchor" });
		const box    = anchor.createDiv({ cls: "umos-infobox" });

		if (meta.title) {
			box.createDiv({ cls: "umos-infobox-title", text: meta.title });
		}

		if (meta.image) {
			const imgWrap = box.createDiv({ cls: "umos-infobox-image" });
			const img = imgWrap.createEl("img");
			if (/^https?:\/\//i.test(meta.image)) {
				img.src = meta.image;
			} else {
				const file = this.app.vault.getAbstractFileByPath(meta.image);
				if (file) {
					img.src = this.app.vault.getResourcePath(
						file as Parameters<typeof this.app.vault.getResourcePath>[0]
					);
				} else {
					img.src = meta.image;
				}
			}
			if (meta.caption) {
				imgWrap.createDiv({ cls: "umos-infobox-caption", text: meta.caption });
			}
		}

		const table = box.createEl("table", { cls: "umos-infobox-table" });
		const tbody = table.createEl("tbody");

		for (const raw of dataLines) {
			const line = raw.trimEnd();
			if (!line.trim()) continue;
			const pipeIdx = line.indexOf("|");
			if (pipeIdx === -1) {
				const tr = tbody.createEl("tr", { cls: "umos-infobox-section" });
				tr.createEl("th", { attr: { colspan: "2" }, text: line.trim() });
			} else {
				const key = line.slice(0, pipeIdx).trim();
				const val = line.slice(pipeIdx + 1).trim();
				const tr  = tbody.createEl("tr");
				tr.createEl("th", { text: key });
				const td  = tr.createEl("td");
				void MarkdownRenderer.render(this.app, val, td, this.sourcePath, this);
			}
		}
	}
}
