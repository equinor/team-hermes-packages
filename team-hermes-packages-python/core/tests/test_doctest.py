import doctest
from pathlib import Path

import pytest

from team_hermes.core import ExceptionSeverity, NotFoundException


def test_readme_quick_start() -> None:
    readme_path = Path(__file__).resolve().parents[1] / "README.md"
    readme = readme_path.read_text(encoding="utf-8")
    example = doctest.DocTestParser().get_doctest(readme, {}, "README quick start", str(readme_path), 0)
    result = doctest.DocTestRunner().run(example, clear_globs=False)
    assert result.failed == 0
    assert result.attempted > 0
    get_order_status = example.globs["get_order_status"]
    assert get_order_status("order-1") == "pending"
    with pytest.raises(NotFoundException, match="Order not found") as caught:
        get_order_status("order-404")
    assert caught.value.extensions == {"order_id": "order-404"}
    assert caught.value.severity is ExceptionSeverity.ERROR
