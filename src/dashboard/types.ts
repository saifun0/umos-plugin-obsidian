import type { MarkdownPostProcessorContext } from "obsidian";

export type WidgetSchemaType = "string" | "number" | "boolean" | "enum" | "array" | "date";

export interface WidgetFieldSchema {
	type: WidgetSchemaType;
	label?: string;
	description?: string;
	required?: boolean;
	options?: string[];
	min?: number;
	max?: number;
	default?: unknown;
}

export type WidgetSchema = Record<string, WidgetFieldSchema>;

export interface WidgetValidationResult {
	config: Record<string, unknown>;
	errors: string[];
	warnings: string[];
}

export interface WidgetRenderContext {
	source: string;
	el: HTMLElement;
	ctx: MarkdownPostProcessorContext;
	config: Record<string, unknown>;
}

export interface WidgetPresetSnippet {
	id: string;
	name: string;
	description: string;
	config: Record<string, unknown>;
}

export interface WidgetDefinition {
	blockName: string;
	title: string;
	description: string;
	defaults: Record<string, unknown>;
	schema: WidgetSchema;
	examples: string[];
	snippets?: WidgetPresetSnippet[];
	skipValidation?: boolean;
	factory?: (context: WidgetRenderContext) => void;
}

export interface DashboardBlock {
	id: string;
	widget: string;
	config: Record<string, unknown>;
	enabled: boolean;
	column: number;
}

export type DashboardWidthMode = "default" | "soft" | "wide";

export interface DashboardProfile {
	id: string;
	name: string;
	targetPath: string;
	columns: number;
	widthMode?: DashboardWidthMode;
	blocks: DashboardBlock[];
	updatedAt: number;
}

export interface DashboardPreset {
	id: string;
	name: string;
	description: string;
	targetPath: string;
	columns: number;
	widthMode?: DashboardWidthMode;
	blocks: Array<Omit<DashboardBlock, "id">>;
}
