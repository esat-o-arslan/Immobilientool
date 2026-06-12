#!/usr/bin/env python3
"""Fail when common private artifacts or known production identifiers are present."""

from __future__ import annotations

import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SKIP_PARTS = {".git", "node_modules", "dist", ".amplify", "work"}
TEXT_SUFFIXES = {
    ".swift", ".tsx", ".ts", ".js", ".json", ".md", ".py", ".html", ".plist",
    ".entitlements", ".pbxproj", ".yml", ".yaml", ".txt", ".csv", ".svg",
}
FORBIDDEN_FILES = {".env", ".env.local"}
PATTERNS = {
    "AWS access key": re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b"),
    "private key": re.compile(r"BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY"),
    "GitHub token": re.compile(r"\bgh[pousr]_[A-Za-z0-9]{20,}\b"),
    "known production endpoint": re.compile(r"(?:wrfjehyx2jdfrecvc7odsndzbe|dv348hw7vav8k|vZknC8A2A)"),
    "real street address (Hauptstrasse 18)": re.compile(r"Hauptstrasse\s+18"),
    "real location (Oberwil)": re.compile(r"\bOberwil\b"),
    "real location (4104)": re.compile(r"\b4104\b"),
    "real location (Liestal)": re.compile(r"\bLiestal\b"),
}


def main() -> int:
    findings: list[str] = []
    for path in ROOT.rglob("*"):
        if any(part in SKIP_PARTS for part in path.parts):
            continue
        if path.resolve() == Path(__file__).resolve():
            continue
        if path.is_dir():
            if path.name == "xcuserdata":
                findings.append(f"Xcode user data: {path.relative_to(ROOT)}")
            continue
        if path.name in FORBIDDEN_FILES or path.suffix in {".p12", ".pem", ".mobileprovision", ".db", ".sqlite"}:
            findings.append(f"Private artifact: {path.relative_to(ROOT)}")
        if path.suffix not in TEXT_SUFFIXES:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for label, pattern in PATTERNS.items():
            if pattern.search(text):
                findings.append(f"{label}: {path.relative_to(ROOT)}")

    if findings:
        print("Veröffentlichungsprüfung fehlgeschlagen:")
        for finding in sorted(set(findings)):
            print("-", finding)
        return 1
    print("Veröffentlichungsprüfung bestanden: keine bekannten Secrets oder Produktiv-IDs gefunden.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
