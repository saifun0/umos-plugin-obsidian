import { createSvgElement } from "../utils/dom";

/**
 * SVG Sparkline — мини-график линией с градиентной заливкой.
 */
export function renderSparkline(
	parent: HTMLElement,
	data: number[],
	options?: {
		width?: number;
		height?: number;
		color?: string;
		fillOpacity?: number;
	}
): void {
	if (data.length === 0) return;

	const width = options?.width ?? 200;
	const height = options?.height ?? 40;
	const color = options?.color ?? "var(--umos-accent)";
	const fillOpacity = options?.fillOpacity ?? 0.15;

	const svg = createSvgElement("svg", {
		viewBox: `0 0 ${width} ${height}`,
		width: String(width),
		height: String(height),
		class: "umos-sparkline",
	}, parent);

	const min = Math.min(...data);
	const max = Math.max(...data);
	const range = max - min || 1;
	const padding = 2;
	const usableHeight = height - padding * 2;
	const stepX = (width - padding * 2) / Math.max(data.length - 1, 1);

	const points: string[] = [];

	data.forEach((value, i) => {
		const x = padding + i * stepX;
		const y = padding + usableHeight - ((value - min) / range) * usableHeight;
		points.push(`${x},${y}`);
	});

	const polylinePoints = points.join(" ");

	// Градиент
	const defs = createSvgElement("defs", {}, svg);
	const gradientId = `umos-sparkline-grad-${Math.random().toString(36).slice(2, 8)}`;
	const gradient = createSvgElement("linearGradient", {
		id: gradientId,
		x1: "0",
		y1: "0",
		x2: "0",
		y2: "1",
	}, defs);

	createSvgElement("stop", {
		offset: "0%",
		"stop-color": color,
		"stop-opacity": String(fillOpacity),
	}, gradient);

	createSvgElement("stop", {
		offset: "100%",
		"stop-color": color,
		"stop-opacity": "0",
	}, gradient);

	// Заливка под линией
	const firstPoint = points[0];
	const lastPoint = points[points.length - 1];
	const lastX = padding + (data.length - 1) * stepX;
	const firstX = padding;
	const fillPath = `M ${firstPoint} ${polylinePoints.split(" ").slice(1).map(p => `L ${p}`).join(" ")} L ${lastX},${height} L ${firstX},${height} Z`;

	createSvgElement("path", {
		d: fillPath,
		fill: `url(#${gradientId})`,
	}, svg);

	// Линия
	createSvgElement("polyline", {
		points: polylinePoints,
		fill: "none",
		stroke: color,
		"stroke-width": "2",
		"stroke-linecap": "round",
		"stroke-linejoin": "round",
	}, svg);

	// Последняя точка
	if (data.length > 0) {
		const lastDataPoint = points[points.length - 1].split(",");
		createSvgElement("circle", {
			cx: lastDataPoint[0],
			cy: lastDataPoint[1],
			r: "3",
			fill: color,
		}, svg);
	}
}

/**
 * SVG Ring Chart — кольцевая диаграмма процентного заполнения.
 */
export function renderRingChart(
	parent: HTMLElement,
	percent: number,
	options?: {
		size?: number;
		strokeWidth?: number;
		color?: string;
		label?: string;
		showPercent?: boolean;
	}
): void {
	const size = options?.size ?? 80;
	const strokeWidth = options?.strokeWidth ?? 6;
	const color = options?.color ?? "var(--umos-accent)";
	const showPercent = options?.showPercent !== false;

	const radius = (size - strokeWidth) / 2;
	const circumference = 2 * Math.PI * radius;
	const offset = circumference - (Math.min(percent, 100) / 100) * circumference;
	const center = size / 2;

	const container = document.createElement("div");
	container.className = "umos-ring-chart-container";
	parent.appendChild(container);

	const svg = createSvgElement("svg", {
		viewBox: `0 0 ${size} ${size}`,
		width: String(size),
		height: String(size),
		class: "umos-ring-chart",
	}, container);

	// Фоновое кольцо
	createSvgElement("circle", {
		cx: String(center),
		cy: String(center),
		r: String(radius),
		fill: "none",
		stroke: "var(--background-modifier-border)",
		"stroke-width": String(strokeWidth),
	}, svg);

	// Заполненное кольцо
	createSvgElement("circle", {
		cx: String(center),
		cy: String(center),
		r: String(radius),
		fill: "none",
		stroke: color,
		"stroke-width": String(strokeWidth),
		"stroke-dasharray": String(circumference),
		"stroke-dashoffset": String(offset),
		"stroke-linecap": "round",
		transform: `rotate(-90 ${center} ${center})`,
		class: "umos-ring-chart-fill",
	}, svg);

	// Текст в центре
	if (showPercent) {
		createSvgElement("text", {
			x: String(center),
			y: String(center),
			"text-anchor": "middle",
			"dominant-baseline": "central",
			"font-size": String(size * 0.22),
			"font-weight": "700",
			fill: "var(--text-normal)",
			class: "umos-ring-chart-text",
		}, svg).textContent = `${Math.round(percent)}%`;
	}

	// Подпись
	if (options?.label) {
		const labelEl = document.createElement("div");
		labelEl.className = "umos-ring-chart-label";
		labelEl.textContent = options.label;
		container.appendChild(labelEl);
	}
}

/**
 * SVG Bar Chart — сравнение значений столбцами.
 */
export function renderBarChart(
	parent: HTMLElement,
	data: { label: string; value: number; color?: string }[],
	options?: {
		width?: number;
		height?: number;
		barWidth?: number;
	}
): void {
	if (data.length === 0) return;

	const width = options?.width ?? 300;
	const height = options?.height ?? 120;
	const barWidth = options?.barWidth ?? 30;

	const maxValue = Math.max(...data.map((d) => d.value), 1);
	const gap = (width - data.length * barWidth) / (data.length + 1);
	const labelHeight = 20;
	const chartHeight = height - labelHeight - 4;

	const container = document.createElement("div");
	container.className = "umos-bar-chart-container";
	parent.appendChild(container);

	const svg = createSvgElement("svg", {
		viewBox: `0 0 ${width} ${height}`,
		width: String(width),
		height: String(height),
		class: "umos-bar-chart",
	}, container);

	data.forEach((item, i) => {
		const x = gap + i * (barWidth + gap);
		const barHeight = (item.value / maxValue) * chartHeight;
		const y = chartHeight - barHeight;
		const color = item.color || "var(--umos-accent)";

		// Столбец
		createSvgElement("rect", {
			x: String(x),
			y: String(y),
			width: String(barWidth),
			height: String(barHeight),
			rx: "4",
			ry: "4",
			fill: color,
			class: "umos-bar-chart-bar",
		}, svg);

		// Значение над столбцом
		createSvgElement("text", {
			x: String(x + barWidth / 2),
			y: String(y - 4),
			"text-anchor": "middle",
			"font-size": "10",
			"font-weight": "600",
			fill: "var(--text-muted)",
		}, svg).textContent = String(item.value);

		// Подпись
		createSvgElement("text", {
			x: String(x + barWidth / 2),
			y: String(height - 4),
			"text-anchor": "middle",
			"font-size": "9",
			fill: "var(--text-faint)",
		}, svg).textContent = item.label;
	});
}

/**
 * Определяет тренд: ↑ / ↓ / →
 */
export function getTrend(data: number[]): { direction: "up" | "down" | "stable"; delta: number } {
	if (data.length < 2) return { direction: "stable", delta: 0 };

	const mid = Math.floor(data.length / 2);
	const firstHalf = data.slice(0, mid);
	const secondHalf = data.slice(mid);

	const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
	const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

	const delta = avgSecond - avgFirst;
	const threshold = 0.1;

	if (delta > threshold) return { direction: "up", delta };
	if (delta < -threshold) return { direction: "down", delta };
	return { direction: "stable", delta };
}

/**
 * Возвращает иконку тренда.
 */
export function getTrendIcon(direction: "up" | "down" | "stable"): string {
	switch (direction) {
		case "up": return "↑";
		case "down": return "↓";
		case "stable": return "→";
	}
}

/**
 * Возвращает CSS-класс тренда.
 */
export function getTrendClass(direction: "up" | "down" | "stable"): string {
	switch (direction) {
		case "up": return "umos-trend-up";
		case "down": return "umos-trend-down";
		case "stable": return "umos-trend-stable";
	}
}