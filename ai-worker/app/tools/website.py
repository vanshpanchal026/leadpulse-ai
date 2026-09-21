"""Website fetch tool wrapper."""
from app.services.website_fetcher import get_website_fetcher, WebsiteFetchResult

async def fetch_website(url: str) -> WebsiteFetchResult:
    """Fetch and extract data from a website URL using SSRF-safe fetcher."""
    fetcher = get_website_fetcher()
    return await fetcher.fetch(url)

__all__ = ["fetch_website"]
