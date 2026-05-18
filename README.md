# MPP Agentpay | 0x Swap Price + Quote

Test script for [AgentPay](https://agentpay.alchemy.com) MPP-wrapped 0x swap endpoints.

## Endpoints

| Endpoint | Description |
|---|---|
| `swap-allowance-holder-price` | Indicative price (no taker required) |
| `swap-allowance-holder-quote` | Firm quote with transaction calldata |

Both endpoints proxy the [0x Swap API v2](https://0x.org) (AllowanceHolder flow) and require a micro-payment via the **MPP Tempo Mainnet** protocol before returning a response.

## How it works

1. Client sends a request → proxy responds with HTTP 402 and a Tempo payment challenge
2. [`mppx/client`](https://github.com/wevm/mppx) signs a transaction on Tempo Testnet (chainId 42431) using your wallet
3. Client retries with `Authorization: Payment <credential>` header
4. Proxy verifies the payment and forwards to the 0x API

## Prerequisites

- A wallet with **USDC.e** (0x20C000000000000000000000b9537d11c60E8b50) on Tempo Mainnet
- Node.js 18+

## Setup

```bash
npm install
cp .env.example .env
```

Add your private key to `.env`:

```
PRIVATE_KEY=0x<your-private-key>
```

## Run

```bash
npm test
```

The test swaps WETH → USDC on Base (chainId 8453) by default. To change the pair, edit the constants near the top of `test-mpp-endpoints.ts`:

```ts
const SELL_TOKEN = '0x...'  // token to sell
const BUY_TOKEN  = '0x...'  // token to buy
const SELL_AMOUNT = '...'   // amount in token base units
```

## Example output

```
Wallet: 0x1Be31A94361a391bBaFB2a4CCd704F57dc04d4bb

AgentPay MPP Endpoint Tests
Using 0x AllowanceHolder swap flow on Base (chainId 8453)
Payment channel: Tempo Mainnet (USDC.e)

────────────────────────────────────────────────────────────
 Test 1: swap-allowance-holder-price
────────────────────────────────────────────────────────────
  PASS  HTTP 200
  sellAmount                 1000000000000000
  buyAmount                  2282736
  liquidityAvailable         true

────────────────────────────────────────────────────────────
 Test 2: swap-allowance-holder-quote
────────────────────────────────────────────────────────────
  PASS  HTTP 200
  sellAmount                 1000000000000000
  buyAmount                  2283420
  liquidityAvailable         true
  transaction.to             0x0000000000001ff3684f28c67538d4d072c22734
  transaction.gas            276162
```
