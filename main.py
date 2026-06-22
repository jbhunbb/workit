#!/usr/bin/env python3
"""Workit — Mac App Entry Point (PyWebView)"""

import sys
import threading
import socket
import time
import logging
from pathlib import Path

LOG_DIR = Path.home() / ".workit" / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
logging.basicConfig(
    filename=str(LOG_DIR / "workit.log"),
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)


def find_free_port():
    with socket.socket() as s:
        s.bind(("", 0))
        return s.getsockname()[1]


def start_flask(port):
    try:
        from app import app, _init
        _init()
        app.run(port=port, host="127.0.0.1", use_reloader=False, debug=False,
                threaded=True)
    except Exception:
        logging.exception("Flask server failed")


def wait_for_server(port, timeout=15):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.5):
                return True
        except OSError:
            time.sleep(0.1)
    return False


if __name__ == "__main__":
    import webview

    port = find_free_port()
    logging.info("Starting Flask on port %d", port)

    t = threading.Thread(target=start_flask, args=(port,), daemon=True)
    t.start()

    if not wait_for_server(port, timeout=15):
        logging.error("Flask server did not start in time")
        sys.exit(1)

    logging.info("Server ready — opening window")
    window = webview.create_window(
        "Workit",
        f"http://127.0.0.1:{port}",
        width=1280,
        height=820,
        min_size=(920, 600),
        text_select=False,
    )
    webview.start(debug=False)
