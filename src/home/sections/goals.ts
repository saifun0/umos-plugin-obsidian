import { HomeViewContext } from "../types";
import { createElement } from "../../utils/dom";
import { renderGoalsList } from "../../productivity/goals/GoalsRenderer";

export function renderGoalsSection(parent: HTMLElement, ctx: HomeViewContext): void {
	if (!ctx.goalsService) return;

	const section = createElement("div", {
		cls: "umos-home-section umos-home-section-anim",
		parent,
	});

	createElement("div", {
		cls: "umos-home-section-title",
		text: "🎯 Цели",
		parent: section,
	});

	const widgetContainer = createElement("div", {
		cls: "umos-widget-container",
		parent: section,
	});

	const goals = ctx.goalsService.getGoals(["not-started", "in-progress"]);

	if (goals.length === 0) {
		createElement("div", {
			cls: "umos-home-empty",
			text: "Нет активных целей",
			parent: widgetContainer,
		});
		return;
	}

	renderGoalsList(widgetContainer, goals, { compact: true, showActions: false });
}
