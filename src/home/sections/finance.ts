import { HomeViewContext } from "../types";
import { createElement } from "../../utils/dom";

export function renderFinanceSection(parent: HTMLElement, ctx: HomeViewContext): void {
	if (!ctx.financeService) return;

	const section = createElement("div", { cls: "umos-home-section umos-home-section-anim", parent });
	const titleRow = createElement("div", { cls: "umos-home-section-title", parent: section });
	titleRow.textContent = "💰 Финансы";

	const balance = ctx.financeService.getBalance();
	const stats = ctx.financeService.getCurrentMonthStats();
	const currency = ctx.settings.financeCurrency || "₽";
	const fmt = (n: number) => Math.abs(n).toLocaleString("ru-RU");

	// Balance hero (compact)
	const balCard = createElement("div", { cls: "umos-home-finance-hero", parent: section });
	createElement("div", { cls: "umos-home-finance-hero-label", text: "Текущий баланс", parent: balCard });
	createElement("div", {
		cls: `umos-home-finance-hero-value${balance < 0 ? " umos-fc-negative" : ""}`,
		text: `${balance < 0 ? "-" : ""}${fmt(balance)}${currency}`,
		parent: balCard,
	});

	// Monthly strip
	const strip = createElement("div", { cls: "umos-home-finance-strip", parent: section });
	const net = stats.income - stats.spent;

	const makeChip = (label: string, val: string, cls: string) => {
		const chip = createElement("div", { cls: `umos-home-finance-chip ${cls}`, parent: strip });
		createElement("span", { cls: "umos-home-finance-chip-label", text: label, parent: chip });
		createElement("span", { cls: "umos-home-finance-chip-val", text: val, parent: chip });
	};
	makeChip("Доходы", `+${fmt(stats.income)}${currency}`, "umos-fc-income");
	makeChip("Расходы", `-${fmt(stats.spent)}${currency}`, "umos-fc-expense");
	makeChip("Итог", `${net >= 0 ? "+" : "-"}${fmt(net)}${currency}`, net >= 0 ? "umos-fc-income" : "umos-fc-expense");

	// Last 3 transactions
	const recent = [...stats.transactions]
		.sort((a, b) => b.date.localeCompare(a.date))
		.slice(0, 3);

	if (recent.length > 0) {
		const list = createElement("div", { cls: "umos-home-finance-tx-list", parent: section });
		for (const tx of recent) {
			const cat = ctx.settings.financeCategories.find(c => c.id === tx.categoryId);
			const isIncome = tx.type === "income";

			const row = createElement("div", { cls: "umos-finance-tx-row", parent: list });
			const icon = createElement("div", { cls: "umos-finance-tx-icon", parent: row });
			icon.textContent = cat?.icon ?? "❓";
			icon.style.background = (cat?.color ?? "#95a5a6") + "22";

			const info = createElement("div", { cls: "umos-finance-tx-info", parent: row });
			createElement("span", { cls: "umos-finance-tx-name", text: cat?.name ?? "Прочее", parent: info });

			createElement("span", {
				cls: `umos-finance-tx-amount ${isIncome ? "umos-fc-income" : "umos-fc-expense"}`,
				text: `${isIncome ? "+" : "-"}${fmt(tx.amount)}${currency}`,
				parent: row,
			});
		}
	}
}
