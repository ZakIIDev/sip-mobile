/**
 * Biometrics Hook
 *
 * Provides biometric authentication functionality:
 * - Check device capabilities
 * - Authenticate with biometrics
 * - Fallback to PIN
 * - Handle errors gracefully
 */

import { useState, useCallback, useEffect, useMemo } from "react"
import * as LocalAuthentication from "expo-local-authentication"
import * as Crypto from "expo-crypto"
import { useSecurityStore, type BiometricType } from "@/stores/security"

// ============================================================================
// TYPES
// ============================================================================

export interface BiometricCapabilities {
  isAvailable: boolean
  isEnrolled: boolean
  biometricTypes: LocalAuthentication.AuthenticationType[]
  primaryType: BiometricType
  securityLevel: LocalAuthentication.SecurityLevel
}

export type AuthResult =
  | { success: true }
  | { success: false; error: string; cancelled?: boolean }

export interface UseBiometricsReturn {
  // Capabilities
  capabilities: BiometricCapabilities | null
  isLoading: boolean
  error: string | null

  // State
  isEnabled: boolean
  isAuthenticated: boolean

  // Actions
  checkCapabilities: () => Promise<BiometricCapabilities>
  authenticate: (reason?: string) => Promise<AuthResult>
  authenticateForOperation: (
    operation: "send" | "claim" | "export",
    reason?: string
  ) => Promise<AuthResult>
  enable: () => Promise<boolean>
  disable: () => void

  // PIN
  verifyPin: (pin: string) => Promise<AuthResult>
  setPin: (pin: string) => Promise<void>
  clearPin: () => void
  isPinLocked: () => boolean
  getPinLockRemaining: () => number
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_AUTH_REASON = "Verify your identity to continue"

// ============================================================================
// HELPERS
// ============================================================================

function mapBiometricType(
  types: LocalAuthentication.AuthenticationType[]
): BiometricType {
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return "facial"
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return "fingerprint"
  }
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    return "iris"
  }
  return "none"
}

async function hashPin(pin: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    pin + "sip-salt-v1" // Simple salt, in production use per-user salt
  )
  return digest
}

// ============================================================================
// HOOK
// ============================================================================

export function useBiometrics(): UseBiometricsReturn {
  const {
    biometricsEnabled,
    requireBiometricsForSend,
    requireBiometricsForClaim,
    requireBiometricsForExport,
    pinEnabled,
    pinHash,
    pinAttempts,
    pinLockedUntil,
    isAuthenticated,
    setBiometricsEnabled,
    setBiometricType,
    setPinEnabled,
    setPinHash,
    incrementPinAttempts,
    resetPinAttempts,
    authenticate: storeAuthenticate,
  } = useSecurityStore()

  const [capabilities, setCapabilities] = useState<BiometricCapabilities | null>(
    null
  )
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Check capabilities on mount
  useEffect(() => {
    checkCapabilities()
  }, [])

  const checkCapabilities = useCallback(async (): Promise<BiometricCapabilities> => {
    setIsLoading(true)
    setError(null)

    try {
      const [hasHardware, isEnrolled, supportedTypes, securityLevel] =
        await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
          LocalAuthentication.supportedAuthenticationTypesAsync(),
          LocalAuthentication.getEnrolledLevelAsync(),
        ])

      const caps: BiometricCapabilities = {
        isAvailable: hasHardware,
        isEnrolled: isEnrolled,
        biometricTypes: supportedTypes,
        primaryType: mapBiometricType(supportedTypes),
        securityLevel: securityLevel,
      }

      setCapabilities(caps)
      return caps
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const authenticate = useCallback(
    async (reason: string = DEFAULT_AUTH_REASON): Promise<AuthResult> => {
      if (!capabilities?.isAvailable || !capabilities?.isEnrolled) {
        return {
          success: false,
          error: "Biometrics not available on this device",
        }
      }

      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: reason,
          fallbackLabel: "Use PIN",
          cancelLabel: "Cancel",
          disableDeviceFallback: false,
        })

        if (result.success) {
          storeAuthenticate()
          return { success: true }
        }

        if (result.error === "user_cancel") {
          return { success: false, error: "Cancelled", cancelled: true }
        }

        return {
          success: false,
          error: result.error || "Authentication failed",
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error"
        return { success: false, error: message }
      }
    },
    [capabilities, storeAuthenticate]
  )

  const authenticateForOperation = useCallback(
    async (
      operation: "send" | "claim" | "export",
      reason?: string
    ): Promise<AuthResult> => {
      // Check if biometrics required for this operation
      let required = false
      switch (operation) {
        case "send":
          required = requireBiometricsForSend
          break
        case "claim":
          required = requireBiometricsForClaim
          break
        case "export":
          required = requireBiometricsForExport
          break
      }

      if (!required || !biometricsEnabled) {
        return { success: true }
      }

      // Check if already authenticated
      if (isAuthenticated) {
        return { success: true }
      }

      const defaultReasons: Record<string, string> = {
        send: "Authenticate to send payment",
        claim: "Authenticate to claim payment",
        export: "Authenticate to export viewing key",
      }

      return authenticate(reason || defaultReasons[operation])
    },
    [
      biometricsEnabled,
      requireBiometricsForSend,
      requireBiometricsForClaim,
      requireBiometricsForExport,
      isAuthenticated,
      authenticate,
    ]
  )

  const enable = useCallback(async (): Promise<boolean> => {
    const caps = await checkCapabilities()

    if (!caps.isAvailable) {
      setError("Biometrics not available on this device")
      return false
    }

    if (!caps.isEnrolled) {
      setError("No biometrics enrolled. Please set up biometrics in device settings.")
      return false
    }

    // Test authentication before enabling
    const result = await authenticate("Enable biometric authentication")
    if (!result.success) {
      return false
    }

    setBiometricsEnabled(true)
    setBiometricType(caps.primaryType)
    return true
  }, [checkCapabilities, authenticate, setBiometricsEnabled, setBiometricType])

  const disable = useCallback(() => {
    setBiometricsEnabled(false)
    setBiometricType("none")
  }, [setBiometricsEnabled, setBiometricType])

  // ============================================================================
  // PIN METHODS
  // ============================================================================

  const isPinLocked = useCallback((): boolean => {
    if (!pinLockedUntil) return false
    return Date.now() < pinLockedUntil
  }, [pinLockedUntil])

  const getPinLockRemaining = useCallback((): number => {
    if (!pinLockedUntil) return 0
    const remaining = pinLockedUntil - Date.now()
    return remaining > 0 ? remaining : 0
  }, [pinLockedUntil])

  const verifyPin = useCallback(
    async (pin: string): Promise<AuthResult> => {
      if (isPinLocked()) {
        const remainingSec = Math.ceil(getPinLockRemaining() / 1000)
        return {
          success: false,
          error: `Too many attempts. Try again in ${remainingSec}s`,
        }
      }

      if (!pinEnabled || !pinHash) {
        return { success: false, error: "PIN not set" }
      }

      const hash = await hashPin(pin)
      if (hash === pinHash) {
        resetPinAttempts()
        storeAuthenticate()
        return { success: true }
      }

      incrementPinAttempts()
      const attemptsLeft = 5 - pinAttempts - 1
      if (attemptsLeft > 0) {
        return {
          success: false,
          error: `Incorrect PIN. ${attemptsLeft} attempt${attemptsLeft !== 1 ? "s" : ""} remaining`,
        }
      }

      return {
        success: false,
        error: "Too many attempts. Please wait 5 minutes.",
      }
    },
    [
      pinEnabled,
      pinHash,
      pinAttempts,
      isPinLocked,
      getPinLockRemaining,
      incrementPinAttempts,
      resetPinAttempts,
      storeAuthenticate,
    ]
  )

  const setPin = useCallback(
    async (pin: string): Promise<void> => {
      if (pin.length < 4 || pin.length > 6) {
        throw new Error("PIN must be 4-6 digits")
      }

      if (!/^\d+$/.test(pin)) {
        throw new Error("PIN must contain only numbers")
      }

      const hash = await hashPin(pin)
      setPinHash(hash)
      setPinEnabled(true)
      resetPinAttempts()
    },
    [setPinHash, setPinEnabled, resetPinAttempts]
  )

  const clearPin = useCallback(() => {
    setPinEnabled(false)
    setPinHash(null)
    resetPinAttempts()
  }, [setPinEnabled, setPinHash, resetPinAttempts])

  return useMemo(
    () => ({
      capabilities,
      isLoading,
      error,
      isEnabled: biometricsEnabled,
      isAuthenticated,
      checkCapabilities,
      authenticate,
      authenticateForOperation,
      enable,
      disable,
      verifyPin,
      setPin,
      clearPin,
      isPinLocked,
      getPinLockRemaining,
    }),
    [
      capabilities,
      isLoading,
      error,
      biometricsEnabled,
      isAuthenticated,
      checkCapabilities,
      authenticate,
      authenticateForOperation,
      enable,
      disable,
      verifyPin,
      setPin,
      clearPin,
      isPinLocked,
      getPinLockRemaining,
    ]
  )
}
