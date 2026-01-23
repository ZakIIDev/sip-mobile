/**
 * Viewing Keys Screen Layout
 */

import { Stack } from "expo-router"

export default function ViewingKeysLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    />
  )
}
