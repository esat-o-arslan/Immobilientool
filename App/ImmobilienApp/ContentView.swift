//
//  ContentView.swift
//  ImmobilienApp
//
//  Open-source template on 19.05.2026.
//

import SwiftUI
import Amplify

private struct PortalPullToRefreshModifier: ViewModifier {
    @EnvironmentObject var syncManager: AWSDataSyncManager

    func body(content: Content) -> some View {
        content.refreshable {
            await syncManager.aktualisierePortalCloudDaten()
        }
    }
}

extension View {
    func portalPullToRefresh() -> some View {
        modifier(PortalPullToRefreshModifier())
    }
}

struct ContentView: View {
    @EnvironmentObject var syncManager: AWSDataSyncManager

    var body: some View {
        Group {
            if syncManager.istEingeloggt {
                if syncManager.zeigtSupportKundenVorschau {
                    KundenMobileTabView()
                } else if syncManager.istMitarbeiterAnsicht {
                    MitarbeiterMobileTabView()
                } else {
                    KundenMobileTabView()
                }
            } else {
                LoginView()
            }
        }
    }
}

// MARK: - KI Dokument-Auto-Öffner

struct KIDokumentAnfrage: Identifiable {
    let id = UUID()
    let dateiUrl: String
    let titel: String
}

struct KIDocumentAutoOpener: View {
    let anfrage: KIDokumentAnfrage
    @State private var lokaleURL: URL?
    @State private var laedt = true
    @State private var fehler: String?
    @State private var zeigeViewer = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                if laedt {
                    VStack(spacing: 16) {
                        ProgressView()
                        Text("Dokument wird geladen…").font(.subheadline).foregroundStyle(.secondary)
                    }
                } else if let fehler {
                    ContentUnavailableView("Fehler", systemImage: "xmark.circle", description: Text(fehler))
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .navigationTitle(anfrage.titel)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) { Button("Schliessen") { dismiss() } }
            }
        }
        .fullScreenCover(isPresented: $zeigeViewer, onDismiss: { dismiss() }) {
            if let url = lokaleURL {
                DokumentVollbildView(fileURL: url, titel: anfrage.titel, isPresented: $zeigeViewer)
            }
        }
        .task { await ladeUndOeffne() }
    }

    private func ladeUndOeffne() async {
        guard !anfrage.dateiUrl.isEmpty else {
            await MainActor.run { fehler = "Keine Datei vorhanden."; laedt = false }
            return
        }
        do {
            let remoteURL: URL
            if anfrage.dateiUrl.lowercased().hasPrefix("http"), let u = URL(string: anfrage.dateiUrl) {
                remoteURL = u
            } else {
                remoteURL = try await Amplify.Storage.getURL(path: .fromString(anfrage.dateiUrl))
            }
            let dateiname = remoteURL.lastPathComponent.isEmpty
                ? anfrage.titel.replacingOccurrences(of: " ", with: "-") + ".pdf"
                : remoteURL.lastPathComponent
            let lokal = try await ladeUndCacheDokument(von: remoteURL, dateiname: dateiname)
            await MainActor.run { lokaleURL = lokal; laedt = false; zeigeViewer = true }
        } catch {
            await MainActor.run { fehler = error.localizedDescription; laedt = false }
        }
    }
}

// MARK: - Kundenansicht Eigentümer / Mieter

struct KundenMobileTabView: View {
    @EnvironmentObject var syncManager: AWSDataSyncManager
    @State private var zeigeKI = false
    @State private var ausgewaehlterTab = 0
    @State private var kiDokumentAnfrage: KIDokumentAnfrage? = nil

    var kundenKontext: String {
        let person = syncManager.aktiveKundenPerson
        let liegenschaft = syncManager.aktiveKundenLiegenschaft
        let portal = syncManager.portalInhalte.filter { $0.bereich == "Firmendaten" }
        let tel = portal.first { $0.titel == "Telefon" }?.inhalt ?? "+41 00 000 00 00"
        let mail = portal.first { $0.titel == "E-Mail" }?.inhalt ?? "info@example.invalid"
        let adr = portal.first { $0.titel == "Adresse" }?.inhalt ?? "Musterstrasse 1, 4000 Basel"
        let dokuText = syncManager.kundenDokumente.isEmpty ? "Keine Dokumente." :
            syncManager.kundenDokumente.map { "ID:\($0.id) | \($0.titel) | \($0.kategorie) | \($0.jahr)" }.joined(separator: "\n")
        let faelleText = syncManager.kundenSchadenfaelle.isEmpty ? "Keine Meldungen." :
            syncManager.kundenSchadenfaelle.map { "• \($0.titel) [Status: \($0.status.anzeigeText)]" }.joined(separator: "\n")
        let termineText = syncManager.kundenTermine.isEmpty ? "Keine Termine." :
            syncManager.kundenTermine.prefix(5).map { "• \($0.titel) – \($0.start)" }.joined(separator: "\n")
        return """
        KONTEXT:
        Name: \(person?.name ?? syncManager.eingeloggterUserEmail)
        E-Mail: \(syncManager.eingeloggterUserEmail)
        Telefon: \(person?.telefon ?? "—")
        Liegenschaft: \(liegenschaft.map { "\($0.strasse), \($0.plz) \($0.ort)" } ?? "Unbekannt")
        Rolle: \(person?.rolle ?? "Mieter")

        IMMOBILIENTOOL IMMOBILIEN KONTAKT:
        Telefon: \(tel)
        E-Mail: \(mail)
        Adresse: \(adr)

        MEINE DOKUMENTE (ID | Titel | Kategorie | Jahr):
        \(dokuText)

        MEINE MELDUNGEN:
        \(faelleText)

        NÄCHSTE TERMINE:
        \(termineText)
        """
    }

    var kundenSystemPrompt: String {
        let dokuIDs = syncManager.kundenDokumente
            .map { "ID:\($0.id) = \"\($0.titel) \($0.jahr)\"" }.joined(separator: "; ")
        return """
        Du bist der KI-Assistent für Mieter und Eigentümer von Immobilientool. Beantworte Fragen zur Wohnung, Nebenkostenabrechnung, Mieterrechten und Schadensmeldungen. Sei freundlich und präzise. Du kennst alle Daten im Kontext und kannst direkt darauf verweisen (z.B. Telefonnummer, E-Mail, Adresse von IMMOBILIENTOOL, Dokument-IDs).

        ═══ DIREKTAKTIONEN ═══
        Du kannst App-Aktionen ausführen. Füge dazu am ENDE deiner Antwort exakt diesen Block an (für den Nutzer UNSICHTBAR, wird automatisch ausgeführt):

        <<<PORTAL_AKTION>>>
        {"typ":"AKTIONSTYP",...}
        <<<ENDE_AKTION>>>

        VERFÜGBARE AKTIONEN:
        1. Dokument öffnen: {"typ":"open_document","id":"EXAKTE_DOKUMENT_ID","titel":"Titel"}
           Dokument-IDs: \(dokuIDs.isEmpty ? "Keine Dokumente vorhanden" : dokuIDs)

        2. Tab öffnen: {"typ":"navigate","ziel":"uebersicht|meldungen|unterlagen|kalender|einstellungen"}

        3. IMMOBILIENTOOL anrufen: {"typ":"call","nummer":"+41000000000"}

        4. E-Mail an IMMOBILIENTOOL: {"typ":"email","adresse":"info@example.invalid"}

        5. Adresse in Apple Karten: {"typ":"open_maps","adresse":"vollständige Adresse"}

        Nutze Aktionen NUR wenn der Nutzer es wünscht oder es offensichtlich hilfreich ist.
        Bei Dokumenten: Nutze IMMER die exakte ID aus der Liste oben, nie den Titel als ID.
        """
    }

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            TabView(selection: $ausgewaehlterTab) {
                KundenUebersichtView()
                    .tabItem { Label("Übersicht", systemImage: "house.fill") }.tag(0)
                MeldungenView()
                    .tabItem { Label("Meldungen", systemImage: "exclamationmark.bubble.fill") }.tag(1)
                UnterlagenView()
                    .tabItem { Label("Unterlagen", systemImage: "doc.text.fill") }.tag(2)
                KundenKalenderView()
                    .tabItem { Label("Kalender", systemImage: "calendar") }.tag(3)
                EinstellungenView()
                    .tabItem { Label("Einstellungen", systemImage: "gearshape.fill") }.tag(4)
            }
            .tint(.blue)

            Button { zeigeKI = true } label: {
                ZStack {
                    Circle()
                        .fill(Color(red: 0.12, green: 0.18, blue: 0.27))
                        .frame(width: 52, height: 52)
                        .shadow(color: .black.opacity(0.25), radius: 8, x: 0, y: 4)
                    Text("✦").font(.system(size: 20)).foregroundStyle(.white)
                }
            }
            .padding(.trailing, 20)
            .padding(.bottom, 90)
        }
        .sheet(isPresented: $zeigeKI) {
            AIAssistantView(
                kontext: kundenKontext,
                systemPrompt: kundenSystemPrompt,
                schnellstarts: [
                    "Nebenkostenabrechnung öffnen",
                    "IMMOBILIENTOOL anrufen",
                    "Wie melde ich einen Schaden?",
                    "Meine offenen Meldungen",
                    "Nächste Termine anzeigen",
                    "Adresse von IMMOBILIENTOOL in Karten"
                ],
                onOpenDocument: { id, titel in
                    if let dok = syncManager.kundenDokumente.first(where: { $0.id == id }) {
                        kiDokumentAnfrage = KIDokumentAnfrage(dateiUrl: dok.dateiUrl ?? "", titel: dok.titel)
                    }
                },
                onNavigate: { ziel in
                    switch ziel {
                    case "meldungen": ausgewaehlterTab = 1
                    case "unterlagen": ausgewaehlterTab = 2
                    case "kalender": ausgewaehlterTab = 3
                    case "einstellungen": ausgewaehlterTab = 4
                    default: ausgewaehlterTab = 0
                    }
                }
            )
        }
        .fullScreenCover(item: $kiDokumentAnfrage) { anfrage in
            KIDocumentAutoOpener(anfrage: anfrage)
        }
    }
}

struct KundenUebersichtView: View {
    @EnvironmentObject var syncManager: AWSDataSyncManager

    private var offeneMeldungen: [SchadenfallDetail] {
        syncManager.kundenSchadenfaelle.filter { $0.status != .ERLEDIGT }
    }

    private var naechsteTermine: [KundenTermin] {
        syncManager.kundenTermine.sorted { $0.start < $1.start }
    }

    private var kundenUntertitel: String {
        if let person = syncManager.aktiveKundenPerson,
           let liegenschaft = syncManager.aktiveKundenLiegenschaft {
            return "\(person.rolle) · \(liegenschaft.name)"
        }
        return "Ihre Kundenansicht"
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(syncManager.begruessung)
                            .font(.title2.bold())
                        Text(kundenUntertitel)
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                        Text("Hier sehen Sie Meldungen, Termine und Unterlagen zu Ihrer Liegenschaft.")
                            .font(.footnote)
                            .foregroundColor(.secondary)
                        if syncManager.zeigtSupportKundenVorschau {
                            Label("Support-Vorschau aktiv", systemImage: "eye.fill")
                                .font(.caption.bold())
                                .foregroundColor(.blue)
                        }
                    }
                    .padding(.vertical, 6)
                }

                Section("Schnellzugriff") {
                    NavigationLink {
                        NeuerSchadenView()
                            .environmentObject(syncManager)
                    } label: {
                        Label("Neue Schadensmeldung erfassen", systemImage: "plus.circle.fill")
                    }

                    NavigationLink {
                        KontextMeldungView()
                            .environmentObject(syncManager)
                    } label: {
                        Label("Allgemeine Anfrage senden", systemImage: "text.bubble.fill")
                    }

                    NavigationLink {
                        StammdatenAenderungView()
                            .environmentObject(syncManager)
                    } label: {
                        Label("Stammdaten ändern", systemImage: "person.text.rectangle")
                    }
                }

                Section("Aktueller Stand") {
                    HStack(spacing: 12) {
                        KundenKennzahlView(titel: "Offen", wert: "\(offeneMeldungen.count)", symbol: "exclamationmark.circle.fill", farbe: .orange)
                        KundenKennzahlView(titel: "Termine", wert: "\(naechsteTermine.count)", symbol: "calendar", farbe: .blue)
                        KundenKennzahlView(titel: "Unterlagen", wert: "\(syncManager.kundenDokumente.count)", symbol: "doc.text.fill", farbe: .green)
                    }
                    .listRowInsets(EdgeInsets(top: 10, leading: 12, bottom: 10, trailing: 12))
                }

                Section("Meine offenen Meldungen") {
                    if offeneMeldungen.isEmpty {
                        Text("Aktuell sind keine offenen Meldungen vorhanden.")
                            .font(.footnote)
                            .foregroundColor(.secondary)
                    } else {
                        ForEach(offeneMeldungen.prefix(3)) { schaden in
                            NavigationLink {
                                SchadenDetailView(schaden: schaden)
                            } label: {
                                MeldungRowView(schaden: schaden)
                            }
                        }
                    }
                }

                Section("Nächste Termine") {
                    if naechsteTermine.isEmpty {
                        Text("Keine Termine geplant.")
                            .font(.footnote)
                            .foregroundColor(.secondary)
                    } else {
                        ForEach(naechsteTermine.prefix(3)) { termin in
                            TerminRowView(termin: termin)
                        }
                    }
                }
            }
            .portalPullToRefresh()
            .navigationTitle("Meine Wohnung")
        }
    }
}

struct KundenKennzahlView: View {
    let titel: String
    let wert: String
    let symbol: String
    let farbe: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Image(systemName: symbol)
                .foregroundColor(farbe)
            Text(wert)
                .font(.title3.bold())
            Text(titel)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - Mitarbeiteransicht mobil

struct MitarbeiterMobileTabView: View {
    @EnvironmentObject var syncManager: AWSDataSyncManager
    @State private var zeigeKI = false
    @State private var ausgewaehlterTab = 0
    @State private var kiDokumentAnfrage: KIDokumentAnfrage? = nil

    var mitarbeiterKontext: String {
        let offeneFaelle = syncManager.aktiveSchadenfaelle.filter { $0.status == .OFFEN || $0.status == .IN_BEARBEITUNG }
        let ohneHW = offeneFaelle.filter { $0.handwerkerId == nil || $0.handwerkerId!.isEmpty }
        let hwText = syncManager.aktiveHandwerker.map { hw in
            "[\(hw.gewerk)] \(hw.firma) | Tel: \(hw.telefon ?? "—") | Email: \(hw.email ?? "—") | Kontakt: \(hw.kontaktperson ?? "—")"
        }.joined(separator: "\n")
        let kontakteText = syncManager.aktiveKontaktPersonen.prefix(30).map { k in
            "\(k.name) (\(k.rolle)) | Tel: \(k.telefon ?? "—") | Email: \(k.email)"
        }.joined(separator: "\n")
        let lgText = syncManager.aktiveLiegenschaften.map { l in
            "Nr.\(l.liegenschaftNummer) \(l.name) | \(l.strasse), \(l.plz) \(l.ort)"
        }.joined(separator: "\n")
        let faelleText = offeneFaelle.prefix(10).map { f in
            "#\(f.fallNummer ?? "?") \(f.titel) | \(f.status.anzeigeText) | \(f.liegenschaftAdresse)"
        }.joined(separator: "\n")
        return """
        MITARBEITER-KONTEXT:
        E-Mail: \(syncManager.eingeloggterUserEmail)
        Offene Fälle: \(offeneFaelle.count) (davon \(ohneHW.count) ohne Handwerker)

        LIEGENSCHAFTEN (\(syncManager.aktiveLiegenschaften.count)):
        \(lgText.isEmpty ? "Keine" : lgText)

        HANDWERKER (\(syncManager.aktiveHandwerker.count)) – Gewerk | Firma | Telefon | Email | Kontakt:
        \(hwText.isEmpty ? "Keine" : hwText)

        KONTAKTPERSONEN (\(syncManager.aktiveKontaktPersonen.count)) – Name | Rolle | Telefon | Email:
        \(kontakteText.isEmpty ? "Keine" : kontakteText)

        OFFENE FÄLLE (\(offeneFaelle.count)):
        \(faelleText.isEmpty ? "Keine" : faelleText)
        """
    }

    var mitarbeiterSystemPrompt: String {
        let dokuIDs = syncManager.mitarbeiterDokumente
            .map { "ID:\($0.id) = \"\($0.titel) \($0.jahr)\"" }.joined(separator: "; ")
        return """
        Du bist der KI Admin-Assistent für Mitarbeiter von Immobilientool. Du hast Zugang zu allen Daten. Hilf bei Schadensfällen, Handwerker-Auswahl, Kontaktsuche und Dokumenten.
        Du kennst alle Handwerker, Liegenschaften, Kontaktpersonen und offene Fälle aus dem Kontext.

        ═══ DIREKTAKTIONEN ═══
        Füge am ENDE deiner Antwort exakt diesen Block an (für den Nutzer UNSICHTBAR):

        <<<PORTAL_AKTION>>>
        {"typ":"AKTIONSTYP",...}
        <<<ENDE_AKTION>>>

        VERFÜGBARE AKTIONEN:
        1. Dokument öffnen: {"typ":"open_document","id":"EXAKTE_ID","titel":"Titel"}
           Dokument-IDs: \(dokuIDs.isEmpty ? "Keine Mitarbeiter-Dokumente" : dokuIDs)

        2. Tab öffnen: {"typ":"navigate","ziel":"uebersicht|meldungen|liegenschaften|chats|einstellungen"}

        3. Anruf starten: {"typ":"call","nummer":"Telefonnummer aus Kontext"}

        4. E-Mail öffnen: {"typ":"email","adresse":"Email aus Kontext"}

        5. Adresse in Karten: {"typ":"open_maps","adresse":"vollständige Adresse"}

        Nutze Handwerker/Kontakt-Daten direkt aus dem Kontext. Nutze Aktionen NUR wenn sinnvoll.
        """
    }

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            TabView(selection: $ausgewaehlterTab) {
                MitarbeiterDashboardView()
                    .tabItem { Label("Übersicht", systemImage: "chart.bar.fill") }.tag(0)
                MitarbeiterMeldungenView()
                    .tabItem { Label("Meldungen", systemImage: "tray.full.fill") }.tag(1)
                MitarbeiterLiegenschaftenView()
                    .tabItem { Label("Liegenschaften", systemImage: "building.2.fill") }.tag(2)
                MitarbeiterChatsView()
                    .tabItem { Label("Chats", systemImage: "bubble.left.and.bubble.right.fill") }.tag(3)
                MitarbeiterEinstellungenView()
                    .tabItem { Label("Einstellungen", systemImage: "gearshape.fill") }.tag(4)
            }
            .tint(.blue)

            Button { zeigeKI = true } label: {
                ZStack {
                    Circle()
                        .fill(Color(red: 0.12, green: 0.18, blue: 0.27))
                        .frame(width: 52, height: 52)
                        .shadow(color: .black.opacity(0.25), radius: 8, x: 0, y: 4)
                    Text("✦").font(.system(size: 20)).foregroundStyle(.white)
                }
            }
            .padding(.trailing, 20)
            .padding(.bottom, 90)
        }
        .sheet(isPresented: $zeigeKI) {
            AIAssistantView(
                kontext: mitarbeiterKontext,
                systemPrompt: mitarbeiterSystemPrompt,
                schnellstarts: [
                    "Offene Fälle zusammenfassen",
                    "Handwerker für Heizungsausfall",
                    "E-Mail-Adresse eines Mieters finden",
                    "Telefonnummer Sanitär-Handwerker",
                    "Auftrag formulieren",
                    "Prioritäten für heute"
                ],
                onOpenDocument: { id, titel in
                    if let dok = syncManager.mitarbeiterDokumente.first(where: { $0.id == id }) {
                        kiDokumentAnfrage = KIDokumentAnfrage(dateiUrl: dok.dateiUrl ?? "", titel: dok.titel)
                    }
                },
                onNavigate: { ziel in
                    switch ziel {
                    case "meldungen": ausgewaehlterTab = 1
                    case "liegenschaften": ausgewaehlterTab = 2
                    case "chats": ausgewaehlterTab = 3
                    case "einstellungen": ausgewaehlterTab = 4
                    default: ausgewaehlterTab = 0
                    }
                }
            )
        }
        .fullScreenCover(item: $kiDokumentAnfrage) { anfrage in
            KIDocumentAutoOpener(anfrage: anfrage)
        }
    }
}

struct MitarbeiterDashboardView: View {
    @EnvironmentObject var syncManager: AWSDataSyncManager
    private var offeneFaelle: [SchadenfallDetail] {
        syncManager.aktiveSchadenfaelle.filter { $0.status != .ERLEDIGT }
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(syncManager.begruessung)
                            .font(.title2.bold())
                        Text("Verwaltungsansicht")
                            .foregroundColor(.secondary)
                        Text("Mobile Übersicht über Meldungen, Liegenschaften, Kunden und Chats aus AWS.")
                            .font(.footnote)
                            .foregroundColor(.secondary)
                    }
                    .padding(.vertical, 6)
                }

                Section("Aktueller Stand") {
                    HStack(spacing: 12) {
                        KundenKennzahlView(titel: "Offen", wert: "\(offeneFaelle.count)", symbol: "exclamationmark.circle.fill", farbe: .orange)
                        KundenKennzahlView(titel: "Liegenschaften", wert: "\(syncManager.aktiveLiegenschaften.count)", symbol: "building.2.fill", farbe: .blue)
                        KundenKennzahlView(titel: "Chats", wert: "\(syncManager.aktiveSchadenfaelle.filter { !$0.chatVerlauf.isEmpty }.count)", symbol: "bubble.left.fill", farbe: .green)
                    }
                    .listRowInsets(EdgeInsets(top: 10, leading: 12, bottom: 10, trailing: 12))
                }

                Section("Dringende / offene Meldungen") {
                    if offeneFaelle.isEmpty {
                        Text("Aktuell sind keine offenen Schadenfälle vorhanden.")
                            .font(.footnote)
                            .foregroundColor(.secondary)
                    } else {
                        ForEach(offeneFaelle.prefix(6)) { fall in
                            NavigationLink {
                                SchadenDetailView(schaden: fall)
                            } label: {
                                MeldungRowView(schaden: fall)
                            }
                        }
                    }
                }

                Section("Schnellzugriff") {
                    NavigationLink {
                        MitarbeiterHandwerkerView()
                    } label: {
                        Label("Handwerker-Auslastung", systemImage: "wrench.and.screwdriver.fill")
                    }

                    NavigationLink {
                        MitarbeiterKalenderView()
                    } label: {
                        Label("Termine und Einsätze", systemImage: "calendar")
                    }
                }
            }
            .portalPullToRefresh()
            .navigationTitle("Übersicht")
        }
    }
}

struct MitarbeiterMeldungenView: View {
    @EnvironmentObject var syncManager: AWSDataSyncManager
    @State private var statusFilter: SchadenfallStatus? = nil

    private var gefilterteFaelle: [SchadenfallDetail] {
        guard let statusFilter else { return syncManager.aktiveSchadenfaelle }
        return syncManager.aktiveSchadenfaelle.filter { $0.status == statusFilter }
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Picker("Status", selection: $statusFilter) {
                        Text("Alle").tag(nil as SchadenfallStatus?)
                        ForEach(SchadenfallStatus.allCases, id: \.self) { status in
                            Text(status.anzeigeText).tag(status as SchadenfallStatus?)
                        }
                    }
                    .pickerStyle(.menu)
                }

                if gefilterteFaelle.isEmpty {
                    ContentUnavailableView("Keine Meldungen", systemImage: "tray")
                } else {
                    ForEach(gefilterteFaelle) { fall in
                        NavigationLink {
                            SchadenDetailView(schaden: fall)
                        } label: {
                            MeldungRowView(schaden: fall)
                        }
                    }
                }
            }
            .portalPullToRefresh()
            .navigationTitle("Meldungen")
        }
    }
}

struct MitarbeiterChatsView: View {
    @EnvironmentObject var syncManager: AWSDataSyncManager

    private var faelleMitChat: [SchadenfallDetail] {
        syncManager.aktiveSchadenfaelle.filter { !$0.chatVerlauf.isEmpty }
    }

    var body: some View {
        NavigationStack {
            List {
                Section("Schadenfall-Chats") {
                    if faelleMitChat.isEmpty {
                        Text("Noch keine Schadenfall-Chats vorhanden.")
                            .font(.footnote)
                            .foregroundColor(.secondary)
                    } else {
                        ForEach(faelleMitChat) { fall in
                            NavigationLink {
                                SchadenDetailView(schaden: fall)
                            } label: {
                                VStack(alignment: .leading, spacing: 5) {
                                    Text(fall.titel).bold()
                                    Text(fall.chatVerlauf.last?.nachricht ?? "Chat öffnen")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                        .lineLimit(2)
                                    Text(fall.liegenschaftAdresse)
                                        .font(.caption2)
                                        .foregroundColor(.secondary)
                                }
                            }
                        }
                    }
                }

                Section("Allgemeine Support-Chats") {
                    NavigationLink {
                        ZentralChatView()
                    } label: {
                        Label("Support-Chats öffnen", systemImage: "bubble.left.and.bubble.right")
                    }
                }
            }
            .portalPullToRefresh()
            .navigationTitle("Chats")
        }
    }
}

struct MitarbeiterLiegenschaftenView: View {
    @EnvironmentObject var syncManager: AWSDataSyncManager
    @State private var suche = ""
    var gefiltert: [AppLiegenschaft] {
        guard !suche.isEmpty else { return syncManager.aktiveLiegenschaften }
        return syncManager.aktiveLiegenschaften.filter { ("\($0.liegenschaftNummer) \($0.name) \($0.strasse) \($0.ort)").localizedCaseInsensitiveContains(suche) }
    }
    var body: some View {
        NavigationStack {
            List {
                Section {
                    TextField("Suche nach Nr., Name, Adresse", text: $suche)
                }
                ForEach(gefiltert) { lg in
                    NavigationLink {
                        LiegenschaftMobileDetailView(liegenschaft: lg)
                    } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("\(lg.liegenschaftNummer) · \(lg.name)").bold()
                            Text("\(lg.strasse), \(lg.plz) \(lg.ort)")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                }
            }
            .portalPullToRefresh()
            .navigationTitle("Liegenschaften")
        }
    }
}

struct LiegenschaftMobileDetailView: View {
    @EnvironmentObject var syncManager: AWSDataSyncManager
    let liegenschaft: AppLiegenschaft
    var parteien: [AppKontaktPerson] { syncManager.aktiveKontaktPersonen.filter { $0.liegenschaftId == liegenschaft.id } }
    var geraete: [AppGeraet] { syncManager.geraeteFuer(liegenschaftId: liegenschaft.id) }
    var body: some View {
        List {
            Section("Stammdaten") {
                Text("Nr. \(liegenschaft.liegenschaftNummer)")
                Text(liegenschaft.name)
                Text("\(liegenschaft.strasse), \(liegenschaft.plz) \(liegenschaft.ort)")
            }
            Section("Eigentümer / Mieter") {
                ForEach(parteien) { person in
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(person.name).bold()
                                Text("\(person.rolle) · \(person.wohnungsNummer ?? "Objekt")")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            Spacer()
                            Button {
                                syncManager.kundenVorschauStarten(personId: person.id)
                            } label: {
                                Label("Ansicht", systemImage: "eye.fill")
                            }
                            .buttonStyle(.bordered)
                        }
                        if let telefon = person.telefon { Link(telefon, destination: URL(string: "tel://\(telefon)")!) }
                        Link(person.email, destination: URL(string: "mailto:\(person.email)")!)
                    }
                }
            }
            if !geraete.isEmpty {
                Section("Geräte & Anlagen") {
                    ForEach(geraete) { gerät in
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(gerät.bezeichnung).bold()
                                Text(gerät.typ)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                if let standort = gerät.standort {
                                    Text("📍 \(standort)")
                                        .font(.caption2)
                                        .foregroundColor(.secondary)
                                }
                            }
                            Spacer()
                            if let status = gerät.status {
                                Text(status)
                                    .font(.caption.bold())
                                    .foregroundColor(status == "Defekt" ? .red : status == "Aktiv" ? .green : .secondary)
                            }
                        }
                        .padding(.vertical, 2)
                    }
                }
            }
        }
        .portalPullToRefresh()
        .navigationTitle(liegenschaft.name)
    }
}

// MARK: - S3-Bild mit automatischer URL-Auflösung

struct S3BildView: View {
    let urlOrPfad: String?
    var breite: CGFloat = 44
    var hoehe: CGFloat = 44
    var eckenRadius: CGFloat = 999

    @State private var resolvedURL: URL?

    var body: some View {
        Group {
            if let url = resolvedURL {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let img):
                        img.resizable().scaledToFill()
                    case .failure:
                        bildPlatzhalter
                    default:
                        ProgressView().scaleEffect(0.6)
                    }
                }
            } else {
                bildPlatzhalter
            }
        }
        .frame(width: breite, height: hoehe)
        .clipShape(RoundedRectangle(cornerRadius: eckenRadius))
        .task(id: urlOrPfad) { await resolveURL() }
    }

    private var bildPlatzhalter: some View {
        Rectangle()
            .fill(Color(.systemGray4))
            .overlay(Image(systemName: "person.fill").foregroundColor(.white).font(.system(size: breite * 0.45)))
    }

    private func resolveURL() async {
        guard let raw = urlOrPfad, !raw.isEmpty else { return }
        if raw.lowercased().hasPrefix("http"), let url = URL(string: raw) {
            await MainActor.run { resolvedURL = url }
            return
        }
        // S3-Pfad → signierte URL
        do {
            let url = try await Amplify.Storage.getURL(path: .fromString(raw))
            await MainActor.run { resolvedURL = url }
        } catch {
            print("S3BildView: Konnte \(raw) nicht auflösen: \(error)")
        }
    }
}

// MARK: - Öffnungszeiten Detail

// MARK: - Mitarbeiter Kontakt-Detailseite

struct MitarbeiterKontaktView: View {
    let mitarbeiter: Mitarbeiter

    var body: some View {
        List {
            Section {
                HStack(spacing: 16) {
                    S3BildView(urlOrPfad: mitarbeiter.photoUrl, breite: 80, hoehe: 80, eckenRadius: 999)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(mitarbeiter.name)
                            .font(.title2.bold())
                        Text(mitarbeiter.funktion)
                            .foregroundColor(.secondary)
                    }
                }
                .padding(.vertical, 8)
            }

            Section("Kontakt") {
                if let tel = mitarbeiter.telefon, !tel.isEmpty,
                   let url = URL(string: "tel://\(tel.replacingOccurrences(of: " ", with: ""))") {
                    Link(destination: url) {
                        Label(tel, systemImage: "phone.fill")
                    }
                }
                if let mail = mitarbeiter.email, !mail.isEmpty,
                   let url = URL(string: "mailto:\(mail)") {
                    Link(destination: url) {
                        Label(mail, systemImage: "envelope.fill")
                    }
                }
                if mitarbeiter.telefon == nil && mitarbeiter.email == nil {
                    Text("Keine Kontaktangaben hinterlegt.")
                        .foregroundColor(.secondary)
                        .font(.footnote)
                }
            }
        }
        .navigationTitle(mitarbeiter.name)
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct OeffnungszeitenDetailView: View {
    let jsonInhalt: String

    private struct OezTag: Identifiable {
        let id = UUID()
        let name: String
        let von: String
        let bis: String
        let geschlossen: Bool
    }

    private struct OezAusnahme: Identifiable {
        let id: String
        let datum: String
        let hinweis: String
        let vonBis: String
        let geschlossen: Bool
    }

    private var wochentage: [OezTag] {
        guard let data = jsonInhalt.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let standard = json["standard"] as? [String: Any] else { return [] }
        let reihenfolge = ["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonntag"]
        return reihenfolge.compactMap { tag in
            guard let t = standard[tag] as? [String: Any] else { return nil }
            let geschlossen = t["geschlossen"] as? Bool ?? false
            // Zeiten-Array auslesen (neueres Format mit mehreren Blöcken)
            let zeitenRaw = t["zeiten"] as? [[String: Any]] ?? []
            let von: String
            let bis: String
            if !zeitenRaw.isEmpty {
                // Mehrere Zeitblöcke → "08:00–12:00 / 13:30–16:30"
                von = zeitenRaw.map { z in
                    let v = z["von"] as? String ?? "08:00"
                    let b = z["bis"] as? String ?? "17:00"
                    return "\(v)–\(b)"
                }.joined(separator: " / ")
                bis = "" // wird nicht einzeln verwendet
            } else {
                // Legacy: von/bis direkt
                von = t["von"] as? String ?? "08:00"
                bis = t["bis"] as? String ?? "17:00"
            }
            return OezTag(name: tag, von: von, bis: bis, geschlossen: geschlossen)
        }
    }

    private var ausnahmen: [OezAusnahme] {
        guard let data = jsonInhalt.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let list = json["ausnahmen"] as? [[String: Any]] else { return [] }
        let heute = ISO8601DateFormatter().string(from: Date()).prefix(10)
        return list
            .filter { ($0["datum"] as? String ?? "") >= heute }
            .sorted { ($0["datum"] as? String ?? "") < ($1["datum"] as? String ?? "") }
            .map { a in
                OezAusnahme(
                    id: a["id"] as? String ?? UUID().uuidString,
                    datum: a["datum"] as? String ?? "",
                    hinweis: a["hinweis"] as? String ?? "",
                    vonBis: a["vonBis"] as? String ?? "",
                    geschlossen: a["geschlossen"] as? Bool ?? true
                )
            }
    }

    private var hinweisAllgemein: String {
        guard let data = jsonInhalt.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return "" }
        return json["hinweisAllgemein"] as? String ?? ""
    }

    private var heuteTag: String {
        let weekday = Calendar.current.component(.weekday, from: Date())
        let mapping = [1:"Sonntag",2:"Montag",3:"Dienstag",4:"Mittwoch",5:"Donnerstag",6:"Freitag",7:"Samstag"]
        return mapping[weekday] ?? "Montag"
    }

    private var heuteString: String {
        ISO8601DateFormatter().string(from: Date()).prefix(10).description
    }

    private func formatDate(_ iso: String) -> String {
        guard let date = ISO8601DateFormatter().date(from: iso + "T12:00:00Z") else { return iso }
        return date.formatted(date: .abbreviated, time: .omitted)
    }

    var body: some View {
        List {
            // Heute-Status
            let heuteAusnahme = ausnahmen.first { $0.datum == heuteString }
            let heuteStandard = wochentage.first { $0.name == heuteTag }

            Section("Heute") {
                if let a = heuteAusnahme {
                    HStack {
                        Image(systemName: a.geschlossen ? "xmark.circle.fill" : "checkmark.circle.fill")
                            .foregroundColor(a.geschlossen ? .red : .green)
                        VStack(alignment: .leading) {
                            Text(a.geschlossen ? "Geschlossen" : a.vonBis.isEmpty ? "Geöffnet" : a.vonBis)
                                .bold()
                            if !a.hinweis.isEmpty {
                                Text(a.hinweis).font(.caption).foregroundColor(.secondary)
                            }
                        }
                    }
                } else if let std = heuteStandard {
                    HStack {
                        Image(systemName: std.geschlossen ? "xmark.circle.fill" : "checkmark.circle.fill")
                            .foregroundColor(std.geschlossen ? .red : .green)
                        Text(std.geschlossen ? "Heute geschlossen" : std.bis.isEmpty ? "\(std.von) Uhr" : "\(std.von) – \(std.bis) Uhr")
                            .bold()
                    }
                }
            }

            // Standard-Woche
            Section("Reguläre Öffnungszeiten") {
                ForEach(wochentage) { tag in
                    HStack {
                        Text(tag.name)
                            .fontWeight(tag.name == heuteTag ? .bold : .regular)
                            .foregroundColor(tag.name == heuteTag ? .accentColor : .primary)
                        Spacer()
                        if tag.geschlossen {
                            Text("Geschlossen").foregroundColor(.secondary)
                        } else if tag.bis.isEmpty {
                            // Neues Format: von enthält alle Zeitblöcke ("08:00–12:00 / 13:30–16:30")
                            Text(tag.von).foregroundColor(.secondary)
                        } else {
                            Text("\(tag.von) – \(tag.bis)").foregroundColor(.secondary)
                        }
                    }
                }
                if !hinweisAllgemein.isEmpty {
                    Text(hinweisAllgemein)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            // Ausnahmen (zukünftige)
            if !ausnahmen.isEmpty {
                Section("Besondere Zeiten & Feiertage") {
                    ForEach(ausnahmen) { a in
                        HStack(alignment: .top) {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(formatDate(a.datum)).bold().font(.subheadline)
                                if !a.hinweis.isEmpty {
                                    Text(a.hinweis).font(.caption).foregroundColor(.secondary)
                                }
                            }
                            Spacer()
                            Text(a.geschlossen ? "Geschlossen" : a.vonBis.isEmpty ? "Sonderzeiten" : a.vonBis)
                                .font(.caption.bold())
                                .foregroundColor(a.geschlossen ? .red : .green)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(a.geschlossen ? Color.red.opacity(0.1) : Color.green.opacity(0.1))
                                .clipShape(Capsule())
                        }
                    }
                }
            }
        }
        .navigationTitle("Öffnungszeiten")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct MitarbeiterHandwerkerView: View {
    @EnvironmentObject var syncManager: AWSDataSyncManager
    var body: some View {
        NavigationStack {
            List(syncManager.aktiveHandwerker) { hw in
                VStack(alignment: .leading, spacing: 6) {
                    Text(hw.firma).bold()
                    Text(hw.gewerk).foregroundColor(.secondary)
                    if let kontakt = hw.kontaktperson { Text(kontakt).font(.caption) }
                    if let telefon = hw.telefon { Link(telefon, destination: URL(string: "tel://\(telefon)")!) }
                    if let email = hw.email { Link(email, destination: URL(string: "mailto:\(email)")!) }
                }
            }
            .portalPullToRefresh()
            .navigationTitle("Handwerker")
        }
    }
}

struct MitarbeiterKalenderView: View {
    @EnvironmentObject var syncManager: AWSDataSyncManager
    var body: some View {
        NavigationStack {
            List(syncManager.kundenTermine) { termin in
                VStack(alignment: .leading, spacing: 6) {
                    Text(termin.titel).bold()
                    Text(termin.typ).font(.caption).foregroundColor(.secondary)
                    Text(termin.ort)
                    Text(termin.start).font(.footnote)
                }
            }
            .portalPullToRefresh()
            .navigationTitle("Kalender")
        }
    }
}

struct MitarbeiterProfilView: View {
    @EnvironmentObject var syncManager: AWSDataSyncManager
    var body: some View {
        NavigationStack {
            List {
                Section("Profil") {
                    Text(syncManager.eingeloggterUserEmail.isEmpty ? "Angemeldet" : syncManager.eingeloggterUserEmail)
                    Text("Rolle: \(syncManager.appRolle.rawValue)")
                }
                Section("Meine Dokumente") {
                    ForEach(syncManager.mitarbeiterDokumente) { dokument in
                        HStack {
                            Image(systemName: "doc.text.fill")
                            VStack(alignment: .leading) {
                                Text(dokument.titel).bold()
                                Text("\(dokument.kategorie) · \(dokument.jahr)")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                }
                Section { Button("Abmelden", role: .destructive) { syncManager.logout() } }
            }
            .portalPullToRefresh()
            .navigationTitle("Mein Profil")
        }
    }
}

struct MitarbeiterEinstellungenView: View {
    @EnvironmentObject var syncManager: AWSDataSyncManager
    @State private var ausgewaehlteLiegenschaftId: String?

    private var parteienDerAuswahl: [AppKontaktPerson] {
        guard let ausgewaehlteLiegenschaftId else { return [] }
        return syncManager.aktiveKontaktPersonen.filter { $0.liegenschaftId == ausgewaehlteLiegenschaftId }
    }

    var body: some View {
        NavigationStack {
            List {
                Section("Konto") {
                    Text(syncManager.eingeloggterUserEmail.isEmpty ? "Angemeldet" : syncManager.eingeloggterUserEmail)
                        .bold()
                    Text("Rolle: \(syncManager.appRolle.rawValue)")
                        .foregroundColor(.secondary)
                }

                Section("Kundenansicht für Support") {
                    Picker("Liegenschaft", selection: $ausgewaehlteLiegenschaftId) {
                        Text("Bitte wählen").tag(nil as String?)
                        ForEach(syncManager.aktiveLiegenschaften) { liegenschaft in
                            Text("\(liegenschaft.liegenschaftNummer) · \(liegenschaft.name)")
                                .tag(liegenschaft.id as String?)
                        }
                    }

                    if let ausgewaehlteLiegenschaftId,
                       let liegenschaft = syncManager.aktiveLiegenschaften.first(where: { $0.id == ausgewaehlteLiegenschaftId }) {
                        Text("\(liegenschaft.strasse), \(liegenschaft.plz) \(liegenschaft.ort)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    if parteienDerAuswahl.isEmpty {
                        Text("Nach Auswahl einer Liegenschaft erscheinen hier Mieter und Eigentümer.")
                            .font(.footnote)
                            .foregroundColor(.secondary)
                    } else {
                        ForEach(parteienDerAuswahl) { person in
                            Button {
                                syncManager.kundenVorschauStarten(personId: person.id)
                            } label: {
                                HStack {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(person.name).bold()
                                        Text("\(person.rolle) · \(person.wohnungsNummer ?? "Objekt")")
                                            .font(.caption)
                                            .foregroundColor(.secondary)
                                    }
                                    Spacer()
                                    Image(systemName: "eye.fill")
                                }
                            }
                        }
                    }
                }

                Section("Verwaltung") {
                    NavigationLink {
                        MitarbeiterHandwerkerView()
                    } label: {
                        Label("Handwerker und Auslastung", systemImage: "wrench.and.screwdriver.fill")
                    }

                    NavigationLink {
                        MitarbeiterKalenderView()
                    } label: {
                        Label("Kalender / Einsätze", systemImage: "calendar")
                    }

                    NavigationLink {
                        MitarbeiterProfilView()
                    } label: {
                        Label("Profil und Dokumente", systemImage: "person.crop.circle")
                    }
                }

                Section {
                    Button("Abmelden", role: .destructive) {
                        syncManager.logout()
                    }
                }
            }
            .portalPullToRefresh()
            .navigationTitle("Einstellungen")
            .onAppear {
                if ausgewaehlteLiegenschaftId == nil {
                    ausgewaehlteLiegenschaftId = syncManager.aktiveLiegenschaften.first?.id
                }
            }
        }
    }
}

// MARK: - Bestehende Kundenmodule

struct MeldungenView: View {
    @EnvironmentObject var syncManager: AWSDataSyncManager

    private var aktiveMeldungen: [SchadenfallDetail] {
        syncManager.kundenSchadenfaelle.filter { $0.status != .ERLEDIGT }
    }

    private var erledigteMeldungen: [SchadenfallDetail] {
        syncManager.kundenSchadenfaelle.filter { $0.status == .ERLEDIGT }
    }

    var body: some View {
        NavigationStack {
            List {
                Section("Neue Meldung") {
                    NavigationLink {
                        NeuerSchadenView()
                            .environmentObject(syncManager)
                    } label: {
                        Label("Schaden melden", systemImage: "wrench.and.screwdriver.fill")
                    }

                    NavigationLink {
                        KontextMeldungView()
                            .environmentObject(syncManager)
                    } label: {
                        Label("Allgemeine Anfrage", systemImage: "text.bubble.fill")
                    }
                }

                Section("Aktive Meldungen") {
                    if aktiveMeldungen.isEmpty {
                        Text("Keine aktiven Meldungen vorhanden.")
                            .font(.footnote)
                            .foregroundColor(.secondary)
                    } else {
                        ForEach(aktiveMeldungen) { schaden in
                            NavigationLink {
                                SchadenDetailView(schaden: schaden)
                            } label: {
                                MeldungRowView(schaden: schaden)
                            }
                        }
                    }
                }

                Section("Verlauf") {
                    if erledigteMeldungen.isEmpty {
                        Text("Noch keine abgeschlossenen Meldungen.")
                            .font(.footnote)
                            .foregroundColor(.secondary)
                    } else {
                        ForEach(erledigteMeldungen) { schaden in
                            NavigationLink {
                                SchadenDetailView(schaden: schaden)
                            } label: {
                                MeldungRowView(schaden: schaden)
                            }
                        }
                    }
                }
            }
            .portalPullToRefresh()
            .navigationTitle("Meldungen")
        }
    }
}

struct MeldungRowView: View {
    let schaden: SchadenfallDetail

    private var statusFarbe: Color {
        switch schaden.status {
        case .OFFEN: return .orange
        case .IN_BEARBEITUNG: return .blue
        case .OFFERTEN_EINGEHOLT: return .indigo
        case .HANDWERKER_BEAUFTRAGT: return .teal
        case .BELEG_NACHGEREICHT: return .purple
        case .ERLEDIGT: return .green
        case .ARCHIVIERT: return .gray
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    if let fallNr = schaden.fallNummer {
                        Text(fallNr)
                            .font(.caption2.bold())
                            .foregroundColor(.secondary)
                    }
                    Text(schaden.titel)
                        .font(.headline)
                }
                Spacer()
                Text(schaden.status.anzeigeText)
                    .font(.caption.bold())
                    .foregroundColor(statusFarbe)
            }

            Text(schaden.kategorie ?? "Meldung")
                .font(.caption)
                .foregroundColor(.secondary)

            Text("\(schaden.liegenschaftAdresse), \(schaden.plzOrt)")
                .font(.caption)
                .foregroundColor(.secondary)

            if let prioritaet = schaden.prioritaet {
                Text("Priorität: \(prioritaet)")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}

struct KontextMeldungView: View {
    @EnvironmentObject var syncManager: AWSDataSyncManager
    @Environment(\.dismiss) private var dismiss
    @State private var betreff = ""
    @State private var kategorie = "Allgemeine Frage"
    @State private var nachricht = ""
    @State private var sendeStatus: SendeStatus = .bereit

    enum SendeStatus { case bereit, sendet, erfolg, fehler }

    private let kategorien = [
        "Allgemeine Frage",
        "Unterlagen anfordern",
        "Terminwunsch",
        "Kontaktdaten ändern",
        "Reklamation",
        "Sonstiges"
    ]

    var body: some View {
        Form {
            Section("Art der Anfrage") {
                Picker("Kategorie", selection: $kategorie) {
                    ForEach(kategorien, id: \.self) { Text($0).tag($0) }
                }
                .pickerStyle(.menu)
            }

            Section("Ihre Nachricht") {
                TextField("Betreff (optional)", text: $betreff)
                TextEditor(text: $nachricht)
                    .frame(minHeight: 140)
                    .overlay(
                        nachricht.isEmpty
                            ? Text("Beschreiben Sie Ihr Anliegen …")
                                .foregroundColor(.secondary)
                                .padding(.top, 8)
                                .padding(.leading, 4)
                                .allowsHitTesting(false)
                                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                            : nil
                    )
            }

            Section {
                switch sendeStatus {
                case .bereit:
                    Button("Anfrage senden") {
                        guard !nachricht.getrimmt.isEmpty else { return }
                        sendeStatus = .sendet
                        syncManager.sendeAllgemeineAnfrage(
                            betreff: betreff,
                            kategorie: kategorie,
                            nachricht: nachricht
                        ) { erfolg in
                            sendeStatus = erfolg ? .erfolg : .fehler
                        }
                    }
                    .disabled(nachricht.getrimmt.isEmpty)

                case .sendet:
                    HStack {
                        ProgressView()
                        Text("Wird gesendet …").foregroundColor(.secondary)
                    }

                case .erfolg:
                    VStack(alignment: .leading, spacing: 8) {
                        Label("Anfrage erfolgreich gesendet.", systemImage: "checkmark.circle.fill")
                            .foregroundColor(.green)
                            .bold()
                        Text("Wir melden uns so schnell wie möglich bei Ihnen.")
                            .font(.footnote)
                            .foregroundColor(.secondary)
                        Button("Schliessen") { dismiss() }
                            .padding(.top, 4)
                    }

                case .fehler:
                    VStack(alignment: .leading, spacing: 8) {
                        Label("Senden fehlgeschlagen.", systemImage: "xmark.circle.fill")
                            .foregroundColor(.red)
                        Text("Bitte überprüfen Sie Ihre Verbindung und versuchen Sie es erneut.")
                            .font(.footnote)
                            .foregroundColor(.secondary)
                        Button("Erneut versuchen") { sendeStatus = .bereit }
                    }
                }
            }

            Section("Hinweis") {
                Text("Ihre Anfrage wird direkt an die Verwaltung weitergeleitet und erscheint als Meldung im Portal.")
                    .font(.footnote)
                    .foregroundColor(.secondary)
            }
        }
        .navigationTitle("Allgemeine Anfrage")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct StammdatenAenderungView: View {
    @EnvironmentObject var syncManager: AWSDataSyncManager
    @State private var feld = "Name"
    @State private var alterWert = ""
    @State private var neuerWert = ""
    var body: some View {
        Form {
            Section("Änderungsantrag") {
                Picker("Feld", selection: $feld) { Text("Name").tag("Name"); Text("Telefon").tag("Telefon"); Text("E-Mail").tag("E-Mail"); Text("Adresse").tag("Adresse") }
                TextField("Aktueller Wert", text: $alterWert)
                TextField("Neuer Wert", text: $neuerWert)
            }
            Section { Button("Zur Prüfung einreichen") { syncManager.sendeStammdatenAenderung(feld: feld, alterWert: alterWert, neuerWert: neuerWert) } }
            Section("Hinweis") { Text("Die Änderung wird erst nach Bestätigung durch Portal übernommen.").font(.footnote).foregroundColor(.secondary) }
        }
        .navigationTitle("Stammdaten")
    }
}

struct DokumentOeffnenButton: View {
    let dateiUrl: String?
    let titel: String
    var buttonLabel: String = "Öffnen"

    @State private var laedt = false
    @State private var fehler: String?
    @State private var zeigeFehler = false
    @State private var lokaleURL: URL?
    @State private var zeigeViewer = false

    var body: some View {
        Button {
            oeffne()
        } label: {
            if laedt {
                HStack(spacing: 6) {
                    ProgressView().scaleEffect(0.75)
                    Text("Lädt …").font(.caption)
                }
            } else {
                Label(buttonLabel, systemImage: "doc.fill")
                    .font(.subheadline.bold())
            }
        }
        .buttonStyle(.bordered)
        .tint(.blue)
        .disabled(laedt || dateiUrl == nil)
        .alert("Fehler", isPresented: $zeigeFehler) {
            Button("OK") { }
        } message: {
            Text(fehler ?? "Dokument konnte nicht geöffnet werden.")
        }
        .fullScreenCover(isPresented: $zeigeViewer) {
            if let url = lokaleURL {
                DokumentVollbildView(fileURL: url, titel: titel, isPresented: $zeigeViewer)
            }
        }
    }

    private func oeffne() {
        guard let urlString = dateiUrl, !urlString.isEmpty else { return }
        laedt = true

        Task {
            do {
                // 1. Signed URL holen (S3-Pfad oder direkte URL)
                let remoteURL: URL
                if urlString.lowercased().hasPrefix("http"), let u = URL(string: urlString) {
                    remoteURL = u
                } else {
                    remoteURL = try await Amplify.Storage.getURL(path: .fromString(urlString))
                }

                // 2. Dateiname aus URL oder Titel ableiten
                let dateiname = remoteURL.lastPathComponent.isEmpty
                    ? titel.replacingOccurrences(of: " ", with: "-") + ".pdf"
                    : remoteURL.lastPathComponent

                // 3. Datei herunterladen und lokal cachen
                let lokal = try await ladeUndCacheDokument(von: remoteURL, dateiname: dateiname)

                await MainActor.run {
                    laedt = false
                    lokaleURL = lokal
                    zeigeViewer = true
                }
            } catch {
                await MainActor.run {
                    laedt = false
                    fehler = "Dokument konnte nicht geladen werden: \(error.localizedDescription)"
                    zeigeFehler = true
                }
            }
        }
    }
}

struct UnterlagenView: View {
    @EnvironmentObject var syncManager: AWSDataSyncManager
    var gruppiert: [(String, [KundenDokument])] {
        let dict = Dictionary(grouping: syncManager.kundenDokumente) { "\($0.jahr) · \($0.kategorie)" }
        return dict.keys.sorted(by: >).map { ($0, dict[$0] ?? []) }
    }
    var body: some View {
        NavigationStack {
            List {
                if gruppiert.isEmpty {
                    ContentUnavailableView("Keine Unterlagen", systemImage: "doc.text.magnifyingglass")
                } else {
                    ForEach(gruppiert, id: \.0) { gruppe, dokumente in
                        Section(gruppe) {
                            ForEach(dokumente) { dokument in
                                HStack(spacing: 12) {
                                    Image(systemName: "doc.text.fill")
                                        .foregroundColor(.blue)
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(dokument.titel).bold()
                                        Text(dokument.dateiname)
                                            .font(.caption)
                                            .foregroundColor(.secondary)
                                        Text(dokument.hochgeladenAm)
                                            .font(.caption2)
                                            .foregroundColor(.secondary)
                                    }
                                    Spacer()
                                    DokumentOeffnenButton(dateiUrl: dokument.dateiUrl, titel: dokument.titel)
                                }
                            }
                        }
                    }
                }
            }
            .portalPullToRefresh()
            .navigationTitle("Unterlagen")
        }
    }
}

struct KundenKalenderView: View {
    @EnvironmentObject var syncManager: AWSDataSyncManager
    var body: some View {
        NavigationStack {
            List {
                if syncManager.kundenTermine.isEmpty {
                    ContentUnavailableView("Keine Termine", systemImage: "calendar.badge.exclamationmark")
                } else {
                    Section("Geplante Termine") {
                        ForEach(syncManager.kundenTermine.sorted { $0.start < $1.start }) { termin in
                            TerminRowView(termin: termin)
                        }
                    }
                }
            }
            .portalPullToRefresh()
            .navigationTitle("Kalender")
        }
    }
}

struct TerminRowView: View {
    let termin: KundenTermin

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack {
                Text(termin.titel).bold()
                Spacer()
                Text(termin.status)
                    .font(.caption.bold())
                    .foregroundColor(.blue)
            }
            Text(termin.typ)
                .font(.caption)
                .foregroundColor(.secondary)
            Text(termin.ort)
                .font(.caption)
                .foregroundColor(.secondary)
            Text(termin.start)
                .font(.footnote)
                .foregroundColor(.secondary)
            if let beschreibung = termin.beschreibung, !beschreibung.isEmpty {
                Text(beschreibung)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}

struct LoginView: View {
    @EnvironmentObject var syncManager: AWSDataSyncManager
    @State private var email = ""
    @State private var passwort = ""
    @State private var passwortSpeichern = true
    @State private var passwortSichtbar = false

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color(red: 0.06, green: 0.12, blue: 0.20), Color(red: 0.88, green: 0.91, blue: 0.94)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            ScrollView {
                VStack(spacing: 14) {
                    Spacer(minLength: 18)

                    VStack(spacing: 16) {
                        Text("IMMOBILIENTOOL")
                            .font(.system(size: 21, weight: .semibold, design: .default))
                            .tracking(4)
                            .foregroundStyle(.black)
                            .padding(.horizontal, 18)
                            .padding(.vertical, 10)
                            .background(.white)
                            .clipShape(Capsule())
                            .shadow(color: .black.opacity(0.08), radius: 14, y: 6)
                            .accessibilityLabel("Immobilientool")

                        VStack(spacing: 5) {
                            Text("Verwaltungsportal")
                                .font(.title2.bold())
                            Text("Zugang nur für freigegebene Kunden, Eigentümer und Mitarbeitende.")
                                .font(.footnote)
                                .foregroundColor(.secondary)
                        }
                        .multilineTextAlignment(.center)

                        VStack(alignment: .leading, spacing: 10) {
                            Text("E-Mail")
                                .font(.caption.bold())
                            TextField("Ihre E-Mail-Adresse", text: $email)
                                .keyboardType(.emailAddress)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                                .padding(13)
                                .background(Color(.systemBackground))
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(.separator)))

                            Text("Passwort")
                                .font(.caption.bold())
                            HStack {
                                Group {
                                    if passwortSichtbar {
                                        TextField("Ihr Passwort", text: $passwort)
                                    } else {
                                        SecureField("Ihr Passwort", text: $passwort)
                                    }
                                }
                                Button {
                                    passwortSichtbar.toggle()
                                } label: {
                                    Image(systemName: passwortSichtbar ? "eye.slash" : "eye")
                                        .foregroundColor(.secondary)
                                }
                            }
                            .padding(13)
                            .background(Color(.systemBackground))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(.separator)))

                            Toggle("Zugangsdaten lokal speichern", isOn: $passwortSpeichern)
                                .font(.footnote)
                        }

                        Button {
                            if passwortSpeichern {
                                _ = KeychainHelper.speichern(email, fuer: "login_email")
                            } else {
                                KeychainHelper.loeschen(fuer: "login_email")
                            }

                            syncManager.login(email: email, kennwort: passwort)
                        } label: {
                            HStack {
                                if syncManager.ladeDaten {
                                    ProgressView()
                                        .tint(.white)
                                }
                                Text(syncManager.ladeDaten ? "Anmeldung läuft..." : "Anmelden")
                                    .bold()
                            }
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding(14)
                            .background(Color(red: 0.04, green: 0.11, blue: 0.20))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                        }
                        .disabled(syncManager.ladeDaten)

                        if let fehler = syncManager.letzteFehlermeldung {
                            Text(fehler)
                                .font(.footnote)
                                .foregroundColor(.red)
                                .multilineTextAlignment(.center)
                        }

                        VStack(alignment: .leading, spacing: 8) {
                            Text("Zugang beantragen")
                                .font(.subheadline.bold())
                            Text("Neue Zugangsdaten oder Passwort-Reset bitte direkt bei uns beantragen.")
                                .font(.footnote)
                                .foregroundColor(.secondary)
                            HStack(spacing: 14) {
                                Link("info@example.invalid", destination: URL(string: "mailto:info@example.invalid")!)
                                    .font(.footnote.bold())
                                Link("+41 00 000 00 00", destination: URL(string: "tel://+41000000000")!)
                                    .font(.footnote.bold())
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(13)
                        .background(Color(.secondarySystemBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                    }
                    .padding(20)
                    .background(.regularMaterial)
                    .clipShape(RoundedRectangle(cornerRadius: 24))
                    .overlay(RoundedRectangle(cornerRadius: 24).stroke(.white.opacity(0.65)))
                    .shadow(color: .black.opacity(0.16), radius: 24, y: 12)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 18)
                }
            }
        }
        .onAppear { email = KeychainHelper.laden(fuer: "login_email") ?? "" }
    }
}

struct EinstellungenView: View {
    @EnvironmentObject var syncManager: AWSDataSyncManager

    var body: some View {
        NavigationStack {
            List {
                if syncManager.zeigtSupportKundenVorschau {
                    Section("Support") {
                        if let person = syncManager.aktiveKundenPerson {
                            Text("Sie sehen gerade die Kundenansicht von \(person.name).")
                                .font(.footnote)
                                .foregroundColor(.secondary)
                        }

                        Button {
                            syncManager.kundenVorschauBeenden()
                        } label: {
                            Label("Zurück zur Verwaltungsansicht", systemImage: "arrow.uturn.backward.circle.fill")
                        }
                    }
                }

                Section("Konto") {
                    Text(
                        syncManager.aktiveKundenPerson?.name
                        ?? (syncManager.eingeloggterUserEmail.isEmpty
                            ? "Unbekannt"
                            : syncManager.eingeloggterUserEmail)
                    )
                    .bold()

                    if let person = syncManager.aktiveKundenPerson,
                       let liegenschaft = syncManager.aktiveKundenLiegenschaft {
                        Text("\(person.rolle) · \(liegenschaft.name)")
                            .foregroundColor(.secondary)
                    }
                }

                // Firmendaten aus AWS (bereich = 'Firmendaten')
                let firmendaten = syncManager.portalInhalte.filter { $0.bereich == "Firmendaten" && ($0.sichtbar ?? true) }
                let telefon = firmendaten.first { $0.titel == "Telefon" }?.inhalt
                let email = firmendaten.first { $0.titel == "E-Mail" }?.inhalt
                let adresse = firmendaten.first { $0.titel == "Adresse" }?.inhalt
                let webseite = firmendaten.first { $0.titel == "Webseite" }?.inhalt
                let buerozeiten = firmendaten.first { $0.titel == "Bürozeiten" }?.inhalt
                let firmaname = firmendaten.first { $0.titel == "Firmenname" }?.inhalt ?? "Immobilientool"

                Section(firmaname) {
                    if let adresse,
                       let encoded = adresse.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
                       let mapsURL = URL(string: "http://maps.apple.com/?q=\(encoded)") {
                        Link(destination: mapsURL) {
                            Label(adresse, systemImage: "mappin.circle.fill")
                        }
                    }
                    if let tel = telefon, let url = URL(string: "tel://\(tel.replacingOccurrences(of: " ", with: ""))") {
                        Link(destination: url) {
                            Label(tel, systemImage: "phone.fill")
                        }
                    }
                    if let mail = email, let url = URL(string: "mailto:\(mail)") {
                        Link(destination: url) {
                            Label(mail, systemImage: "envelope.fill")
                        }
                    }
                    if let web = webseite, let url = URL(string: web) {
                        Link(destination: url) {
                            Label(web, systemImage: "globe")
                        }
                    }
                    // Öffnungszeiten aus AWS
                    let oezInhalt = syncManager.portalInhalte.first {
                        $0.bereich == "Öffnungszeiten" && $0.titel == "Konfiguration"
                    }?.inhalt
                    if let oezInhalt {
                        NavigationLink {
                            OeffnungszeitenDetailView(jsonInhalt: oezInhalt)
                        } label: {
                            Label("Öffnungszeiten", systemImage: "clock.fill")
                        }
                    } else if let zeiten = buerozeiten {
                        Label(zeiten, systemImage: "clock.fill")
                            .foregroundColor(.secondary)
                    }
                }

                // Unser Team
                let team = syncManager.verfuegbareMitarbeiter
                    .filter { $0.teamSichtbar == true }
                    .sorted { ($0.teamSortierung ?? 100) < ($1.teamSortierung ?? 100) }

                if !team.isEmpty {
                    Section("Unser Team") {
                        ForEach(team) { ma in
                            NavigationLink {
                                MitarbeiterKontaktView(mitarbeiter: ma)
                            } label: {
                                HStack(spacing: 12) {
                                    S3BildView(urlOrPfad: ma.photoUrl, breite: 44, hoehe: 44, eckenRadius: 999)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(ma.name).bold()
                                        Text(ma.funktion)
                                            .font(.caption)
                                            .foregroundColor(.secondary)
                                    }
                                }
                            }
                        }
                    }
                }

                // Weitere sichtbare Inhalte (nicht Firmendaten, nicht Öffnungszeiten)
                let weitereInhalte = syncManager.portalInhalte.filter {
                    $0.bereich != "Firmendaten" && $0.bereich != "Öffnungszeiten" && ($0.sichtbar ?? true)
                }
                if !weitereInhalte.isEmpty {
                    Section("Informationen") {
                        ForEach(weitereInhalte) { inhalt in
                            VStack(alignment: .leading, spacing: 4) {
                                Text(inhalt.titel).bold()
                                if let text = inhalt.inhalt, !text.isEmpty {
                                    Text(text)
                                        .font(.footnote)
                                        .foregroundColor(.secondary)
                                }
                            }
                        }
                    }
                }

                Section {
                    Button("Abmelden", role: .destructive) {
                        syncManager.logout()
                    }
                }
            }
            .portalPullToRefresh()
            .navigationTitle("Einstellungen")
        }
    }
}
