#!/usr/bin/env python3
"""Update an installed Immobilientool copy from GitHub."""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import zipfile
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parent
DEFAULT_REPOSITORY = "esat-o-arslan/Immobilientool"
DEFAULT_BRANCH = "main"
STATE_FILE = ROOT / ".immobilientool-config.json"
MANIFEST_FILE = ROOT / ".immobilientool-update-manifest.json"
PROTECTED_FILES = {
    ".immobilientool-config.json",
    "Server/amplify_outputs.json",
    "App/ImmobilienApp/amplify_outputs.json",
    "Zeiterfassung/Zeiterfassung/PortalAWSConfig.swift",
}
IGNORED_PARTS = {
    ".git",
    ".amplify",
    ".swiftpm",
    "backups",
    "dist",
    "node_modules",
    "work",
    "xcuserdata",
}


def download(url: str, destination: Path) -> None:
    print("Lade herunter:", url)
    request = urllib.request.Request(url, headers={"User-Agent": "Immobilientool-Updater"})
    with urllib.request.urlopen(request, timeout=120) as response:
        destination.write_bytes(response.read())


def remote_text(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "Immobilientool-Updater"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8").strip()


def relative_files(root: Path) -> set[str]:
    result: set[str] = set()
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        relative = path.relative_to(root)
        if any(part in IGNORED_PARTS for part in relative.parts):
            continue
        if str(relative) in PROTECTED_FILES:
            continue
        result.add(str(relative))
    return result


def existing_manifest() -> set[str]:
    if MANIFEST_FILE.exists():
        return set(json.loads(MANIFEST_FILE.read_text(encoding="utf-8")))
    if (ROOT / ".git").exists() and shutil.which("git"):
        result = subprocess.run(
            ["git", "ls-files", "-z"],
            cwd=ROOT,
            capture_output=True,
            check=False,
        )
        if result.returncode == 0:
            return {
                item.decode("utf-8")
                for item in result.stdout.split(b"\0")
                if item and item.decode("utf-8") not in PROTECTED_FILES
            }
    return set()


def create_backup(paths: set[str]) -> Path:
    backup_dir = ROOT / "backups"
    backup_dir.mkdir(exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    destination = backup_dir / f"before-update-{stamp}.zip"
    candidates = paths | PROTECTED_FILES | {".immobilientool-update-manifest.json"}
    with zipfile.ZipFile(destination, "w", zipfile.ZIP_DEFLATED) as archive:
        for relative in sorted(candidates):
            path = ROOT / relative
            if path.is_file():
                archive.write(path, relative)
    return destination


def safe_extract(archive: Path, destination: Path) -> Path:
    with zipfile.ZipFile(archive) as source:
        for member in source.infolist():
            target = (destination / member.filename).resolve()
            if destination.resolve() not in target.parents and target != destination.resolve():
                raise RuntimeError("Unsicherer Pfad im Update-Archiv.")
        source.extractall(destination)
    roots = [path for path in destination.iterdir() if path.is_dir()]
    if len(roots) != 1:
        raise RuntimeError("Unerwartete Struktur des Update-Archivs.")
    return roots[0]


def install_update(source: Path, old_files: set[str], new_files: set[str]) -> None:
    for relative in sorted(old_files - new_files):
        target = ROOT / relative
        if target.is_file() and relative not in PROTECTED_FILES:
            target.unlink()

    for relative in sorted(new_files):
        source_path = source / relative
        destination = ROOT / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source_path, destination)

    MANIFEST_FILE.write_text(
        json.dumps(sorted(new_files), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def run_setup(*arguments: str) -> None:
    subprocess.run([sys.executable, str(ROOT / "setup.py"), *arguments], cwd=ROOT, check=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="Immobilientool sicher von GitHub aktualisieren")
    parser.add_argument("--repository", default=DEFAULT_REPOSITORY, help="GitHub-Repository owner/name")
    parser.add_argument("--branch", default=DEFAULT_BRANCH, help="GitHub-Branch")
    parser.add_argument("--check-only", action="store_true", help="Nur verfügbare Version anzeigen")
    parser.add_argument("--yes", action="store_true", help="Rückfragen automatisch bestätigen")
    parser.add_argument("--deploy", action="store_true", help="Bestehende AWS-Umgebung danach aktualisieren")
    args = parser.parse_args()

    raw_base = f"https://raw.githubusercontent.com/{args.repository}/{args.branch}"
    remote_version = remote_text(f"{raw_base}/VERSION")
    local_version = (ROOT / "VERSION").read_text(encoding="utf-8").strip() if (ROOT / "VERSION").exists() else "unbekannt"
    print(f"Installierte Version: {local_version}")
    print(f"Verfügbare Version:  {remote_version}")
    if args.check_only:
        return 0
    if local_version == remote_version and not args.yes:
        answer = input("Version ist identisch. Trotzdem neu einspielen? (j/n) [n]: ").strip().lower()
        if not answer.startswith("j"):
            return 0
    elif not args.yes:
        answer = input("Update herunterladen und installieren? (j/n) [j]: ").strip().lower() or "j"
        if not answer.startswith("j"):
            return 0

    old_files = existing_manifest()
    with tempfile.TemporaryDirectory(prefix="immobilientool-update-") as temporary:
        temporary_path = Path(temporary)
        archive = temporary_path / "update.zip"
        download(
            f"https://github.com/{args.repository}/archive/refs/heads/{args.branch}.zip",
            archive,
        )
        source = safe_extract(archive, temporary_path / "extracted")
        new_files = relative_files(source)
        if "setup.py" not in new_files or "VERSION" not in new_files:
            raise RuntimeError("Update-Archiv enthält kein vollständiges Immobilientool.")
        backup = create_backup(old_files | new_files)
        print("Sicherung:", backup)
        install_update(source, old_files, new_files)

    if STATE_FILE.exists():
        print("\nWende gespeicherte Namen, Logos und Apple-Konfiguration erneut an ...")
        run_setup("--apply-saved", "--configure-only", "--yes")
    else:
        print("\nNoch keine lokale Einrichtung gefunden. Bitte danach python3 setup.py starten.")

    deploy = args.deploy
    if STATE_FILE.exists() and not deploy and not args.yes:
        answer = input("Bestehendes AWS-Backend und Webportal jetzt aktualisieren? (j/n) [n]: ").strip().lower()
        deploy = answer.startswith("j")
    if deploy:
        run_setup("--apply-saved", "--update-deployment", "--yes")

    print(f"\nUpdate auf Version {remote_version} abgeschlossen.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\nAbgebrochen.")
        raise SystemExit(130)
    except Exception as error:
        print(f"\nFEHLER: {error}", file=sys.stderr)
        raise SystemExit(1)
