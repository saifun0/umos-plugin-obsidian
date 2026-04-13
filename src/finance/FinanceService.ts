import { EventBus } from "../EventBus";
import { UmOSSettings, FinanceTransaction, FinanceMonthlyBudget, FinanceCategory, FinanceRecurring } from "../settings/Settings";

export interface FinanceStats {
	currentMonth: string;
	spent: number;
	income: number;
	transactions: FinanceTransaction[];
	categoryBreakdown: Record<string, { amount: number; percentage: number; name: string; icon: string; color: string }>;
}

export interface UpcomingPayment {
	recurring: FinanceRecurring;
	daysUntil: number;
	categoryName: string;
	categoryIcon: string;
	categoryColor: string;
}

type FinanceData = {
	balance: number;
	transactions: FinanceTransaction[];
	monthlyBudgets: FinanceMonthlyBudget[];
	recurringPayments: FinanceRecurring[];
};

export class FinanceService {
	private eventBus: EventBus;
	private settings: UmOSSettings;
	private getData: () => FinanceData;
	private saveData: (data: Partial<FinanceData>) => Promise<void>;

	constructor(
		eventBus: EventBus,
		settings: UmOSSettings,
		getData: () => FinanceData,
		saveData: (data: Partial<FinanceData>) => Promise<void>
	) {
		this.eventBus = eventBus;
		this.settings = settings;
		this.getData = getData;
		this.saveData = saveData;
	}

	// ── Balance ──────────────────────────────────────────────────────────

	getBalance(): number {
		return this.getData().balance ?? 0;
	}

	setBalance(amount: number): void {
		void this.saveData({ balance: amount });
		this.eventBus.emit("finance:balance-updated", { balance: amount });
	}

	// ── Transactions ─────────────────────────────────────────────────────

	addTransaction(type: "income" | "expense", amount: number, categoryId: string, description: string): void {
		const data = this.getData();
		const today = this.getTodayStr();

		const transaction: FinanceTransaction = {
			id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
			date: today,
			type,
			amount,
			categoryId,
			description,
		};

		data.transactions.push(transaction);

		const oldBalance = data.balance ?? 0;
		const newBalance = type === "income" ? oldBalance + amount : oldBalance - amount;
		data.balance = newBalance;

		void this.saveData({ transactions: data.transactions, balance: newBalance });
		this.eventBus.emit("finance:transaction-added", { transaction });
	}

	deleteTransaction(transactionId: string): void {
		const data = this.getData();
		const tx = data.transactions.find(t => t.id === transactionId);
		if (!tx) return;

		const oldBalance = data.balance ?? 0;
		// Reverse: if it was an expense, add it back; if income, subtract
		const newBalance = tx.type === "expense" ? oldBalance + tx.amount : oldBalance - tx.amount;
		data.balance = newBalance;

		data.transactions = data.transactions.filter(t => t.id !== transactionId);

		void this.saveData({ transactions: data.transactions, balance: newBalance });
		this.eventBus.emit("finance:transaction-deleted", { transactionId });
	}

	updateTransaction(transactionId: string, updates: { type?: "income" | "expense"; amount?: number; categoryId?: string; description?: string }): void {
		const data = this.getData();
		const idx = data.transactions.findIndex(t => t.id === transactionId);
		if (idx < 0) return;

		const tx = data.transactions[idx];

		// Reverse old balance impact
		let balance = data.balance ?? 0;
		balance = tx.type === "expense" ? balance + tx.amount : balance - tx.amount;

		// Apply updates
		if (updates.type !== undefined) tx.type = updates.type;
		if (updates.amount !== undefined) tx.amount = updates.amount;
		if (updates.categoryId !== undefined) tx.categoryId = updates.categoryId;
		if (updates.description !== undefined) tx.description = updates.description;

		// Apply new balance impact
		balance = tx.type === "expense" ? balance - tx.amount : balance + tx.amount;
		data.balance = balance;

		void this.saveData({ transactions: data.transactions, balance });
		this.eventBus.emit("finance:transaction-updated", { transaction: tx });
	}

	// ── Stats ─────────────────────────────────────────────────────────────

	getCurrentMonthStats(): FinanceStats {
		return this.getMonthStats(this.getCurrentMonthStr());
	}

	getMonthStats(month: string): FinanceStats {
		const data = this.getData();
		const allMonth = data.transactions.filter(t => t.date.startsWith(month));
		const expenses = allMonth.filter(t => t.type === "expense");
		const incomes = allMonth.filter(t => t.type === "income");

		const spent = expenses.reduce((sum, t) => sum + t.amount, 0);
		const income = incomes.reduce((sum, t) => sum + t.amount, 0);

		const categoryBreakdown: FinanceStats["categoryBreakdown"] = {};
		for (const t of expenses) {
			if (!categoryBreakdown[t.categoryId]) {
				const cat = this.settings.financeCategories.find(c => c.id === t.categoryId);
				categoryBreakdown[t.categoryId] = {
					amount: 0,
					percentage: 0,
					name: cat?.name ?? "Неизвестно",
					icon: cat?.icon ?? "❓",
					color: cat?.color ?? "#95a5a6",
				};
			}
			categoryBreakdown[t.categoryId].amount += t.amount;
		}
		for (const id of Object.keys(categoryBreakdown)) {
			categoryBreakdown[id].percentage = spent > 0
				? Math.round((categoryBreakdown[id].amount / spent) * 100)
				: 0;
		}

		return { currentMonth: month, spent, income, transactions: allMonth, categoryBreakdown };
	}

	// ── Recurring payments ────────────────────────────────────────────────

	getRecurring(): FinanceRecurring[] {
		return this.getData().recurringPayments ?? [];
	}

	addRecurring(entry: Omit<FinanceRecurring, "id">): void {
		const data = this.getData();
		const list = data.recurringPayments ?? [];
		list.push({ ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}` });
		void this.saveData({ recurringPayments: list });
		this.eventBus.emit("finance:recurring-updated");
	}

	deleteRecurring(id: string): void {
		const data = this.getData();
		const list = (data.recurringPayments ?? []).filter(r => r.id !== id);
		void this.saveData({ recurringPayments: list });
		this.eventBus.emit("finance:recurring-updated");
	}

	/** Returns recurring payments due within the next `days` days, sorted by proximity. */
	getUpcomingPayments(days = 14): UpcomingPayment[] {
		const recurring = this.getRecurring();
		const today = new Date();
		const todayDay = today.getDate();
		const results: UpcomingPayment[] = [];

		for (const r of recurring) {
			const targetDay = r.dayOfMonth;
			let daysUntil = targetDay - todayDay;
			if (daysUntil < 0) {
				const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
				daysUntil = daysInMonth - todayDay + targetDay;
			}
			if (daysUntil <= days) {
				const cat = this.settings.financeCategories.find(c => c.id === r.categoryId);
				results.push({
					recurring: r,
					daysUntil,
					categoryName: cat?.name ?? "Прочее",
					categoryIcon: r.icon ?? cat?.icon ?? "📋",
					categoryColor: cat?.color ?? "#95a5a6",
				});
			}
		}

		return results.sort((a, b) => a.daysUntil - b.daysUntil);
	}

	getCategories(): FinanceCategory[] {
		return this.settings.financeCategories;
	}

	private getTodayStr(): string {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
	}

	private getCurrentMonthStr(): string {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
	}
}
