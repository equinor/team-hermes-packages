from types import SimpleNamespace

import pytest

from team_hermes.validation.paths import get_targets_by_path


def test_nested_lists_preserve_target_locations():
    root = SimpleNamespace(groups=[SimpleNamespace(values=[1, 2]), SimpleNamespace(values=[3])])

    assert get_targets_by_path(root, "groups.values") == [
        (1, "groups[0].values[0]"),
        (2, "groups[0].values[1]"),
        (3, "groups[1].values[0]"),
    ]


@pytest.mark.parametrize("value", [None, []])
def test_missing_targets_are_skipped(value):
    root = SimpleNamespace(value=value)

    assert get_targets_by_path(root, "value") == []
    assert get_targets_by_path(root, "missing.child") == []


@pytest.mark.parametrize("value", [0, False, ""])
def test_falsey_scalar_targets_are_preserved(value):
    assert get_targets_by_path(SimpleNamespace(value=value), "value") == [(value, "value")]
