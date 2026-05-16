import type { EncryptedPayload } from "./types";

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();
const PBKDF2_ITERATIONS = 210_000;

export async function sha256Hex(data: ArrayBuffer): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", data);
	return bytesToHex(new Uint8Array(digest));
}

export async function sha256TextHex(text: string): Promise<string> {
	return sha256Hex(toArrayBuffer(TEXT_ENCODER.encode(text)));
}

export async function encryptBytes(data: ArrayBuffer, passphrase: string): Promise<{ payload: ArrayBuffer; salt: string; iv: string }> {
	assertPassphrase(passphrase);
	const saltBytes = crypto.getRandomValues(new Uint8Array(16));
	const ivBytes = crypto.getRandomValues(new Uint8Array(12));
	const key = await deriveAesKey(passphrase, saltBytes);
	const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: toArrayBuffer(ivBytes) }, key, data);
	return {
		payload: encrypted,
		salt: bytesToBase64(saltBytes),
		iv: bytesToBase64(ivBytes),
	};
}

export async function decryptBytes(data: ArrayBuffer, passphrase: string, salt: string, iv: string): Promise<ArrayBuffer> {
	assertPassphrase(passphrase);
	const saltBytes = base64ToBytes(salt);
	const ivBytes = base64ToBytes(iv);
	const key = await deriveAesKey(passphrase, saltBytes);
	return crypto.subtle.decrypt({ name: "AES-GCM", iv: toArrayBuffer(ivBytes) }, key, data);
}

export async function encryptJson(value: unknown, passphrase: string): Promise<ArrayBuffer> {
	const raw = TEXT_ENCODER.encode(JSON.stringify(value));
	const encrypted = await encryptBytes(toArrayBuffer(raw), passphrase);
	const payload: EncryptedPayload = {
		version: 1,
		algorithm: "AES-256-GCM/PBKDF2-SHA256",
		salt: encrypted.salt,
		iv: encrypted.iv,
		data: bytesToBase64(new Uint8Array(encrypted.payload)),
	};
	return toArrayBuffer(TEXT_ENCODER.encode(JSON.stringify(payload, null, 2)));
}

export async function decryptJson<T>(data: ArrayBuffer, passphrase: string): Promise<T> {
	let payload: EncryptedPayload;
	try {
		payload = JSON.parse(TEXT_DECODER.decode(data)) as EncryptedPayload;
	} catch {
		throw new Error("Remote encrypted manifest is not valid JSON");
	}
	if (payload.version !== 1 || payload.algorithm !== "AES-256-GCM/PBKDF2-SHA256") {
		throw new Error("Unsupported encrypted payload format");
	}
	const decrypted = await decryptBytes(toArrayBuffer(base64ToBytes(payload.data)), passphrase, payload.salt, payload.iv);
	return JSON.parse(TEXT_DECODER.decode(decrypted)) as T;
}

export function stringToArrayBuffer(value: string): ArrayBuffer {
	return toArrayBuffer(TEXT_ENCODER.encode(value));
}

export function arrayBufferToString(value: ArrayBuffer): string {
	return TEXT_DECODER.decode(value);
}

export function bytesToBase64(bytes: Uint8Array): string {
	let binary = "";
	const chunkSize = 0x8000;
	for (let i = 0; i < bytes.length; i += chunkSize) {
		const chunk = bytes.subarray(i, i + chunkSize);
		binary += String.fromCharCode(...Array.from(chunk));
	}
	return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
	const binary = atob(value);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

function assertPassphrase(passphrase: string): void {
	if (!passphrase.trim()) {
		throw new Error("Encryption password is required");
	}
}

async function deriveAesKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		toArrayBuffer(TEXT_ENCODER.encode(passphrase)),
		"PBKDF2",
		false,
		["deriveKey"]
	);
	return crypto.subtle.deriveKey(
		{
			name: "PBKDF2",
			salt: toArrayBuffer(salt),
			iterations: PBKDF2_ITERATIONS,
			hash: "SHA-256",
		},
		keyMaterial,
		{ name: "AES-GCM", length: 256 },
		false,
		["encrypt", "decrypt"]
	);
}

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	const copy = new Uint8Array(bytes.byteLength);
	copy.set(bytes);
	return copy.buffer as ArrayBuffer;
}
