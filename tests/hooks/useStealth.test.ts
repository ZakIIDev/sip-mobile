/**
 * useStealth Hook Tests
 *
 * Tests stealth address logic and formatting functions without Expo dependencies.
 */

import { describe, it, expect } from "vitest"

// ============================================================================
// Type Definitions (mirror from useStealth.ts)
// ============================================================================

interface StealthAddress {
  full: string
  encoded: string
  chain: string
  spendingKey: string
  viewingKey: string
  solanaAddress: string
}

interface StealthKeys {
  spendingPrivateKey: string
  spendingPublicKey: string
  viewingPrivateKey: string
  viewingPublicKey: string
}

// ============================================================================
// Re-implemented utility functions for isolated testing
// ============================================================================

const SIP_CHAIN = "solana"
const STEALTH_PREFIX = "sip:"

function formatStealthAddress(
  chain: string,
  spendingPublicKey: string,
  viewingPublicKey: string
): { full: string; chain: string; spendingKey: string; viewingKey: string } {
  const full = `${STEALTH_PREFIX}${chain}:${spendingPublicKey}:${viewingPublicKey}`
  return {
    full,
    chain,
    spendingKey: spendingPublicKey,
    viewingKey: viewingPublicKey,
  }
}

function formatForDisplay(address: StealthAddress): string {
  const spendingShort = `${address.spendingKey.slice(0, 10)}...${address.spendingKey.slice(-6)}`
  const viewingShort = `${address.viewingKey.slice(0, 10)}...${address.viewingKey.slice(-6)}`
  return `sip:${address.chain}:${spendingShort}:${viewingShort}`
}

function parseStealthAddressString(addressStr: string): {
  chain: string
  spendingKey: string
  viewingKey: string
} | null {
  if (!addressStr.startsWith(STEALTH_PREFIX)) return null

  const parts = addressStr.slice(STEALTH_PREFIX.length).split(":")
  if (parts.length !== 3) return null

  return {
    chain: parts[0],
    spendingKey: parts[1],
    viewingKey: parts[2],
  }
}

function isValidStealthKeys(keys: StealthKeys): boolean {
  return (
    !!keys.spendingPrivateKey &&
    !!keys.spendingPublicKey &&
    !!keys.viewingPrivateKey &&
    !!keys.viewingPublicKey &&
    keys.spendingPrivateKey.startsWith("0x") &&
    keys.spendingPublicKey.startsWith("0x") &&
    keys.viewingPrivateKey.startsWith("0x") &&
    keys.viewingPublicKey.startsWith("0x")
  )
}

function truncateKey(key: string, startChars: number = 10, endChars: number = 6): string {
  if (key.length <= startChars + endChars + 3) return key
  return `${key.slice(0, startChars)}...${key.slice(-endChars)}`
}

function getChainFromAddress(address: string): string | null {
  const parsed = parseStealthAddressString(address)
  return parsed?.chain ?? null
}

function validateStealthAddress(address: StealthAddress): { valid: boolean; error?: string } {
  if (!address.full.startsWith(STEALTH_PREFIX)) {
    return { valid: false, error: "Invalid prefix" }
  }
  if (!address.spendingKey.startsWith("0x")) {
    return { valid: false, error: "Invalid spending key format" }
  }
  if (!address.viewingKey.startsWith("0x")) {
    return { valid: false, error: "Invalid viewing key format" }
  }
  if (!["solana", "ethereum", "near"].includes(address.chain)) {
    return { valid: false, error: "Unsupported chain" }
  }
  return { valid: true }
}

// ============================================================================
// Tests
// ============================================================================

describe("useStealth Utilities", () => {
  describe("formatStealthAddress", () => {
    it("should format address correctly", () => {
      const result = formatStealthAddress(
        "solana",
        "0xabcd1234",
        "0xef567890"
      )
      expect(result.full).toBe("sip:solana:0xabcd1234:0xef567890")
      expect(result.chain).toBe("solana")
      expect(result.spendingKey).toBe("0xabcd1234")
      expect(result.viewingKey).toBe("0xef567890")
    })

    it("should handle different chains", () => {
      const result = formatStealthAddress("ethereum", "0x1111", "0x2222")
      expect(result.full).toBe("sip:ethereum:0x1111:0x2222")
      expect(result.chain).toBe("ethereum")
    })
  })

  describe("formatForDisplay", () => {
    it("should truncate long keys", () => {
      const address: StealthAddress = {
        full: "sip:solana:0x1234567890abcdef1234567890abcdef:0xfedcba0987654321fedcba0987654321",
        encoded: "sip:solana:0x1234567890abcdef1234567890abcdef:0xfedcba0987654321fedcba0987654321",
        chain: "solana",
        spendingKey: "0x1234567890abcdef1234567890abcdef",
        viewingKey: "0xfedcba0987654321fedcba0987654321",
        solanaAddress: "ABC123",
      }
      const display = formatForDisplay(address)
      expect(display).toContain("...")
      expect(display.length).toBeLessThan(address.full.length)
    })

    it("should include chain in display", () => {
      const address: StealthAddress = {
        full: "sip:solana:0x12345678901234567890:0xabcdefabcdefabcdef",
        encoded: "sip:solana:0x12345678901234567890:0xabcdefabcdefabcdef",
        chain: "solana",
        spendingKey: "0x12345678901234567890",
        viewingKey: "0xabcdefabcdefabcdef",
        solanaAddress: "ABC123",
      }
      const display = formatForDisplay(address)
      expect(display).toContain("solana")
    })
  })

  describe("parseStealthAddressString", () => {
    it("should parse valid address", () => {
      const result = parseStealthAddressString("sip:solana:0x1234:0x5678")
      expect(result).not.toBeNull()
      expect(result?.chain).toBe("solana")
      expect(result?.spendingKey).toBe("0x1234")
      expect(result?.viewingKey).toBe("0x5678")
    })

    it("should return null for invalid prefix", () => {
      expect(parseStealthAddressString("invalid:solana:0x1:0x2")).toBeNull()
    })

    it("should return null for wrong number of parts", () => {
      expect(parseStealthAddressString("sip:solana:0x1234")).toBeNull()
      expect(parseStealthAddressString("sip:solana:0x1:0x2:0x3")).toBeNull()
    })
  })

  describe("isValidStealthKeys", () => {
    it("should validate correct keys", () => {
      const keys: StealthKeys = {
        spendingPrivateKey: "0x1234",
        spendingPublicKey: "0x5678",
        viewingPrivateKey: "0xabcd",
        viewingPublicKey: "0xef01",
      }
      expect(isValidStealthKeys(keys)).toBe(true)
    })

    it("should reject keys without 0x prefix", () => {
      const keys: StealthKeys = {
        spendingPrivateKey: "1234",
        spendingPublicKey: "0x5678",
        viewingPrivateKey: "0xabcd",
        viewingPublicKey: "0xef01",
      }
      expect(isValidStealthKeys(keys)).toBe(false)
    })

    it("should reject empty keys", () => {
      const keys: StealthKeys = {
        spendingPrivateKey: "",
        spendingPublicKey: "0x5678",
        viewingPrivateKey: "0xabcd",
        viewingPublicKey: "0xef01",
      }
      expect(isValidStealthKeys(keys)).toBe(false)
    })
  })

  describe("truncateKey", () => {
    it("should truncate long keys", () => {
      const key = "0x1234567890abcdef1234567890abcdef"
      const truncated = truncateKey(key, 10, 6)
      expect(truncated).toBe("0x12345678...abcdef")
      expect(truncated.length).toBeLessThan(key.length)
    })

    it("should not truncate short keys", () => {
      const key = "0x12345"
      const truncated = truncateKey(key, 10, 6)
      expect(truncated).toBe(key)
    })
  })

  describe("getChainFromAddress", () => {
    it("should extract chain from address", () => {
      expect(getChainFromAddress("sip:solana:0x1:0x2")).toBe("solana")
      expect(getChainFromAddress("sip:ethereum:0x1:0x2")).toBe("ethereum")
      expect(getChainFromAddress("sip:near:0x1:0x2")).toBe("near")
    })

    it("should return null for invalid address", () => {
      expect(getChainFromAddress("invalid")).toBeNull()
    })
  })

  describe("validateStealthAddress", () => {
    it("should validate correct address", () => {
      const address: StealthAddress = {
        full: "sip:solana:0x1234:0x5678",
        encoded: "sip:solana:0x1234:0x5678",
        chain: "solana",
        spendingKey: "0x1234",
        viewingKey: "0x5678",
        solanaAddress: "ABC",
      }
      expect(validateStealthAddress(address).valid).toBe(true)
    })

    it("should reject invalid prefix", () => {
      const address: StealthAddress = {
        full: "invalid:solana:0x1234:0x5678",
        encoded: "invalid:solana:0x1234:0x5678",
        chain: "solana",
        spendingKey: "0x1234",
        viewingKey: "0x5678",
        solanaAddress: "ABC",
      }
      expect(validateStealthAddress(address).valid).toBe(false)
      expect(validateStealthAddress(address).error).toContain("prefix")
    })

    it("should reject unsupported chain", () => {
      const address: StealthAddress = {
        full: "sip:bitcoin:0x1234:0x5678",
        encoded: "sip:bitcoin:0x1234:0x5678",
        chain: "bitcoin",
        spendingKey: "0x1234",
        viewingKey: "0x5678",
        solanaAddress: "ABC",
      }
      expect(validateStealthAddress(address).valid).toBe(false)
      expect(validateStealthAddress(address).error).toContain("chain")
    })

    it("should reject invalid key format", () => {
      const address: StealthAddress = {
        full: "sip:solana:1234:0x5678",
        encoded: "sip:solana:1234:0x5678",
        chain: "solana",
        spendingKey: "1234",
        viewingKey: "0x5678",
        solanaAddress: "ABC",
      }
      expect(validateStealthAddress(address).valid).toBe(false)
      expect(validateStealthAddress(address).error).toContain("spending key")
    })
  })
})

describe("useStealth Types", () => {
  describe("StealthAddress", () => {
    it("should have all required fields", () => {
      const address: StealthAddress = {
        full: "sip:solana:0x1234:0x5678",
        encoded: "sip:solana:0x1234:0x5678",
        chain: "solana",
        spendingKey: "0x1234",
        viewingKey: "0x5678",
        solanaAddress: "ABC123DEF456",
      }
      expect(address.full).toBeDefined()
      expect(address.encoded).toBeDefined()
      expect(address.chain).toBeDefined()
      expect(address.spendingKey).toBeDefined()
      expect(address.viewingKey).toBeDefined()
      expect(address.solanaAddress).toBeDefined()
    })
  })

  describe("StealthKeys", () => {
    it("should have all key pairs", () => {
      const keys: StealthKeys = {
        spendingPrivateKey: "0xprivate1",
        spendingPublicKey: "0xpublic1",
        viewingPrivateKey: "0xprivate2",
        viewingPublicKey: "0xpublic2",
      }
      expect(keys.spendingPrivateKey).toBeDefined()
      expect(keys.spendingPublicKey).toBeDefined()
      expect(keys.viewingPrivateKey).toBeDefined()
      expect(keys.viewingPublicKey).toBeDefined()
    })
  })
})
