/**
 * Phantom Deeplink hook for iOS
 *
 * Connects to Phantom wallet on iOS using deeplinks.
 * Also works on Android as a fallback.
 *
 * Implements proper NaCl encryption as per Phantom's deeplink protocol:
 * https://docs.phantom.app/developer-guides/deeplinks
 */

import { useState, useCallback, useEffect, useRef } from "react"
import { Linking } from "react-native"
import * as WebBrowser from "expo-web-browser"
import * as Crypto from "expo-crypto"
import { PublicKey } from "@solana/web3.js"
import bs58 from "bs58"
import nacl from "tweetnacl"
import type {
  WalletAccount,
  WalletConnectionStatus,
  WalletError,
} from "@/types"
import { useSettingsStore } from "@/stores/settings"

// Phantom deeplink URLs
const PHANTOM_CONNECT_URL = "https://phantom.app/ul/v1/connect"
const PHANTOM_DISCONNECT_URL = "https://phantom.app/ul/v1/disconnect"
const PHANTOM_SIGN_MESSAGE_URL = "https://phantom.app/ul/v1/signMessage"
const PHANTOM_SIGN_TX_URL = "https://phantom.app/ul/v1/signTransaction"
const PHANTOM_SIGN_SEND_TX_URL = "https://phantom.app/ul/v1/signAndSendTransaction"

// App redirect URL (must match app.json scheme)
const APP_SCHEME = "sipprotocol"
const REDIRECT_URL = `${APP_SCHEME}://phantom-callback`

interface UsePhantomDeeplinkReturn {
  // State
  account: WalletAccount | null
  status: WalletConnectionStatus
  error: WalletError | null
  isAvailable: boolean

  // Actions
  connect: () => Promise<WalletAccount | null>
  disconnect: () => Promise<void>
  signMessage: (message: Uint8Array) => Promise<Uint8Array | null>
  signTransaction: (serializedTx: Uint8Array) => Promise<Uint8Array | null>
  signAndSendTransaction: (serializedTx: Uint8Array) => Promise<string | null>
}

// Persistent keypair for the dApp (generated per session)
interface DappKeyPair {
  publicKey: Uint8Array
  secretKey: Uint8Array
}

interface PhantomSession {
  session: string
  sharedSecret: Uint8Array
  phantomPublicKey: Uint8Array
}

/**
 * Generate a random nonce for NaCl encryption (24 bytes)
 */
async function generateNonce(): Promise<Uint8Array> {
  const randomBytes = await Crypto.getRandomBytesAsync(24)
  return new Uint8Array(randomBytes)
}

/**
 * Generate X25519 keypair for the dApp
 */
function generateDappKeyPair(): DappKeyPair {
  const keyPair = nacl.box.keyPair()
  return {
    publicKey: keyPair.publicKey,
    secretKey: keyPair.secretKey,
  }
}

/**
 * Derive shared secret from Phantom's public key and dApp's secret key
 */
function deriveSharedSecret(
  phantomPublicKey: Uint8Array,
  dappSecretKey: Uint8Array
): Uint8Array {
  return nacl.box.before(phantomPublicKey, dappSecretKey)
}

/**
 * Encrypt a payload using NaCl secretbox (with pre-computed shared secret)
 */
function encryptPayload(
  payload: object,
  sharedSecret: Uint8Array,
  nonce: Uint8Array
): Uint8Array {
  const message = new TextEncoder().encode(JSON.stringify(payload))
  return nacl.box.after(message, nonce, sharedSecret)
}

/**
 * Decrypt a payload using NaCl secretbox (with pre-computed shared secret)
 */
function decryptPayload(
  encryptedData: Uint8Array,
  nonce: Uint8Array,
  sharedSecret: Uint8Array
): object | null {
  const decrypted = nacl.box.open.after(encryptedData, nonce, sharedSecret)
  if (!decrypted) {
    return null
  }
  const decoded = new TextDecoder().decode(decrypted)
  return JSON.parse(decoded)
}

/**
 * Build Phantom deeplink URL
 */
function buildPhantomUrl(
  baseUrl: string,
  params: Record<string, string>
): string {
  const url = new URL(baseUrl)
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value)
  })
  return url.toString()
}

/**
 * Parse Phantom callback URL
 */
function parseCallbackUrl(url: string): Record<string, string> {
  const parsed = new URL(url)
  const params: Record<string, string> = {}
  parsed.searchParams.forEach((value, key) => {
    params[key] = value
  })
  return params
}

export function usePhantomDeeplink(): UsePhantomDeeplinkReturn {
  const [account, setAccount] = useState<WalletAccount | null>(null)
  const [status, setStatus] = useState<WalletConnectionStatus>("disconnected")
  const [error, setError] = useState<WalletError | null>(null)
  const [isAvailable, setIsAvailable] = useState(false)

  // Get network from settings
  const network = useSettingsStore((state) => state.network)

  // Encryption state - persisted for session duration
  const dappKeyPair = useRef<DappKeyPair | null>(null)
  const phantomSession = useRef<PhantomSession | null>(null)

  // Pending promise resolver for deeplink callbacks
  const pendingResolve = useRef<((params: Record<string, string>) => void) | null>(null)
  const pendingReject = useRef<((error: Error) => void) | null>(null)

  // Initialize dApp keypair on first render
  useEffect(() => {
    if (!dappKeyPair.current) {
      dappKeyPair.current = generateDappKeyPair()
    }
  }, [])

  // Check if Phantom is installed
  useEffect(() => {
    const checkPhantom = async () => {
      try {
        const canOpen = await Linking.canOpenURL("phantom://")
        setIsAvailable(canOpen)
      } catch {
        setIsAvailable(false)
      }
    }
    checkPhantom()
  }, [])

  // Handle deeplink callbacks
  useEffect(() => {
    const handleUrl = ({ url }: { url: string }) => {
      if (!url.startsWith(REDIRECT_URL)) return

      try {
        const params = parseCallbackUrl(url)

        // Check for errors
        if (params.errorCode) {
          const error = new Error(params.errorMessage || "Phantom error")
          pendingReject.current?.(error)
          return
        }

        pendingResolve.current?.(params)
      } catch (err) {
        pendingReject.current?.(err instanceof Error ? err : new Error("Parse error"))
      }
    }

    const subscription = Linking.addEventListener("url", handleUrl)

    // Check for initial URL (app opened via deeplink)
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl({ url })
    })

    return () => subscription.remove()
  }, [])

  /**
   * Wait for Phantom callback via deeplink
   */
  const waitForCallback = (): Promise<Record<string, string>> => {
    return new Promise((resolve, reject) => {
      pendingResolve.current = resolve
      pendingReject.current = reject

      // Timeout after 2 minutes
      setTimeout(() => {
        pendingResolve.current = null
        pendingReject.current = null
        reject(new Error("Phantom connection timeout"))
      }, 120000)
    })
  }

  const connect = useCallback(async (): Promise<WalletAccount | null> => {
    if (!isAvailable) {
      setError({
        type: "not_installed",
        message: "Phantom wallet is not installed",
      })
      return null
    }

    if (!dappKeyPair.current) {
      dappKeyPair.current = generateDappKeyPair()
    }

    setStatus("connecting")
    setError(null)

    try {
      // Get the dApp's public key in base58 format
      const dappPublicKeyBase58 = bs58.encode(dappKeyPair.current.publicKey)

      // Build connect URL with real encryption public key
      const connectUrl = buildPhantomUrl(PHANTOM_CONNECT_URL, {
        app_url: "https://sip-protocol.org",
        dapp_encryption_public_key: dappPublicKeyBase58,
        redirect_link: REDIRECT_URL,
        cluster: network === "mainnet" ? "mainnet-beta" : "devnet",
      })

      // Open Phantom
      await WebBrowser.openBrowserAsync(connectUrl, {
        dismissButtonStyle: "close",
        readerMode: false,
        enableBarCollapsing: false,
      })

      // Wait for callback
      const params = await waitForCallback()

      // Phantom returns encrypted data in the connect response
      if (!params.phantom_encryption_public_key || !params.data || !params.nonce) {
        throw new Error("Invalid response from Phantom - missing encryption data")
      }

      // Decode Phantom's public key
      const phantomPublicKey = bs58.decode(params.phantom_encryption_public_key)

      // Derive shared secret for this session
      const sharedSecret = deriveSharedSecret(
        phantomPublicKey,
        dappKeyPair.current.secretKey
      )

      // Decode the encrypted data and nonce
      const encryptedData = bs58.decode(params.data)
      const nonce = bs58.decode(params.nonce)

      // Decrypt the response
      const decryptedData = decryptPayload(encryptedData, nonce, sharedSecret)
      if (!decryptedData) {
        throw new Error("Failed to decrypt Phantom response")
      }

      // Extract session and public key from decrypted data
      const {
        session,
        public_key: publicKeyBase58,
      } = decryptedData as { session: string; public_key: string }

      // Validate the public key
      const publicKey = new PublicKey(publicKeyBase58)

      // Store session info for future requests
      phantomSession.current = {
        session,
        sharedSecret,
        phantomPublicKey,
      }

      const walletAccount: WalletAccount = {
        address: publicKey.toBase58(),
        publicKey: publicKey.toBytes(),
        label: "Phantom",
        providerType: "phantom",
      }

      setAccount(walletAccount)
      setStatus("connected")
      return walletAccount
    } catch (err) {
      const walletError: WalletError = {
        type: "connection_failed",
        message: err instanceof Error ? err.message : "Failed to connect",
        originalError: err,
      }

      if (err instanceof Error) {
        if (err.message.includes("rejected") || err.message.includes("cancelled")) {
          walletError.type = "user_rejected"
          walletError.message = "Connection rejected by user"
        } else if (err.message.includes("timeout")) {
          walletError.type = "timeout"
          walletError.message = "Connection timed out"
        }
      }

      setError(walletError)
      setStatus("error")
      return null
    }
  }, [isAvailable, network])

  const disconnect = useCallback(async (): Promise<void> => {
    if (!isAvailable || !phantomSession.current || !dappKeyPair.current) {
      setAccount(null)
      phantomSession.current = null
      setStatus("disconnected")
      return
    }

    try {
      // Generate nonce for encryption
      const nonce = await generateNonce()

      // Encrypt the payload
      const payload = { session: phantomSession.current.session }
      const encryptedPayload = encryptPayload(
        payload,
        phantomSession.current.sharedSecret,
        nonce
      )

      const disconnectUrl = buildPhantomUrl(PHANTOM_DISCONNECT_URL, {
        redirect_link: REDIRECT_URL,
        dapp_encryption_public_key: bs58.encode(dappKeyPair.current.publicKey),
        nonce: bs58.encode(nonce),
        payload: bs58.encode(encryptedPayload),
      })

      await WebBrowser.openBrowserAsync(disconnectUrl)
    } catch (err) {
      console.warn("Phantom disconnect failed:", err)
    } finally {
      setAccount(null)
      phantomSession.current = null
      setStatus("disconnected")
      setError(null)
    }
  }, [isAvailable])

  const signMessage = useCallback(
    async (message: Uint8Array): Promise<Uint8Array | null> => {
      if (!isAvailable || !phantomSession.current || !account || !dappKeyPair.current) {
        setError({
          type: "signing_failed",
          message: "Wallet not connected",
        })
        return null
      }

      try {
        // Generate nonce for encryption
        const nonce = await generateNonce()

        // Encrypt the signing payload
        const payload = {
          session: phantomSession.current.session,
          message: bs58.encode(message),
        }
        const encryptedPayload = encryptPayload(
          payload,
          phantomSession.current.sharedSecret,
          nonce
        )

        const signUrl = buildPhantomUrl(PHANTOM_SIGN_MESSAGE_URL, {
          redirect_link: REDIRECT_URL,
          dapp_encryption_public_key: bs58.encode(dappKeyPair.current.publicKey),
          nonce: bs58.encode(nonce),
          payload: bs58.encode(encryptedPayload),
        })

        await WebBrowser.openBrowserAsync(signUrl)

        const params = await waitForCallback()

        if (!params.data || !params.nonce) {
          throw new Error("Invalid response from Phantom")
        }

        // Decrypt the response
        const encryptedData = bs58.decode(params.data)
        const responseNonce = bs58.decode(params.nonce)
        const decryptedData = decryptPayload(
          encryptedData,
          responseNonce,
          phantomSession.current.sharedSecret
        )

        if (!decryptedData) {
          throw new Error("Failed to decrypt signature response")
        }

        const { signature } = decryptedData as { signature: string }
        return bs58.decode(signature)
      } catch (err) {
        const walletError: WalletError = {
          type: "signing_failed",
          message: err instanceof Error ? err.message : "Failed to sign",
          originalError: err,
        }

        if (err instanceof Error && err.message.includes("rejected")) {
          walletError.type = "user_rejected"
        }

        setError(walletError)
        return null
      }
    },
    [isAvailable, account]
  )

  const signTransaction = useCallback(
    async (serializedTx: Uint8Array): Promise<Uint8Array | null> => {
      if (!isAvailable || !phantomSession.current || !account || !dappKeyPair.current) {
        setError({
          type: "signing_failed",
          message: "Wallet not connected",
        })
        return null
      }

      try {
        // Generate nonce for encryption
        const nonce = await generateNonce()

        // Encrypt the transaction payload
        const payload = {
          session: phantomSession.current.session,
          transaction: bs58.encode(serializedTx),
        }
        const encryptedPayload = encryptPayload(
          payload,
          phantomSession.current.sharedSecret,
          nonce
        )

        const signUrl = buildPhantomUrl(PHANTOM_SIGN_TX_URL, {
          redirect_link: REDIRECT_URL,
          dapp_encryption_public_key: bs58.encode(dappKeyPair.current.publicKey),
          nonce: bs58.encode(nonce),
          payload: bs58.encode(encryptedPayload),
        })

        await WebBrowser.openBrowserAsync(signUrl)

        const params = await waitForCallback()

        if (!params.data || !params.nonce) {
          throw new Error("Invalid response from Phantom")
        }

        // Decrypt the response
        const encryptedData = bs58.decode(params.data)
        const responseNonce = bs58.decode(params.nonce)
        const decryptedData = decryptPayload(
          encryptedData,
          responseNonce,
          phantomSession.current.sharedSecret
        )

        if (!decryptedData) {
          throw new Error("Failed to decrypt transaction response")
        }

        const { transaction } = decryptedData as { transaction: string }
        return bs58.decode(transaction)
      } catch (err) {
        const walletError: WalletError = {
          type: "signing_failed",
          message: err instanceof Error ? err.message : "Failed to sign",
          originalError: err,
        }

        if (err instanceof Error && err.message.includes("rejected")) {
          walletError.type = "user_rejected"
        }

        setError(walletError)
        return null
      }
    },
    [isAvailable, account]
  )

  const signAndSendTransaction = useCallback(
    async (serializedTx: Uint8Array): Promise<string | null> => {
      if (!isAvailable || !phantomSession.current || !account || !dappKeyPair.current) {
        setError({
          type: "signing_failed",
          message: "Wallet not connected",
        })
        return null
      }

      try {
        // Generate nonce for encryption
        const nonce = await generateNonce()

        // Encrypt the transaction payload
        const payload = {
          session: phantomSession.current.session,
          transaction: bs58.encode(serializedTx),
        }
        const encryptedPayload = encryptPayload(
          payload,
          phantomSession.current.sharedSecret,
          nonce
        )

        const signUrl = buildPhantomUrl(PHANTOM_SIGN_SEND_TX_URL, {
          redirect_link: REDIRECT_URL,
          dapp_encryption_public_key: bs58.encode(dappKeyPair.current.publicKey),
          nonce: bs58.encode(nonce),
          payload: bs58.encode(encryptedPayload),
        })

        await WebBrowser.openBrowserAsync(signUrl)

        const params = await waitForCallback()

        if (!params.data || !params.nonce) {
          throw new Error("Invalid response from Phantom")
        }

        // Decrypt the response
        const encryptedData = bs58.decode(params.data)
        const responseNonce = bs58.decode(params.nonce)
        const decryptedData = decryptPayload(
          encryptedData,
          responseNonce,
          phantomSession.current.sharedSecret
        )

        if (!decryptedData) {
          throw new Error("Failed to decrypt transaction response")
        }

        const { signature } = decryptedData as { signature: string }
        return signature
      } catch (err) {
        const walletError: WalletError = {
          type: "signing_failed",
          message: err instanceof Error ? err.message : "Failed to send",
          originalError: err,
        }

        if (err instanceof Error && err.message.includes("rejected")) {
          walletError.type = "user_rejected"
        }

        setError(walletError)
        return null
      }
    },
    [isAvailable, account]
  )

  return {
    account,
    status,
    error,
    isAvailable,
    connect,
    disconnect,
    signMessage,
    signTransaction,
    signAndSendTransaction,
  }
}
