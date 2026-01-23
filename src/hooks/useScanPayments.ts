/**
 * Payment Scanning Hook
 *
 * Scans the blockchain for incoming stealth payments using viewing keys.
 * Implements EIP-5564 style scanning with Ed25519/secp256k1 support.
 *
 * Scanning process:
 * 1. Fetch announcements from the chain (ephemeral pubkeys)
 * 2. For each announcement, compute shared secret with viewing key
 * 3. Derive expected stealth address
 * 4. Check if derived address matches the announcement
 * 5. If match, user owns this payment - add to store
 */

import { useState, useCallback, useRef, useMemo } from "react"
import * as SecureStore from "expo-secure-store"
import { usePrivacyStore } from "@/stores/privacy"
import { useWalletStore } from "@/stores/wallet"
import type { PaymentRecord, PrivacyLevel } from "@/types"

// ============================================================================
// TYPES
// ============================================================================

export interface ScanResult {
  found: number
  scanned: number
  newPayments: PaymentRecord[]
  errors: string[]
}

export interface ScanProgress {
  stage: "idle" | "fetching" | "scanning" | "processing" | "complete" | "error"
  current: number
  total: number
  message: string
}

export interface ScanOptions {
  fromTimestamp?: number
  limit?: number
  includeCompleted?: boolean
}

export interface UseScanPaymentsReturn {
  // State
  isScanning: boolean
  progress: ScanProgress
  lastScanResult: ScanResult | null
  error: string | null

  // Actions
  scan: (options?: ScanOptions) => Promise<ScanResult>
  cancelScan: () => void
  getLastScanTime: () => number | null
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SECURE_STORE_KEY = "sip_stealth_keys"
const BATCH_SIZE = 50
const SCAN_DELAY_MS = 100 // Delay between batches for UI responsiveness

// ============================================================================
// MOCK DATA (Replace with real chain queries)
// ============================================================================

interface MockAnnouncement {
  id: string
  ephemeralPubKey: string
  stealthAddress: string
  amount: string
  token: string
  timestamp: number
  txHash: string
  privacyLevel: PrivacyLevel
}

/**
 * Generate mock announcements for testing
 * In production, these come from on-chain events or indexer
 */
function generateMockAnnouncements(count: number): MockAnnouncement[] {
  const announcements: MockAnnouncement[] = []
  const now = Date.now()

  for (let i = 0; i < count; i++) {
    const isOurs = Math.random() < 0.3 // 30% chance payment is ours
    const daysAgo = Math.floor(Math.random() * 30)

    announcements.push({
      id: `ann_${now}_${i}`,
      ephemeralPubKey: `02${generateRandomHex(32)}`,
      stealthAddress: isOurs ? "MATCH" : `stealth_${generateRandomHex(16)}`,
      amount: (Math.random() * 10).toFixed(4),
      token: "SOL",
      timestamp: now - daysAgo * 86400000,
      txHash: generateRandomHex(64),
      privacyLevel: Math.random() > 0.2 ? "shielded" : "compliant",
    })
  }

  return announcements.sort((a, b) => b.timestamp - a.timestamp)
}

function generateRandomHex(length: number): string {
  const array = new Uint8Array(length)
  for (let i = 0; i < length; i++) {
    array[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/**
 * Mock check if announcement belongs to user
 * In production, this uses ECDH with viewing key
 */
function checkAnnouncementOwnership(
  _announcement: MockAnnouncement,
  _viewingPrivateKey: string
): boolean {
  // Mock: use the pre-set flag
  return _announcement.stealthAddress === "MATCH"
}

// ============================================================================
// HOOK
// ============================================================================

export function useScanPayments(): UseScanPaymentsReturn {
  const { isConnected } = useWalletStore()
  const {
    payments,
    addPayment,
    setScanning,
    setLastScanTimestamp,
    lastScanTimestamp,
  } = usePrivacyStore()

  const [isScanning, setIsScanning] = useState(false)
  const [progress, setProgress] = useState<ScanProgress>({
    stage: "idle",
    current: 0,
    total: 0,
    message: "Ready to scan",
  })
  const [lastScanResult, setLastScanResult] = useState<ScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cancelRef = useRef(false)

  const scan = useCallback(
    async (options: ScanOptions = {}): Promise<ScanResult> => {
      if (!isConnected) {
        const result: ScanResult = {
          found: 0,
          scanned: 0,
          newPayments: [],
          errors: ["Wallet not connected"],
        }
        setLastScanResult(result)
        return result
      }

      // Reset state
      setIsScanning(true)
      setScanning(true)
      setError(null)
      cancelRef.current = false

      const result: ScanResult = {
        found: 0,
        scanned: 0,
        newPayments: [],
        errors: [],
      }

      try {
        // Stage 1: Fetch viewing keys
        setProgress({
          stage: "fetching",
          current: 0,
          total: 0,
          message: "Loading viewing keys...",
        })

        const storedKeys = await SecureStore.getItemAsync(SECURE_STORE_KEY)
        if (!storedKeys) {
          throw new Error("No stealth keys found. Generate an address first.")
        }

        const keys = JSON.parse(storedKeys)
        const viewingPrivateKey = keys.viewingPrivateKey

        if (!viewingPrivateKey) {
          throw new Error("Viewing key not found")
        }

        // Check for cancellation
        if (cancelRef.current) {
          throw new Error("Scan cancelled")
        }

        // Stage 2: Fetch announcements
        setProgress({
          stage: "fetching",
          current: 0,
          total: 0,
          message: "Fetching payment announcements...",
        })

        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 500))

        // Get mock announcements (in production, query indexer/RPC)
        const limit = options.limit || 100
        const announcements = generateMockAnnouncements(limit)

        // Filter by timestamp if provided
        const filteredAnnouncements = options.fromTimestamp
          ? announcements.filter((a) => a.timestamp > options.fromTimestamp!)
          : announcements

        const total = filteredAnnouncements.length

        if (total === 0) {
          setProgress({
            stage: "complete",
            current: 0,
            total: 0,
            message: "No new announcements to scan",
          })
          setLastScanResult(result)
          return result
        }

        // Stage 3: Scan announcements
        setProgress({
          stage: "scanning",
          current: 0,
          total,
          message: `Scanning ${total} announcements...`,
        })

        // Get existing payment IDs to avoid duplicates
        const existingTxHashes = new Set(
          payments.map((p) => p.txHash).filter(Boolean)
        )

        // Process in batches
        for (let i = 0; i < total; i += BATCH_SIZE) {
          // Check for cancellation
          if (cancelRef.current) {
            throw new Error("Scan cancelled")
          }

          const batch = filteredAnnouncements.slice(i, i + BATCH_SIZE)

          for (const announcement of batch) {
            result.scanned++

            // Check if we already have this payment
            if (existingTxHashes.has(announcement.txHash)) {
              continue
            }

            // Check ownership using viewing key
            const isOurs = checkAnnouncementOwnership(
              announcement,
              viewingPrivateKey
            )

            if (isOurs) {
              result.found++

              // Create payment record
              const payment: PaymentRecord = {
                id: `payment_${Date.now()}_${result.found}`,
                type: "receive",
                amount: announcement.amount,
                token: announcement.token,
                status: "completed",
                stealthAddress: `sip:solana:${announcement.ephemeralPubKey}:derived`,
                txHash: announcement.txHash,
                timestamp: announcement.timestamp,
                privacyLevel: announcement.privacyLevel,
                claimed: false,
              }

              result.newPayments.push(payment)
              addPayment(payment)
            }
          }

          // Update progress
          setProgress({
            stage: "scanning",
            current: Math.min(i + BATCH_SIZE, total),
            total,
            message: `Scanned ${Math.min(i + BATCH_SIZE, total)}/${total} announcements, found ${result.found}`,
          })

          // Small delay for UI responsiveness
          await new Promise((resolve) => setTimeout(resolve, SCAN_DELAY_MS))
        }

        // Stage 4: Complete
        setProgress({
          stage: "complete",
          current: total,
          total,
          message: `Found ${result.found} payment${result.found !== 1 ? "s" : ""} in ${total} announcements`,
        })

        setLastScanTimestamp(Date.now())
        setLastScanResult(result)

        return result
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Scan failed"

        if (errorMessage !== "Scan cancelled") {
          result.errors.push(errorMessage)
          setError(errorMessage)
          setProgress({
            stage: "error",
            current: 0,
            total: 0,
            message: errorMessage,
          })
        } else {
          setProgress({
            stage: "idle",
            current: 0,
            total: 0,
            message: "Scan cancelled",
          })
        }

        setLastScanResult(result)
        return result
      } finally {
        setIsScanning(false)
        setScanning(false)
      }
    },
    [isConnected, payments, addPayment, setScanning, setLastScanTimestamp]
  )

  const cancelScan = useCallback(() => {
    cancelRef.current = true
  }, [])

  const getLastScanTime = useCallback((): number | null => {
    return lastScanTimestamp
  }, [lastScanTimestamp])

  return useMemo(
    () => ({
      isScanning,
      progress,
      lastScanResult,
      error,
      scan,
      cancelScan,
      getLastScanTime,
    }),
    [isScanning, progress, lastScanResult, error, scan, cancelScan, getLastScanTime]
  )
}
