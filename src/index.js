/**
 * mQuickCalc Finance MCP Server
 * Covers: Etsy, eBay, Stripe fee & profit calculators
 *
 * Run: node dist/index.js
 * Install MCP: npx @modelcontextprotocol/sdk create-server
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// ─── Helper ────────────────────────────────────────────────────────────────

function moneyUSD(n) {
  return '$' + Math.round(n * 100) / 100;
}

function pct(n) {
  return (Math.round(n * 10000) / 100).toFixed(2) + '%';
}

function requirePositive(value, name) {
  const n = parseFloat(value);
  if (isNaN(n) || n < 0) {
    throw new Error(`${name} must be a positive number, got: ${value}`);
  }
  return n;
}

// ─── Tool Implementations ──────────────────────────────────────────────────

/**
 * Etsy Fee Calculator
 * Calculates Etsy fees from listing price, shipping, and options.
 * Default rates (2024): Transaction 6.5%, Payment processing 3%+$0.25,
 *   Reg fee 0.25%, Listing $0.20, Offsite ads 0-12%
 */
function etsyFeeCalc(params) {
  const price        = requirePositive(params.price, 'price');
  const shipping     = parseFloat(params.shipping) || 0;
  const qty          = Math.max(parseInt(params.quantity) || 1, 1);
  const transPct     = (parseFloat(params.transactionFeePct) || 6.5) / 100;
  const payPct       = (parseFloat(params.paymentProcessingPct) || 3.0) / 100;
  const payFlat      = parseFloat(params.paymentProcessingFlat) || 0.25;
  const regPct       = (parseFloat(params.regulatoryPct) || 0.25) / 100;
  const listingFee   = parseFloat(params.listingFee) || 0.20;
  const offsitePct   = (parseFloat(params.offsiteAdsPct) || 0) / 100;

  const gross = (price + shipping) * qty;

  const transFee     = gross * transPct;
  const payFee       = gross * payPct + payFlat * qty;
  const regFee       = gross * regPct;
  const listingCost  = listingFee * qty;
  const offsiteFee   = gross * offsitePct;

  const totalFees    = transFee + payFee + regFee + listingCost + offsiteFee;
  const netRevenue   = gross - totalFees;
  const effectivePct = gross > 0 ? totalFees / gross : 0;

  return {
    grossRevenue: moneyUSD(gross),
    fees: {
      transactionFee:      moneyUSD(transFee),
      paymentProcessing:  moneyUSD(payFee),
      regulatoryFee:       moneyUSD(regFee),
      listingFee:          moneyUSD(listingCost),
      offsiteAdsFee:       moneyUSD(offsiteFee),
    },
    totalFees:       moneyUSD(totalFees),
    netRevenue:      moneyUSD(netRevenue),
    effectiveFeeRate: pct(effectivePct),
    currency: 'USD',
    formula: {
      transaction: `${pct(transPct)} of gross`,
      paymentProcessing: `${pct(payPct)} + $${payFlat}/item`,
      regulatory: `${pct(regPct)} of gross`,
      listing: `$${listingFee}/item × ${qty}`,
      offsiteAds: `${pct(offsitePct)} of gross (if enabled)`,
    },
  };
}

/**
 * eBay Fee Calculator
 * Calculates eBay final value fees across US/UK/DE/CA/AU markets.
 * Default: US market, 12.9% + $0.30, tiered rate for >$7500
 */
function ebayFeeCalc(params) {
  const price    = requirePositive(params.price, 'price');
  const shipping = parseFloat(params.shipping) || 0;
  const rate     = (parseFloat(params.fvRate) || 12.9) / 100;    // final value %
  const fixed    = parseFloat(params.fixedFee) || 0.30;             // per-order fee
  const currency = params.currency || 'USD';

  const gross = price + shipping;
  const tiered = params.tiered === true || params.tiered === 'true';

  let fvFee;
  if (tiered && gross > 7500) {
    // Tiered: 12.9% on first $7,500 + 2.35% on amount above
    fvFee = 7500 * rate + (gross - 7500) * 0.0235;
  } else {
    fvFee = gross * rate;
  }

  const totalFees = fvFee + fixed;
  const netRevenue = gross - totalFees;
  const effectivePct = gross > 0 ? totalFees / gross : 0;

  return {
    grossRevenue: moneyUSD(gross),
    fees: {
      finalValueFee: moneyUSD(fvFee),
      fixedFee:      moneyUSD(fixed),
    },
    totalFees:       moneyUSD(totalFees),
    netRevenue:      moneyUSD(netRevenue),
    effectiveFeeRate: pct(effectivePct),
    currency,
    tieredMode: tiered,
    formula: {
      finalValue: tiered
        ? `12.9% on first $7,500 + 2.35% above (tiered)`
        : `${pct(rate)} of gross (flat)`,
      fixed: `$${fixed} per order`,
    },
  };
}

/**
 * Stripe Fee Calculator
 * Returns Stripe's fee, net, and the amount needed to hit a target.
 * Default: US Domestic Cards — 2.9% + $0.30
 */
function stripeFeeCalc(params) {
  const amount  = requirePositive(params.amount, 'amount');
  const pctV    = (parseFloat(params.percent) || 2.9) / 100;
  const flat    = parseFloat(params.flatFee) || 0.30;
  const currency = params.currency || 'USD';

  const fee   = amount * pctV + flat;
  const net   = amount - fee;
  // Amount needed to net a target after fees
  const target   = parseFloat(params.targetNet);
  const needed   = target > 0 ? (target + flat) / (1 - pctV) : null;

  const effectivePct = amount > 0 ? fee / amount : 0;

  const result = {
    grossAmount:  moneyUSD(amount),
    stripeFee:    moneyUSD(fee),
    netReceived:  moneyUSD(net),
    effectiveFeeRate: pct(effectivePct),
    currency,
    formula: `${pct(pctV)} + $${flat} per transaction`,
  };

  if (needed !== null) {
    result.amountNeededForNet = moneyUSD(needed);
    result.notes = `To receive ${moneyUSD(target)} after fees, charge at least ${moneyUSD(needed)}`;
  }

  return result;
}

/**
 * Multi-Platform Fee Comparison
 * Compares Etsy, eBay, Stripe, PayPal, and Shopify fees side-by-side
 */
function platformComparison(params) {
  const price      = requirePositive(params.price, 'price');
  const shipping   = parseFloat(params.shipping) || 0;
  const platform   = (params.platform || 'all').toLowerCase();
  const qty        = Math.max(parseInt(params.quantity) || 1, 1);
  const gross      = (price + shipping) * qty;

  const results = {};

  if (platform === 'all' || platform === 'etsy') {
    const t = 0.065, pp = 0.03, pf = 0.25, reg = 0.0025, lf = 0.20;
    const tf = gross*t + gross*pp + pf*qty + gross*reg + lf*qty;
    results.etsy = {
      gross: moneyUSD(gross),
      totalFees: moneyUSD(tf),
      net: moneyUSD(gross - tf),
      effectiveFeeRate: pct(tf/gross),
      breakdown: {
        transaction: moneyUSD(gross*t),
        paymentProcessing: moneyUSD(gross*pp + pf*qty),
        regulatory: moneyUSD(gross*reg),
        listing: moneyUSD(lf*qty),
      },
    };
  }

  if (platform === 'all' || platform === 'ebay') {
    const rate = 0.129, fixed = 0.30;
    const fv = gross * rate, tf = fv + fixed;
    results.ebay = {
      gross: moneyUSD(gross),
      totalFees: moneyUSD(tf),
      net: moneyUSD(gross - tf),
      effectiveFeeRate: pct(tf/gross),
      breakdown: { finalValue: moneyUSD(fv), fixed: moneyUSD(fixed) },
    };
  }

  if (platform === 'all' || platform === 'stripe') {
    const pctV = 0.029, flat = 0.30;
    const fee = gross * pctV + flat, tf = fee;
    results.stripe = {
      gross: moneyUSD(gross),
      totalFees: moneyUSD(tf),
      net: moneyUSD(gross - tf),
      effectiveFeeRate: pct(tf/gross),
      breakdown: { percent: pct(pctV), flat: moneyUSD(flat) },
    };
  }

  if (platform === 'all' || platform === 'paypal') {
    // PayPal: 2.99% + $0.49 (domestic)
    const pctV = 0.0299, flat = 0.49;
    const fee = gross * pctV + flat, tf = fee;
    results.paypal = {
      gross: moneyUSD(gross),
      totalFees: moneyUSD(tf),
      net: moneyUSD(gross - tf),
      effectiveFeeRate: pct(tf/gross),
      breakdown: { percent: pct(pctV), flat: moneyUSD(flat) },
    };
  }

  if (platform === 'all' || platform === 'shopify') {
    // Shopify Payments: 2.9% + $0.30 (basic)
    const pctV = 0.029, flat = 0.30;
    const fee = gross * pctV + flat, tf = fee;
    results.shopify = {
      gross: moneyUSD(gross),
      totalFees: moneyUSD(tf),
      net: moneyUSD(gross - tf),
      effectiveFeeRate: pct(tf/gross),
      breakdown: { percent: pct(pctV), flat: moneyUSD(flat) },
    };
  }

  // Sort by net revenue descending
  const sorted = Object.entries(results)
    .sort((a, b) => parseFloat(a[1].net.replace('$','').replace(',',''))
                 - parseFloat(b[1].net.replace('$','').replace(',','')))
    .reverse();

  return {
    input: { price, shipping, quantity: qty, gross: moneyUSD(gross) },
    platforms: Object.fromEntries(sorted),
    bestPlatform: sorted[0]?.[0] || null,
    worstPlatform: sorted[sorted.length - 1]?.[0] || null,
    recommendation: sorted.length > 1
      ? `${sorted[0]?.[0]} gives you the highest net (${sorted[0]?.[1]?.net}) for this sale`
      : null,
  };
}

/**
 * Profit Margin Calculator
 * Calculates net profit, margin, and markup from cost and selling price
 */
function profitCalc(params) {
  const cost         = requirePositive(params.cost, 'cost');
  const sellingPrice = requirePositive(params.sellingPrice, 'sellingPrice');
  const platformFees = parseFloat(params.platformFees) || 0; // flat fee or 0

  const revenue   = sellingPrice;
  const grossProfit = revenue - cost;
  const margin    = revenue > 0 ? grossProfit / revenue : 0;
  const markup    = cost > 0 ? grossProfit / cost : 0;
  const netProfit = grossProfit - platformFees;
  const netMargin = revenue > 0 ? netProfit / revenue : 0;

  return {
    cost:          moneyUSD(cost),
    sellingPrice:  moneyUSD(sellingPrice),
    grossProfit:   moneyUSD(grossProfit),
    grossMargin:   pct(margin),
    markup:        pct(markup),
    platformFees:  moneyUSD(platformFees),
    netProfit:     moneyUSD(netProfit),
    netMargin:     pct(netMargin),
    formula: {
      margin: '(sellingPrice - cost) / sellingPrice',
      markup: '(sellingPrice - cost) / cost',
    },
  };
}

// ─── MCP Server Setup ──────────────────────────────────────────────────────

const server = new Server(
  { name: 'mquickcalc-finance-mcp', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

// ─── Tool Registry ────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'etsy_fee_calculator',
    description: `Calculate Etsy seller fees for a single listing. Returns a full fee breakdown including transaction fee (default 6.5%), payment processing (3%+$0.25), regulatory fee (0.25%), listing fee ($0.20/item), and optional off-site ads fee (12%). Use this when a seller wants to know exactly what Etsy will take from a sale.

Input: price (required, USD), shipping (optional), quantity (default 1), transactionFeePct (default 6.5), paymentProcessingPct (default 3.0), paymentProcessingFlat (default 0.25), regulatoryPct (default 0.25), listingFee (default 0.20), offsiteAdsPct (default 0, set to 12 if offsite ads enabled).`,
    inputSchema: {
      type: 'object',
      properties: {
        price: { type: 'number', description: 'Item listing price in USD' },
        shipping: { type: 'number', description: 'Shipping charge in USD (default 0)' },
        quantity: { type: 'number', description: 'Quantity sold (default 1)' },
        transactionFeePct: { type: 'number', description: 'Transaction fee % (default 6.5)' },
        paymentProcessingPct: { type: 'number', description: 'Payment processing fee % (default 3.0)' },
        paymentProcessingFlat: { type: 'number', description: 'Payment processing flat fee per item (default 0.25)' },
        regulatoryPct: { type: 'number', description: 'Regulatory fee % (default 0.25)' },
        listingFee: { type: 'number', description: 'Listing fee per item (default 0.20)' },
        offsiteAdsPct: { type: 'number', description: 'Off-site ads fee % (0 or 12, default 0)' },
      },
      required: ['price'],
    },
  },
  {
    name: 'ebay_fee_calculator',
    description: `Calculate eBay seller fees for a listing. Supports US (12.9%), UK (12.8%), DE (11.7%), CA (12.9%), AU (12.9%) markets. Also supports tiered rate: 12.9% on first $7,500 + 2.35% on the amount above $7,500 per order. Returns final value fee, fixed fee, total fees, net revenue, and effective fee rate.

Input: price (required), shipping (default 0), fvRate (final value % by market, default 12.9), fixedFee (per-order fee, default 0.30), currency (USD/GBP/EUR/CAD/AUD, default USD), tiered (boolean, default false).`,
    inputSchema: {
      type: 'object',
      properties: {
        price: { type: 'number', description: 'Item selling price' },
        shipping: { type: 'number', description: 'Shipping charge (default 0)' },
        fvRate: { type: 'number', description: 'Final value fee % (default 12.9)' },
        fixedFee: { type: 'number', description: 'Fixed per-order fee (default 0.30)' },
        currency: { type: 'string', description: 'Currency code: USD/GBP/EUR/CAD/AUD (default USD)' },
        tiered: { type: 'boolean', description: 'Use tiered rate (>7500 USD, default false)' },
      },
      required: ['price'],
    },
  },
  {
    name: 'stripe_fee_calculator',
    description: `Calculate Stripe payment processing fees for a given charge amount. Returns the fee, net amount received, and effective fee rate. Optionally calculates the gross amount needed to achieve a target net after fees.

Default: US Domestic Cards at 2.9% + $0.30 per transaction. Supports custom percent and flat fee for international/non-US markets.

Input: amount (required, the charged amount), percent (default 2.9), flatFee (default 0.30), currency (default USD), targetNet (optional — if provided, calculates how much to charge to receive that net).`,
    inputSchema: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'Transaction amount in the currency specified' },
        percent: { type: 'number', description: 'Percentage fee (default 2.9)' },
        flatFee: { type: 'number', description: 'Flat fee per transaction (default 0.30)' },
        currency: { type: 'string', description: 'Currency code (default USD)' },
        targetNet: { type: 'number', description: 'Optional: calculate the amount needed to receive this net after fees' },
      },
      required: ['amount'],
    },
  },
  {
    name: 'platform_fee_comparison',
    description: `Compare seller fees across Etsy, eBay, Stripe, PayPal, and Shopify side-by-side. Input a price and shipping, get each platform's total fees, net revenue, effective fee rate, and a recommendation of which platform yields the highest net. Useful for multi-platform sellers deciding where to list.

Input: price (required), shipping (default 0), quantity (default 1), platform (optional: 'all', 'etsy', 'ebay', 'stripe', 'paypal', 'shopify' — default 'all').`,
    inputSchema: {
      type: 'object',
      properties: {
        price: { type: 'number', description: 'Item selling price in USD' },
        shipping: { type: 'number', description: 'Shipping charge (default 0)' },
        quantity: { type: 'number', description: 'Quantity (default 1)' },
        platform: { type: 'string', description: "'all' or one of etsy/ebay/stripe/paypal/shopify" },
      },
      required: ['price'],
    },
  },
  {
    name: 'profit_margin_calculator',
    description: `Calculate gross profit, net profit, margin, and markup from cost and selling price. Useful for any e-commerce seller to understand true profitability after platform fees.

Input: cost (required, your cost of goods), sellingPrice (required), platformFees (optional flat platform fee deducted from profit).`,
    inputSchema: {
      type: 'object',
      properties: {
        cost: { type: 'number', description: 'Your cost for the item' },
        sellingPrice: { type: 'number', description: 'Selling price to the buyer' },
        platformFees: { type: 'number', description: 'Optional flat platform fee to deduct (default 0)' },
      },
      required: ['cost', 'sellingPrice'],
    },
  },
];

// ─── Handlers ──────────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      case 'etsy_fee_calculator':
        result = etsyFeeCalc(args || {});
        break;
      case 'ebay_fee_calculator':
        result = ebayFeeCalc(args || {});
        break;
      case 'stripe_fee_calculator':
        result = stripeFeeCalc(args || {});
        break;
      case 'platform_fee_comparison':
        result = platformComparison(args || {});
        break;
      case 'profit_margin_calculator':
        result = profitCalc(args || {});
        break;
      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error: ${err.message}` }],
      isError: true,
    };
  }
});

// ─── Start ─────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
server.connect(transport).catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
