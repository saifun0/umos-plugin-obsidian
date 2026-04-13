/**
 * Парсит конфигурацию виджета из тела code block.
 * Формат: key: value (по одному на строку).
 * Поддерживает строки, булевы, числа и массивы ([a, b, c]).
 */
export function parseWidgetConfig(source: string): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	try {
		const cleaned = source.trim().replace(/^`{3,}.*$/gm, "").trim();
		for (const line of cleaned.split("\n")) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith("#")) continue;
			const colonIndex = trimmed.indexOf(":");
			if (colonIndex === -1) continue;
			const key = trimmed.substring(0, colonIndex).trim();
			let value: string = trimmed.substring(colonIndex + 1).trim();
			if (!key) continue;
			if (
				(value.startsWith('"') && value.endsWith('"')) ||
				(value.startsWith("'") && value.endsWith("'"))
			) {
				value = value.slice(1, -1);
			}
			if (value.startsWith("[") && value.endsWith("]")) {
				const inner = value.slice(1, -1);
				if (inner.trim() === "") { result[key] = []; continue; }
				result[key] = inner.split(",").map((s) => {
					let t = s.trim();
					if (
						(t.startsWith('"') && t.endsWith('"')) ||
						(t.startsWith("'") && t.endsWith("'"))
					) t = t.slice(1, -1);
					return t;
				});
				continue;
			}
			if (value === "true") { result[key] = true; continue; }
			if (value === "false") { result[key] = false; continue; }
			const num = Number(value);
			if (value !== "" && !isNaN(num)) { result[key] = num; continue; }
			result[key] = value;
		}
	} catch (error) {
		console.warn("umOS: failed to parse widget config:", error);
	}
	return result;
}
