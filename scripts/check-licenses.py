"""Reject explicitly prohibited licenses in installed dependencies."""
import json
import re
import subprocess
from pathlib import Path

# LGPL is permitted for dynamically linked dependencies such as PyAV.
forbidden = re.compile(r"AGPL|SSPL|BUSL|Commons Clause|NonCommercial", re.I)
violations = []
lock = json.loads(Path("package-lock.json").read_text())
for name, package in lock["packages"].items():
    if not package.get("dev") and forbidden.search(package.get("license", "")):
        violations.append(name)
code = """
import importlib.metadata, json
print(json.dumps([{'name': d.metadata['Name'], 'license':
    (d.metadata.get('License-Expression') or '') + ' ' + (d.metadata.get('License') or '')}
    for d in importlib.metadata.distributions()]))
"""
packages = json.loads(subprocess.check_output([".venv/bin/python", "-c", code]))
for package in packages:
    if forbidden.search(package["license"]):
        violations.append(package["name"])
if violations:
    raise SystemExit("Prohibited dependency licenses: " + ", ".join(violations))
print("No explicitly prohibited dependency licenses found.")
