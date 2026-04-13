import { App } from "obsidian";
import { EventBus } from "../../EventBus";
import { BaseWidget, EventSubscription } from "../../core/BaseWidget";
import { ExamService } from "./ExamService";
import { ExamModal } from "./ExamModal";
import { ExamEntry } from "../../settings/Settings";
import { createElement } from "../../utils/dom";

export interface ExamWidgetConfig {
	show: "upcoming" | "all";
	style: "full" | "compact";
}

export class ExamWidget extends BaseWidget {
	private obsidianApp: App;
	protected eventBus: EventBus;
	private examService: ExamService;
	private config: ExamWidgetConfig;
	private expandedExams: Set<string> = new Set();

	constructor(
		containerEl: HTMLElement,
		config: ExamWidgetConfig,
		app: App,
		eventBus: EventBus,
		examService: ExamService
	) {
		super(containerEl);
		this.obsidianApp = app;
		this.eventBus = eventBus;
		this.examService = examService;
		this.config = config;
	}

	protected subscribeToEvents(): EventSubscription[] {
		return [{ event: "exam:changed", handler: () => this.render() }];
	}

	protected render(): void {
		this.containerEl.empty();

		const wrapper = createElement("div", {
			cls: "umos-exam-widget",
			parent: this.containerEl,
		});

		// Header
		const header = createElement("div", {
			cls: "umos-exam-header",
			parent: wrapper,
		});

		createElement("div", {
			cls: "umos-exam-title",
			text: "📝 Экзамены",
			parent: header,
		});

		const addBtn = createElement("button", {
			cls: "umos-exam-add-btn",
			text: "+",
			parent: header,
		});
		addBtn.addEventListener("click", () => {
			new ExamModal(this.obsidianApp, async (exam) => {
				await this.examService.addExam(exam);
			}).open();
		});

		// Exam list
		const exams = this.config.show === "upcoming"
			? this.examService.getUpcoming()
			: this.examService.getAll();

		if (exams.length === 0) {
			createElement("div", {
				cls: "umos-exam-empty",
				text: "Нет экзаменов",
				parent: wrapper,
			});
			return;
		}

		for (const exam of exams) {
			this.renderExamCard(wrapper, exam);
		}
	}

	private renderExamCard(parent: HTMLElement, exam: ExamEntry): void {
		const priorityColors: Record<string, string> = {
			high: "var(--umos-danger)",
			medium: "var(--umos-warning)",
			low: "var(--umos-success)",
		};

		const priorityLabels: Record<string, string> = {
			high: "Высокий",
			medium: "Средний",
			low: "Низкий",
		};

		const daysUntil = this.examService.getDaysUntil(exam.date);
		const completedTopics = exam.topics.filter((t) => t.completed).length;
		const totalTopics = exam.topics.length;
		const progressPct = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

		const card = createElement("div", {
			cls: `umos-exam-card umos-exam-card--${exam.priority}`,
			parent,
		});
		card.style.setProperty("--umos-exam-priority-color", priorityColors[exam.priority] || "var(--umos-muted)");

		// Card header
		const cardHeader = createElement("div", {
			cls: "umos-exam-card-header",
			parent: card,
		});

		const nameRow = createElement("div", {
			cls: "umos-exam-card-name-row",
			parent: cardHeader,
		});

		createElement("span", {
			cls: "umos-exam-card-name",
			text: exam.name,
			parent: nameRow,
		});

		createElement("span", {
			cls: `umos-exam-priority-badge umos-exam-priority-badge--${exam.priority}`,
			text: priorityLabels[exam.priority] || exam.priority,
			parent: nameRow,
		});

		const metaRow = createElement("div", {
			cls: "umos-exam-card-meta",
			parent: cardHeader,
		});

		createElement("span", {
			cls: "umos-exam-card-date",
			text: `📅 ${exam.date}`,
			parent: metaRow,
		});

		const daysText = daysUntil === 0 ? "Сегодня!" : daysUntil === 1 ? "Завтра" : daysUntil < 0 ? "Прошёл" : `${daysUntil} дн.`;
		const countdownCls = daysUntil <= 3 && daysUntil >= 0 ? "umos-exam-countdown umos-exam-countdown--urgent" : "umos-exam-countdown";
		createElement("span", {
			cls: countdownCls,
			text: daysText,
			parent: metaRow,
		});

		// Заметки (если есть)
		if (exam.notes) {
			createElement("div", {
				cls: "umos-exam-notes",
				text: exam.notes,
				parent: card,
			});
		}

		// Оценка — показываем только после даты экзамена
		if (daysUntil < 0 && exam.score !== undefined) {
			const scoreEl = createElement("div", {
				cls: "umos-exam-score",
				parent: card,
			});
			createElement("span", { cls: "umos-exam-score-label", text: "Оценка: ", parent: scoreEl });
			createElement("span", {
				cls: `umos-exam-score-value${exam.score >= 75 ? " umos-exam-score--good" : exam.score >= 50 ? " umos-exam-score--mid" : " umos-exam-score--low"}`,
				text: `${exam.score}/100`,
				parent: scoreEl,
			});
		} else if (daysUntil < 0 && exam.score === undefined) {
			createElement("div", {
				cls: "umos-exam-score umos-exam-score--empty",
				text: "Оценка не указана",
				parent: card,
			});
		}

		// Progress bar
		if (totalTopics > 0) {
			const progressRow = createElement("div", {
				cls: "umos-exam-progress",
				parent: card,
			});
			const bar = createElement("div", {
				cls: "umos-exam-progress-bar",
				parent: progressRow,
			});
			const fill = createElement("div", {
				cls: "umos-exam-progress-fill",
				parent: bar,
			});
			fill.style.width = `${progressPct}%`;
			createElement("span", {
				cls: "umos-exam-progress-text",
				text: `${completedTopics}/${totalTopics} тем (${progressPct}%)`,
				parent: progressRow,
			});
		}

		// Expand/collapse toggle
		const isExpanded = this.expandedExams.has(exam.id);

		if (this.config.style === "full") {
			const toggleBtn = createElement("button", {
				cls: "umos-exam-toggle-btn",
				text: isExpanded ? "▲ Скрыть темы" : "▼ Показать темы",
				parent: card,
			});
			toggleBtn.addEventListener("click", () => {
				if (this.expandedExams.has(exam.id)) {
					this.expandedExams.delete(exam.id);
				} else {
					this.expandedExams.add(exam.id);
				}
				this.render();
			});

			if (isExpanded) {
				this.renderTopics(card, exam);
			}

			// Action buttons
			const actions = createElement("div", {
				cls: "umos-exam-actions",
				parent: card,
			});

			const distBtn = createElement("button", {
				cls: "umos-exam-btn",
				text: "📊 Распределить",
				parent: actions,
			});
			distBtn.addEventListener("click", async () => {
				await this.examService.distributeTopics(exam.id);
			});

			const editBtn = createElement("button", {
				cls: "umos-exam-btn",
				text: "✏️ Редактировать",
				parent: actions,
			});
			editBtn.addEventListener("click", () => {
				new ExamModal(this.obsidianApp, async (updated) => {
					await this.examService.updateExam(exam.id, updated);
				}, exam).open();
			});

			const deleteBtn = createElement("button", {
				cls: "umos-exam-btn umos-exam-btn--danger",
				text: "🗑️ Удалить",
				parent: actions,
			});
			deleteBtn.addEventListener("click", async () => {
				await this.examService.removeExam(exam.id);
			});
		}
	}

	private renderTopics(parent: HTMLElement, exam: ExamEntry): void {
		const topicsContainer = createElement("div", {
			cls: "umos-exam-topics",
			parent,
		});

		for (const topic of exam.topics) {
			const topicRow = createElement("div", {
				cls: `umos-exam-topic${topic.completed ? " umos-exam-topic--done" : ""}`,
				parent: topicsContainer,
			});

			const checkbox = createElement("input", {
				attr: { type: "checkbox" },
				cls: "umos-exam-topic-checkbox",
				parent: topicRow,
			}) as HTMLInputElement;
			checkbox.checked = topic.completed;
			checkbox.addEventListener("change", async () => {
				await this.examService.toggleTopic(exam.id, topic.id);
			});

			createElement("span", {
				cls: "umos-exam-topic-text",
				text: topic.text,
				parent: topicRow,
			});

			if (topic.day) {
				createElement("span", {
					cls: "umos-exam-topic-day",
					text: topic.day,
					parent: topicRow,
				});
			}

			const removeBtn = createElement("button", {
				cls: "umos-exam-topic-remove",
				text: "×",
				parent: topicRow,
			});
			removeBtn.addEventListener("click", async () => {
				await this.examService.removeTopic(exam.id, topic.id);
			});
		}

		// Add topic input
		const addRow = createElement("div", {
			cls: "umos-exam-add-topic",
			parent: topicsContainer,
		});

		const input = createElement("input", {
			cls: "umos-exam-add-topic-input",
			attr: { type: "text", placeholder: "Новая тема..." },
			parent: addRow,
		}) as HTMLInputElement;

		const addTopicBtn = createElement("button", {
			cls: "umos-exam-btn",
			text: "+ Добавить",
			parent: addRow,
		});

		const doAdd = async () => {
			const text = input.value.trim();
			if (!text) return;
			await this.examService.addTopic(exam.id, text);
			input.value = "";
		};

		addTopicBtn.addEventListener("click", doAdd);
		input.addEventListener("keydown", (e) => {
			if (e.key === "Enter") doAdd();
		});
	}
}
