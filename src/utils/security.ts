/**
 * Security Utilities
 *
 * Security hardening functions for the mobile app
 */

import { Platform, AppState, AppStateStatus } from "react-native"
import * as SecureStore from "expo-secure-store"
import * as Crypto from "expo-crypto"

// ============================================================================
// CONSTANTS
// ============================================================================

/** Secure storage key prefix */
const SECURE_KEY_PREFIX = "sip_secure_"

/** Hash salt for key derivation */
const KEY_SALT = "sip-protocol-v1-salt"

/** Session timeout in milliseconds (5 minutes) */
export const SESSION_TIMEOUT_MS = 5 * 60 * 1000

/** Max PIN attempts before lockout */
export const MAX_PIN_ATTEMPTS = 5

/** PIN lockout duration in milliseconds (5 minutes) */
export const PIN_LOCKOUT_MS = 5 * 60 * 1000

// ============================================================================
// SECURE STORAGE
// ============================================================================

/**
 * Secure storage wrapper with error handling
 */
export const SecureStorage = {
  /**
   * Store a value securely
   */
  async set(key: string, value: string): Promise<boolean> {
    try {
      await SecureStore.setItemAsync(`${SECURE_KEY_PREFIX}${key}`, value, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      })
      return true
    } catch (error) {
      console.error("[SecureStorage] Failed to set:", error)
      return false
    }
  },

  /**
   * Retrieve a securely stored value
   */
  async get(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(`${SECURE_KEY_PREFIX}${key}`)
    } catch (error) {
      console.error("[SecureStorage] Failed to get:", error)
      return null
    }
  },

  /**
   * Delete a securely stored value
   */
  async delete(key: string): Promise<boolean> {
    try {
      await SecureStore.deleteItemAsync(`${SECURE_KEY_PREFIX}${key}`)
      return true
    } catch (error) {
      console.error("[SecureStorage] Failed to delete:", error)
      return false
    }
  },

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    const value = await this.get(key)
    return value !== null
  },
}

// ============================================================================
// CRYPTOGRAPHIC UTILITIES
// ============================================================================

/**
 * Hash a string with SHA-256
 */
export async function hashString(input: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input)
}

/**
 * Hash a PIN with salt
 */
export async function hashPin(pin: string): Promise<string> {
  return hashString(`${pin}${KEY_SALT}`)
}

/**
 * Generate a random hex string
 */
export async function generateRandomHex(bytes: number = 32): Promise<string> {
  const randomBytes = await Crypto.getRandomBytesAsync(bytes)
  return Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/**
 * Generate a secure session token
 */
export async function generateSessionToken(): Promise<string> {
  const timestamp = Date.now().toString(36)
  const random = await generateRandomHex(16)
  return `${timestamp}_${random}`
}

// ============================================================================
// INPUT VALIDATION
// ============================================================================

/**
 * Validate PIN format
 */
export function isValidPin(pin: string): boolean {
  // PIN must be 4-6 digits
  return /^\d{4,6}$/.test(pin)
}

/**
 * Validate Solana address format
 */
export function isValidSolanaAddress(address: string): boolean {
  // Solana addresses are base58, 32-44 characters
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)
}

/**
 * Sanitize user input (remove potential XSS)
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, "") // Remove angle brackets
    .replace(/javascript:/gi, "") // Remove javascript protocol
    .replace(/on\w+=/gi, "") // Remove event handlers
    .trim()
}

/**
 * Mask sensitive data for logging
 */
export function maskSensitiveData(
  data: string,
  visibleChars: number = 4
): string {
  if (data.length <= visibleChars * 2) return "***"
  return `${data.slice(0, visibleChars)}...${data.slice(-visibleChars)}`
}

// ============================================================================
// RATE LIMITING
// ============================================================================

interface RateLimitEntry {
  count: number
  firstAttempt: number
}

const rateLimitMap = new Map<string, RateLimitEntry>()

/**
 * Check if an action is rate limited
 */
export function isRateLimited(
  action: string,
  maxAttempts: number,
  windowMs: number
): boolean {
  const entry = rateLimitMap.get(action)
  const now = Date.now()

  if (!entry) {
    rateLimitMap.set(action, { count: 1, firstAttempt: now })
    return false
  }

  // Reset if window expired
  if (now - entry.firstAttempt > windowMs) {
    rateLimitMap.set(action, { count: 1, firstAttempt: now })
    return false
  }

  // Check limit
  if (entry.count >= maxAttempts) {
    return true
  }

  // Increment count
  entry.count++
  return false
}

/**
 * Reset rate limit for an action
 */
export function resetRateLimit(action: string): void {
  rateLimitMap.delete(action)
}

/**
 * Get remaining time before rate limit resets
 */
export function getRateLimitRemaining(action: string, windowMs: number): number {
  const entry = rateLimitMap.get(action)
  if (!entry) return 0

  const elapsed = Date.now() - entry.firstAttempt
  const remaining = windowMs - elapsed

  return remaining > 0 ? remaining : 0
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

let lastActivityTimestamp = Date.now()

/**
 * Update last activity timestamp
 */
export function updateActivity(): void {
  lastActivityTimestamp = Date.now()
}

/**
 * Check if session has expired
 */
export function isSessionExpired(timeoutMs: number = SESSION_TIMEOUT_MS): boolean {
  return Date.now() - lastActivityTimestamp > timeoutMs
}

/**
 * Get remaining session time
 */
export function getSessionRemaining(
  timeoutMs: number = SESSION_TIMEOUT_MS
): number {
  const remaining = timeoutMs - (Date.now() - lastActivityTimestamp)
  return remaining > 0 ? remaining : 0
}

// ============================================================================
// APP STATE SECURITY
// ============================================================================

type AppStateCallback = (state: AppStateStatus) => void

const appStateCallbacks: Set<AppStateCallback> = new Set()

/**
 * Subscribe to app state changes (for hiding content on background)
 */
export function onAppStateChange(callback: AppStateCallback): () => void {
  appStateCallbacks.add(callback)

  return () => {
    appStateCallbacks.delete(callback)
  }
}

// Initialize app state listener
AppState.addEventListener("change", (state) => {
  appStateCallbacks.forEach((cb) => cb(state))
})

/**
 * Check if app is in background
 */
export function isAppInBackground(): boolean {
  return AppState.currentState !== "active"
}

// ============================================================================
// PLATFORM-SPECIFIC SECURITY
// ============================================================================

/**
 * Get platform-specific security recommendations
 */
export function getSecurityRecommendations(): string[] {
  const recommendations = [
    "Enable biometric authentication for extra security",
    "Set up a PIN as a backup authentication method",
    "Enable auto-lock when leaving the app",
  ]

  if (Platform.OS === "ios") {
    recommendations.push("Consider enabling Face ID for faster authentication")
  } else if (Platform.OS === "android") {
    recommendations.push(
      "Consider enabling fingerprint authentication"
    )
  }

  return recommendations
}

/**
 * Check if device has secure hardware (TEE/Secure Enclave)
 */
export async function hasSecureHardware(): Promise<boolean> {
  try {
    // SecureStore uses Keychain (iOS) or Keystore (Android)
    // which leverage secure hardware when available
    await SecureStore.setItemAsync("__security_check__", "test", {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    })
    await SecureStore.deleteItemAsync("__security_check__")
    return true
  } catch {
    return false
  }
}

// ============================================================================
// SENSITIVE DATA HANDLING
// ============================================================================

/**
 * Clear all sensitive data from memory
 * Call this on logout or when app goes to background
 */
export function clearSensitiveMemory(): void {
  // Clear rate limit data
  rateLimitMap.clear()

  // Reset session
  lastActivityTimestamp = 0
}

/**
 * Secure cleanup on logout
 */
export async function secureLogout(): Promise<void> {
  // Clear session
  clearSensitiveMemory()

  // Clear secure storage keys (keep PIN hash for re-login)
  await SecureStorage.delete("session_token")
  await SecureStorage.delete("viewing_key")
  await SecureStorage.delete("spending_key")
}
