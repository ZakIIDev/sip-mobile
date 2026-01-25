/**
 * Type declarations for @solana-mobile/seed-vault-lib
 *
 * The library's types don't resolve correctly via package.json exports,
 * so we declare them here.
 */

declare module "@solana-mobile/seed-vault-lib" {
  import type { Permission } from "react-native"

  export const SeedVaultPermissionAndroid: Permission

  export const SolanaMobileSeedVaultLib: {
    isSeedVaultAvailable(allowSimulated: boolean): Promise<boolean>
  }

  export interface SeedInfo {
    authToken: number
    name: string
    purpose: number
  }

  export interface PublicKeyResult {
    publicKey: Uint8Array
    publicKeyEncoded: string
    resolvedDerivationPath: string
  }

  export interface AccountInfo {
    derivationPath: string
    name: string
    publicKey: Uint8Array
    publicKeyEncoded: string
  }

  export const SeedVault: {
    authorizeNewSeed(): Promise<{ authToken: number }>
    getAuthorizedSeeds(): Promise<SeedInfo[]>
    getAccounts(authToken: number): Promise<AccountInfo[]>
    getPublicKey(
      authToken: number,
      derivationPath: string
    ): Promise<PublicKeyResult>
    signMessage(
      authToken: number,
      derivationPath: string,
      message: Uint8Array
    ): Promise<Uint8Array>
    signTransaction(
      authToken: number,
      derivationPath: string,
      transaction: Uint8Array
    ): Promise<Uint8Array>
  }
}
