/**
 * Scan Flow E2E Tests
 *
 * Tests the complete payment scanning flow:
 * 1. Load viewing keys
 * 2. Fetch announcements from chain/indexer
 * 3. Check each announcement for ownership
 * 4. Add discovered payments to store
 * 5. Track scan progress
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { resetMocks } from "../helpers/mockRpc"

// ============================================================================
// Types
// ============================================================================

type ScanStage = "idle" | "fetching" | "scanning" | "processing" | "complete" | "error"

interface ScanProgress {
  stage: ScanStage
  current: number
  total: number
  message: string
}

interface ScanResult {
  found: number
  scanned: number
  newPayments: PaymentRecord[]
  errors: string[]
}

interface PaymentRecord {
  id: string
  type: "send" | "receive"
  amount: string
  token: string
  status: "pending" | "completed" | "claimed" | "failed"
  stealthAddress?: string
  txHash: string
  timestamp: number
  claimed: boolean
}

interface StealthKeys {
  spendingPrivateKey: string
  viewingPrivateKey: string
}

interface Announcement {
  id: string
  ephemeralPubKey: string
  stealthAddress: string
  amount: string
  token: string
  timestamp: number
  txHash: string
  isOurs: boolean // For testing - in production this is determined by crypto check
}

// ============================================================================
// Mock Data Generators
// ============================================================================

function generateMockAnnouncement(
  index: number,
  isOurs: boolean = false
): Announcement {
  const now = Date.now()
  return {
    id: `ann_${now}_${index}`,
    ephemeralPubKey: `0x02${"ab".repeat(31)}${index.toString(16).padStart(2, "0")}`,
    stealthAddress: isOurs ? "MATCH" : `0x${"cd".repeat(32)}`,
    amount: (Math.random() * 10).toFixed(4),
    token: "SOL",
    timestamp: now - Math.floor(Math.random() * 30) * 86400000,
    txHash: `${"ef".repeat(32)}${index}`,
    isOurs,
  }
}

function generateMockAnnouncements(
  count: number,
  ourPaymentIndices: number[] = []
): Announcement[] {
  return Array.from({ length: count }, (_, i) =>
    generateMockAnnouncement(i, ourPaymentIndices.includes(i))
  )
}

// ============================================================================
// Mock Scan Flow Implementation
// ============================================================================

async function executeScanFlow(
  keys: StealthKeys | null,
  existingTxHashes: Set<string>,
  options: {
    limit?: number
    fromTimestamp?: number
    mockAnnouncements?: Announcement[]
  } = {}
): Promise<{ progress: ScanProgress; result: ScanResult }> {
  const result: ScanResult = {
    found: 0,
    scanned: 0,
    newPayments: [],
    errors: [],
  }

  // Step 1: Validate keys
  if (!keys) {
    return {
      progress: { stage: "error", current: 0, total: 0, message: "No stealth keys found" },
      result: { ...result, errors: ["No stealth keys found"] },
    }
  }

  // Step 2: Fetch announcements (mock)
  const announcements = options.mockAnnouncements || generateMockAnnouncements(
    options.limit || 100,
    [2, 7, 15, 42] // Indices of "our" payments
  )

  // Filter by timestamp
  const filteredAnnouncements = options.fromTimestamp
    ? announcements.filter((a) => a.timestamp > options.fromTimestamp!)
    : announcements

  const total = filteredAnnouncements.length

  if (total === 0) {
    return {
      progress: { stage: "complete", current: 0, total: 0, message: "No announcements to scan" },
      result,
    }
  }

  // Step 3: Scan announcements
  const BATCH_SIZE = 50

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = filteredAnnouncements.slice(i, i + BATCH_SIZE)

    for (const announcement of batch) {
      result.scanned++

      // Skip existing payments
      if (existingTxHashes.has(announcement.txHash)) {
        continue
      }

      // Check ownership (mock - in production uses crypto)
      if (announcement.isOurs) {
        result.found++

        const payment: PaymentRecord = {
          id: `payment_${Date.now()}_${result.found}`,
          type: "receive",
          amount: announcement.amount,
          token: announcement.token,
          status: "completed",
          stealthAddress: `sip:solana:${announcement.ephemeralPubKey}:derived`,
          txHash: announcement.txHash,
          timestamp: announcement.timestamp,
          claimed: false,
        }

        result.newPayments.push(payment)
      }
    }

    // Simulate batch processing delay
    await new Promise((resolve) => setTimeout(resolve, 10))
  }

  return {
    progress: {
      stage: "complete",
      current: total,
      total,
      message: `Found ${result.found} payment${result.found !== 1 ? "s" : ""} in ${total} announcements`,
    },
    result,
  }
}

// ============================================================================
// Tests
// ============================================================================

describe("Scan Flow E2E", () => {
  const MOCK_KEYS: StealthKeys = {
    spendingPrivateKey: "0x" + "ab".repeat(32),
    viewingPrivateKey: "0x" + "cd".repeat(32),
  }

  beforeEach(() => {
    resetMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("Key Validation", () => {
    it("should require stealth keys", async () => {
      const { progress, result } = await executeScanFlow(null, new Set())

      expect(progress.stage).toBe("error")
      expect(result.errors).toContain("No stealth keys found")
    })

    it("should proceed with valid keys", async () => {
      const { progress } = await executeScanFlow(MOCK_KEYS, new Set(), {
        mockAnnouncements: [],
      })

      expect(progress.stage).toBe("complete")
    })
  })

  describe("Announcement Scanning", () => {
    it("should scan all announcements", async () => {
      const announcements = generateMockAnnouncements(50)

      const { result } = await executeScanFlow(MOCK_KEYS, new Set(), {
        mockAnnouncements: announcements,
      })

      expect(result.scanned).toBe(50)
    })

    it("should find owned payments", async () => {
      const announcements = generateMockAnnouncements(100, [5, 10, 20])

      const { result } = await executeScanFlow(MOCK_KEYS, new Set(), {
        mockAnnouncements: announcements,
      })

      expect(result.found).toBe(3)
      expect(result.newPayments.length).toBe(3)
    })

    it("should skip existing payments", async () => {
      const announcements = generateMockAnnouncements(50, [5, 10])
      const existingHashes = new Set([announcements[5].txHash])

      const { result } = await executeScanFlow(MOCK_KEYS, existingHashes, {
        mockAnnouncements: announcements,
      })

      expect(result.found).toBe(1) // Only index 10, not 5
    })

    it("should filter by timestamp", async () => {
      const now = Date.now()
      const announcements = [
        { ...generateMockAnnouncement(0, true), timestamp: now - 86400000 * 5 },
        { ...generateMockAnnouncement(1, true), timestamp: now - 86400000 * 2 },
        { ...generateMockAnnouncement(2, true), timestamp: now - 86400000 * 1 },
      ]

      const { result } = await executeScanFlow(MOCK_KEYS, new Set(), {
        mockAnnouncements: announcements,
        fromTimestamp: now - 86400000 * 3,
      })

      expect(result.scanned).toBe(2) // Only last 2 days
      expect(result.found).toBe(2)
    })
  })

  describe("Payment Creation", () => {
    it("should create correct payment records", async () => {
      const announcements = generateMockAnnouncements(10, [3])

      const { result } = await executeScanFlow(MOCK_KEYS, new Set(), {
        mockAnnouncements: announcements,
      })

      expect(result.newPayments.length).toBe(1)

      const payment = result.newPayments[0]
      expect(payment.type).toBe("receive")
      expect(payment.status).toBe("completed")
      expect(payment.claimed).toBe(false)
      expect(payment.stealthAddress).toContain("sip:solana:")
      expect(payment.txHash).toBeDefined()
    })

    it("should preserve announcement data", async () => {
      const announcements = [
        {
          ...generateMockAnnouncement(0, true),
          amount: "5.5000",
          token: "SOL",
        },
      ]

      const { result } = await executeScanFlow(MOCK_KEYS, new Set(), {
        mockAnnouncements: announcements,
      })

      const payment = result.newPayments[0]
      expect(payment.amount).toBe("5.5000")
      expect(payment.token).toBe("SOL")
    })
  })

  describe("Progress Tracking", () => {
    it("should report correct progress", async () => {
      const announcements = generateMockAnnouncements(100, [10, 20, 30])

      const { progress } = await executeScanFlow(MOCK_KEYS, new Set(), {
        mockAnnouncements: announcements,
      })

      expect(progress.stage).toBe("complete")
      expect(progress.current).toBe(100)
      expect(progress.total).toBe(100)
      expect(progress.message).toContain("3 payments")
    })

    it("should handle empty announcements", async () => {
      const { progress } = await executeScanFlow(MOCK_KEYS, new Set(), {
        mockAnnouncements: [],
      })

      expect(progress.stage).toBe("complete")
      expect(progress.message).toContain("No announcements")
    })

    it("should pluralize correctly", async () => {
      const onePayment = generateMockAnnouncements(10, [0])
      const { progress: progress1 } = await executeScanFlow(MOCK_KEYS, new Set(), {
        mockAnnouncements: onePayment,
      })
      expect(progress1.message).toContain("1 payment")
      expect(progress1.message).not.toContain("payments")

      const multiPayments = generateMockAnnouncements(10, [0, 1])
      const { progress: progress2 } = await executeScanFlow(MOCK_KEYS, new Set(), {
        mockAnnouncements: multiPayments,
      })
      expect(progress2.message).toContain("2 payments")
    })
  })

  describe("Edge Cases", () => {
    it("should handle large announcement sets", async () => {
      const announcements = generateMockAnnouncements(1000, [100, 200, 300, 400, 500])

      const { result } = await executeScanFlow(MOCK_KEYS, new Set(), {
        mockAnnouncements: announcements,
      })

      expect(result.scanned).toBe(1000)
      expect(result.found).toBe(5)
    })

    it("should handle no matching payments", async () => {
      const announcements = generateMockAnnouncements(50, []) // No owned payments

      const { result, progress } = await executeScanFlow(MOCK_KEYS, new Set(), {
        mockAnnouncements: announcements,
      })

      expect(result.found).toBe(0)
      expect(result.newPayments.length).toBe(0)
      expect(progress.message).toContain("0 payments")
    })

    it("should handle all matching payments", async () => {
      const indices = Array.from({ length: 20 }, (_, i) => i)
      const announcements = generateMockAnnouncements(20, indices)

      const { result } = await executeScanFlow(MOCK_KEYS, new Set(), {
        mockAnnouncements: announcements,
      })

      expect(result.found).toBe(20)
      expect(result.newPayments.length).toBe(20)
    })
  })

  describe("Duplicate Prevention", () => {
    it("should not duplicate payments across scans", async () => {
      const announcements = generateMockAnnouncements(20, [5, 10, 15])

      // First scan
      const { result: result1 } = await executeScanFlow(MOCK_KEYS, new Set(), {
        mockAnnouncements: announcements,
      })
      expect(result1.found).toBe(3)

      // Second scan with existing hashes
      const existingHashes = new Set(result1.newPayments.map((p) => p.txHash))
      const { result: result2 } = await executeScanFlow(MOCK_KEYS, existingHashes, {
        mockAnnouncements: announcements,
      })
      expect(result2.found).toBe(0) // All already exist
    })
  })
})
