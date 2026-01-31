/**
 * BlockchainVisualizer Component
 *
 * Shows what the blockchain "sees" based on privacy toggle state.
 * Hidden fields show as redacted blocks, revealed fields show actual data.
 */

import { View, Text } from "react-native"
import { useMemo } from "react"
import Animated, {
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated"
import { usePrefersReducedMotion } from "@/hooks"

// ============================================================================
// TYPES
// ============================================================================

export interface BlockchainVisualizerProps {
  /** Whether privacy is enabled */
  isPrivate: boolean
  /** From address to show when not private */
  fromAddress?: string
  /** To address to show when not private */
  toAddress?: string
  /** Amount to show when not private */
  amount?: string
}

// ============================================================================
// CONSTANTS
// ============================================================================

const REDACTED_BLOCKS = "\u2588".repeat(12) // Unicode full block character

// ============================================================================
// COMPONENT
// ============================================================================

export function BlockchainVisualizer({
  isPrivate,
  fromAddress = "7xKp3...9mR2",
  toAddress = "9mRv2...4kTp",
  amount = "150 SOL",
}: BlockchainVisualizerProps) {
  const shouldReduceMotion = usePrefersReducedMotion()

  const fields = useMemo(
    () => [
      { label: "From", value: fromAddress },
      { label: "To", value: toAddress },
      { label: "Amount", value: amount },
    ],
    [fromAddress, toAddress, amount]
  )

  return (
    <View
      className="bg-dark-900 rounded-xl border border-dark-800 overflow-hidden"
      accessibilityLabel={`Blockchain view showing ${isPrivate ? "hidden" : "visible"} transaction data`}
    >
      {/* Header */}
      <View className="px-4 py-2 border-b border-dark-800 bg-dark-850">
        <Text className="text-dark-400 text-xs font-medium uppercase tracking-wider">
          What the blockchain sees
        </Text>
      </View>

      {/* Fields */}
      <View className="p-4 gap-3">
        {fields.map((field) => (
          <VisualizerField
            key={field.label}
            label={field.label}
            value={field.value}
            isPrivate={isPrivate}
            shouldReduceMotion={shouldReduceMotion}
          />
        ))}
      </View>
    </View>
  )
}

// ============================================================================
// HELPER COMPONENT
// ============================================================================

function VisualizerField({
  label,
  value,
  isPrivate,
  shouldReduceMotion,
}: {
  label: string
  value: string
  isPrivate: boolean
  shouldReduceMotion: boolean
}) {
  // Animated style for the value transition
  const animatedStyle = useAnimatedStyle(() => {
    if (shouldReduceMotion) {
      return { opacity: 1 }
    }

    return {
      opacity: withTiming(1, {
        duration: 200,
        easing: Easing.out(Easing.ease),
      }),
    }
  })

  const displayValue = isPrivate ? REDACTED_BLOCKS : value
  const textColor = isPrivate ? "text-brand-400" : "text-white"
  const bgColor = isPrivate ? "bg-brand-900/20" : "bg-dark-800"

  return (
    <Animated.View
      className="flex-row items-center"
      style={animatedStyle}
      accessibilityLabel={`${label}: ${isPrivate ? "hidden" : value}`}
    >
      <Text className="text-dark-500 w-16 text-sm">{label}:</Text>
      <View className={`flex-1 px-3 py-2 rounded-lg ${bgColor}`}>
        <Text className={`font-mono text-sm ${textColor}`}>{displayValue}</Text>
      </View>
    </Animated.View>
  )
}
