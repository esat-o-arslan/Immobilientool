# Immobilientool

Open-Source-Grundlage für Schweizer Immobilienverwaltungen mit Webportal,
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

Weitere Einzelheiten stehen in [`docs/SETUP.md`](docs/SETUP.md#8-updates).

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

## Lizenz

MIT, siehe `LICENSE`.
