import { HomeViewContext } from "../types";
import { createElement } from "../../utils/dom";

let navEditMode = false;

export function renderNavigationSection(parent: HTMLElement, ctx: HomeViewContext): void {
	const section = createElement("div", {
		cls: "umos-home-section umos-home-section-anim",
		parent,
	});

	// Заголовок с кнопкой редактирования
	const titleRow = createElement("div", {
		cls: "umos-home-nav-title-row",
		parent: section,
	});

	const editToggle = createElement("button", {
		cls: `umos-home-nav-edit-toggle${navEditMode ? " is-active" : ""}`,
		text: navEditMode ? "✓ Готово" : "✏️",
		parent: titleRow,
	});
	editToggle.addEventListener("click", () => {
		navEditMode = !navEditMode;
		// Перерендер секции
		section.remove();
		renderNavigationSection(parent, ctx);
	});

	const grid = createElement("div", {
		cls: `umos-home-nav-grid${navEditMode ? " umos-home-nav-grid--edit" : ""}`,
		parent: section,
	});

	for (let i = 0; i < ctx.settings.homeNavCards.length; i++) {
		const card = ctx.settings.homeNavCards[i];
		const navCard = createElement("div", {
			cls: "umos-home-nav-card",
			parent: grid,
		});

		navCard.style.setProperty("--umos-nav-color", card.color);

		createElement("span", {
			cls: "umos-home-nav-icon",
			text: card.icon,
			parent: navCard,
		});

		createElement("span", {
			cls: "umos-home-nav-name",
			text: card.name,
			parent: navCard,
		});

		if (navEditMode) {
			const delBtn = createElement("button", {
				cls: "umos-home-nav-card-del",
				text: "✕",
				parent: navCard,
			});
			delBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				ctx.settings.homeNavCards.splice(i, 1);
				ctx.saveSettings?.();
				section.remove();
				renderNavigationSection(parent, ctx);
			});
		} else {
			navCard.addEventListener("click", () => {
				ctx.app.workspace.openLinkText(card.path, "", false);
			});
		}
	}

	// Форма добавления карточки в режиме редактирования
	if (navEditMode) {
		const addForm = createElement("div", {
			cls: "umos-home-nav-add-form",
			parent: section,
		});

		const nameInput = createElement("input", {
			cls: "umos-home-nav-input",
			attr: { type: "text", placeholder: "Название" },
			parent: addForm,
		}) as HTMLInputElement;

		const iconInput = createElement("input", {
			cls: "umos-home-nav-input umos-home-nav-input--icon",
			attr: { type: "text", placeholder: "🔗" },
			parent: addForm,
		}) as HTMLInputElement;

		const pathInput = createElement("input", {
			cls: "umos-home-nav-input",
			attr: { type: "text", placeholder: "Путь к заметке" },
			parent: addForm,
		}) as HTMLInputElement;

		const colorInput = createElement("input", {
			cls: "umos-home-nav-input umos-home-nav-input--color",
			attr: { type: "color", value: "#607d8b" },
			parent: addForm,
		}) as HTMLInputElement;

		const addBtn = createElement("button", {
			cls: "umos-home-nav-add-btn",
			text: "+ Добавить",
			parent: addForm,
		});

		addBtn.addEventListener("click", () => {
			const name = nameInput.value.trim();
			const path = pathInput.value.trim();
			if (!name || !path) return;
			ctx.settings.homeNavCards.push({
				name,
				icon: iconInput.value.trim() || "🔗",
				path,
				color: colorInput.value,
			});
			ctx.saveSettings?.();
			nameInput.value = "";
			iconInput.value = "";
			pathInput.value = "";
			section.remove();
			renderNavigationSection(parent, ctx);
		});
	}
}
