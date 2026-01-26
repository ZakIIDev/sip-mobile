/**
 * SIP Privacy Anchor Module
 *
 * Exports all types, utilities, and client for the sip-privacy program.
 */

// Types and constants
export {
  SIP_PRIVACY_PROGRAM_ID,
  CONFIG_SEED,
  TRANSFER_RECORD_SEED,
  NULLIFIER_SEED,
  getConfigPda,
  getTransferRecordPda,
  getNullifierPda,
  COMMITMENT_SIZE,
  EPHEMERAL_PUBKEY_SIZE,
  VIEWING_KEY_HASH_SIZE,
  MAX_PROOF_SIZE,
  MAX_ENCRYPTED_AMOUNT_SIZE,
  type Config,
  type TransferRecord,
  type NullifierRecord,
  type ShieldedTransferArgs,
} from "./types"

// Cryptographic utilities
export {
  createCommitment,
  encryptAmount,
  decryptAmount,
  computeViewingKeyHash,
  deriveSharedSecret,
  generateMockProof,
  generateEphemeralKeyPair,
  bytesToHex,
  hexToBytes,
  type PedersenCommitment,
  type EncryptedAmount,
  type EphemeralKeyPair,
} from "./crypto"

// Program client
export {
  SipPrivacyClient,
  getSipPrivacyClient,
  resetSipPrivacyClient,
  type ShieldedTransferParams,
  type ShieldedTransferResult,
  type ProgramState,
} from "./client"
