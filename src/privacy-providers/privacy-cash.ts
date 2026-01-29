/**
 * Privacy Cash Adapter
 *
 * Pool-based mixing with ZK proofs using the Privacy Cash SDK.
 * SDK: privacycash (npm) - audited by Zigtur
 *
 * Features:
 * - Pool-based deposits and withdrawals
 * - ZK proofs for privacy (snarkjs)
 * - Supports SOL, USDC, USDT
 *
 * Flow:
 * - Send: deposit(lamports) → withdraw(to recipient)
 *
 * Security:
 * - SDK requires Keypair for internal signing
 * - Private key accessed via biometric auth from SecureStore
 * - Key cleared from memory after use
 *
 * Note: SIP adds viewing keys on top for compliance.
 *
 * @see https://github.com/Privacy-Cash/privacy-cash-sdk
 * @see https://github.com/sip-protocol/sip-mobile/issues/73
 */

import type {
  PrivacyProviderAdapter,
  PrivacySendParams,
  PrivacySendResult,
  PrivacySendStatus,
  PrivacySwapParams,
  PrivacySwapResult,
  PrivacySwapStatus,
  AdapterOptions,
} from "./types"
import { debug } from "@/utils/logger"
import { getPrivateKey, clearSensitiveData } from "@/utils/keyStorage"
import { storeComplianceRecord } from "@/lib/compliance-records"
import { Keypair } from "@solana/web3.js"
import bs58 from "bs58"

// ============================================================================
// TYPES
// ============================================================================

/**
 * Privacy Cash SDK class
 * From: privacycash npm package
 */
interface PrivacyCashClient {
  deposit(params: { lamports: number }): Promise<{ tx: string }>
  withdraw(params: {
    lamports: number
    recipientAddress?: string
    referrer?: string
  }): Promise<{
    isPartial: boolean
    tx: string
    recipient: string
    amount_in_lamports: number
    fee_in_lamports: number
  }>
  getPrivateBalance(abortSignal?: AbortSignal): Promise<{ lamports: number }>
  depositSPL(params: {
    base_units?: number
    amount?: number
    mintAddress: string
  }): Promise<{ tx: string }>
  withdrawSPL(params: {
    base_units?: number
    amount?: number
    mintAddress: string
    recipientAddress?: string
    referrer?: string
  }): Promise<{
    isPartial: boolean
    tx: string
    recipient: string
    base_units: number
    fee_base_units: number
  }>
  getPrivateBalanceSpl(mintAddress: string): Promise<{
    base_units: number
    amount: number
    lamports: number
  }>
  clearCache(): Promise<void>
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Supported SPL tokens */
const SUPPORTED_TOKENS: Record<string, { mint: string; decimals: number }> = {
  USDC: { mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 },
  USDT: { mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals: 6 },
}

/** SOL decimals */
const SOL_DECIMALS = 9

/** RPC endpoints by network */
const RPC_ENDPOINTS: Record<string, string> = {
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
  devnet: "https://api.devnet.solana.com",
  testnet: "https://api.testnet.solana.com",
}

// ============================================================================
// PRIVACY CASH ADAPTER
// ============================================================================

export class PrivacyCashAdapter implements PrivacyProviderAdapter {
  readonly id = "privacy-cash" as const
  readonly name = "Privacy Cash"

  private options: AdapterOptions
  private initialized = false
  /** SDK class loaded dynamically - client created on-demand with keypair */
  private PrivacyCashClass: (new (config: {
    RPC_url: string
    owner: Keypair
    enableDebug?: boolean
  }) => PrivacyCashClient) | null = null

  constructor(options: AdapterOptions) {
    this.options = options
  }

  async initialize(): Promise<void> {
    try {
      // Import Privacy Cash SDK
      const { PrivacyCash } = await import("privacycash")
      // Cast through unknown - SDK accepts multiple owner types
      this.PrivacyCashClass = PrivacyCash as unknown as typeof this.PrivacyCashClass

      debug("Privacy Cash SDK loaded successfully")
      this.initialized = true
    } catch (err) {
      debug("Privacy Cash SDK initialization failed:", err)
      this.initialized = true
    }
  }

  /**
   * Get keypair from SecureStore (requires biometric auth)
   * Creates client on-demand for each operation
   */
  private async getClientWithKeypair(): Promise<{
    client: PrivacyCashClient
    keypair: Keypair
    secretKey: Uint8Array
  }> {
    if (!this.PrivacyCashClass) {
      throw new Error("Privacy Cash SDK not loaded")
    }

    // Get private key (triggers biometric auth)
    const privateKeyBase58 = await getPrivateKey()
    if (!privateKeyBase58) {
      throw new Error("Wallet not found or authentication failed")
    }

    // Decode and create keypair
    const secretKey = bs58.decode(privateKeyBase58)
    const keypair = Keypair.fromSecretKey(secretKey)

    // Create client with keypair
    const rpcUrl = this.options.rpcEndpoint || RPC_ENDPOINTS[this.options.network]
    const client = new this.PrivacyCashClass({
      RPC_url: rpcUrl,
      owner: keypair,
      enableDebug: false,
    })

    return { client, keypair, secretKey }
  }

  isReady(): boolean {
    return this.initialized
  }

  supportsFeature(feature: "send" | "swap" | "viewingKeys" | "compliance"): boolean {
    switch (feature) {
      case "send":
        return true
      case "swap":
        return false // Privacy Cash focuses on transfers, not DEX
      case "viewingKeys":
        return false // SIP adds this on top
      case "compliance":
        return false
      default:
        return false
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ADDRESS VALIDATION
  // ─────────────────────────────────────────────────────────────────────────

  async validateRecipient(address: string): Promise<{
    isValid: boolean
    type: "stealth" | "pool" | "regular" | "invalid"
    error?: string
  }> {
    if (!address || address.trim() === "") {
      return { isValid: false, type: "invalid", error: "Address is required" }
    }

    const trimmed = address.trim()

    // Check for SIP stealth address format: sip:solana:<spending>:<viewing>
    const STEALTH_REGEX = /^sip:solana:[1-9A-HJ-NP-Za-km-z]{32,44}:[1-9A-HJ-NP-Za-km-z]{32,44}$/
    if (STEALTH_REGEX.test(trimmed)) {
      return { isValid: true, type: "stealth" }
    }

    // Privacy Cash uses standard Solana addresses
    const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
    if (SOLANA_ADDRESS_REGEX.test(trimmed)) {
      return { isValid: true, type: "pool" }
    }

    return { isValid: false, type: "invalid", error: "Invalid Solana address" }
  }

  /**
   * Fallback to SIP Native shielded transfer when Privacy Cash SDK is not available
   * This provides stealth address privacy but not pool-based mixing
   */
  private async sendWithSipNativeFallback(
    params: PrivacySendParams,
    signTransaction: (tx: Uint8Array) => Promise<Uint8Array | null>,
    onStatusChange?: (status: PrivacySendStatus) => void
  ): Promise<PrivacySendResult> {
    try {
      // Import SIP Native adapter dynamically
      const { SipNativeAdapter } = await import("./sip-native")
      const sipNative = new SipNativeAdapter(this.options)
      await sipNative.initialize()

      debug("Privacy Cash: Using SIP Native fallback for transfer")

      // Delegate to SIP Native
      const result = await sipNative.send(params, signTransaction, onStatusChange)

      // Add note that this used fallback
      if (result.success) {
        return {
          ...result,
          providerData: {
            ...result.providerData,
            provider: "privacy-cash",
            fallback: true,
            note: "Used SIP Native fallback (Privacy Cash SDK unavailable in React Native)",
          },
        }
      }

      return result
    } catch (err) {
      onStatusChange?.("error")
      return {
        success: false,
        error: `Fallback failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SEND OPERATION
  // ─────────────────────────────────────────────────────────────────────────

  async send(
    params: PrivacySendParams,
    signTransaction: (tx: Uint8Array) => Promise<Uint8Array | null>,
    onStatusChange?: (status: PrivacySendStatus) => void
  ): Promise<PrivacySendResult> {
    onStatusChange?.("validating")

    // FALLBACK: If Privacy Cash SDK not available, use SIP Native shielded transfer
    // This provides stealth address privacy but not pool-based mixing
    if (!this.PrivacyCashClass) {
      debug("Privacy Cash: SDK not available, falling back to SIP Native shielded transfer")
      return this.sendWithSipNativeFallback(params, signTransaction, onStatusChange)
    }

    let secretKey: Uint8Array | null = null

    try {
      // Validate recipient
      const validation = await this.validateRecipient(params.recipient)
      if (!validation.isValid) {
        throw new Error(validation.error || "Invalid address")
      }

      onStatusChange?.("preparing")

      // Get client with keypair (triggers biometric auth)
      debug("Privacy Cash: Requesting biometric auth...")
      const { client, secretKey: key } = await this.getClientWithKeypair()
      secretKey = key

      // Convert amount to lamports (SOL) or base_units (SPL)
      const amount = parseFloat(params.amount)
      const isSPL = params.tokenMint && params.tokenMint !== "So11111111111111111111111111111111111111112"

      if (isSPL) {
        // SPL token transfer
        const tokenInfo = Object.values(SUPPORTED_TOKENS).find(t => t.mint === params.tokenMint)
        if (!tokenInfo) {
          throw new Error("Token not supported by Privacy Cash (only USDC, USDT)")
        }

        const baseUnits = Math.floor(amount * Math.pow(10, tokenInfo.decimals))

        onStatusChange?.("signing")

        // Deposit to pool
        debug("Privacy Cash: Depositing SPL to pool...")
        await client.depositSPL({
          base_units: baseUnits,
          mintAddress: params.tokenMint!,
        })

        onStatusChange?.("submitting")

        // Withdraw to recipient
        debug("Privacy Cash: Withdrawing SPL to recipient...")
        const result = await client.withdrawSPL({
          base_units: baseUnits,
          mintAddress: params.tokenMint!,
          recipientAddress: params.recipient,
        })

        // Store compliance record with viewing key encryption
        const tokenSymbol = Object.entries(SUPPORTED_TOKENS).find(
          ([, t]) => t.mint === params.tokenMint
        )?.[0] || "SPL"

        const recordId = await storeComplianceRecord({
          provider: "privacy-cash",
          txHash: result.tx,
          amount: params.amount,
          token: tokenSymbol,
          recipient: params.recipient,
          metadata: {
            fee: String(result.fee_base_units),
            poolAddress: "privacy-cash-pool",
          },
        })

        debug("Compliance record stored:", recordId)

        onStatusChange?.("confirmed")

        return {
          success: true,
          txHash: result.tx,
          providerData: {
            provider: "privacy-cash",
            isPartial: result.isPartial,
            fee: result.fee_base_units,
            complianceRecordId: recordId,
          },
        }
      } else {
        // SOL transfer
        const lamports = Math.floor(amount * Math.pow(10, SOL_DECIMALS))

        onStatusChange?.("signing")

        // Deposit to pool
        debug("Privacy Cash: Depositing SOL to pool...")
        await client.deposit({ lamports })

        onStatusChange?.("submitting")

        // Withdraw to recipient
        debug("Privacy Cash: Withdrawing SOL to recipient...")
        const result = await client.withdraw({
          lamports,
          recipientAddress: params.recipient,
        })

        // Store compliance record with viewing key encryption
        const solRecordId = await storeComplianceRecord({
          provider: "privacy-cash",
          txHash: result.tx,
          amount: params.amount,
          token: "SOL",
          recipient: params.recipient,
          metadata: {
            fee: String(result.fee_in_lamports),
            poolAddress: "privacy-cash-pool",
          },
        })

        debug("Compliance record stored:", solRecordId)

        onStatusChange?.("confirmed")

        return {
          success: true,
          txHash: result.tx,
          providerData: {
            provider: "privacy-cash",
            isPartial: result.isPartial,
            fee: result.fee_in_lamports,
            complianceRecordId: solRecordId,
          },
        }
      }
    } catch (err) {
      onStatusChange?.("error")
      const message = err instanceof Error ? err.message : "Privacy Cash send failed"

      // Check for auth failure
      if (message.includes("authentication") || message.includes("canceled")) {
        return {
          success: false,
          error: "Biometric authentication required to send with Privacy Cash",
        }
      }

      return {
        success: false,
        error: message,
      }
    } finally {
      // CRITICAL: Clear secret key from memory
      if (secretKey) {
        clearSensitiveData(secretKey)
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SWAP OPERATION (Not supported by Privacy Cash)
  // ─────────────────────────────────────────────────────────────────────────

  async swap(
    _params: PrivacySwapParams,
    _signTransaction: (tx: Uint8Array) => Promise<Uint8Array | null>,
    onStatusChange?: (status: PrivacySwapStatus) => void
  ): Promise<PrivacySwapResult> {
    onStatusChange?.("error")
    return {
      success: false,
      error: "Privacy Cash does not support swaps. Use SIP Native for private swaps.",
      providerData: {
        provider: "privacy-cash",
        reason: "Privacy Cash focuses on private transfers, not DEX operations",
      },
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BALANCE QUERY
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get private balance in Privacy Cash pool
   * This is additional functionality not in the base adapter interface
   * NOTE: Requires biometric auth to access
   */
  async getPrivateBalance(): Promise<{ sol: number; usdc?: number; usdt?: number }> {
    if (!this.PrivacyCashClass) {
      return { sol: 0 }
    }

    let secretKey: Uint8Array | null = null

    try {
      const { client, secretKey: key } = await this.getClientWithKeypair()
      secretKey = key

      const solBalance = await client.getPrivateBalance()
      const usdcBalance = await client.getPrivateBalanceSpl(SUPPORTED_TOKENS.USDC.mint)
      const usdtBalance = await client.getPrivateBalanceSpl(SUPPORTED_TOKENS.USDT.mint)

      return {
        sol: solBalance.lamports / Math.pow(10, SOL_DECIMALS),
        usdc: usdcBalance.amount,
        usdt: usdtBalance.amount,
      }
    } catch (err) {
      debug("Failed to get private balance:", err)
      return { sol: 0 }
    } finally {
      // Clear secret key from memory
      if (secretKey) {
        clearSensitiveData(secretKey)
      }
    }
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createPrivacyCashAdapter(options: AdapterOptions): PrivacyCashAdapter {
  return new PrivacyCashAdapter(options)
}
