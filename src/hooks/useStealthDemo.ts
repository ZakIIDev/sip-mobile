/**
 * Stealth Demo Hook
 *
 * Demo-only stealth address generation for onboarding.
 * Uses real cryptography but keys are never stored or used.
 * Pre-generates on mount for instant display.
 */

import { useState, useEffect, useCallback, useMemo } from "react"
import { generateStealthMetaAddress, formatStealthMetaAddress } from "@/lib/stealth"
import type { StealthMetaAddress } from "@/lib/stealth"

// ============================================================================
// TYPES
// ============================================================================

export interface DemoStealthAddress {
  /** Full formatted SIP address (sip:solana:...) */
  formatted: string
  /** Spending key (base58 for Solana) */
  spendingKey: string
  /** Viewing key (base58 for Solana) */
  viewingKey: string
  /** Raw meta address for internal use */
  metaAddress: StealthMetaAddress
}

export interface UseStealthDemoReturn {
  /** Current demo address (null while generating) */
  address: DemoStealthAddress | null
  /** Whether currently generating */
  isGenerating: boolean
  /** Generate a new demo address */
  generate: () => Promise<void>
  /** Error message if generation failed */
  error: string | null
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook for demo stealth address generation
 *
 * - Pre-generates on mount (~50-200ms)
 * - Caches result for instant re-display
 * - Keys are NEVER saved or used for real transactions
 */
export function useStealthDemo(): UseStealthDemoReturn {
  const [address, setAddress] = useState<DemoStealthAddress | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = useCallback(async () => {
    setIsGenerating(true)
    setError(null)

    try {
      const result = await generateStealthMetaAddress("solana", "Demo Address")

      // Format the address for display
      const formatted = formatStealthMetaAddress(result.metaAddress)

      // Extract base58 keys from formatted address
      // Format: sip:solana:spendingKey:viewingKey
      const parts = formatted.split(":")
      const spendingKey = parts[2] || ""
      const viewingKey = parts[3] || ""

      setAddress({
        formatted,
        spendingKey,
        viewingKey,
        metaAddress: result.metaAddress,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate address"
      setError(message)
    } finally {
      setIsGenerating(false)
    }
  }, [])

  // Pre-generate on mount
  useEffect(() => {
    generate()
  }, [generate])

  return useMemo(
    () => ({
      address,
      isGenerating,
      generate,
      error,
    }),
    [address, isGenerating, generate, error]
  )
}
