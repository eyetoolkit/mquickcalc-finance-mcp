# mQuickCalc Finance MCP Server

[![Smithery](https://smithery.ai/badge/mquickcalc-finance-mcp)](https://smithery.ai/servers/19820393768/mquickcalc-finance-mcp)
[![npm version](https://img.shields.io/npm/v/@eyetoolkit/mquickcalc-finance-mcp)](https://www.npmjs.com/package/@eyetoolkit/mquickcalc-finance-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

**Calculate Etsy, eBay, PayPal, Stripe, and Shopify fees — directly inside your AI agent.**

Stop switching between browser tabs. mQuickCalc Finance MCP gives your AI agent the ability to calculate e-commerce fees, compare platform costs, and run profit margin analysis — without leaving the conversation.

**14 production-ready tools:** Etsy, eBay, PayPal, Stripe, Shopify fees · discount/markup/margin · break-even · compound interest · loan · mortgage · sales tax · platform comparison

> Perfect for: e-commerce sellers, freelancers, AI-powered financial analysis, pricing automation.

## Tools

| Tool | Description |
|------|-------------|
| `etsy_fee_calculator` | Etsy fee breakdown: transaction, payment processing, regulatory, listing, off-site ads |
| `ebay_fee_calculator` | eBay fee breakdown across US/UK/DE/CA/AU markets, supports tiered rate |
| `paypal_fee_calculator` | PayPal transaction fee, direct transfer fee, currency conversion |
| `stripe_fee_calculator` | Stripe fee, net received, effective rate; supports target-net calculation |
| `shopify_fee_calculator` | Shopify Payments, Stripe, PayPal, manual payment fees |
| `platform_fee_comparison` | Compare Etsy, eBay, Stripe, PayPal, Shopify fees side-by-side |
| `profit_margin_calculator` | Gross/net profit, margin, markup from cost and selling price |
| `discount_calculator` | Original price, discount %, final price, savings |
| `markup_calculator` | Cost → markup % → selling price |
| `margin_calculator` | Selling price → margin % → gross profit |
| `break_even_calculator` | Break-even units and revenue from fixed/variable costs |
| `compound_interest_calculator` | Future value, total interest, annual equivalent |
| `loan_calculator` | Monthly payment, total interest, amortization schedule |
| `mortgage_calculator` | Monthly payment, total interest, affordability estimate |
| `sales_tax_calculator` | Add or remove sales tax from any amount |

## Installation

### Prerequisites

- Node.js 18+ (Node 20 recommended)
- npm 9+

### Quick install

```bash
npm install -g @eyetoolkit/mquickcalc-finance-mcp
```

### Build from source

```bash
npm install
npm run build
```

### Test locally

```bash
node dist/index.js
```

## Claude Desktop Integration

Add to your Claude Desktop config:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "mquickcalc-finance": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/mcp-finance/dist/index.js"]
    }
  }
}
```

Then restart Claude Desktop.

## Usage Examples

```
Calculate Etsy fees for a $50 item with $5 shipping:
→ etsy_fee_calculator({ price: 50, shipping: 5 })

Compare platform fees for a $75 item:
→ platform_fee_comparison({ price: 75, shipping: 0 })

Calculate how much to charge to receive $100 net after Stripe fees:
→ stripe_fee_calculator({ targetNet: 100 })

What's the monthly payment on a $300,000 mortgage at 6.5% over 30 years?
→ mortgage_calculator({ principal: 300000, annualRate: 6.5, years: 30 })
```

## Pricing

**Free tier:** All 14 tools, no API key required.

**Pro tier (coming soon):** Unlimited calls, history storage, batch analysis.

## License

MIT
