/**
 * Wallet Setup Screen
 *
 * Entry point for native wallet setup:
 * - Create new wallet
 * - Import existing wallet
 * - (Optional) Connect external wallet
 */

import { View, Text, TouchableOpacity } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router, Href } from "expo-router"
import { useNativeWallet } from "@/hooks"
import { useEffect } from "react"
import type { Icon as PhosphorIcon } from "phosphor-react-native"
import {
  Sparkle,
  DownloadSimple,
  Link,
  LockKey,
} from "phosphor-react-native"
import { ICON_COLORS } from "@/constants/icons"

interface SetupOption {
  id: string
  icon: PhosphorIcon
  title: string
  description: string
  route: Href
  primary?: boolean
}

const SETUP_OPTIONS: SetupOption[] = [
  {
    id: "create",
    icon: Sparkle,
    title: "Create New Wallet",
    description: "Generate a new wallet with a secure seed phrase",
    route: "/create-wallet",
    primary: true,
  },
  {
    id: "import",
    icon: DownloadSimple,
    title: "Import Existing Wallet",
    description: "Restore from seed phrase or private key",
    route: "/import-wallet",
  },
]

export default function WalletSetupScreen() {
  const { wallet, isInitialized } = useNativeWallet()

  // Redirect to home if wallet already exists
  useEffect(() => {
    if (isInitialized && wallet) {
      router.replace("/(tabs)")
    }
  }, [isInitialized, wallet])

  const handleOptionPress = (option: SetupOption) => {
    router.push(option.route)
  }

  const handleConnectExternal = () => {
    // Navigate to external wallet connection (optional)
    router.push("/(auth)/login")
  }

  return (
    <SafeAreaView testID="welcome-screen" className="flex-1 bg-dark-950">
      {/* Header */}
      <View className="px-6 pt-8 pb-4">
        <Text className="text-3xl font-bold text-white mb-2">
          Welcome to SIP Privacy
        </Text>
        <Text className="text-lg text-dark-400">
          Set up your privacy wallet to get started
        </Text>
      </View>

      {/* Options */}
      <View className="flex-1 px-6 pt-4">
        {SETUP_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.id}
            testID={option.id === "create" ? "create-wallet-button" : "import-wallet-button"}
            onPress={() => handleOptionPress(option)}
            className={`mb-4 p-5 rounded-2xl border ${
              option.primary
                ? "bg-brand-600/10 border-brand-600"
                : "bg-dark-900 border-dark-800"
            }`}
            activeOpacity={0.7}
          >
            <View className="flex-row items-center mb-3">
              <View
                className={`w-12 h-12 rounded-xl items-center justify-center mr-4 ${
                  option.primary ? "bg-brand-600/20" : "bg-dark-800"
                }`}
              >
                <option.icon size={28} color={option.primary ? ICON_COLORS.brand : ICON_COLORS.muted} weight="fill" />
              </View>
              <View className="flex-1">
                <Text className="text-lg font-semibold text-white">
                  {option.title}
                </Text>
                {option.primary && (
                  <View className="bg-brand-600 px-2 py-0.5 rounded self-start mt-1">
                    <Text className="text-xs text-white font-medium">
                      Recommended
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <Text className="text-dark-400 leading-5">{option.description}</Text>
          </TouchableOpacity>
        ))}

        {/* Divider */}
        <View className="flex-row items-center my-6">
          <View className="flex-1 h-px bg-dark-800" />
          <Text className="px-4 text-dark-600 text-sm">or</Text>
          <View className="flex-1 h-px bg-dark-800" />
        </View>

        {/* External Wallet Option */}
        <TouchableOpacity
          onPress={handleConnectExternal}
          className="p-4 rounded-xl border border-dark-800 bg-dark-900/50"
          activeOpacity={0.7}
        >
          <View className="flex-row items-center justify-center">
            <Link size={18} color={ICON_COLORS.inactive} weight="bold" />
            <Text className="text-dark-400 ml-2">Connect External Wallet</Text>
          </View>
        </TouchableOpacity>

        <Text className="text-dark-600 text-xs text-center mt-3">
          Phantom, Solflare, or other Solana wallets
        </Text>
      </View>

      {/* Security Notice */}
      <View className="px-6 pb-8">
        <View className="bg-dark-900 rounded-xl p-4 border border-dark-800">
          <View className="flex-row items-start">
            <LockKey size={24} color={ICON_COLORS.brand} weight="fill" />
            <View className="flex-1 ml-3">
              <Text className="text-white font-medium mb-1">
                Your keys, your crypto
              </Text>
              <Text className="text-dark-400 text-sm leading-5">
                SIP Privacy stores your keys locally with biometric protection.
                We never have access to your funds.
              </Text>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  )
}
