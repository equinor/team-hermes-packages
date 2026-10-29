import json
import re
import runpy
from pathlib import Path
from uuid import UUID

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient


@pytest.fixture
def quick_start_app(tmp_path: Path) -> FastAPI:
    readme = (Path(__file__).resolve().parents[1] / "README.md").read_text(encoding="utf-8")
    examples = re.findall(r"```python\n(.*?)\n```", readme, re.DOTALL)
    assert len(examples) == 1
    script = tmp_path / "main.py"
    script.write_text(examples[0], encoding="utf-8")
    namespace = runpy.run_path(str(script))
    return namespace["app"]


def test_readme_quick_start(quick_start_app: FastAPI) -> None:
    with TestClient(quick_start_app) as client:
        accepted = client.post("/orders/order-1/approval", json={"total": 50})
        missing = client.post("/orders/order-404/approval", json={"total": 50})
        invalid = client.post("/orders/order-1/approval", json={"total": 0})
        malformed = client.post("/orders/order-1/approval", json={"total": "invalid"})
        unknown_route = client.get("/unknown")
        wrong_method = client.get("/orders/order-1/approval")

    assert accepted.status_code == 200
    assert accepted.json() == {"id": "order-1", "status": "approved", "total": 50}
    assert missing.status_code == 404
    assert missing.json()["extensions"]["orderId"] == "order-404"
    assert invalid.status_code == 400
    assert invalid.json()["detail"] == "Order total must be positive"
    assert malformed.status_code == 422
    assert unknown_route.status_code == 404
    assert unknown_route.json()["title"] == "Not Found"
    assert wrong_method.status_code == 405
    assert wrong_method.json()["status"] == 405
    assert wrong_method.headers["allow"] == "POST"
    documented_responses = quick_start_app.openapi()["paths"]["/orders/{order_id}/approval"]["post"]["responses"]
    assert {"400", "404", "422"} <= documented_responses.keys()


def test_readme_problem_details_response(quick_start_app: FastAPI) -> None:
    readme = (Path(__file__).resolve().parents[1] / "README.md").read_text(encoding="utf-8")
    example = json.loads(readme.partition("```json\n")[2].partition("\n```")[0])
    with TestClient(quick_start_app) as client:
        response = client.post(
            "/orders/order-1/approval", json={"total": 150}, headers={"X-Trace-Id": "example-trace"}
        )

    assert response.status_code == 422
    assert response.headers["content-type"] == "application/json"
    payload = response.json()
    UUID(payload["extensions"]["errorId"])
    payload["extensions"]["errorId"] = example["extensions"]["errorId"]
    assert payload == example
