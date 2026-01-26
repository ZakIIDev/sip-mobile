/**
 * SIP Privacy Program Types
 * Type definitions for Anchor program interactions
 */
import { PublicKey } from "@solana/web3.js"

// Program ID
export const SIP_PRIVACY_PROGRAM_ID = new PublicKey(
  "S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at"
)

// PDA Seeds
export const CONFIG_SEED = Buffer.from("config")
export const TRANSFER_RECORD_SEED = Buffer.from("transfer_record")
export const NULLIFIER_SEED = Buffer.from("nullifier")

// Account types
export interface Config {
  authority: PublicKey
  feeCollector: PublicKey
  feeBps: number
  paused: boolean
  totalTransfers: bigint
  bump: number
}

export interface TransferRecord {
  sender: PublicKey
  stealthRecipient: PublicKey
  amountCommitment: Uint8Array // 33 bytes
  ephemeralPubkey: Uint8Array // 33 bytes
  viewingKeyHash: Uint8Array // 32 bytes
  encryptedAmount: Uint8Array
  timestamp: bigint
  claimed: boolean
  tokenMint: PublicKey | null
  bump: number
}

export interface NullifierRecord {
  nullifier: Uint8Array // 32 bytes
  transferRecord: PublicKey
  claimedAt: bigint
  bump: number
}

// Instruction argument types
export interface ShieldedTransferArgs {
  amountCommitment: number[] // 33 bytes as array for BN serialization
  stealthPubkey: PublicKey
  ephemeralPubkey: number[] // 33 bytes
  viewingKeyHash: number[] // 32 bytes
  encryptedAmount: Buffer
  proof: Buffer
  actualAmount: bigint
}

// Helper to derive Config PDA
export function getConfigPda(
  programId: PublicKey = SIP_PRIVACY_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([CONFIG_SEED], programId)
}

// Helper to derive TransferRecord PDA
export function getTransferRecordPda(
  sender: PublicKey,
  totalTransfers: bigint,
  programId: PublicKey = SIP_PRIVACY_PROGRAM_ID
): [PublicKey, number] {
  const transferCountBuffer = Buffer.alloc(8)
  transferCountBuffer.writeBigUInt64LE(totalTransfers)

  return PublicKey.findProgramAddressSync(
    [TRANSFER_RECORD_SEED, sender.toBuffer(), transferCountBuffer],
    programId
  )
}

// Helper to derive Nullifier PDA
export function getNullifierPda(
  nullifier: Uint8Array,
  programId: PublicKey = SIP_PRIVACY_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [NULLIFIER_SEED, Buffer.from(nullifier)],
    programId
  )
}

// Constants from program
export const COMMITMENT_SIZE = 33
export const EPHEMERAL_PUBKEY_SIZE = 33
export const VIEWING_KEY_HASH_SIZE = 32
export const MAX_PROOF_SIZE = 2048
export const MAX_ENCRYPTED_AMOUNT_SIZE = 64
