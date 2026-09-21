"""Structured Logging Infrastructure with Automatic Secret Redaction.

Guarantees that credentials, tokens, and sensitive headers are never written to logs.
"""

import logging
import re
import sys
from typing import Any, Optional


class SecretRedactingFilter(logging.Filter):
    """Logging filter that scrubs sensitive patterns from all log records."""

    _SENSITIVE_PATTERNS = [
        (re.compile(r"(Bearer\s+)[a-zA-Z0-9_\-\.]+", re.IGNORECASE), r"\1[REDACTED]"),
        (re.compile(r"(api[-_]?key['\":\s=]+)[a-zA-Z0-9_\-\.]+", re.IGNORECASE), r"\1[REDACTED]"),
        (re.compile(r"(secret['\":\s=]+)[a-zA-Z0-9_\-\.]+", re.IGNORECASE), r"\1[REDACTED]"),
        (re.compile(r"(password['\":\s=]+)[a-zA-Z0-9_\-\.]+", re.IGNORECASE), r"\1[REDACTED]"),
    ]

    def __init__(self, secrets_to_redact: Optional[list[str]] = None):
        super().__init__()
        self._exact_secrets = [s for s in (secrets_to_redact or []) if s and len(s) > 3]

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            record.msg = self._redact(record.msg)
        if record.args:
            if isinstance(record.args, dict):
                record.args = {k: self._redact(v) if isinstance(v, str) else v for k, v in record.args.items()}
            elif isinstance(record.args, tuple):
                record.args = tuple(self._redact(a) if isinstance(a, str) else a for a in record.args)
        return True

    def _redact(self, text: str) -> str:
        # First scrub exact registered secrets
        for secret in self._exact_secrets:
            text = text.replace(secret, "[REDACTED]")

        # Then scrub heuristic regex patterns
        for pattern, replacement in self._SENSITIVE_PATTERNS:
            text = pattern.sub(replacement, text)

        return text


class StructuredLogFormatter(logging.Formatter):
    """Formats log records as structured text with ISO timestamp and context."""

    def format(self, record: logging.LogRecord) -> str:
        standard_msg = super().format(record)
        # Extra structured data can be attached if provided via record.__dict__
        extra_fields = {
            k: v for k, v in record.__dict__.items()
            if k not in (
                "name", "msg", "args", "levelname", "levelno", "pathname", "filename",
                "module", "exc_info", "exc_text", "stack_info", "lineno", "funcName",
                "created", "msecs", "relativeCreated", "thread", "threadName",
                "processName", "process", "message", "asctime"
            )
        }
        if extra_fields:
            return f"{standard_msg} | extra={extra_fields}"
        return standard_msg


def setup_logging(log_level: str = "INFO", known_secrets: Optional[list[str]] = None) -> logging.Logger:
    """Configure structured logging for the LeadPulse AI Worker."""
    # Ensure stdout handles UTF-8 characters on Windows consoles without charmap crash
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

    numeric_level = getattr(logging, log_level.upper(), logging.INFO)

    root_logger = logging.getLogger()
    root_logger.setLevel(numeric_level)

    # Remove pre-existing stream handlers to avoid double printing
    for handler in list(root_logger.handlers):
        root_logger.removeHandler(handler)

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(numeric_level)

    formatter = StructuredLogFormatter(
        fmt="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S%z"
    )
    console_handler.setFormatter(formatter)

    # Attach secret redacting filter
    redactor = SecretRedactingFilter(secrets_to_redact=known_secrets)
    console_handler.addFilter(redactor)

    root_logger.addHandler(console_handler)

    # Silence overly verbose third-party loggers
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpx2").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("httpcore2").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.INFO)

    logger = logging.getLogger("ai_worker")
    logger.info("Structured logging initialized (level=%s, secret_redaction=active)", log_level)
    return logger
