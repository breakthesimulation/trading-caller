/**
 * Jupiter V6 swap executor.
 *
 * Fetches a quote, builds the swap transaction, signs, and submits.
 * Fails fast with no retry logic -- caller decides how to handle errors.
 */

import { VersionedTransaction } from '@solana/web3.js';
import type { Wallet } from './wallet.ts';

const JUPITER_QUOTE_URL = 'https://lite-api.jup.ag/swap/v1/quote';
const JUPITER_SWAP_URL = 'https://lite-api.jup.ag/swap/v1/swap';
const DEFAULT_SLIPPAGE_BPS = 100; // 1%

export interface QuoteResponse {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  routePlan: unknown[];
  /** Full response passed through to swap endpoint */
  [key: string]: unknown;
}

export interface SwapResult {
  txHash: string;
  inputAmount: number;
  outputAmount: number;
}

/**
 * Fetch a swap quote from Jupiter V6.
 *
 * @param inputMint  - Source token mint address
 * @param outputMint - Destination token mint address
 * @param amount     - Amount in smallest unit of the input token
 * @param slippageBps - Slippage tolerance in basis points (default: 100 = 1%)
 */
export async function getQuote(
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number = DEFAULT_SLIPPAGE_BPS
): Promise<QuoteResponse> {
  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount: amount.toString(),
    slippageBps: slippageBps.toString(),
  });

  const response = await fetch(`${JUPITER_QUOTE_URL}?${params}`);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Jupiter quote failed (${response.status}): ${body}`);
  }

  return response.json();
}

/**
 * Execute a swap: build transaction from quote, sign, submit, and confirm.
 */
export async function executeSwap(
  quoteResponse: QuoteResponse,
  wallet: Wallet
): Promise<SwapResult> {
  const publicKey = wallet.keypair.publicKey.toBase58();

  // Request serialized transaction from Jupiter
  const swapResponse = await fetch(JUPITER_SWAP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quoteResponse,
      userPublicKey: publicKey,
      wrapAndUnwrapSol: true,
    }),
  });

  if (!swapResponse.ok) {
    const body = await swapResponse.text();
    throw new Error(`Jupiter swap failed (${swapResponse.status}): ${body}`);
  }

  const { swapTransaction } = await swapResponse.json();

  // Deserialize, sign, and send
  const transactionBuf = Buffer.from(swapTransaction, 'base64');
  const transaction = VersionedTransaction.deserialize(transactionBuf);
  transaction.sign([wallet.keypair]);

  const txHash = await wallet.connection.sendRawTransaction(transaction.serialize(), {
    skipPreflight: false,
    maxRetries: 2,
  });

  // Wait for confirmation (fail fast -- single attempt)
  const confirmation = await wallet.connection.confirmTransaction(txHash, 'confirmed');

  if (confirmation.value.err) {
    throw new Error(`Transaction failed on-chain: ${JSON.stringify(confirmation.value.err)}`);
  }

  return {
    txHash,
    inputAmount: Number(quoteResponse.inAmount),
    outputAmount: Number(quoteResponse.outAmount),
  };
}
