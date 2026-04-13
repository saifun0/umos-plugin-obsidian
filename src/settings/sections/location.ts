import { Notice, Setting, setIcon } from "obsidian";
import { detectLocation } from "../../utils/api";
import { SavedLocation } from "../Settings";
import { SettingsContext, createSection } from "../helpers";

export function renderLocationSection(containerEl: HTMLElement, ctx: SettingsContext): void {
	const sectionEl = createSection(
		containerEl,
		"umos-settings-location",
		"Местоположение",
		"Единые настройки геолокации для намаза и погоды."
	);

	// ── Текущая локация ──────────────────────────────────────

	new Setting(sectionEl)
		.setName("Город")
		.addText((text) =>
			text.setPlaceholder("Москва").setValue(ctx.settings.locationCity)
				.onChange(async (value) => { ctx.settings.locationCity = value; await ctx.saveSettings(); })
		);

	new Setting(sectionEl)
		.setName("Широта")
		.addText((text) =>
			text.setPlaceholder("55.7558").setValue(String(ctx.settings.locationLatitude))
				.onChange(async (value) => {
					const num = parseFloat(value);
					if (!isNaN(num)) { ctx.settings.locationLatitude = num; await ctx.saveSettings(); }
				})
		);

	new Setting(sectionEl)
		.setName("Долгота")
		.addText((text) =>
			text.setPlaceholder("37.6173").setValue(String(ctx.settings.locationLongitude))
				.onChange(async (value) => {
					const num = parseFloat(value);
					if (!isNaN(num)) { ctx.settings.locationLongitude = num; await ctx.saveSettings(); }
				})
		);

	new Setting(sectionEl)
		.setName("Определить автоматически")
		.setDesc("Определение по IP-адресу. При использовании VPN — введите координаты вручную.")
		.addButton((btn) =>
			btn.setButtonText("📍 Определить").onClick(async () => {
				try {
					const geo = await detectLocation();
					ctx.settings.locationLatitude = Math.round(geo.latitude * 10000) / 10000;
					ctx.settings.locationLongitude = Math.round(geo.longitude * 10000) / 10000;
					ctx.settings.locationCity = geo.city || ctx.settings.locationCity;
					await ctx.saveSettings();
					ctx.plugin.eventBus.emit("location:updated");
					new Notice(`📍 Местоположение: ${geo.city} (${ctx.settings.locationLatitude}, ${ctx.settings.locationLongitude})`);
					ctx.display();
				} catch (err) {
					new Notice(`❌ Ошибка определения: ${(err as Error).message}`);
				}
			})
		);

	// ── Сохранённые локации ──────────────────────────────────

	sectionEl.createEl("div", { cls: "umos-settings-subsection-title", text: "Сохранённые локации" });

	const savedList = sectionEl.createDiv({ cls: "umos-saved-locations-list" });

	const renderSavedList = () => {
		savedList.empty();

		if (ctx.settings.savedLocations.length === 0) {
			savedList.createEl("div", {
				cls: "umos-saved-locations-empty",
				text: "Нет сохранённых локаций",
			});
			return;
		}

		for (let i = 0; i < ctx.settings.savedLocations.length; i++) {
			const loc = ctx.settings.savedLocations[i];
			const isActive =
				Math.abs(ctx.settings.locationLatitude - loc.latitude) < 0.001 &&
				Math.abs(ctx.settings.locationLongitude - loc.longitude) < 0.001;

			const row = savedList.createDiv({
				cls: `umos-saved-location-row${isActive ? " is-active" : ""}`,
			});

			// Name + coords
			const info = row.createDiv({ cls: "umos-saved-location-info" });
			info.createEl("span", { cls: "umos-saved-location-name", text: loc.name });
			info.createEl("span", {
				cls: "umos-saved-location-coords",
				text: `${loc.latitude}, ${loc.longitude}`,
			});

			// Actions
			const actions = row.createDiv({ cls: "umos-saved-location-actions" });

			if (!isActive) {
				const applyBtn = actions.createEl("button", {
					cls: "umos-saved-location-btn",
					text: "Применить",
				});
				applyBtn.addEventListener("click", async () => {
					ctx.settings.locationLatitude = loc.latitude;
					ctx.settings.locationLongitude = loc.longitude;
					ctx.settings.locationCity = loc.city;
					await ctx.saveSettings();
					ctx.plugin.eventBus.emit("location:updated");
					new Notice(`📍 Локация: ${loc.name}`);
					ctx.display();
				});
			} else {
				actions.createEl("span", { cls: "umos-saved-location-active-badge", text: "Активна" });
			}

			const deleteBtn = actions.createEl("button", { cls: "umos-saved-location-delete clickable-icon" });
			setIcon(deleteBtn, "trash-2");
			deleteBtn.addEventListener("click", async () => {
				ctx.settings.savedLocations.splice(i, 1);
				await ctx.saveSettings();
				renderSavedList();
			});
		}
	};

	renderSavedList();

	// ── Добавить текущую ─────────────────────────────────────

	const addRow = sectionEl.createDiv({ cls: "umos-saved-location-add-row" });

	let pendingName = ctx.settings.locationCity;

	const nameInput = addRow.createEl("input", {
		cls: "umos-saved-location-name-input",
		attr: { type: "text", placeholder: "Название (напр. Дом, Универ...)" },
	}) as HTMLInputElement;
	nameInput.value = pendingName;
	nameInput.addEventListener("input", () => { pendingName = nameInput.value.trim(); });

	const addBtn = addRow.createEl("button", { cls: "umos-saved-location-add-btn mod-cta", text: "Сохранить текущую" });
	addBtn.addEventListener("click", async () => {
		const name = pendingName || ctx.settings.locationCity || "Локация";
		const newLoc: SavedLocation = {
			name,
			latitude: ctx.settings.locationLatitude,
			longitude: ctx.settings.locationLongitude,
			city: ctx.settings.locationCity,
		};
		// Не добавлять дубликат по координатам
		const duplicate = ctx.settings.savedLocations.some(
			l => Math.abs(l.latitude - newLoc.latitude) < 0.001 && Math.abs(l.longitude - newLoc.longitude) < 0.001
		);
		if (duplicate) {
			new Notice("⚠️ Эта локация уже сохранена");
			return;
		}
		ctx.settings.savedLocations.push(newLoc);
		await ctx.saveSettings();
		nameInput.value = "";
		pendingName = "";
		renderSavedList();
		new Notice(`✅ Локация "${name}" сохранена`);
	});
}
