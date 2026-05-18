/**
 * Tests the two MPP-wrapped 0x API endpoints:
 *   - swap-allowance-holder-price  (indicative price, no taker required)
 *   - swap-allowance-holder-quote  (firm quote, requires taker address)
 *
 * The proxy enforces payment via the MPP Tempo Mainnet protocol (chainId 4217).
 * mppx/client handles the 402 → sign → retry flow automatically.
 *
 * Requirements:
 *   .env file with PRIVATE_KEY set to a hex private key for a wallet that holds
 *   USDC.e on Tempo Mainnet. Copy .env.example to .env and fill it in.
 *
 * Run:
 *   npm test
 */

import 'dotenv/config'
import { Mppx, tempo } from 'mppx/client'
import { Credential } from 'mppx'
import { privateKeyToAccount } from 'viem/accounts'

const TEMPO_EXPLORER = 'https://explore.tempo.xyz'

// ─── Endpoints ────────────────────────────────────────────────────────────────

const BASE_URL =
  'https://agent-proxy.alchemy.com/v1/mpp-tempo/86b0ec6d1d0b3dc0'

const PRICE_URL = `${BASE_URL}/swap-allowance-holder-price/`
const QUOTE_URL = `${BASE_URL}/swap-allowance-holder-quote/`

// ─── 0x Swap Params ───────────────────────────────────────────────────────────
// Testing WETH → USDC on Base (chainId 8453)

const SELL_TOKEN = '0x4200000000000000000000000000000000000006' // WETH on Base
const BUY_TOKEN = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'  // USDC on Base
const SELL_AMOUNT = '1000000000000000'                            // 0.001 WETH

// ─── Setup ────────────────────────────────────────────────────────────────────

const PRIVATE_KEY = process.env.PRIVATE_KEY
if (!PRIVATE_KEY || !/^0x[0-9a-fA-F]{64}$/.test(PRIVATE_KEY)) {
  console.error('Error: PRIVATE_KEY must be a 32-byte hex string (0x + 64 hex chars).')
  console.error('Edit .env and set PRIVATE_KEY=0x<your-64-char-hex-key>')
  process.exit(1)
}

const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`)
console.log(`Wallet: ${account.address}`)

let lastPaymentTxHash: string | undefined

const mppx = Mppx.create({
  methods: [
    tempo.charge({
      account,
      // push mode: client broadcasts the tx and sends the hash to the proxy
      mode: 'push',
    }),
  ],
  polyfill: false,
  async onChallenge(_challenge, { createCredential }) {
    const serialized = await createCredential()
    const { payload } = Credential.deserialize<{ type: string; hash?: string }>(serialized)
    if (payload.type === 'hash' && payload.hash) lastPaymentTxHash = payload.hash
    return serialized
  },
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function printSection(title: string) {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(` ${title}`)
  console.log('─'.repeat(60))
}

function printPaymentTx() {
  if (lastPaymentTxHash)
    console.log(`  payment tx                 ${TEMPO_EXPLORER}/tx/${lastPaymentTxHash}`)
}

function printResult(label: string, value: unknown) {
  const display =
    value === undefined || value === null
      ? '(none)'
      : typeof value === 'object'
      ? JSON.stringify(value)
      : String(value)
  console.log(`  ${label.padEnd(26)} ${display}`)
}

// ─── Price Test ───────────────────────────────────────────────────────────────

async function testPrice() {
  printSection('Test 1: swap-allowance-holder-price')

  const params = new URLSearchParams({
    chainId: '8453',
    sellToken: SELL_TOKEN,
    buyToken: BUY_TOKEN,
    sellAmount: SELL_AMOUNT,
  })

  const url = `${PRICE_URL}?${params}`
  console.log(`  GET ${url}\n`)

  const res = await mppx.fetch(url)
  const body = (await res.json()) as Record<string, unknown>

  if (!res.ok) {
    console.error(`  FAIL  HTTP ${res.status}`)
    console.error('  Response:', JSON.stringify(body, null, 2))
    return false
  }

  console.log(`  PASS  HTTP ${res.status}`)
  printPaymentTx()
  printResult('sellAmount', body.sellAmount)
  printResult('buyAmount', body.buyAmount)
  printResult('estimatedPriceImpact', body.estimatedPriceImpact)
  printResult('liquidityAvailable', body.liquidityAvailable)

  if (body.issues && typeof body.issues === 'object') {
    const issues = body.issues as Record<string, unknown>
    printResult('issues.balance', issues.balance ?? '(none)')
    printResult('issues.allowance', issues.allowance ?? '(none)')
  }

  return true
}

// ─── Quote Test ───────────────────────────────────────────────────────────────

async function testQuote() {
  printSection('Test 2: swap-allowance-holder-quote')

  const params = new URLSearchParams({
    chainId: '8453',
    sellToken: SELL_TOKEN,
    buyToken: BUY_TOKEN,
    sellAmount: SELL_AMOUNT,
    taker: account.address,
  })

  const url = `${QUOTE_URL}?${params}`
  console.log(`  GET ${url}\n`)

  const res = await mppx.fetch(url)
  const body = (await res.json()) as Record<string, unknown>

  if (!res.ok) {
    console.error(`  FAIL  HTTP ${res.status}`)
    console.error('  Response:', JSON.stringify(body, null, 2))
    return false
  }

  console.log(`  PASS  HTTP ${res.status}`)
  printPaymentTx()
  printResult('sellAmount', body.sellAmount)
  printResult('buyAmount', body.buyAmount)
  printResult('estimatedPriceImpact', body.estimatedPriceImpact)
  printResult('liquidityAvailable', body.liquidityAvailable)

  const tx = body.transaction as Record<string, unknown> | undefined
  if (tx) {
    printResult('transaction.to', tx.to)
    printResult('transaction.gas', tx.gas)
    printResult('transaction.gasPrice', tx.gasPrice)
    const data = String(tx.data ?? '')
    printResult('transaction.data (first 10)', data.slice(0, 10) + '…')
  }

  const permit2 = body.permit2 as Record<string, unknown> | undefined
  if (permit2) {
    printResult('permit2.type', permit2.type)
  }

  return true
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\nAgentPay MPP Endpoint Tests')
  console.log('Using 0x AllowanceHolder swap flow on Base (chainId 8453)')
  console.log('Payment channel: Tempo Mainnet (USDC.e)\n')

  const results: boolean[] = []
  results.push(await testPrice())
  results.push(await testQuote())

  const passed = results.filter(Boolean).length
  printSection(`Results: ${passed}/${results.length} passed`)

  if (passed < results.length) process.exit(1)
}

main().catch((err) => {
  console.error('\nUnhandled error:', err)
  process.exit(1)
})
