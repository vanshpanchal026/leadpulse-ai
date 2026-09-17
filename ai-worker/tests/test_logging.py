"""Unit tests for secret redaction filter and logging safety."""

import logging
from app.core.logging import SecretRedactingFilter, setup_logging


def test_secret_redacting_filter_exact_match():
    """Verify that exact registered secret strings are replaced with [REDACTED]."""
    filter_ = SecretRedactingFilter(secrets_to_redact=["super-confidential-token-999"])

    record = logging.LogRecord(
        name="test",
        level=logging.INFO,
        pathname="",
        lineno=0,
        msg="Connecting to gateway with key super-confidential-token-999 now",
        args=(),
        exc_info=None
    )

    filter_.filter(record)
    assert "super-confidential-token-999" not in record.msg
    assert "[REDACTED]" in record.msg


def test_secret_redacting_filter_bearer_and_patterns():
    """Verify regex pattern scrubbing for Bearer tokens and api-keys."""
    filter_ = SecretRedactingFilter()

    record = logging.LogRecord(
        name="test",
        level=logging.INFO,
        pathname="",
        lineno=0,
        msg="Authorization: Bearer my-secret-jwt-token-12345 api_key=secret-value",
        args=(),
        exc_info=None
    )

    filter_.filter(record)
    assert "my-secret-jwt-token-12345" not in record.msg
    assert "secret-value" not in record.msg
    assert "Bearer [REDACTED]" in record.msg
    assert "api_key=[REDACTED]" in record.msg


def test_logging_setup_emojis():
    """Verify setup_logging does not crash when processing emoji messages."""
    logger = setup_logging(log_level="INFO", known_secrets=["dummy-secret"])
    logger.info("Test emoji log: 🚀 😊 ✅")
