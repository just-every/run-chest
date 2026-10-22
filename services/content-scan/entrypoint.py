"""Refresh signatures before serving, then update them under the scanner container's own account."""
import subprocess
import sys
updater = None
try:
    subprocess.run(["freshclam", "--config-file=/opt/chest-scanner/freshclam.conf", "--stdout"], check=True)
    updater = subprocess.Popen(["freshclam", "--config-file=/opt/chest-scanner/freshclam.conf", "--stdout", "--daemon", "--foreground"])
    subprocess.run([sys.executable, "server.py", "--host", "0.0.0.0"], check=True)
finally:
    if updater is not None:
        updater.terminate()
        updater.wait(timeout=10)
