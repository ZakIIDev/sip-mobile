/**
 * Custom hooks for SIP Mobile
 */

// Native Wallet (PRIMARY)
export { useNativeWallet } from "./useNativeWallet"
export type {
  NativeWallet,
  NativeWalletError,
  UseNativeWalletReturn,
} from "./useNativeWallet"

// Seed Vault (PRIMARY - Seeker/Saga devices)
export { useSeedVault } from "./useSeedVault"
export type { SeedVaultWallet, UseSeedVaultReturn } from "./useSeedVault"

// External Wallet Integration (OPTIONAL)
export { useMWA } from "./useMWA"
export { usePhantomDeeplink } from "./usePhantomDeeplink"
export { useWallet, getRecommendedProvider, getAvailableProviders } from "./useWallet"
export { useBalance } from "./useBalance"
export type { UseBalanceReturn } from "./useBalance"

// Privacy hooks
export { useStealth } from "./useStealth"
export type { StealthKeys, StealthAddress, UseStealthReturn } from "./useStealth"
export { useSend } from "./useSend"
export type { SendParams, SendResult, SendStatus, AddressValidation, UseSendReturn } from "./useSend"
export { useScanPayments } from "./useScanPayments"
export type { ScanResult, ScanProgress, ScanOptions, UseScanPaymentsReturn } from "./useScanPayments"
export { useClaim } from "./useClaim"
export type { ClaimResult, ClaimStatus, ClaimProgress, UseClaimReturn } from "./useClaim"
export { useViewingKeys } from "./useViewingKeys"
export type {
  UseViewingKeysReturn,
  ExportOptions,
  DisclosureInput,
  ImportKeyInput,
} from "./useViewingKeys"
export { useBiometrics } from "./useBiometrics"
export type {
  BiometricCapabilities,
  AuthResult,
  UseBiometricsReturn,
} from "./useBiometrics"

// DEX hooks
export { useQuote, useExchangeRate, useInsufficientBalance } from "./useQuote"
export type {
  QuoteParams,
  QuoteFreshness,
  QuoteResult,
  JupiterQuoteResponse,
} from "./useQuote"

export {
  useSwap,
  getSwapStatusMessage,
  isSwapComplete,
  isSwapInProgress,
} from "./useSwap"
export type { SwapStatus, SwapParams, SwapResult } from "./useSwap"

// Compliance hooks
export { useCompliance } from "./useCompliance"
export type { ComplianceStats, UseComplianceReturn } from "./useCompliance"

// Accessibility hooks
export {
  useAccessibility,
  usePrefersReducedMotion,
  useScreenReader,
} from "./useAccessibility"
export type {
  AccessibilitySettings,
  UseAccessibilityReturn,
} from "./useAccessibility"
