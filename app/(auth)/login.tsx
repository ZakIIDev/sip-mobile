/**
 * Login Screen
 *
 * Main authentication screen with multiple wallet connection options:
 * - Privy (Email, SMS, Apple, Google)
 * - MWA (Android native wallets)
 * - Phantom (iOS deeplinks)
 */

import { View, Text, TouchableOpacity, Platform } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { useWallet, getRecommendedProvider } from "@/hooks"
import { useState } from "react"

export default function LoginScreen() {
  const {
    connect,
    status,
    error,
    loginWithApple,
    loginWithGoogle,
    isPrivyAvailable,
    isMWAAvailable,
    isPhantomAvailable,
  } = useWallet()

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

  const handleAppleLogin = async () => {
    setIsConnecting(true)
    try {
      await loginWithApple()
      // Navigation happens via auth state change
    } finally {
      setIsConnecting(false)
    }
  }

  const handleGoogleLogin = async () => {
    setIsConnecting(true)
    try {
      await loginWithGoogle()
      // Navigation happens via auth state change
    } finally {
      setIsConnecting(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-dark-950">
      <View className="flex-1 px-6 pt-12">
        {/* Logo & Title */}
        <View className="items-center mb-12">
          <View className="w-20 h-20 bg-brand-600 rounded-2xl items-center justify-center mb-6">
            <Text className="text-4xl">🔒</Text>
          </View>
          <Text className="text-3xl font-bold text-white mb-2">
            SIP Privacy
          </Text>
          <Text className="text-dark-400 text-center">
            Private payments on Solana
          </Text>
        </View>

        {/* Wallet Connection Options */}
        <View className="gap-3 mb-8">
          {/* External Wallets Section */}
          <Text className="text-dark-500 text-sm font-medium mb-2">
            CONNECT WALLET
          </Text>

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
                <Text className="text-xl">📱</Text>
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
              <Text className="text-dark-600 text-2xl">→</Text>
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
                <Text className="text-xl">👻</Text>
              </View>
              <View className="ml-4 flex-1">
                <View className="flex-row items-center">
                  <Text className="text-white font-semibold">Phantom</Text>
                  {recommendedProvider === "phantom" && Platform.OS === "ios" && (
                    <View className="ml-2 px-2 py-0.5 bg-brand-600 rounded">
                      <Text className="text-xs text-white">Recommended</Text>
                    </View>
                  )}
                </View>
                <Text className="text-dark-500 text-sm">
                  Connect via Phantom app
                </Text>
              </View>
              <Text className="text-dark-600 text-2xl">→</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Divider */}
        <View className="flex-row items-center mb-8">
          <View className="flex-1 h-px bg-dark-800" />
          <Text className="text-dark-600 mx-4">or</Text>
          <View className="flex-1 h-px bg-dark-800" />
        </View>

        {/* Social & Email Options */}
        <View className="gap-3 mb-8">
          <Text className="text-dark-500 text-sm font-medium mb-2">
            CONTINUE WITH
          </Text>

          {/* Apple Sign In */}
          {Platform.OS === "ios" && isPrivyAvailable && (
            <TouchableOpacity
              className="flex-row items-center p-4 rounded-xl bg-white border border-dark-800"
              onPress={handleAppleLogin}
              disabled={isConnecting}
            >
              <View className="w-10 h-10 items-center justify-center">
                <Text className="text-2xl"></Text>
              </View>
              <Text className="ml-4 text-black font-semibold">
                Continue with Apple
              </Text>
            </TouchableOpacity>
          )}

          {/* Google Sign In */}
          {isPrivyAvailable && (
            <TouchableOpacity
              className="flex-row items-center p-4 rounded-xl bg-dark-900 border border-dark-800"
              onPress={handleGoogleLogin}
              disabled={isConnecting}
            >
              <View className="w-10 h-10 items-center justify-center">
                <Text className="text-2xl">G</Text>
              </View>
              <Text className="ml-4 text-white font-semibold">
                Continue with Google
              </Text>
            </TouchableOpacity>
          )}

          {/* Email */}
          <TouchableOpacity
            className="flex-row items-center p-4 rounded-xl bg-dark-900 border border-dark-800"
            onPress={() => router.push("/(auth)/email")}
            disabled={isConnecting}
          >
            <View className="w-10 h-10 bg-dark-800 rounded-xl items-center justify-center">
              <Text className="text-xl">✉️</Text>
            </View>
            <Text className="ml-4 text-white font-semibold">
              Continue with Email
            </Text>
          </TouchableOpacity>

          {/* Phone */}
          <TouchableOpacity
            className="flex-row items-center p-4 rounded-xl bg-dark-900 border border-dark-800"
            onPress={() => router.push("/(auth)/phone")}
            disabled={isConnecting}
          >
            <View className="w-10 h-10 bg-dark-800 rounded-xl items-center justify-center">
              <Text className="text-xl">📞</Text>
            </View>
            <Text className="ml-4 text-white font-semibold">
              Continue with Phone
            </Text>
          </TouchableOpacity>
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

        {/* Terms */}
        <View className="mt-auto pb-8">
          <Text className="text-dark-600 text-center text-sm">
            By continuing, you agree to our{" "}
            <Text className="text-brand-400">Terms of Service</Text> and{" "}
            <Text className="text-brand-400">Privacy Policy</Text>
          </Text>
        </View>
      </View>
    </SafeAreaView>
  )
}
