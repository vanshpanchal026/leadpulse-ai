# Freelancing Research Tool â€” Context & Technical Dossier

> **Source Conversation:** [`77a9878f-f15f-415d-978f-f124b5ec1cbf`](conversation://77a9878f-f15f-415d-978f-f124b5ec1cbf)  
> **Topic:** Install Apify MCP Server & Reddit Freelancing Lead Scraping  
> **Timestamp:** September 5, 2026

---

## 1. Apify Account & MCP Server Configuration

### Account Information
- **Account Username:** `[REDACTED_USER]` (Display name: *PG Gaming*)
- **Account Email:** `[REDACTED_EMAIL]`
- **Plan Tier:** Free Tier ($5.00/month in free usage credits included)
- **API Token:** `APIFY_API_TOKEN_PLACEHOLDER` (Configured in local `.env`)

### MCP Server Integration
The Apify MCP Server allows AI assistants to discover, configure, and invoke cloud scrapers and automations directly from chat or workflows.

- **MCP Endpoint URL:** `https://mcp.apify.com/?token=APIFY_API_TOKEN_PLACEHOLDER`
- **Authentication:** Bearer token header or `?token=` query parameter.
- **Global Antigravity Config:** `~/.gemini/config/mcp_config.json`
- **Workspace Config:** `.vscode/mcp.json` and `.cursor/mcp.json`

```json
{
  "mcpServers": {
    "apify": {
      "serverUrl": "https://mcp.apify.com/?token=APIFY_API_TOKEN_PLACEHOLDER",
      "headers": {
        "Authorization": "Bearer APIFY_API_TOKEN_PLACEHOLDER"
      }
    }
  }
}
```

### Key Apify MCP Tools Available
| Tool | Description |
| :--- | :--- |
| `search-actors` | Search Apify Store for scrapers (Reddit, LinkedIn, Twitter, Google Maps, Zillow). |
| `fetch-actor-details` | Inspect an actor's input JSON schema, parameter constraints, and pricing model. |
| `call-actor` | Trigger an actor with custom JSON input and retrieve results. |
| `get-dataset-items` | Fetch structured JSON/CSV data from actor runs. |
| `get-actor-run` / `abort-actor-run` | Monitor status, check logs, or abort running jobs. |

---

## 2. Reddit Scraper Research & Benchmark

During our research phase, we evaluated the top Reddit scrapers in the Apify store:

| Metric / Attribute | `macrocosmos/reddit-scraper` | **`trudax/reddit-scraper-lite`** (Selected) | `harshmaur/reddit-scraper` |
| :--- | :--- | :--- | :--- |
| **Actor ID** | `RA1CgWSkuTRNdnOAY` | `oAuCIx3ItNrs2okjQ` | `3t1d9h1P2q0x7o...` |
| **Status** | âš ï¸ Frequently blocked (403 from `old.reddit.com`) | **Active & Highly Reliable** | Active |
| **Users / Rating** | 22K+ users, 4.3â˜… | **41,054 users, 4.57â˜… (38 reviews)** | 12K users, 4.48â˜… |
| **30-Day Volume** | High failure rates | **352,652 successful runs** (4.47M total) | ~40K runs |
| **Architecture** | Old Reddit HTML parser | Unofficial API / internal endpoints + residential proxies | Internal endpoints + GraphQL |
| **Pricing Model** | Pay-per-event | Pay-per-event ($0.02 start + $0.004 / item) | Pay-per-event ($0.002 / item) |

**Decision Rationale:** `trudax/reddit-scraper-lite` was selected due to its massive track record, built-in residential proxy rotation, and immunity to old Reddit blocks.

---

## 3. Actor Schema & Input Parameters

For `trudax/reddit-scraper-lite`:

| Parameter | Type | Setting Used | Purpose |
| :--- | :--- | :--- | :--- |
| `startUrls` | `Array<Object>` | 40 Reddit search URLs | Direct URLs with query, sort, and subreddit restriction. |
| `skipComments` | `Boolean` | `true` | Excludes comment scraping to save cost and focus on posts. |
| `includeMediaLinks` | `Boolean` | `true` | Extracts upvotes (`score`), upvote ratio, and media links. |
| `maxPostCount` | `Integer` | `6` | Maximum posts captured per individual search URL. |
| `maxItems` | `Integer` | `240` | Global safety cutoff to strictly enforce the $1.00 budget. |
| `sort` | `String` | `"new"` | Captures recent, fresh opportunities. |
| `proxy` | `Object` | `{"useApifyProxy": true}` | Apify residential proxy pool to bypass anti-bot challenges. |

---

## 4. Budget & Cost Analysis ($1.00 Limit)

- **Target Scope:**
  - 8 Subreddits: `forhire`, `smallbusiness`, `Entrepreneur`, `automation`, `n8n`, `webdev`, `SaaS`, `Shopify`
  - 5 Keywords: `whatsapp`, `chatbot`, `automation`, `automate`, `ai agent`
  - Total combinations: $8 \times 5 = 40$ searches
- **Pricing:**
  - Start fee: $\$0.02$
  - Per result fee: $\$0.004$
- **Mathematical Bound:**
  $$\text{Budget} = \$1.00 \implies \$0.02 + (N \times \$0.004) \le \$1.00 \implies N \le \frac{0.98}{0.004} = 245 \text{ items}$$
  $$\text{Items per search} = \lfloor 245 / 40 \rfloor = 6 \text{ posts per combination}$$
  $$\text{Max Theoretical Cost} = \$0.02 + (240 \times \$0.004) = \mathbf{\$0.98}$$

### Actual Execution Run Results
- **Run ID:** Initialized on Apify cloud infrastructure
- **Status:** `SUCCEEDED`
- **Actual Billing:** **$0.7200** *(Under budget! Covered by the $5.00 monthly free credit)*
- **Total Posts Collected:** **170 unique items**

---

## 5. Dataset Structure (`data/reddit_results.csv`)

| Column Name | Description | Example |
| :--- | :--- | :--- |
| `subreddit` | Subreddit community where the post was submitted | `forhire`, `n8n`, `webdev` |
| `keyword_matched` | Targeted search term(s) matched in post text | `whatsapp`, `chatbot, automation` |
| `title` | Title of the Reddit submission | `[Hiring] AI Automation Developer...` |
| `body_text` | Complete body text / description | Scope of work, tech requirements, contacts |
| `url` | Direct permalink to the Reddit thread | `https://www.reddit.com/r/n8n/...` |
| `score` | Upvote score (net upvotes) | `1`, `15` |
| `created_date` | Timestamp when the post was created | `2026-09-04T16:01:47.000Z` |

---

## 6. Project Workflows

1. **Rerun / Update Scrapes:**
   ```bash
   python scripts/run_reddit_scraper.py
   ```
2. **Analyze Leads & Extract High-Intent Hiring Opportunities:**
   ```bash
   python scripts/analyze_leads.py
   ```
   *Generates `data/hiring_leads.csv` with categorized hiring posts, budget mentions, and contact points.*
