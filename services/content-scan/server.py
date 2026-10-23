#!/usr/bin/env python3
"""Bounded, authenticated ClamAV processor. Originals never enter HTTP logs or public storage."""
import argparse
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import zipfile

LABEL = re.compile(rb"\bclassification\s*:\s*(?:confidential|restricted|sensitive)\b", re.I)
CAP = 1024 * 1024 * 1024
EXPANSION_CAP = 128 * 1024 * 1024

def sensitive(path):
    # Explicit textual labels, including labels split across Office XML runs. No probabilistic inference.
    with open(path, "rb") as stream:
        tail = b""
        while block := stream.read(65536):
            if LABEL.search(tail + block):
                return True
            tail = block[-256:]
    if zipfile.is_zipfile(path):
        with zipfile.ZipFile(path) as archive:
            total = 0
            for member in archive.infolist():
                if not member.filename.endswith(".xml"):
                    continue
                total += member.file_size
                if total > EXPANSION_CAP:
                    raise ValueError("classification expansion limit")
                content = archive.read(member)
                if LABEL.search(re.sub(rb"<[^>]*>", b"", content)):
                    return True
    return False

def serve(args):
    token = os.environ.get("CONTENT_SCANNER_TOKEN", "")
    if not token or "\n" in token or "\r" in token:
        raise SystemExit("CONTENT_SCANNER_TOKEN is required")
    command = [args.clamscan, "--no-summary", "--stdout", "--max-filesize=1024M", "--max-scansize=2048M", "--max-recursion=20", "--alert-exceeds-max=yes"]
    if args.database:
        command += ["--database", args.database]
    # Refuse to serve when definitions are missing. A missing engine is never a clean verdict.
    with tempfile.NamedTemporaryFile() as probe:
        if subprocess.run(command + [probe.name], capture_output=True, timeout=90).returncode != 0:
            raise SystemExit("ClamAV and a readable signature database are required")
    engine = subprocess.check_output([args.clamscan, "--version"], timeout=5, text=True).strip()[:200]
    slots = threading.BoundedSemaphore(2)
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *unused):
            pass
        def answer(self, status, data):
            body = json.dumps(data).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        def do_POST(self):
            if self.path != "/scan":
                return self.answer(404, {"error": "not_found"})
            if not hmac.compare_digest(self.headers.get("Authorization", ""), "Bearer " + token):
                return self.answer(401, {"error": "authentication_required"})
            length = self.headers.get("Content-Length", "")
            checksum = self.headers.get("X-Content-SHA256", "")
            if not length.isdecimal() or not 0 < int(length) <= CAP or not re.fullmatch("[0-9a-f]{64}", checksum):
                return self.answer(413, {"error": "bounded_original_required"})
            if not slots.acquire(blocking=False):
                return self.answer(503, {"error": "scanner_busy"})
            try:
                self.connection.settimeout(30)
                with tempfile.TemporaryDirectory(prefix="chest-scan-") as directory:
                    original = Path(directory) / "original"
                    digest = hashlib.sha256()
                    remaining = int(length)
                    with original.open("wb") as out:
                        original.chmod(0o600)
                        while remaining:
                            block = self.rfile.read(min(65536, remaining))
                            if not block:
                                raise ValueError("incomplete original")
                            digest.update(block)
                            out.write(block)
                            remaining -= len(block)
                    if not hmac.compare_digest(digest.hexdigest(), checksum):
                        return self.answer(422, {"error": "checksum_mismatch"})
                    result = subprocess.run(command + [str(original)], capture_output=True, timeout=90)
                    if result.returncode not in (0, 1):
                        return self.answer(503, {"error": "scanner_failed"})
                    infected = result.returncode == 1
                    reason = "ClamAV detected a threat or a scan expansion limit" if infected else "ClamAV found no threat in the original"
                    return self.answer(200, {"checksum": checksum, "size": int(length), "state": "infected" if infected else "clean", "sensitive": sensitive(original), "reason": reason, "engine": engine})
            except (OSError, ValueError, subprocess.SubprocessError, zipfile.BadZipFile):
                return self.answer(503, {"error": "scanner_failed"})
            finally:
                slots.release()
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print("CHEST_SCANNER_READY " + str(server.server_address[1]), flush=True)
    try:
        server.serve_forever()
    finally:
        server.server_close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8095)
    parser.add_argument("--clamscan", default="clamscan")
    parser.add_argument("--database")
    serve(parser.parse_args())
