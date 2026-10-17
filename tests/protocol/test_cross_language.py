"""Validate actual worker responses with the production TypeScript validator."""

import json
from pathlib import Path
import shutil
import subprocess
import sys

import pytest


def test_real_worker_responses_are_accepted_by_typescript():
    node = shutil.which("node")
    if node is None:
        pytest.skip("La comprobación cruzada requiere Node.js 24 con soporte TypeScript.")
    root = Path(__file__).resolve().parents[2]
    requests = [
        ("analyze", 'mostrar("¡Hola, habitación 🏠!")>>'),
        ("execute", 'mostrar("¡Hola, habitación 🏠!")>>'),
        ("execute", "@"),
        ("execute", "entero valor ="),
        ("execute", 'entero valor = "texto">>'),
        ("execute", "mostrar(4 / 0)>>"),
        ("execute", 'importar "ausente.lumi" usar respuesta>>'),
        ("analyze", "habitacion sala(5, 4, 2.7) {}"),
        ("execute", "habitacion sala(5, 4, 2.7) {}"),
        ("execute", "funcion vacio crear() { habitacion sala(5, 4, 2.7) {} }"),
        ("execute", 'texto nombre = leer("Nombre:")>>'),
    ]
    frames = b"{malformed}\n"
    for index, (operation, source) in enumerate(requests):
        frames += (json.dumps({
            "protocolVersion": "1.0.0", "requestId": f"cross-{index}",
            "operation": operation, "entryFile": "principal.lumi",
            "files": {"principal.lumi": source},
        }, ensure_ascii=False) + "\n").encode("utf-8")
    worker = subprocess.run(
        [sys.executable, "-B", "-m", "services.worker"], cwd=root,
        input=frames, capture_output=True, check=True, timeout=10,
    )
    validator = root / "apps/desktop/renderer/src/services/integration/protocol/responseValidator.ts"
    script = f"""
        import {{ parseProtocolResponse }} from {json.dumps(validator.as_uri())};
        import {{ readFileSync }} from 'node:fs';
        const lines = readFileSync(0, 'utf8').trim().split('\\n');
        for (const line of lines) {{
          const validation = parseProtocolResponse(line);
          if (!validation.valid) throw new Error(JSON.stringify(validation.errors));
        }}
        process.stdout.write(String(lines.length));
    """
    validated = subprocess.run(
        [node, "--experimental-strip-types", "--input-type=module", "-e", script],
        input=worker.stdout, capture_output=True, timeout=10,
    )
    assert validated.returncode == 0, validated.stderr.decode("utf-8")
    assert validated.stdout == b"12"
