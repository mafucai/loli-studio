#!/usr/bin/env python3
"""loli-studio governance checks. Exit 0 only when all checks pass."""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
failures = []

def fail(message):
    failures.append(message)
    print("FAIL  " + message)

for name in ("PROJECT_RULES.md", "ACCEPTANCE.md", "RISK_CHECKLIST.md", "LOW_MODEL_TASK_TEMPLATE.md"):
    path = os.path.join(ROOT, name)
    print(("PASS  " if os.path.isfile(path) else "FAIL  ") + name)
    if not os.path.isfile(path):
        failures.append(name + " missing")

for base, dirs, files in os.walk(ROOT):
    dirs[:] = [item for item in dirs if item not in (".git", "build")]
    for name in files:
        if not name.endswith((".js", ".py", ".html", ".css", ".java")):
            continue
        path = os.path.join(base, name)
        with open(path, encoding="utf-8", errors="replace") as handle:
            count = sum(1 for _ in handle)
        if count > 1500:
            fail(path + " has " + str(count) + " lines")

required = (
    "prototype/index.html",
    "scripts/ui-regression.js",
    "scripts/e2e-data.js",
    ".github/workflows/apk.yml",
)
for item in required:
    path = os.path.join(ROOT, item)
    print(("PASS  " if os.path.isfile(path) else "FAIL  ") + item)
    if not os.path.isfile(path):
        failures.append(item + " missing")

print("结果: " + ("全部通过" if not failures else str(len(failures)) + " FAIL"))
sys.exit(1 if failures else 0)
