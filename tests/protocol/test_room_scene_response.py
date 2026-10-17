import json
from pathlib import Path
import subprocess
import sys

from services.protocol.dispatcher import RequestDispatcher


def request(source, operation="analyze", request_id="room"):
    return {"protocolVersion": "1.0.0", "requestId": request_id, "operation": operation,
            "entryFile": "principal.lumi", "files": {"principal.lumi": source}}


def test_dispatcher_returns_a_resolved_exchange_scene_from_source():
    result = RequestDispatcher().dispatch(request("principal { habitacion sala(5, 4, 2.7) {} }"))
    assert result["status"] == "completed"
    assert result["result"]["diagnostics"] == []
    assert result["result"]["limitations"] == []
    assert result["result"]["capabilities"]["scenePlan"] is True
    room = result["result"]["scenePlan"]["rooms"][0]
    assert room["name"] == "sala"
    assert room["dimensions"] == [5, 4, 2.7]
    assert room["calculatedArea"] == 20
    assert room["calculatedVolume"] == 54
    assert room["id"] == "principal.lumi:1:13"
    assert set(room["walls"]) == {"north", "south", "east", "west"}
    assert room["objects"] == room["doors"] == room["windows"] == []


def test_failed_unsupported_and_runtime_results_never_publish_a_scene():
    for source, operation in [
        ("principal { habitacion sala(-5, 4, 2.7) {} }", "analyze"),
        ('principal { habitacion sala(5,4,2.7) { silla asiento {} } }', "analyze"),
        ("principal { habitacion sala(5,4,2.7) {} }", "execute"),
    ]:
        result = RequestDispatcher().dispatch(request(source, operation))
        assert result["status"] != "completed"
        assert "scenePlan" not in result["result"]
        assert result["result"]["capabilities"]["scenePlan"] is False


def test_real_worker_response_is_accepted_by_production_typescript_validator():
    root = Path(__file__).resolve().parents[2]
    raw = request("principal {\n    habitacion sala(5.0, 4.0, 2.7) {\n    }\n}")
    worker = subprocess.run([sys.executable, "-B", "-m", "services.worker"], cwd=root,
                            input=(json.dumps(raw) + "\n").encode(), capture_output=True, check=True, timeout=10)
    response = json.loads(worker.stdout)
    assert response["result"]["scenePlan"]["rooms"][0]["dimensions"] == [5.0, 4.0, 2.7]
    module = (root / "apps/desktop/renderer/src/services/integration/protocol/responseValidator.ts").as_uri()
    script = f"""import {{ parseProtocolResponse }} from {json.dumps(module)};
import {{ readFileSync }} from 'node:fs';
const result = parseProtocolResponse(readFileSync(0, 'utf8').trim());
if (!result.valid) throw new Error(JSON.stringify(result.errors));
console.log('scene accepted');"""
    validated = subprocess.run(["node", "--experimental-strip-types", "--input-type=module", "-e", script],
                               input=worker.stdout, capture_output=True, timeout=10)
    assert validated.returncode == 0, validated.stderr.decode()
    assert validated.stdout.strip() == b"scene accepted"
