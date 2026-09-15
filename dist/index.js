/**
 * mQuickCalc Finance MCP Server — v2 (17 tools)
 * Covers: fee calculators, loan/mortgage, savings, tax, profit tools
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

function requirePositive(value, name) {
  const n = parseFloat(value);
  if (isNaN(n) || n < 0) throw new Error(`${name} must be a positive number`);
  return n;
}
function round2(n) { return Math.round(n * 100) / 100; }
function round1(n) { return Math.round(n * 10) / 10; }

// ─── Fee Calculators ───────────────────────────────────────────────────────

function etsyFeeCalc({ itemPrice, shippingFee = 0, country = 'usa' }) {
  const p = requirePositive(itemPrice, 'itemPrice');
  const s = parseFloat(shippingFee) || 0;
  const total = p + s;
  const txFee = total * (country === 'eu' ? 0.065 : 0.065);
  const paymentFee = total * 0.0325 + 0.25;
  const regFee = country === 'eu' ? total * 0.02 : 0;
  const listingFee = 0.20;
  const totalFees = txFee + paymentFee + regFee + listingFee;
  const netRevenue = total - totalFees;
  return {
    itemPrice: round2(p), shippingFee: round2(s), totalSale: round2(total),
    fees: { transaction: round2(txFee), paymentProcessing: round2(paymentFee), regulatory: round2(regFee), listing: listingFee },
    totalFees: round2(totalFees), netRevenue: round2(netRevenue),
    feePercent: round2((totalFees / total) * 100),
    country,
  };
}

function ebayFeeCalc({ itemPrice, shipping = 0, market = 'us', category = 'electronics' }) {
  const p = requirePositive(itemPrice, 'itemPrice');
  const s = parseFloat(shipping) || 0;
  const rates = { us: 0.1325, uk: 0.125, de: 0.1149, ca: 0.13, au: 0.1325 };
  const rate = rates[market] || 0.1325;
  const subscrRate = category === 'business' ? rate - 0.02 : rate;
  const finalValue = p * subscrRate + (s > 0 ? Math.min(s, 10) * 0.10 : 0);
  const netRevenue = p + s - finalValue - 0.35;
  return {
    itemPrice: round2(p), shipping: round2(s), market,
    fees: { finalValue: round2(finalValue), paymentProcessing: 0.35 },
    totalFees: round2(finalValue + 0.35),
    netRevenue: round2(netRevenue), feePercent: round2(((finalValue + 0.35) / (p + s)) * 100),
    market,
  };
}

function paypalFeeCalc({ amount, feePercent = 2.99, fixedFee = 0.30, isMicropayment = false }) {
  const a = requirePositive(amount, 'amount');
  const fp = isMicropayment ? 0.049 : parseFloat(feePercent) / 100;
  const ff = isMicropayment ? 0.05 : parseFloat(fixedFee);
  const fee = a * fp + ff;
  return { amount: round2(a), grossAmount: round2(a), paypalFee: round2(fee), netAmount: round2(a - fee), feePercent: round2((fee / a) * 100) };
}

function stripeFeeCalc({ amount, type = 'domestic' }) {
  const a = requirePositive(amount, 'amount');
  const rates = { domestic: 0.029, international: 0.039, currencyConversion: 0.0075 };
  const rate = rates[type] || 0.029;
  const fee = a * rate + 0.30;
  return { amount: round2(a), stripeFee: round2(fee), netAmount: round2(a - fee), type, feePercent: round2((fee / a) * 100) };
}

function gumroadFeeCalc({ amount }) {
  const a = requirePositive(amount, 'amount');
  const fee = amount >= 10 ? a * 0.10 : a * 0.115 + 0.30;
  return { amount: round2(a), gumroadFee: round2(fee), netAmount: round2(a - fee), feePercent: round2((fee / a) * 100) };
}

function shopifyFeeCalc({ plan = 'basic', salesMonthly = 0 }) {
  const plans = { basic: 29, shopify: 79, advanced: 299 };
  const baseFee = plans[plan] || 29;
  const transFee = plan === 'basic' ? 0.0325 : plan === 'shopify' ? 0.0295 : 0.0265;
  const transFees = salesMonthly * transFee;
  return { plan, baseFee, transactionFeePercent: round2(transFee * 100), estimatedTransactionFees: round2(transFees), totalMonthly: round2(baseFee + transFees) };
}

function airbnbFeeCalc({ nightlyRate, guests = 1, hostCity = 'usa' }) {
  const r = requirePositive(nightlyRate, 'nightlyRate');
  const hostFeePct = hostCity === 'eu' ? 0.03 : 0.03;
  const hostFee = r * hostFeePct;
  const cleanFee = 30 + guests * 5;
  const netPerNight = r - hostFee + cleanFee;
  return { nightlyRate: round2(r), guests, hostFee: round2(hostFee), cleanFee, grossHostEarnings: round2(r + cleanFee - hostFee), netPerNight: round2(netPerNight) };
}

function kickstarterFeeCalc({ pledgedAmount, category = 'games' }) {
  const a = requirePositive(pledgedAmount, 'pledgedAmount');
  const platformFee = a * (category === 'film' ? 0.05 : 0.05);
  const paymentFee = a * 0.03 + 0.20;
  const totalFees = platformFee + paymentFee;
  return { pledgedAmount: round2(a), platformFee: round2(platformFee), paymentProcessingFee: round2(paymentFee), totalFees: round2(totalFees), netAmount: round2(a - totalFees) };
}

function patreonFeeCalc({ monthlyEarnings }) {
  const a = requirePositive(monthlyEarnings, 'monthlyEarnings');
  const fees = a >= 0 ? a * 0.08 + 0.05 : 0;
  return { monthlyEarnings: round2(a), patreonFee: round2(fees), netAmount: round2(a - fees), feePercent: 8 + (0.05 / a * 100) };
}

function bookingFeeCalc({ listingPrice, nights, platform = 'airbnb' }) {
  const p = requirePositive(listingPrice, 'listingPrice');
  const n = Math.max(1, parseInt(nights));
  const serviceFee = p * (platform === 'airbnb' ? 0.14 : platform === 'vrbo' ? 0.12 : 0.12);
  const hostFee = p * (platform === 'airbnb' ? 0.03 : 0);
  const gross = p * n;
  const totalFees = (serviceFee + hostFee) * n;
  return { nightlyRate: round2(p), nights: n, serviceFeePercent: platform === 'airbnb' ? 14 : 12, hostFeePercent: platform === 'airbnb' ? 3 : 0, totalFees: round2(totalFees), netEarnings: round2(gross - totalFees) };
}

function poshmarkFeeCalc({ sellingPrice }) {
  const p = requirePositive(sellingPrice, 'sellingPrice');
  const fee = p >= 15 ? Math.min(p * 0.20, 14.95) : p * 0.03 + 0.99;
  return { sellingPrice: round2(p), poshmarkFee: round2(fee), netAmount: round2(p - fee), feePercent: round2((fee / p) * 100) };
}

function twitchBitsFeeCalc({ bits }) {
  const b = requirePositive(bits, 'bits');
  const usd = b * 0.01;
  return { bits: round2(b), usd: round2(usd), grossPerBit: '$0.01', feePercent: 0 };
}

function twitchSubRevCalc({ subTier = 1, subCount = 0 }) {
  const tiers = { 1: 2.50, 2: 5.00, 3: 12.50 };
  const rev = (tiers[subTier] || 2.50) * Math.max(0, subCount);
  return { tier: subTier, subs: Math.max(0, subCount), grossRevenue: round2(rev), netAfterTwitch: round2(rev * 0.50), note: 'Twitch retains 50% of subscriptions above 100' };
}

function vatCalc({ netAmount, vatRate = 20 }) {
  const n = requirePositive(netAmount, 'netAmount');
  const r = parseFloat(vatRate) / 100;
  const vat = n * r;
  return { netAmount: round2(n), vatRate: parseFloat(vatRate) + '%', vatAmount: round2(vat), grossAmount: round2(n + vat) };
}

function salesTaxCalc({ price, taxRate = 8 }) {
  const p = requirePositive(price, 'price');
  const r = parseFloat(taxRate) / 100;
  const tax = p * r;
  return { price: round2(p), taxRate: parseFloat(taxRate) + '%', taxAmount: round2(tax), totalPrice: round2(p + tax) };
}

// ─── Finance / Math Tools ─────────────────────────────────────────────────

function compoundInterestCalc({ principal, annualRate, years, compoundFreq = 12, monthlyContribution = 0 }) {
  const P = requirePositive(principal, 'principal');
  const r = parseFloat(annualRate) / 100;
  const y = requirePositive(years, 'years');
  const n = Math.max(1, parseInt(compoundFreq));
  const contrib = parseFloat(monthlyContribution) || 0;
  const base = P * Math.pow(1 + r / n, n * y);
  const futureValue = base + (contrib > 0 ? contrib * ((Math.pow(1 + r / n, n * y) - 1) / (r / n)) : 0);
  const totalContrib = P + contrib * n * y;
  return {
    principal: round2(P), annualRate: parseFloat(annualRate) + '%', years: round2(y),
    futureValue: round2(futureValue), totalContributed: round2(totalContrib),
    totalInterest: round2(futureValue - totalContrib),
    effectiveAnnualRate: round2((Math.pow(1 + r / n, n) - 1) * 100) + '%',
  };
}

function simpleInterestCalc({ principal, annualRate, years }) {
  const P = requirePositive(principal, 'principal');
  const r = parseFloat(annualRate) / 100;
  const y = requirePositive(years, 'years');
  const interest = P * r * y;
  return { principal: round2(P), annualRate: parseFloat(annualRate) + '%', years: round2(y), simpleInterest: round2(interest), totalAmount: round2(P + interest) };
}

function loanCalc({ principal, annualRate, years }) {
  const P = requirePositive(principal, 'principal');
  const r = parseFloat(annualRate) / 100 / 12;
  const n = Math.max(1, parseInt(years) * 12);
  const factor = Math.pow(1 + r, n);
  const monthly = r === 0 ? P / n : (P * r * factor) / (factor - 1);
  const total = monthly * n;
  return { principal: round2(P), annualRate: parseFloat(annualRate) + '%', years, monthlyPayment: round2(monthly), totalPayment: round2(total), totalInterest: round2(total - P) };
}

function mortgageCalc({ homePrice, downPayment = 20, years = 30, annualRate = 6.5 }) {
  const price = requirePositive(homePrice, 'homePrice');
  const down = price * (parseFloat(downPayment) / 100);
  const P = price - down;
  const r = parseFloat(annualRate) / 100 / 12;
  const n = Math.max(1, parseInt(years) * 12);
  const factor = Math.pow(1 + r, n);
  const monthly = r === 0 ? P / n : (P * r * factor) / (factor - 1);
  const total = monthly * n;
  return {
    homePrice: round2(price), downPaymentPercent: parseFloat(downPayment) + '%', downPaymentAmount: round2(down),
    loanPrincipal: round2(P), annualRate: parseFloat(annualRate) + '%', years,
    monthlyPayment: round2(monthly), totalPayment: round2(total), totalInterest: round2(total - P),
    totalCost: round2(total + down),
  };
}

function autoLoanCalc({ vehiclePrice, downPayment = 0, tradeIn = 0, years = 5, annualRate = 7 }) {
  const price = requirePositive(vehiclePrice, 'vehiclePrice');
  const P = price - parseFloat(downPayment) - parseFloat(tradeIn);
  if (P <= 0) return { message: 'Down payment + trade-in exceeds vehicle price', loanPrincipal: 0 };
  const r = parseFloat(annualRate) / 100 / 12;
  const n = Math.max(1, parseInt(years) * 12);
  const factor = Math.pow(1 + r, n);
  const monthly = r === 0 ? P / n : (P * r * factor) / (factor - 1);
  return { vehiclePrice: round2(price), downPayment: round2(parseFloat(downPayment)), tradeIn: round2(parseFloat(tradeIn)), loanPrincipal: round2(P), annualRate: parseFloat(annualRate) + '%', years, monthlyPayment: round2(monthly), totalInterest: round2(monthly * n - P) };
}

function savingsCalc({ initialDeposit, monthlyDeposit = 0, annualRate = 5, years = 5 }) {
  const P = requirePositive(initialDeposit, 'initialDeposit');
  const r = parseFloat(annualRate) / 100 / 12;
  const n = Math.max(1, parseInt(years) * 12);
  const contrib = parseFloat(monthlyDeposit) || 0;
  const base = P * Math.pow(1 + r, n);
  const futureContrib = contrib > 0 ? contrib * ((Math.pow(1 + r, n) - 1) / r) : 0;
  const totalSaved = P + contrib * n;
  return { initialDeposit: round2(P), monthlyDeposit: round2(contrib), annualRate: parseFloat(annualRate) + '%', years, totalSaved: round2(totalSaved), futureValue: round2(base + futureContrib), totalInterest: round2(base + futureContrib - totalSaved) };
}

function breakEvenCalc({ fixedCosts, pricePerUnit, variableCostPerUnit, targetProfit = 0 }) {
  const f = requirePositive(fixedCosts, 'fixedCosts');
  const p = requirePositive(pricePerUnit, 'pricePerUnit');
  const v = parseFloat(variableCostPerUnit) || 0;
  const contrib = p - v;
  if (contrib <= 0) return { message: 'Price must exceed variable cost per unit', contributionMargin: 0 };
  const units = Math.ceil(f / contrib);
  const targetUnits = targetProfit > 0 ? Math.ceil((f + targetProfit) / contrib) : null;
  return { fixedCosts: round2(f), pricePerUnit: round2(p), variableCostPerUnit: round2(v), contributionMargin: round2(contrib), breakEvenUnits: units, breakEvenRevenue: round2(units * p), targetProfitUnits: targetUnits, targetProfitRevenue: targetUnits ? round2(targetUnits * p) : null };
}

function discountCalc({ originalPrice, discountPercent }) {
  const p = requirePositive(originalPrice, 'originalPrice');
  const d = Math.min(Math.max(parseFloat(discountPercent), 0), 100);
  const savings = p * (d / 100);
  const final = p - savings;
  return { originalPrice: round2(p), discountPercent: d + '%', amountSaved: round2(savings), finalPrice: round2(final) };
}

function markupMarginCalc({ cost, markupPercent }) {
  const c = requirePositive(cost, 'cost');
  const m = parseFloat(markupPercent) / 100;
  const price = c * (1 + m);
  const margin = m;
  return { cost: round2(c), markupPercent: parseFloat(markupPercent) + '%', sellingPrice: round2(price), markupAmount: round2(c * m), grossProfit: round2(c * m), marginPercent: round2(margin * 100) + '%' };
}

function profitMarginCalc({ revenue, cost }) {
  const r = requirePositive(revenue, 'revenue');
  const c = requirePositive(cost, 'cost');
  const profit = r - c;
  const margin = r > 0 ? profit / r : 0;
  const markup = c > 0 ? profit / c : 0;
  return { revenue: round2(r), cost: round2(c), grossProfit: round2(profit), profitMarginPercent: round2(margin * 100) + '%', markupPercent: round2(markup * 100) + '%', isProfitable: profit > 0 };
}

function hourlyToSalaryCalc({ hourlyRate, hoursPerWeek = 40, weeksPerYear = 50 }) {
  const r = requirePositive(hourlyRate, 'hourlyRate');
  const h = Math.max(1, parseInt(hoursPerWeek));
  const w = Math.max(1, parseInt(weeksPerYear));
  const weekly = r * h;
  const annual = weekly * w;
  const monthly = annual / 12;
  return { hourlyRate: round2(r), hoursPerWeek: h, weeksPerYear: w, weeklySalary: round2(weekly), monthlySalary: round2(monthly), annualSalary: round2(annual) };
}

function freelanceRateCalc({ hourlyRate, monthlyHours = 160, billablePercent = 70, expenses = 0 }) {
  const r = requirePositive(hourlyRate, 'hourlyRate');
  const h = Math.max(1, parseInt(monthlyHours));
  const b = Math.min(Math.max(parseFloat(billablePercent), 0), 100) / 100;
  const e = parseFloat(expenses) || 0;
  const gross = r * h;
  const billable = gross * b;
  const net = billable - e;
  return { hourlyRate: round2(r), monthlyHours: h, billablePercent: round2(b * 100) + '%', grossMonthly: round2(gross), billableMonthly: round2(billable), expenses: round2(e), netMonthly: round2(net), annualGross: round2(billable * 12) };
}

function retirementCalc({ currentAge = 30, retirementAge = 65, currentSavings = 0, monthlyContribution = 0, annualReturn = 7 }) {
  const cAge = parseInt(currentAge) || 30;
  const rAge = parseInt(retirementAge) || 65;
  const years = Math.max(1, rAge - cAge);
  const P = parseFloat(currentSavings) || 0;
  const contrib = parseFloat(monthlyContribution) || 0;
  const r = parseFloat(annualReturn) / 100 / 12;
  const n = years * 12;
  const base = P * Math.pow(1 + r, n);
  const futureContrib = contrib > 0 ? contrib * ((Math.pow(1 + r, n) - 1) / r) : 0;
  return { currentAge: cAge, retirementAge: rAge, yearsToRetirement: years, currentSavings: round2(P), monthlyContribution: round2(contrib), annualReturn: parseFloat(annualReturn) + '%', projectedSavings: round2(base + futureContrib), totalContributed: round2(P + contrib * n) };
}

function refinanceCalc({ currentBalance, currentRate, newRate, years }) {
  const b = requirePositive(currentBalance, 'currentBalance');
  const cr = parseFloat(currentRate) / 100 / 12;
  const nr = parseFloat(newRate) / 100 / 12;
  const n = Math.max(1, parseInt(years)) * 12;
  const factor = Math.pow(1 + nr, n);
  const newMonthly = nr === 0 ? b / n : (b * nr * factor) / (factor - 1);
  const currentMonthly = cr > 0 ? (b * cr * Math.pow(1 + cr, n)) / (Math.pow(1 + cr, n) - 1) : b / n;
  const savings = (currentMonthly - newMonthly) * n;
  return { currentBalance: round2(b), currentRate: parseFloat(currentRate) + '%', newRate: parseFloat(newRate) + '%', years, newMonthlyPayment: round2(newMonthly), currentMonthlyPayment: round2(currentMonthly), monthlySavings: round2(Math.max(0, currentMonthly - newMonthly)), totalSavings: round2(Math.max(0, savings)), breakEvenMonths: savings > 0 ? Math.ceil((parseFloat(newRate) * b * 0.02) / (currentMonthly - newMonthly)) : null };
}

function salesCommissionCalc({ saleAmount, rate = 5, tier = 'standard' }) {
  const s = requirePositive(saleAmount, 'saleAmount');
  const r = parseFloat(rate) / 100;
  const base = s * r;
  const bonus = tier === 'premium' ? base * 0.5 : tier === 'volume' ? base * 0.3 : 0;
  return { saleAmount: round2(s), commissionRate: parseFloat(rate) + '%', baseCommission: round2(base), bonus: round2(bonus), totalCommission: round2(base + bonus), tier };
}

function platformComparison({ itemPrice, shippingFee = 0, market = 'usa', sellerLocation = 'usa' }) {
  const p = requirePositive(itemPrice, 'itemPrice');
  const s = parseFloat(shippingFee) || 0;
  const total = p + s;
  const etsy = total * 0.065 + total * 0.0325 + 0.25 + 0.20;
  const ebay = p * 0.1325 + (s > 0 ? Math.min(s, 10) * 0.10 : 0) + 0.35;
  const paypal = total * 0.029 + 0.30;
  const stripe = total * 0.029 + 0.30;
  const gumroad = total >= 10 ? total * 0.10 : total * 0.115 + 0.30;
  const netRevenue = { etsy: total - etsy, ebay: p + s - ebay, paypal: p + s - paypal, stripe: p + s - stripe, gumroad: p + s - gumroad };
  const best = Object.entries(netRevenue).sort((a, b) => b[1] - a[1])[0];
  return {
    itemPrice: round2(p), shippingFee: round2(s), totalSale: round2(total),
    netRevenue: { etsy: round2(netRevenue.etsy), ebay: round2(netRevenue.ebay), paypal: round2(netRevenue.paypal), stripe: round2(netRevenue.stripe), gumroad: round2(netRevenue.gumroad) },
    bestPlatform: best[0], bestNetRevenue: round2(best[1]),
    recommendation: best[0] + ' yields highest net for this sale',
  };
}

// ─── MCP Server ───────────────────────────────────────────────────────────

const TOOLS = [
  // Fee calculators
  { name: 'etsy_fee_calculator', description: 'Calculate Etsy fees: transaction, payment processing, regulatory, listing, and offsite ads fees for a given item price.', inputSchema: { type: 'object', properties: { itemPrice: { type: 'number' }, shippingFee: { type: 'number' }, country: { type: 'string', enum: ['usa', 'eu'] } }, required: ['itemPrice'] } },
  { name: 'ebay_fee_calculator', description: 'Calculate eBay fees for US/UK/DE/CA/AU markets. Includes final value fee and payment processing fee.', inputSchema: { type: 'object', properties: { itemPrice: { type: 'number' }, shipping: { type: 'number' }, market: { type: 'string', enum: ['us', 'uk', 'de', 'ca', 'au'] }, category: { type: 'string' } }, required: ['itemPrice'] } },
  { name: 'paypal_fee_calculator', description: 'Calculate PayPal fees for a given amount. Supports domestic (2.99%+$0.30) and micropayment (4.99%+$0.05) rates.', inputSchema: { type: 'object', properties: { amount: { type: 'number' }, feePercent: { type: 'number' }, fixedFee: { type: 'number' }, isMicropayment: { type: 'boolean' } }, required: ['amount'] } },
  { name: 'stripe_fee_calculator', description: 'Calculate Stripe payment processing fees. Domestic 2.9%+$0.30, international 3.9%+$0.30.', inputSchema: { type: 'object', properties: { amount: { type: 'number' }, type: { type: 'string', enum: ['domestic', 'international', 'currencyConversion'] } }, required: ['amount'] } },
  { name: 'gumroad_fee_calculator', description: 'Calculate Gumroad fees. Standard: 10% + $0.30. Under $10: 11.5% + $0.30.', inputSchema: { type: 'object', properties: { amount: { type: 'number' } }, required: ['amount'] } },
  { name: 'shopify_fee_calculator', description: 'Calculate Shopify monthly fees by plan (Basic $29, Shopify $79, Advanced $299) plus per-transaction fees.', inputSchema: { type: 'object', properties: { plan: { type: 'string', enum: ['basic', 'shopify', 'advanced'] }, salesMonthly: { type: 'number' } }, required: ['plan'] } },
  { name: 'airbnb_fee_calculator', description: 'Calculate Airbnb host fees and net earnings per night after host service fee (3%) and clean fee.', inputSchema: { type: 'object', properties: { nightlyRate: { type: 'number' }, guests: { type: 'number' }, hostCity: { type: 'string', enum: ['usa', 'eu'] } }, required: ['nightlyRate'] } },
  { name: 'kickstarter_fee_calculator', description: 'Calculate Kickstarter fees: 5% platform fee + 3% payment processing on pledged amount.', inputSchema: { type: 'object', properties: { pledgedAmount: { type: 'number' }, category: { type: 'string' } }, required: ['pledgedAmount'] } },
  { name: 'patreon_fee_calculator', description: 'Calculate Patreon earnings after 8% platform fee + $0.05 per transaction.', inputSchema: { type: 'object', properties: { monthlyEarnings: { type: 'number' } }, required: ['monthlyEarnings'] } },
  { name: 'booking_fee_calculator', description: 'Calculate vacation rental platform fees (Airbnb/VRBO) including host service fee and clean fee.', inputSchema: { type: 'object', properties: { listingPrice: { type: 'number' }, nights: { type: 'number' }, platform: { type: 'string', enum: ['airbnb', 'vrbo'] } }, required: ['listingPrice', 'nights'] } },
  { name: 'poshmark_fee_calculator', description: 'Calculate Poshmark seller fees. $15+ items: 20% (max $14.95). Under $15: 3% + $0.99.', inputSchema: { type: 'object', properties: { sellingPrice: { type: 'number' } }, required: ['sellingPrice'] } },
  { name: 'twitch_bits_to_usd', description: 'Convert Twitch bits to USD at $0.01 per bit (100 bits = $1).', inputSchema: { type: 'object', properties: { bits: { type: 'number' } }, required: ['bits'] } },
  { name: 'twitch_subscription_revenue', description: 'Calculate Twitch subscription revenue by tier: Tier 1=$2.50, Tier 2=$5, Tier 3=$12.50 (before Twitch 50% cut).', inputSchema: { type: 'object', properties: { subTier: { type: 'number', enum: [1, 2, 3] }, subCount: { type: 'number' } }, required: ['subTier'] } },
  { name: 'vat_calculator', description: 'Add VAT to a net amount. Specify VAT rate (default 20%).', inputSchema: { type: 'object', properties: { netAmount: { type: 'number' }, vatRate: { type: 'number' } }, required: ['netAmount'] } },
  { name: 'sales_tax_calculator', description: 'Calculate sales tax on a price. Specify tax rate as percentage (default 8%).', inputSchema: { type: 'object', properties: { price: { type: 'number' }, taxRate: { type: 'number' } }, required: ['price'] } },
  // Financial math
  { name: 'compound_interest_calculator', description: 'Calculate compound interest with monthly contributions. Returns future value, total contributed, and total interest earned.', inputSchema: { type: 'object', properties: { principal: { type: 'number' }, annualRate: { type: 'number' }, years: { type: 'number' }, compoundFreq: { type: 'number' }, monthlyContribution: { type: 'number' } }, required: ['principal', 'annualRate', 'years'] } },
  { name: 'simple_interest_calculator', description: 'Calculate simple interest: Principal × Rate × Years.', inputSchema: { type: 'object', properties: { principal: { type: 'number' }, annualRate: { type: 'number' }, years: { type: 'number' } }, required: ['principal', 'annualRate', 'years'] } },
  { name: 'loan_calculator', description: 'Calculate monthly payment and total cost for a fixed-rate loan (annual rate, years).', inputSchema: { type: 'object', properties: { principal: { type: 'number' }, annualRate: { type: 'number' }, years: { type: 'number' } }, required: ['principal', 'annualRate', 'years'] } },
  { name: 'mortgage_calculator', description: 'Calculate monthly mortgage payment including down payment, principal, interest, total payment, and total interest.', inputSchema: { type: 'object', properties: { homePrice: { type: 'number' }, downPayment: { type: 'number' }, years: { type: 'number' }, annualRate: { type: 'number' } }, required: ['homePrice'] } },
  { name: 'auto_loan_calculator', description: 'Calculate auto loan monthly payment. Input: vehicle price, down payment, trade-in value, years, annual rate.', inputSchema: { type: 'object', properties: { vehiclePrice: { type: 'number' }, downPayment: { type: 'number' }, tradeIn: { type: 'number' }, years: { type: 'number' }, annualRate: { type: 'number' } }, required: ['vehiclePrice'] } },
  { name: 'savings_calculator', description: 'Calculate savings growth with monthly deposits and annual interest rate.', inputSchema: { type: 'object', properties: { initialDeposit: { type: 'number' }, monthlyDeposit: { type: 'number' }, annualRate: { type: 'number' }, years: { type: 'number' } }, required: ['initialDeposit', 'annualRate', 'years'] } },
  { name: 'break_even_calculator', description: 'Calculate break-even point in units and revenue. Also calculates units needed for target profit.', inputSchema: { type: 'object', properties: { fixedCosts: { type: 'number' }, pricePerUnit: { type: 'number' }, variableCostPerUnit: { type: 'number' }, targetProfit: { type: 'number' } }, required: ['fixedCosts', 'pricePerUnit'] } },
  { name: 'discount_calculator', description: 'Calculate final price and savings from a discount percentage.', inputSchema: { type: 'object', properties: { originalPrice: { type: 'number' }, discountPercent: { type: 'number' } }, required: ['originalPrice', 'discountPercent'] } },
  { name: 'markup_margin_calculator', description: 'Calculate selling price and margin from cost and markup percentage.', inputSchema: { type: 'object', properties: { cost: { type: 'number' }, markupPercent: { type: 'number' } }, required: ['cost', 'markupPercent'] } },
  { name: 'profit_margin_calculator', description: 'Calculate gross profit, profit margin %, and markup % from revenue and cost.', inputSchema: { type: 'object', properties: { revenue: { type: 'number' }, cost: { type: 'number' } }, required: ['revenue', 'cost'] } },
  { name: 'hourly_to_salary_calculator', description: 'Convert hourly rate to weekly/monthly/annual salary. Default: 40 hrs/week, 50 weeks/year.', inputSchema: { type: 'object', properties: { hourlyRate: { type: 'number' }, hoursPerWeek: { type: 'number' }, weeksPerYear: { type: 'number' } }, required: ['hourlyRate'] } },
  { name: 'freelance_rate_calculator', description: 'Calculate freelance monthly net income after billable utilization and expenses.', inputSchema: { type: 'object', properties: { hourlyRate: { type: 'number' }, monthlyHours: { type: 'number' }, billablePercent: { type: 'number' }, expenses: { type: 'number' } }, required: ['hourlyRate'] } },
  { name: 'retirement_calculator', description: 'Project retirement savings. Inputs: current age, retirement age, current savings, monthly contribution, annual return %.', inputSchema: { type: 'object', properties: { currentAge: { type: 'number' }, retirementAge: { type: 'number' }, currentSavings: { type: 'number' }, monthlyContribution: { type: 'number' }, annualReturn: { type: 'number' } } } },
  { name: 'refinance_calculator', description: 'Calculate refinance savings: new monthly payment vs current, total savings, break-even months.', inputSchema: { type: 'object', properties: { currentBalance: { type: 'number' }, currentRate: { type: 'number' }, newRate: { type: 'number' }, years: { type: 'number' } }, required: ['currentBalance', 'currentRate', 'newRate', 'years'] } },
  { name: 'sales_commission_calculator', description: 'Calculate sales commission. Standard rate default 5%, bonus for premium (50%) or volume (30%) tiers.', inputSchema: { type: 'object', properties: { saleAmount: { type: 'number' }, rate: { type: 'number' }, tier: { type: 'string', enum: ['standard', 'premium', 'volume'] } }, required: ['saleAmount'] } },
  { name: 'platform_fee_comparison', description: 'Compare net revenue across Etsy, eBay, PayPal, Stripe, and Gumroad for a given sale price.', inputSchema: { type: 'object', properties: { itemPrice: { type: 'number' }, shippingFee: { type: 'number' }, market: { type: 'string', enum: ['usa', 'eu'] }, sellerLocation: { type: 'string' } }, required: ['itemPrice'] } },
];

const server = new Server({ name: 'mquickcalc-finance-mcp', version: '1.0.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
  const { name, arguments: args = {} } = params;
  try {
    const calculators = {
      etsy_fee_calculator: () => etsyFeeCalc(args),
      ebay_fee_calculator: () => ebayFeeCalc(args),
      paypal_fee_calculator: () => paypalFeeCalc(args),
      stripe_fee_calculator: () => stripeFeeCalc(args),
      gumroad_fee_calculator: () => gumroadFeeCalc(args),
      shopify_fee_calculator: () => shopifyFeeCalc(args),
      airbnb_fee_calculator: () => airbnbFeeCalc(args),
      kickstarter_fee_calculator: () => kickstarterFeeCalc(args),
      patreon_fee_calculator: () => patreonFeeCalc(args),
      booking_fee_calculator: () => bookingFeeCalc(args),
      poshmark_fee_calculator: () => poshmarkFeeCalc(args),
      twitch_bits_to_usd: () => twitchBitsFeeCalc(args),
      twitch_subscription_revenue: () => twitchSubRevCalc(args),
      vat_calculator: () => vatCalc(args),
      sales_tax_calculator: () => salesTaxCalc(args),
      compound_interest_calculator: () => compoundInterestCalc(args),
      simple_interest_calculator: () => simpleInterestCalc(args),
      loan_calculator: () => loanCalc(args),
      mortgage_calculator: () => mortgageCalc(args),
      auto_loan_calculator: () => autoLoanCalc(args),
      savings_calculator: () => savingsCalc(args),
      break_even_calculator: () => breakEvenCalc(args),
      discount_calculator: () => discountCalc(args),
      markup_margin_calculator: () => markupMarginCalc(args),
      profit_margin_calculator: () => profitMarginCalc(args),
      hourly_to_salary_calculator: () => hourlyToSalaryCalc(args),
      freelance_rate_calculator: () => freelanceRateCalc(args),
      retirement_calculator: () => retirementCalc(args),
      refinance_calculator: () => refinanceCalc(args),
      sales_commission_calculator: () => salesCommissionCalc(args),
      platform_fee_comparison: () => platformComparison(args),
    };
    const fn = calculators[name];
    if (!fn) return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
    const result = fn();
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
server.connect(transport).catch(err => { console.error('Failed to start:', err); process.exit(1); });
