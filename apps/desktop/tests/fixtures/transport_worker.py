"""Transport-only test fixture. Does not parse or execute Lumi."""

import json
import sys
import time

mode = sys.argv[1]
for line in sys.stdin.buffer:
    request = json.loads(line)
    if mode == "crash":
        sys.exit(7)
    if mode == "hang":
        time.sleep(60)
    if mode == "invalid":
        sys.stdout.buffer.write(b"not-json\n")
        sys.stdout.buffer.flush()
        continue
    response = {
        "protocolVersion": "1.0.0",
        "requestId": "wrong" if mode == "wrong-id" else request["requestId"],
        "operation": request["operation"], "status": "error",
        "error": {"kind": "infrastructure", "code": "INTERNAL_ERROR", "message": "fixture 🏠"},
    }
    encoded = (json.dumps(response, ensure_ascii=False) + "\n").encode("utf-8")
    if mode == "fragment":
        for index in range(0, len(encoded), 3):
            sys.stdout.buffer.write(encoded[index:index + 3])
            sys.stdout.buffer.flush()
    else:
        sys.stdout.buffer.write(encoded)
        sys.stdout.buffer.flush()
