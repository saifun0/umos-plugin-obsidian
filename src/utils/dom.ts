/**
 * Утилиты для создания DOM-элементов.
 */

/**
 * Создаёт HTML-элемент с указанными параметрами.
 */
export function createElement<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	options?: {
		cls?: string | string[];
		text?: string;
		attr?: Record<string, string>;
		parent?: HTMLElement;
		children?: HTMLElement[];
	}
): HTMLElementTagNameMap[K] {
	const el = document.createElement(tag);

	if (options?.cls) {
		if (Array.isArray(options.cls)) {
			el.classList.add(...options.cls);
		} else {
			el.classList.add(...options.cls.split(" ").filter(Boolean));
		}
	}

	if (options?.text) {
		el.textContent = options.text;
	}

	if (options?.attr) {
		for (const [key, value] of Object.entries(options.attr)) {
			el.setAttribute(key, value);
		}
	}

	if (options?.parent) {
		options.parent.appendChild(el);
	}

	if (options?.children) {
		for (const child of options.children) {
			el.appendChild(child);
		}
	}

	return el;
}

/**
 * Создаёт SVG-элемент.
 */
export function createSvgElement(
	tag: string,
	attrs?: Record<string, string>,
	parent?: Element
): SVGElement {
	const el = document.createElementNS("http://www.w3.org/2000/svg", tag);

	if (attrs) {
		for (const [key, value] of Object.entries(attrs)) {
			el.setAttribute(key, value);
		}
	}

	if (parent) {
		parent.appendChild(el);
	}

	return el;
}

/**
 * Очищает содержимое элемента.
 */
export function clearElement(el: HTMLElement): void {
	while (el.firstChild) {
		el.removeChild(el.firstChild);
	}
}

/**
 * Создаёт skeleton-loader (placeholder при загрузке).
 */
export function createSkeletonLoader(
	parent: HTMLElement,
	lines: number = 3
): HTMLElement {
	const container = createElement("div", {
		cls: "umos-skeleton-container",
		parent,
	});

	for (let i = 0; i < lines; i++) {
		createElement("div", {
			cls: "umos-skeleton-line",
			parent: container,
		});
	}

	return container;
}

/**
 * Создаёт сообщение об ошибке.
 */
export function createErrorMessage(
	parent: HTMLElement,
	message: string
): HTMLElement {
	return createElement("div", {
		cls: "umos-error-message",
		text: `❌ ${message}`,
		parent,
	});
}

/**
 * Создаёт информационное сообщение.
 */
export function createInfoMessage(
	parent: HTMLElement,
	message: string
): HTMLElement {
	return createElement("div", {
		cls: "umos-info-message",
		text: message,
		parent,
	});
}

/**
 * Создаёт карточку (стандартный блок umOS).
 */
export function createCard(
	parent: HTMLElement,
	options?: {
		cls?: string;
		children?: HTMLElement[];
	}
): HTMLElement {
	const card = createElement("div", {
		cls: `umos-card ${options?.cls || ""}`.trim(),
		parent,
	});

	if (options?.children) {
		for (const child of options.children) {
			card.appendChild(child);
		}
	}

	return card;
}

/**
 * Создаёт badge (метка с числом или текстом).
 */
export function createBadge(
	text: string,
	parent?: HTMLElement,
	cls?: string
): HTMLElement {
	return createElement("span", {
		cls: `umos-badge ${cls || ""}`.trim(),
		text,
		parent,
	});
}

/**
 * Анимирует появление элемента (fade in).
 */
export function fadeIn(el: HTMLElement, duration: number = 200): void {
	el.style.opacity = "0";
	el.style.transition = `opacity ${duration}ms ease`;

	requestAnimationFrame(() => {
		el.style.opacity = "1";
	});
}

/**
 * Debounce функция.
 */
export function debounce<T extends (...args: Parameters<T>) => void>(
	func: T,
	wait: number
): (...args: Parameters<T>) => void {
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	return (...args: Parameters<T>) => {
		if (timeoutId !== null) {
			clearTimeout(timeoutId);
		}
		timeoutId = setTimeout(() => {
			func(...args);
			timeoutId = null;
		}, wait);
	};
}