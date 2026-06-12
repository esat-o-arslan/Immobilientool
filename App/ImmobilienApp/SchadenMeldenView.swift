//
//  SchadenMeldenView.swift
//  ImmobilienApp
//
//  Open-source template on 19.05.2026.
//

import SwiftUI
import PhotosUI
import UIKit

struct SchadenMeldenView: View {
    @EnvironmentObject var syncManager: AWSDataSyncManager
    @State private var ausgewaehlterStatus: SchadenfallStatus = .OFFEN
    @State private var zeigeNeuenSchadenSheet = false

    var gefilterteSchaeden: [SchadenfallDetail] {
        syncManager.aktiveSchadenfaelle.filter { $0.status == ausgewaehlterStatus }
    }

    var body: some View {
        NavigationStack {
            VStack {
                Picker("Status", selection: $ausgewaehlterStatus) {
                    ForEach(SchadenfallStatus.allCases, id: \.self) { status in
                        Text(status.anzeigeText).tag(status)
                    }
                }
                .pickerStyle(.segmented)
                .padding()

                if gefilterteSchaeden.isEmpty {
                    Spacer()
                    ContentUnavailableView(
                        "Keine Meldungen",
                        systemImage: "doc.text.magnifyingglass",
                        description: Text("In dieser Kategorie liegen aktuell keine Schadenfälle vor.")
                    )
                    Spacer()
                } else {
                    List(gefilterteSchaeden) { schaden in
                        NavigationLink(destination: SchadenDetailView(schaden: schaden)) {
                            VStack(alignment: .leading, spacing: 5) {
                                Text(schaden.titel)
                                    .font(.headline)

                                Text(schaden.liegenschaftAdresse)
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)

                                Text(schaden.plzOrt)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                    .portalPullToRefresh()
                }
            }
            .navigationTitle("Schaden melden")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        zeigeNeuenSchadenSheet = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .font(.title3)
                    }
                }
            }
            .sheet(isPresented: $zeigeNeuenSchadenSheet) {
                NeuerSchadenView()
                    .environmentObject(syncManager)
            }
        }
    }
}

// MARK: - Detailansicht

struct SchadenDetailView: View {
    let schaden: SchadenfallDetail
    @EnvironmentObject var syncManager: AWSDataSyncManager
    @State private var neueNachrichtText = ""
    @State private var zeigeAuftragSheet = false
    @State private var zeigeKIAssistent = false

    var liveSchaden: SchadenfallDetail? {
        syncManager.schadenfaelle.first(where: { $0.id == schaden.id })
    }

    var schadenKIKontext: String {
        let s = liveSchaden ?? schaden
        let hw = syncManager.aktiveHandwerker.first { $0.id == s.handwerkerId }
        let hwInfo = hw.map { "Handwerker: \($0.firma) [\($0.gewerk)] | Tel: \($0.telefon ?? "—") | Email: \($0.email ?? "—")" } ?? "Kein Handwerker zugewiesen."
        return """
        Schadenfall: \(s.titel)
        Fall-Nr.: \(s.fallNummer ?? "—")
        Status: \(s.status.anzeigeText)
        Priorität: \(s.prioritaet ?? "—")
        Kategorie: \(s.kategorie ?? "—")
        Liegenschaft: \(s.liegenschaftAdresse), \(s.plzOrt)
        Gemeldet von: \(s.gemeldetVon)
        \(hwInfo)
        """
    }

    var body: some View {
        VStack {
            List {
                Section("Details zum Fall") {
                    if let fallNr = liveSchaden?.fallNummer ?? schaden.fallNummer {
                        Text("**Fall-Nr.:** \(fallNr)")
                    }
                    Text("**Titel:** \(liveSchaden?.titel ?? schaden.titel)")
                    Text("**Adresse:** \(liveSchaden?.liegenschaftAdresse ?? schaden.liegenschaftAdresse)")
                    Text("**PLZ / Ort:** \(liveSchaden?.plzOrt ?? schaden.plzOrt)")
                    Text("**Beschreibung:** \(liveSchaden?.beschreibung ?? schaden.beschreibung)")
                    Text("**Gemeldet von:** \(liveSchaden?.gemeldetVon ?? schaden.gemeldetVon)")
                    Text("**Status:** \((liveSchaden?.status ?? schaden.status).anzeigeText)")

                    if (liveSchaden?.status ?? schaden.status) != .ERLEDIGT {
                        Button {
                            syncManager.schadenfallAbschliessen(liveSchaden ?? schaden)
                        } label: {
                            Label("Fall abschliessen", systemImage: "checkmark.circle.fill")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.green)
                    } else {
                        Label("Fall abgeschlossen", systemImage: "checkmark.seal.fill")
                            .foregroundColor(.green)
                    }
                }
                
                if let bilder = liveSchaden?.fotoUrls, !bilder.isEmpty {
                    Section("Bilder") {
                        ForEach(bilder, id: \.self) { url in
                            AsyncImage(url: URL(string: url)) { image in
                                image
                                    .resizable()
                                    .scaledToFit()
                                    .frame(maxHeight: 220)
                            } placeholder: {
                                ProgressView()
                            }
                        }
                    }
                }

                Section("Chat zum Schadenfall") {
                    let verlauf = liveSchaden?.chatVerlauf ?? schaden.chatVerlauf

                    if verlauf.isEmpty {
                        Text("Noch keine Nachrichten zu diesem Fall vorhanden.")
                            .font(.caption)
                            .foregroundColor(.gray)
                    } else {
                        ForEach(verlauf) { msg in
                            let absender = msg.absender.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                            let istVonMir = syncManager.istMitarbeiterAnsicht && !syncManager.zeigtSupportKundenVorschau
                                ? absender == syncManager.eingeloggterUserEmail.lowercased() || absender.contains("verwaltung")
                                : msg.isVonMir(aktuelleEmail: syncManager.eingeloggterUserEmail)

                            HStack {
                                if istVonMir { Spacer() }

                                VStack(alignment: istVonMir ? .trailing : .leading, spacing: 4) {
                                    Text(msg.absender)
                                        .font(.caption)
                                        .foregroundColor(.secondary)

                                    Text(msg.nachricht)
                                        .padding(10)
                                        .background(istVonMir ? Color.blue : Color(.systemGray5))
                                        .foregroundColor(istVonMir ? .white : .primary)
                                        .cornerRadius(10)
                                }

                                if !istVonMir { Spacer() }
                            }
                        }
                    }
                }
            }
            .portalPullToRefresh()

            if (liveSchaden?.status ?? schaden.status) != .ERLEDIGT {
                HStack {
                    TextField("Nachricht zum Schaden...", text: $neueNachrichtText)
                        .textFieldStyle(.roundedBorder)

                    Button {
                        let text = neueNachrichtText.getrimmt
                        guard !text.isEmpty else { return }

                        syncManager.sendeSchadensNachricht(fuer: schaden.id, text: text)
                        neueNachrichtText = ""
                    } label: {
                        Image(systemName: "paperplane.fill")
                    }
                }
                .padding()
            }
        }
        .navigationTitle(schaden.titel)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .navigationBarTrailing) {
                Button {
                    zeigeKIAssistent = true
                } label: {
                    Image(systemName: "sparkles")
                }
                if syncManager.istMitarbeiterAnsicht {
                    Button {
                        zeigeAuftragSheet = true
                    } label: {
                        Label("Auftrag", systemImage: "doc.text.fill")
                    }
                }
            }
        }
        .sheet(isPresented: $zeigeAuftragSheet) {
            AuftragErstellenView(fall: liveSchaden ?? schaden)
                .environmentObject(syncManager)
        }
        .sheet(isPresented: $zeigeKIAssistent) {
            AIAssistantView(
                kontext: schadenKIKontext,
                systemPrompt: """
                Du hilfst beim Bearbeiten einer Schadensmeldung für Immobilientool. Mache konkrete Vorschläge für Priorität, Handwerker-Anweisungen und Kommunikation. Du kennst alle Details aus dem Kontext.

                ═══ DIREKTAKTIONEN ═══
                <<<PORTAL_AKTION>>>
                {"typ":"AKTIONSTYP",...}
                <<<ENDE_AKTION>>>

                Verfügbare Aktionen:
                - Handwerker anrufen: {"typ":"call","nummer":"Nummer aus Kontext"}
                - E-Mail an Handwerker: {"typ":"email","adresse":"Email aus Kontext"}
                - Liegenschaft in Karten: {"typ":"open_maps","adresse":"Adresse aus Kontext"}

                Nutze Aktionen NUR wenn der Nutzer es wünscht.
                """,
                schnellstarts: [
                    "Priorität einschätzen",
                    "Handwerker anrufen",
                    "Antwort an Mieter formulieren",
                    "Auftragstext erstellen",
                    "Nächste Schritte vorschlagen"
                ]
            )
        }
    }
}

// MARK: - Auftrag aus Meldung erstellen

private let AUFTRAGSARTEN_IOS: [(label: String, geraetTyp: String, text: String)] = [
    ("— Auftragsart wählen —", "", ""),
    ("Waschmaschine defekt", "Waschmaschine", "Gemäss Mietermeldung ist die Waschmaschine defekt. Bitte um Überprüfung und Reparatur."),
    ("Tumbler defekt", "Tumbler", "Gemäss Mietermeldung ist der Tumbler defekt. Bitte um Überprüfung und Reparatur."),
    ("Elektriker / Beleuchtung", "Aussenbeleuchtung", "Beleuchtung defekt. Bitte überprüfen und instand stellen."),
    ("Aussenbeleuchtung defekt", "Aussenbeleuchtung", "Aussenbeleuchtung funktioniert nicht. Bitte um Überprüfung."),
    ("Kellerbeleuchtung defekt", "Sonstiges", "Beleuchtung im Allgemeinkeller defekt. Bitte anschauen und wenn nötig Elektriker beauftragen."),
    ("Garagetor defekt", "Garagetor", "Garagentor funktioniert nicht einwandfrei. Bitte um Überprüfung und Reparatur."),
    ("Heizungsausfall", "Heizung", "Mieter meldet Heizungsausfall. Bitte umgehend überprüfen und beheben."),
    ("Boiler defekt", "Boiler", "Boiler defekt, kein Warmwasser. Bitte umgehend überprüfen."),
    ("Lift defekt", "Lift", "Lift funktioniert nicht. Bitte Servicetechniker beauftragen."),
    ("Sanitär / Wasserhahn", "Sonstiges", "Sanitärproblem gemeldet. Bitte überprüfen und reparieren."),
    ("Freier Auftrag", "", ""),
]

struct AuftragErstellenView: View {
    let fall: SchadenfallDetail
    @EnvironmentObject var syncManager: AWSDataSyncManager
    @Environment(\.dismiss) var dismiss

    @State private var selectedHandwerkerId = ""
    @State private var selectedGeraetId = ""
    @State private var auftragsartIdx = 0
    @State private var auftragstext = ""
    @State private var sendeStatus: AuftragSendeStatus = .bereit
    @State private var fehlerMeldung = ""

    enum AuftragSendeStatus { case bereit, sendet, erfolg, fehler }

    var geraete: [AppGeraet] {
        guard let lid = fall.liegenschaftId else { return [] }
        return syncManager.geraeteFuer(liegenschaftId: lid)
    }

    var selectedHandwerker: AppHandwerker? {
        syncManager.aktiveHandwerker.first { $0.id == selectedHandwerkerId }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Meldung") {
                    if let fn = fall.fallNummer { Text("Fall-Nr. \(fn)").bold() }
                    Text(fall.titel).foregroundColor(.secondary)
                    Text((fall.status).anzeigeText)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Section("Handwerker *") {
                    Picker("Handwerker / Firma", selection: $selectedHandwerkerId) {
                        Text("— Handwerker wählen —").tag("")
                        ForEach(syncManager.aktiveHandwerker) { hw in
                            Text("\(hw.firma) · \(hw.gewerk)").tag(hw.id)
                        }
                    }
                    if let hw = selectedHandwerker {
                        if let kontakt = hw.kontaktperson { Label(kontakt, systemImage: "person.fill").font(.caption) }
                        if let tel = hw.telefon { Link(tel, destination: URL(string: "tel://\(tel)")!).font(.caption) }
                    }
                }

                if !geraete.isEmpty {
                    Section("Betroffenes Gerät") {
                        Picker("Gerät (optional)", selection: $selectedGeraetId) {
                            Text("— kein Gerät —").tag("")
                            ForEach(geraete) { g in
                                Text("\(g.typ) · \(g.bezeichnung)\(g.standort.map { " (\($0))" } ?? "")").tag(g.id)
                            }
                        }
                        .onChange(of: selectedGeraetId) { _, gid in
                            guard let g = geraete.first(where: { $0.id == gid }) else { return }
                            if let idx = AUFTRAGSARTEN_IOS.firstIndex(where: { $0.geraetTyp == g.typ }), idx > 0 {
                                auftragsartIdx = idx
                                if auftragstext.isEmpty { auftragstext = AUFTRAGSARTEN_IOS[idx].text }
                            }
                        }
                    }
                }

                Section("Auftragsart") {
                    Picker("Auftragsart", selection: $auftragsartIdx) {
                        ForEach(Array(AUFTRAGSARTEN_IOS.enumerated()), id: \.offset) { idx, art in
                            Text(art.label).tag(idx)
                        }
                    }
                    .onChange(of: auftragsartIdx) { _, idx in
                        let text = AUFTRAGSARTEN_IOS[idx].text
                        if !text.isEmpty { auftragstext = text }
                    }
                }

                Section("Auftragstext") {
                    TextEditor(text: $auftragstext)
                        .frame(minHeight: 120)
                }

                switch sendeStatus {
                case .bereit:
                    Section {
                        Button("Auftrag erteilen") {
                            guard !selectedHandwerkerId.isEmpty else {
                                sendeStatus = .fehler
                                fehlerMeldung = "Bitte einen Handwerker auswählen."
                                return
                            }
                            sendeStatus = .sendet
                            let hwName = selectedHandwerker?.firma ?? selectedHandwerkerId
                            let geraetName = geraete.first(where: { $0.id == selectedGeraetId })?.bezeichnung
                            syncManager.erstelleAuftrag(
                                fuer: fall,
                                handwerkerId: selectedHandwerkerId,
                                handwerkerName: hwName,
                                auftragstext: auftragstext,
                                geraetBezeichnung: geraetName
                            ) { erfolg in
                                sendeStatus = erfolg ? .erfolg : .fehler
                                if !erfolg { fehlerMeldung = syncManager.letzteFehlermeldung ?? "Auftrag konnte nicht gesendet werden." }
                            }
                        }
                        .disabled(selectedHandwerkerId.isEmpty)
                    }

                case .sendet:
                    Section { HStack { ProgressView(); Text("Auftrag wird erteilt …").foregroundColor(.secondary) } }

                case .erfolg:
                    Section {
                        VStack(alignment: .leading, spacing: 8) {
                            Label("Auftrag erteilt! Status: Handwerker beauftragt.", systemImage: "checkmark.circle.fill")
                                .foregroundColor(.green).bold()
                            Button("Schliessen") { dismiss() }
                        }
                    }

                case .fehler:
                    Section {
                        VStack(alignment: .leading, spacing: 8) {
                            Label(fehlerMeldung, systemImage: "xmark.circle.fill").foregroundColor(.red)
                            Button("Erneut versuchen") { sendeStatus = .bereit }
                        }
                    }
                }
            }
            .navigationTitle("Auftrag erstellen")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Abbrechen") { dismiss() }
                }
            }
            .onAppear {
                auftragstext = fall.beschreibung
                if let _ = fall.liegenschaftId,
                   let existingHW = fall.handwerkerId {
                    selectedHandwerkerId = existingHW
                }
            }
        }
    }
}

// MARK: - Neuer Schaden

struct NeuerSchadenView: View {
    @EnvironmentObject var syncManager: AWSDataSyncManager
    @Environment(\.dismiss) var dismiss

    @State private var formular = SchadenFormularInput()
    @State private var photoItems: [PhotosPickerItem] = []
    @State private var ausgewaehlteBilder: [UIImage] = []
    @State private var zeigeFehler = false
    @State private var zeigeKIAssistent = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Meldung") {
                    TextField("Titel / Kurzbezeichnung *", text: $formular.titel)
                    TextField("Beschreibung des Schadens *", text: $formular.beschreibung, axis: .vertical)
                        .lineLimit(4...8)

                    Picker("Kategorie", selection: $formular.kategorie) {
                        ForEach(["Schaden", "Heizung", "Sanitär", "Wasser", "Elektrik",
                                 "Schimmel", "Fenster", "Schlüssel", "Unterlagen", "Sonstiges"], id: \.self) { kat in
                            Text(kat).tag(kat)
                        }
                    }

                    Picker("Dringlichkeit *", selection: $formular.dringlichkeit) {
                        ForEach(Dringlichkeit.allCases, id: \.self) { wert in
                            Text(wert.rawValue).tag(wert)
                        }
                    }
                }

                Section("Ihre Angaben") {
                    TextField("Vorname *", text: $formular.vorname)
                    TextField("Nachname *", text: $formular.nachname)
                    TextField("E-Mail *", text: $formular.email)
                        .keyboardType(.emailAddress)
#if os(iOS)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
#endif
                    TextField("Telefon", text: $formular.telefon)
                        .keyboardType(.phonePad)
                }

                Section("Adresse / Liegenschaft") {
                    TextField("Strasse *", text: $formular.strasse)
                    TextField("PLZ / Ort *", text: $formular.plzOrt)
                    TextField("Liegenschaft (optional)", text: $formular.liegenschaftAdresse)
                }

                Section("Zusatzangaben") {
                    TextField("Weitere Informationen", text: $formular.bemerkungIntern, axis: .vertical)
                        .lineLimit(3...6)
                }

                Section("Bilder") {
                    PhotosPicker(
                        selection: $photoItems,
                        maxSelectionCount: 6,
                        matching: .images
                    ) {
                        Label("Bilder auswählen", systemImage: "photo.on.rectangle.angled")
                    }

                    if !ausgewaehlteBilder.isEmpty {
                        ScrollView(.horizontal) {
                            HStack(spacing: 12) {
                                ForEach(Array(ausgewaehlteBilder.enumerated()), id: \.offset) { _, bild in
                                    Image(uiImage: bild)
                                        .resizable()
                                        .scaledToFill()
                                        .frame(width: 92, height: 92)
                                        .clipped()
                                        .cornerRadius(10)
                                }
                            }
                            .padding(.vertical, 4)
                        }

                        Text("Die Bilder werden vor dem Upload komprimiert.")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }

                if zeigeFehler && !formular.pflichtfelderSindGueltig {
                    Section {
                        Text("Bitte alle Pflichtfelder ausfüllen.")
                            .foregroundColor(.red)
                    }
                }

                if let fehler = syncManager.letzteFehlermeldung, !fehler.isEmpty {
                    Section {
                        Text(fehler)
                            .foregroundColor(.red)
                    }
                }
            }
            .navigationTitle("Schaden erfassen")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Abbrechen") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    HStack(spacing: 4) {
                        Button {
                            zeigeKIAssistent = true
                        } label: {
                            Image(systemName: "sparkles")
                        }
                        Button(syncManager.ladeDaten ? "Sende..." : "Senden") {
                            guard formular.pflichtfelderSindGueltig else {
                                zeigeFehler = true
                                return
                            }
                            syncManager.hochladenSchaden(
                                formular: formular,
                                bilder: ausgewaehlteBilder
                            ) { erfolg in
                                if erfolg { dismiss() }
                            }
                        }
                        .disabled(syncManager.ladeDaten)
                    }
                }
            }
            .task(id: photoItems) {
                await ladePhotos()
            }
            .onAppear {
                fuelleKundendatenWennMoeglich()
            }
            .sheet(isPresented: $zeigeKIAssistent) {
                AIAssistantView(
                    kontext: "Schadensmeldung erfassen. Bisher: Titel=\(formular.titel.isEmpty ? "leer" : formular.titel), Kategorie=\(formular.kategorie), Dringlichkeit=\(formular.dringlichkeit.rawValue). Adresse: \(formular.strasse), \(formular.plzOrt).",
                    systemPrompt: """
                    Du hilfst beim Erfassen einer Schadensmeldung für Immobilientool. Stelle gezielte Fragen um das Problem zu verstehen, dann fülle das Formular aus.

                    ═══ FORMULAR AUSFÜLLEN ═══
                    Wenn du genug Informationen hast, füge am ENDE deiner Antwort exakt diesen Block an (unsichtbar für den Nutzer):

                    <<<PORTAL_AKTION>>>
                    {"typ":"fill_form","felder":{"titel":"...","beschreibung":"...","kategorie":"Schaden|Heizung|Sanitär|Wasser|Elektrik|Schimmel|Fenster|Schlüssel|Unterlagen|Sonstiges","dringlichkeit":"Niedrig|Mittel|Hoch|Dringend"}}
                    <<<ENDE_AKTION>>>

                    Titel max 60 Zeichen. Beschreibung vollständig (was, wo, seit wann). Dringend=akute Gefahr, Hoch=wichtig, Mittel=normal, Niedrig=kosmetisch.
                    """,
                    schnellstarts: [
                        "Wasserschaden in der Küche",
                        "Heizung funktioniert nicht",
                        "Schimmel entdeckt",
                        "Fenster kaputt",
                        "Elektrik defekt",
                        "Vollständige Meldung erstellen"
                    ],
                    onFormFill: { felder in
                        if let titel = felder["titel"], !titel.isEmpty { formular.titel = titel }
                        if let beschreibung = felder["beschreibung"], !beschreibung.isEmpty { formular.beschreibung = beschreibung }
                        if let kategorie = felder["kategorie"] {
                            let gueltig = ["Schaden","Heizung","Sanitär","Wasser","Elektrik","Schimmel","Fenster","Schlüssel","Unterlagen","Sonstiges"]
                            if gueltig.contains(kategorie) { formular.kategorie = kategorie }
                        }
                        if let dring = felder["dringlichkeit"], let d = Dringlichkeit(rawValue: dring) {
                            formular.dringlichkeit = d
                        }
                    }
                )
            }
        }
    }

    private func fuelleKundendatenWennMoeglich() {
        guard let person = syncManager.aktiveKundenPerson else {
            if formular.email.isEmpty {
                formular.email = syncManager.eingeloggterUserEmail
            }
            return
        }

        let namensteile = person.name.split(separator: " ", maxSplits: 1).map(String.init)
        if formular.vorname.isEmpty {
            formular.vorname = namensteile.first ?? ""
        }
        if formular.nachname.isEmpty {
            formular.nachname = namensteile.dropFirst().first ?? ""
        }
        if formular.email.isEmpty {
            formular.email = person.email
        }
        if formular.telefon.isEmpty {
            formular.telefon = person.telefon ?? ""
        }
        if let liegenschaft = syncManager.aktiveKundenLiegenschaft {
            if formular.strasse.isEmpty {
                formular.strasse = liegenschaft.strasse
            }
            if formular.plzOrt.isEmpty {
                formular.plzOrt = "\(liegenschaft.plz) \(liegenschaft.ort)"
            }
            if formular.liegenschaftAdresse.isEmpty {
                formular.liegenschaftAdresse = liegenschaft.name
            }
        }
    }

    private func ladePhotos() async {
        var neueBilder: [UIImage] = []

        for item in photoItems {
            if let data = try? await item.loadTransferable(type: Data.self),
               let image = UIImage(data: data) {
                neueBilder.append(image)
            }
        }

        await MainActor.run {
            ausgewaehlteBilder = neueBilder
        }
    }
}
