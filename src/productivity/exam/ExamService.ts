import { EventBus } from "../../EventBus";
import { ExamEntry, ExamTopic } from "../../settings/Settings";

export class ExamService {
	private eventBus: EventBus;
	private getExams: () => ExamEntry[];
	private saveExams: (exams: ExamEntry[]) => Promise<void>;

	constructor(
		eventBus: EventBus,
		getExams: () => ExamEntry[],
		saveExams: (exams: ExamEntry[]) => Promise<void>
	) {
		this.eventBus = eventBus;
		this.getExams = getExams;
		this.saveExams = saveExams;
	}

	async addExam(exam: ExamEntry): Promise<void> {
		const exams = this.getExams();
		exams.push(exam);
		await this.saveExams(exams);
		this.eventBus.emit("exam:changed");
	}

	async removeExam(id: string): Promise<void> {
		let exams = this.getExams();
		exams = exams.filter((e) => e.id !== id);
		await this.saveExams(exams);
		this.eventBus.emit("exam:changed");
	}

	async updateExam(id: string, updates: Partial<Omit<ExamEntry, "id">>): Promise<void> {
		const exams = this.getExams();
		const exam = exams.find((e) => e.id === id);
		if (!exam) return;
		if (updates.name !== undefined) exam.name = updates.name;
		if (updates.date !== undefined) exam.date = updates.date;
		if (updates.priority !== undefined) exam.priority = updates.priority;
		if (updates.topics !== undefined) exam.topics = updates.topics;
		await this.saveExams(exams);
		this.eventBus.emit("exam:changed");
	}

	getUpcoming(): ExamEntry[] {
		const today = this.getTodayStr();
		return this.getExams()
			.filter((e) => e.date >= today)
			.sort((a, b) => a.date.localeCompare(b.date));
	}

	getAll(): ExamEntry[] {
		return [...this.getExams()].sort((a, b) => a.date.localeCompare(b.date));
	}

	async addTopic(examId: string, text: string): Promise<void> {
		const exams = this.getExams();
		const exam = exams.find((e) => e.id === examId);
		if (!exam) return;
		const topic: ExamTopic = {
			id: `topic_${Date.now()}`,
			text,
			completed: false,
			day: "",
		};
		exam.topics.push(topic);
		await this.saveExams(exams);
		this.eventBus.emit("exam:changed");
	}

	async toggleTopic(examId: string, topicId: string): Promise<void> {
		const exams = this.getExams();
		const exam = exams.find((e) => e.id === examId);
		if (!exam) return;
		const topic = exam.topics.find((t) => t.id === topicId);
		if (!topic) return;
		topic.completed = !topic.completed;
		await this.saveExams(exams);
		this.eventBus.emit("exam:changed");
	}

	async removeTopic(examId: string, topicId: string): Promise<void> {
		const exams = this.getExams();
		const exam = exams.find((e) => e.id === examId);
		if (!exam) return;
		exam.topics = exam.topics.filter((t) => t.id !== topicId);
		await this.saveExams(exams);
		this.eventBus.emit("exam:changed");
	}

	async distributeTopics(examId: string): Promise<void> {
		const exams = this.getExams();
		const exam = exams.find((e) => e.id === examId);
		if (!exam) return;

		const uncompletedTopics = exam.topics.filter((t) => !t.completed);
		if (uncompletedTopics.length === 0) return;

		const daysUntil = this.getDaysUntil(exam.date);
		if (daysUntil <= 0) return;

		const days = Math.max(1, daysUntil);
		const today = new Date();

		for (let i = 0; i < uncompletedTopics.length; i++) {
			const dayOffset = Math.floor((i * days) / uncompletedTopics.length);
			const targetDate = new Date(today);
			targetDate.setDate(targetDate.getDate() + dayOffset);
			const y = targetDate.getFullYear();
			const m = String(targetDate.getMonth() + 1).padStart(2, "0");
			const d = String(targetDate.getDate()).padStart(2, "0");
			uncompletedTopics[i].day = `${y}-${m}-${d}`;
		}

		await this.saveExams(exams);
		this.eventBus.emit("exam:changed");
	}

	getDaysUntil(date: string): number {
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const target = new Date(date + "T00:00:00");
		return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
	}

	private getTodayStr(): string {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
	}
}
