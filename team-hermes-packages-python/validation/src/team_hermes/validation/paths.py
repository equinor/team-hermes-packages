def get_targets_by_path(root: object, path: str) -> list[tuple[object, str]]:
    """Retrieve targets by traversing attributes and expanding list values."""
    targets = [(root, "")]
    for part in path.split("."):
        new_targets: list[tuple[object, str]] = []
        for obj, current_path in targets:
            value = getattr(obj, part, None)
            if isinstance(value, list):
                new_targets.extend(
                    (item, f"{current_path}.{part}[{index}]" if current_path else f"{part}[{index}]")
                    for index, item in enumerate(value)
                )
            elif value is not None:
                new_targets.append((value, f"{current_path}.{part}" if current_path else part))
        targets = new_targets
    return targets
