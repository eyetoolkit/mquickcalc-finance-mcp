# mQuickCalc Finance MCP Server

An MCP (Model Context Protocol) server that exposes mQuickCalc's finance calculator tools — Etsy fees, eBay fees, Stripe fees, multi-platform comparison, and profit margin — to AI agents like Claude Desktop, Cursor, and any MCP-compatible AI assistant.

## Tools

| Tool | Description |
|------|-------------|
| `etsy_fee_calculator` | Etsy fee breakdown: transaction, payment processing, regulatory, listing, off-site ads |
| `ebay_fee_calculator` | eBay fee breakdown across US/UK/DE/CA/AU markets, supports tiered rate |
| `stripe_fee_calculator` | Stripe fee, net received, effective rate; supports target-net calculation |
| `platform_fee_comparison` | Compare Etsy, eBay, Stripe, PayPal, Shopify fees side-by-side |
| `profit_margin_calculator` | Gross/net profit, margin, markup from cost and selling price |

## Installation

### Prerequisites

- Node.js 18+
- npm

### Install dependencies

```bash
npm install
```

### Build

```bash
npm run build
```

### Test locally (stdio mode)

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

### Claude Code / CLI

```
Calculate Etsy fees for a $50 item with $5 shipping:
→ etsy_fee_calculator({ price: 50, shipping: 5 })
```

```
Compare platform fees for a $75 item:
→ platform_fee_comparison({ price: 75, shipping: 0 })
```

```
Calculate how much to charge to receive $100 net after Stripe fees:
→ stripe_fee_calculator({ targetNet: 100 })
```

## Pricing

**Free tier:** All tools, no API key required.

## License

MIT
