import doctest
from importlib.metadata import distribution
from importlib.resources import files


def test_installed_readme_doctests() -> None:
    package = distribution("team-hermes-authorization")
    readme = package.metadata["Description"]
    example = doctest.DocTestParser().get_doctest(readme, {}, "README", "README.md", 0)
    result = doctest.DocTestRunner().run(example)
    assert result.attempted > 0
    assert result.failed == 0


def test_distribution_metadata_and_typing_marker() -> None:
    package = distribution("team-hermes-authorization")
    assert package.metadata["Requires-Python"] == ">=3.12"
    assert not package.requires
    assert files("team_hermes.authorization").joinpath("py.typed").is_file()
