/**
 * Send Hook
 *
 * Manages shielded transfer creation and submission.
 * Validates addresses, handles privacy levels, and tracks transaction state.
 */

import { useState, useCallback, useMemo } from "react"
import { useWalletStore } from "@/stores/wallet"
import { usePrivacyStore } from "@/stores/privacy"
import { useSettingsStore } from "@/stores/settings"
import { useWallet } from "./useWallet"
import { useBalance } from "./useBalance"
import type { PrivacyLevel } from "@/types"
import {
  generateStealthAddress,
  parseStealthMetaAddress,
} from "@/lib/stealth"

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

// Default SOL price (used as fallback when price not available)
const DEFAULT_SOL_PRICE_USD = 185.00

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
  const { network } = useSettingsStore()
  const { signTransaction } = useWallet()
  const { balance } = useBalance()
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
    return `$${(num * DEFAULT_SOL_PRICE_USD).toFixed(2)}`
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

        // Validate amount using real balance
        const amountValidation = validateAmount(params.amount, balance)
        if (!amountValidation.isValid) {
          throw new Error(amountValidation.error || "Invalid amount")
        }

        setStatus("preparing")

        // Prepare transaction based on address type
        let recipientAddress = params.recipient
        let stealthData: { ephemeralPubKey: string } | null = null

        if (addressValidation.type === "stealth") {
          // Parse stealth meta-address
          const metaAddress = parseStealthMetaAddress(params.recipient)
          if (!metaAddress) {
            throw new Error("Invalid stealth address format")
          }

          // Generate one-time stealth address
          const { stealthAddress } = await generateStealthAddress(metaAddress)
          recipientAddress = stealthAddress.address
          stealthData = { ephemeralPubKey: stealthAddress.ephemeralPublicKey }
        }

        setStatus("signing")

        // ============================================================
        // MOCK TRANSACTION (Anchor infrastructure required)
        // ============================================================
        // Real implementation requires:
        // 1. @coral-xyz/anchor dependency
        // 2. IDL types from sip-privacy program
        // 3. PDA derivation for: config, transfer_record, nullifier
        // 4. Pedersen commitment generation via @sip-protocol/sdk
        // 5. ZK proof generation (funding_proof circuit)
        //
        // Program: S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at (devnet)
        // See: sip-protocol/programs/sip-privacy for instruction format
        // ============================================================

        // Simulate transaction signing (no real tx yet)
        const mockTxBytes = new Uint8Array(512)
        mockTxBytes.fill(0)

        const signedTx = await signTransaction(mockTxBytes)
        if (!signedTx) {
          throw new Error("Transaction signing rejected")
        }

        setStatus("submitting")

        // Simulate network delay (no real submission yet)
        await new Promise((resolve) => setTimeout(resolve, 800))

        // Generate mock transaction hash
        // Real: const { signature } = await connection.sendRawTransaction(signedTx)
        const txHash = `mock_${Date.now()}_${Array.from({ length: 16 }, () =>
          "0123456789abcdef"[Math.floor(Math.random() * 16)]
        ).join("")}`

        setTxHash(txHash)
        setStatus("confirmed")

        // Record payment in store
        addPayment({
          id: `payment_${Date.now()}`,
          type: "send",
          amount: params.amount,
          token: "SOL",
          status: "completed",
          stealthAddress: addressValidation.type === "stealth" ? params.recipient : undefined,
          txHash: txHash,
          timestamp: Date.now(),
          privacyLevel: params.privacyLevel,
        })

        return { success: true, txHash: txHash }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Transaction failed"
        setError(errorMessage)
        setStatus("error")
        return { success: false, error: errorMessage }
      }
    },
    [isConnected, walletAddress, balance, signTransaction, validateAddress, validateAmount, addPayment]
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
