# Freelancing Research Tool

A data-driven market intelligence and lead generation tool designed to identify freelance opportunities, client automation requests, SaaS/agency pain points, and buyer intent across Reddit communities using Apify Actors.

---

## Features

- **Automated Multi-Subreddit Scraping**: Searches 8 high-intent subreddits (`r/forhire`, `r/smallbusiness`, `r/Entrepreneur`, `r/automation`, `r/n8n`, `r/webdev`, `r/SaaS`, `r/Shopify`) for niche tech keywords (`whatsapp`, `chatbot`, `automation`, `automate`, `ai agent`).
- **Apify Cloud Scraping via MCP**: Integrated with `trudax/reddit-scraper-lite` running on Apify residential proxy networks to avoid blocks and captchas.
- **Budget-Capped Architecture**: Built-in safeguards preventing runaway actor billing (runs guaranteed <$1.00).
- **Lead Qualification & Extraction**: Categorizes posts into `HIRING`, `FOR_HIRE`, and `DISCUSSION`, isolates contact information (Email, Telegram, Discord, Calendly), and parses budget/hourly rates.
- **Pre-scraped Dataset**: Includes 170 real-world freelance discussions and leads ready for immediate analysis.

---

## Directory Structure

```
Freeelancing Research tool/
├── .env                     # Private Apify credentials (auto-loaded)
├── .env.example             # Template for API keys
├── .gitignore               # Excludes secrets and temp files
├── .cursor/mcp.json         # Workspace MCP config for Cursor
├── .vscode/mcp.json         # Workspace MCP config for VS Code
├── CONTEXT.md               # Full historical context, actor benchmarks & schemas
├── requirements.txt         # Dependencies (python-dotenv)
├── data/
│   ├── reddit_results.csv   # Scraped dataset (170 leads)
│   └── hiring_leads.csv     # Filtered high-intent hiring opportunities
└── scripts/
    ├── run_reddit_scraper.py # Parameterized Apify runner
    └── analyze_leads.py      # Lead classifier and contact extractor
```

---

## Quick Start

### 1. Setup Environment
Ensure Python 3.10+ is installed. Optional dependencies can be installed via:
```bash
pip install -r requirements.txt
```

Verify that `.env` contains your Apify API Token:
```env
APIFY_TOKEN=apify_api_...
```

### 2. Analyze Existing Leads
To analyze the existing 170 scraped posts and generate `data/hiring_leads.csv`:
```bash
python scripts/analyze_leads.py
```

### 3. Run New Scrapes
To run a fresh scrape across all 8 subreddits with the 5 default keywords:
```bash
python scripts/run_reddit_scraper.py
```

#### Custom Scraper Arguments
You can customize subreddits, keywords, and limits:
```bash
python scripts/run_reddit_scraper.py --subreddits forhire smallbusiness n8n --keywords "ai agent" "automation" --limit 5
```

---

## Reference & Context

For full architectural details, Apify actor comparison benchmarks, cost calculation formulas, and MCP server endpoints, see [CONTEXT.md](file:///c:/Users/pc/OneDrive/Desktop/Freeelancing%20Research%20tool/CONTEXT.md).
