/**
 * Stealth Address Hook
 *
 * Manages stealth address generation and scanning for SIP privacy.
 * Uses DKSAP (Dual-Key Stealth Address Protocol) with ed25519 curve.
 *
 * Based on EIP-5564 style stealth addresses adapted for Solana.
 */

import { useState, useCallback, useEffect, useMemo } from "react"
import * as SecureStore from "expo-secure-store"
import { useWalletStore } from "@/stores/wallet"
import {
  generateStealthKeys,
  formatStealthMetaAddress,
  ed25519PublicKeyToSolanaAddress,
  type StealthMetaAddress,
} from "@/lib/stealth"

// ============================================================================
// TYPES
// ============================================================================

export interface StealthKeys {
  spendingPrivateKey: string
  spendingPublicKey: string
  viewingPrivateKey: string
  viewingPublicKey: string
}

export interface StealthAddress {
  full: string
  encoded: string
  chain: string
  spendingKey: string
  viewingKey: string
  solanaAddress: string // Base58 Solana address derived from stealth
}

export interface UseStealthReturn {
  // State
  stealthAddress: StealthAddress | null
  isGenerating: boolean
  isLoading: boolean
  error: string | null

  // Actions
  generateNewAddress: () => Promise<StealthAddress | null>
  regenerateAddress: () => Promise<StealthAddress | null>
  getKeys: () => Promise<StealthKeys | null>
  formatForDisplay: (address: StealthAddress) => string
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SECURE_STORE_KEY = "sip_stealth_keys"
const SIP_CHAIN = "solana"

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Format stealth address from keys
 * Format: sip:<chain>:<spendingKey>:<viewingKey>
 */
function formatStealthAddress(
  chain: string,
  spendingPublicKey: string,
  viewingPublicKey: string
): StealthAddress {
  const metaAddress: StealthMetaAddress = {
    chain,
    spendingKey: spendingPublicKey,
    viewingKey: viewingPublicKey,
  }

  const full = formatStealthMetaAddress(metaAddress)
  const solanaAddress = ed25519PublicKeyToSolanaAddress(viewingPublicKey)

  return {
    full,
    encoded: full,
    chain,
    spendingKey: spendingPublicKey,
    viewingKey: viewingPublicKey,
    solanaAddress,
  }
}

// ============================================================================
// HOOK
// ============================================================================

export function useStealth(): UseStealthReturn {
  const { isConnected, address } = useWalletStore()

  const [stealthAddress, setStealthAddress] = useState<StealthAddress | null>(null)
  const [keys, setKeys] = useState<StealthKeys | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load or generate keys on mount
  useEffect(() => {
    if (isConnected && address) {
      loadOrGenerateKeys()
    } else {
      setStealthAddress(null)
      setKeys(null)
      setIsLoading(false)
    }
  }, [isConnected, address])

  const loadOrGenerateKeys = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Try to load existing keys
      const storedKeys = await SecureStore.getItemAsync(SECURE_STORE_KEY)

      if (storedKeys) {
        const parsedKeys = JSON.parse(storedKeys) as StealthKeys
        setKeys(parsedKeys)

        // Generate address from stored keys
        const addr = formatStealthAddress(
          SIP_CHAIN,
          parsedKeys.spendingPublicKey,
          parsedKeys.viewingPublicKey
        )
        setStealthAddress(addr)
      } else {
        // Generate new keys
        await generateNewAddressInternal()
      }
    } catch (err) {
      console.error("Failed to load stealth keys:", err)
      setError("Failed to load stealth keys")
    } finally {
      setIsLoading(false)
    }
  }, [])

  const generateNewAddressInternal = useCallback(async (): Promise<StealthAddress | null> => {
    setIsGenerating(true)
    setError(null)

    try {
      // Generate new stealth keys using real cryptography
      const newKeys = await generateStealthKeys()

      // Store securely
      await SecureStore.setItemAsync(SECURE_STORE_KEY, JSON.stringify(newKeys))

      setKeys(newKeys)

      // Create stealth address
      const addr = formatStealthAddress(
        SIP_CHAIN,
        newKeys.spendingPublicKey,
        newKeys.viewingPublicKey
      )

      setStealthAddress(addr)
      return addr
    } catch (err) {
      console.error("Failed to generate stealth address:", err)
      setError("Failed to generate stealth address")
      return null
    } finally {
      setIsGenerating(false)
    }
  }, [])

  const generateNewAddress = useCallback(async (): Promise<StealthAddress | null> => {
    if (!isConnected) {
      setError("Wallet not connected")
      return null
    }
    return generateNewAddressInternal()
  }, [isConnected, generateNewAddressInternal])

  const regenerateAddress = useCallback(async (): Promise<StealthAddress | null> => {
    // Clear existing keys and generate new ones
    try {
      await SecureStore.deleteItemAsync(SECURE_STORE_KEY)
    } catch {
      // Ignore delete errors
    }
    return generateNewAddress()
  }, [generateNewAddress])

  const getKeys = useCallback(async (): Promise<StealthKeys | null> => {
    if (keys) return keys

    try {
      const storedKeys = await SecureStore.getItemAsync(SECURE_STORE_KEY)
      if (storedKeys) {
        return JSON.parse(storedKeys) as StealthKeys
      }
    } catch {
      // Ignore errors
    }
    return null
  }, [keys])

  const formatForDisplay = useCallback((addr: StealthAddress): string => {
    // Use the full address which is already properly formatted (base58 for Solana)
    // Truncate the keys portion for display
    const parts = addr.full.split(":")
    if (parts.length === 4) {
      const [prefix, chain, spending, viewing] = parts
      const spendingShort = `${spending.slice(0, 8)}...${spending.slice(-6)}`
      const viewingShort = `${viewing.slice(0, 8)}...${viewing.slice(-6)}`
      return `${prefix}:${chain}:${spendingShort}:${viewingShort}`
    }
    return addr.full
  }, [])

  return useMemo(
    () => ({
      stealthAddress,
      isGenerating,
      isLoading,
      error,
      generateNewAddress,
      regenerateAddress,
      getKeys,
      formatForDisplay,
    }),
    [
      stealthAddress,
      isGenerating,
      isLoading,
      error,
      generateNewAddress,
      regenerateAddress,
      getKeys,
      formatForDisplay,
    ]
  )
}
