import { App, Modal, Setting } from "obsidian";
import { UmOSData, ScheduleSlot } from "../../settings/Settings";
import {
	WEEKDAYS,
	WEEKDAY_LABELS_RU,
	getSlotsForDay,
	setSlot,
	createEmptySlot,
} from "./ScheduleData";
import { EventBus } from "../../EventBus";

export class ScheduleEditor extends Modal {
	private data: UmOSData;
	private eventBus: EventBus;
	private saveCallback: () => Promise<void>;
	private activeWeek: "week1" | "week2" = "week1";

	constructor(
		app: App,
		data: UmOSData,
		eventBus: EventBus,
		saveCallback: () => Promise<void>
	) {
		super(app);
		this.data = data;
		this.eventBus = eventBus;
		this.saveCallback = saveCallback;
	}

	onOpen(): void {
		this.modalEl.classList.add("umos-schedule-editor-modal");
		this.render();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: "📅 Schedule Editor" });

		//  week1/week2
		const tabs = contentEl.createDiv({ cls: "umos-schedule-tabs" });

		const tab1 = tabs.createEl("button", {
			text: "Week 1",
			cls: `umos-schedule-tab ${this.activeWeek === "week1" ? "umos-schedule-tab-active" : ""}`,
		});
		tab1.addEventListener("click", () => {
			this.activeWeek = "week1";
			this.render();
		});

		const tab2 = tabs.createEl("button", {
			text: "Week 2",
			cls: `umos-schedule-tab ${this.activeWeek === "week2" ? "umos-schedule-tab-active" : ""}`,
		});
		tab2.addEventListener("click", () => {
			this.activeWeek = "week2";
			this.render();
		});

		//
		const tableContainer = contentEl.createDiv({ cls: "umos-schedule-table-container" });
		this.renderTable(tableContainer);
	}

	private renderTable(container: HTMLElement): void {
		const slotsCount = this.data.settings.scheduleSlotsPerDay;

		const table = container.createDiv({ cls: "umos-schedule-grid" });

		// Title: "№" +
		const headerRow = table.createDiv({ cls: "umos-schedule-row umos-schedule-header-row" });
		headerRow.createDiv({ cls: "umos-schedule-cell umos-schedule-time-header", text: "№" });

		for (const day of WEEKDAYS) {
			headerRow.createDiv({
				cls: "umos-schedule-cell umos-schedule-day-header",
				text: WEEKDAY_LABELS_RU[day],
			});
		}

		const firstSlotNum = this.data.settings.scheduleFirstSlotNumber ?? 1;

		//
		for (let slotIdx = 0; slotIdx < slotsCount; slotIdx++) {
			const row = table.createDiv({ cls: "umos-schedule-row" });

			//   classes
			const timeCell = row.createDiv({ cls: "umos-schedule-cell umos-schedule-time-cell" });
			timeCell.createDiv({ cls: "umos-schedule-slot-number", text: `${firstSlotNum + slotIdx}` });

			//  days
			for (const day of WEEKDAYS) {
				const slots = getSlotsForDay(this.data, this.activeWeek, day);
				const slot = slots[slotIdx];
				const hasContent = slot && slot.subject && slot.subject.trim() !== "";

				const cell = row.createDiv({
					cls: `umos-schedule-cell umos-schedule-slot-cell ${hasContent ? "umos-schedule-slot-filled" : "umos-schedule-slot-empty"}`,
				});

				if (hasContent && slot) {
					cell.createDiv({ cls: "umos-schedule-slot-subject", text: slot.subject });
					if (slot.startTime && slot.endTime) {
						cell.createDiv({
							cls: "umos-schedule-slot-time-display",
							text: `${slot.startTime}–${slot.endTime}`,
						});
					}
					if (slot.room) {
						cell.createDiv({ cls: "umos-schedule-slot-room", text: `📍 ${slot.room}` });
					}
					if (slot.teacher) {
						cell.createDiv({ cls: "umos-schedule-slot-teacher", text: slot.teacher });
					}
				} else {
					cell.createDiv({ cls: "umos-schedule-slot-placeholder", text: "+" });
				}

				cell.addEventListener("click", () => {
					this.openSlotEditor(day, slotIdx);
				});
			}
		}
	}

	private openSlotEditor(day: string, slotIndex: number): void {
		const { contentEl } = this;
		contentEl.empty();

		const slots = getSlotsForDay(this.data, this.activeWeek, day);
		const existingSlot = slots[slotIndex];

		const slot: ScheduleSlot = existingSlot && existingSlot.subject
			? { ...existingSlot }
			: createEmptySlot();

		const firstSlotNum = this.data.settings.scheduleFirstSlotNumber ?? 1;
		contentEl.createEl("h2", {
			text: `✏️ ${WEEKDAY_LABELS_RU[day]} — Class ${firstSlotNum + slotIndex}`,
		});

		new Setting(contentEl)
			.setName("Subject")
			.addText((text) =>
				text
					.setPlaceholder("Mathematical Analysis")
					.setValue(slot.subject)
					.onChange((v) => { slot.subject = v; })
			);

		new Setting(contentEl)
			.setName("Teacher")
			.addText((text) =>
				text
					.setPlaceholder("Ivanov I.I.")
					.setValue(slot.teacher)
					.onChange((v) => { slot.teacher = v; })
			);

		new Setting(contentEl)
			.setName("Room")
			.addText((text) =>
				text
					.setPlaceholder("A-301")
					.setValue(slot.room)
					.onChange((v) => { slot.room = v; })
			);

		new Setting(contentEl)
			.setName("Start time")
			.setDesc("HH:MM format (for example, 08:30)")
			.addText((text) =>
				text
					.setPlaceholder("08:30")
					.setValue(slot.startTime)
					.onChange((v) => { slot.startTime = v; })
			);

		new Setting(contentEl)
			.setName("End time")
			.setDesc("HH:MM format (for example, 10:00)")
			.addText((text) =>
				text
					.setPlaceholder("10:00")
					.setValue(slot.endTime)
					.onChange((v) => { slot.endTime = v; })
			);

		const typeOptions: Record<string, string> = {
			lecture: "📖 Lecture",
			seminar: "💬 Seminar",
			lab: "🔬 Lab",
			practice: "✏️ Practice",
			exam: "📝 Exam",
		};

		new Setting(contentEl)
			.setName("Class type")
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(typeOptions)
					.setValue(slot.type)
					.onChange((v) => {
						slot.type = v as ScheduleSlot["type"];
					})
			);

		//
		const btnRow = contentEl.createDiv({ cls: "umos-schedule-btn-row" });

		const backBtn = btnRow.createEl("button", { text: "← Back" });
		backBtn.addEventListener("click", () => { this.render(); });

		const clearBtn = btnRow.createEl("button", { text: "🗑️ Clear", cls: "mod-warning" });
		clearBtn.addEventListener("click", async () => {
			setSlot(this.data, this.activeWeek, day, slotIndex, null);
			await this.saveCallback();
			this.eventBus.emit("schedule:changed");
			this.render();
		});

		const saveBtn = btnRow.createEl("button", { text: "💾 Save", cls: "mod-cta" });
		saveBtn.addEventListener("click", async () => {
			setSlot(this.data, this.activeWeek, day, slotIndex, slot);
			await this.saveCallback();
			this.eventBus.emit("schedule:changed");
			this.render();
		});
	}
}