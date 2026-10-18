"""Start a real worker, send real Lumi source, and verify its JSON response."""

import json
from pathlib import Path
import subprocess
import sys


def run_demo() -> int:
    request = {
        "protocolVersion": "1.0.0", "requestId": "demo-1", "operation": "execute",
        "entryFile": "principal.lumi",
        "files": {"principal.lumi": 'mostrar("¡Hola, Lumi!")>>'},
    }
    process = subprocess.run(
        [sys.executable, "-B", "-m", "services.worker"],
        cwd=Path(__file__).resolve().parents[1],
        input=(json.dumps(request, ensure_ascii=False) + "\n").encode("utf-8"),
        capture_output=True, timeout=10, check=True,
    )
    response = json.loads(process.stdout)
    if response.get("status") != "completed" or response["result"]["output"] != ["¡Hola, Lumi!"]:
        raise RuntimeError("La respuesta del worker no coincide con la ejecución esperada.")
    sys.stdout.buffer.write(process.stdout)
    sys.stderr.buffer.write(process.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(run_demo())
