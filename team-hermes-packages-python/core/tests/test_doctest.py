import re
import runpy
from pathlib import Path

import pytest

from team_hermes.core import ExceptionSeverity, NotFoundException


def test_readme_quick_start(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    readme = (Path(__file__).resolve().parents[1] / "README.md").read_text(encoding="utf-8")
    examples = re.findall(r"```python\n(.*?)\n```", readme, re.DOTALL)
    assert len(examples) == 1
    script = tmp_path / "quick_start.py"
    script.write_text(examples[0], encoding="utf-8")

    namespace = runpy.run_path(str(script))

    assert capsys.readouterr().out == "Order not found\n"
    get_order_status = namespace["get_order_status"]
    assert get_order_status("order-1") == "pending"
    with pytest.raises(NotFoundException, match="Order not found") as caught:
        get_order_status("order-404")
    assert caught.value.extensions == {"order_id": "order-404"}
    assert caught.value.severity is ExceptionSeverity.ERROR
