/**
 * Security Utilities Tests
 */

import { describe, it, expect, beforeEach } from "vitest"
import {
  SESSION_TIMEOUT_MS,
  MAX_PIN_ATTEMPTS,
  PIN_LOCKOUT_MS,
  isValidPin,
  isValidSolanaAddress,
  sanitizeInput,
  maskSensitiveData,
  isRateLimited,
  resetRateLimit,
  getRateLimitRemaining,
  updateActivity,
  isSessionExpired,
  getSessionRemaining,
  getSecurityRecommendations,
  validateTransactionAmount,
  isDebugMode,
  getSecurityWarnings,
  CLIPBOARD_CLEAR_TIMEOUT_MS,
  MAX_SOL_AMOUNT,
  MIN_SOL_AMOUNT,
} from "@/utils/security"

describe("Security Constants", () => {
  it("should have session timeout of 5 minutes", () => {
    expect(SESSION_TIMEOUT_MS).toBe(5 * 60 * 1000)
  })

  it("should have max PIN attempts of 5", () => {
    expect(MAX_PIN_ATTEMPTS).toBe(5)
  })

  it("should have PIN lockout of 5 minutes", () => {
    expect(PIN_LOCKOUT_MS).toBe(5 * 60 * 1000)
  })
})

describe("Input Validation", () => {
  describe("isValidPin", () => {
    it("should accept 4-digit PIN", () => {
      expect(isValidPin("1234")).toBe(true)
    })

    it("should accept 5-digit PIN", () => {
      expect(isValidPin("12345")).toBe(true)
    })

    it("should accept 6-digit PIN", () => {
      expect(isValidPin("123456")).toBe(true)
    })

    it("should reject 3-digit PIN", () => {
      expect(isValidPin("123")).toBe(false)
    })

    it("should reject 7-digit PIN", () => {
      expect(isValidPin("1234567")).toBe(false)
    })

    it("should reject non-numeric PIN", () => {
      expect(isValidPin("abcd")).toBe(false)
      expect(isValidPin("12a4")).toBe(false)
    })

    it("should reject empty PIN", () => {
      expect(isValidPin("")).toBe(false)
    })
  })

  describe("isValidSolanaAddress", () => {
    it("should accept valid Solana address", () => {
      expect(isValidSolanaAddress("7EqBVf6rNLbNSCy8h6YGbWk8uXUGKuK6fkR")).toBe(true)
    })

    it("should reject too short address", () => {
      expect(isValidSolanaAddress("ABC123")).toBe(false)
    })

    it("should reject address with invalid characters", () => {
      expect(isValidSolanaAddress("0OIl123456789012345678901234567890")).toBe(false)
    })
  })

  describe("sanitizeInput", () => {
    it("should remove angle brackets", () => {
      expect(sanitizeInput("<script>alert(1)</script>")).toBe("scriptalert(1)/script")
    })

    it("should remove javascript protocol", () => {
      expect(sanitizeInput("javascript:alert(1)")).toBe("alert(1)")
    })

    it("should remove event handlers", () => {
      expect(sanitizeInput("onclick=alert(1)")).toBe("alert(1)")
      expect(sanitizeInput("onload=evil()")).toBe("evil()")
    })

    it("should trim whitespace", () => {
      expect(sanitizeInput("  hello  ")).toBe("hello")
    })

    it("should preserve safe input", () => {
      expect(sanitizeInput("Hello World 123")).toBe("Hello World 123")
    })
  })

  describe("maskSensitiveData", () => {
    it("should mask middle of long strings", () => {
      expect(maskSensitiveData("1234567890ABCDEF")).toBe("1234...CDEF")
    })

    it("should return *** for short strings", () => {
      expect(maskSensitiveData("short")).toBe("***")
    })

    it("should use custom visible chars", () => {
      expect(maskSensitiveData("1234567890ABCDEF", 2)).toBe("12...EF")
    })
  })
})

describe("Rate Limiting", () => {
  beforeEach(() => {
    resetRateLimit("test_action")
  })

  it("should not rate limit first request", () => {
    expect(isRateLimited("test_action", 3, 60000)).toBe(false)
  })

  it("should count requests", () => {
    expect(isRateLimited("test_action", 3, 60000)).toBe(false)
    expect(isRateLimited("test_action", 3, 60000)).toBe(false)
    expect(isRateLimited("test_action", 3, 60000)).toBe(false)
    expect(isRateLimited("test_action", 3, 60000)).toBe(true)
  })

  it("should reset rate limit", () => {
    isRateLimited("test_action", 3, 60000)
    isRateLimited("test_action", 3, 60000)
    isRateLimited("test_action", 3, 60000)

    resetRateLimit("test_action")

    expect(isRateLimited("test_action", 3, 60000)).toBe(false)
  })

  it("should get remaining time", () => {
    isRateLimited("test_action", 3, 60000)
    const remaining = getRateLimitRemaining("test_action", 60000)
    expect(remaining).toBeGreaterThan(0)
    expect(remaining).toBeLessThanOrEqual(60000)
  })

  it("should return 0 remaining for unknown action", () => {
    expect(getRateLimitRemaining("unknown_action", 60000)).toBe(0)
  })
})

describe("Session Management", () => {
  beforeEach(() => {
    updateActivity()
  })

  it("should not be expired immediately after activity", () => {
    expect(isSessionExpired()).toBe(false)
  })

  it("should get remaining session time", () => {
    const remaining = getSessionRemaining()
    expect(remaining).toBeGreaterThan(0)
    expect(remaining).toBeLessThanOrEqual(SESSION_TIMEOUT_MS)
  })

  it("should detect expired session with negative timeout simulation", () => {
    // A timeout of -1 should always be expired since elapsed time > -1
    // This tests the logic without timing issues
    expect(isSessionExpired(-1)).toBe(true)
  })

  it("should return 0 remaining when expired", () => {
    expect(getSessionRemaining(0)).toBe(0)
  })
})

describe("Security Recommendations", () => {
  it("should return array of recommendations", () => {
    const recommendations = getSecurityRecommendations()
    expect(Array.isArray(recommendations)).toBe(true)
    expect(recommendations.length).toBeGreaterThan(0)
  })

  it("should include biometric recommendation", () => {
    const recommendations = getSecurityRecommendations()
    expect(recommendations.some((r) => r.includes("biometric"))).toBe(true)
  })

  it("should include PIN recommendation", () => {
    const recommendations = getSecurityRecommendations()
    expect(recommendations.some((r) => r.includes("PIN"))).toBe(true)
  })

  it("should include auto-lock recommendation", () => {
    const recommendations = getSecurityRecommendations()
    expect(recommendations.some((r) => r.includes("auto-lock"))).toBe(true)
  })
})

describe("Transaction Validation", () => {
  it("should validate positive amounts", () => {
    expect(validateTransactionAmount(1).valid).toBe(true)
    expect(validateTransactionAmount(0.001).valid).toBe(true)
    expect(validateTransactionAmount(1000).valid).toBe(true)
  })

  it("should reject zero and negative amounts", () => {
    expect(validateTransactionAmount(0).valid).toBe(false)
    expect(validateTransactionAmount(-1).valid).toBe(false)
    expect(validateTransactionAmount(-0.001).valid).toBe(false)
  })

  it("should reject NaN and Infinity", () => {
    expect(validateTransactionAmount(NaN).valid).toBe(false)
    expect(validateTransactionAmount(Infinity).valid).toBe(false)
    expect(validateTransactionAmount(-Infinity).valid).toBe(false)
  })

  it("should reject amounts below minimum", () => {
    expect(validateTransactionAmount(MIN_SOL_AMOUNT / 10).valid).toBe(false)
  })

  it("should reject amounts above maximum", () => {
    expect(validateTransactionAmount(MAX_SOL_AMOUNT + 1).valid).toBe(false)
  })

  it("should validate string amounts", () => {
    expect(validateTransactionAmount("1.5").valid).toBe(true)
    expect(validateTransactionAmount("invalid").valid).toBe(false)
    expect(validateTransactionAmount("").valid).toBe(false)
  })
})

describe("Debug Mode Detection", () => {
  it("should detect debug mode", () => {
    // In test environment, __DEV__ is true
    expect(typeof isDebugMode()).toBe("boolean")
  })

  it("should return security warnings array", () => {
    const warnings = getSecurityWarnings()
    expect(Array.isArray(warnings)).toBe(true)
  })
})

describe("Secure Clipboard Constants", () => {
  it("should have clipboard timeout constant", () => {
    expect(CLIPBOARD_CLEAR_TIMEOUT_MS).toBe(60 * 1000) // 60 seconds
  })
})

describe("Transaction Amount Constants", () => {
  it("should have reasonable max SOL amount", () => {
    expect(MAX_SOL_AMOUNT).toBeGreaterThan(0)
    expect(MAX_SOL_AMOUNT).toBeLessThan(Number.MAX_SAFE_INTEGER)
  })

  it("should have reasonable min SOL amount", () => {
    expect(MIN_SOL_AMOUNT).toBeGreaterThan(0)
    expect(MIN_SOL_AMOUNT).toBeLessThan(1)
  })
})
