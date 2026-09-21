"""Worker process executable entrypoint."""

import sys
from pathlib import Path

# Ensure ai-worker root is in sys.path when invoked directly
ai_worker_dir = Path(__file__).resolve().parent
if str(ai_worker_dir) not in sys.path:
    sys.path.insert(0, str(ai_worker_dir))

import uvicorn
from app.core.config import get_settings

if __name__ == "__main__":
    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host=settings.AI_WORKER_HOST,
        port=settings.AI_WORKER_PORT,
        reload=False,
        log_level=settings.LOG_LEVEL.lower()
    )
