import { Notice, Setting, setIcon } from "obsidian";
import { detectLocation } from "../../utils/api";
import { SavedLocation } from "../Settings";
import { SettingsContext, createSection, createSubheading } from "../helpers";

export function renderLocationSection(containerEl: HTMLElement, ctx: SettingsContext): void {
	const sectionEl = createSection(
		containerEl,
		"umos-settings-location",
		"Location",
		"Shared geolocation settings for prayer and weather widgets."
	);

	createSubheading(sectionEl, "Current Location");

	new Setting(sectionEl)
		.setName("City")
		.addText((text) =>
			text.setPlaceholder("Moscow").setValue(ctx.settings.locationCity).onChange(async (value) => {
				ctx.settings.locationCity = value;
				await ctx.saveSettings();
			})
		);

	new Setting(sectionEl)
		.setName("Latitude")
		.addText((text) =>
			text
				.setPlaceholder("55.7558")
				.setValue(String(ctx.settings.locationLatitude))
				.onChange(async (value) => {
					const num = parseFloat(value);
					if (!Number.isNaN(num)) {
						ctx.settings.locationLatitude = num;
						await ctx.saveSettings();
					}
				})
		);

	new Setting(sectionEl)
		.setName("Longitude")
		.addText((text) =>
			text
				.setPlaceholder("37.6173")
				.setValue(String(ctx.settings.locationLongitude))
				.onChange(async (value) => {
					const num = parseFloat(value);
					if (!Number.isNaN(num)) {
						ctx.settings.locationLongitude = num;
						await ctx.saveSettings();
					}
				})
		);

	new Setting(sectionEl)
		.setName("Detect Automatically")
		.setDesc("Detection by IP address. If you use a VPN, it is better to save coordinates manually.")
		.addButton((btn) =>
			btn.setButtonText("Detect").onClick(async () => {
				try {
					const geo = await detectLocation();
					ctx.settings.locationLatitude = Math.round(geo.latitude * 10000) / 10000;
					ctx.settings.locationLongitude = Math.round(geo.longitude * 10000) / 10000;
					ctx.settings.locationCity = geo.city || ctx.settings.locationCity;
					await ctx.saveSettings();
					ctx.plugin.eventBus.emit("location:updated");
					new Notice(`📍 Location: ${geo.city} (${ctx.settings.locationLatitude}, ${ctx.settings.locationLongitude})`);
					ctx.display();
				} catch (err) {
					new Notice(`❌ Detection failed: ${(err as Error).message}`);
				}
			})
		);

	createSubheading(sectionEl, "Saved Locations");

	const savedList = sectionEl.createDiv({ cls: "umos-saved-locations-list" });

	const renderSavedList = () => {
		savedList.empty();

		if (ctx.settings.savedLocations.length === 0) {
			savedList.createEl("div", {
				cls: "umos-saved-locations-empty",
				text: "No saved locations",
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

			const info = row.createDiv({ cls: "umos-saved-location-info" });
			info.createEl("span", { cls: "umos-saved-location-name", text: loc.name });
			info.createEl("span", {
				cls: "umos-saved-location-coords",
				text: `${loc.latitude}, ${loc.longitude}`,
			});

			const actions = row.createDiv({ cls: "umos-saved-location-actions" });

			if (!isActive) {
				const applyBtn = actions.createEl("button", {
					cls: "umos-saved-location-btn",
					text: "Apply",
					attr: { type: "button" },
				});
				applyBtn.addEventListener("click", async () => {
					ctx.settings.locationLatitude = loc.latitude;
					ctx.settings.locationLongitude = loc.longitude;
					ctx.settings.locationCity = loc.city;
					await ctx.saveSettings();
					ctx.plugin.eventBus.emit("location:updated");
					new Notice(`📍 Location: ${loc.name}`);
					ctx.display();
				});
			} else {
				actions.createEl("span", {
					cls: "umos-saved-location-active-badge",
					text: "Active",
				});
			}

			const deleteBtn = actions.createEl("button", {
				cls: "umos-saved-location-delete clickable-icon",
				attr: { type: "button", title: "Delete" },
			});
			setIcon(deleteBtn, "trash-2");
			deleteBtn.addEventListener("click", async () => {
				ctx.settings.savedLocations.splice(i, 1);
				await ctx.saveSettings();
				renderSavedList();
			});
		}
	};

	renderSavedList();

	const addRow = sectionEl.createDiv({ cls: "umos-saved-location-add-row" });
	let pendingName = ctx.settings.locationCity;

	const nameInput = addRow.createEl("input", {
		cls: "umos-saved-location-name-input",
		attr: {
			type: "text",
			placeholder: "Name (for example: Home, Campus...)",
		},
	}) as HTMLInputElement;
	nameInput.value = pendingName;
	nameInput.addEventListener("input", () => {
		pendingName = nameInput.value.trim();
	});

	const addBtn = addRow.createEl("button", {
		cls: "umos-saved-location-add-btn mod-cta",
		text: "Save Current",
		attr: { type: "button" },
	});
	addBtn.addEventListener("click", async () => {
		const name = pendingName || ctx.settings.locationCity || "Location";
		const newLoc: SavedLocation = {
			name,
			latitude: ctx.settings.locationLatitude,
			longitude: ctx.settings.locationLongitude,
			city: ctx.settings.locationCity,
		};

		const duplicate = ctx.settings.savedLocations.some(
			(location) =>
				Math.abs(location.latitude - newLoc.latitude) < 0.001 &&
				Math.abs(location.longitude - newLoc.longitude) < 0.001
		);
		if (duplicate) {
			new Notice("⚠️ This location is already saved");
			return;
		}

		ctx.settings.savedLocations.push(newLoc);
		await ctx.saveSettings();
		nameInput.value = "";
		pendingName = "";
		renderSavedList();
		new Notice(`✅ Location "${name}" saved`);
	});
}
