/**
 * Secure cookie storage for the consumer-products track (parentbench-0i0).
 *
 * Two tiers:
 *   - "keychain" (default): keytar → OS keychain (macOS Keychain,
 *     Windows Credential Manager, libsecret on Linux). Single
 *     JSON-serialized secret per (provider, account) pair.
 *   - "encrypted-file": AES-256-GCM with operator passphrase. File
 *     written with chmod 600 to ~/.parentbench/cookies/. For CI /
 *     Docker without keychain access.
 *
 * Plaintext storage is REJECTED at the runtime layer — any caller
 * passing { tier: "plaintext" } gets an error. Browser-eval session
 * cookies are reusable auth tokens, not config files.
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";

// ============================================================================
// TYPES
// ============================================================================

export type StoredCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
};

export type CookieStoreOptions =
  | { tier: "keychain" }
  | { tier: "encrypted-file"; passphrase: string; dir: string };

const SERVICE_NAMESPACE = "parentbench:browser-eval";

/**
 * Resolve cookie-store options from PARENTBENCH_COOKIE_TIER /
 * PARENTBENCH_COOKIE_PASSPHRASE / PARENTBENCH_COOKIE_DIR env vars.
 * Defaults to keychain. Throws if encrypted-file is requested without
 * a passphrase.
 */
export function cookieStoreOptionsFromEnv(): CookieStoreOptions {
  const env = typeof process !== "undefined" ? process.env : ({} as NodeJS.ProcessEnv);
  if (env.PARENTBENCH_COOKIE_TIER === "encrypted-file") {
    const passphrase = env.PARENTBENCH_COOKIE_PASSPHRASE;
    if (!passphrase) {
      throw new Error(
        "PARENTBENCH_COOKIE_PASSPHRASE required for encrypted-file tier"
      );
    }
    const home = env.HOME ?? "";
    const dir = env.PARENTBENCH_COOKIE_DIR ?? `${home}/.parentbench/cookies`;
    return { tier: "encrypted-file", passphrase, dir };
  }
  return { tier: "keychain" };
}

// ============================================================================
// PUBLIC API
// ============================================================================

export async function saveCookies(
  provider: string,
  account: string,
  cookies: StoredCookie[],
  options: CookieStoreOptions
): Promise<void> {
  rejectPlaintext(options);
  if (options.tier === "keychain") {
    await keychainSave(provider, account, cookies);
    return;
  }
  encryptedFileSave(
    provider,
    account,
    cookies,
    options.passphrase,
    options.dir
  );
}

export async function loadCookies(
  provider: string,
  account: string,
  options: CookieStoreOptions
): Promise<StoredCookie[]> {
  rejectPlaintext(options);
  if (options.tier === "keychain") {
    return keychainLoad(provider, account);
  }
  return encryptedFileLoad(
    provider,
    account,
    options.passphrase,
    options.dir
  );
}

export function encryptedFilePath(
  dir: string,
  provider: string,
  account: string
): string {
  return path.join(dir, `${provider}.${account}.enc`);
}

/**
 * Cookies expiring within `thresholdDays`. Session cookies (negative
 * `expires`) are treated as non-expiring for the purposes of this
 * warning. A threshold of 0 disables the check.
 */
export function listExpiring(
  cookies: StoredCookie[],
  thresholdDays: number
): StoredCookie[] {
  if (thresholdDays <= 0) return [];
  const now = Math.floor(Date.now() / 1000);
  const cutoff = now + thresholdDays * 86400;
  return cookies.filter((c) => c.expires > 0 && c.expires <= cutoff);
}

// ============================================================================
// IMPLEMENTATION — keychain tier
// ============================================================================

async function keychainSave(
  provider: string,
  account: string,
  cookies: StoredCookie[]
): Promise<void> {
  const keytar = await loadKeytar();
  await keytar.setPassword(
    SERVICE_NAMESPACE,
    `${provider}:${account}`,
    JSON.stringify(cookies)
  );
}

async function keychainLoad(
  provider: string,
  account: string
): Promise<StoredCookie[]> {
  const keytar = await loadKeytar();
  const raw = await keytar.getPassword(
    SERVICE_NAMESPACE,
    `${provider}:${account}`
  );
  if (raw === null || raw === undefined) {
    throw new Error(
      `No cookies found for ${provider}/${account} in keychain. ` +
        `Refresh with: npx tsx scripts/refresh-browser-cookies.ts ${provider} ${account}`
    );
  }
  return JSON.parse(raw) as StoredCookie[];
}

type KeytarLike = {
  setPassword: (s: string, a: string, p: string) => Promise<void>;
  getPassword: (s: string, a: string) => Promise<string | null>;
  deletePassword?: (s: string, a: string) => Promise<boolean>;
};

async function loadKeytar(): Promise<KeytarLike> {
  // keytar is a native dep; it can fail to load on some CI/Docker
  // environments. The encrypted-file tier exists for those cases —
  // surface the failure with an actionable message rather than a
  // node-gyp stack trace.
  try {
    const mod = await import("keytar");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (mod as any).default ?? (mod as unknown as KeytarLike);
  } catch (err) {
    throw new Error(
      `Keychain unavailable (${
        err instanceof Error ? err.message : String(err)
      }). Use { tier: "encrypted-file" } instead.`
    );
  }
}

// ============================================================================
// IMPLEMENTATION — encrypted-file tier (AES-256-GCM)
// ============================================================================

const KDF_ITERATIONS = 200_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const KEY_BYTES = 32;
const FILE_VERSION = 1;

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(
    passphrase,
    salt,
    KDF_ITERATIONS,
    KEY_BYTES,
    "sha256"
  );
}

function encryptedFileSave(
  provider: string,
  account: string,
  cookies: StoredCookie[],
  passphrase: string,
  dir: string
): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  const plaintext = Buffer.from(JSON.stringify(cookies), "utf-8");
  const salt = crypto.randomBytes(SALT_BYTES);
  const iv = crypto.randomBytes(IV_BYTES);
  const key = deriveKey(passphrase, salt);

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  const payload = {
    v: FILE_VERSION,
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    ct: ciphertext.toString("base64"),
    tag: authTag.toString("base64"),
  };

  const filePath = encryptedFilePath(dir, provider, account);
  fs.writeFileSync(filePath, JSON.stringify(payload), { mode: 0o600 });
  // Re-chmod after the write — some umasks override mode on initial create.
  fs.chmodSync(filePath, 0o600);
}

function encryptedFileLoad(
  provider: string,
  account: string,
  passphrase: string,
  dir: string
): StoredCookie[] {
  const filePath = encryptedFilePath(dir, provider, account);
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `No cookies found at ${filePath}. ` +
        `Refresh with: npx tsx scripts/refresh-browser-cookies.ts ${provider} ${account}`
    );
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  const payload = JSON.parse(raw) as {
    v: number;
    salt: string;
    iv: string;
    ct: string;
    tag: string;
  };

  if (payload.v !== FILE_VERSION) {
    throw new Error(
      `Unsupported encrypted-cookie file version: ${payload.v}`
    );
  }

  const salt = Buffer.from(payload.salt, "base64");
  const iv = Buffer.from(payload.iv, "base64");
  const ct = Buffer.from(payload.ct, "base64");
  const tag = Buffer.from(payload.tag, "base64");

  const key = deriveKey(passphrase, salt);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  // GCM throws on auth-tag mismatch, which is exactly what we want for
  // wrong-passphrase rejection.
  const plaintext = Buffer.concat([decipher.update(ct), decipher.final()]);
  return JSON.parse(plaintext.toString("utf-8")) as StoredCookie[];
}

// ============================================================================
// PLAINTEXT GUARD
// ============================================================================

function rejectPlaintext(options: CookieStoreOptions | { tier: string }): void {
  if (options.tier !== "keychain" && options.tier !== "encrypted-file") {
    throw new Error(
      `Plaintext cookie storage is rejected. Use tier "keychain" or "encrypted-file".`
    );
  }
}
