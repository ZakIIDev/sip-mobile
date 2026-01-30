/**
 * Onboarding Screen
 *
 * First-time user experience with feature highlights:
 * 1. Private Payments - Hidden amounts and recipients
 * 2. Stealth Addresses - One-time addresses for privacy
 * 3. Viewing Keys - Selective disclosure for compliance
 */

import { View, Text, Dimensions, TouchableOpacity } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { useState, useRef } from "react"
import { Button } from "@/components/ui"
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from "react-native-reanimated"
import type { Icon as PhosphorIcon } from "phosphor-react-native"
import {
  LockSimple,
  Ghost,
  Key,
} from "phosphor-react-native"
import { ICON_COLORS } from "@/constants/icons"

const { width } = Dimensions.get("window")

interface OnboardingSlide {
  id: string
  icon: PhosphorIcon
  title: string
  description: string
  color: string
}

const SLIDES: OnboardingSlide[] = [
  {
    id: "1",
    icon: LockSimple,
    title: "Private Payments",
    description:
      "Send and receive SOL privately. Your amounts and recipients are hidden from the public blockchain.",
    color: "#8b5cf6", // brand-600
  },
  {
    id: "2",
    icon: Ghost,
    title: "Stealth Addresses",
    description:
      "Generate one-time addresses for each transaction. No one can link your payments together.",
    color: "#06b6d4", // cyan
  },
  {
    id: "3",
    icon: Key,
    title: "Viewing Keys",
    description:
      "Share selective disclosure keys with auditors when needed. Privacy with compliance.",
    color: "#10b981", // green
  },
]

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const scrollX = useSharedValue(0)
  const flatListRef = useRef<Animated.FlatList<OnboardingSlide>>(null)

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x
    },
  })

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      })
      setCurrentIndex(currentIndex + 1)
    } else {
      handleGetStarted()
    }
  }

  const handleGetStarted = () => {
    // Mark onboarding as complete (could save to AsyncStorage)
    router.replace("/(auth)/login")
  }

  const handleSkip = () => {
    router.replace("/(auth)/login")
  }

  const renderSlide = ({ item }: { item: OnboardingSlide; index: number }) => {
    const IconComponent = item.icon
    return (
      <View style={{ width }} className="items-center px-8">
        {/* Icon */}
        <View
          className="w-32 h-32 rounded-3xl items-center justify-center mb-8"
          style={{ backgroundColor: `${item.color}20` }}
        >
          <IconComponent size={64} color={item.color} weight="fill" />
        </View>

        {/* Title */}
        <Text className="text-3xl font-bold text-white text-center mb-4">
          {item.title}
        </Text>

        {/* Description */}
        <Text className="text-lg text-dark-400 text-center leading-7">
          {item.description}
        </Text>
      </View>
    )
  }

  const PaginationDot = ({ index }: { index: number }) => {
    const animatedStyle = useAnimatedStyle(() => {
      const inputRange = [
        (index - 1) * width,
        index * width,
        (index + 1) * width,
      ]

      const dotWidth = interpolate(
        scrollX.value,
        inputRange,
        [8, 24, 8],
        Extrapolation.CLAMP
      )

      const opacity = interpolate(
        scrollX.value,
        inputRange,
        [0.3, 1, 0.3],
        Extrapolation.CLAMP
      )

      return {
        width: dotWidth,
        opacity,
      }
    })

    return (
      <Animated.View
        className="h-2 rounded-full bg-brand-600 mx-1"
        style={animatedStyle}
      />
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-dark-950">
      {/* Skip Button */}
      <View className="flex-row justify-end px-6 pt-4">
        <TouchableOpacity onPress={handleSkip}>
          <Text className="text-dark-400 text-lg">Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Slides */}
      <View className="flex-1 justify-center">
        <Animated.FlatList
          ref={flatListRef}
          data={SLIDES}
          renderItem={renderSlide}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(e) => {
            const index = Math.round(e.nativeEvent.contentOffset.x / width)
            setCurrentIndex(index)
          }}
        />
      </View>

      {/* Pagination & Button */}
      <View className="px-6 pb-8">
        {/* Dots */}
        <View className="flex-row justify-center mb-8">
          {SLIDES.map((_, index) => (
            <PaginationDot key={index} index={index} />
          ))}
        </View>

        {/* Action Button */}
        <Button fullWidth size="lg" onPress={handleNext}>
          {currentIndex === SLIDES.length - 1 ? "Get Started" : "Next"}
        </Button>

        {/* Progress indicator */}
        <Text className="text-dark-600 text-center mt-4">
          {currentIndex + 1} of {SLIDES.length}
        </Text>
      </View>
    </SafeAreaView>
  )
}
