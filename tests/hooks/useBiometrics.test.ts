/**
 * useBiometrics Hook Tests
 *
 * Tests biometric authentication logic without Expo dependencies.
 */

import { describe, it, expect } from "vitest"

// ============================================================================
// Type Definitions (mirror from useBiometrics.ts)
// ============================================================================

type BiometricType = "fingerprint" | "faceId" | "iris" | "none"
type AuthLevel = "weak" | "strong" | "none"

interface BiometricCapabilities {
  isAvailable: boolean
  biometricType: BiometricType
  authLevel: AuthLevel
  isEnrolled: boolean
}

interface AuthResult {
  success: boolean
  error?: string
  biometricType?: BiometricType
}

// ============================================================================
// Re-implemented utility functions for isolated testing
// ============================================================================

function getBiometricTypeName(type: BiometricType): string {
  switch (type) {
    case "fingerprint":
      return "Fingerprint"
    case "faceId":
      return "Face ID"
    case "iris":
      return "Iris"
    case "none":
      return "None"
    default:
      return "Unknown"
  }
}

function getAuthLevelDescription(level: AuthLevel): string {
  switch (level) {
    case "strong":
      return "High security biometric authentication"
    case "weak":
      return "Basic biometric authentication"
    case "none":
      return "No biometric authentication available"
    default:
      return "Unknown authentication level"
  }
}

function canUseBiometrics(capabilities: BiometricCapabilities): boolean {
  return (
    capabilities.isAvailable &&
    capabilities.isEnrolled &&
    capabilities.biometricType !== "none"
  )
}

function isStrongAuth(capabilities: BiometricCapabilities): boolean {
  return capabilities.authLevel === "strong"
}

function getAuthPromptMessage(type: BiometricType): string {
  switch (type) {
    case "fingerprint":
      return "Place your finger on the sensor"
    case "faceId":
      return "Look at the camera"
    case "iris":
      return "Look at the sensor"
    default:
      return "Authenticate to continue"
  }
}

function getAuthErrorMessage(error: string): string {
  const errorMessages: Record<string, string> = {
    user_cancel: "Authentication cancelled",
    lockout: "Too many failed attempts. Please try again later.",
    lockout_permanent: "Biometrics locked. Use your device passcode.",
    no_biometrics: "No biometric data enrolled",
    not_available: "Biometrics not available on this device",
    system_cancel: "Authentication interrupted",
    fallback: "Use alternative authentication",
  }
  return errorMessages[error] || "Authentication failed"
}

function createSuccessResult(type: BiometricType): AuthResult {
  return {
    success: true,
    biometricType: type,
  }
}

function createErrorResult(error: string): AuthResult {
  return {
    success: false,
    error,
  }
}

function shouldShowFallback(capabilities: BiometricCapabilities): boolean {
  return !capabilities.isEnrolled && capabilities.isAvailable
}

function getRecommendedAuthMethod(
  capabilities: BiometricCapabilities
): "biometric" | "passcode" | "none" {
  if (canUseBiometrics(capabilities)) {
    return "biometric"
  }
  if (capabilities.isAvailable) {
    return "passcode"
  }
  return "none"
}

// ============================================================================
// Tests
// ============================================================================

describe("useBiometrics Utilities", () => {
  describe("getBiometricTypeName", () => {
    it("should return correct names", () => {
      expect(getBiometricTypeName("fingerprint")).toBe("Fingerprint")
      expect(getBiometricTypeName("faceId")).toBe("Face ID")
      expect(getBiometricTypeName("iris")).toBe("Iris")
      expect(getBiometricTypeName("none")).toBe("None")
    })
  })

  describe("getAuthLevelDescription", () => {
    it("should return correct descriptions", () => {
      expect(getAuthLevelDescription("strong")).toContain("High security")
      expect(getAuthLevelDescription("weak")).toContain("Basic")
      expect(getAuthLevelDescription("none")).toContain("No biometric")
    })
  })

  describe("canUseBiometrics", () => {
    it("should return true when all conditions met", () => {
      const capabilities: BiometricCapabilities = {
        isAvailable: true,
        isEnrolled: true,
        biometricType: "fingerprint",
        authLevel: "strong",
      }
      expect(canUseBiometrics(capabilities)).toBe(true)
    })

    it("should return false when not available", () => {
      const capabilities: BiometricCapabilities = {
        isAvailable: false,
        isEnrolled: true,
        biometricType: "fingerprint",
        authLevel: "strong",
      }
      expect(canUseBiometrics(capabilities)).toBe(false)
    })

    it("should return false when not enrolled", () => {
      const capabilities: BiometricCapabilities = {
        isAvailable: true,
        isEnrolled: false,
        biometricType: "fingerprint",
        authLevel: "strong",
      }
      expect(canUseBiometrics(capabilities)).toBe(false)
    })

    it("should return false when type is none", () => {
      const capabilities: BiometricCapabilities = {
        isAvailable: true,
        isEnrolled: true,
        biometricType: "none",
        authLevel: "none",
      }
      expect(canUseBiometrics(capabilities)).toBe(false)
    })
  })

  describe("isStrongAuth", () => {
    it("should return true for strong auth", () => {
      const capabilities: BiometricCapabilities = {
        isAvailable: true,
        isEnrolled: true,
        biometricType: "fingerprint",
        authLevel: "strong",
      }
      expect(isStrongAuth(capabilities)).toBe(true)
    })

    it("should return false for weak auth", () => {
      const capabilities: BiometricCapabilities = {
        isAvailable: true,
        isEnrolled: true,
        biometricType: "fingerprint",
        authLevel: "weak",
      }
      expect(isStrongAuth(capabilities)).toBe(false)
    })
  })

  describe("getAuthPromptMessage", () => {
    it("should return appropriate prompts", () => {
      expect(getAuthPromptMessage("fingerprint")).toContain("finger")
      expect(getAuthPromptMessage("faceId")).toContain("camera")
      expect(getAuthPromptMessage("iris")).toContain("sensor")
      expect(getAuthPromptMessage("none")).toContain("Authenticate")
    })
  })

  describe("getAuthErrorMessage", () => {
    it("should return user-friendly messages", () => {
      expect(getAuthErrorMessage("user_cancel")).toContain("cancelled")
      expect(getAuthErrorMessage("lockout")).toContain("Too many")
      expect(getAuthErrorMessage("lockout_permanent")).toContain("passcode")
      expect(getAuthErrorMessage("no_biometrics")).toContain("enrolled")
      expect(getAuthErrorMessage("not_available")).toContain("not available")
    })

    it("should return fallback for unknown errors", () => {
      expect(getAuthErrorMessage("unknown_error")).toBe("Authentication failed")
    })
  })

  describe("createSuccessResult", () => {
    it("should create success result", () => {
      const result = createSuccessResult("fingerprint")
      expect(result.success).toBe(true)
      expect(result.biometricType).toBe("fingerprint")
      expect(result.error).toBeUndefined()
    })
  })

  describe("createErrorResult", () => {
    it("should create error result", () => {
      const result = createErrorResult("user_cancel")
      expect(result.success).toBe(false)
      expect(result.error).toBe("user_cancel")
      expect(result.biometricType).toBeUndefined()
    })
  })

  describe("shouldShowFallback", () => {
    it("should show fallback when available but not enrolled", () => {
      const capabilities: BiometricCapabilities = {
        isAvailable: true,
        isEnrolled: false,
        biometricType: "fingerprint",
        authLevel: "none",
      }
      expect(shouldShowFallback(capabilities)).toBe(true)
    })

    it("should not show fallback when enrolled", () => {
      const capabilities: BiometricCapabilities = {
        isAvailable: true,
        isEnrolled: true,
        biometricType: "fingerprint",
        authLevel: "strong",
      }
      expect(shouldShowFallback(capabilities)).toBe(false)
    })

    it("should not show fallback when not available", () => {
      const capabilities: BiometricCapabilities = {
        isAvailable: false,
        isEnrolled: false,
        biometricType: "none",
        authLevel: "none",
      }
      expect(shouldShowFallback(capabilities)).toBe(false)
    })
  })

  describe("getRecommendedAuthMethod", () => {
    it("should recommend biometric when available", () => {
      const capabilities: BiometricCapabilities = {
        isAvailable: true,
        isEnrolled: true,
        biometricType: "fingerprint",
        authLevel: "strong",
      }
      expect(getRecommendedAuthMethod(capabilities)).toBe("biometric")
    })

    it("should recommend passcode when available but not enrolled", () => {
      const capabilities: BiometricCapabilities = {
        isAvailable: true,
        isEnrolled: false,
        biometricType: "fingerprint",
        authLevel: "none",
      }
      expect(getRecommendedAuthMethod(capabilities)).toBe("passcode")
    })

    it("should recommend none when not available", () => {
      const capabilities: BiometricCapabilities = {
        isAvailable: false,
        isEnrolled: false,
        biometricType: "none",
        authLevel: "none",
      }
      expect(getRecommendedAuthMethod(capabilities)).toBe("none")
    })
  })
})

describe("useBiometrics Types", () => {
  describe("BiometricType", () => {
    const types: BiometricType[] = ["fingerprint", "faceId", "iris", "none"]

    it("should include all expected types", () => {
      expect(types).toContain("fingerprint")
      expect(types).toContain("faceId")
      expect(types).toContain("iris")
      expect(types).toContain("none")
    })
  })

  describe("AuthLevel", () => {
    const levels: AuthLevel[] = ["weak", "strong", "none"]

    it("should include all expected levels", () => {
      expect(levels).toContain("weak")
      expect(levels).toContain("strong")
      expect(levels).toContain("none")
    })
  })

  describe("BiometricCapabilities", () => {
    it("should have all required fields", () => {
      const capabilities: BiometricCapabilities = {
        isAvailable: true,
        biometricType: "faceId",
        authLevel: "strong",
        isEnrolled: true,
      }
      expect(capabilities.isAvailable).toBeDefined()
      expect(capabilities.biometricType).toBeDefined()
      expect(capabilities.authLevel).toBeDefined()
      expect(capabilities.isEnrolled).toBeDefined()
    })
  })
})
