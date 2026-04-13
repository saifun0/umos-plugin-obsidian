import { App, MarkdownRenderer } from "obsidian";
import { BaseWidget } from "../core/BaseWidget";

export class ColsWidget extends BaseWidget {
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
		let forcedCols: number | null = null;
		let bodyLines = lines;

		// Optional first line: "cols: N"
		if (/^cols\s*:\s*\d+$/i.test(lines[0]?.trim() ?? "")) {
			forcedCols = Math.max(1, parseInt(lines[0].split(":")[1].trim(), 10));
			bodyLines = lines.slice(1);
		}

		// Split by "===" on its own line
		const sections: string[] = [];
		let current: string[] = [];
		for (const line of bodyLines) {
			if (line.trim() === "===") {
				sections.push(current.join("\n"));
				current = [];
			} else {
				current.push(line);
			}
		}
		sections.push(current.join("\n"));

		const colCount = Math.max(1, Math.min(
			forcedCols ?? sections.length,
			sections.length
		));

		const wrapper = this.containerEl.createDiv({ cls: "umos-cols" });
		wrapper.style.setProperty("--umos-cols-count", String(colCount));

		for (const md of sections) {
			const col = wrapper.createDiv({ cls: "umos-cols-col" });
			void MarkdownRenderer.render(
				this.app, md.trim(), col, this.sourcePath, this
			);
		}
	}
}
