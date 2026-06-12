# Contributing

1. Keine echten Personen-, Liegenschafts-, Dokument- oder Zugangsdaten verwenden.
2. Änderungen in einem eigenen Branch entwickeln.
3. `python3 scripts/verify_public_release.py` ausführen.
4. Im Ordner `Server` `npm ci`, `npm run lint` und `npm run build` ausführen.
5. iOS-Änderungen mindestens mit `xcodebuild -list` und möglichst in Xcode testen.

Pull Requests sollen Zweck, Tests und mögliche Datenschutz- oder
Migrationsauswirkungen kurz beschreiben.
