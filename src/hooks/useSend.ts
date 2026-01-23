/**
 * Send Hook
 *
 * Manages shielded transfer creation and submission.
 * Validates addresses, handles privacy levels, and tracks transaction state.
 */

import { useState, useCallback, useMemo } from "react"
import { useWalletStore } from "@/stores/wallet"
import { usePrivacyStore } from "@/stores/privacy"
import type { PrivacyLevel } from "@/types"

// ============================================================================
// TYPES
// ============================================================================

export interface SendParams {
  amount: string
  recipient: string
  privacyLevel: PrivacyLevel
  memo?: string
}

export interface SendResult {
  success: boolean
  txHash?: string
  error?: string
}

export type SendStatus =
  | "idle"
  | "validating"
  | "preparing"
  | "signing"
  | "submitting"
  | "confirmed"
  | "error"

export interface AddressValidation {
  isValid: boolean
  type: "stealth" | "regular" | "invalid"
  chain?: string
  error?: string
}

export interface UseSendReturn {
  // State
  status: SendStatus
  error: string | null
  txHash: string | null

  // Validation
  validateAddress: (address: string) => AddressValidation
  validateAmount: (amount: string, balance: number) => { isValid: boolean; error?: string }
  isStealthAddress: (address: string) => boolean

  // Actions
  send: (params: SendParams) => Promise<SendResult>
  reset: () => void

  // Price conversion (mock)
  getUsdValue: (solAmount: string) => string
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Mock SOL price for demo
const MOCK_SOL_PRICE_USD = 185.42

// Stealth address prefix
const STEALTH_PREFIX = "sip:"

// Solana address regex (base58, 32-44 chars)
const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Validate stealth address format
 * Format: sip:<chain>:<spendingKey>:<viewingKey>
 */
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

/**
 * Validate regular Solana address
 */
function validateSolanaAddress(address: string): AddressValidation {
  if (!SOLANA_ADDRESS_REGEX.test(address)) {
    return { isValid: false, type: "invalid", error: "Invalid Solana address" }
  }

  return { isValid: true, type: "regular", chain: "solana" }
}

// ============================================================================
// HOOK
// ============================================================================

export function useSend(): UseSendReturn {
  const { isConnected, address: walletAddress } = useWalletStore()
  const { addPayment } = usePrivacyStore()

  const [status, setStatus] = useState<SendStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)

  const validateAddress = useCallback((address: string): AddressValidation => {
    if (!address || address.trim() === "") {
      return { isValid: false, type: "invalid", error: "Address is required" }
    }

    const trimmed = address.trim()

    // Check if stealth address
    if (trimmed.startsWith(STEALTH_PREFIX)) {
      return validateStealthAddress(trimmed)
    }

    // Check if regular Solana address
    return validateSolanaAddress(trimmed)
  }, [])

  const validateAmount = useCallback(
    (amount: string, balance: number): { isValid: boolean; error?: string } => {
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

      // Minimum amount check (0.001 SOL)
      if (numAmount < 0.001) {
        return { isValid: false, error: "Minimum amount is 0.001 SOL" }
      }

      return { isValid: true }
    },
    []
  )

  const isStealthAddress = useCallback((address: string): boolean => {
    return address.trim().startsWith(STEALTH_PREFIX)
  }, [])

  const getUsdValue = useCallback((solAmount: string): string => {
    const num = parseFloat(solAmount)
    if (isNaN(num) || num <= 0) return "$0.00"
    return `$${(num * MOCK_SOL_PRICE_USD).toFixed(2)}`
  }, [])

  const send = useCallback(
    async (params: SendParams): Promise<SendResult> => {
      if (!isConnected || !walletAddress) {
        return { success: false, error: "Wallet not connected" }
      }

      setStatus("validating")
      setError(null)
      setTxHash(null)

      try {
        // Validate recipient
        const addressValidation = validateAddress(params.recipient)
        if (!addressValidation.isValid) {
          throw new Error(addressValidation.error || "Invalid address")
        }

        // Validate amount
        const amountValidation = validateAmount(params.amount, 100) // Mock balance
        if (!amountValidation.isValid) {
          throw new Error(amountValidation.error || "Invalid amount")
        }

        setStatus("preparing")

        // Simulate preparing transaction
        await new Promise((resolve) => setTimeout(resolve, 500))

        setStatus("signing")

        // Simulate signing
        await new Promise((resolve) => setTimeout(resolve, 500))

        setStatus("submitting")

        // Simulate submission
        await new Promise((resolve) => setTimeout(resolve, 1000))

        // Generate mock tx hash
        const mockTxHash = Array.from({ length: 88 }, () =>
          "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"[
            Math.floor(Math.random() * 58)
          ]
        ).join("")

        setTxHash(mockTxHash)
        setStatus("confirmed")

        // Record payment in store
        addPayment({
          id: `payment_${Date.now()}`,
          type: "send",
          amount: params.amount,
          token: "SOL",
          status: "completed",
          stealthAddress: addressValidation.type === "stealth" ? params.recipient : undefined,
          txHash: mockTxHash,
          timestamp: Date.now(),
          privacyLevel: params.privacyLevel,
        })

        return { success: true, txHash: mockTxHash }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Transaction failed"
        setError(errorMessage)
        setStatus("error")
        return { success: false, error: errorMessage }
      }
    },
    [isConnected, walletAddress, validateAddress, validateAmount, addPayment]
  )

  const reset = useCallback(() => {
    setStatus("idle")
    setError(null)
    setTxHash(null)
  }, [])

  return useMemo(
    () => ({
      status,
      error,
      txHash,
      validateAddress,
      validateAmount,
      isStealthAddress,
      send,
      reset,
      getUsdValue,
    }),
    [status, error, txHash, validateAddress, validateAmount, isStealthAddress, send, reset, getUsdValue]
  )
}
