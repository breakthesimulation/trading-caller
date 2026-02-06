// Top Solana tokens to track for volume spikes

import type { TrackedToken } from './types.js';

// Known token addresses for top Solana ecosystem tokens
export const TRACKED_TOKENS: TrackedToken[] = [
  {
    symbol: 'SOL',
    name: 'Solana',
    address: 'So11111111111111111111111111111111111111112',
  },
  {
    symbol: 'JUP',
    name: 'Jupiter',
    address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  },
  {
    symbol: 'BONK',
    name: 'Bonk',
    address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  },
  {
    symbol: 'WIF',
    name: 'dogwifhat',
    address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
  },
  {
    symbol: 'PYTH',
    name: 'Pyth Network',
    address: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
  },
  {
    symbol: 'JTO',
    name: 'Jito',
    address: 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL',
  },
  {
    symbol: 'RAY',
    name: 'Raydium',
    address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
  },
  {
    symbol: 'ORCA',
    name: 'Orca',
    address: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
  },
  {
    symbol: 'BOME',
    name: 'BOOK OF MEME',
    address: 'ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82',
  },
  {
    symbol: 'POPCAT',
    name: 'Popcat',
    address: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
  },
  {
    symbol: 'MEW',
    name: 'cat in a dogs world',
    address: 'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5',
  },
  {
    symbol: 'TRUMP',
    name: 'Official Trump',
    address: '6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN',
  },
  {
    symbol: 'MELANIA',
    name: 'Melania Meme',
    address: 'FUAfBo2jgks6gB4Z4LfZkqSZgzNucisEHqnNebaRxM1P',
  },
  {
    symbol: 'AI16Z',
    name: 'ai16z',
    address: 'HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC',
  },
  {
    symbol: 'PENGU',
    name: 'Pudgy Penguins',
    address: '2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv',
  },
  {
    symbol: 'FARTCOIN',
    name: 'Fartcoin',
    address: '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump',
  },
  {
    symbol: 'GOAT',
    name: 'Goatseus Maximus',
    address: 'CzLSujWBLFsSjncfkh59rUFqvafWcY5tzedWJSuypump',
  },
  {
    symbol: 'PNUT',
    name: 'Peanut the Squirrel',
    address: '2qEHjDLDLbuBgRYvsxhc5D6uDWAivNFZGan56P1tpump',
  },
  {
    symbol: 'MOODENG',
    name: 'Moo Deng',
    address: 'ED5nyyWEzpPPiWimP8vYm7sD7TD3LAt3Q3gRTWHzPJBY',
  },
  {
    symbol: 'CHILLGUY',
    name: 'Just a chill guy',
    address: 'Df6yfrKC8kZE3KNkrHERKzAetSxbrWeniQfyJY4Jpump',
  },
];

// Get token by symbol
export function getTokenBySymbol(symbol: string): TrackedToken | undefined {
  return TRACKED_TOKENS.find(t => t.symbol.toUpperCase() === symbol.toUpperCase());
}

// Get token by address
export function getTokenByAddress(address: string): TrackedToken | undefined {
  return TRACKED_TOKENS.find(t => t.address === address);
}
