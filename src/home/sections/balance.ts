import { HomeViewContext } from "../types";
import { createElement } from "../../utils/dom";

export function renderBalanceSection(parent: HTMLElement, ctx: HomeViewContext): void {
	if (!ctx.balanceService) return;

	const svc      = ctx.balanceService;
	const balance  = svc.getBalance();
	const earned   = svc.getTodayEarned();
	const spent    = svc.getTodaySpent();
	const settings = svc.getPluginSettings();

	const fmt = (m: number) => {
		const h   = Math.floor(m / 60);
		const min = m % 60;
		if (h === 0) return `${min}м`;
		if (min === 0) return `${h}ч`;
		return `${h}ч ${min}м`;
	};

	const section = createElement("div", {
		cls: "umos-home-section umos-home-section-anim",
		parent,
	});

	// Nav-style card
	const card = createElement("div", {
		cls: "umos-home-balance-nav-card",
		parent: section,
	});

	const levelColor =
		balance >= 60 ? "#27ae60" :
		balance >= 20 ? "#f39c12" : "#e74c3c";
	card.style.setProperty("--balance-color", levelColor);

	// Left column — icon + label
	const left = createElement("div", { cls: "umos-home-balance-nav-left", parent: card });
	createElement("span", { cls: "umos-home-balance-nav-icon", text: "⚖️", parent: left });
	createElement("span", { cls: "umos-home-balance-nav-title", text: "Баланс", parent: left });

	// Center — big balance number
	const center = createElement("div", { cls: "umos-home-balance-nav-center", parent: card });
	createElement("div", { cls: "umos-home-balance-nav-amount", text: fmt(balance), parent: center });

	// Progress bar
	if (settings.balanceMaxTotal > 0) {
		const pct   = Math.min(100, (balance / settings.balanceMaxTotal) * 100);
		const track = createElement("div", { cls: "umos-home-balance-nav-bar", parent: center });
		const fill  = createElement("div", { cls: "umos-home-balance-nav-bar-fill", parent: track });
		fill.style.width = `${pct.toFixed(1)}%`;
	}

	// Right column — today stats + bonus badge
	const right = createElement("div", { cls: "umos-home-balance-nav-right", parent: card });
	createElement("span", { cls: "umos-home-balance-nav-earn",  text: `+${fmt(earned)}`, parent: right });
	createElement("span", { cls: "umos-home-balance-nav-spend", text: `-${fmt(spent)}`,  parent: right });

	if (svc.hasDailyBonus()) {
		createElement("span", {
			cls: "umos-home-balance-nav-bonus",
			text: `🎁 +${fmt(settings.balanceDailyBonus)}`,
			parent: right,
		});
	}

	// Click → open Balance dashboard
	card.addEventListener("click", () => {
		ctx.app.workspace.openLinkText("05 Dashboards/Balance", "", false);
	});
}
