/**
 * Stealth Library Tests
 *
 * Tests pure crypto utility functions from lib/stealth.ts
 */

import { describe, it, expect } from "vitest"
import {
  bytesToHex,
  hexToBytes,
  formatStealthMetaAddress,
  parseStealthMetaAddress,
  ed25519PublicKeyToSolanaAddress,
  solanaAddressToEd25519PublicKey,
  isValidSolanaAddress,
} from "@/lib/stealth"

describe("Stealth Library", () => {
  describe("bytesToHex", () => {
    it("should convert empty array to empty string", () => {
      expect(bytesToHex(new Uint8Array([]))).toBe("")
    })

    it("should convert single byte to two hex chars", () => {
      expect(bytesToHex(new Uint8Array([0]))).toBe("00")
      expect(bytesToHex(new Uint8Array([255]))).toBe("ff")
      expect(bytesToHex(new Uint8Array([15]))).toBe("0f")
      expect(bytesToHex(new Uint8Array([16]))).toBe("10")
    })

    it("should convert multiple bytes correctly", () => {
      expect(bytesToHex(new Uint8Array([1, 2, 3]))).toBe("010203")
      expect(bytesToHex(new Uint8Array([255, 0, 128]))).toBe("ff0080")
    })

    it("should handle 32-byte keys", () => {
      const key = new Uint8Array(32).fill(0xab)
      const hex = bytesToHex(key)
      expect(hex.length).toBe(64)
      expect(hex).toBe("ab".repeat(32))
    })
  })

  describe("hexToBytes", () => {
    it("should convert empty string to empty array", () => {
      expect(hexToBytes("")).toEqual(new Uint8Array([]))
    })

    it("should handle 0x prefix", () => {
      expect(hexToBytes("0x0102")).toEqual(new Uint8Array([1, 2]))
      expect(hexToBytes("0102")).toEqual(new Uint8Array([1, 2]))
    })

    it("should convert hex string correctly", () => {
      expect(hexToBytes("00")).toEqual(new Uint8Array([0]))
      expect(hexToBytes("ff")).toEqual(new Uint8Array([255]))
      expect(hexToBytes("010203")).toEqual(new Uint8Array([1, 2, 3]))
    })

    it("should handle uppercase and lowercase", () => {
      expect(hexToBytes("FF")).toEqual(new Uint8Array([255]))
      expect(hexToBytes("aB")).toEqual(new Uint8Array([171]))
    })

    it("should roundtrip with bytesToHex", () => {
      const original = new Uint8Array([1, 127, 255, 0, 64])
      expect(hexToBytes(bytesToHex(original))).toEqual(original)
    })
  })

  describe("formatStealthMetaAddress", () => {
    it("should format correctly with all fields", () => {
      const metaAddress = {
        chain: "solana",
        spendingKey: "0x1234",
        viewingKey: "0x5678",
      }
      expect(formatStealthMetaAddress(metaAddress)).toBe(
        "sip:solana:0x1234:0x5678"
      )
    })

    it("should handle different chains", () => {
      const metaAddress = {
        chain: "ethereum",
        spendingKey: "0xabc",
        viewingKey: "0xdef",
      }
      expect(formatStealthMetaAddress(metaAddress)).toBe(
        "sip:ethereum:0xabc:0xdef"
      )
    })

    it("should ignore optional label in format", () => {
      const metaAddress = {
        chain: "solana",
        spendingKey: "0x1234",
        viewingKey: "0x5678",
        label: "My Wallet",
      }
      expect(formatStealthMetaAddress(metaAddress)).toBe(
        "sip:solana:0x1234:0x5678"
      )
    })
  })

  describe("parseStealthMetaAddress", () => {
    it("should parse valid address string", () => {
      const result = parseStealthMetaAddress("sip:solana:0x1234:0x5678")
      expect(result).toEqual({
        chain: "solana",
        spendingKey: "0x1234",
        viewingKey: "0x5678",
      })
    })

    it("should return null for invalid prefix", () => {
      expect(parseStealthMetaAddress("invalid:solana:0x1234:0x5678")).toBeNull()
      expect(parseStealthMetaAddress("0x1234")).toBeNull()
      expect(parseStealthMetaAddress("")).toBeNull()
    })

    it("should return null for wrong number of parts", () => {
      expect(parseStealthMetaAddress("sip:solana:0x1234")).toBeNull()
      expect(parseStealthMetaAddress("sip:solana:0x1234:0x5678:extra")).toBeNull()
    })

    it("should roundtrip with formatStealthMetaAddress", () => {
      const original = {
        chain: "solana",
        spendingKey: "0xabcdef123456",
        viewingKey: "0x987654fedcba",
      }
      const formatted = formatStealthMetaAddress(original)
      const parsed = parseStealthMetaAddress(formatted)
      expect(parsed).toEqual(original)
    })
  })

  describe("ed25519PublicKeyToSolanaAddress", () => {
    it("should convert 32-byte key to base58 address", () => {
      // Known conversion: all zeros = "11111111111111111111111111111111"
      const zeroKey = "0x" + "00".repeat(32)
      const address = ed25519PublicKeyToSolanaAddress(zeroKey)
      expect(address).toBe("11111111111111111111111111111111")
    })

    it("should handle real-looking key", () => {
      // A key that's all 0x01 bytes
      const key = "0x" + "01".repeat(32)
      const address = ed25519PublicKeyToSolanaAddress(key)
      expect(address.length).toBeGreaterThan(30)
      expect(address.length).toBeLessThanOrEqual(44)
    })
  })

  describe("solanaAddressToEd25519PublicKey", () => {
    it("should convert base58 to hex", () => {
      const address = "11111111111111111111111111111111"
      const key = solanaAddressToEd25519PublicKey(address)
      expect(key).toBe("0x" + "00".repeat(32))
    })

    it("should roundtrip with ed25519PublicKeyToSolanaAddress", () => {
      const originalKey = "0x" + "ab".repeat(32)
      const address = ed25519PublicKeyToSolanaAddress(originalKey)
      const recoveredKey = solanaAddressToEd25519PublicKey(address)
      expect(recoveredKey).toBe(originalKey)
    })
  })

  describe("isValidSolanaAddress", () => {
    it("should return true for valid 32-byte address", () => {
      expect(isValidSolanaAddress("11111111111111111111111111111111")).toBe(true)
      expect(
        isValidSolanaAddress("So11111111111111111111111111111111111111112")
      ).toBe(true)
    })

    it("should return false for invalid addresses", () => {
      expect(isValidSolanaAddress("")).toBe(false)
      expect(isValidSolanaAddress("short")).toBe(false)
      expect(isValidSolanaAddress("0x1234")).toBe(false)
      // Invalid base58 character
      expect(isValidSolanaAddress("0OIl1111111111111111111111111111")).toBe(false)
    })

    it("should return false for wrong length", () => {
      // Too short (less than 32 bytes when decoded)
      expect(isValidSolanaAddress("1111111111")).toBe(false)
    })
  })
})
