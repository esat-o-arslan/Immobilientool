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
- `scripts/sync_erp.py`: kontrollierter Import aus GARAIO REM, Rimo R5 und ImmoTop2

## Was kann das Immobilientool?

### Webportal (Browser)

Das Webportal läuft in jedem Browser und ist für die Verwaltung von Immobilien ausgelegt.
Mitarbeitende und Verwalter haben Zugriff auf folgende Bereiche:

- **Liegenschaften und Einheiten** — Objekte anlegen, bearbeiten und Mieter/Eigentümer zuweisen
- **Kontakte** — Mietende, Eigentümerschaften, Mitarbeitende und externe Kontakte verwalten
- **Schadenfälle** — Meldungen erfassen, Handwerker zuweisen, Status verfolgen
- **Handwerker** — Stammdaten mit Gewerk, Bewertung, Stundensatz und Einsatzgebiet
- **Mitarbeitende** — Zugriffsrechte und Konten über AWS Cognito verwalten
- **Suche** — Volltextsuche über alle Bereiche
- **KI-Assistent** — kontextbezogene Unterstützung per AWS Bedrock
- **Dokumente** — Upload und Verwaltung über AWS S3
- **ERP-Synchronisation** — kontrollierter Import aus GARAIO REM, Rimo R5 und ImmoTop2

### Immobilien-App (iOS)

Die SwiftUI-App richtet sich an Mietende, Eigentümerschaften und Mitarbeitende.
Sie wird über den regulären App Store vertrieben und erfordert pro App-Veröffentlichung
eine Prüfung durch Apple über **App Store Connect**.

- Schadenmeldungen mit Foto und Beschreibung direkt aus der App
- Dokumentenzugriff (Mietvertrag, Nebenkostenabrechnung etc.)
- Push-Benachrichtigungen bei Statusänderungen
- Direktkontakt zur Verwaltung per Chat oder E-Mail

**App Store (iOS):** Das Apple Developer Program kostet **109 CHF pro Jahr**.
Die Prüfung durch Apple dauert in der Regel **1 bis 1,5 Wochen**, bevor die App
im App Store bereitgestellt werden kann.

### Zeiterfassungs-App (iOS)

Die SwiftUI-App mit Widget und Watch-App ist für Mitarbeitende und Handwerker gedacht.
Sie erfasst Arbeitszeiten, unterstützt Geofencing und synchronisiert mit der Cloud.

- Zeiterfassung per Tap oder automatisch per Standort (Geofencing)
- Widget für schnellen Zugriff auf dem Homescreen
- Apple Watch App für Erfassung direkt am Handgelenk
- Kanton-spezifische Feiertage (BS, BL, AG, SO)
- Stundenübersichten und Export

> **Wichtig:** Die Zeiterfassungs-App muss im App Store Connect als
> **nicht gelistet** beantragt werden. Sie ist damit nicht öffentlich
> auffindbar, kann aber per direktem Link oder QR-Code an Mitarbeitende
> verteilt werden. Die Prüfung durch Apple dauert ebenfalls ca. **1 bis
> 1,5 Wochen**.

### Android (optional)

Eine Android-Version ist technisch möglich, da das Backend (AWS Amplify) plattformunabhängig ist.
Vor der Veröffentlichung im Google Play Store gilt:

> **Neue Apps müssen von mindestens 20 Personen über einen Zeitraum von
> mindestens 14 Tagen aktiv getestet werden**, bevor Google eine Vollveröffentlichung
> im Play Store genehmigt (sogenanntes Closed-Testing-Verfahren). Erst nach
> erfolgreichem Abschluss dieser Phase ist eine Produktion im Play Store möglich.

---

## Schritt-für-Schritt-Einrichtung

### Schritt 1: Voraussetzungen installieren

Alle folgenden Programme müssen auf dem Mac installiert sein, bevor das Setup gestartet wird.

**Xcode 16**
Im Mac App Store suchen und installieren. Nach der Installation einmalig öffnen,
damit die Command Line Tools eingerichtet werden.

**Homebrew** (vereinfacht alle weiteren Installationen)
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

**Python 3.10 oder neuer**
```bash
brew install python3
python3 --version
```

**Node.js 20 oder neuer**
```bash
brew install node@20
node --version
npm --version
```

**AWS CLI v2**
```bash
brew install awscli
aws --version
```

---

### Schritt 2: AWS-Konto einrichten

Das Webportal und das Backend laufen auf AWS (Amazon Web Services). Ein Konto ist zwingend erforderlich.

1. Konto erstellen auf [aws.amazon.com](https://aws.amazon.com) (kostenlos, Kreditkarte erforderlich)
2. Im AWS-Konto einen IAM-Benutzer mit den folgenden Berechtigungen anlegen:
   `Amplify`, `CloudFormation`, `Cognito`, `AppSync`, `DynamoDB`, `Lambda`, `S3`, `IAM`, `SES`, `SNS`, `Bedrock`
3. Zugangsdaten (Access Key + Secret) des IAM-Benutzers im Terminal eintragen:

```bash
aws configure --profile immobilientool
```

Das Terminal fragt nacheinander nach:
- `AWS Access Key ID` — aus dem IAM-Benutzer
- `AWS Secret Access Key` — aus dem IAM-Benutzer
- `Default region name` — z.B. `eu-central-1` (Frankfurt)
- `Default output format` — einfach Enter drücken

Verbindung prüfen:
```bash
aws sts get-caller-identity --profile immobilientool
```
Erscheint eine JSON-Ausgabe mit einer Account-ID, ist die Verbindung erfolgreich.

> AWS-Ressourcen können Kosten verursachen. Vor produktivem Einsatz müssen
> Rollen, Datenschutz, Backups und Zugriffsrechte geprüft werden.

---

### Schritt 3: Apple Developer Account einrichten (für iOS-Apps)

Dieser Schritt ist **nur für die Veröffentlichung im App Store** notwendig. Wer die Apps lediglich lokal auf dem eigenen Gerät installieren oder im Xcode-Simulator testen möchte, kann diesen Schritt überspringen.

1. Unter [developer.apple.com](https://developer.apple.com) mit der Apple-ID anmelden
2. Dem **Apple Developer Program** beitreten — Kosten: **109 CHF pro Jahr**
3. Nach der Aktivierung (dauert meist wenige Stunden bis 1 Tag) im Apple Developer Portal die **Team-ID** notieren — sie findet sich unter *Membership Details*

---

### Schritt 4: Repository herunterladen

```bash
git clone https://github.com/esat-o-arslan/Immobilientool.git
cd Immobilientool
```

Alternativ auf GitHub oben rechts auf **Code → Download ZIP** klicken, entpacken und in den Ordner wechseln.

---

### Schritt 5: Setup ausführen

```bash
python3 setup.py
```

Der Assistent führt in vier Abschnitten durch die Einrichtung und fragt nach:

**1/4 Namen und Branding**
- Name der Plattform, Web-App und Apps
- Firmenlogo (SVG/PNG/JPG, optional)
- App-Icons für Mieter-App und Zeiterfassung (quadratisch, mind. 1024 × 1024 px, optional)

**2/4 Kontaktangaben**
- Admin-E-Mail (erstes Administratorkonto)
- Öffentliche Kontakt-E-Mail, Telefonnummer, Adresse und Webseite

**3/4 Apple-Konfiguration**
- Bundle-Prefix (z.B. `ch.meinefirma`)
- Apple Developer Team-ID (aus Schritt 3)

**4/4 AWS-Konfiguration**
- AWS-CLI-Profil (aus Schritt 2, z.B. `immobilientool`)
- AWS-Region (z.B. `eu-central-1`)
- SNS APNs ARN (optional, nur für Push-Benachrichtigungen)

Nach der Bestätigung der Zusammenfassung erstellt das Setup automatisch:
- Eine neue AWS Amplify-App
- Das gesamte Backend (DynamoDB, Cognito, AppSync, Lambda, S3)
- Das erste Administratorkonto
- Den Build und die Veröffentlichung des Webportals

Alle Einstellungen werden lokal in `.immobilientool-config.json` gespeichert.

---

### Schritt 6: Handwerker importieren (optional)

Nach dem Setup können bestehende Handwerkerdaten aus einer CSV-Datei importiert werden.
Als Vorlage dient `data/handwerker.example.csv`. Das Setup fragt am Ende automatisch danach.

Nachträglich importieren:
```bash
python3 scripts/import_handwerker.py \
  --outputs Server/amplify_outputs.json \
  --csv /pfad/zur/handwerker.csv \
  --email admin@meinefirma.ch
```

---

### Schritt 7: iOS-Apps in Xcode einrichten

**Immobilien-App:**

1. `App/ImmobilienApp.xcodeproj` in Xcode öffnen
2. Im Projekt-Navigator oben auf `ImmobilienApp` klicken → Reiter **Signing & Capabilities**
3. Unter *Team* das konfigurierte Apple Developer Team auswählen
4. Push Notifications und Background Modes nur aktivieren, wenn APNs/SNS in AWS eingerichtet wurden

**Zeiterfassungs-App:**

1. `Zeiterfassung/Zeiterfassung.xcodeproj` in Xcode öffnen
2. Signing & Capabilities für alle drei Targets prüfen: `Zeiterfassung`, `WorkTrackingWidget`, `Zeiterfassung Watch App`
3. Im [Apple Developer Portal](https://developer.apple.com) für die neuen Bundle-IDs anlegen:
   - App Group (`group.ch.meinefirma.zeiterfassung`)
   - iCloud-Container
   - Widget Extension
   - Watch App
4. Auf einem echten iPhone und einer Apple Watch testen — der Simulator unterstützt nicht alle Funktionen

---

### Schritt 8: Apps testen und veröffentlichen

**Testen mit TestFlight (empfohlen vor App Store)**

TestFlight ermöglicht schnelles Testen ohne vollständige App-Store-Prüfung:

1. In Xcode: **Product → Archive** erstellen
2. Im Xcode Organizer: **Distribute App → TestFlight** auswählen und hochladen
3. In App Store Connect unter *TestFlight* interne oder externe Tester einladen
4. Apple prüft TestFlight-Builds in der Regel innerhalb weniger Stunden

**Veröffentlichung im App Store**

1. In Xcode: **Product → Archive** erstellen
2. Im Xcode Organizer: **Distribute App → App Store Connect** auswählen
3. In App Store Connect eine neue Version anlegen und den Build zuweisen
4. **Immobilien-App:** Als öffentliche App einreichen
5. **Zeiterfassungs-App:** Als **nicht gelistete App** einreichen (nicht öffentlich auffindbar,
   Verteilung per Link oder QR-Code)
6. Apple-Prüfung abwarten — dauert in der Regel **1 bis 1,5 Wochen**
7. Nach Freigabe: App veröffentlichen

---

### Schritt 9: ERP-Synchronisation einrichten (optional)

Freigegebene CSV- oder JSON-Exporte aus GARAIO REM, Rimo R5 oder ImmoTop2 lassen sich
kontrolliert übernehmen. Zunächst eine Vorschau ohne Änderungen erstellen:

```bash
python3 scripts/sync_erp.py \
  --provider rimo-r5 \
  --source /pfad/zum/export \
  --report work/sync-vorschau.json
```

Erst nach Prüfung der Vorschau mit `--apply` tatsächlich importieren:

```bash
python3 scripts/sync_erp.py \
  --provider rimo-r5 \
  --source /pfad/zum/export \
  --apply
```

Der Import erstellt oder aktualisiert Liegenschaften und Kontakte, löscht aber keine Datensätze.
Anpassbare Mapping-Profile für alle drei ERP-Systeme liegen in `integrations/mappings/`.

Falls Spalten oder Exportmodule beim ERP-Anbieter fehlen, muss der jeweilige
Hersteller oder Implementierungspartner kontaktiert werden.

---

## Updates einspielen

Wenn eine neue Version des Immobilientools auf GitHub verfügbar ist, reicht ein einziger Befehl:

```bash
python3 update.py
```

Der Updater:
- zeigt die installierte und die verfügbare Version
- erstellt automatisch ein Backup unter `backups/`
- lädt die neueste Version herunter — inklusive aller neuen Funktionen in den iOS-Apps
- spielt Branding, Namen, Bundle-IDs und AWS-Konfiguration automatisch wieder ein
- fragt optional, ob das bestehende AWS-Backend und Webportal ebenfalls aktualisiert werden sollen

Eigene Einstellungen (`.immobilientool-config.json`, `amplify_outputs.json`) werden dabei
**nie überschrieben**.

**Nach einem Update die iOS-Apps ebenfalls aktualisieren:**

1. Xcode öffnen
2. Versionsnummer in Xcode erhöhen (z.B. 1.0 → 1.1)
3. Archive erstellen und in App Store Connect hochladen
4. Apple-Prüfung abwarten → Nutzer erhalten das Update automatisch im App Store

Nur auf neue Version prüfen ohne zu aktualisieren:

```bash
python3 update.py --check-only
```

---

## Hilfe für Einsteiger

Wer wenig Erfahrung mit Terminal, AWS oder Xcode hat, kann die Installation
gemeinsam mit einem KI-Coding-Assistenten durchführen:

- [Claude Code von Anthropic](https://docs.anthropic.com/en/docs/claude-code/quickstart)
- [OpenAI Codex CLI](https://github.com/openai/codex)

Öffne das Projekt im jeweiligen Assistenten und verwende beispielsweise:

> Lies zuerst die README.md. Führe mich Schritt für Schritt durch
> die Installation des Immobilientools. Erkläre jede Rückfrage verständlich,
> prüfe Voraussetzungen und führe keine kostenpflichtige oder irreversible
> Aktion ohne meine ausdrückliche Bestätigung aus.

KI-Assistenten können Fehler machen und Befehle sowie Dateien verändern.
Änderungen, AWS-Kosten und Sicherheitsabfragen müssen deshalb vor der
Bestätigung geprüft werden. Passwörter, API-Schlüssel und personenbezogene
Daten dürfen nicht in Prompts oder öffentliche Chats kopiert werden.

---

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

---

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

---

## Feedback und Fehler

Feedback, Ideen für neue Funktionen und reproduzierbare Fehlerberichte sind
willkommen:

- GitHub Issues im Repository
- E-Mail: [e.arslan2025@gmail.com](mailto:e.arslan2025@gmail.com)

Bitte niemals Passwörter, AWS-Schlüssel, personenbezogene Daten oder Details zu
noch nicht behobenen Sicherheitslücken öffentlich melden.

---

## Urheberrecht, Nutzung und Haftung

Copyright © 2026 Esat Arslan. Das Projekt und seine Bestandteile bleiben
urheberrechtlich geschütztes Eigentum von Esat Arslan. Der Quellcode wird
kostenlos zur Einsicht, internen Nutzung und Anpassung bereitgestellt.

Weiterverkauf, entgeltliche Bereitstellung, kommerzieller Vertrieb,
Unterlizenzierung oder Veröffentlichung als eigenes Produkt sind ohne vorherige
schriftliche Erlaubnis untersagt. Unzulässige Nutzung oder Verwertung kann
zivil- und, soweit anwendbar, strafrechtlich verfolgt werden.

Da das Repository öffentlich ist, erlauben die GitHub-Nutzungsbedingungen
anderen Personen das Ansehen und technische Forken innerhalb GitHubs. Ein
solcher Fork gewährt keine weitergehenden Nutzungs-, Vertriebs- oder
Vermarktungsrechte und bleibt vollständig an die `LICENSE` gebunden.

Die Software wird ohne Gewährleistung und auf eigenes Risiko bereitgestellt.
Es wird keine Haftung für Datenverlust, Betriebsunterbruch, Sicherheitsvorfälle,
Fehlkonfigurationen, Cloud-Kosten oder sonstige direkte oder indirekte Schäden
übernommen, soweit ein Haftungsausschluss gesetzlich zulässig ist.

Verbindlich ist die vollständige Lizenz in [`LICENSE`](LICENSE). Dieser Text
ist keine Rechtsberatung.
