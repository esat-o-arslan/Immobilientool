# Immobilientool

Kostenlos bereitgestellte, source-available Grundlage für Schweizer Immobilienverwaltungen mit Webportal,
Mieter-/Eigentümer-App und Zeiterfassung. Die Vorlage ist für einen frischen,
leeren Mandanten ausgelegt und enthält keine Liegenschaften, Mietenden,
Eigentümerschaften, Mitarbeitenden, Dokumente oder produktiven AWS-Verbindungen.

## Bestandteile

- `Server/`: React-Webportal und AWS-Amplify-Gen-2-Backend
- `App/`: SwiftUI-App für Mietende, Eigentümerschaften und Mitarbeitende
- `Zeiterfassung/`: SwiftUI-App inklusive Widget und Watch-App
- `setup.py`: interaktive Ersteinrichtung und AWS-Deployment
- `scripts/verify_public_release.py`: Prüfung auf Secrets und bekannte Produktiv-IDs
- `scripts/import_handwerker.py`: optionaler Handwerker-Import aus CSV

## Voraussetzungen

- macOS mit Xcode 16 oder neuer
- Python 3.10 oder neuer
- Node.js 20 oder neuer und npm
- AWS CLI v2
- AWS-Konto mit Berechtigungen für Amplify, CloudFormation, Cognito, AppSync,
  DynamoDB, Lambda, S3, IAM, SES, SNS und Bedrock
- Für App-Store-Veröffentlichungen: Apple Developer Program

AWS-Ressourcen und optionale KI-, E-Mail- und Push-Funktionen können Kosten
verursachen. Vor einem produktiven Einsatz müssen Rollen, Datenschutz,
Aufbewahrungsfristen, Backups und Zugriffsrechte geprüft werden.

## Schnellstart

```bash
cd Immobilientool
python3 setup.py
```

Der Assistent fragt unter anderem nach:

- Plattform- und App-Namen
- Firmenlogo für Webportal, Zeiterfassung, Widget und Watch-App
- getrennten App-Icons für Mieter-/Eigentümer-App und Zeiterfassung
- Kontakt- und Admin-E-Mail
- Apple Bundle-Prefix und Team-ID
- AWS-CLI-Profil und Region
- optionaler SNS-APNs-ARN

Danach erstellt er eine neue Amplify-App, deployt ein neues Backend, erzeugt
die Client-Konfigurationen, richtet das erste Admin-Konto ein, baut das
Webportal und veröffentlicht es über Amplify Hosting.

AWS-Zugangsdaten werden über ein lokales AWS-CLI-Profil verwendet und niemals
in dieses Repository geschrieben. Für eine reine lokale Konfiguration ohne
Cloud-Ressourcen:

```bash
python3 setup.py --configure-only
```

Logo und App-Icons sind optional. Ohne eigene Dateien werden neutrale
Standardgrafiken verwendet. Unterstützt werden:

- Firmenlogo: SVG, PNG oder JPG
- App-Icons: quadratische PNG- oder JPG-Dateien mit mindestens 1024 × 1024 px

Das Setup zeigt vor der Ausführung eine Zusammenfassung. Für automatisierte
Testläufe kann die Bestätigung mit `--yes` übersprungen werden.

Eine vollständige Schritt-für-Schritt-Anleitung mit Vorbereitung, Branding,
AWS-Deployment und Xcode-Abschluss steht in [`docs/SETUP.md`](docs/SETUP.md).

## Hilfe für Einsteiger

Wer wenig Erfahrung mit Terminal, AWS oder Xcode hat, kann die Installation
gemeinsam mit einem KI-Coding-Assistenten durchführen:

- [Claude Code von Anthropic](https://docs.anthropic.com/en/docs/claude-code/quickstart)
- [OpenAI Codex](https://developers.openai.com/codex/quickstart)
- [OpenAI Codex CLI](https://developers.openai.com/codex/cli)

Öffne das Projekt im jeweiligen Assistenten und verwende beispielsweise:

> Lies zuerst README.md und docs/SETUP.md. Führe mich Schritt für Schritt durch
> die Installation des Immobilientools. Erkläre jede Rückfrage verständlich,
> prüfe Voraussetzungen und führe keine kostenpflichtige oder irreversible
> Aktion ohne meine ausdrückliche Bestätigung aus.

KI-Assistenten können Fehler machen und Befehle sowie Dateien verändern.
Änderungen, AWS-Kosten und Sicherheitsabfragen müssen deshalb vor der
Bestätigung geprüft werden. Passwörter, API-Schlüssel und personenbezogene
Daten dürfen nicht in Prompts oder öffentliche Chats kopiert werden.

## Updates

Eine bestehende Installation prüft und aktualisiert sich über:

```bash
python3 update.py
```

Der Updater zeigt die installierte und die auf GitHub verfügbare Version,
erstellt unter `backups/` eine Sicherung und schützt lokale Mandanten- sowie
AWS-Konfigurationen. Eigene Namen, Logos, App-Icons und Bundle-IDs werden nach
dem Download automatisch erneut angewendet. Anschliessend kann das bestehende
AWS-Backend samt Webportal optional aktualisiert werden.

Nur nach einer neuen Version suchen:

```bash
python3 update.py --check-only
```

Weitere Einzelheiten stehen in [`docs/SETUP.md`](docs/SETUP.md#9-updates).

## AWS-Anmeldung

Falls noch kein Profil existiert:

```bash
aws configure --profile immobilientool
aws sts get-caller-identity --profile immobilientool
```

Alternativ kann AWS IAM Identity Center/SSO verwendet werden. Das Setup prüft
das Profil vor dem Deployment.

## Handwerker übernehmen

Personen- und Liegenschaftsdaten werden bewusst nicht übernommen. Handwerker
können nach dem Deployment über eine CSV importiert werden. Als Formatvorlage
dient `data/handwerker.example.csv`. Das Setup fragt am Ende optional nach dem
Pfad zur CSV.

Produktive Handwerkerdaten werden nicht automatisch aus einem bestehenden
System gelesen. Das verhindert, dass der Veröffentlichungsprozess versehentlich
auf eine produktive Datenbank zugreift.

## Xcode

Nach dem Setup:

1. `App/ImmobilienApp.xcodeproj` öffnen.
2. Signing & Capabilities prüfen und das konfigurierte Apple-Team auswählen.
3. Push Notifications und Background Modes nur aktivieren, wenn APNs/SNS
   eingerichtet wurden.
4. `Zeiterfassung/Zeiterfassung.xcodeproj` öffnen.
5. App Group, iCloud-Container, Widget und Watch-App im Apple Developer Portal
   für die neuen Bundle-IDs anlegen.
6. Auf echten Geräten testen, bevor Archive für TestFlight erstellt werden.

Die Mieter-/Eigentümer-App verwendet bereits den neutralen Projekt- und
Targetnamen `ImmobilienApp`. Auch Swift-Typen, Dateien und Bild-Assets sind
neutral benannt; sichtbare App-Namen und Bundle-IDs werden vom Setup angepasst.

## GitHub und CI/CD

Vor jedem Push:

```bash
python3 scripts/verify_public_release.py
cd Server && npm ci && npm run build
```

`amplify.yml` ist für ein Repository vorbereitet, dessen Root dieser Ordner
ist. Beim Verbinden mit Amplify Hosting müssen `AWS_APP_ID` und `AWS_BRANCH`
von Amplify bereitgestellt werden. Versioniert werden nur
`amplify_outputs.example.json`-Vorlagen. Echte `amplify_outputs.json`-Dateien
erzeugt das Setup lokal; sie bleiben durch `.gitignore` ausgeschlossen.

## Sicherheit und Datenschutz

- Keine echten Daten als Demo- oder Seed-Daten einchecken.
- `amplify_outputs.json` enthält zwar keine Passwörter, kann aber produktive
  Infrastruktur offenlegen und sollte nach dem Setup nicht veröffentlicht werden.
- Apple Zertifikate, Provisioning Profiles, `.env`-Dateien und AWS-Credentials
  gehören nie ins Repository.
- Standortdaten der Zeiterfassung sind besonders schützenswert. Geofencing und
  Cloud-Synchronisation müssen transparent, freiwillig und rechtlich geprüft sein.
- Für Basel-Stadt, Basel-Landschaft, Aargau und Solothurn sind kantonale
  Feiertage und lohnbezogene Berechnungen vor produktiver Nutzung fachlich zu
  validieren. Die App ersetzt keine Rechts-, Steuer- oder Lohnberatung.

Sicherheitsmeldungen bitte nicht als öffentliche GitHub-Issue veröffentlichen,
sondern gemäß `SECURITY.md` behandeln.

## Feedback und Fehler

Feedback, Ideen für neue Funktionen und reproduzierbare Fehlerberichte sind
willkommen:

- GitHub Issues im Repository
- E-Mail: [e.arslan2025@gmail.com](mailto:e.arslan2025@gmail.com)

Bitte niemals Passwörter, AWS-Schlüssel, personenbezogene Daten oder Details zu
noch nicht behobenen Sicherheitslücken öffentlich melden.

## Urheberrecht, Nutzung und Haftung

Copyright © 2026 Esat Arslan. Das Projekt und seine Bestandteile bleiben
urheberrechtlich geschütztes Eigentum von Esat Arslan. Der Quellcode wird
kostenlos zur Einsicht, internen Nutzung und Anpassung bereitgestellt.

Weiterverkauf, entgeltliche Bereitstellung, kommerzieller Vertrieb,
Unterlizenzierung oder Veröffentlichung als eigenes Produkt sind ohne vorherige
schriftliche Erlaubnis untersagt. Unzulässige Nutzung oder Verwertung kann
zivil- und, soweit anwendbar, strafrechtlich verfolgt werden.

Die Software wird ohne Gewährleistung und auf eigenes Risiko bereitgestellt.
Es wird keine Haftung für Datenverlust, Betriebsunterbruch, Sicherheitsvorfälle,
Fehlkonfigurationen, Cloud-Kosten oder sonstige direkte oder indirekte Schäden
übernommen, soweit ein Haftungsausschluss gesetzlich zulässig ist.

Verbindlich ist die vollständige Lizenz in [`LICENSE`](LICENSE). Dieser Text
ist keine Rechtsberatung.
