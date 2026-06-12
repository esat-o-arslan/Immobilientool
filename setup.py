#!/usr/bin/env python3
"""Interactive setup for a fresh Immobilientool installation."""

from __future__ import annotations

import argparse
import getpass
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.request
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent
SERVER = ROOT / "Server"
APP = ROOT / "App"
TIME_APP = ROOT / "Zeiterfassung"
STATE_FILE = ROOT / ".immobilientool-config.json"
BRANCH = "production"
LOGO_SUFFIXES = {".svg", ".png", ".jpg", ".jpeg"}
ICON_SUFFIXES = {".png", ".jpg", ".jpeg"}


def run(command: list[str], *, cwd: Path | None = None, env: dict[str, str] | None = None,
        capture: bool = False, check: bool = True) -> subprocess.CompletedProcess[str]:
    print("+", " ".join(command))
    return subprocess.run(
        command,
        cwd=cwd,
        env=env,
        text=True,
        capture_output=capture,
        check=check,
    )


def aws(args: list[str], config: dict, *, capture: bool = True,
        check: bool = True) -> subprocess.CompletedProcess[str]:
    return run(
        ["aws", *args, "--profile", config["aws_profile"], "--region", config["aws_region"],
         "--no-cli-pager"],
        capture=capture,
        check=check,
    )


def ask(label: str, default: str = "", *, required: bool = True) -> str:
    suffix = f" [{default}]" if default else ""
    while True:
        value = input(f"{label}{suffix}: ").strip() or default
        if value or not required:
            return value
        print("Dieses Feld ist erforderlich.")


def ask_file(label: str, existing: str = "", *, suffixes: set[str]) -> str:
    while True:
        raw = ask(label, existing, required=False)
        if raw == "-":
            return ""
        if not raw:
            return ""
        path = Path(raw).expanduser()
        if not path.is_absolute():
            path = (Path.cwd() / path).resolve()
        if not path.is_file():
            print(f"Datei nicht gefunden: {path}")
            continue
        if path.suffix.lower() not in suffixes:
            allowed = ", ".join(sorted(suffixes))
            print(f"Nicht unterstütztes Format. Erlaubt: {allowed}")
            continue
        return str(path)


def slug(value: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return cleaned or "immobilientool"


def validate_bundle_prefix(value: str) -> str:
    value = value.strip().strip(".")
    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9]*(\.[A-Za-z0-9-]+)+", value):
        raise ValueError("Bundle-Prefix muss etwa 'ch.meinefirma' lauten.")
    return value.lower()


def collect_config(existing: dict) -> dict:
    print("\nImmobilientool Setup")
    print("====================")
    print("Dieser Assistent richtet Branding, Apple-Projekte und eine neue AWS-Umgebung ein.")
    print("Bestehende produktive Systeme oder Datenbanken werden nicht gelesen.")
    print("AWS-Schlüssel werden nicht im Projekt gespeichert; verwendet wird ein AWS-CLI-Profil.\n")
    config = dict(existing)

    print("1/4 Namen und Branding")
    config["brand_name"] = ask("Name der Plattform", config.get("brand_name", "Immobilientool"))
    config["web_app_name"] = ask("Name der Web-App", config.get("web_app_name", config["brand_name"]))
    config["tenant_app_name"] = ask("Name der Mieter-/Eigentümer-App", config.get("tenant_app_name", f"{config['brand_name']} App"))
    config["time_app_name"] = ask("Name der Zeiterfassungs-App", config.get("time_app_name", "Zeiterfassung"))
    print("\nBranding-Dateien sind optional. Leer lassen verwendet die neutrale Vorlage.")
    print("Bei einer erneuten Ausführung entfernt '-' einen zuvor gespeicherten Dateipfad.")
    config["logo_path"] = ask_file(
        "Firmenlogo für Web und Zeiterfassung (SVG/PNG/JPG, optional)",
        config.get("logo_path", ""),
        suffixes=LOGO_SUFFIXES,
    )
    config["tenant_icon_path"] = ask_file(
        "App-Icon für die Mieter-/Eigentümer-App (quadratisch, mind. 1024 px, optional)",
        config.get("tenant_icon_path", ""),
        suffixes=ICON_SUFFIXES,
    )
    config["time_icon_path"] = ask_file(
        "App-Icon für Zeiterfassung und Watch-App (quadratisch, mind. 1024 px, optional)",
        config.get("time_icon_path", ""),
        suffixes=ICON_SUFFIXES,
    )

    print("\n2/4 Kontaktangaben")
    config["admin_email"] = ask("E-Mail des ersten Administrators", config.get("admin_email", ""))
    config["contact_email"] = ask("Öffentliche Kontakt-E-Mail", config.get("contact_email", config["admin_email"]))
    config["contact_phone"] = ask("Öffentliche Telefonnummer", config.get("contact_phone", "+41 "))
    config["contact_address"] = ask("Öffentliche Geschäftsadresse", config.get("contact_address", ""))
    config["website_url"] = ask("Öffentliche Webseite", config.get("website_url", "https://example.org"))

    print("\n3/4 Apple-Konfiguration")
    config["bundle_prefix"] = validate_bundle_prefix(
        ask("Apple Bundle-Prefix", config.get("bundle_prefix", "ch.example"))
    )
    config["apple_team_id"] = ask(
        "Apple Developer Team ID (leer erlaubt)",
        config.get("apple_team_id", ""),
        required=False,
    )

    print("\n4/4 AWS-Konfiguration")
    config["aws_profile"] = ask("AWS-CLI-Profil", config.get("aws_profile", "default"))
    config["aws_region"] = ask("AWS-Region", config.get("aws_region", "eu-central-1"))
    config["apns_arn"] = ask(
        "SNS APNs Platform Application ARN (optional)",
        config.get("apns_arn", ""),
        required=False,
    )
    return config


def print_summary(config: dict, *, deploy: bool) -> None:
    print("\nZusammenfassung")
    print("---------------")
    print("Plattform:", config["brand_name"])
    print("Web-App:", config["web_app_name"])
    print("Mieter-/Eigentümer-App:", config["tenant_app_name"])
    print("Zeiterfassung:", config["time_app_name"])
    print("Firmenlogo:", config.get("logo_path") or "Neutrales Standardlogo")
    print("App-Icon:", config.get("tenant_icon_path") or "Neutrales Standardicon")
    print("Zeiterfassungs-Icon:", config.get("time_icon_path") or "Neutrales Standardicon")
    print("Admin:", config["admin_email"])
    print("Bundle-Prefix:", config["bundle_prefix"])
    print("Apple Team:", config.get("apple_team_id") or "wird später in Xcode gewählt")
    if deploy:
        print("AWS:", f"{config['aws_profile']} / {config['aws_region']}")
        print("Aktion: neue AWS-Ressourcen erstellen und Webportal veröffentlichen")
    else:
        print("Aktion: nur lokale Dateien konfigurieren, keine AWS-Ressourcen")


def replace_text(path: Path, replacements: list[tuple[str, str]]) -> None:
    text = path.read_text(encoding="utf-8")
    updated = text
    for old, new in replacements:
        updated = updated.replace(old, new)
    if updated != text:
        path.write_text(updated, encoding="utf-8")


def ensure_display_name(text: str, bundle_id: str, display_name: str) -> str:
    pattern = re.compile(
        rf"(?m)^(?P<indent>\s+)"
        rf"(?:INFOPLIST_KEY_CFBundleDisplayName = [^\n]+;\n(?P=indent))?"
        rf"PRODUCT_BUNDLE_IDENTIFIER = {re.escape(bundle_id)};"
    )

    def replacement(match: re.Match[str]) -> str:
        indent = match.group("indent")
        return (
            f'{indent}INFOPLIST_KEY_CFBundleDisplayName = "{display_name}";\n'
            f"{indent}PRODUCT_BUNDLE_IDENTIFIER = {bundle_id};"
        )

    return pattern.sub(replacement, text)


def image_dimensions(path: Path) -> tuple[int, int]:
    result = run(
        ["sips", "-g", "pixelWidth", "-g", "pixelHeight", str(path)],
        capture=True,
    )
    width_match = re.search(r"pixelWidth:\s*(\d+)", result.stdout)
    height_match = re.search(r"pixelHeight:\s*(\d+)", result.stdout)
    if not width_match or not height_match:
        raise ValueError(f"Bildgrösse konnte nicht gelesen werden: {path}")
    return int(width_match.group(1)), int(height_match.group(1))


def write_app_icon(source: Path, destinations: list[Path]) -> None:
    width, height = image_dimensions(source)
    if width != height:
        raise ValueError(f"App-Icon muss quadratisch sein: {source} ({width}x{height})")
    if width < 1024:
        raise ValueError(f"App-Icon muss mindestens 1024x1024 px gross sein: {source}")
    for destination in destinations:
        destination.parent.mkdir(parents=True, exist_ok=True)
        run([
            "sips", "-s", "format", "png", "--resampleHeightWidth", "1024", "1024",
            str(source), "--out", str(destination),
        ], capture=True)


def write_logo_asset(source: Path, image_set: Path) -> None:
    suffix = ".svg" if source.suffix.lower() == ".svg" else ".png"
    filename = f"logo-immobilientool{suffix}"
    for old in image_set.glob("logo-immobilientool.*"):
        old.unlink()
    destination = image_set / filename
    if suffix == ".svg":
        if source.resolve() != destination.resolve():
            shutil.copy2(source, destination)
    else:
        run(["sips", "-s", "format", "png", str(source), "--out", str(destination)], capture=True)
    contents = {
        "images": [
            {"filename": filename, "idiom": "universal", "scale": "1x"},
            {"idiom": "universal", "scale": "2x"},
            {"idiom": "universal", "scale": "3x"},
        ],
        "info": {"author": "xcode", "version": 1},
    }
    (image_set / "Contents.json").write_text(
        json.dumps(contents, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def configure_brand_assets(config: dict) -> None:
    logo_path = config.get("logo_path")
    if logo_path:
        source = Path(logo_path)
        web_suffix = ".svg" if source.suffix.lower() == ".svg" else ".png"
        web_filename = f"logo-immobilientool{web_suffix}"
        for old in (SERVER / "public").glob("logo-immobilientool.*"):
            old.unlink()
        web_destination = SERVER / "public" / web_filename
        if web_suffix == ".svg":
            if source.resolve() != web_destination.resolve():
                shutil.copy2(source, web_destination)
        else:
            run(["sips", "-s", "format", "png", str(source), "--out", str(web_destination)], capture=True)
        app_source = SERVER / "src" / "App.tsx"
        text = app_source.read_text(encoding="utf-8")
        text = re.sub(r"/logo-immobilientool\.(?:svg|png)", f"/{web_filename}", text)
        app_source.write_text(text, encoding="utf-8")
        for image_set in [
            TIME_APP / "Zeiterfassung" / "Assets.xcassets" / "logo-immobilientool.imageset",
            TIME_APP / "WorkTrackingWidget" / "Assets.xcassets" / "logo-immobilientool.imageset",
            TIME_APP / "Zeiterfassung Watch App Watch App" / "Assets.xcassets" / "logo-immobilientool.imageset",
        ]:
            write_logo_asset(source, image_set)

    tenant_icon_path = config.get("tenant_icon_path")
    if tenant_icon_path:
        icon_set = APP / "ImmobilienApp" / "Assets.xcassets" / "AppIcon.appiconset"
        write_app_icon(Path(tenant_icon_path), [
            icon_set / "AppIconLight.png",
            icon_set / "AppIconDark.png",
            icon_set / "AppIconTinted.png",
        ])
        run([
            "sips", "-s", "format", "png", "--resampleHeightWidth", "512", "512",
            tenant_icon_path, "--out", str(SERVER / "public" / "favicon.png"),
        ], capture=True)
        replace_text(SERVER / "index.html", [
            ('href="/favicon.svg"', 'href="/favicon.png"'),
        ])

    time_icon_path = config.get("time_icon_path")
    if time_icon_path:
        ios_icon_set = TIME_APP / "Zeiterfassung" / "Assets.xcassets" / "AppIcon.appiconset"
        watch_icon_set = (
            TIME_APP / "Zeiterfassung Watch App Watch App" / "Assets.xcassets" /
            "AppIcon.appiconset"
        )
        write_app_icon(Path(time_icon_path), [
            ios_icon_set / "AppIconLight.png",
            ios_icon_set / "AppIconDark.png",
            ios_icon_set / "AppIconTinted.png",
            watch_icon_set / "AppIconLight.png",
        ])


def configure_sources(config: dict, previous: dict) -> None:
    print("\nKonfiguriere Branding und Xcode-Projekte ...")
    configure_brand_assets(config)
    replacements = [
        ("admin@example.invalid", config["admin_email"]),
        ("info@example.invalid", config["contact_email"]),
        ("+41 00 000 00 00", config["contact_phone"]),
        ("+41000000000", re.sub(r"\D", "", config["contact_phone"]).join(["+", ""])),
        ("Musterstrasse 1, 4000 Basel", config["contact_address"]),
        ("https://example.invalid", config["website_url"].rstrip("/")),
        ("Immobilientool", config["brand_name"]),
    ]
    previous_values = [
        (previous.get("admin_email"), config["admin_email"]),
        (previous.get("contact_email"), config["contact_email"]),
        (previous.get("contact_phone"), config["contact_phone"]),
        (previous.get("contact_address"), config["contact_address"]),
        (previous.get("website_url"), config["website_url"].rstrip("/")),
        (previous.get("brand_name"), config["brand_name"]),
    ]
    replacements.extend(
        (old, new)
        for old, new in previous_values
        if old and old != new
    )
    suffixes = {".swift", ".tsx", ".ts", ".html", ".md", ".json"}
    for base in (SERVER, APP, TIME_APP):
        for path in base.rglob("*"):
            if path.is_file() and path.suffix in suffixes and "Package.resolved" not in path.name:
                replace_text(path, replacements)

    app_bundle = f"{config['bundle_prefix']}.{slug(config['tenant_app_name']).replace('-', '')}"
    time_bundle = f"{config['bundle_prefix']}.{slug(config['time_app_name']).replace('-', '')}"
    app_project = APP / "ImmobilienApp.xcodeproj" / "project.pbxproj"
    time_project = TIME_APP / "Zeiterfassung.xcodeproj" / "project.pbxproj"

    app_text = app_project.read_text(encoding="utf-8")
    for old_bundle in {
        "ch.example.immobilientool.myhome",
        previous.get("app_bundle_id", ""),
    }:
        if old_bundle:
            app_text = app_text.replace(old_bundle, app_bundle)
    app_text = app_text.replace(
        'DEVELOPMENT_TEAM = "";',
        f'DEVELOPMENT_TEAM = "{config["apple_team_id"]}";',
    )
    previous_team = previous.get("apple_team_id")
    if previous_team and previous_team != config["apple_team_id"]:
        app_text = app_text.replace(
            f'DEVELOPMENT_TEAM = "{previous_team}";',
            f'DEVELOPMENT_TEAM = "{config["apple_team_id"]}";',
        )
    app_text = ensure_display_name(app_text, app_bundle, config["tenant_app_name"])
    app_project.write_text(app_text, encoding="utf-8")

    previous_time_bundle = previous.get("time_bundle_id", "")
    time_text = time_project.read_text(encoding="utf-8")
    bundle_replacements = [
        ("ch.example.immobilientool.time.WorkTrackingWidget", f"{time_bundle}.widget"),
        ("ch.example.immobilientool.time.watchkitapp", f"{time_bundle}.watch"),
        ("ch.example.immobilientool.time", time_bundle),
    ]
    if previous_time_bundle:
        bundle_replacements = [
            (f"{previous_time_bundle}.widget", f"{time_bundle}.widget"),
            (f"{previous_time_bundle}.watch", f"{time_bundle}.watch"),
            (previous_time_bundle, time_bundle),
            *bundle_replacements,
        ]
    for old, new in bundle_replacements:
        time_text = time_text.replace(old, new)
    time_text = time_text.replace(
        'DEVELOPMENT_TEAM = "";',
        f'DEVELOPMENT_TEAM = "{config["apple_team_id"]}";',
    )
    if previous_team and previous_team != config["apple_team_id"]:
        time_text = time_text.replace(
            f'DEVELOPMENT_TEAM = "{previous_team}";',
            f'DEVELOPMENT_TEAM = "{config["apple_team_id"]}";',
        )
    time_text = ensure_display_name(time_text, time_bundle, config["time_app_name"])
    time_text = ensure_display_name(
        time_text,
        f"{time_bundle}.widget",
        f"{config['time_app_name']} Widget",
    )
    time_text = ensure_display_name(
        time_text,
        f"{time_bundle}.watch",
        f"{config['time_app_name']} Watch",
    )
    time_project.write_text(time_text, encoding="utf-8")

    group_id = f"group.{time_bundle}"
    icloud_id = f"iCloud.{time_bundle}"
    for path in [
        TIME_APP / "WorkTrackingWidgetExtension.entitlements",
        TIME_APP / "Zeiterfassung" / "Zeiterfassung.entitlements",
        TIME_APP / "Zeiterfassung Watch App Watch App" / "Zeiterfassung Watch App Watch App.entitlements",
        TIME_APP / "Zeiterfassung" / "SharedDefaults.swift",
        TIME_APP / "Zeiterfassung" / "PortalAWSConfig.swift",
    ]:
        identifiers = [
            ("group.ch.example.immobilientool.time", group_id),
            ("iCloud.ch.example.immobilientool.time", icloud_id),
        ]
        if previous_time_bundle:
            identifiers.extend([
                (f"group.{previous_time_bundle}", group_id),
                (f"iCloud.{previous_time_bundle}", icloud_id),
            ])
        replace_text(path, identifiers)

    config["app_bundle_id"] = app_bundle
    config["time_bundle_id"] = time_bundle
    STATE_FILE.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def ensure_prerequisites(config: dict, *, deploy: bool) -> None:
    required = ["node", "npm"] if deploy else []
    if config.get("logo_path") or config.get("tenant_icon_path") or config.get("time_icon_path"):
        required += ["sips"]
    if deploy:
        required += ["aws"]
    missing = [name for name in required if not shutil.which(name)]
    if missing:
        raise RuntimeError("Fehlende Programme: " + ", ".join(missing))

    if deploy:
        result = aws(["sts", "get-caller-identity"], config, check=False)
        if result.returncode != 0:
            print(f"AWS-Profil '{config['aws_profile']}' ist noch nicht verwendbar.")
            answer = ask("Jetzt 'aws configure' für dieses Profil starten? (j/n)", "j").lower()
            if answer.startswith("j"):
                run(["aws", "configure", "--profile", config["aws_profile"]])
                aws(["sts", "get-caller-identity"], config)
            else:
                raise RuntimeError("AWS-Anmeldung fehlt.")


def ensure_amplify_app(config: dict) -> None:
    if not config.get("amplify_app_id"):
        response = aws([
            "amplify", "create-app",
            "--name", config["web_app_name"],
            "--platform", "WEB",
            "--enable-branch-auto-build",
        ], config)
        app = json.loads(response.stdout)["app"]
        config["amplify_app_id"] = app["appId"]
        config["default_domain"] = app["defaultDomain"]

    branch_check = aws([
        "amplify", "get-branch",
        "--app-id", config["amplify_app_id"],
        "--branch-name", BRANCH,
    ], config, check=False)
    if branch_check.returncode != 0:
        aws([
            "amplify", "create-branch",
            "--app-id", config["amplify_app_id"],
            "--branch-name", BRANCH,
            "--stage", "PRODUCTION",
            "--enable-auto-build",
        ], config)

    config["portal_url"] = f"https://{BRANCH}.{config['default_domain']}"
    STATE_FILE.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def deploy_backend(config: dict) -> None:
    print("\nInstalliere Node-Abhängigkeiten und deploye das neue Backend ...")
    run(["npm", "ci"], cwd=SERVER)
    env = os.environ.copy()
    env.update({
        "AWS_PROFILE": config["aws_profile"],
        "AWS_REGION": config["aws_region"],
        "BRAND_NAME": config["brand_name"],
        "CONTACT_EMAIL": config["contact_email"],
        "CONTACT_PHONE": config["contact_phone"],
        "CONTACT_ADDRESS": config["contact_address"],
        "PORTAL_URL": config["portal_url"],
        "APNS_PLATFORM_APP_ARN": config.get("apns_arn") or "",
    })
    run([
        "npx", "ampx", "pipeline-deploy",
        "--branch", BRANCH,
        "--app-id", config["amplify_app_id"],
        "--outputs-out-dir", ".",
    ], cwd=SERVER, env=env)

    outputs = json.loads((SERVER / "amplify_outputs.json").read_text(encoding="utf-8"))
    app_outputs = APP / "ImmobilienApp" / "amplify_outputs.json"
    app_outputs.write_text(json.dumps(outputs, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    auth = outputs["auth"]
    data = outputs["data"]
    swift_config = TIME_APP / "Zeiterfassung" / "PortalAWSConfig.swift"
    swift_config.write_text(
        "// Generated by setup.py. Do not commit production values to a public fork.\n"
        "import Foundation\n\n"
        "enum PortalAWSConfig {\n"
        f'    static let region          = "{auth["aws_region"]}"\n'
        f'    static let userPoolId      = "{auth["user_pool_id"]}"\n'
        f'    static let clientId        = "{auth["user_pool_client_id"]}"\n'
        f'    static let graphqlEndpoint = "{data["url"]}"\n'
        '    static let cognitoEndpoint = "https://cognito-idp.\\(region).amazonaws.com/"\n'
        "}\n\n"
        "extension UserDefaults {\n"
        f'    static let portalGroup = UserDefaults(suiteName: "group.{config["time_bundle_id"]}") ?? .standard\n'
        '    var portalIdToken: String? { get { string(forKey: "portal.idToken") } set { set(newValue, forKey: "portal.idToken") } }\n'
        '    var portalAccessToken: String? { get { string(forKey: "portal.accessToken") } set { set(newValue, forKey: "portal.accessToken") } }\n'
        '    var portalRefreshToken: String? { get { string(forKey: "portal.refreshToken") } set { set(newValue, forKey: "portal.refreshToken") } }\n'
        '    var portalTokenExpiry: Date? { get { object(forKey: "portal.tokenExpiry") as? Date } set { set(newValue, forKey: "portal.tokenExpiry") } }\n'
        '    var portalEmail: String? { get { string(forKey: "portal.email") } set { set(newValue, forKey: "portal.email") } }\n'
        '    var portalMitarbeiterId: String? { get { string(forKey: "portal.mitarbeiterId") } set { set(newValue, forKey: "portal.mitarbeiterId") } }\n'
        '    var portalMitarbeiterName: String? { get { string(forKey: "portal.mitarbeiterName") } set { set(newValue, forKey: "portal.mitarbeiterName") } }\n'
        '    var portalSyncEnabled: Bool { get { bool(forKey: "portal.syncEnabled") } set { set(newValue, forKey: "portal.syncEnabled") } }\n'
        '    var portalLastSync: Date? { get { object(forKey: "portal.lastSync") as? Date } set { set(newValue, forKey: "portal.lastSync") } }\n'
        '    var portalSyncedEntryIds: Set<String> { get { Set((array(forKey: "portal.syncedIds") as? [String]) ?? []) } set { set(Array(newValue), forKey: "portal.syncedIds") } }\n'
        "}\n",
        encoding="utf-8",
    )
    config["user_pool_id"] = auth["user_pool_id"]
    config["user_pool_client_id"] = auth["user_pool_client_id"]
    config["graphql_endpoint"] = data["url"]
    STATE_FILE.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def create_admin(config: dict) -> str:
    print("\nErstelle das erste Administratorkonto ...")
    password = getpass.getpass("Permanentes Admin-Passwort (mind. 8 Zeichen, Gross/Klein/Zahl/Sonderzeichen): ")
    if len(password) < 8:
        raise ValueError("Das Admin-Passwort ist zu kurz.")
    create = aws([
        "cognito-idp", "admin-create-user",
        "--user-pool-id", config["user_pool_id"],
        "--username", config["admin_email"],
        "--user-attributes",
        f"Name=email,Value={config['admin_email']}",
        "Name=email_verified,Value=true",
        "--message-action", "SUPPRESS",
    ], config, check=False)
    if create.returncode != 0 and "UsernameExistsException" not in create.stderr:
        raise RuntimeError(create.stderr.strip())
    aws([
        "cognito-idp", "admin-set-user-password",
        "--user-pool-id", config["user_pool_id"],
        "--username", config["admin_email"],
        "--password", password,
        "--permanent",
    ], config)
    return password


def build_and_host(config: dict) -> None:
    print("\nBaue und veröffentliche das Web-Portal ...")
    run(["npm", "run", "build"], cwd=SERVER)
    archive = ROOT / "work" / "web-dist.zip"
    archive.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as output:
        for path in (SERVER / "dist").rglob("*"):
            if path.is_file():
                output.write(path, path.relative_to(SERVER / "dist"))

    deployment = json.loads(aws([
        "amplify", "create-deployment",
        "--app-id", config["amplify_app_id"],
        "--branch-name", BRANCH,
    ], config).stdout)
    request = urllib.request.Request(deployment["zipUploadUrl"], data=archive.read_bytes(), method="PUT")
    request.add_header("Content-Type", "application/zip")
    with urllib.request.urlopen(request, timeout=300) as response:
        if response.status >= 300:
            raise RuntimeError(f"Hosting-Upload fehlgeschlagen: HTTP {response.status}")

    aws([
        "amplify", "start-deployment",
        "--app-id", config["amplify_app_id"],
        "--branch-name", BRANCH,
        "--job-id", deployment["jobId"],
    ], config)
    for _ in range(60):
        result = json.loads(aws([
            "amplify", "get-job",
            "--app-id", config["amplify_app_id"],
            "--branch-name", BRANCH,
            "--job-id", deployment["jobId"],
        ], config).stdout)
        status = result["job"]["summary"]["status"]
        print("Hosting:", status)
        if status == "SUCCEED":
            return
        if status in {"FAILED", "CANCELLED"}:
            raise RuntimeError(f"Hosting-Deployment endete mit {status}.")
        time.sleep(10)
    raise RuntimeError("Zeitüberschreitung beim Hosting-Deployment.")


def verify() -> None:
    run([sys.executable, str(ROOT / "scripts" / "verify_public_release.py")], cwd=ROOT)


def main() -> int:
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--configure-only", action="store_true", help="Nur Branding/Xcode konfigurieren")
    mode.add_argument(
        "--update-deployment",
        action="store_true",
        help="Bestehendes Backend und Webportal nach einem Code-Update aktualisieren",
    )
    parser.add_argument(
        "--apply-saved",
        action="store_true",
        help="Gespeicherte Konfiguration ohne erneute Eingabefragen anwenden",
    )
    parser.add_argument("--yes", action="store_true", help="Zusammenfassung ohne Rückfrage bestätigen")
    args = parser.parse_args()

    existing = json.loads(STATE_FILE.read_text(encoding="utf-8")) if STATE_FILE.exists() else {}
    if args.apply_saved:
        if not existing:
            raise RuntimeError("Keine gespeicherte Konfiguration gefunden. Zuerst setup.py ausführen.")
        config = dict(existing)
    else:
        config = collect_config(existing)
    print_summary(config, deploy=not args.configure_only)
    if not args.yes:
        confirmation = ask("Mit diesen Angaben fortfahren? (j/n)", "j").lower()
        if not confirmation.startswith("j"):
            print("Setup ohne Änderungen beendet.")
            return 0
    ensure_prerequisites(config, deploy=not args.configure_only)
    configure_sources(config, existing)

    if args.configure_only:
        verify()
        print("\nKonfiguration abgeschlossen. Es wurden keine AWS-Ressourcen erstellt.")
        return 0

    if args.update_deployment:
        if not config.get("amplify_app_id"):
            raise RuntimeError("Keine bestehende Amplify-App in der Konfiguration gefunden.")
        ensure_amplify_app(config)
        deploy_backend(config)
        build_and_host(config)
        verify()
        print("\nUpdate erfolgreich veröffentlicht.")
        print("Portal:", config["portal_url"])
        return 0

    ensure_amplify_app(config)
    deploy_backend(config)
    admin_password = create_admin(config)
    build_and_host(config)

    csv_path = ask(
        "Handwerker-CSV jetzt importieren? Pfad eingeben oder leer lassen",
        "",
        required=False,
    )
    if csv_path:
        run([
            sys.executable,
            str(ROOT / "scripts" / "import_handwerker.py"),
            "--outputs", str(SERVER / "amplify_outputs.json"),
            "--csv", str(Path(csv_path).expanduser()),
            "--email", config["admin_email"],
        ], cwd=ROOT, env={**os.environ, "IMMOBILIENTOOL_ADMIN_PASSWORD": admin_password})

    verify()
    print("\nSetup erfolgreich.")
    print("Portal:", config["portal_url"])
    print("Mieter-App:", APP / "ImmobilienApp.xcodeproj")
    print("Zeiterfassung:", TIME_APP / "Zeiterfassung.xcodeproj")
    print("Hinweis: SES-Absender und Apple Push müssen in den jeweiligen AWS-/Apple-Konsolen verifiziert werden.")
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
