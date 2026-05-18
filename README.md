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
2. [`mppx/client`](https://github.com/wevm/mppx) broadcasts a payment transaction on Tempo Mainnet (chainId 4217) and captures the tx hash
3. Client retries with `Authorization: Payment <credential>` header containing the tx hash
4. Proxy verifies the payment and forwards to the 0x API
5. The tx hash is printed as a link to [explore.tempo.xyz](https://explore.tempo.xyz)

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
Wallet: 0xb15a55e85FdF5edc41B6c1eaf7813e2c6e6def59

AgentPay MPP Endpoint Tests
Using 0x AllowanceHolder swap flow on Base (chainId 8453)
Payment channel: Tempo Mainnet (USDC.e)

────────────────────────────────────────────────────────────
 Test 1: swap-allowance-holder-price
────────────────────────────────────────────────────────────
  PASS  HTTP 200
  payment tx                 https://explore.tempo.xyz/tx/0x303e6ac14cd303981a3562491fb28c1014fd73f34060f3830311eb7920b2551a
  sellAmount                 1000000000000000
  buyAmount                  2121484
  estimatedPriceImpact       (none)
  liquidityAvailable         true
  issues.balance             (none)
  issues.allowance           {"actual":"0","spender":"0x0000000000001ff3684f28c67538d4d072c22734"}

────────────────────────────────────────────────────────────
 Test 2: swap-allowance-holder-quote
────────────────────────────────────────────────────────────
  PASS  HTTP 200
  payment tx                 https://explore.tempo.xyz/tx/0x5f13f3653877566797d2267acc2965a5b5d450a92bc29c203542c2dd36cb8f5f
  sellAmount                 1000000000000000
  buyAmount                  2121484
  estimatedPriceImpact       (none)
  liquidityAvailable         true
  transaction.to             0x0000000000001ff3684f28c67538d4d072c22734
  transaction.gas            331507
  transaction.gasPrice       8125000
  transaction.data (first 10) 0x2213bc0b…
```
