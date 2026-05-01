/**
 * Secure cookie storage tests for parentbench-0i0.
 *
 * Two storage tiers:
 *   1. OS keychain via keytar (default)
 *   2. AES-GCM encrypted-at-rest fallback (CI / Docker without keychain)
 *
 * Plaintext storage is explicitly rejected. Expiring cookies (≤7d)
 * surface as warnings.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import os from "os";
import path from "path";
import fs from "fs";

type StoredCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number; // unix seconds, -1 for session
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
};

const sampleCookies: StoredCookie[] = [
  {
    name: "session_token",
    value: "abc123",
    domain: "chatgpt.com",
    path: "/",
    expires: Math.floor(Date.now() / 1000) + 30 * 86400,
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
  },
  {
    name: "csrf",
    value: "xyz",
    domain: "chatgpt.com",
    path: "/",
    expires: Math.floor(Date.now() / 1000) + 86400,
  },
];

// In-memory keychain mock that mimics keytar's API surface.
const keychain = new Map<string, string>();
function keychainKey(service: string, account: string) {
  return `${service}::${account}`;
}

vi.mock("keytar", () => ({
  default: {
    setPassword: async (service: string, account: string, password: string) => {
      keychain.set(keychainKey(service, account), password);
    },
    getPassword: async (
      service: string,
      account: string
    ): Promise<string | null> =>
      keychain.get(keychainKey(service, account)) ?? null,
    deletePassword: async (
      service: string,
      account: string
    ): Promise<boolean> => keychain.delete(keychainKey(service, account)),
  },
}));

beforeEach(() => {
  vi.resetModules();
  keychain.clear();
});

describe("Keychain tier (default)", () => {
  it("should_round_trip_cookies_through_the_keychain", async () => {
    // Arrange
    const { saveCookies, loadCookies } = await import(
      "@/lib/eval/cookie-store"
    );

    // Act
    await saveCookies("chatgpt", "adult", sampleCookies, { tier: "keychain" });
    const result = await loadCookies("chatgpt", "adult", { tier: "keychain" });

    // Assert
    expect(result).toEqual(sampleCookies);
  });

  it("should_throw_when_no_cookies_have_been_saved_for_provider_account", async () => {
    // Arrange
    const { loadCookies } = await import("@/lib/eval/cookie-store");

    // Act + Assert
    await expect(
      loadCookies("chatgpt", "adult", { tier: "keychain" })
    ).rejects.toThrow(/no cookies/i);
  });

  it("should_isolate_cookies_per_provider_account_pair", async () => {
    // Arrange
    const { saveCookies, loadCookies } = await import(
      "@/lib/eval/cookie-store"
    );
    await saveCookies("chatgpt", "adult", sampleCookies, { tier: "keychain" });
    await saveCookies("claude", "adult", [sampleCookies[0]], {
      tier: "keychain",
    });

    // Act
    const chatgptCookies = await loadCookies("chatgpt", "adult", {
      tier: "keychain",
    });
    const claudeCookies = await loadCookies("claude", "adult", {
      tier: "keychain",
    });

    // Assert
    expect(chatgptCookies).toHaveLength(2);
    expect(claudeCookies).toHaveLength(1);
  });
});

describe("Encrypted-file fallback tier", () => {
  const tmpDir = path.join(os.tmpdir(), `cookie-store-test-${process.pid}`);
  const passphrase = "correct-horse-battery-staple";

  beforeEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  it("should_round_trip_cookies_through_an_encrypted_file", async () => {
    // Arrange
    const { saveCookies, loadCookies } = await import(
      "@/lib/eval/cookie-store"
    );

    // Act
    await saveCookies("chatgpt", "adult", sampleCookies, {
      tier: "encrypted-file",
      passphrase,
      dir: tmpDir,
    });
    const result = await loadCookies("chatgpt", "adult", {
      tier: "encrypted-file",
      passphrase,
      dir: tmpDir,
    });

    // Assert
    expect(result).toEqual(sampleCookies);
  });

  it("should_write_a_file_with_chmod_600_permissions", async () => {
    // Arrange
    const { saveCookies, encryptedFilePath } = await import(
      "@/lib/eval/cookie-store"
    );

    // Act
    await saveCookies("chatgpt", "adult", sampleCookies, {
      tier: "encrypted-file",
      passphrase,
      dir: tmpDir,
    });
    const filePath = encryptedFilePath(tmpDir, "chatgpt", "adult");
    const stat = fs.statSync(filePath);

    // Assert — owner read/write only.
    expect(stat.mode & 0o777).toBe(0o600);
  });

  it("should_reject_decryption_with_wrong_passphrase", async () => {
    // Arrange
    const { saveCookies, loadCookies } = await import(
      "@/lib/eval/cookie-store"
    );
    await saveCookies("chatgpt", "adult", sampleCookies, {
      tier: "encrypted-file",
      passphrase,
      dir: tmpDir,
    });

    // Act + Assert
    await expect(
      loadCookies("chatgpt", "adult", {
        tier: "encrypted-file",
        passphrase: "wrong",
        dir: tmpDir,
      })
    ).rejects.toThrow();
  });

  it("should_not_write_plaintext_cookie_values_to_disk", async () => {
    // Arrange
    const { saveCookies, encryptedFilePath } = await import(
      "@/lib/eval/cookie-store"
    );

    // Act
    await saveCookies("chatgpt", "adult", sampleCookies, {
      tier: "encrypted-file",
      passphrase,
      dir: tmpDir,
    });
    const filePath = encryptedFilePath(tmpDir, "chatgpt", "adult");
    const raw = fs.readFileSync(filePath, "utf-8");

    // Assert — the cookie value must not appear in plaintext.
    expect(raw).not.toContain("abc123");
    expect(raw).not.toContain("session_token");
  });
});

describe("Plaintext is rejected", () => {
  it("should_throw_when_tier_is_plaintext", async () => {
    // Arrange
    const { saveCookies } = await import("@/lib/eval/cookie-store");

    // Act + Assert
    await expect(
      saveCookies("chatgpt", "adult", sampleCookies, {
        // @ts-expect-error — runtime guard, not a valid type.
        tier: "plaintext",
      })
    ).rejects.toThrow(/plaintext/i);
  });
});

describe("Expiry warnings", () => {
  it("should_flag_cookies_expiring_within_threshold_days", async () => {
    // Arrange
    const { listExpiring } = await import("@/lib/eval/cookie-store");
    const now = Math.floor(Date.now() / 1000);
    const cookies: StoredCookie[] = [
      { ...sampleCookies[0], expires: now + 3 * 86400 }, // 3 days
      { ...sampleCookies[1], expires: now + 30 * 86400 }, // 30 days
    ];

    // Act
    const expiring = listExpiring(cookies, 7);

    // Assert
    expect(expiring).toHaveLength(1);
    expect(expiring[0].name).toBe(sampleCookies[0].name);
  });

  it("should_treat_session_cookies_with_negative_expires_as_not_expiring", async () => {
    // Arrange
    const { listExpiring } = await import("@/lib/eval/cookie-store");
    const cookies: StoredCookie[] = [{ ...sampleCookies[0], expires: -1 }];

    // Act
    const expiring = listExpiring(cookies, 7);

    // Assert
    expect(expiring).toEqual([]);
  });

  it("should_return_empty_when_threshold_is_zero", async () => {
    // Arrange
    const { listExpiring } = await import("@/lib/eval/cookie-store");
    const now = Math.floor(Date.now() / 1000);
    const cookies: StoredCookie[] = [
      { ...sampleCookies[0], expires: now + 86400 },
    ];

    // Act
    const expiring = listExpiring(cookies, 0);

    // Assert
    expect(expiring).toEqual([]);
  });
});
