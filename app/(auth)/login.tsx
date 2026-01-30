/**
 * External Wallet Connection Screen
 *
 * Optional screen for connecting external wallets (MWA, Phantom).
 * This is for users who want to use their existing wallet instead of
 * the native SIP Privacy wallet.
 *
 * Note: The primary wallet flow uses wallet-setup.tsx for native wallet creation.
 * This screen is accessed via "Connect External Wallet" from wallet-setup.
 */

import { View, Text, TouchableOpacity, Platform } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { useWallet, getRecommendedProvider } from "@/hooks"
import { useState } from "react"
import {
  ArrowLeft,
  DeviceMobile,
  Ghost,
  CaretRight,
  Lightbulb,
} from "phosphor-react-native"
import { ICON_COLORS } from "@/constants/icons"

export default function LoginScreen() {
  const { connect, status, error, isMWAAvailable, isPhantomAvailable } =
    useWallet()

  const [isConnecting, setIsConnecting] = useState(false)
  const recommendedProvider = getRecommendedProvider()

  const handleMWAConnect = async () => {
    setIsConnecting(true)
    try {
      const account = await connect("mwa")
      if (account) {
        router.replace("/(tabs)")
      }
    } finally {
      setIsConnecting(false)
    }
  }

  const handlePhantomConnect = async () => {
    setIsConnecting(true)
    try {
      const account = await connect("phantom")
      if (account) {
        router.replace("/(tabs)")
      }
    } finally {
      setIsConnecting(false)
    }
  }

  const handleBack = () => {
    router.back()
  }

  return (
    <SafeAreaView className="flex-1 bg-dark-950">
      <View className="flex-1 px-6 pt-4">
        {/* Header */}
        <TouchableOpacity onPress={handleBack} className="mb-4 flex-row items-center">
          <ArrowLeft size={20} color={ICON_COLORS.brand} weight="bold" />
          <Text className="text-brand-500 ml-1">Back</Text>
        </TouchableOpacity>

        <Text className="text-2xl font-bold text-white mb-2">
          Connect External Wallet
        </Text>
        <Text className="text-dark-400 mb-8">
          Connect your existing Solana wallet to use with SIP Privacy.
        </Text>

        {/* Wallet Connection Options */}
        <View className="gap-3 mb-8">
          {/* MWA - Android only */}
          {Platform.OS === "android" && isMWAAvailable && (
            <TouchableOpacity
              className={`flex-row items-center p-4 rounded-xl border ${
                recommendedProvider === "mwa"
                  ? "bg-brand-900/20 border-brand-700"
                  : "bg-dark-900 border-dark-800"
              }`}
              onPress={handleMWAConnect}
              disabled={isConnecting}
            >
              <View className="w-10 h-10 bg-purple-600 rounded-xl items-center justify-center">
                <DeviceMobile size={24} color={ICON_COLORS.white} weight="fill" />
              </View>
              <View className="ml-4 flex-1">
                <View className="flex-row items-center">
                  <Text className="text-white font-semibold">
                    Mobile Wallet
                  </Text>
                  {recommendedProvider === "mwa" && (
                    <View className="ml-2 px-2 py-0.5 bg-brand-600 rounded">
                      <Text className="text-xs text-white">Recommended</Text>
                    </View>
                  )}
                </View>
                <Text className="text-dark-500 text-sm">
                  Phantom, Solflare, Backpack
                </Text>
              </View>
              <CaretRight size={24} color={ICON_COLORS.inactive} weight="bold" />
            </TouchableOpacity>
          )}

          {/* Phantom Deeplinks - Both platforms */}
          {isPhantomAvailable && (
            <TouchableOpacity
              className={`flex-row items-center p-4 rounded-xl border ${
                recommendedProvider === "phantom" && Platform.OS === "ios"
                  ? "bg-brand-900/20 border-brand-700"
                  : "bg-dark-900 border-dark-800"
              }`}
              onPress={handlePhantomConnect}
              disabled={isConnecting}
            >
              <View className="w-10 h-10 bg-purple-500 rounded-xl items-center justify-center">
                <Ghost size={24} color={ICON_COLORS.white} weight="fill" />
              </View>
              <View className="ml-4 flex-1">
                <View className="flex-row items-center">
                  <Text className="text-white font-semibold">Phantom</Text>
                  {recommendedProvider === "phantom" &&
                    Platform.OS === "ios" && (
                      <View className="ml-2 px-2 py-0.5 bg-brand-600 rounded">
                        <Text className="text-xs text-white">Recommended</Text>
                      </View>
                    )}
                </View>
                <Text className="text-dark-500 text-sm">
                  Connect via Phantom app
                </Text>
              </View>
              <CaretRight size={24} color={ICON_COLORS.inactive} weight="bold" />
            </TouchableOpacity>
          )}

          {/* No wallets available */}
          {!isMWAAvailable && !isPhantomAvailable && (
            <View className="p-4 rounded-xl bg-dark-900 border border-dark-800">
              <Text className="text-dark-400 text-center">
                No external wallets available on this device.
              </Text>
              <Text className="text-dark-500 text-sm text-center mt-2">
                Install Phantom to connect an external wallet.
              </Text>
            </View>
          )}
        </View>

        {/* Error Display */}
        {error && (
          <View className="p-4 bg-red-900/20 border border-red-700 rounded-xl mb-4">
            <Text className="text-red-400">{error.message}</Text>
          </View>
        )}

        {/* Loading State */}
        {(status === "connecting" || isConnecting) && (
          <View className="items-center py-4">
            <Text className="text-dark-400">Connecting...</Text>
          </View>
        )}

        {/* Info */}
        <View className="mt-auto pb-8">
          <View className="bg-dark-900 rounded-xl p-4 border border-dark-800">
            <View className="flex-row items-start">
              <Lightbulb size={24} color={ICON_COLORS.warning} weight="fill" />
              <View className="flex-1 ml-3">
                <Text className="text-white font-medium mb-1">
                  Why connect an external wallet?
                </Text>
                <Text className="text-dark-400 text-sm leading-5">
                  If you already have a Solana wallet with funds, you can use it
                  with SIP Privacy instead of creating a new native wallet.
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  )
}
