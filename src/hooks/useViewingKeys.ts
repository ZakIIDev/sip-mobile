/**
 * Viewing Keys Management Hook
 *
 * Manages viewing key operations for compliance and selective disclosure:
 * - Export viewing key for auditors
 * - Import viewing keys from others
 * - Track disclosure history
 * - Manage imported keys
 */

import { useState, useCallback, useEffect, useMemo } from "react"
import * as SecureStore from "expo-secure-store"
import { useWalletStore } from "@/stores/wallet"
import type {
  ViewingKeyDisclosure,
  ImportedViewingKey,
  ViewingKeyExport,
  ChainType,
} from "@/types"

// ============================================================================
// TYPES
// ============================================================================

export interface UseViewingKeysReturn {
  // State
  disclosures: ViewingKeyDisclosure[]
  importedKeys: ImportedViewingKey[]
  isLoading: boolean
  error: string | null

  // Export Actions
  exportViewingKey: (options?: ExportOptions) => Promise<ViewingKeyExport | null>
  getExportString: (options?: ExportOptions) => Promise<string | null>

  // Disclosure Actions
  recordDisclosure: (disclosure: DisclosureInput) => Promise<ViewingKeyDisclosure>
  revokeDisclosure: (id: string) => Promise<void>
  deleteDisclosure: (id: string) => Promise<void>

  // Import Actions
  importViewingKey: (input: ImportKeyInput) => Promise<ImportedViewingKey | null>
  removeImportedKey: (id: string) => Promise<void>
  updateImportedKey: (id: string, updates: Partial<ImportedViewingKey>) => Promise<void>

  // Queries
  getActiveDisclosures: () => ViewingKeyDisclosure[]
  hasViewingKey: () => Promise<boolean>
}

export interface ExportOptions {
  expiresInDays?: number
  includeMetadata?: boolean
}

export interface DisclosureInput {
  recipientName: string
  recipientAddress?: string
  purpose: "compliance" | "audit" | "personal" | "other"
  note?: string
  expiresInDays?: number
}

export interface ImportKeyInput {
  label: string
  viewingKeyData: string // JSON or base64 encoded ViewingKeyExport
  ownerAddress?: string
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STEALTH_KEYS_STORE = "sip_stealth_keys"
const DISCLOSURES_STORE = "sip_viewing_disclosures"
const IMPORTED_KEYS_STORE = "sip_imported_viewing_keys"
const EXPORT_VERSION = 1

// ============================================================================
// HELPERS
// ============================================================================

function generateId(): string {
  return `vk_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function encodeExport(data: ViewingKeyExport): string {
  const json = JSON.stringify(data)
  // In production, use proper base64 encoding
  return btoa(json)
}

function decodeExport(encoded: string): ViewingKeyExport | null {
  try {
    // Try base64 first
    const json = atob(encoded)
    return JSON.parse(json) as ViewingKeyExport
  } catch {
    // Try direct JSON
    try {
      return JSON.parse(encoded) as ViewingKeyExport
    } catch {
      return null
    }
  }
}

// ============================================================================
// HOOK
// ============================================================================

export function useViewingKeys(): UseViewingKeysReturn {
  const { isConnected } = useWalletStore()

  const [disclosures, setDisclosures] = useState<ViewingKeyDisclosure[]>([])
  const [importedKeys, setImportedKeys] = useState<ImportedViewingKey[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load data on mount
  useEffect(() => {
    if (isConnected) {
      loadData()
    } else {
      setDisclosures([])
      setImportedKeys([])
      setIsLoading(false)
    }
  }, [isConnected])

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Load disclosures
      const storedDisclosures = await SecureStore.getItemAsync(DISCLOSURES_STORE)
      if (storedDisclosures) {
        setDisclosures(JSON.parse(storedDisclosures))
      }

      // Load imported keys
      const storedImported = await SecureStore.getItemAsync(IMPORTED_KEYS_STORE)
      if (storedImported) {
        setImportedKeys(JSON.parse(storedImported))
      }
    } catch (err) {
      console.error("Failed to load viewing keys data:", err)
      setError("Failed to load viewing keys")
    } finally {
      setIsLoading(false)
    }
  }, [])

  const saveDisclosures = useCallback(
    async (newDisclosures: ViewingKeyDisclosure[]) => {
      await SecureStore.setItemAsync(
        DISCLOSURES_STORE,
        JSON.stringify(newDisclosures)
      )
      setDisclosures(newDisclosures)
    },
    []
  )

  const saveImportedKeys = useCallback(
    async (newKeys: ImportedViewingKey[]) => {
      await SecureStore.setItemAsync(IMPORTED_KEYS_STORE, JSON.stringify(newKeys))
      setImportedKeys(newKeys)
    },
    []
  )

  // ============================================================================
  // EXPORT ACTIONS
  // ============================================================================

  const exportViewingKey = useCallback(
    async (options?: ExportOptions): Promise<ViewingKeyExport | null> => {
      if (!isConnected) {
        setError("Wallet not connected")
        return null
      }

      try {
        const storedKeys = await SecureStore.getItemAsync(STEALTH_KEYS_STORE)
        if (!storedKeys) {
          setError("No stealth keys found")
          return null
        }

        const keys = JSON.parse(storedKeys)
        const now = Date.now()

        const exportData: ViewingKeyExport = {
          version: EXPORT_VERSION,
          chain: "solana" as ChainType,
          viewingPublicKey: keys.viewingPublicKey,
          viewingPrivateKey: keys.viewingPrivateKey,
          spendingPublicKey: keys.spendingPublicKey,
          exportedAt: now,
        }

        if (options?.expiresInDays) {
          exportData.expiresAt = now + options.expiresInDays * 24 * 60 * 60 * 1000
        }

        return exportData
      } catch (err) {
        console.error("Failed to export viewing key:", err)
        setError("Failed to export viewing key")
        return null
      }
    },
    [isConnected]
  )

  const getExportString = useCallback(
    async (options?: ExportOptions): Promise<string | null> => {
      const exportData = await exportViewingKey(options)
      if (!exportData) return null
      return encodeExport(exportData)
    },
    [exportViewingKey]
  )

  // ============================================================================
  // DISCLOSURE ACTIONS
  // ============================================================================

  const recordDisclosure = useCallback(
    async (input: DisclosureInput): Promise<ViewingKeyDisclosure> => {
      const now = Date.now()

      const disclosure: ViewingKeyDisclosure = {
        id: generateId(),
        recipientName: input.recipientName,
        recipientAddress: input.recipientAddress,
        purpose: input.purpose,
        note: input.note,
        disclosedAt: now,
        expiresAt: input.expiresInDays
          ? now + input.expiresInDays * 24 * 60 * 60 * 1000
          : undefined,
        revoked: false,
      }

      const newDisclosures = [disclosure, ...disclosures]
      await saveDisclosures(newDisclosures)

      return disclosure
    },
    [disclosures, saveDisclosures]
  )

  const revokeDisclosure = useCallback(
    async (id: string): Promise<void> => {
      const newDisclosures = disclosures.map((d) =>
        d.id === id ? { ...d, revoked: true, revokedAt: Date.now() } : d
      )
      await saveDisclosures(newDisclosures)
    },
    [disclosures, saveDisclosures]
  )

  const deleteDisclosure = useCallback(
    async (id: string): Promise<void> => {
      const newDisclosures = disclosures.filter((d) => d.id !== id)
      await saveDisclosures(newDisclosures)
    },
    [disclosures, saveDisclosures]
  )

  // ============================================================================
  // IMPORT ACTIONS
  // ============================================================================

  const importViewingKey = useCallback(
    async (input: ImportKeyInput): Promise<ImportedViewingKey | null> => {
      try {
        const exportData = decodeExport(input.viewingKeyData)
        if (!exportData) {
          setError("Invalid viewing key format")
          return null
        }

        // Check if expired
        if (exportData.expiresAt && exportData.expiresAt < Date.now()) {
          setError("This viewing key has expired")
          return null
        }

        // Check for duplicates
        const isDuplicate = importedKeys.some(
          (k) => k.viewingPublicKey === exportData.viewingPublicKey
        )
        if (isDuplicate) {
          setError("This viewing key has already been imported")
          return null
        }

        const importedKey: ImportedViewingKey = {
          id: generateId(),
          label: input.label,
          viewingPublicKey: exportData.viewingPublicKey,
          viewingPrivateKey: exportData.viewingPrivateKey,
          ownerAddress: input.ownerAddress,
          chain: exportData.chain,
          importedAt: Date.now(),
          paymentsFound: 0,
        }

        const newKeys = [importedKey, ...importedKeys]
        await saveImportedKeys(newKeys)

        return importedKey
      } catch (err) {
        console.error("Failed to import viewing key:", err)
        setError("Failed to import viewing key")
        return null
      }
    },
    [importedKeys, saveImportedKeys]
  )

  const removeImportedKey = useCallback(
    async (id: string): Promise<void> => {
      const newKeys = importedKeys.filter((k) => k.id !== id)
      await saveImportedKeys(newKeys)
    },
    [importedKeys, saveImportedKeys]
  )

  const updateImportedKey = useCallback(
    async (id: string, updates: Partial<ImportedViewingKey>): Promise<void> => {
      const newKeys = importedKeys.map((k) =>
        k.id === id ? { ...k, ...updates } : k
      )
      await saveImportedKeys(newKeys)
    },
    [importedKeys, saveImportedKeys]
  )

  // ============================================================================
  // QUERIES
  // ============================================================================

  const getActiveDisclosures = useCallback((): ViewingKeyDisclosure[] => {
    const now = Date.now()
    return disclosures.filter(
      (d) => !d.revoked && (!d.expiresAt || d.expiresAt > now)
    )
  }, [disclosures])

  const hasViewingKey = useCallback(async (): Promise<boolean> => {
    try {
      const storedKeys = await SecureStore.getItemAsync(STEALTH_KEYS_STORE)
      if (!storedKeys) return false
      const keys = JSON.parse(storedKeys)
      return Boolean(keys.viewingPrivateKey)
    } catch {
      return false
    }
  }, [])

  return useMemo(
    () => ({
      disclosures,
      importedKeys,
      isLoading,
      error,
      exportViewingKey,
      getExportString,
      recordDisclosure,
      revokeDisclosure,
      deleteDisclosure,
      importViewingKey,
      removeImportedKey,
      updateImportedKey,
      getActiveDisclosures,
      hasViewingKey,
    }),
    [
      disclosures,
      importedKeys,
      isLoading,
      error,
      exportViewingKey,
      getExportString,
      recordDisclosure,
      revokeDisclosure,
      deleteDisclosure,
      importViewingKey,
      removeImportedKey,
      updateImportedKey,
      getActiveDisclosures,
      hasViewingKey,
    ]
  )
}
