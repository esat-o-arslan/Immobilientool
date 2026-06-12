# Einrichtung Schritt für Schritt

Diese Anleitung richtet einen neuen, leeren Mandanten ein. Das Setup greift
nicht auf eine bestehende produktive Installation oder deren Daten zu.

## 1. Dateien vorbereiten

Bereitlegen:

- Firmenlogo als SVG, PNG oder JPG
- App-Icon für die Immobilien-App als quadratisches PNG/JPG, mindestens 1024 px
- App-Icon für Zeiterfassung und Watch-App, ebenfalls mindestens 1024 px
- gewünschte Namen, Kontaktangaben und Apple Bundle-Prefix
- AWS-Konto und optional eine Apple Developer Team-ID

Ohne eigene Grafiken bleiben die neutralen Immobilientool-Grafiken aktiv.

## 2. AWS anmelden

AWS CLI v2 installieren und ein separates Profil anlegen:

```bash
aws configure --profile immobilientool
aws sts get-caller-identity --profile immobilientool
```

Das Profil benötigt Berechtigungen für die im README genannten AWS-Dienste.
Zugangsschlüssel werden nur von der AWS CLI verwaltet und nicht gespeichert.

## 3. Setup starten

Im Terminal in den Projektordner wechseln:

```bash
cd Immobilientool
python3 setup.py
```

Der Assistent führt durch vier Abschnitte:

1. Namen, Firmenlogo und beide App-Icons
2. öffentliche Kontaktangaben und erstes Administratorkonto
3. Apple Bundle-Prefix und optionale Team-ID
4. AWS-Profil, Region und optionale Push-Konfiguration

Vor Änderungen zeigt das Setup eine Zusammenfassung und verlangt eine
Bestätigung. Ungültige Dateipfade und zu kleine oder nicht quadratische Icons
werden mit einer verständlichen Meldung abgelehnt.

## 4. Was automatisch geschieht

Nach der Bestätigung:

1. Branding und sichtbare App-Namen werden ersetzt.
2. Neue Bundle-IDs, App Groups und iCloud-IDs werden eingetragen.
3. Eine neue Amplify-App und ein neues Backend werden erstellt.
4. Neue Cognito-, AppSync-, DynamoDB-, Lambda- und S3-Ressourcen entstehen.
5. Das erste Administratorkonto wird angelegt.
6. Das Webportal wird gebaut und zu Amplify Hosting hochgeladen.
7. Die erzeugte AWS-Konfiguration wird lokal in die Apps übernommen.

Es werden keine Liegenschaften, Mitarbeitenden oder anderen Personendaten aus
einem bestehenden System kopiert. Handwerker können danach freiwillig aus
einer eigenen CSV importiert werden.

## 5. Erst lokal ausprobieren

Für Branding und Xcode-Konfiguration ohne AWS-Ressourcen:

```bash
python3 setup.py --configure-only
```

Das Setup darf erneut ausgeführt werden. Bestehende Antworten erscheinen als
Vorgaben und können geändert werden. Bei den drei Grafikpfaden entfernt `-`
eine zuvor gespeicherte Auswahl.

## 6. Xcode abschliessen

Nach erfolgreichem Setup:

1. `App/ImmobilienApp.xcodeproj` öffnen und Signing prüfen.
2. `Zeiterfassung/Zeiterfassung.xcodeproj` öffnen.
3. Team, App Group, iCloud, Widget und Watch-App im Apple Developer Portal
   freischalten.
4. Beide Apps auf Simulator und echtem Gerät testen.
5. Erst danach Archive für TestFlight oder den App Store erstellen.

## 7. Typische Abbrüche

- `AWS-Anmeldung fehlt`: Profil mit `aws configure` oder SSO anmelden.
- `App-Icon muss quadratisch sein`: quadratische Ausgangsdatei verwenden.
- `App-Icon muss mindestens 1024x1024 px gross sein`: grössere Datei wählen.
- Xcode-Signingfehler: korrektes Apple-Team und neue Bundle-IDs prüfen.
- SES-E-Mailfehler: Absenderdomain oder Adresse in AWS SES verifizieren.

Das Setup kann nach einer Korrektur erneut gestartet werden.

## 8. Updates

Neue veröffentlichte Versionen lassen sich direkt von GitHub laden:

```bash
python3 update.py
```

Der Ablauf:

1. Lokale und verfügbare Version werden angezeigt.
2. Vor jeder Änderung entsteht ein ZIP-Backup unter `backups/`.
3. Neue und geänderte Projektdateien werden eingespielt.
4. Lokale Mandantenkonfiguration und AWS-Ausgaben bleiben erhalten.
5. Namen, Logos, App-Icons und Apple-IDs werden automatisch erneut angewendet.
6. Auf Wunsch werden das bestehende AWS-Backend und Webportal aktualisiert.

Eine reine Versionsprüfung verändert keine Dateien:

```bash
python3 update.py --check-only
```

Für einen beaufsichtigten automatischen Lauf inklusive AWS-Veröffentlichung:

```bash
python3 update.py --yes --deploy
```

Eigene Änderungen am Programmcode sollten vor einem Update separat gesichert
oder über einen eigenen Git-Branch gepflegt werden. Das automatisch erstellte
Backup erlaubt die Wiederherstellung überschriebener Projektdateien.
