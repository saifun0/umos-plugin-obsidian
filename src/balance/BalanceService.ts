import { EventBus } from "../EventBus";
import { UmOSSettings, BalanceEntry, BalanceData } from "../settings/Settings";

export class BalanceService {
	constructor(
		private readonly eventBus: EventBus,
		private readonly getSettings: () => UmOSSettings,
		private readonly getData: () => BalanceData,
		private readonly saveData: (data: Partial<BalanceData>) => Promise<void>,
	) {}

	private today(): string {
		return new Date().toISOString().slice(0, 10);
	}

	private newId(): string {
		return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
	}

	/** Current total balance in minutes, respecting caps and negative-balance setting. */
	getBalance(): number {
		const settings = this.getSettings();
		let balance = this.getData().entries.reduce(
			(sum, e) => sum + (e.type === "earn" ? e.balanceMinutes : -e.balanceMinutes),
			0,
		);
		if (!settings.balanceAllowNegative && balance < 0) balance = 0;
		if (settings.balanceMaxTotal > 0) balance = Math.min(balance, settings.balanceMaxTotal);
		return Math.round(balance);
	}

	/** Total minutes earned today. */
	getTodayEarned(): number {
		const today = this.today();
		return this.getData().entries
			.filter(e => e.date === today && e.type === "earn")
			.reduce((s, e) => s + e.balanceMinutes, 0);
	}

	/** Total minutes spent today. */
	getTodaySpent(): number {
		const today = this.today();
		return this.getData().entries
			.filter(e => e.date === today && e.type === "spend")
			.reduce((s, e) => s + e.balanceMinutes, 0);
	}

	/** Most recent entries, sorted newest-first. */
	getRecentEntries(limit = 20): BalanceEntry[] {
		return [...this.getData().entries]
			.sort((a, b) => b.timestamp - a.timestamp)
			.slice(0, limit);
	}

	/** Earned/spent totals for the last 7 days (including today). */
	getWeekStats(): { date: string; earned: number; spent: number }[] {
		const result: { date: string; earned: number; spent: number }[] = [];
		const now = new Date();
		for (let i = 6; i >= 0; i--) {
			const d = new Date(now);
			d.setDate(d.getDate() - i);
			const dateStr = d.toISOString().slice(0, 10);
			const day = this.getData().entries.filter(e => e.date === dateStr);
			result.push({
				date: dateStr,
				earned: day.filter(e => e.type === "earn").reduce((s, e) => s + e.balanceMinutes, 0),
				spent:  day.filter(e => e.type === "spend").reduce((s, e) => s + e.balanceMinutes, 0),
			});
		}
		return result;
	}

	/**
	 * Log a productive activity.
	 * Returns false if daily/total cap already reached or activity type unknown.
	 */
	logActivity(activityId: string, durationMinutes: number, note?: string): boolean {
		const settings = this.getSettings();
		const type = settings.balanceActivityTypes.find(a => a.id === activityId);
		if (!type) return false;

		let earned = Math.round(durationMinutes * type.multiplier);

		if (settings.balanceMaxDailyEarnings > 0) {
			const remaining = settings.balanceMaxDailyEarnings - this.getTodayEarned();
			if (remaining <= 0) return false;
			earned = Math.min(earned, remaining);
		}
		if (settings.balanceMaxTotal > 0) {
			const available = settings.balanceMaxTotal - this.getBalance();
			if (available <= 0) return false;
			earned = Math.min(earned, available);
		}

		const entry: BalanceEntry = {
			id: this.newId(),
			date: this.today(),
			timestamp: Date.now(),
			type: "earn",
			activityId,
			label: type.label,
			icon: type.icon,
			durationMinutes,
			balanceMinutes: earned,
			note,
		};
		void this.saveData({ entries: [...this.getData().entries, entry] });
		this.eventBus.emit("balance:updated");
		return true;
	}

	/**
	 * Log entertainment (spends balance).
	 * Returns false if insufficient balance (when allowNegative is off) or type unknown.
	 */
	logEntertainment(entertainmentId: string, durationMinutes: number, note?: string): boolean {
		const settings = this.getSettings();
		const type = settings.balanceEntertainmentTypes.find(e => e.id === entertainmentId);
		if (!type) return false;

		const cost = Math.round(durationMinutes * type.drainMultiplier);
		if (!settings.balanceAllowNegative && cost > this.getBalance()) return false;

		const entry: BalanceEntry = {
			id: this.newId(),
			date: this.today(),
			timestamp: Date.now(),
			type: "spend",
			activityId: entertainmentId,
			label: type.label,
			icon: type.icon,
			durationMinutes,
			balanceMinutes: cost,
			note,
		};
		void this.saveData({ entries: [...this.getData().entries, entry] });
		this.eventBus.emit("balance:updated");
		return true;
	}

	/** Delete a log entry by id. */
	deleteEntry(entryId: string): void {
		const entries = this.getData().entries.filter(e => e.id !== entryId);
		void this.saveData({ entries });
		this.eventBus.emit("balance:updated");
	}

	/**
	 * Award the daily bonus.
	 * Returns false if already claimed today or bonus is disabled (balanceDailyBonus === 0).
	 */
	claimDailyBonus(): boolean {
		const settings = this.getSettings();
		if (settings.balanceDailyBonus <= 0) return false;
		const today = this.today();
		if (this.getData().lastBonusDate === today) return false;

		const entry: BalanceEntry = {
			id: this.newId(),
			date: today,
			timestamp: Date.now(),
			type: "earn",
			activityId: "__bonus__",
			label: "Ежедневный бонус",
			icon: "🎁",
			durationMinutes: settings.balanceDailyBonus,
			balanceMinutes: settings.balanceDailyBonus,
		};
		void this.saveData({ entries: [...this.getData().entries, entry], lastBonusDate: today });
		this.eventBus.emit("balance:updated");
		return true;
	}

	/** True if daily bonus is available and not yet claimed today. */
	hasDailyBonus(): boolean {
		const settings = this.getSettings();
		if (settings.balanceDailyBonus <= 0) return false;
		return this.getData().lastBonusDate !== this.today();
	}

	/**
	 * Called when a frontmatter field changes in today's daily note.
	 * Awards balance for completed batches that haven't been credited yet.
	 * Safe to call repeatedly — uses dailyNoteCredits to prevent double-counting.
	 */
	processDailyNoteField(field: string, rawValue: unknown, date: string): void {
		const value = typeof rawValue === "number" ? rawValue : Number(rawValue);
		if (!Number.isFinite(value) || value <= 0) return;

		const settings = this.getSettings();
		const rule = settings.balanceDailyNoteRules.find(r => r.field === field);
		if (!rule) return;

		const data = this.getData();
		const credits = { ...data.dailyNoteCredits };
		const dateCredits = { ...(credits[date] ?? {}) };
		const alreadyCredited = dateCredits[field] ?? 0;

		const totalBatches = Math.floor(value / rule.unitsPerEarn);
		const newBatches = totalBatches - alreadyCredited;
		if (newBatches <= 0) return;

		const earnedMinutes = newBatches * rule.earnMinutes;
		const entry: BalanceEntry = {
			id: this.newId(),
			date,
			timestamp: Date.now(),
			type: "earn",
			activityId: `__daily_${field}__`,
			label: `${rule.label} (авто)`,
			icon: rule.icon,
			durationMinutes: newBatches * rule.unitsPerEarn,
			balanceMinutes: earnedMinutes,
		};

		dateCredits[field] = totalBatches;
		credits[date] = dateCredits;

		void this.saveData({ entries: [...data.entries, entry], dailyNoteCredits: credits });
		this.eventBus.emit("balance:updated");
	}

	getActivityTypes() {
		return this.getSettings().balanceActivityTypes;
	}

	getEntertainmentTypes() {
		return this.getSettings().balanceEntertainmentTypes;
	}

	getPluginSettings() {
		return this.getSettings();
	}
}
