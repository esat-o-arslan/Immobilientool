#!/usr/bin/env python3
"""Import or update ERP exports in Immobilientool without deleting records."""

from __future__ import annotations

import argparse
import csv
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


MODEL_FIELDS = {
    "Liegenschaft": [
        "id", "liegenschaftNummer", "name", "strasse", "plz", "ort", "typ",
        "status", "zustand", "zustandText", "verwalterId", "verwaltungsbeginn",
        "einheiten",
    ],
    "KontaktPerson": [
        "id", "liegenschaftId", "vorname", "nachname", "name", "rolle", "email",
        "telefon", "adresse", "kontoStatus", "wohnungsNummer", "stockwerk",
        "cognitoSub", "portalSichtbar",
    ],
    "Mitarbeiter": [
        "id", "name", "funktion", "email", "telefon", "rolle", "gruppe",
        "rechteExtra", "rechteEntzogen", "status", "photoUrl", "adresse",
        "kinder", "jahreslohn", "lohnSichtbar", "teamSichtbar",
        "teamSortierung", "cognitoSub", "urlaubsKontingent", "eintrittsdatum",
    ],
    "Handwerker": [
        "id", "firma", "gewerk", "kontaktperson", "email", "telefon",
        "notfallTelefon", "adresse", "einsatzgebiet", "bewertung",
        "stundensatz", "status", "bemerkung",
    ],
}

REQUIRED_FIELDS = {
    "Liegenschaft": {"liegenschaftNummer", "name", "strasse", "plz", "ort"},
    "KontaktPerson": {"liegenschaftId", "name", "rolle", "email"},
    "Mitarbeiter": {"name", "funktion", "email"},
    "Handwerker": {"firma", "gewerk"},
}

DEFAULT_PLURALS = {
    "Liegenschaft": "Liegenschafts",
    "KontaktPerson": "KontaktPersons",
    "Mitarbeiter": "Mitarbeiters",
    "Handwerker": "Handwerkers",
}

PROVIDER_MAPPINGS = {
    "rimo-r5": "rimo-r5.example.json",
    "immotop2": "immotop2.example.json",
    "garaio-rem": "garaio-rem.example.json",
}


@dataclass
class SyncReport:
    provider: str
    dry_run: bool
    created: dict[str, int] = field(default_factory=dict)
    updated: dict[str, int] = field(default_factory=dict)
    unchanged: dict[str, int] = field(default_factory=dict)
    skipped: dict[str, int] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)

    def increment(self, bucket: dict[str, int], model: str) -> None:
        bucket[model] = bucket.get(model, 0) + 1

    def as_dict(self) -> dict[str, Any]:
        return {
            "provider": self.provider,
            "mode": "dry-run" if self.dry_run else "apply",
            "created": self.created,
            "updated": self.updated,
            "unchanged": self.unchanged,
            "skipped": self.skipped,
            "warnings": self.warnings,
        }


def non_empty(value: Any) -> bool:
    return value is not None and (not isinstance(value, str) or bool(value.strip()))


def transform_value(value: Any, transform: str | None) -> Any:
    if not non_empty(value):
        return None
    if not transform:
        return value.strip() if isinstance(value, str) else value

    text = str(value).strip()
    if transform == "string":
        return text
    if transform == "lower":
        return text.lower()
    if transform == "integer":
        return int(float(text.replace("'", "").replace(",", ".")))
    if transform == "float":
        return float(text.replace("'", "").replace(",", "."))
    if transform == "boolean":
        normalized = text.casefold()
        if normalized in {"1", "true", "ja", "yes", "y"}:
            return True
        if normalized in {"0", "false", "nein", "no", "n"}:
            return False
        raise ValueError(f"Ungültiger Boolean-Wert: {value}")
    if transform == "name":
        return " ".join(text.split())
    raise ValueError(f"Unbekannte Transformation: {transform}")


def source_value(row: dict[str, Any], spec: Any) -> Any:
    if isinstance(spec, str):
        return row.get(spec)
    if not isinstance(spec, dict):
        raise ValueError(f"Feldzuordnung muss String oder Objekt sein: {spec!r}")

    if "constant" in spec:
        value = spec["constant"]
    elif "join" in spec:
        separator = spec.get("separator", " ")
        value = separator.join(
            str(row.get(source, "")).strip()
            for source in spec["join"]
            if non_empty(row.get(source))
        )
    else:
        value = row.get(spec.get("source", ""))
    return transform_value(value, spec.get("transform"))


def read_records(path: Path, delimiter: str | None = None) -> list[dict[str, Any]]:
    if path.suffix.casefold() == ".json":
        payload = json.loads(path.read_text(encoding="utf-8-sig"))
        if isinstance(payload, dict):
            for key in ("items", "records", "data"):
                if isinstance(payload.get(key), list):
                    payload = payload[key]
                    break
        if not isinstance(payload, list) or not all(isinstance(item, dict) for item in payload):
            raise ValueError(f"{path}: JSON muss eine Liste von Objekten enthalten.")
        return payload

    with path.open(newline="", encoding="utf-8-sig") as handle:
        sample = handle.read(4096)
        handle.seek(0)
        used_delimiter = delimiter
        if not used_delimiter:
            try:
                used_delimiter = csv.Sniffer().sniff(sample, delimiters=";,|\t").delimiter
            except csv.Error:
                used_delimiter = ";"
        return list(csv.DictReader(handle, delimiter=used_delimiter))


def load_mapping(path: Path) -> dict[str, Any]:
    mapping = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(mapping.get("datasets"), list) or not mapping["datasets"]:
        raise ValueError("Mapping benötigt eine nicht leere Liste 'datasets'.")
    for dataset in mapping["datasets"]:
        model = dataset.get("model")
        if model not in MODEL_FIELDS:
            raise ValueError(f"Nicht unterstütztes Zielmodell: {model}")
        if not dataset.get("file") or not dataset.get("key_field"):
            raise ValueError(f"{model}: 'file' und 'key_field' sind erforderlich.")
        unknown = set(dataset.get("fields", {})) - set(MODEL_FIELDS[model])
        if unknown:
            raise ValueError(f"{model}: unbekannte Zielfelder: {', '.join(sorted(unknown))}")
    return mapping


class AppSyncClient:
    def __init__(self, outputs: dict[str, Any], token: str):
        self.url = outputs["data"]["url"]
        self.token = token
        models = outputs.get("data", {}).get("model_introspection", {}).get("models", {})
        self.plurals = {
            model: models.get(model, {}).get("pluralName", DEFAULT_PLURALS[model])
            for model in MODEL_FIELDS
        }

    def request(self, query: str, variables: dict[str, Any]) -> dict[str, Any]:
        payload = json.dumps({"query": query, "variables": variables}).encode()
        request = urllib.request.Request(self.url, data=payload, method="POST")
        request.add_header("Content-Type", "application/json")
        request.add_header("Authorization", self.token)
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                body = json.loads(response.read())
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"AppSync HTTP {error.code}: {detail}") from error
        if body.get("errors"):
            messages = "; ".join(str(item.get("message", item)) for item in body["errors"])
            raise RuntimeError(f"AppSync GraphQL: {messages}")
        return body.get("data", {})

    def list_items(self, model: str) -> list[dict[str, Any]]:
        plural = self.plurals[model]
        fields = " ".join(MODEL_FIELDS[model])
        query = (
            f"query List{plural}($nextToken: String, $limit: Int) {{ "
            f"list{plural}(nextToken: $nextToken, limit: $limit) {{ "
            f"items {{ {fields} }} nextToken }} }}"
        )
        items: list[dict[str, Any]] = []
        token = None
        while True:
            data = self.request(query, {"nextToken": token, "limit": 1000})
            page = data.get(f"list{plural}") or {}
            items.extend(item for item in page.get("items", []) if item)
            token = page.get("nextToken")
            if not token:
                return items

    def create(self, model: str, item: dict[str, Any]) -> dict[str, Any]:
        fields = " ".join(MODEL_FIELDS[model])
        query = (
            f"mutation Create{model}($input: Create{model}Input!) {{ "
            f"create{model}(input: $input) {{ {fields} }} }}"
        )
        return self.request(query, {"input": item})[f"create{model}"]

    def update(self, model: str, item: dict[str, Any]) -> dict[str, Any]:
        fields = " ".join(MODEL_FIELDS[model])
        query = (
            f"mutation Update{model}($input: Update{model}Input!) {{ "
            f"update{model}(input: $input) {{ {fields} }} }}"
        )
        return self.request(query, {"input": item})[f"update{model}"]


def cognito_token(outputs: dict[str, Any], email: str, password: str) -> str:
    auth = outputs["auth"]
    result = subprocess.run(
        [
            "aws", "cognito-idp", "initiate-auth",
            "--region", auth["aws_region"],
            "--auth-flow", "USER_PASSWORD_AUTH",
            "--client-id", auth["user_pool_client_id"],
            "--auth-parameters", f"USERNAME={email},PASSWORD={password}",
            "--output", "json",
        ],
        check=True,
        text=True,
        capture_output=True,
    )
    return json.loads(result.stdout)["AuthenticationResult"]["IdToken"]


def prepare_item(
    row: dict[str, Any],
    dataset: dict[str, Any],
    indexes: dict[str, dict[str, dict[str, Any]]],
) -> tuple[dict[str, Any], list[str]]:
    model = dataset["model"]
    item = {
        key: source_value(row, spec)
        for key, spec in dataset.get("fields", {}).items()
    }
    for key, value in dataset.get("defaults", {}).items():
        if not non_empty(item.get(key)):
            item[key] = value

    warnings: list[str] = []
    for target, reference in dataset.get("references", {}).items():
        source = str(row.get(reference["source"], "")).strip()
        referenced = indexes.get(reference["model"], {}).get(source)
        if referenced:
            item[target] = referenced["id"]
        elif reference.get("required", True):
            warnings.append(
                f"Referenz fehlt: {reference['model']}.{reference['target_key']}={source!r}"
            )

    item = {key: value for key, value in item.items() if non_empty(value)}
    missing = sorted(REQUIRED_FIELDS[model] - set(item))
    if missing:
        warnings.append(f"Pflichtfelder fehlen: {', '.join(missing)}")
    return item, warnings


def comparable(item: dict[str, Any], fields: set[str]) -> dict[str, Any]:
    return {key: item.get(key) for key in fields if key != "id" and key in item}


def run_sync(
    source_dir: Path,
    mapping: dict[str, Any],
    client: AppSyncClient | None,
    apply: bool,
) -> SyncReport:
    report = SyncReport(provider=mapping.get("provider", "generic"), dry_run=not apply)
    datasets = sorted(mapping["datasets"], key=lambda item: item.get("order", 100))
    models = {dataset["model"] for dataset in datasets}
    existing_by_model: dict[str, list[dict[str, Any]]] = {}
    indexes: dict[str, dict[str, dict[str, Any]]] = {}

    for model in models:
        existing_by_model[model] = client.list_items(model) if client else []

    for dataset in datasets:
        model = dataset["model"]
        key_field = dataset["key_field"]
        existing_index = {
            str(item.get(key_field, "")).strip(): item
            for item in existing_by_model[model]
            if non_empty(item.get(key_field))
        }
        indexes.setdefault(model, {}).update(existing_index)

        path = source_dir / dataset["file"]
        if not path.exists():
            if dataset.get("optional", False):
                report.warnings.append(f"{model}: optionale Datei fehlt: {path}")
                continue
            raise FileNotFoundError(f"{model}: Exportdatei fehlt: {path}")

        rows = read_records(path, dataset.get("delimiter"))
        for row_number, row in enumerate(rows, start=2):
            item, warnings = prepare_item(row, dataset, indexes)
            external_key = str(item.get(key_field, "")).strip()
            prefix = f"{path.name}:{row_number} ({model})"
            if warnings or not external_key:
                report.increment(report.skipped, model)
                for warning in warnings or [f"Schlüsselfeld {key_field} fehlt"]:
                    report.warnings.append(f"{prefix}: {warning}")
                continue

            current = existing_index.get(external_key)
            mapped_fields = set(item)
            if current and comparable(current, mapped_fields) == comparable(item, mapped_fields):
                report.increment(report.unchanged, model)
                continue

            if current:
                if apply and client:
                    updated = client.update(model, {"id": current["id"], **item})
                    existing_index[external_key] = updated
                    indexes[model][external_key] = updated
                report.increment(report.updated, model)
            else:
                if apply and client:
                    created = client.create(model, item)
                else:
                    created = {"id": f"dry-run:{model}:{external_key}", **item}
                existing_index[external_key] = created
                indexes[model][external_key] = created
                report.increment(report.created, model)

    return report


def print_report(report: SyncReport) -> None:
    print(f"\nERP-Synchronisation: {report.provider} ({'Vorschau' if report.dry_run else 'Übernommen'})")
    for label, bucket in (
        ("Neu", report.created),
        ("Aktualisiert", report.updated),
        ("Unverändert", report.unchanged),
        ("Übersprungen", report.skipped),
    ):
        values = ", ".join(f"{model}: {count}" for model, count in sorted(bucket.items()))
        print(f"- {label}: {values or '0'}")
    if report.warnings:
        print("\nHinweise:")
        for warning in report.warnings:
            print(f"- {warning}")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="GARAIO-REM-, Rimo-R5- oder ImmoTop2-Export sicher synchronisieren."
    )
    parser.add_argument("--source", required=True, type=Path, help="Ordner mit Exportdateien")
    parser.add_argument(
        "--provider",
        choices=sorted(PROVIDER_MAPPINGS),
        help="Mitgeliefertes Profil auswählen",
    )
    parser.add_argument("--mapping", type=Path, help="Eigenes JSON-Mappingprofil")
    parser.add_argument("--outputs", type=Path, help="Server/amplify_outputs.json")
    parser.add_argument("--email", help="Administrationskonto für AppSync")
    parser.add_argument("--apply", action="store_true", help="Änderungen wirklich übernehmen")
    parser.add_argument("--report", type=Path, help="JSON-Bericht schreiben")
    args = parser.parse_args()

    try:
        if bool(args.provider) == bool(args.mapping):
            parser.error("Genau eines von --provider oder --mapping ist erforderlich.")
        mapping_path = args.mapping
        if args.provider:
            mapping_path = (
                Path(__file__).resolve().parents[1]
                / "integrations"
                / "mappings"
                / PROVIDER_MAPPINGS[args.provider]
            )
        assert mapping_path is not None
        mapping = load_mapping(mapping_path)
        client = None
        if args.apply:
            if not args.outputs or not args.email:
                parser.error("--apply benötigt --outputs und --email.")
            password = os.environ.get("IMMOBILIENTOOL_ADMIN_PASSWORD")
            if not password:
                parser.error("--apply benötigt IMMOBILIENTOOL_ADMIN_PASSWORD.")
            outputs = json.loads(args.outputs.read_text(encoding="utf-8"))
            client = AppSyncClient(outputs, cognito_token(outputs, args.email, password))

        report = run_sync(args.source, mapping, client, args.apply)
        print_report(report)
        if args.report:
            args.report.parent.mkdir(parents=True, exist_ok=True)
            args.report.write_text(
                json.dumps(report.as_dict(), ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            print(f"\nBericht: {args.report}")
        return 2 if report.skipped else 0
    except (OSError, ValueError, KeyError, RuntimeError, subprocess.CalledProcessError) as error:
        print(f"Fehler: {error}", file=sys.stderr)
        print(
            "Wenn Exportfelder, Berechtigungen oder Schnittstellen fehlen, wenden Sie sich "
            "bitte an den Support Ihres ERP-Anbieters.",
            file=sys.stderr,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
