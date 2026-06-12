# ERP-Datensynchronisation

`scripts/sync_erp.py` übernimmt freigegebene CSV- oder JSON-Exporte aus
GARAIO REM, Rimo R5 oder ImmoTop2 in einen eingerichteten Immobilientool-
Mandanten. Der Import legt Datensätze an oder aktualisiert sie anhand stabiler
Schlüsselfelder. Er löscht niemals Daten.

## Was unterstützt wird

- Liegenschaften
- Mietende, Eigentümerschaften und andere Kontaktpersonen
- eigene Profile für GARAIO REM, Rimo R5 und ImmoTop2
- CSV und JSON
- Vorschau ohne AWS-Schreibzugriff
- Validierung von Pflichtfeldern und Liegenschaftsbeziehungen
- wiederholbare Create-/Update-Läufe
- maschinenlesbarer JSON-Bericht

Die mitgelieferten Profile sind Startvorlagen. Feldnamen und verfügbare
Exporte unterscheiden sich je nach ERP-Version, lizenzierten Modulen und
individueller Kundeneinrichtung. Das Script umgeht keine Herstellerrechte,
Logins oder Zugriffsbeschränkungen und liest keine Daten direkt aus einer
fremden Datenbank.

## 1. Export beim ERP vorbereiten

Beim Hersteller oder Implementierungspartner einen strukturierten Export
anfordern:

- Liegenschaften mit eindeutiger Objekt- oder Liegenschaftsnummer
- Kontakte mit E-Mail und zugehöriger Objekt-/Liegenschaftsnummer
- UTF-8 CSV mit Kopfzeile oder JSON als Liste von Objekten
- Beschreibung der Spalten und der zulässigen Werte

Produktive Exporte enthalten Personendaten. Sie gehören in einen geschützten
lokalen Ordner ausserhalb des Git-Repositories und dürfen nicht in GitHub,
Supporttickets oder KI-Chats hochgeladen werden.

## 2. Profil anpassen

Profile liegen unter `integrations/mappings/`:

- `rimo-r5.example.json`
- `immotop2.example.json`
- `garaio-rem.example.json`

Eine lokale Kopie kann an die tatsächlichen Spaltennamen angepasst werden.
Unter `fields` steht links das Immobilientool-Feld und rechts die Quellspalte.
`references` verknüpft Kontakte anhand der externen Liegenschaftsnummer mit
der zuvor importierten Liegenschaft.

## 3. Vorschau ausführen

Der Standardlauf schreibt nichts nach AWS:

```bash
python3 scripts/sync_erp.py \
  --provider rimo-r5 \
  --source /geschuetzter/pfad/zum/export \
  --report work/rimo-vorschau.json
```

Für ImmoTop2 `--provider immotop2`, für GARAIO REM
`--provider garaio-rem` verwenden. Mit einem angepassten Profil wird
`--provider` durch `--mapping /pfad/mein-profil.json` ersetzt.

Vor der Übernahme müssen übersprungene Datensätze, fehlende Referenzen und
unerwartete Aktualisierungen im Bericht geprüft werden.

## 4. In Immobilientool übernehmen

Erst nach einer fehlerfreien Vorschau:

```bash
export IMMOBILIENTOOL_ADMIN_PASSWORD='lokales-admin-passwort'
python3 scripts/sync_erp.py \
  --provider rimo-r5 \
  --source /geschuetzter/pfad/zum/export \
  --outputs Server/amplify_outputs.json \
  --email admin@beispiel.ch \
  --apply \
  --report work/rimo-import.json
unset IMMOBILIENTOOL_ADMIN_PASSWORD
```

Das Passwort wird nur aus der Prozessumgebung gelesen und nicht gespeichert.
Die verwendete Administration muss im Zielmandanten existieren. Zuerst immer
in einer Testumgebung mit anonymisierten Beispieldaten prüfen und vor einem
produktiven Import ein Backup- und Wiederherstellungskonzept festlegen.

## Wenn die Synchronisation scheitert

Bei fehlenden Exportfunktionen, unbekannten Feldern, nicht freigeschalteten
Schnittstellen oder Berechtigungsfehlern muss der jeweilige ERP-Hersteller
beziehungsweise Implementierungspartner einbezogen werden:

- [GARAIO REM](https://www.garaio-rem.ch/)
- [W&W Schnittstellen für ImmoTop2 und Rimo R5](https://www.wwimmo.ch/produkte/cloudservices/schnittstellen/)
- [W&W öffentliche Schnittstellenformate](https://github.com/wwimmo)

Dem Support sollten Produktversion, aktivierte Module, gewünschte Datensätze,
Exportformat und eine Fehlermeldung ohne Passwörter oder unnötige
Personendaten mitgeteilt werden. Das Immobilientool kann nur Daten verarbeiten,
die rechtmässig und in einem dokumentierten Format bereitgestellt werden.

## Datenschutz und Verantwortung

Vor dem Import sind Rechtsgrundlage, Informationspflichten, Zweckbindung,
Aufbewahrung, Löschkonzept und Zugriffsrechte zu prüfen. Insbesondere dürfen
Mietenden- und Eigentümerdaten nicht ohne Berechtigung zwischen Systemen
übertragen werden. Die technische Funktion ersetzt keine Datenschutz-,
Vertrags- oder Sicherheitsprüfung.
