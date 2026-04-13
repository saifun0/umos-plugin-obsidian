import { HomeViewContext } from "../types";
import { createElement } from "../../utils/dom";

export function renderExamsSection(parent: HTMLElement, ctx: HomeViewContext): void {
	if (!ctx.examService) return;

	const upcoming = ctx.examService.getUpcoming().slice(0, 3);
	if (upcoming.length === 0) return;

	const section = createElement("div", {
		cls: "umos-home-section umos-home-section-anim",
		parent,
	});

	createElement("div", {
		cls: "umos-home-section-title",
		text: "📝 Ближайшие экзамены",
		parent: section,
	});

	for (const exam of upcoming) {
		const daysUntil = ctx.examService.getDaysUntil(exam.date);
		const completedTopics = exam.topics.filter((t) => t.completed).length;
		const totalTopics = exam.topics.length;
		const progressPct = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

		const priorityIcons: Record<string, string> = { high: "🔴", medium: "🟠", low: "🟢" };

		const card = createElement("div", {
			cls: "umos-home-exam-card",
			parent: section,
		});

		const headerRow = createElement("div", {
			cls: "umos-home-exam-header",
			parent: card,
		});

		createElement("span", {
			text: `${priorityIcons[exam.priority] || "⚪"} ${exam.name}`,
			parent: headerRow,
		});

		const daysText = daysUntil === 0 ? "Сегодня!" : daysUntil === 1 ? "Завтра" : `${daysUntil} дн.`;
		createElement("span", {
			cls: daysUntil <= 3 ? "umos-home-exam-days umos-home-exam-days--urgent" : "umos-home-exam-days",
			text: daysText,
			parent: headerRow,
		});

		if (totalTopics > 0) {
			const progressRow = createElement("div", { cls: "umos-home-exam-progress-row", parent: card });
			const bar = createElement("div", { cls: "umos-home-exam-progress-bar", parent: progressRow });
			const fill = createElement("div", { cls: "umos-home-exam-progress-fill", parent: bar });
			fill.style.width = `${progressPct}%`;
			createElement("span", {
				cls: "umos-home-exam-progress-text",
				text: `${completedTopics}/${totalTopics}`,
				parent: progressRow,
			});
		}
	}
}
