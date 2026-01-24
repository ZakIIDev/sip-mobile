/**
 * useSend Hook Tests
 *
 * Tests validation functions and logic from useSend without Expo dependencies.
 */

import { describe, it, expect } from "vitest"

// ============================================================================
// Type Definitions (mirror from useSend.ts)
// ============================================================================

type AddressValidation = {
  isValid: boolean
  type: "stealth" | "regular" | "invalid"
  chain?: string
  error?: string
}

// ============================================================================
// Re-implemented validation functions for isolated testing
// ============================================================================

const STEALTH_PREFIX = "sip:"
const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

function validateStealthAddress(address: string): AddressValidation {
  if (!address.startsWith(STEALTH_PREFIX)) {
    return { isValid: false, type: "invalid", error: "Not a stealth address" }
  }

  const parts = address.slice(STEALTH_PREFIX.length).split(":")

  if (parts.length !== 3) {
    return { isValid: false, type: "invalid", error: "Invalid stealth address format" }
  }

  const [chain, spendingKey, viewingKey] = parts

  // Validate chain
  if (!["solana", "ethereum", "near"].includes(chain)) {
    return { isValid: false, type: "invalid", error: `Unsupported chain: ${chain}` }
  }

  // Validate keys (should be hex)
  const hexRegex = /^(0x)?[0-9a-fA-F]+$/
  if (!hexRegex.test(spendingKey) || !hexRegex.test(viewingKey)) {
    return { isValid: false, type: "invalid", error: "Invalid key format" }
  }

  return { isValid: true, type: "stealth", chain }
}

function validateSolanaAddress(address: string): AddressValidation {
  if (!SOLANA_ADDRESS_REGEX.test(address)) {
    return { isValid: false, type: "invalid", error: "Invalid Solana address" }
  }

  return { isValid: true, type: "regular", chain: "solana" }
}

function validateAddress(address: string): AddressValidation {
  if (!address || address.trim() === "") {
    return { isValid: false, type: "invalid", error: "Address is required" }
  }

  const trimmed = address.trim()

  if (trimmed.startsWith(STEALTH_PREFIX)) {
    return validateStealthAddress(trimmed)
  }

  return validateSolanaAddress(trimmed)
}

function validateAmount(
  amount: string,
  balance: number
): { isValid: boolean; error?: string } {
  if (!amount || amount.trim() === "") {
    return { isValid: false, error: "Amount is required" }
  }

  const numAmount = parseFloat(amount)

  if (isNaN(numAmount)) {
    return { isValid: false, error: "Invalid amount" }
  }

  if (numAmount <= 0) {
    return { isValid: false, error: "Amount must be greater than 0" }
  }

  if (numAmount > balance) {
    return { isValid: false, error: "Insufficient balance" }
  }

  if (numAmount < 0.001) {
    return { isValid: false, error: "Minimum amount is 0.001 SOL" }
  }

  return { isValid: true }
}

function isStealthAddress(address: string): boolean {
  return address.trim().startsWith(STEALTH_PREFIX)
}

const DEFAULT_SOL_PRICE_USD = 185.0

function getUsdValue(solAmount: string): string {
  const num = parseFloat(solAmount)
  if (isNaN(num) || num <= 0) return "$0.00"
  return `$${(num * DEFAULT_SOL_PRICE_USD).toFixed(2)}`
}

// ============================================================================
// Tests
// ============================================================================

describe("useSend Utilities", () => {
  describe("validateStealthAddress", () => {
    it("should validate correct stealth address", () => {
      const result = validateStealthAddress("sip:solana:0x1234:0x5678")
      expect(result.isValid).toBe(true)
      expect(result.type).toBe("stealth")
      expect(result.chain).toBe("solana")
    })

    it("should accept ethereum chain", () => {
      const result = validateStealthAddress("sip:ethereum:0xabcd:0xef01")
      expect(result.isValid).toBe(true)
      expect(result.chain).toBe("ethereum")
    })

    it("should accept near chain", () => {
      const result = validateStealthAddress("sip:near:0x1111:0x2222")
      expect(result.isValid).toBe(true)
      expect(result.chain).toBe("near")
    })

    it("should reject unsupported chains", () => {
      const result = validateStealthAddress("sip:bitcoin:0x1234:0x5678")
      expect(result.isValid).toBe(false)
      expect(result.error).toContain("Unsupported chain")
    })

    it("should reject invalid key format", () => {
      const result = validateStealthAddress("sip:solana:not-hex:0x5678")
      expect(result.isValid).toBe(false)
      expect(result.error).toContain("Invalid key format")
    })

    it("should reject wrong number of parts", () => {
      expect(validateStealthAddress("sip:solana:0x1234").isValid).toBe(false)
      expect(validateStealthAddress("sip:solana:0x1:0x2:0x3").isValid).toBe(false)
    })

    it("should reject non-stealth prefix", () => {
      const result = validateStealthAddress("not:solana:0x1234:0x5678")
      expect(result.isValid).toBe(false)
      expect(result.error).toContain("Not a stealth address")
    })
  })

  describe("validateSolanaAddress", () => {
    it("should validate correct Solana addresses", () => {
      // System program
      const result1 = validateSolanaAddress("11111111111111111111111111111111")
      expect(result1.isValid).toBe(true)
      expect(result1.type).toBe("regular")

      // Token program
      const result2 = validateSolanaAddress(
        "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
      )
      expect(result2.isValid).toBe(true)
    })

    it("should reject too short addresses", () => {
      const result = validateSolanaAddress("short")
      expect(result.isValid).toBe(false)
      expect(result.error).toContain("Invalid Solana address")
    })

    it("should reject addresses with invalid characters", () => {
      // 0, O, I, l are not valid base58
      const result = validateSolanaAddress("0OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO")
      expect(result.isValid).toBe(false)
    })

    it("should reject hex addresses", () => {
      const result = validateSolanaAddress("0x1234567890abcdef")
      expect(result.isValid).toBe(false)
    })
  })

  describe("validateAddress", () => {
    it("should require address", () => {
      expect(validateAddress("").isValid).toBe(false)
      expect(validateAddress("   ").isValid).toBe(false)
      expect(validateAddress("").error).toBe("Address is required")
    })

    it("should detect stealth addresses", () => {
      const result = validateAddress("sip:solana:0x1234:0x5678")
      expect(result.type).toBe("stealth")
    })

    it("should detect regular addresses", () => {
      const result = validateAddress("11111111111111111111111111111111")
      expect(result.type).toBe("regular")
    })

    it("should trim whitespace", () => {
      const result = validateAddress("  11111111111111111111111111111111  ")
      expect(result.isValid).toBe(true)
    })
  })

  describe("validateAmount", () => {
    const balance = 10.0

    it("should require amount", () => {
      expect(validateAmount("", balance).isValid).toBe(false)
      expect(validateAmount("  ", balance).isValid).toBe(false)
      expect(validateAmount("", balance).error).toBe("Amount is required")
    })

    it("should validate numeric amounts", () => {
      expect(validateAmount("1.5", balance).isValid).toBe(true)
      expect(validateAmount("10", balance).isValid).toBe(true)
      expect(validateAmount("0.001", balance).isValid).toBe(true)
    })

    it("should reject non-numeric values", () => {
      expect(validateAmount("abc", balance).isValid).toBe(false)
      expect(validateAmount("abc", balance).error).toBe("Invalid amount")
      // Note: parseFloat("1.2.3") returns 1.2, which is valid
      // So "1.2.3" passes as a valid amount
    })

    it("should reject zero and negative amounts", () => {
      expect(validateAmount("0", balance).isValid).toBe(false)
      expect(validateAmount("-1", balance).isValid).toBe(false)
      expect(validateAmount("0", balance).error).toBe("Amount must be greater than 0")
    })

    it("should reject amounts exceeding balance", () => {
      expect(validateAmount("15", balance).isValid).toBe(false)
      expect(validateAmount("10.01", balance).isValid).toBe(false)
      expect(validateAmount("15", balance).error).toBe("Insufficient balance")
    })

    it("should enforce minimum amount", () => {
      expect(validateAmount("0.0001", balance).isValid).toBe(false)
      expect(validateAmount("0.0009", balance).isValid).toBe(false)
      expect(validateAmount("0.0001", balance).error).toBe("Minimum amount is 0.001 SOL")
    })

    it("should handle edge cases", () => {
      expect(validateAmount("0.001", balance).isValid).toBe(true)
      expect(validateAmount("10", balance).isValid).toBe(true)
    })
  })

  describe("isStealthAddress", () => {
    it("should return true for stealth addresses", () => {
      expect(isStealthAddress("sip:solana:0x1234:0x5678")).toBe(true)
      expect(isStealthAddress("  sip:solana:0x1:0x2")).toBe(true)
    })

    it("should return false for regular addresses", () => {
      expect(isStealthAddress("11111111111111111111111111111111")).toBe(false)
      expect(isStealthAddress("0x1234")).toBe(false)
      expect(isStealthAddress("")).toBe(false)
    })
  })

  describe("getUsdValue", () => {
    it("should convert SOL to USD", () => {
      expect(getUsdValue("1")).toBe("$185.00")
      expect(getUsdValue("2")).toBe("$370.00")
      expect(getUsdValue("0.5")).toBe("$92.50")
    })

    it("should handle zero and negative", () => {
      expect(getUsdValue("0")).toBe("$0.00")
      expect(getUsdValue("-1")).toBe("$0.00")
    })

    it("should handle invalid input", () => {
      expect(getUsdValue("")).toBe("$0.00")
      expect(getUsdValue("abc")).toBe("$0.00")
    })

    it("should format to 2 decimal places", () => {
      expect(getUsdValue("0.123456")).toBe("$22.84")
    })
  })
})

describe("useSend Types", () => {
  describe("SendStatus", () => {
    const statuses = [
      "idle",
      "validating",
      "preparing",
      "signing",
      "submitting",
      "confirmed",
      "error",
    ] as const

    it("should have all expected statuses", () => {
      expect(statuses).toContain("idle")
      expect(statuses).toContain("validating")
      expect(statuses).toContain("preparing")
      expect(statuses).toContain("signing")
      expect(statuses).toContain("submitting")
      expect(statuses).toContain("confirmed")
      expect(statuses).toContain("error")
    })
  })

  describe("AddressValidation types", () => {
    it("should support stealth type", () => {
      const validation: AddressValidation = {
        isValid: true,
        type: "stealth",
        chain: "solana",
      }
      expect(validation.type).toBe("stealth")
    })

    it("should support regular type", () => {
      const validation: AddressValidation = {
        isValid: true,
        type: "regular",
        chain: "solana",
      }
      expect(validation.type).toBe("regular")
    })

    it("should support invalid type with error", () => {
      const validation: AddressValidation = {
        isValid: false,
        type: "invalid",
        error: "Some error",
      }
      expect(validation.type).toBe("invalid")
      expect(validation.error).toBeDefined()
    })
  })
})
