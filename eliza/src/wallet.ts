/**
 * Solana wallet loader and balance checker.
 *
 * Reads a base58-encoded secret key from SOLANA_PRIVATE_KEY env var
 * and provides SOL + USDC balance queries.
 */

import { Connection, Keypair, PublicKey } from '@solana/web3.js';

const DEFAULT_RPC_URL = 'https://api.mainnet-beta.solana.com';
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const LAMPORTS_PER_SOL = 1_000_000_000;
const USDC_DECIMALS = 6;

export interface Wallet {
  keypair: Keypair;
  connection: Connection;
}

export interface WalletBalance {
  sol: number;
  usdc: number;
}

/**
 * Load wallet from environment. Returns null if SOLANA_PRIVATE_KEY is not set.
 */
export function loadWallet(): Wallet | null {
  const secretKeyBase58 = process.env.SOLANA_PRIVATE_KEY;
  if (!secretKeyBase58) return null;

  const rpcUrl = process.env.SOLANA_RPC_URL || DEFAULT_RPC_URL;

  // Decode base58 secret key to Uint8Array
  const secretKeyBytes = decodeBase58(secretKeyBase58);
  const keypair = Keypair.fromSecretKey(secretKeyBytes);
  const connection = new Connection(rpcUrl, 'confirmed');

  return { keypair, connection };
}

/**
 * Fetch SOL and USDC balances for a given public key.
 */
export async function getBalance(
  connection: Connection,
  publicKey: PublicKey
): Promise<WalletBalance> {
  const solLamports = await connection.getBalance(publicKey);
  const sol = solLamports / LAMPORTS_PER_SOL;

  let usdc = 0;
  // Find USDC token account via getTokenAccountsByOwner
  const tokenAccounts = await connection.getTokenAccountsByOwner(publicKey, {
    mint: USDC_MINT,
  });

  if (tokenAccounts.value.length > 0) {
    // Parse token amount from account data (offset 64, 8 bytes LE for amount)
    const data = tokenAccounts.value[0].account.data;
    const rawAmount = data.readBigUInt64LE(64);
    usdc = Number(rawAmount) / 10 ** USDC_DECIMALS;
  }

  return { sol, usdc };
}

// ---------------------------------------------------------------------------
// Base58 decoder (avoid extra dependency)
// ---------------------------------------------------------------------------

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function decodeBase58(input: string): Uint8Array {
  const alphabetMap = new Map<string, number>();
  for (let i = 0; i < BASE58_ALPHABET.length; i++) {
    alphabetMap.set(BASE58_ALPHABET[i], i);
  }

  // Count leading '1's (zero bytes)
  let leadingZeros = 0;
  for (const char of input) {
    if (char === '1') leadingZeros++;
    else break;
  }

  // Decode to big integer, then to bytes
  const bytes: number[] = [];
  for (const char of input) {
    const value = alphabetMap.get(char);
    if (value === undefined) throw new Error(`Invalid base58 character: ${char}`);

    let carry = value;
    for (let j = bytes.length - 1; j >= 0; j--) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.unshift(carry & 0xff);
      carry >>= 8;
    }
  }

  // Prepend leading zero bytes
  const result = new Uint8Array(leadingZeros + bytes.length);
  result.set(bytes, leadingZeros);
  return result;
}
