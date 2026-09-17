import os
import logging
from pathlib import Path

logger = logging.getLogger("ai_worker.core.prompt_loader")

def load_prompt(prompt_name: str, **kwargs) -> str | None:
    """Load a prompt template from ai-worker/prompts/{prompt_name}.md and format with kwargs.
    Falls back to returning None if file not found (caller uses inline fallback)."""
    
    prompt_path = Path(__file__).resolve().parent.parent.parent / "prompts" / f"{prompt_name}.md"
    
    if not prompt_path.exists():
        logger.warning(f"Prompt file not found: {prompt_path}, falling back to inline.")
        return None
        
    try:
        content = prompt_path.read_text(encoding="utf-8")
        if kwargs:
            return content.format(**kwargs)
        return content
    except Exception as e:
        logger.error(f"Error loading or formatting prompt {prompt_name}: {e}")
        return None
