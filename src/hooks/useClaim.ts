/**
 * Payment Claiming Hook
 *
 * Handles the claiming of stealth payments:
 * 1. Derive spending key from stealth address + viewing key
 * 2. Sign claim transaction
 * 3. Submit to network
 * 4. Update payment status
 */

import { useState, useCallback, useMemo } from "react"
import { Buffer } from "buffer"
import * as SecureStore from "expo-secure-store"
import { usePrivacyStore } from "@/stores/privacy"
import { useWalletStore } from "@/stores/wallet"
import { useSettingsStore } from "@/stores/settings"
import type { PaymentRecord } from "@/types"
import {
  deriveStealthPrivateKey,
  hexToBytes,
  type StealthAddress,
} from "@/lib/stealth"

// ============================================================================
// TYPES
// ============================================================================

export interface ClaimResult {
  success: boolean
  txHash?: string
  error?: string
}

export type ClaimStatus =
  | "idle"
  | "deriving"
  | "signing"
  | "submitting"
  | "confirmed"
  | "error"

export interface ClaimProgress {
  status: ClaimStatus
  message: string
  step: number
  totalSteps: number
}

export interface UseClaimReturn {
  // State
  progress: ClaimProgress
  error: string | null

  // Actions
  claim: (payment: PaymentRecord) => Promise<ClaimResult>
  claimMultiple: (payments: PaymentRecord[]) => Promise<ClaimResult[]>
  reset: () => void

  // Queries
  getUnclaimedPayments: () => PaymentRecord[]
  getClaimableAmount: () => { amount: number; count: number }
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SECURE_STORE_KEY = "sip_stealth_keys"
const CLAIM_STEPS = 4

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Parse a stealth address string into StealthAddress components
 * Format: sip:solana:<ephemeralPubKey>:derived or just the address
 */
function parsePaymentStealthAddress(addressStr: string | undefined): StealthAddress | null {
  if (!addressStr) return null

  // Try to parse SIP format: sip:solana:<ephemeral>:derived
  if (addressStr.startsWith("sip:")) {
    const parts = addressStr.split(":")
    if (parts.length >= 3) {
      const ephemeralPubKey = parts[2]
      // Derive view tag from ephemeral key (first byte of hash)
      const viewTag = parseInt(ephemeralPubKey.slice(2, 4), 16)
      return {
        address: parts[3] || "", // May not have actual address
        ephemeralPublicKey: ephemeralPubKey.startsWith("0x") ? ephemeralPubKey : `0x${ephemeralPubKey}`,
        viewTag,
      }
    }
  }

  return null
}

/**
 * Derive the stealth private key using real cryptographic operations
 *
 * Uses DKSAP (Dual-Key Stealth Address Protocol):
 * 1. Compute shared secret: S = spending_scalar * ephemeral_pubkey
 * 2. Hash the shared secret
 * 3. Derive: stealth_private = viewing_scalar + hash(S) mod L
 */
async function deriveSpendingKeyFromPayment(
  payment: PaymentRecord,
  spendingPrivateKey: string,
  viewingPrivateKey: string
): Promise<string | null> {
  const stealthAddr = parsePaymentStealthAddress(payment.stealthAddress)
  if (!stealthAddr || !stealthAddr.ephemeralPublicKey) {
    console.error("Invalid stealth address format")
    return null
  }

  try {
    // Use real cryptographic key derivation
    const derivedKey = deriveStealthPrivateKey(
      stealthAddr,
      spendingPrivateKey,
      viewingPrivateKey
    )
    return derivedKey
  } catch (err) {
    console.error("Failed to derive stealth private key:", err)
    return null
  }
}

/**
 * Build and sign the claim transaction
 *
 * In production, this builds a Solana transaction that:
 * 1. Transfers funds from the stealth address to the user's wallet
 * 2. Signs with the derived stealth private key
 */
/**
 * Build claim transaction
 *
 * ============================================================
 * MOCK TRANSACTION (Anchor infrastructure required)
 * ============================================================
 * Real implementation requires:
 * 1. @coral-xyz/anchor dependency
 * 2. IDL types from sip-privacy program
 * 3. PDA derivation for: config, transfer_record, nullifier_record
 * 4. Proof of stealth address ownership (derived from viewing key)
 * 5. Nullifier generation to prevent double-claims
 *
 * Program: S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at (devnet)
 * Instruction: claim_transfer / claim_token_transfer
 * ============================================================
 */
async function buildClaimTransaction(
  _payment: PaymentRecord,
  derivedKey: string,
  _destinationAddress: string,
  _network: string
): Promise<{ serialized: Uint8Array; signature: string }> {
  // Simulate building delay
  await new Promise((resolve) => setTimeout(resolve, 300))

  // Mock signature using derived key
  const mockSig = new Uint8Array(64)
  const derivedKeyBytes = hexToBytes(derivedKey)
  mockSig.set(derivedKeyBytes.slice(0, 32), 0)

  return {
    serialized: new Uint8Array(512).fill(0),
    signature: Array.from(mockSig.slice(0, 32))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(""),
  }
}

/**
 * Submit claim transaction to network
 *
 * Real: await connection.sendRawTransaction(serializedTx)
 */
async function submitClaimTransaction(
  _serializedTx: Uint8Array,
  _network: string
): Promise<string> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 800))

  // Generate mock transaction hash
  return `mock_claim_${Date.now()}_${Array.from({ length: 16 }, () =>
    "0123456789abcdef"[Math.floor(Math.random() * 16)]
  ).join("")}`
}

// ============================================================================
// HOOK
// ============================================================================

export function useClaim(): UseClaimReturn {
  const { isConnected, address: walletAddress } = useWalletStore()
  const { network } = useSettingsStore()
  const { payments, updatePayment } = usePrivacyStore()

  const [progress, setProgress] = useState<ClaimProgress>({
    status: "idle",
    message: "Ready to claim",
    step: 0,
    totalSteps: CLAIM_STEPS,
  })
  const [error, setError] = useState<string | null>(null)

  const claim = useCallback(
    async (payment: PaymentRecord): Promise<ClaimResult> => {
      if (!isConnected || !walletAddress) {
        return { success: false, error: "Wallet not connected" }
      }

      if (payment.claimed) {
        return { success: false, error: "Payment already claimed" }
      }

      if (payment.type !== "receive") {
        return { success: false, error: "Can only claim received payments" }
      }

      setError(null)

      try {
        // Step 1: Load keys
        setProgress({
          status: "deriving",
          message: "Loading stealth keys...",
          step: 1,
          totalSteps: CLAIM_STEPS,
        })

        const storedKeys = await SecureStore.getItemAsync(SECURE_STORE_KEY)
        if (!storedKeys) {
          throw new Error("Stealth keys not found")
        }

        const keys = JSON.parse(storedKeys)
        const { viewingPrivateKey, spendingPrivateKey } = keys

        if (!viewingPrivateKey || !spendingPrivateKey) {
          throw new Error("Invalid stealth keys")
        }

        // Step 2: Derive spending key using real cryptographic operations
        setProgress({
          status: "deriving",
          message: "Deriving spending key...",
          step: 2,
          totalSteps: CLAIM_STEPS,
        })

        const derivedKey = await deriveSpendingKeyFromPayment(
          payment,
          spendingPrivateKey,
          viewingPrivateKey
        )

        if (!derivedKey) {
          throw new Error("Failed to derive spending key - invalid stealth address")
        }

        // Step 3: Build and sign claim transaction
        setProgress({
          status: "signing",
          message: "Building claim transaction...",
          step: 3,
          totalSteps: CLAIM_STEPS,
        })

        const { serialized } = await buildClaimTransaction(
          payment,
          derivedKey,
          walletAddress,
          network
        )

        // Step 4: Submit transaction
        setProgress({
          status: "submitting",
          message: "Submitting to network...",
          step: 4,
          totalSteps: CLAIM_STEPS,
        })

        const txHash = await submitClaimTransaction(serialized, network)

        // Update payment status
        updatePayment(payment.id, {
          status: "claimed",
          claimed: true,
          claimedAt: Date.now(),
          txHash: txHash,
        })

        setProgress({
          status: "confirmed",
          message: "Claim successful!",
          step: 4,
          totalSteps: CLAIM_STEPS,
        })

        return { success: true, txHash }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Claim failed"
        setError(errorMessage)
        setProgress({
          status: "error",
          message: errorMessage,
          step: 0,
          totalSteps: CLAIM_STEPS,
        })
        return { success: false, error: errorMessage }
      }
    },
    [isConnected, walletAddress, updatePayment]
  )

  const claimMultiple = useCallback(
    async (paymentsToClaimList: PaymentRecord[]): Promise<ClaimResult[]> => {
      const results: ClaimResult[] = []

      for (const payment of paymentsToClaimList) {
        const result = await claim(payment)
        results.push(result)

        // Small delay between claims
        if (result.success) {
          await new Promise((resolve) => setTimeout(resolve, 200))
        }
      }

      return results
    },
    [claim]
  )

  const reset = useCallback(() => {
    setProgress({
      status: "idle",
      message: "Ready to claim",
      step: 0,
      totalSteps: CLAIM_STEPS,
    })
    setError(null)
  }, [])

  const getUnclaimedPayments = useCallback((): PaymentRecord[] => {
    return payments.filter(
      (p) =>
        p.type === "receive" &&
        p.status === "completed" &&
        !p.claimed
    )
  }, [payments])

  const getClaimableAmount = useCallback((): { amount: number; count: number } => {
    const unclaimed = getUnclaimedPayments()
    const totalAmount = unclaimed.reduce(
      (sum, p) => sum + parseFloat(p.amount),
      0
    )
    return {
      amount: totalAmount,
      count: unclaimed.length,
    }
  }, [getUnclaimedPayments])

  return useMemo(
    () => ({
      progress,
      error,
      claim,
      claimMultiple,
      reset,
      getUnclaimedPayments,
      getClaimableAmount,
    }),
    [progress, error, claim, claimMultiple, reset, getUnclaimedPayments, getClaimableAmount]
  )
}
