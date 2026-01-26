import { Stack } from "expo-router"
import { View } from "react-native"

export default function AuthLayout() {
  return (
    <View className="flex-1 bg-dark-950">
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#0a0a0a" },
          animation: "slide_from_right",
        }}
      >
        {/* Native Wallet Screens (PRIMARY) */}
        <Stack.Screen name="wallet-setup" />
        <Stack.Screen name="create-wallet" />
        <Stack.Screen name="import-wallet" />
        {/* External Wallet Screens (OPTIONAL) */}
        <Stack.Screen name="login" />
        <Stack.Screen name="email" />
        <Stack.Screen name="phone" />
        <Stack.Screen name="onboarding" />
      </Stack>
    </View>
  )
}
