#!/usr/bin/env python3
"""Import contractors into a freshly deployed AppSync API."""

from __future__ import annotations

import argparse
import csv
import json
import os
import subprocess
import urllib.request
from pathlib import Path


FIELDS = [
    "firma", "gewerk", "kontaktperson", "email", "telefon", "notfallTelefon",
    "adresse", "einsatzgebiet", "bewertung", "stundensatz", "status", "bemerkung",
]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--outputs", required=True, type=Path)
    parser.add_argument("--csv", required=True, type=Path)
    parser.add_argument("--email", required=True)
    args = parser.parse_args()

    password = os.environ.get("IMMOBILIENTOOL_ADMIN_PASSWORD")
    if not password:
        raise SystemExit("IMMOBILIENTOOL_ADMIN_PASSWORD fehlt.")

    outputs = json.loads(args.outputs.read_text(encoding="utf-8"))
    auth = outputs["auth"]
    result = subprocess.run([
        "aws", "cognito-idp", "initiate-auth",
        "--region", auth["aws_region"],
        "--auth-flow", "USER_PASSWORD_AUTH",
        "--client-id", auth["user_pool_client_id"],
        "--auth-parameters", f"USERNAME={args.email},PASSWORD={password}",
        "--output", "json",
    ], check=True, text=True, capture_output=True)
    token = json.loads(result.stdout)["AuthenticationResult"]["IdToken"]

    mutation = """
    mutation CreateHandwerker($input: CreateHandwerkerInput!) {
      createHandwerker(input: $input) { id firma }
    }
    """
    imported = 0
    with args.csv.open(newline="", encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            item = {key: row.get(key, "").strip() for key in FIELDS}
            item = {key: value for key, value in item.items() if value}
            for key in ("bewertung", "stundensatz"):
                if key in item:
                    item[key] = float(item[key].replace(",", "."))
            if not item.get("firma") or not item.get("gewerk"):
                print("Übersprungen: firma/gewerk fehlt", row)
                continue
            payload = json.dumps({"query": mutation, "variables": {"input": item}}).encode()
            request = urllib.request.Request(outputs["data"]["url"], data=payload, method="POST")
            request.add_header("Content-Type", "application/json")
            request.add_header("Authorization", token)
            with urllib.request.urlopen(request, timeout=60) as response:
                body = json.loads(response.read())
            if body.get("errors"):
                raise RuntimeError(body["errors"])
            imported += 1
            print("Importiert:", item["firma"])
    print(f"{imported} Handwerker importiert.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
