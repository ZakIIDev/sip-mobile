/**
 * useSeedVault Hook
 *
 * Direct Seed Vault integration for Solana Mobile devices (Saga, Seeker).
 * Provides hardware-backed key custody through the device's secure element.
 *
 * Features:
 * - Hardware-backed key storage (Trusted Execution Environment)
 * - Biometric authentication (fingerprint, double-tap)
 * - BIP-0039 seed phrase support
 * - Transaction signing via secure element
 *
 * Requirements:
 * - Android only (Seed Vault not available on iOS)
 * - Device must have Seed Vault implementation (Saga, Seeker, or emulator with simulator)
 *
 * Part of Native Wallet Architecture (#61)
 * Issue: #70
 */

import { useState, useEffect, useCallback } from "react"
import { Platform, PermissionsAndroid } from "react-native"
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js"

// Types for Seed Vault SDK (imported dynamically to avoid iOS bundling issues)
interface SeedInfo {
  authToken: number
  name: string
  purpose: number
}

// AccountInfo used when enumerating accounts (reserved for future use)
// interface AccountInfo {
//   derivationPath: string
//   name: string
//   publicKey: Uint8Array
//   publicKeyEncoded: string
// }

interface PublicKeyInfo {
  publicKey: Uint8Array
  publicKeyEncoded: string
  resolvedDerivationPath: string
}

export interface SeedVaultWallet {
  publicKey: PublicKey
  authToken: number
  derivationPath: string
  seedName: string
}

export interface UseSeedVaultReturn {
  // State
  wallet: SeedVaultWallet | null
  isAvailable: boolean
  isLoading: boolean
  isInitialized: boolean
  error: Error | null

  // Methods
  checkAvailability: () => Promise<boolean>
  requestPermission: () => Promise<boolean>
  authorizeNewSeed: () => Promise<SeedInfo | null>
  getAuthorizedSeeds: () => Promise<SeedInfo[]>
  selectSeed: (authToken: number) => Promise<void>
  signTransaction: <T extends Transaction | VersionedTransaction>(
    tx: T
  ) => Promise<T>
  signMessage: (message: Uint8Array) => Promise<Uint8Array>
  signAllTransactions: <T extends Transaction | VersionedTransaction>(
    txs: T[]
  ) => Promise<T[]>
  disconnect: () => void
}

// Solana BIP44 derivation path
const SOLANA_DERIVATION_PATH = "m/44'/501'/0'/0'"

/**
 * Hook for Seed Vault integration on Solana Mobile devices
 *
 * @param allowSimulated - Allow simulated Seed Vault for development (default: false in prod)
 */
export function useSeedVault(
  allowSimulated: boolean = __DEV__
): UseSeedVaultReturn {
  const [wallet, setWallet] = useState<SeedVaultWallet | null>(null)
  const [isAvailable, setIsAvailable] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isInitialized, setIsInitialized] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Dynamic import to avoid bundling on iOS
  const getSeedVaultLib = useCallback(async () => {
    if (Platform.OS !== "android") {
      return null
    }

    try {
      const lib = await import("@solana-mobile/seed-vault-lib")
      return lib
    } catch (err) {
      console.warn("[SeedVault] Failed to load Seed Vault library:", err)
      return null
    }
  }, [])

  // Check if Seed Vault is available on this device
  const checkAvailability = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== "android") {
      setIsAvailable(false)
      return false
    }

    try {
      const lib = await getSeedVaultLib()
      if (!lib) {
        setIsAvailable(false)
        return false
      }

      const available = await lib.SolanaMobileSeedVaultLib.isSeedVaultAvailable(
        allowSimulated
      )
      setIsAvailable(available)
      return available
    } catch (err) {
      console.error("[SeedVault] Availability check failed:", err)
      setIsAvailable(false)
      return false
    }
  }, [allowSimulated, getSeedVaultLib])

  // Request Seed Vault Android permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== "android") {
      return false
    }

    try {
      const lib = await getSeedVaultLib()
      if (!lib) return false

      const result = await PermissionsAndroid.request(
        lib.SeedVaultPermissionAndroid,
        {
          title: "SIP Privacy Wallet Permission",
          message:
            "SIP Privacy needs access to Seed Vault for secure key storage.",
          buttonPositive: "Allow",
          buttonNegative: "Deny",
        }
      )

      return result === PermissionsAndroid.RESULTS.GRANTED
    } catch (err) {
      console.error("[SeedVault] Permission request failed:", err)
      setError(err instanceof Error ? err : new Error("Permission denied"))
      return false
    }
  }, [getSeedVaultLib])

  // Authorize a new seed (prompts user to create/import seed in Seed Vault)
  const authorizeNewSeed = useCallback(async (): Promise<SeedInfo | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const lib = await getSeedVaultLib()
      if (!lib) throw new Error("Seed Vault not available")

      const result = await lib.SeedVault.authorizeNewSeed()
      setIsLoading(false)
      return result as SeedInfo
    } catch (err) {
      console.error("[SeedVault] Authorization failed:", err)
      setError(err instanceof Error ? err : new Error("Authorization failed"))
      setIsLoading(false)
      return null
    }
  }, [getSeedVaultLib])

  // Get all authorized seeds
  const getAuthorizedSeeds = useCallback(async (): Promise<SeedInfo[]> => {
    try {
      const lib = await getSeedVaultLib()
      if (!lib) return []

      const seeds = await lib.SeedVault.getAuthorizedSeeds()
      return seeds as SeedInfo[]
    } catch (err) {
      console.error("[SeedVault] Failed to get seeds:", err)
      return []
    }
  }, [getSeedVaultLib])

  // Select a seed and derive the Solana account
  const selectSeed = useCallback(
    async (authToken: number): Promise<void> => {
      setIsLoading(true)
      setError(null)

      try {
        const lib = await getSeedVaultLib()
        if (!lib) throw new Error("Seed Vault not available")

        // Get the authorized seed info
        const seeds = await lib.SeedVault.getAuthorizedSeeds()
        const seed = (seeds as SeedInfo[]).find((s) => s.authToken === authToken)

        if (!seed) {
          throw new Error("Seed not found")
        }

        // Get the public key for Solana derivation path
        const pubKeyInfo: PublicKeyInfo = await lib.SeedVault.getPublicKey(
          authToken,
          SOLANA_DERIVATION_PATH
        )

        const publicKey = new PublicKey(pubKeyInfo.publicKeyEncoded)

        setWallet({
          publicKey,
          authToken,
          derivationPath: pubKeyInfo.resolvedDerivationPath,
          seedName: seed.name,
        })

        setIsLoading(false)
      } catch (err) {
        console.error("[SeedVault] Seed selection failed:", err)
        setError(
          err instanceof Error ? err : new Error("Failed to select seed")
        )
        setIsLoading(false)
        throw err
      }
    },
    [getSeedVaultLib]
  )

  // Sign a transaction
  const signTransaction = useCallback(
    async <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> => {
      if (!wallet) {
        throw new Error("No wallet connected")
      }

      try {
        const lib = await getSeedVaultLib()
        if (!lib) throw new Error("Seed Vault not available")

        // Serialize transaction to bytes
        const txBytes =
          tx instanceof VersionedTransaction
            ? tx.serialize()
            : tx.serialize({ requireAllSignatures: false })

        // Sign via Seed Vault (returns signature)
        const signatureResult = await lib.SeedVault.signTransaction(
          wallet.authToken,
          wallet.derivationPath,
          txBytes
        )

        // Add signature to transaction
        if (tx instanceof VersionedTransaction) {
          // For VersionedTransaction, we need to reconstruct
          const signedTx = VersionedTransaction.deserialize(
            signatureResult as Uint8Array
          )
          return signedTx as T
        } else {
          // For legacy Transaction
          tx.addSignature(
            wallet.publicKey,
            Buffer.from(signatureResult as Uint8Array)
          )
          return tx
        }
      } catch (err) {
        console.error("[SeedVault] Transaction signing failed:", err)
        throw err
      }
    },
    [wallet, getSeedVaultLib]
  )

  // Sign a message
  const signMessage = useCallback(
    async (message: Uint8Array): Promise<Uint8Array> => {
      if (!wallet) {
        throw new Error("No wallet connected")
      }

      try {
        const lib = await getSeedVaultLib()
        if (!lib) throw new Error("Seed Vault not available")

        const signature = await lib.SeedVault.signMessage(
          wallet.authToken,
          wallet.derivationPath,
          message
        )

        return signature as Uint8Array
      } catch (err) {
        console.error("[SeedVault] Message signing failed:", err)
        throw err
      }
    },
    [wallet, getSeedVaultLib]
  )

  // Sign multiple transactions
  const signAllTransactions = useCallback(
    async <T extends Transaction | VersionedTransaction>(
      txs: T[]
    ): Promise<T[]> => {
      return Promise.all(txs.map((tx) => signTransaction(tx)))
    },
    [signTransaction]
  )

  // Disconnect wallet
  const disconnect = useCallback(() => {
    setWallet(null)
  }, [])

  // Initialize on mount
  useEffect(() => {
    const init = async () => {
      setIsLoading(true)

      // Check availability
      const available = await checkAvailability()

      if (available) {
        // Check for existing authorized seeds
        const seeds = await getAuthorizedSeeds()

        // If there's an authorized seed, select the first one
        if (seeds.length > 0) {
          try {
            await selectSeed(seeds[0].authToken)
          } catch (err) {
            console.warn("[SeedVault] Auto-select failed:", err)
          }
        }
      }

      setIsInitialized(true)
      setIsLoading(false)
    }

    init()
  }, [checkAvailability, getAuthorizedSeeds, selectSeed])

  return {
    wallet,
    isAvailable,
    isLoading,
    isInitialized,
    error,
    checkAvailability,
    requestPermission,
    authorizeNewSeed,
    getAuthorizedSeeds,
    selectSeed,
    signTransaction,
    signMessage,
    signAllTransactions,
    disconnect,
  }
}
