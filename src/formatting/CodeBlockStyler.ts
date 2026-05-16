import { Notice, setIcon } from "obsidian";
import { t } from "../i18n";
import {
	CODE_STYLER_LANGUAGE_ALIAS_MAP,
	CODE_STYLER_LANGUAGE_ICONS,
} from "./CodeStylerLanguageIcons.generated";

interface LanguageMeta {
	label: string;
	icon: string;
	color: string;
}

export interface CodeLanguageIconGalleryItem {
	language: string;
	label: string;
	color: string;
	hasSvg: boolean;
}

const LANGUAGE_ALIASES: Record<string, string> = {
	"c++": "cpp",
	"cxx": "cpp",
	"cc": "cpp",
	"hpp": "cpp",
	"c#": "csharp",
	"cs": "csharp",
	"py": "python",
	"js": "javascript",
	"jsx": "javascript",
	"mjs": "javascript",
	"ts": "typescript",
	"tsx": "typescript",
	"golang": "go",
	"shell": "bash",
	"sh": "bash",
	"zsh": "bash",
	"fish": "bash",
	"bat": "batch",
	"cmd": "batch",
	"ps": "powershell",
	"ps1": "powershell",
	"md": "markdown",
	"yml": "yaml",
	"docker": "docker",
	"dockercompose": "docker",
	"docker-compose": "docker",
	"dockerfile": "docker",
	"html": "html",
	"xml": "xml",
	"svg": "xml",
	"postgresql": "sql",
	"mysql": "sql",
	"sqlite": "sql",
	"gql": "graphql",
	"hs": "haskell",
	"ex": "elixir",
	"exs": "elixir",
	"erl": "erlang",
	"rb": "ruby",
	"objective-c": "objectivec",
	"objc": "objectivec",
	"tex": "latex",
	"cmakelists": "cmake",
	"cls": "latex",
	"plain": "text",
	"plaintext": "text",
	"txt": "text",
};

const LANGUAGE_META: Record<string, LanguageMeta> = {
	cpp: { label: "C++", icon: "C++", color: "#c65ac8" },
	c: { label: "C", icon: "C", color: "#5aa7e8" },
	csharp: { label: "C#", icon: "C#", color: "#7cc66a" },
	python: { label: "Python", icon: "Py", color: "#f0c95a" },
	javascript: { label: "JavaScript", icon: "JS", color: "#f7df1e" },
	typescript: { label: "TypeScript", icon: "TS", color: "#5aa7ff" },
	html: { label: "HTML", icon: "</>", color: "#f06a3d" },
	css: { label: "CSS", icon: "#", color: "#62a8ff" },
	json: { label: "JSON", icon: "{}", color: "#d8b45c" },
	bash: { label: "Shell", icon: "$", color: "#3ddc84" },
	powershell: { label: "PowerShell", icon: "PS", color: "#63a8ff" },
	java: { label: "Java", icon: "J", color: "#4fa3d8" },
	rust: { label: "Rust", icon: "Rs", color: "#d08a55" },
	go: { label: "Go", icon: "Go", color: "#5fd5e8" },
	sql: { label: "SQL", icon: "DB", color: "#77a7ff" },
	yaml: { label: "YAML", icon: "Y", color: "#d26a6a" },
	markdown: { label: "Markdown", icon: "MD", color: "#b7c3d7" },
	lua: { label: "Lua", icon: "Lua", color: "#6b75ff" },
	php: { label: "PHP", icon: "PHP", color: "#9c90d9" },
	ruby: { label: "Ruby", icon: "Rb", color: "#e56464" },
	kotlin: { label: "Kotlin", icon: "Kt", color: "#b878ff" },
	dart: { label: "Dart", icon: "Da", color: "#55c7e8" },
	r: { label: "R", icon: "R", color: "#78a6ff" },
	xml: { label: "XML", icon: "<>", color: "#f0a45a" },
	graphql: { label: "GraphQL", icon: "GQL", color: "#e10098" },
	haskell: { label: "Haskell", icon: "Hs", color: "#8d6adf" },
	swift: { label: "Swift", icon: "Sw", color: "#fa5d2d" },
	objectivec: { label: "Objective-C", icon: "ObjC", color: "#c2c2c2" },
	clojure: { label: "Clojure", icon: "Clj", color: "#91dc47" },
	elixir: { label: "Elixir", icon: "Ex", color: "#8e5aa8" },
	erlang: { label: "Erlang", icon: "Erl", color: "#d14a70" },
	scala: { label: "Scala", icon: "Sc", color: "#e62d2a" },
	julia: { label: "Julia", icon: "Jl", color: "#8a6de9" },
	zig: { label: "Zig", icon: "Zig", color: "#f7a41d" },
	nim: { label: "Nim", icon: "Nim", color: "#ffe953" },
	cmake: { label: "CMake", icon: "CM", color: "#40c463" },
	gradle: { label: "Gradle", icon: "Gr", color: "#3cc48f" },
	latex: { label: "LaTeX", icon: "TeX", color: "#cfcfcf" },
	less: { label: "Less", icon: "Less", color: "#6fa8ff" },
	batch: { label: "Batch", icon: "BAT", color: "#3ddc84" },
	diff: { label: "Diff", icon: "+-", color: "#7bd88f" },
	docker: { label: "Docker", icon: "Dc", color: "#65b8ff" },
	toml: { label: "TOML", icon: "T", color: "#d7a35f" },
	ini: { label: "INI", icon: "I", color: "#9ab5c8" },
	text: { label: "Plain Text", icon: "TXT", color: "#9ba8b6" },
};

// SVG language icons are taken from the local Code Styler language table style:
// bundled vector markup, isolated per instance so gradient ids do not collide.
const LANGUAGE_SVG_ICONS: Record<string, string> = {
	cpp: `<title>file_type_cpp</title><path d="M14.742,24.047a10.242,10.242,0,0,1-4.673.919A7.628,7.628,0,0,1,4.155,22.62,8.876,8.876,0,0,1,2,16.369,9.476,9.476,0,0,1,4.422,9.621a8.216,8.216,0,0,1,6.285-2.588,11.151,11.151,0,0,1,4.035.641v3.761A6.839,6.839,0,0,0,11,10.395,4.813,4.813,0,0,0,7.288,11.93a5.9,5.9,0,0,0-1.413,4.159A5.8,5.8,0,0,0,7.209,20.1a4.57,4.57,0,0,0,3.59,1.493,7.319,7.319,0,0,0,3.943-1.113Z" style="fill:#984c93"/><polygon points="17.112 14.829 17.112 12.485 19.456 12.485 19.456 14.829 21.8 14.829 21.8 17.172 19.456 17.172 19.456 19.515 17.112 19.515 17.112 17.172 14.77 17.172 14.77 14.828 17.112 14.829" style="fill:#984c93"/><polygon points="25.313 14.829 25.313 12.485 27.657 12.485 27.657 14.829 30 14.829 30 17.172 27.657 17.172 27.657 19.515 25.313 19.515 25.313 17.172 22.971 17.172 22.971 14.828 25.313 14.829" style="fill:#984c93"/>`,
	c: `<title>file_type_c</title><path d="M10.676,15.973a10.052,10.052,0,0,0,1.175,5.151,5.446,5.446,0,0,0,6.306,2.408,4.284,4.284,0,0,0,3.09-3.6c.107-.6.109-.61.109-.61,1.737.251,4.537.658,6.274.906l-.11.44a11.256,11.256,0,0,1-2.7,5.39,9.439,9.439,0,0,1-5.366,2.688,14.61,14.61,0,0,1-8.277-.819A10.151,10.151,0,0,1,5.4,21.687a16.225,16.225,0,0,1,.019-11.45,10.538,10.538,0,0,1,8.963-7.054,13.353,13.353,0,0,1,6.666.555,9.571,9.571,0,0,1,6.167,6.9c.094.352.114.417.114.417-1.932.351-4.319.8-6.238,1.215-.362-1.915-1.265-3.428-3.2-3.9a5.263,5.263,0,0,0-6.616,3.57,10.49,10.49,0,0,0-.385,1.439A12.31,12.31,0,0,0,10.676,15.973Z" style="fill:#005f91"/>`,
	csharp: `<title>file_type_csharp</title><path d="M19.792,7.071h2.553V9.624H24.9V7.071h2.552V9.624H30v2.552h-2.55v2.551H30V17.28H27.449v2.552H24.9v-2.55l-2.55,0,0,2.552H19.793v-2.55l-2.553,0V14.725h2.553V12.179H17.24V9.622h2.554Zm2.553,7.658H24.9V12.176H22.345Z" style="fill:#368832"/><path d="M14.689,24.013a10.2,10.2,0,0,1-4.653.915,7.6,7.6,0,0,1-5.89-2.336A8.839,8.839,0,0,1,2,16.367,9.436,9.436,0,0,1,4.412,9.648a8.181,8.181,0,0,1,6.259-2.577,11.1,11.1,0,0,1,4.018.638v3.745a6.81,6.81,0,0,0-3.723-1.036,4.793,4.793,0,0,0-3.7,1.529,5.879,5.879,0,0,0-1.407,4.142,5.774,5.774,0,0,0,1.328,3.992,4.551,4.551,0,0,0,3.575,1.487,7.288,7.288,0,0,0,3.927-1.108Z" style="fill:#368832"/>`,
	python: `<defs><linearGradient id="a" x1="-133.268" y1="-202.91" x2="-133.198" y2="-202.84" gradientTransform="translate(25243.061 38519.17) scale(189.38 189.81)" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#387eb8"/><stop offset="1" stop-color="#366994"/></linearGradient><linearGradient id="b" x1="-133.575" y1="-203.203" x2="-133.495" y2="-203.133" gradientTransform="translate(25309.061 38583.42) scale(189.38 189.81)" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffe052"/><stop offset="1" stop-color="#ffc331"/></linearGradient></defs><title>file_type_python</title><path d="M15.885,2.1c-7.1,0-6.651,3.07-6.651,3.07V8.36h6.752v1H6.545S2,8.8,2,16.005s4.013,6.912,4.013,6.912H8.33V19.556s-.13-4.013,3.9-4.013h6.762s3.772.06,3.772-3.652V5.8s.572-3.712-6.842-3.712h0ZM12.153,4.237a1.214,1.214,0,1,1-1.183,1.244v-.02a1.214,1.214,0,0,1,1.214-1.214h0Z" style="fill:url(#a)"/><path d="M16.085,29.91c7.1,0,6.651-3.08,6.651-3.08V23.65H15.985v-1h9.47S30,23.158,30,15.995s-4.013-6.912-4.013-6.912H23.64V12.4s.13,4.013-3.9,4.013H12.975S9.2,16.356,9.2,20.068V26.2s-.572,3.712,6.842,3.712h.04Zm3.732-2.147A1.214,1.214,0,1,1,21,26.519v.03a1.214,1.214,0,0,1-1.214,1.214h.03Z" style="fill:url(#b)"/>`,
	javascript: `<rect x="2" y="2" width="28" height="28" style="fill:#f5de19"/><path d="M20.809,23.875a2.866,2.866,0,0,0,2.6,1.6c1.09,0,1.787-.545,1.787-1.3,0-.9-.716-1.222-1.916-1.747l-.658-.282c-1.9-.809-3.16-1.822-3.16-3.964,0-1.973,1.5-3.476,3.853-3.476a3.889,3.889,0,0,1,3.742,2.107L25,18.128A1.789,1.789,0,0,0,23.311,17a1.145,1.145,0,0,0-1.259,1.128c0,.789.489,1.109,1.618,1.6l.658.282c2.236.959,3.5,1.936,3.5,4.133,0,2.369-1.861,3.667-4.36,3.667a5.055,5.055,0,0,1-4.795-2.691Zm-9.295.228c.413.733.789,1.353,1.693,1.353.864,0,1.41-.338,1.41-1.653V14.856h2.631v8.982c0,2.724-1.6,3.964-3.929,3.964a4.085,4.085,0,0,1-3.947-2.4Z"/>`,
	typescript: `<rect x="2" y="2" width="28" height="28" rx="1.312" style="fill:#3178c6"/><path d="M18.245,23.759v3.068a6.492,6.492,0,0,0,1.764.575,11.56,11.56,0,0,0,2.146.192,9.968,9.968,0,0,0,2.088-.211,5.11,5.11,0,0,0,1.735-.7,3.542,3.542,0,0,0,1.181-1.266,4.469,4.469,0,0,0,.186-3.394,3.409,3.409,0,0,0-.717-1.117,5.236,5.236,0,0,0-1.123-.877,12.027,12.027,0,0,0-1.477-.734q-.6-.249-1.08-.484a5.5,5.5,0,0,1-.813-.479,2.089,2.089,0,0,1-.516-.518,1.091,1.091,0,0,1-.181-.618,1.039,1.039,0,0,1,.162-.571,1.4,1.4,0,0,1,.459-.436,2.439,2.439,0,0,1,.726-.283,4.211,4.211,0,0,1,.956-.1,5.942,5.942,0,0,1,.808.058,6.292,6.292,0,0,1,.856.177,5.994,5.994,0,0,1,.836.3,4.657,4.657,0,0,1,.751.422V13.9a7.509,7.509,0,0,0-1.525-.4,12.426,12.426,0,0,0-1.9-.129,8.767,8.767,0,0,0-2.064.235,5.239,5.239,0,0,0-1.716.733,3.655,3.655,0,0,0-1.171,1.271,3.731,3.731,0,0,0-.431,1.845,3.588,3.588,0,0,0,.789,2.34,6,6,0,0,0,2.395,1.639q.63.26,1.175.509a6.458,6.458,0,0,1,.942.517,2.463,2.463,0,0,1,.626.585,1.2,1.2,0,0,1,.23.719,1.1,1.1,0,0,1-.144.552,1.269,1.269,0,0,1-.435.441,2.381,2.381,0,0,1-.726.292,4.377,4.377,0,0,1-1.018.105,5.773,5.773,0,0,1-1.969-.35A5.874,5.874,0,0,1,18.245,23.759Zm-5.154-7.638h4V13.594H5.938v2.527H9.92V27.375h3.171Z" style="fill:#fff;fill-rule:evenodd"/>`,
	html: `<polygon points="5.902 27.201 3.655 2 28.345 2 26.095 27.197 15.985 30 5.902 27.201" style="fill:#e44f26"/><polygon points="16 27.858 24.17 25.593 26.092 4.061 16 4.061 16 27.858" style="fill:#f1662a"/><polygon points="16 13.407 11.91 13.407 11.628 10.242 16 10.242 16 7.151 15.989 7.151 8.25 7.151 8.324 7.981 9.083 16.498 16 16.498 16 13.407" style="fill:#ebebeb"/><polygon points="16 21.434 15.986 21.438 12.544 20.509 12.324 18.044 10.651 18.044 9.221 18.044 9.654 22.896 15.986 24.654 16 24.65 16 21.434" style="fill:#ebebeb"/><polygon points="15.989 13.407 15.989 16.498 19.795 16.498 19.437 20.507 15.989 21.437 15.989 24.653 22.326 22.896 22.372 22.374 23.098 14.237 23.174 13.407 22.341 13.407 15.989 13.407" style="fill:#fff"/><polygon points="15.989 7.151 15.989 9.071 15.989 10.235 15.989 10.242 23.445 10.242 23.445 10.242 23.455 10.242 23.517 9.548 23.658 7.981 23.732 7.151 15.989 7.151" style="fill:#fff"/>`,
	css: `<polygon points="5.902 27.201 3.656 2 28.344 2 26.095 27.197 15.985 30 5.902 27.201" style="fill:#1572b6"/><polygon points="16 27.858 24.17 25.593 26.092 4.061 16 4.061 16 27.858" style="fill:#33a9dc"/><polygon points="16 13.191 20.09 13.191 20.372 10.026 16 10.026 16 6.935 16.011 6.935 23.75 6.935 23.676 7.764 22.917 16.282 16 16.282 16 13.191" style="fill:#fff"/><polygon points="16.019 21.218 16.005 21.222 12.563 20.292 12.343 17.827 10.67 17.827 9.24 17.827 9.673 22.68 16.004 24.438 16.019 24.434 16.019 21.218" style="fill:#ebebeb"/><polygon points="19.827 16.151 19.455 20.29 16.008 21.22 16.008 24.436 22.344 22.68 22.391 22.158 22.928 16.151 19.827 16.151" style="fill:#fff"/><polygon points="16.011 6.935 16.011 8.855 16.011 10.018 16.011 10.026 8.555 10.026 8.555 10.026 8.545 10.026 8.483 9.331 8.342 7.764 8.268 6.935 16.011 6.935" style="fill:#ebebeb"/><polygon points="16 13.191 16 15.111 16 16.274 16 16.282 12.611 16.282 12.611 16.282 12.601 16.282 12.539 15.587 12.399 14.02 12.325 13.191 16 13.191" style="fill:#ebebeb"/>`,
	json: `<path d="M4.014,14.976a2.51,2.51,0,0,0,1.567-.518A2.377,2.377,0,0,0,6.386,13.1,15.261,15.261,0,0,0,6.6,10.156q.012-2.085.075-2.747a5.236,5.236,0,0,1,.418-1.686,3.025,3.025,0,0,1,.755-1.018A3.046,3.046,0,0,1,9,4.125,6.762,6.762,0,0,1,10.544,4h.7V5.96h-.387a2.338,2.338,0,0,0-1.723.468A3.4,3.4,0,0,0,8.709,8.52a36.054,36.054,0,0,1-.137,4.133,4.734,4.734,0,0,1-.768,2.06A4.567,4.567,0,0,1,6.1,16a3.809,3.809,0,0,1,1.992,1.754,8.861,8.861,0,0,1,.618,3.865q0,2.435.05,2.9A1.755,1.755,0,0,0,9.264,25.7a2.639,2.639,0,0,0,1.592.337h.387V28h-.7a5.655,5.655,0,0,1-1.773-.2,2.97,2.97,0,0,1-1.324-.93,3.353,3.353,0,0,1-.681-1.63A24.175,24.175,0,0,1,6.6,22.006,16.469,16.469,0,0,0,6.386,18.9a2.408,2.408,0,0,0-.805-1.361,2.489,2.489,0,0,0-1.567-.524Z" style="fill:#f5de19"/><path d="M27.986,17.011a2.489,2.489,0,0,0-1.567.524,2.408,2.408,0,0,0-.805,1.361,16.469,16.469,0,0,0-.212,3.109,24.175,24.175,0,0,1-.169,3.234,3.353,3.353,0,0,1-.681,1.63,2.97,2.97,0,0,1-1.324.93,5.655,5.655,0,0,1-1.773.2h-.7V26.04h.387a2.639,2.639,0,0,0,1.592-.337,1.755,1.755,0,0,0,.506-1.186q.05-.462.05-2.9a8.861,8.861,0,0,1,.618-3.865A3.809,3.809,0,0,1,25.9,16a4.567,4.567,0,0,1-1.7-1.286,4.734,4.734,0,0,1-.768-2.06,36.054,36.054,0,0,1-.137-4.133,3.4,3.4,0,0,0-.425-2.092,2.338,2.338,0,0,0-1.723-.468h-.387V4h.7A6.762,6.762,0,0,1,23,4.125a3.046,3.046,0,0,1,1.149.581,3.025,3.025,0,0,1,.755,1.018,5.236,5.236,0,0,1,.418,1.686q.062.662.075,2.747a15.261,15.261,0,0,0,.212,2.947,2.377,2.377,0,0,0,.805,1.355,2.51,2.51,0,0,0,1.567.518Z" style="fill:#f5de19"/>`,
	bash: `<path d="M29.4,27.6H2.5V4.5H29.4Zm-25.9-1H28.4V5.5H3.5Z" style="fill:#3ddc84"/><polygon points="6.077 19.316 5.522 18.484 10.366 15.255 5.479 11.184 6.12 10.416 12.035 15.344 6.077 19.316" style="fill:#3ddc84"/><rect x="12.7" y="18.2" width="7.8" height="1" style="fill:#3ddc84"/><rect x="2.5" y="5.5" width="26.9" height="1.9" style="fill:#3ddc84"/>`,
	powershell: `<defs><linearGradient id="a" x1="23.325" y1="-118.543" x2="7.26" y2="-104.193" gradientTransform="matrix(1, 0, 0, -1, 0, -96)" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#5391fe"/><stop offset="1" stop-color="#3e6dbf"/></linearGradient><linearGradient id="b" x1="7.1" y1="-104.002" x2="23.001" y2="-118.292" xlink:href="#a"/></defs><title>file_type_powershell</title><path d="M3.174,26.589a1.154,1.154,0,0,1-.928-.423,1.234,1.234,0,0,1-.21-1.052L6.233,6.78A1.8,1.8,0,0,1,7.914,5.41H28.826a1.157,1.157,0,0,1,.928.423,1.235,1.235,0,0,1,.21,1.052l-4.2,18.335a1.8,1.8,0,0,1-1.681,1.37H3.174Z" style="fill-rule:evenodd;fill:url(#a)"/><path d="M7.914,5.646H28.826a.913.913,0,0,1,.908,1.187l-4.2,18.334a1.575,1.575,0,0,1-1.451,1.187H3.174a.913.913,0,0,1-.908-1.187l4.2-18.334A1.574,1.574,0,0,1,7.914,5.646Z" style="fill-rule:evenodd;fill:url(#b)"/><path d="M16.04,21.544h5.086a1.118,1.118,0,0,1,0,2.234H16.04a1.118,1.118,0,0,1,0-2.234Z" style="fill:#2c5591;fill-rule:evenodd"/><path d="M19.339,16.578a1.762,1.762,0,0,1-.591.6L9.309,23.953a1.224,1.224,0,0,1-1.438-1.977l8.512-6.164v-.126L11.035,10a1.224,1.224,0,0,1,1.782-1.672l6.418,6.827A1.166,1.166,0,0,1,19.339,16.578Z" style="fill:#2c5591;fill-rule:evenodd"/><path d="M19.1,16.342a1.749,1.749,0,0,1-.59.6L9.074,23.718a1.225,1.225,0,0,1-1.439-1.977l8.513-6.164V15.45L10.8,9.761a1.224,1.224,0,0,1,1.783-1.672L19,14.916A1.162,1.162,0,0,1,19.1,16.342Z" style="fill:#fff;fill-rule:evenodd"/><path d="M15.9,21.412h5.086a1.059,1.059,0,1,1,0,2.118H15.9a1.059,1.059,0,1,1,0-2.118Z" style="fill:#fff;fill-rule:evenodd"/>`,
	java: `<path d="M12.325,23.654s-1.07.622.761.833a16.023,16.023,0,0,0,5.8-.246,10.088,10.088,0,0,0,1.541.752c-5.481,2.349-12.405-.136-8.1-1.339" style="fill:#4fa3d8"/><path d="M11.656,20.588s-1.2.888.633,1.078a22.618,22.618,0,0,0,7.481-.359,3.32,3.32,0,0,0,1.152.7c-6.627,1.938-14.009.153-9.266-1.421" style="fill:#4fa3d8"/><path d="M17.3,15.388a2.051,2.051,0,0,1-.355,2.954s3.429-1.77,1.854-3.987c-1.471-2.067-2.6-3.095,3.508-6.636,0,0-9.586,2.394-5.007,7.669" style="fill:#f08d49"/><path d="M24.552,25.921s.792.652-.872,1.157c-3.164.958-13.168,1.248-15.948.038-1-.435.874-1.038,1.464-1.164a3.8,3.8,0,0,1,.966-.108c-1.111-.783-7.181,1.537-3.083,2.2,11.176,1.812,20.372-.816,17.473-2.124" style="fill:#4fa3d8"/><path d="M12.84,17.412s-5.089,1.209-1.8,1.648a38.225,38.225,0,0,0,6.731-.072c2.106-.178,4.221-.555,4.221-.555a8.934,8.934,0,0,0-1.28.685c-5.168,1.359-15.151.727-12.277-.663a9.629,9.629,0,0,1,4.407-1.042" style="fill:#4fa3d8"/><path d="M21.969,22.515c5.253-2.73,2.824-5.353,1.129-5a3.932,3.932,0,0,0-.6.161.957.957,0,0,1,.449-.346c3.354-1.179,5.933,3.478-1.083,5.322a.458.458,0,0,0,.106-.138" style="fill:#f08d49"/><path d="M18.8,2s2.909,2.91-2.759,7.386c-4.546,3.59-1.037,5.637,0,7.975-2.653-2.394-4.6-4.5-3.294-6.463C14.664,8.019,19.976,6.623,18.8,2" style="fill:#f08d49"/><path d="M13.356,29.912c5.042.323,12.786-.179,12.969-2.565,0,0-.353.9-4.167,1.623a41.458,41.458,0,0,1-12.76.2s.645.533,3.959.746" style="fill:#4fa3d8"/>`,
	sql: `<path d="M8.562,15.256A21.159,21.159,0,0,0,16,16.449a21.159,21.159,0,0,0,7.438-1.194c1.864-.727,2.525-1.535,2.525-2V9.7a10.357,10.357,0,0,1-2.084,1.076A22.293,22.293,0,0,1,16,12.078a22.36,22.36,0,0,1-7.879-1.3A10.28,10.28,0,0,1,6.037,9.7v3.55C6.037,13.724,6.7,14.528,8.562,15.256Z" style="fill:#ffda44"/><path d="M8.562,21.961a15.611,15.611,0,0,0,2.6.741A24.9,24.9,0,0,0,16,23.155a24.9,24.9,0,0,0,4.838-.452,15.614,15.614,0,0,0,2.6-.741c1.864-.727,2.525-1.535,2.525-2v-3.39a10.706,10.706,0,0,1-1.692.825A23.49,23.49,0,0,1,16,18.74a23.49,23.49,0,0,1-8.271-1.348,10.829,10.829,0,0,1-1.692-.825V19.96C6.037,20.426,6.7,21.231,8.562,21.961Z" style="fill:#ffda44"/><path d="M16,30c5.5,0,9.963-1.744,9.963-3.894V23.269a10.5,10.5,0,0,1-1.535.762l-.157.063A23.487,23.487,0,0,1,16,25.445a23.422,23.422,0,0,1-8.271-1.351c-.054-.02-.106-.043-.157-.063a10.5,10.5,0,0,1-1.535-.762v2.837C6.037,28.256,10.5,30,16,30Z" style="fill:#ffda44"/><ellipse cx="16" cy="5.894" rx="9.963" ry="3.894" style="fill:#ffda44"/>`,
	yaml: `<path d="M2,12.218c.755,0,1.51-.008,2.264,0l.053.038Q5.7,13.638,7.078,15.014c.891-.906,1.8-1.794,2.7-2.7.053-.052.11-.113.192-.1.608,0,1.215,0,1.823,0a1.4,1.4,0,0,1,.353.019c-.7.67-1.377,1.369-2.069,2.05L5.545,18.8c-.331.324-.648.663-.989.975-.754.022-1.511.007-2.266.007,1.223-1.209,2.431-2.433,3.658-3.637C4.627,14.841,3.318,13.525,2,12.218Z" style="fill:#ffe885"/><path d="M12.7,12.218c.613,0,1.226,0,1.839,0q0,3.783,0,7.566c-.611,0-1.222.012-1.832-.008,0-1.664,0-3.329,0-4.994-1.6,1.607-3.209,3.2-4.811,4.8-.089.08-.166.217-.305.194-.824-.006-1.649,0-2.474,0Q8.916,16,12.7,12.218Z" style="fill:#ffe885"/><path d="M14.958,12.22c.47-.009.939,0,1.409,0,.836.853,1.69,1.689,2.536,2.532q1.268-1.267,2.539-2.532.7,0,1.4,0-.008,3.784,0,7.567c-.471,0-.943.006-1.414,0q.008-2.387,0-4.773c-.844.843-1.676,1.7-2.526,2.536-.856-.835-1.687-1.695-2.532-2.541,0,1.594-.006,3.188.006,4.781-.472,0-.943.005-1.415,0Q14.958,16,14.958,12.22Z" style="fill:#ffe885"/><path d="M23.259,12.217c.472,0,.944-.007,1.416,0q-.007,3.083,0,6.166c1.26,0,2.521,0,3.782,0,.063.006.144-.012.191.045.448.454.907.9,1.353,1.354q-3.371.007-6.741,0Q23.267,16,23.259,12.217Z" style="fill:#ffe885"/>`,
	markdown: `<rect x="2.5" y="7.955" width="27" height="16.091" style="fill:none;stroke:#b7c3d7"/><polygon points="5.909 20.636 5.909 11.364 8.636 11.364 11.364 14.773 14.091 11.364 16.818 11.364 16.818 20.636 14.091 20.636 14.091 15.318 11.364 18.727 8.636 15.318 8.636 20.636 5.909 20.636" style="fill:#b7c3d7"/><polygon points="22.955 20.636 18.864 16.136 21.591 16.136 21.591 11.364 24.318 11.364 24.318 16.136 27.045 16.136 22.955 20.636" style="fill:#b7c3d7"/>`,
	xml: `<path d="M20.42,21.157l2.211,2.211L30,16,22.631,8.631,20.42,10.843,25.58,16Z" style="fill:#f1662a"/><path d="M11.58,10.843,9.369,8.631,2,16l7.369,7.369,2.211-2.211L6.42,16Z" style="fill:#f1662a"/><path d="M17.411,7.677l1.6.437-4.42,16.209-1.6-.437,4.42-16.209Z" style="fill:#f1662a"/>`,
	kotlin: `<defs><linearGradient id="a" x1="311.336" y1="1452.064" x2="283.342" y2="1480.058" gradientTransform="translate(-281.4 -1450)" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#e44857"/><stop offset="0.47" stop-color="#9d4b9d"/><stop offset="1" stop-color="#6d5faa"/></linearGradient></defs><title>file_type_kotlin</title><path d="M30,30H2V2H30L16,16Z" style="fill:url(#a)"/>`,
	dart: `<path d="M16.739,2.037a1.314,1.314,0,0,0-.916.377l-.013.01L7.22,7.389l8.566,8.566v.006l10.3,10.3,1.963-3.536L20.968,5.728l-3.3-3.3a1.307,1.307,0,0,0-.927-.388Z" style="fill:#66c3fa"/><path d="M7.25,7.35,2.288,15.931l-.01.013a1.322,1.322,0,0,0-.378.919,1.3,1.3,0,0,0,.387.924L6.4,21.9l16.084,6.327,3.636-2.02-.1-.1-.025,0-10.083-10.1H15.9L7.25,7.35Z" style="fill:#215896"/><path d="M7.192,7.362l8.764,8.773h.013l10.087,10.1,3.839-.732L29.9,14.14l-4.054-3.973a6.521,6.521,0,0,0-3.624-1.616l0-.044L7.192,7.362Z" style="fill:#235997"/><path d="M7.256,7.411l8.768,8.768v.013L26.116,26.284l-.734,3.839H14.022l-3.971-4.056a6.522,6.522,0,0,1-1.614-3.625l-.044,0L7.256,7.411Z" style="fill:#58b6f0"/>`,
};

const DECORATED_CLASS = "umos-codeblock-decorated";
const SHELL_CLASS = "umos-codeblock-shell";
let languageIconId = 0;

export function decorateCodeBlocks(root: HTMLElement): void {
	const blocks = Array.from(root.querySelectorAll<HTMLPreElement>("pre > code"))
		.map((code) => code.parentElement)
		.filter((pre): pre is HTMLPreElement => pre instanceof HTMLPreElement);

	for (const pre of blocks) {
		decoratePre(pre);
	}
}

function decoratePre(pre: HTMLPreElement): void {
	if (pre.classList.contains(DECORATED_CLASS) || pre.closest(`.${SHELL_CLASS}`)) return;
	if (pre.classList.contains("code-styler-pre") || pre.closest(".code-styler-pre-parent")) return;
	const code = pre.querySelector<HTMLElement>(":scope > code");
	if (!code) return;

	const rawCode = code.textContent ?? "";
	if (isIgnorableCodeBlock(pre, code, rawCode)) return;
	const language = getCodeLanguage(code);
	const meta = getLanguageMeta(language);
	const shell = document.createElement("div");
	shell.className = SHELL_CLASS;
	shell.style.setProperty("--umos-code-accent", meta.color);
	shell.dataset.language = language || "text";

	const header = document.createElement("div");
	header.className = "umos-codeblock-header";
	header.appendChild(createLanguageBadge(meta, language));

	const actions = document.createElement("div");
	actions.className = "umos-codeblock-actions";
	actions.appendChild(createCopyButton(rawCode));
	header.appendChild(actions);

	const body = document.createElement("div");
	body.className = "umos-codeblock-body";
	body.appendChild(createLineNumbers(rawCode));

	pre.classList.add(DECORATED_CLASS);
	pre.querySelectorAll("button.copy-code-button, button.run-code-button").forEach((button) => button.remove());
	pre.parentElement?.insertBefore(shell, pre);
	body.appendChild(pre);
	shell.appendChild(header);
	shell.appendChild(body);
}

function isIgnorableCodeBlock(pre: HTMLPreElement, code: HTMLElement, rawCode: string): boolean {
	if (rawCode.trim().length === 0) return true;
	if (pre.classList.contains("frontmatter") || code.classList.contains("frontmatter")) return true;
	if (pre.closest(".metadata-container, .frontmatter-container, .metadata-properties")) return true;
	return false;
}

function createLanguageBadge(meta: LanguageMeta, language: string): HTMLElement {
	const wrap = document.createElement("div");
	wrap.className = "umos-codeblock-language";

	wrap.appendChild(createCodeLanguageIconElement(language, meta));

	const label = document.createElement("span");
	label.className = "umos-codeblock-language-label";
	label.textContent = t(meta.label);
	wrap.appendChild(label);
	return wrap;
}

export function getCodeLanguageIconGalleryItems(): CodeLanguageIconGalleryItem[] {
	const languages = new Set([
		...Object.keys(CODE_STYLER_LANGUAGE_ICONS),
		...Object.keys(LANGUAGE_META),
	]);
	return Array.from(languages)
		.map((language) => {
			const meta = getLanguageMeta(language);
			return {
			language,
			label: meta.label,
			color: meta.color,
			hasSvg: Boolean(LANGUAGE_SVG_ICONS[language] ?? CODE_STYLER_LANGUAGE_ICONS[language]?.svg),
			};
		})
		.sort((a, b) => {
			if (a.hasSvg !== b.hasSvg) return a.hasSvg ? -1 : 1;
			return a.label.localeCompare(b.label);
		});
}

export function createCodeLanguageIconElement(language: string, metaOverride?: LanguageMeta): HTMLElement {
	const normalized = normalizeLanguage(language);
	const meta = metaOverride ?? getLanguageMeta(normalized);
	const icon = document.createElement("span");
	icon.className = "umos-codeblock-language-icon";
	icon.style.setProperty("--umos-code-accent", meta.color);
	const svg = LANGUAGE_SVG_ICONS[normalized] ?? CODE_STYLER_LANGUAGE_ICONS[normalized]?.svg;
	if (svg) {
		icon.addClass("is-svg");
		icon.appendChild(createLanguageSvg(svg));
	} else {
		icon.textContent = meta.icon;
	}
	return icon;
}

function createLanguageSvg(svgMarkup: string): SVGSVGElement {
	const scoped = scopeSvgIds(svgMarkup);
	if (scoped.trim().startsWith("<svg")) {
		const template = document.createElement("template");
		template.innerHTML = scoped.trim();
		const svg = template.content.firstElementChild;
		if (svg instanceof SVGSVGElement) return svg;
	}
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
	svg.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
	svg.setAttribute("viewBox", "0 0 32 32");
	svg.innerHTML = scoped;
	return svg;
}

function scopeSvgIds(svgMarkup: string): string {
	const prefix = `umos-code-icon-${++languageIconId}-`;
	return svgMarkup
		.replace(/\bid="([^"]+)"/g, `id="${prefix}$1"`)
		.replace(/url\(#([^)]+)\)/g, `url(#${prefix}$1)`)
		.replace(/xlink:href="#([^"]+)"/g, `xlink:href="#${prefix}$1"`)
		.replace(/href="#([^"]+)"/g, `href="#${prefix}$1"`);
}

function createCopyButton(rawCode: string): HTMLButtonElement {
	const button = document.createElement("button");
	button.type = "button";
	button.className = "umos-codeblock-copy";
	button.ariaLabel = t("Copy code");
	button.title = t("Copy code");
	const icon = button.createSpan({ cls: "umos-codeblock-copy-icon" });
	setIcon(icon, "copy");
	const label = button.createSpan({ cls: "umos-codeblock-copy-label", text: t("Copy") });
	button.addEventListener("click", async () => {
		try {
			await navigator.clipboard.writeText(rawCode.replace(/\n$/, ""));
			setIcon(icon, "check");
			label.setText(t("Copied"));
			window.setTimeout(() => {
				setIcon(icon, "copy");
				label.setText(t("Copy"));
			}, 1400);
		} catch (error) {
			new Notice(error instanceof Error ? error.message : String(error));
		}
	});
	return button;
}

function createLineNumbers(rawCode: string): HTMLElement {
	const gutter = document.createElement("div");
	gutter.className = "umos-codeblock-gutter";
	const count = Math.max(1, rawCode.replace(/\n$/, "").split(/\r?\n/).length);
	for (let index = 1; index <= count; index++) {
		gutter.createSpan({ text: String(index) });
	}
	return gutter;
}

function getCodeLanguage(code: HTMLElement): string {
	for (const className of Array.from(code.classList)) {
		const match = className.match(/^language-(.+)$/);
		if (match?.[1]) return normalizeLanguage(match[1]);
	}
	return "text";
}

function normalizeLanguage(language: string): string {
	const clean = language.trim().toLowerCase();
	return LANGUAGE_ALIASES[clean] ?? CODE_STYLER_LANGUAGE_ALIAS_MAP[clean] ?? clean;
}

function getLanguageMeta(language: string): LanguageMeta {
	if (LANGUAGE_META[language]) return LANGUAGE_META[language];
	const generated = CODE_STYLER_LANGUAGE_ICONS[language];
	if (generated) {
		return {
			label: generated.label,
			icon: getFallbackIcon(generated.label),
			color: generated.color || "#9ba8b6",
		};
	}
	const label = language
		? language.charAt(0).toUpperCase() + language.slice(1)
		: "Plain Text";
	return {
		label,
		icon: getFallbackIcon(label),
		color: "#9ba8b6",
	};
}

function getFallbackIcon(label: string): string {
	return label.replace(/[^a-z0-9+#]/gi, "").slice(0, 4).toUpperCase() || "TXT";
}
