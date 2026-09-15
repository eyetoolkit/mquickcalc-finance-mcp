/**
 * mQuickCalc Finance MCP Server — v3 (14 tools, market-validated)
 * Prioritizes: fee calculators + profit/sell decisions + platform comparison
 * Dropped: low-frequency platforms (Kickstarter, Patreon, Booking, Twitch) + redundant tools
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const r2 = n => Math.round(n * 100) / 100;
const r1 = n => Math.round(n * 10) / 10;

const pos = (v, name) => { const n = parseFloat(v); if (isNaN(n) || n < 0) throw new Error(`${name} must be positive`); return n; };

// ─── Core Fee Tools ────────────────────────────────────────────────────────

function etsyFee({ itemPrice, shippingFee = 0, country = 'usa' }) {
  const p = pos(itemPrice, 'itemPrice'); const s = parseFloat(shippingFee) || 0; const total = p + s;
  const txFee = total * 0.065; const payFee = total * 0.0325 + 0.25;
  const regFee = country === 'eu' ? total * 0.02 : 0;
  const totalFees = txFee + payFee + regFee + 0.20;
  return { itemPrice: r2(p), shippingFee: r2(s), totalSale: r2(total), fees: { transaction: r2(txFee), paymentProcessing: r2(payFee), regulatory: r2(regFee), listing: 0.20 }, totalFees: r2(totalFees), netRevenue: r2(total - totalFees), feePercent: r2((totalFees / total) * 100) };
}

function ebayFee({ itemPrice, shipping = 0, market = 'us' }) {
  const p = pos(itemPrice, 'itemPrice'); const s = parseFloat(shipping) || 0;
  const rates = { us: 0.1325, uk: 0.125, de: 0.1149, ca: 0.13, au: 0.1325 };
  const rate = rates[market] || 0.1325;
  const fvf = p * rate; const payFee = s > 0 ? Math.min(s, 10) * 0.10 : 0;
  const totalFees = r2(fvf + payFee + 0.35);
  return { itemPrice: r2(p), shipping: r2(s), market, totalSale: r2(p + s), fees: { finalValue: r2(fvf), paymentProcessing: 0.35, shippingHandling: r2(payFee) }, totalFees, netRevenue: r2(p + s - totalFees), feePercent: r2((totalFees / (p + s)) * 100) };
}

function paypalFee({ amount, isMicropayment = false }) {
  const a = pos(amount, 'amount');
  const fee = a * (isMicropayment ? 0.049 : 0.0299) + (isMicropayment ? 0.05 : 0.30);
  return { amount: r2(a), paypalFee: r2(fee), netAmount: r2(a - fee), feePercent: r2((fee / a) * 100), isMicropayment };
}

function stripeFee({ amount, type = 'domestic' }) {
  const a = pos(amount, 'amount');
  const rates = { domestic: 0.029, international: 0.039 };
  const rate = rates[type] || 0.029;
  const fee = a * rate + 0.30;
  return { amount: r2(a), stripeFee: r2(fee), netAmount: r2(a - fee), type, feePercent: r2((fee / a) * 100) };
}

function shopifyFee({ plan = 'basic', monthlySales = 0 }) {
  const plans = { basic: 29, shopify: 79, advanced: 299 };
  const transFee = { basic: 0.0325, shopify: 0.0295, advanced: 0.0265 };
  const base = plans[plan] || 29; const tf = transFee[plan] || 0.0325;
  return { plan, baseFee: base, transactionFeePercent: r2(tf * 100), estimatedTransFees: r2(monthlySales * tf), totalMonthly: r2(base + monthlySales * tf) };
}

// ─── Profit & Pricing ─────────────────────────────────────────────────────

function discountCalc({ originalPrice, discountPercent }) {
  const p = pos(originalPrice, 'originalPrice'); const d = Math.min(Math.max(parseFloat(discountPercent), 0), 100);
  return { originalPrice: r2(p), discountPercent: d + '%', amountSaved: r2(p * d / 100), finalPrice: r2(p * (1 - d / 100)) };
}

function markupMarginCalc({ cost, markupPercent }) {
  const c = pos(cost, 'cost'); const m = parseFloat(markupPercent) / 100;
  return { cost: r2(c), markupPercent: parseFloat(markupPercent) + '%', sellingPrice: r2(c * (1 + m)), profit: r2(c * m), marginPercent: r2(m * 100) + '%' };
}

function profitMarginCalc({ revenue, cost }) {
  const r = pos(revenue, 'revenue'); const c = pos(cost, 'cost');
  const profit = r - c; const margin = r > 0 ? profit / r : 0;
  return { revenue: r2(r), cost: r2(c), grossProfit: r2(profit), profitMarginPercent: r2(margin * 100) + '%', isProfitable: profit > 0 };
}

function breakEvenCalc({ fixedCosts, pricePerUnit, variableCostPerUnit, targetProfit = 0 }) {
  const f = pos(fixedCosts, 'fixedCosts'); const p = pos(pricePerUnit, 'pricePerUnit'); const v = parseFloat(variableCostPerUnit) || 0;
  const contrib = p - v;
  if (contrib <= 0) return { error: 'Price must exceed variable cost' };
  const units = Math.ceil(f / contrib);
  return { fixedCosts: r2(f), pricePerUnit: r2(p), variableCostPerUnit: r2(v), contributionMargin: r2(contrib), breakEvenUnits: units, breakEvenRevenue: r2(units * p), targetProfitUnits: targetProfit > 0 ? Math.ceil((f + targetProfit) / contrib) : null };
}

// ─── Loans / Savings ───────────────────────────────────────────────────────

function compoundInterest({ principal, annualRate, years, monthlyContribution = 0, compoundFreq = 12 }) {
  const P = pos(principal, 'principal'); const r = parseFloat(annualRate) / 100; const y = pos(years, 'years');
  const n = Math.max(1, parseInt(compoundFreq)); const contrib = parseFloat(monthlyContribution) || 0;
  const base = P * Math.pow(1 + r / n, n * y);
  const futureContrib = contrib > 0 ? contrib * ((Math.pow(1 + r / n, n * y) - 1) / (r / n)) : 0;
  const total = base + futureContrib; const totalContrib = P + contrib * n * y;
  return { principal: r2(P), annualRate: parseFloat(annualRate) + '%', years: r2(y), futureValue: r2(total), totalContributed: r2(totalContrib), totalInterest: r2(total - totalContrib) };
}

function loanCalc({ principal, annualRate, years }) {
  const P = pos(principal, 'principal'); const r = parseFloat(annualRate) / 100 / 12;
  const n = Math.max(1, parseInt(years) * 12);
  const factor = Math.pow(1 + r, n);
  const monthly = r === 0 ? P / n : (P * r * factor) / (factor - 1);
  const total = monthly * n;
  return { principal: r2(P), annualRate: parseFloat(annualRate) + '%', years, monthlyPayment: r2(monthly), totalPayment: r2(total), totalInterest: r2(total - P) };
}

function mortgageCalc({ homePrice, downPayment = 20, years = 30, annualRate = 6.5 }) {
  const price = pos(homePrice, 'homePrice'); const down = price * (parseFloat(downPayment) / 100);
  const P = price - down; const r = parseFloat(annualRate) / 100 / 12;
  const n = Math.max(1, parseInt(years) * 12); const factor = Math.pow(1 + r, n);
  const monthly = r === 0 ? P / n : (P * r * factor) / (factor - 1);
  const total = monthly * n;
  return { homePrice: r2(price), downPaymentPercent: parseFloat(downPayment) + '%', loanPrincipal: r2(P), annualRate: parseFloat(annualRate) + '%', monthlyPayment: r2(monthly), totalPayment: r2(total), totalInterest: r2(total - P), totalCost: r2(total + down) };
}

function salesTaxCalc({ price, taxRate = 8 }) {
  const p = pos(price, 'price'); const r = parseFloat(taxRate) / 100;
  return { price: r2(p), taxRate: parseFloat(taxRate) + '%', taxAmount: r2(p * r), totalPrice: r2(p * (1 + r)) };
}

// ─── Platform Comparison ──────────────────────────────────────────────────

function platformComparison({ itemPrice, shippingFee = 0 }) {
  const p = pos(itemPrice, 'itemPrice'); const s = parseFloat(shippingFee) || 0; const total = p + s;
  const etsy = total * 0.065 + total * 0.0325 + 0.25 + 0.20;
  const ebay = p * 0.1325 + (s > 0 ? Math.min(s, 10) * 0.10 : 0) + 0.35;
  const paypal = total * 0.0299 + 0.30;
  const net = { etsy: total - etsy, ebay: total - ebay, paypal: total - paypal };
  const best = Object.entries(net).sort((a, b) => b[1] - a[1])[0];
  return { itemPrice: r2(p), totalSale: r2(total), netRevenue: { etsy: r2(net.etsy), ebay: r2(net.ebay), paypal: r2(net.paypal) }, bestPlatform: best[0], bestNet: r2(best[1]) };
}

// ─── MCP ─────────────────────────────────────────────────────────────────

const TOOLS = [
  { name: 'etsy_fee_calculator', description: 'Calculate Etsy fees: transaction (6.5%) + payment processing (3.25%+$0.25) + listing ($0.20). EU adds 2% regulatory fee.', inputSchema: { type: 'object', properties: { itemPrice: { type: 'number' }, shippingFee: { type: 'number' }, country: { type: 'string', enum: ['usa', 'eu'] } }, required: ['itemPrice'] } },
  { name: 'ebay_fee_calculator', description: 'Calculate eBay fees for US/UK/DE/CA/AU markets. Final value fee + payment processing $0.35.', inputSchema: { type: 'object', properties: { itemPrice: { type: 'number' }, shipping: { type: 'number' }, market: { type: 'string', enum: ['us', 'uk', 'de', 'ca', 'au'] } }, required: ['itemPrice'] } },
  { name: 'paypal_fee_calculator', description: 'PayPal fee: domestic 2.99%+$0.30, micropayment 4.99%+$0.05.', inputSchema: { type: 'object', properties: { amount: { type: 'number' }, isMicropayment: { type: 'boolean' } }, required: ['amount'] } },
  { name: 'stripe_fee_calculator', description: 'Stripe domestic 2.9%+$0.30, international 3.9%+$0.30.', inputSchema: { type: 'object', properties: { amount: { type: 'number' }, type: { type: 'string', enum: ['domestic', 'international'] } }, required: ['amount'] } },
  { name: 'shopify_fee_calculator', description: 'Shopify monthly fee: Basic $29 / Shopify $79 / Advanced $299 + per-transaction fees (3.25%/2.95%/2.65%).', inputSchema: { type: 'object', properties: { plan: { type: 'string', enum: ['basic', 'shopify', 'advanced'] }, monthlySales: { type: 'number' } }, required: ['plan'] } },
  { name: 'discount_calculator', description: 'Calculate final price and savings from discount %. Input: originalPrice, discountPercent.', inputSchema: { type: 'object', properties: { originalPrice: { type: 'number' }, discountPercent: { type: 'number' } }, required: ['originalPrice', 'discountPercent'] } },
  { name: 'markup_margin_calculator', description: 'Calculate selling price and margin from cost + markup %. Input: cost, markupPercent.', inputSchema: { type: 'object', properties: { cost: { type: 'number' }, markupPercent: { type: 'number' } }, required: ['cost', 'markupPercent'] } },
  { name: 'profit_margin_calculator', description: 'Calculate gross profit and profit margin % from revenue and cost.', inputSchema: { type: 'object', properties: { revenue: { type: 'number' }, cost: { type: 'number' } }, required: ['revenue', 'cost'] } },
  { name: 'break_even_calculator', description: 'Calculate break-even point in units. Input: fixedCosts, pricePerUnit, variableCostPerUnit, targetProfit (optional).', inputSchema: { type: 'object', properties: { fixedCosts: { type: 'number' }, pricePerUnit: { type: 'number' }, variableCostPerUnit: { type: 'number' }, targetProfit: { type: 'number' } }, required: ['fixedCosts', 'pricePerUnit'] } },
  { name: 'compound_interest_calculator', description: 'Compound interest with optional monthly contributions. Input: principal, annualRate (%), years, monthlyContribution, compoundFreq (default 12).', inputSchema: { type: 'object', properties: { principal: { type: 'number' }, annualRate: { type: 'number' }, years: { type: 'number' }, monthlyContribution: { type: 'number' }, compoundFreq: { type: 'number' } }, required: ['principal', 'annualRate', 'years'] } },
  { name: 'loan_calculator', description: 'Fixed-rate loan monthly payment. Input: principal, annualRate (%), years.', inputSchema: { type: 'object', properties: { principal: { type: 'number' }, annualRate: { type: 'number' }, years: { type: 'number' } }, required: ['principal', 'annualRate', 'years'] } },
  { name: 'mortgage_calculator', description: 'Monthly mortgage payment. Input: homePrice, downPayment (%) default 20, years default 30, annualRate (%) default 6.5.', inputSchema: { type: 'object', properties: { homePrice: { type: 'number' }, downPayment: { type: 'number' }, years: { type: 'number' }, annualRate: { type: 'number' } }, required: ['homePrice'] } },
  { name: 'sales_tax_calculator', description: 'Add sales tax to a price. Input: price, taxRate (%) default 8.', inputSchema: { type: 'object', properties: { price: { type: 'number' }, taxRate: { type: 'number' } }, required: ['price'] } },
  { name: 'platform_fee_comparison', description: 'Compare net revenue on Etsy, eBay, and PayPal for a given sale. Input: itemPrice, shippingFee (optional).', inputSchema: { type: 'object', properties: { itemPrice: { type: 'number' }, shippingFee: { type: 'number' } }, required: ['itemPrice'] } },
];

const server = new Server({ name: 'mquickcalc-finance-mcp', version: '3.0.0' }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
server.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
  const { name, arguments: args = {} } = params;
  const fns = {
    etsy_fee_calculator: () => etsyFee(args), ebay_fee_calculator: () => ebayFee(args),
    paypal_fee_calculator: () => paypalFee(args), stripe_fee_calculator: () => stripeFee(args),
    shopify_fee_calculator: () => shopifyFee(args), discount_calculator: () => discountCalc(args),
    markup_margin_calculator: () => markupMarginCalc(args), profit_margin_calculator: () => profitMarginCalc(args),
    break_even_calculator: () => breakEvenCalc(args), compound_interest_calculator: () => compoundInterest(args),
    loan_calculator: () => loanCalc(args), mortgage_calculator: () => mortgageCalc(args),
    sales_tax_calculator: () => salesTaxCalc(args), platform_fee_comparison: () => platformComparison(args),
  };
  const fn = fns[name];
  if (!fn) return { content: [{ type: 'text', text: `Unknown: ${name}` }], isError: true };
  try { return { content: [{ type: 'text', text: JSON.stringify(fn(), null, 2) }] }; }
  catch (e) { return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true }; }
});
const transport = new StdioServerTransport();
server.connect(transport).catch(e => { console.error(e); process.exit(1); });
