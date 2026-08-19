"""Unit tests for the PII scrubber."""

from __future__ import annotations

import pytest

from app.services.pii import scrub


class TestThaiNationalID:
    def test_dashed_format(self) -> None:
        result = scrub("เลขบัตร 1-1234-56789-01-2 ค่ะ")
        assert "[REDACTED_ID]" in result.text
        assert result.scrub_count == 1
        assert "national_id" in result.scrubbed_types

    def test_continuous_13_digits(self) -> None:
        result = scrub("ID: 1234567890123")
        assert "[REDACTED_ID]" in result.text
        assert result.scrub_count == 1


class TestPhoneNumbers:
    def test_mobile_08x(self) -> None:
        result = scrub("โทร 0812345678")
        assert "[REDACTED_PHONE]" in result.text
        assert result.scrub_count == 1

    def test_mobile_09x(self) -> None:
        result = scrub("เบอร์ 0912345678")
        assert "[REDACTED_PHONE]" in result.text

    def test_mobile_06x(self) -> None:
        result = scrub("ติดต่อ 0612345678")
        assert "[REDACTED_PHONE]" in result.text

    def test_landline(self) -> None:
        result = scrub("สำนักงาน 021234567")
        assert "[REDACTED_PHONE]" in result.text
        assert "phone_landline" in result.scrubbed_types


class TestEmail:
    def test_basic_email(self) -> None:
        result = scrub("ส่งมาที่ test@example.com นะคะ")
        assert "[REDACTED_EMAIL]" in result.text
        assert result.scrub_count == 1


class TestCreditCard:
    def test_spaced_format(self) -> None:
        result = scrub("เลขบัตร 4111 1111 1111 1111 ค่ะ")
        assert "[REDACTED_CC]" in result.text
        assert result.scrub_count == 1

    def test_dashed_format(self) -> None:
        result = scrub("card: 4111-1111-1111-1111")
        assert "[REDACTED_CC]" in result.text

    def test_continuous_format(self) -> None:
        result = scrub("บัตร 4111111111111111")
        assert "[REDACTED_CC]" in result.text


class TestCleanText:
    def test_no_pii_passes_through(self) -> None:
        text = "สวัสดีค่ะ อยากสอบถามเรื่องสินค้า order #TH12345 ค่ะ"
        result = scrub(text)
        assert result.text == text
        assert result.scrub_count == 0
        assert result.scrubbed_types == []


class TestMultiplePII:
    def test_mixed_pii_types(self) -> None:
        text = "ชื่อสมศรี โทร 0812345678 email: somsi@test.com"
        result = scrub(text)
        assert "[REDACTED_PHONE]" in result.text
        assert "[REDACTED_EMAIL]" in result.text
        assert result.scrub_count == 2
