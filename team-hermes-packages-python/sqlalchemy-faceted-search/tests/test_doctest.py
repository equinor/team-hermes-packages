import doctest
from pathlib import Path


def test_readme_doctests() -> None:
    result = doctest.testfile(
        str(Path(__file__).resolve().parents[1] / "README.md"),
        module_relative=False,
        encoding="utf-8",
        raise_on_error=True,
    )
    assert result.attempted > 0
