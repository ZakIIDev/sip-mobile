/**
 * useClaim Hook Tests
 *
 * Tests claim logic and utility functions without Expo dependencies.
 */

import { describe, it, expect } from "vitest"

// ============================================================================
// Type Definitions (mirror from useClaim.ts)
// ============================================================================

type ClaimStatus =
  | "idle"
  | "deriving"
  | "signing"
  | "submitting"
  | "confirmed"
  | "error"

interface ClaimProgress {
  status: ClaimStatus
  message: string
  step: number
  totalSteps: number
}

interface ClaimResult {
  success: boolean
  txHash?: string
  error?: string
}

interface StealthAddress {
  address: string
  ephemeralPublicKey: string
  viewTag: number
}

// ============================================================================
// Re-implemented utility functions for isolated testing
// ============================================================================

const CLAIM_STEPS = 4

function createProgress(
  status: ClaimStatus,
  message: string,
  step: number
): ClaimProgress {
  return {
    status,
    message,
    step,
    totalSteps: CLAIM_STEPS,
  }
}

function parsePaymentStealthAddress(
  addressStr: string | undefined
): StealthAddress | null {
  if (!addressStr) return null

  // Try to parse SIP format: sip:solana:<ephemeral>:derived
  if (addressStr.startsWith("sip:")) {
    const parts = addressStr.split(":")
    if (parts.length >= 3) {
      const ephemeralPubKey = parts[2]
      // Derive view tag from ephemeral key (first byte of hash)
      const viewTag = parseInt(ephemeralPubKey.slice(2, 4), 16)
      return {
        address: parts[3] || "",
        ephemeralPublicKey: ephemeralPubKey.startsWith("0x")
          ? ephemeralPubKey
          : `0x${ephemeralPubKey}`,
        viewTag,
      }
    }
  }

  return null
}

function getProgressMessage(status: ClaimStatus): string {
  switch (status) {
    case "idle":
      return "Ready to claim"
    case "deriving":
      return "Deriving spending key..."
    case "signing":
      return "Building claim transaction..."
    case "submitting":
      return "Submitting to network..."
    case "confirmed":
      return "Claim successful!"
    case "error":
      return "Claim failed"
    default:
      return ""
  }
}

function isClaimComplete(status: ClaimStatus): boolean {
  return status === "confirmed" || status === "error"
}

function isClaimInProgress(status: ClaimStatus): boolean {
  return (
    status === "deriving" || status === "signing" || status === "submitting"
  )
}

function canClaim(paymentStatus: string, claimed: boolean): boolean {
  return paymentStatus === "completed" && !claimed
}

// ============================================================================
// Tests
// ============================================================================

describe("useClaim Utilities", () => {
  describe("parsePaymentStealthAddress", () => {
    it("should parse valid SIP format address", () => {
      const result = parsePaymentStealthAddress(
        "sip:solana:0xabcdef1234:derived"
      )
      expect(result).not.toBeNull()
      expect(result?.ephemeralPublicKey).toBe("0xabcdef1234")
      expect(result?.address).toBe("derived")
    })

    it("should add 0x prefix if missing", () => {
      const result = parsePaymentStealthAddress("sip:solana:abcdef1234:derived")
      expect(result?.ephemeralPublicKey).toBe("0xabcdef1234")
    })

    it("should calculate view tag from ephemeral key", () => {
      // "ab" in hex = 171 in decimal
      const result = parsePaymentStealthAddress("sip:solana:0xab1234:derived")
      expect(result?.viewTag).toBe(171)

      // "ff" in hex = 255 in decimal
      const result2 = parsePaymentStealthAddress("sip:solana:0xff0000:derived")
      expect(result2?.viewTag).toBe(255)

      // "00" in hex = 0 in decimal
      const result3 = parsePaymentStealthAddress("sip:solana:0x001234:derived")
      expect(result3?.viewTag).toBe(0)
    })

    it("should return null for undefined", () => {
      expect(parsePaymentStealthAddress(undefined)).toBeNull()
    })

    it("should return null for non-SIP addresses", () => {
      expect(parsePaymentStealthAddress("0x1234")).toBeNull()
      expect(parsePaymentStealthAddress("11111111111111111111111111111111")).toBeNull()
    })

    it("should return null for malformed SIP addresses", () => {
      expect(parsePaymentStealthAddress("sip:")).toBeNull()
      expect(parsePaymentStealthAddress("sip:solana")).toBeNull()
    })

    it("should handle missing derived address", () => {
      const result = parsePaymentStealthAddress("sip:solana:0xabcd")
      expect(result).not.toBeNull()
      expect(result?.address).toBe("")
    })
  })

  describe("createProgress", () => {
    it("should create progress with correct total steps", () => {
      const progress = createProgress("deriving", "Test message", 1)
      expect(progress.totalSteps).toBe(4)
      expect(progress.step).toBe(1)
      expect(progress.status).toBe("deriving")
      expect(progress.message).toBe("Test message")
    })

    it("should create progress for each status", () => {
      const statuses: ClaimStatus[] = [
        "idle",
        "deriving",
        "signing",
        "submitting",
        "confirmed",
        "error",
      ]

      statuses.forEach((status, index) => {
        const progress = createProgress(status, `Step ${index}`, index)
        expect(progress.status).toBe(status)
      })
    })
  })

  describe("getProgressMessage", () => {
    it("should return appropriate message for each status", () => {
      expect(getProgressMessage("idle")).toBe("Ready to claim")
      expect(getProgressMessage("deriving")).toBe("Deriving spending key...")
      expect(getProgressMessage("signing")).toBe("Building claim transaction...")
      expect(getProgressMessage("submitting")).toBe("Submitting to network...")
      expect(getProgressMessage("confirmed")).toBe("Claim successful!")
      expect(getProgressMessage("error")).toBe("Claim failed")
    })
  })

  describe("isClaimComplete", () => {
    it("should return true for confirmed", () => {
      expect(isClaimComplete("confirmed")).toBe(true)
    })

    it("should return true for error", () => {
      expect(isClaimComplete("error")).toBe(true)
    })

    it("should return false for in-progress statuses", () => {
      expect(isClaimComplete("idle")).toBe(false)
      expect(isClaimComplete("deriving")).toBe(false)
      expect(isClaimComplete("signing")).toBe(false)
      expect(isClaimComplete("submitting")).toBe(false)
    })
  })

  describe("isClaimInProgress", () => {
    it("should return true for active statuses", () => {
      expect(isClaimInProgress("deriving")).toBe(true)
      expect(isClaimInProgress("signing")).toBe(true)
      expect(isClaimInProgress("submitting")).toBe(true)
    })

    it("should return false for idle and complete statuses", () => {
      expect(isClaimInProgress("idle")).toBe(false)
      expect(isClaimInProgress("confirmed")).toBe(false)
      expect(isClaimInProgress("error")).toBe(false)
    })
  })

  describe("canClaim", () => {
    it("should allow claiming completed, unclaimed payments", () => {
      expect(canClaim("completed", false)).toBe(true)
    })

    it("should not allow claiming already claimed payments", () => {
      expect(canClaim("completed", true)).toBe(false)
    })

    it("should not allow claiming pending payments", () => {
      expect(canClaim("pending", false)).toBe(false)
    })

    it("should not allow claiming failed payments", () => {
      expect(canClaim("failed", false)).toBe(false)
    })
  })
})

describe("useClaim Types", () => {
  describe("ClaimResult", () => {
    it("should represent successful claim", () => {
      const result: ClaimResult = {
        success: true,
        txHash: "abc123def456",
      }
      expect(result.success).toBe(true)
      expect(result.txHash).toBeDefined()
      expect(result.error).toBeUndefined()
    })

    it("should represent failed claim", () => {
      const result: ClaimResult = {
        success: false,
        error: "Wallet not connected",
      }
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.txHash).toBeUndefined()
    })
  })

  describe("ClaimProgress", () => {
    it("should have valid step range", () => {
      const progress: ClaimProgress = {
        status: "signing",
        message: "Test",
        step: 3,
        totalSteps: 4,
      }
      expect(progress.step).toBeGreaterThanOrEqual(0)
      expect(progress.step).toBeLessThanOrEqual(progress.totalSteps)
    })
  })
})
