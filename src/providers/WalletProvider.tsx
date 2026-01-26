/**
 * Wallet Provider
 *
 * Initializes the native wallet on app start.
 * The app uses native wallet management (useNativeWallet) as the primary method.
 *
 * Note: Privy was removed in #71.
 * External wallets (MWA, Phantom) use hooks directly without a provider wrapper.
 */

import { ReactNode } from "react"
import { useNativeWallet } from "@/hooks"

interface WalletProviderProps {
  children: ReactNode
}

/**
 * WalletProvider
 *
 * Initializes the native wallet by calling useNativeWallet() on mount.
 * This triggers the hook's initialization logic which:
 * 1. Checks if a wallet exists in SecureStore
 * 2. Loads the public key
 * 3. Connects to the main wallet store
 */
export function WalletProvider({ children }: WalletProviderProps) {
  // Initialize native wallet on app start
  // This loads existing wallet from SecureStore and connects to wallet store
  useNativeWallet()

  return <>{children}</>
}
