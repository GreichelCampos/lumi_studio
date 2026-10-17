"""Framing, codec failures and real worker subprocess tests."""

from io import BytesIO, StringIO
import json
from pathlib import Path
import subprocess
import sys

import pytest

from services.protocol.errors import ProtocolError
from services.protocol.models import MAX_REQUEST_BYTES, MAX_RESPONSE_BYTES
from services.protocol.serialization import decode_request, encode_response
from services.worker import run_worker


ROOT = Path(__file__).resolve().parents[2]


def frame(request_id="worker-1", source='mostrar("¡Lumi, habitación 🏠!")>>', operation="execute"):
    return (json.dumps({
        "protocolVersion": "1.0.0", "requestId": request_id, "operation": operation,
        "entryFile": "principal.lumi", "files": {"principal.lumi": source},
    }, ensure_ascii=False) + "\n").encode("utf-8")


def test_real_process_handles_consecutive_requests_unicode_and_errors():
    data = b'{bad json}\n' + frame() + frame("worker-2", "mostrar(4 / 0)>>")
    process = subprocess.run(
        [sys.executable, "-B", "-m", "services.worker"], cwd=ROOT,
        input=data, capture_output=True, timeout=10,
    )
    assert process.returncode == 0
    assert process.stderr == b""
    messages = [json.loads(line) for line in process.stdout.decode("utf-8").splitlines()]
    assert len(messages) == 3
    assert messages[0]["error"]["code"] == "MALFORMED_JSON"
    assert messages[0]["requestId"] is None
    assert messages[1]["result"]["output"] == ["¡Lumi, habitación 🏠!"]
    assert messages[2]["result"]["diagnostics"][0]["code"] == "RUN_DIVISION_BY_ZERO"


def test_live_process_flushes_each_response_before_eof():
    process = subprocess.Popen(
        [sys.executable, "-B", "-m", "services.worker"], cwd=ROOT,
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    )
    from concurrent.futures import ThreadPoolExecutor
    try:
        with ThreadPoolExecutor(max_workers=1) as pool:
            assert process.stdin is not None and process.stdout is not None
            process.stdin.write(frame())
            process.stdin.flush()
            future = pool.submit(process.stdout.readline)
            try:
                response = json.loads(future.result(timeout=10))
                assert response["status"] == "completed"
            finally:
                # Unblock a pending readline before the executor waits for shutdown.
                process.stdin.close()
                if not future.done():
                    process.kill()
        assert process.wait(timeout=10) == 0
    finally:
        if process.poll() is None:
            process.kill()
        process.wait(timeout=10)
        for pipe in (process.stdin, process.stdout, process.stderr):
            if pipe is not None:
                pipe.close()


@pytest.mark.parametrize(
    "data, code",
    [
        (b"\xff\n", "INVALID_UTF8"), (b"\n", "MALFORMED_JSON"),
        (b'{"a":1,"a":2}\n', "MALFORMED_JSON"),
        (b'{"a":NaN}\n', "MALFORMED_JSON"),
        (b'{"a":Infinity}\n', "MALFORMED_JSON"),
        (b'{"a":-Infinity}\n', "MALFORMED_JSON"),
        (b'{"a":' + b'9' * 5000 + b'}\n', "MALFORMED_JSON"),
        (b'[' * 2000 + b']' * 2000, "MALFORMED_JSON"),
        (b"x" * (MAX_REQUEST_BYTES + 1), "REQUEST_TOO_LARGE"),
    ],
    ids=["invalid-utf8", "empty", "duplicate-key", "nan", "infinity", "negative-infinity",
         "excessive-integer", "deep-json", "oversized"],
)
def test_strict_codec(data, code):
    with pytest.raises(ProtocolError) as raised:
        decode_request(data)
    assert raised.value.code == code


def test_oversized_frame_is_drained_then_next_request_is_processed():
    output = BytesIO()
    data = b"x" * (MAX_REQUEST_BYTES * 2 + 10) + b"\n" + frame()
    run_worker(BytesIO(data), output, StringIO())
    messages = [json.loads(line) for line in output.getvalue().splitlines()]
    assert len(messages) == 2
    assert messages[0]["error"]["code"] == "REQUEST_TOO_LARGE"
    assert messages[1]["status"] == "completed"


def test_crlf_and_final_frame_without_newline_are_supported():
    output = BytesIO()
    run_worker(BytesIO(frame().replace(b"\n", b"\r\n") + frame("worker-2").rstrip(b"\n")), output, StringIO())
    assert len(output.getvalue().splitlines()) == 2


def test_worker_keeps_technical_output_off_stdout_and_handles_input_failure():
    data = frame(source='texto nombre = leer("Nombre:")>>') + frame("worker-2")
    output, log = BytesIO(), StringIO()
    run_worker(BytesIO(data), output, log)
    messages = [json.loads(line) for line in output.getvalue().splitlines()]
    assert messages[0]["error"]["code"] == "INPUT_UNAVAILABLE"
    assert messages[1]["status"] == "completed"
    assert "InputUnavailableError" in log.getvalue()


@pytest.mark.parametrize("failure", ["print", "large", "invalid", "unicode"])
def test_accidental_prints_and_serialization_failures_are_contained(failure):
    from services.protocol.dispatcher import RequestDispatcher

    class CustomDispatcher(RequestDispatcher):
        def dispatch(self, raw):
            response = super().dispatch(raw)
            if failure == "print":
                print("registro accidental")
            elif failure == "large":
                response["result"]["output"] = ["a" * MAX_RESPONSE_BYTES]
            elif failure == "unicode":
                response["result"]["output"] = ["\ud800"]
            else:
                response["result"]["output"] = [object()]
            return response

    output, log = BytesIO(), StringIO()
    run_worker(BytesIO(frame()), output, log, dispatcher=CustomDispatcher())
    response = json.loads(output.getvalue())
    if failure == "print":
        assert response["status"] == "completed"
        assert "registro accidental" in log.getvalue()
    else:
        assert response["error"]["kind"] == "infrastructure"
        assert response["error"]["code"] == (
            "RESPONSE_TOO_LARGE" if failure == "large" else "SERIALIZATION_ERROR"
        )
        assert "Traceback" in log.getvalue()


def test_serialization_rejects_non_finite_numbers():
    with pytest.raises(ValueError):
        encode_response({"number": float("nan")})
