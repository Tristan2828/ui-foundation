"""foundation_backend.versions: an update built on a version that's no
longer the record's is a 409 (Roadmap 405, the RichTextEditor review's F4)."""

from datetime import datetime, timedelta, timezone

import pytest

from foundation_backend.versions import VersionConflict, check_version, same_version, touch

AT = datetime(2026, 11, 18, 4, 0, 0, 123456, tzinfo=timezone.utc)


def test_the_same_version_passes() -> None:
    check_version(AT, AT)


def test_no_version_sent_is_not_checked() -> None:
    check_version(AT, None)


def test_another_version_is_a_409() -> None:
    with pytest.raises(VersionConflict) as raised:
        check_version(AT, AT - timedelta(microseconds=1))
    assert raised.value.status_code == 409


def test_a_naive_time_from_sqlite_is_the_same_instant_in_utc() -> None:
    assert same_version(AT.replace(tzinfo=None), AT)
    assert same_version(AT, AT.astimezone(timezone(timedelta(hours=-5))))


def test_a_record_with_no_version_yet_conflicts_with_any_sent() -> None:
    with pytest.raises(VersionConflict):
        check_version(None, AT)


def test_touch_is_a_new_aware_instant() -> None:
    first = touch()
    assert first.tzinfo is not None
    assert not same_version(first, AT)
