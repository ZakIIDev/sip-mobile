/**
 * Phone Login Screen
 *
 * Two-step SMS OTP authentication:
 * 1. Enter phone number
 * 2. Enter verification code
 */

import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { useWallet } from "@/hooks"
import { Button } from "@/components/ui"
import { useState, useRef, useEffect } from "react"

type Step = "phone" | "code"

export default function PhoneLoginScreen() {
  const { sendSMSCode, loginWithSMSCode, error, account } = useWallet()

  const [step, setStep] = useState<Step>("phone")
  const [phone, setPhone] = useState("")
  const [countryCode] = useState("+1") // TODO: Add country picker
  const [code, setCode] = useState(["", "", "", "", "", ""])
  const [isLoading, setIsLoading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const codeInputRefs = useRef<(TextInput | null)[]>([])

  // Navigate to main app when connected
  useEffect(() => {
    if (account) {
      router.replace("/(tabs)")
    }
  }, [account])

  const validatePhone = (phone: string): boolean => {
    // Basic validation - at least 10 digits
    const digitsOnly = phone.replace(/\D/g, "")
    return digitsOnly.length >= 10
  }

  const formatPhoneNumber = (text: string): string => {
    // Remove non-digits
    const digits = text.replace(/\D/g, "")

    // Format as (XXX) XXX-XXXX for US numbers
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
  }

  const handleSendCode = async () => {
    const fullPhone = `${countryCode}${phone.replace(/\D/g, "")}`

    if (!validatePhone(phone)) {
      setLocalError("Please enter a valid phone number")
      return
    }

    setIsLoading(true)
    setLocalError(null)

    try {
      await sendSMSCode(fullPhone)
      setStep("code")
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to send code")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCodeChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d+$/.test(value)) return

    const newCode = [...code]
    newCode[index] = value.slice(-1)

    setCode(newCode)

    // Auto-focus next input
    if (value && index < 5) {
      codeInputRefs.current[index + 1]?.focus()
    }

    // Auto-submit when complete
    if (newCode.every((c) => c !== "") && newCode.join("").length === 6) {
      handleVerifyCode(newCode.join(""))
    }
  }

  const handleCodeKeyPress = (index: number, key: string) => {
    if (key === "Backspace" && !code[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus()
    }
  }

  const handleVerifyCode = async (verificationCode?: string) => {
    const codeString = verificationCode || code.join("")

    if (codeString.length !== 6) {
      setLocalError("Please enter the 6-digit code")
      return
    }

    setIsLoading(true)
    setLocalError(null)

    try {
      await loginWithSMSCode(codeString)
      // Navigation happens via useEffect
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Invalid code")
      setCode(["", "", "", "", "", ""])
      codeInputRefs.current[0]?.focus()
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendCode = async () => {
    const fullPhone = `${countryCode}${phone.replace(/\D/g, "")}`
    setIsLoading(true)
    setLocalError(null)

    try {
      await sendSMSCode(fullPhone)
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to resend code")
    } finally {
      setIsLoading(false)
    }
  }

  const displayError = localError || error?.message

  return (
    <SafeAreaView className="flex-1 bg-dark-950">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View className="flex-1 px-6 pt-6">
          {/* Header */}
          <TouchableOpacity
            className="flex-row items-center mb-8"
            onPress={() => {
              if (step === "code") {
                setStep("phone")
                setCode(["", "", "", "", "", ""])
              } else {
                router.back()
              }
            }}
          >
            <Text className="text-2xl text-white">←</Text>
            <Text className="text-white ml-4 text-lg">
              {step === "phone" ? "Back" : "Change Number"}
            </Text>
          </TouchableOpacity>

          {step === "phone" ? (
            /* Step 1: Phone Input */
            <View className="flex-1">
              <View className="mb-8">
                <Text className="text-3xl font-bold text-white mb-2">
                  Enter your phone
                </Text>
                <Text className="text-dark-400">
                  We'll send you a verification code via SMS
                </Text>
              </View>

              {/* Country Code + Phone Input */}
              <View className="flex-row gap-3 mb-6">
                {/* Country Code Selector */}
                <TouchableOpacity
                  className="bg-dark-900 border border-dark-800 rounded-xl px-4 py-4 flex-row items-center"
                  // TODO: Add country code picker
                >
                  <Text className="text-white text-lg">{countryCode}</Text>
                  <Text className="text-dark-600 ml-2">▼</Text>
                </TouchableOpacity>

                {/* Phone Input */}
                <TextInput
                  className="flex-1 bg-dark-900 border border-dark-800 rounded-xl px-4 py-4 text-white text-lg"
                  placeholder="(555) 123-4567"
                  placeholderTextColor="#71717a"
                  keyboardType="phone-pad"
                  autoFocus
                  value={phone}
                  onChangeText={(text) => {
                    setPhone(formatPhoneNumber(text))
                    setLocalError(null)
                  }}
                  onSubmitEditing={handleSendCode}
                />
              </View>

              {displayError && (
                <View className="p-4 bg-red-900/20 border border-red-700 rounded-xl mb-6">
                  <Text className="text-red-400">{displayError}</Text>
                </View>
              )}

              <Button
                fullWidth
                size="lg"
                onPress={handleSendCode}
                loading={isLoading}
                disabled={!phone}
              >
                Continue
              </Button>
            </View>
          ) : (
            /* Step 2: Code Verification */
            <View className="flex-1">
              <View className="mb-8">
                <Text className="text-3xl font-bold text-white mb-2">
                  Check your phone
                </Text>
                <Text className="text-dark-400">
                  Enter the 6-digit code sent to{"\n"}
                  <Text className="text-white">{countryCode} {phone}</Text>
                </Text>
              </View>

              {/* Code Input */}
              <View className="flex-row justify-between mb-6">
                {code.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => { codeInputRefs.current[index] = ref }}
                    className={`w-12 h-14 bg-dark-900 border rounded-xl text-center text-white text-2xl font-bold ${
                      digit ? "border-brand-600" : "border-dark-800"
                    }`}
                    keyboardType="number-pad"
                    maxLength={1}
                    value={digit}
                    onChangeText={(value) => handleCodeChange(index, value)}
                    onKeyPress={({ nativeEvent }) =>
                      handleCodeKeyPress(index, nativeEvent.key)
                    }
                    autoFocus={index === 0}
                  />
                ))}
              </View>

              {displayError && (
                <View className="p-4 bg-red-900/20 border border-red-700 rounded-xl mb-6">
                  <Text className="text-red-400">{displayError}</Text>
                </View>
              )}

              <Button
                fullWidth
                size="lg"
                onPress={() => handleVerifyCode()}
                loading={isLoading}
                disabled={code.some((c) => !c)}
              >
                Verify
              </Button>

              {/* Resend Code */}
              <TouchableOpacity
                className="mt-6 items-center"
                onPress={handleResendCode}
                disabled={isLoading}
              >
                <Text className="text-dark-400">
                  Didn't receive the code?{" "}
                  <Text className="text-brand-400">Resend</Text>
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
