//
//  AWSDataSyncManager.swift
//  ImmobilienApp
//
//  Open-source template on 19.05.2026.
//

import Foundation
import UIKit
import Combine
import Amplify

final class AWSDataSyncManager: ObservableObject {

    // MARK: - Published State

    @Published var verfuegbareMitarbeiter: [Mitarbeiter] = []
    @Published var istEingeloggt = false
    @Published var eingeloggterUserEmail = ""
    @Published var ladeDaten = false
    @Published var schadenfaelle: [SchadenfallDetail] = []
    @Published var allgemeineChats: [AllgemeinerChat] = []
    @Published var kundenDokumente: [KundenDokument] = []
    @Published var kundenTermine: [KundenTermin] = []
    @Published var appRolle: PortalRolle = .mieter
    @Published var liegenschaften: [AppLiegenschaft] = []
    @Published var kontaktPersonen: [AppKontaktPerson] = []
    @Published var handwerkerListe: [AppHandwerker] = []
    @Published var portalInhalte: [PortalInhalt] = []
    @Published var mitarbeiterDokumente: [MitarbeiterDokument] = []
    @Published var liegenschaftGeraete: [AppGeraet] = []
    @Published var letzteFehlermeldung: String?
    @Published var supportKundenVorschauPersonId: String?

    @Published var aktuelleVertretung: VertretungsInfo? = nil

    private var wurdeGestartet = false
    
    private let schadenCacheKey = "cached_schadenfaelle"

    private func cacheSchadenfaelleSpeichern() {
        if let data = try? JSONEncoder().encode(schadenfaelle) {
            UserDefaults.standard.set(data, forKey: schadenCacheKey)
        }
    }

    private func cacheSchadenfaelleLaden() {
        guard let data = UserDefaults.standard.data(forKey: schadenCacheKey),
              let cached = try? JSONDecoder().decode([SchadenfallDetail].self, from: data) else {
            return
        }

        schadenfaelle = cached
    }

    init() { }

    // MARK: - App Start

    func starteApp() {
        guard !wurdeGestartet else { return }
        wurdeGestartet = true
        pruefeAWSLoginStatus()
    }

    // MARK: - Auth

    func login(email: String, kennwort: String) {
        let bereinigteEmail = email.getrimmt
        let bereinigtesKennwort = kennwort.getrimmt

        guard !bereinigteEmail.isEmpty, !bereinigtesKennwort.isEmpty else {
            Task { @MainActor in
                letzteFehlermeldung = "Bitte E-Mail und Passwort eingeben."
            }
            return
        }

        Task {
            await MainActor.run {
                ladeDaten = true
                letzteFehlermeldung = nil
            }

            do {
                let session = try await Amplify.Auth.fetchAuthSession()

                if session.isSignedIn {
                    await MainActor.run {
                        eingeloggterUserEmail = bereinigteEmail
                        istEingeloggt = true
                        ladeDaten = false
                        letzteFehlermeldung = nil
                    }
                    await ladePortalCloudDaten()
                    return
                }

                let signInResult = try await Amplify.Auth.signIn(
                    username: bereinigteEmail,
                    password: bereinigtesKennwort
                )

                await MainActor.run {
                    ladeDaten = false
                }

                if signInResult.isSignedIn {
                    await MainActor.run {
                        eingeloggterUserEmail = bereinigteEmail
                        istEingeloggt = true
                        letzteFehlermeldung = nil
                    }

                    await ladePortalCloudDaten()
                } else {
                    await MainActor.run {
                        letzteFehlermeldung = "Anmeldung konnte nicht abgeschlossen werden."
                    }
                }

            } catch let authError as AuthError {
                print("AUTH ERROR DESCRIPTION: \(authError.errorDescription)")
                print("AUTH ERROR SUGGESTION: \(authError.recoverySuggestion)")
                print("AUTH ERROR UNDERLYING: \(String(describing: authError.underlyingError))")

                let beschreibung = authError.errorDescription
                let lower = beschreibung.lowercased()

                await MainActor.run {
                    ladeDaten = false
                    istEingeloggt = false

                    if lower.contains("already a user in signedin state") {
                        letzteFehlermeldung = "Es ist bereits ein Benutzer angemeldet."
                    } else if lower.contains("incorrect username or password") {
                        letzteFehlermeldung = "E-Mail/Benutzername oder Passwort ist falsch."
                    } else if lower.contains("user does not exist") {
                        letzteFehlermeldung = "Dieses Konto existiert nicht."
                    } else if lower.contains("not confirmed") {
                        letzteFehlermeldung = "Ihr Konto ist noch nicht bestätigt."
                    } else if lower.contains("network") {
                        letzteFehlermeldung = "Netzwerkfehler. Bitte erneut versuchen."
                    } else {
                        letzteFehlermeldung = "Anmelden fehlgeschlagen: \(authError.errorDescription)"
                    }
                }

            } catch {
                print("UNBEKANNTER LOGIN-FEHLER: \(error)")

                await MainActor.run {
                    ladeDaten = false
                    istEingeloggt = false
                    letzteFehlermeldung = "Anmelden fehlgeschlagen."
                }
            }
        }
    }

    func logout() {
        Task {
            _ = await Amplify.Auth.signOut()

            await MainActor.run {
                istEingeloggt = false
                eingeloggterUserEmail = ""
                schadenfaelle = []
                allgemeineChats = []
                kundenDokumente = []
                kundenTermine = []
                verfuegbareMitarbeiter = []
                supportKundenVorschauPersonId = nil
                appRolle = .mieter
                letzteFehlermeldung = nil
            }
        }
    }

    private func pruefeAWSLoginStatus() {
        Task {
            do {
                let session = try await Amplify.Auth.fetchAuthSession()

                if session.isSignedIn {
                    await MainActor.run {
                        eingeloggterUserEmail = KeychainHelper.laden(fuer: "login_email") ?? ""
                        istEingeloggt = true
                        cacheSchadenfaelleLaden()
                    }

                    await ladePortalCloudDaten()
                } else {
                    let email = KeychainHelper.laden(fuer: "login_email") ?? ""
                    let passwort = KeychainHelper.laden(fuer: "login_passwort") ?? ""

                    if !email.isEmpty && !passwort.isEmpty {
                        login(email: email, kennwort: passwort)
                    } else {
                        await MainActor.run {
                            istEingeloggt = false
                        }
                    }
                }
            } catch {
                await MainActor.run {
                    cacheSchadenfaelleLaden()
                    istEingeloggt = false
                    letzteFehlermeldung = "Session konnte nicht geladen werden."
                }
            }
        }
    }

    // MARK: - Initial Load

    func ladePortalCloudDaten() async {
        await MainActor.run {
            ladeDaten = true
            letzteFehlermeldung = nil
        }

        defer {
            Task { @MainActor in
                ladeDaten = false
            }
        }

        await ladePortalInhalte()
        await ladePortalStammdaten()
        await ladeGeraeteAusAWS()
        await ladeMitarbeiter()
        await setzeFallbackMitarbeiterWennNoetig()
        await aktualisiereRolleNachStammdaten()
        await ladeSchadenfaelle()
        await ladeSupportChats()
        await ladeKundenDokumenteUndTermine()
    }

    func aktualisierePortalCloudDaten() async {
        guard istEingeloggt else { return }
        await ladePortalCloudDaten()
    }



    // MARK: - Kundenunterlagen / Termine

    private func ladeKundenDokumenteUndTermine() async {
        await ladeDokumenteAusAWS()
        await ladeTermineAusAWS()
    }

    private func ladeDokumenteAusAWS() async {
        let query = """
        query ListDokuments {
          listDokuments {
            items {
              id
              liegenschaftId
              personId
              titel
              kategorie
              jahr
              dateiname
              dateiUrl
              volltext
              sichtbarFuerKunden
              createdAt
            }
          }
        }
        """
        do {
            let request = GraphQLRequest<ListDokumentsResponse>(
                document: query,
                responseType: ListDokumentsResponse.self
            )
            let result = try await Amplify.API.query(request: request)
            if case .success(let response) = result {
                let person = await MainActor.run { aktiveKundenPerson }
                let docs = response.listDokuments.items
                    .filter { doc in
                        guard doc.sichtbarFuerKunden == true else { return false }
                        guard let person else { return istMitarbeiterAnsicht }
                        return doc.personId == person.id || doc.liegenschaftId == person.liegenschaftId
                    }
                    .sorted { ($0.createdAt ?? "") > ($1.createdAt ?? "") }
                    .map { d in
                        KundenDokument(
                            id: d.id,
                            titel: d.titel,
                            kategorie: d.kategorie,
                            jahr: d.jahr,
                            dateiname: d.dateiname,
                            dateiUrl: d.dateiUrl,
                            hochgeladenAm: String((d.createdAt ?? "").prefix(10))
                        )
                    }
                await MainActor.run { kundenDokumente = docs }
            }
        } catch {
            await MainActor.run { kundenDokumente = [] }
            print("Dokumente konnten nicht geladen werden: \(error)")
        }
    }

    private func ladeTermineAusAWS() async {
        let query = """
        query ListKalenderTermins {
          listKalenderTermins {
            items {
              id
              titel
              typ
              liegenschaftId
              personIds
              start
              ende
              ort
              beschreibung
              status
              sichtbarInApp
            }
          }
        }
        """
        do {
            let request = GraphQLRequest<ListKalenderTerminsResponse>(
                document: query,
                responseType: ListKalenderTerminsResponse.self
            )
            let result = try await Amplify.API.query(request: request)
            if case .success(let response) = result {
                let person = await MainActor.run { aktiveKundenPerson }
                let termine = response.listKalenderTermins.items
                    .filter { t in
                        guard t.sichtbarInApp != false else { return false }
                        guard let person else { return istMitarbeiterAnsicht }
                        return t.personIds?.contains(person.id) ?? false || t.liegenschaftId == person.liegenschaftId
                    }
                    .sorted { $0.start < $1.start }
                    .map { t in
                        KundenTermin(
                            id: t.id,
                            titel: t.titel,
                            typ: t.typ,
                            start: t.start,
                            ende: t.ende,
                            ort: t.ort ?? "",
                            beschreibung: t.beschreibung,
                            status: t.status ?? "Geplant"
                        )
                    }
                await MainActor.run { kundenTermine = termine }
            }
        } catch {
            await MainActor.run { kundenTermine = [] }
            print("Termine konnten nicht geladen werden: \(error)")
        }
    }

    // MARK: - Allgemeine Chats

    private func ladeSupportChats() async {
        let chats = verfuegbareMitarbeiter.map { mitarbeiter in
            AllgemeinerChat(
                mitarbeiterId: mitarbeiter.id,
                nachrichten: []
            )
        }

        await MainActor.run {
            allgemeineChats = chats
        }
    }

    private func setzeFallbackMitarbeiterWennNoetig() async {
        // Eine neue Installation startet bewusst ohne Personenstammdaten.
    }

    // MARK: - Mitarbeiter

    private func ladeMitarbeiter() async {
        let document = """
        query ListMitarbeiters {
          listMitarbeiters {
            items {
              id
              name
              funktion
              email
              telefon
              photoUrl
              teamSichtbar
              teamSortierung
            }
          }
        }
        """

        do {
            let request = GraphQLRequest<ListMitarbeitersResponse>(
                document: document,
                responseType: ListMitarbeitersResponse.self
            )

            let result = try await Amplify.API.query(request: request)

            if case .success(let response) = result {
                await MainActor.run {
                    verfuegbareMitarbeiter = response.listMitarbeiters.items
                }
            }
        } catch {
            await setzeFallbackMitarbeiterWennNoetig()
            await MainActor.run {
                letzteFehlermeldung = nil
            }
        }
    }

    // MARK: - Schadenfälle

    private func ladeSchadenfaelle() async {
        let document = """
        query ListSchadenfalls {
          listSchadenfalls {
            items {
              id
              fallNummer
              titel
              beschreibung
              status
              prioritaet
              kategorie
              liegenschaftId
              personId
              handwerkerId
              verantwortlicherMitarbeiterId
              frist
              liegenschaftAdresse
              plzOrt
              fotoUrl
              gemeldetVon
              createdAt
              updatedAt
            }
          }
        }
        """

        do {
            let request = GraphQLRequest<ListSchadenfallsResponse>(
                document: document,
                responseType: ListSchadenfallsResponse.self
            )

            let result = try await Amplify.API.query(request: request)

            if case .success(let response) = result {
                let backendFaelle = response.listSchadenfalls.items

                var neueDetails: [SchadenfallDetail] = []

                for backendFall in backendFaelle {
                    let nachrichten = await ladeChatMessages(fuer: backendFall.id)
                    let detail = SchadenfallDetail(
                        backend: backendFall,
                        chatVerlauf: nachrichten
                    )
                    neueDetails.append(detail)
                }

                let sortierteDetails = neueDetails.sorted {
                    ($0.createdAt ?? "") > ($1.createdAt ?? "")
                }

                await MainActor.run {
                    schadenfaelle = sortierteDetails.filter { detail in
                        detail.status != .ARCHIVIERT && !detail.titel.getrimmt.lowercased().hasPrefix("[gelöscht]")
                    }
                    cacheSchadenfaelleSpeichern()
                }
            }
        } catch {
            await MainActor.run {
                letzteFehlermeldung = "Schadenfälle konnten nicht geladen werden."
            }
        }
    }
    
    func schadenfallAbschliessen(_ fall: SchadenfallDetail) {
        let document = """
        mutation UpdateSchadenfall($input: UpdateSchadenfallInput!) {
         updateSchadenfall(input: $input) {
           id
           titel
           beschreibung
           status
           prioritaet
           kategorie
           handwerkerId
           verantwortlicherMitarbeiterId
           frist
           liegenschaftAdresse
           plzOrt
           fotoUrl
           gemeldetVon
           createdAt
           updatedAt
         }
        }
        """

        Task {
            do {
                let variables: [String: Any] = [
                    "input": [
                        "id": fall.id,
                        "status": "ERLEDIGT"
                    ]
                ]

                let request = GraphQLRequest<UpdateSchadenfallResponse>(
                    document: document,
                    variables: variables,
                    responseType: UpdateSchadenfallResponse.self
                )

                let result = try await Amplify.API.mutate(request: request)

                if case .success(let response) = result {
                    let aktualisierterFall = SchadenfallDetail(
                        backend: response.updateSchadenfall,
                        chatVerlauf: fall.chatVerlauf
                    )

                    await MainActor.run {
                        if let index = schadenfaelle.firstIndex(where: { $0.id == fall.id }) {
                            schadenfaelle[index] = aktualisierterFall
                        }
                    }
                }

            } catch {
                print("❌ Schadenfall abschliessen Fehler:")
                dump(error)

                await MainActor.run {
                    letzteFehlermeldung = "\(error)"
                }
            }
        }
    }

    private func ladeChatMessages(fuer schadenfallId: String) async -> [ChatNachricht] {
        let document = """
        query ListChatMessages($schadenfallId: String!) {
          listChatMessages(filter: { schadenfallId: { eq: $schadenfallId } }) {
            items {
              id
              schadenfallId
              absender
              nachricht
              zeitstempel
            }
          }
        }
        """

        do {
            let request = GraphQLRequest<ListChatMessagesResponse>(
                document: document,
                variables: ["schadenfallId": schadenfallId],
                responseType: ListChatMessagesResponse.self
            )

            let result = try await Amplify.API.query(request: request)

            if case .success(let response) = result {
                return response.listChatMessages.items.sorted {
                    ($0.zeitstempel ?? .distantPast) < ($1.zeitstempel ?? .distantPast)
                }
            }
        } catch { }

        return []
    }

    func hochladenSchaden(
        formular: SchadenFormularInput,
        bilder: [UIImage],
        completion: @escaping (Bool) -> Void
    ) {
        Task {
            await MainActor.run {
                ladeDaten = true
                letzteFehlermeldung = nil
            }

            func bildeUploadDatenLokal(from image: UIImage) -> Data? {
                let resized = image.skaliert(maxBreite: 1600) ?? image
                return resized.jpegData(compressionQuality: 0.65)
            }

            let komprimierteUploads = bilder.compactMap { bildeUploadDatenLokal(from: $0) }
            var hochgeladeneURLs: [String] = []

            for (index, data) in komprimierteUploads.enumerated() {
                let key = "schaeden/\(UUID().uuidString)_\(index).jpg"

                do {
                    let uploadTask = Amplify.Storage.uploadData(
                        path: .fromString(key),
                        data: data
                    )
                    _ = try await uploadTask.value

                    let storageURL = try await Amplify.Storage.getURL(
                        path: .fromString(key)
                    )
                    hochgeladeneURLs.append(storageURL.absoluteString)

                } catch {
                    await MainActor.run {
                        ladeDaten = false
                        letzteFehlermeldung = "Bild-Upload fehlgeschlagen."
                        completion(false)
                    }
                    return
                }
            }

            // Nur die eigentliche Beschreibung — keine Meta-Felder reinmixen
            let beschreibungText = [
                formular.beschreibung.getrimmt,
                formular.bemerkungIntern.getrimmt.isEmpty ? nil : formular.bemerkungIntern.getrimmt
            ].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: "\n\n")

            // Dringlichkeit → Priorität (passend zum Webportal)
            let prioritaet: String
            switch formular.dringlichkeit {
            case .niedrig:  prioritaet = "Niedrig"
            case .mittel:   prioritaet = "Normal"
            case .hoch:     prioritaet = "Hoch"
            case .dringend: prioritaet = "Dringend"
            }

            let liegenschaftAdresse = formular.liegenschaftAdresse.getrimmt.isEmpty
                ? formular.strasse.getrimmt
                : formular.liegenschaftAdresse.getrimmt

            let document = """
            mutation CreateSchadenfall($input: CreateSchadenfallInput!) {
              createSchadenfall(input: $input) {
                id
                fallNummer
                titel
                beschreibung
                status
                prioritaet
                kategorie
                liegenschaftId
                personId
                liegenschaftAdresse
                plzOrt
                fotoUrl
                gemeldetVon
                createdAt
                updatedAt
              }
            }
            """

            do {
                var inputDict: [String: Any] = [
                    "titel": formular.titel.getrimmt,
                    "beschreibung": beschreibungText,
                    "status": "OFFEN",
                    "prioritaet": prioritaet,
                    "kategorie": formular.kategorie.isEmpty ? "Schaden" : formular.kategorie,
                    "liegenschaftAdresse": liegenschaftAdresse,
                    "plzOrt": formular.plzOrt.getrimmt,
                    "gemeldetVon": formular.gemeldetVonText
                ]
                if let fotoUrl = hochgeladeneURLs.first { inputDict["fotoUrl"] = fotoUrl }
                if let person = aktiveKundenPerson { inputDict["personId"] = person.id }
                if let liegenschaft = aktiveKundenLiegenschaft { inputDict["liegenschaftId"] = liegenschaft.id }

                let variables: [String: Any] = ["input": inputDict]

                let request = GraphQLRequest<CreateSchadenfallResponse>(
                    document: document,
                    variables: variables,
                    responseType: CreateSchadenfallResponse.self
                )

                let result = try await Amplify.API.mutate(request: request)

                await MainActor.run {
                    ladeDaten = false
                }

                switch result {
                case .success(let response):
                    let detail = SchadenfallDetail(
                        backend: response.createSchadenfall,
                        chatVerlauf: []
                    )
                    await MainActor.run {
                        schadenfaelle.insert(detail, at: 0)
                        cacheSchadenfaelleSpeichern()
                        completion(true)
                    }

                case .failure:
                    await MainActor.run {
                        ladeDaten = false
                        letzteFehlermeldung = "Schadenfall konnte nicht gespeichert werden."
                        completion(false)
                    }
                }
            } catch {
                print("❌ FEHLER:")
                dump(error)
                await MainActor.run {
                    ladeDaten = false
                    letzteFehlermeldung = "\(error)"
                    completion(false)
                }
            }
        }
    }

    // MARK: - Schaden Chat

    func sendeSchadensNachricht(fuer schadenId: String, text: String) {
        let bereinigt = text.getrimmt
        guard !bereinigt.isEmpty else { return }

        Task {
            let absenderName = eingeloggterUserEmail.isEmpty ? "Kunde" : eingeloggterUserEmail

            let input = CreateChatMessageInput(
                schadenfallId: schadenId,
                absender: absenderName,
                nachricht: bereinigt,
                zeitstempel: ISO8601DateFormatter().string(from: Date())
            )
            
            let document = """
            mutation CreateChatMessage($input: CreateChatMessageInput!) {
              createChatMessage(input: $input) {
                id
                schadenfallId
                absender
                nachricht
                zeitstempel
              }
            }
            """

            do {
                let variables: [String: Any] = [
                    "input": [
                        "schadenfallId": input.schadenfallId,
                        "absender": input.absender,
                        "nachricht": input.nachricht,
                        "zeitstempel": input.zeitstempel as Any
                    ]
                ]
                let request = GraphQLRequest<CreateChatMessageResponse>(
                    document: document,
                    variables: variables,
                    responseType: CreateChatMessageResponse.self
                )

                let result = try await Amplify.API.mutate(request: request)

                if case .success(let response) = result {
                    await MainActor.run {
                        if let index = schadenfaelle.firstIndex(where: { $0.id == schadenId }) {
                            schadenfaelle[index].chatVerlauf.append(response.createChatMessage)
                        }
                    }
                }
            } catch {
                await MainActor.run {
                    letzteFehlermeldung = "Nachricht konnte nicht gesendet werden."
                }
            }
        }
    }

    // MARK: - Allgemeiner Chat

    func sendeAllgemeineNachricht(an mitarbeiterId: String, text: String) {
        let bereinigt = text.getrimmt
        guard !bereinigt.isEmpty else { return }

        let neueNachricht = ChatNachricht(
            schadenfallId: nil,
            absender: istMitarbeiterAnsicht && !zeigtSupportKundenVorschau
                ? (eingeloggterUserEmail.isEmpty ? "Verwaltung" : eingeloggterUserEmail)
                : "mieter",
            nachricht: bereinigt,
            zeitstempel: Date()
        )

        Task { @MainActor in
            if let index = allgemeineChats.firstIndex(where: { $0.mitarbeiterId == mitarbeiterId }) {
                allgemeineChats[index].nachrichten.append(neueNachricht)
            } else {
                allgemeineChats.append(
                    AllgemeinerChat(
                        mitarbeiterId: mitarbeiterId,
                        nachrichten: [neueNachricht]
                    )
                )
            }
        }
    }


    // MARK: - Portal Stammdaten für Mitarbeiter- und Kundenansicht

    var istMitarbeiterAnsicht: Bool {
        [.admin, .hr, .bewirtschafter, .buchhaltung, .mitarbeiter].contains(appRolle)
    }

    var aktiveKundenPerson: AppKontaktPerson? {
        if let supportKundenVorschauPersonId {
            return kontaktPersonen.first { $0.id == supportKundenVorschauPersonId }
        }

        let email = eingeloggterUserEmail.getrimmt.lowercased()
        guard !email.isEmpty else { return nil }
        return aktiveKontaktPersonen.first { $0.email.getrimmt.lowercased() == email }
    }

    var aktiveKundenLiegenschaft: AppLiegenschaft? {
        guard let person = aktiveKundenPerson else { return nil }
        return aktiveLiegenschaften.first { $0.id == person.liegenschaftId }
    }

    var zeigtSupportKundenVorschau: Bool {
        supportKundenVorschauPersonId != nil
    }

    var begruessung: String {
        "\(tageszeitGruss), \(aktuellerAnzeigename)"
    }

    var aktuellerAnzeigename: String {
        if let person = aktiveKundenPerson {
            return person.name
        }

        let email = eingeloggterUserEmail.getrimmt.lowercased()
        if let mitarbeiter = verfuegbareMitarbeiter.first(where: { mitarbeiter in
            mitarbeiter.email?.getrimmt.lowercased() == email
        }) {
            return mitarbeiter.name
        }

        return eingeloggterUserEmail.isEmpty ? "ImmobilienApp" : eingeloggterUserEmail
    }

    private var tageszeitGruss: String {
        let stunde = Calendar.current.component(.hour, from: Date())

        switch stunde {
        case 5..<11:
            return "Guten Morgen"
        case 11..<14:
            return "Guten Mittag"
        case 14..<18:
            return "Guten Nachmittag"
        case 18..<23:
            return "Guten Abend"
        default:
            return "Gute Nacht"
        }
    }

    var kundenSchadenfaelle: [SchadenfallDetail] {
        guard let person = aktiveKundenPerson else {
            return istMitarbeiterAnsicht ? [] : schadenfaelle
        }

        let email = person.email.getrimmt.lowercased()
        let liegenschaft = liegenschaften.first { $0.id == person.liegenschaftId }
        let adressen = [
            liegenschaft?.strasse,
            liegenschaft?.name,
            person.wohnungsNummer
        ]
        .compactMap { $0?.getrimmt.lowercased() }
        .filter { !$0.isEmpty }

        return aktiveSchadenfaelle.filter { fall in
            if fall.personId == person.id || fall.liegenschaftId == person.liegenschaftId {
                return true
            }

            let gemeldetVon = fall.gemeldetVon.lowercased()
            let adresse = fall.liegenschaftAdresse.lowercased()
            return gemeldetVon.contains(email) || adressen.contains(where: { adresse.contains($0) })
        }
    }

    var aktiveLiegenschaften: [AppLiegenschaft] {
        liegenschaften.filter { istAktiveLiegenschaft($0) }
    }

    var aktiveKontaktPersonen: [AppKontaktPerson] {
        kontaktPersonen.filter { person in
            istAktiveKontaktPerson(person) && aktiveLiegenschaften.contains { liegenschaft in
                liegenschaft.id == person.liegenschaftId
            }
        }
    }

    var aktiveHandwerker: [AppHandwerker] {
        handwerkerListe.filter { istAktiverStatus($0.status) && !istGeloeschterName($0.firma) }
    }

    var aktiveSchadenfaelle: [SchadenfallDetail] {
        schadenfaelle.filter { fall in
            fall.status != .ARCHIVIERT && !istGeloeschterName(fall.titel)
        }
    }

    func istAktiveLiegenschaft(_ liegenschaft: AppLiegenschaft) -> Bool {
        istAktiverStatus(liegenschaft.status) && !istGeloeschterName(liegenschaft.name)
    }

    func istAktiveKontaktPerson(_ person: AppKontaktPerson) -> Bool {
        istAktiverStatus(person.kontoStatus) && !istGeloeschterName(person.name)
    }

    private func istAktiverStatus(_ status: String?) -> Bool {
        let bereinigt = (status ?? "").getrimmt.lowercased()
        return bereinigt != "gelöscht" && bereinigt != "archiviert"
    }

    private func istGeloeschterName(_ name: String) -> Bool {
        name.getrimmt.lowercased().hasPrefix("[gelöscht]")
    }

    func kundenVorschauStarten(personId: String) {
        supportKundenVorschauPersonId = personId
    }

    func kundenVorschauBeenden() {
        supportKundenVorschauPersonId = nil
    }

    private func aktualisiereRolleNachStammdaten() async {
        let email = eingeloggterUserEmail.getrimmt.lowercased()
        let rolle: PortalRolle

        if email == "admin@example.invalid" {
            rolle = .admin
        } else if verfuegbareMitarbeiter.contains(where: { $0.email?.getrimmt.lowercased() == email }) {
            rolle = .mitarbeiter
        } else if let person = aktiveKontaktPersonen.first(where: { $0.email.getrimmt.lowercased() == email }) {
            rolle = person.rolle.lowercased().contains("eigent") ? .eigentuemer : .mieter
        } else {
            rolle = .mieter
        }

        await MainActor.run {
            appRolle = rolle
        }
    }

    private func ladePortalInhalte() async {
        let document = """
        query ListPortalInhalts {
          listPortalInhalts {
            items {
              id
              bereich
              titel
              inhalt
              sortierung
              sichtbar
              createdAt
              updatedAt
            }
          }
        }
        """

        do {
            let request = GraphQLRequest<ListPortalInhaltsResponse>(
                document: document,
                responseType: ListPortalInhaltsResponse.self
            )

            let result = try await Amplify.API.query(request: request)

            if case .success(let response) = result {
                await MainActor.run {
                    portalInhalte = response.listPortalInhalts.items
                }
            }

        } catch {
            print("❌ PortalInhalte konnten nicht geladen werden:")
            dump(error)
        }
    }
    
    private func ladePortalStammdaten() async {
        // Diese Daten kommen aus den gleichen Amplify Gen 2 Tabellen wie das Webportal.
        // Fallback bleibt nur für lokale Entwicklung aktiv, damit die App nicht leer ist.
        await ladeLiegenschaftenAusAWS()
        await ladeKontaktPersonenAusAWS()
        await ladeHandwerkerAusAWS()

        await MainActor.run {
            if portalInhalte.isEmpty {
                portalInhalte = [
                    PortalInhalt(id: "si-1", bereich: "Kontakt", titel: "Hauptsitz", inhalt: "Immobilientool, Hauptstrasse 18, 4104 Oberwil", sortierung: 1, sichtbar: true),
                    PortalInhalt(id: "si-2", bereich: "Notfall", titel: "Notfallnummer", inhalt: "+41 00 000 00 00", sortierung: 2, sichtbar: true)
                ]
            }
        }
    }

    private func ladeLiegenschaftenAusAWS() async {
        let document = """
        query ListLiegenschafts {
          listLiegenschafts {
            items {
              id
              liegenschaftNummer
              name
              strasse
              plz
              ort
              status
            }
          }
        }
        """

        do {
            let request = GraphQLRequest<ListLiegenschaftsResponse>(
                document: document,
                responseType: ListLiegenschaftsResponse.self
            )
            let result = try await Amplify.API.query(request: request)
            if case .success(let response) = result {
                await MainActor.run {
                    liegenschaften = response.listLiegenschafts.items.filter { istAktiveLiegenschaft($0) }
                }
            }
        } catch {
            print("Portal-Liegenschaften nutzen Fallback: \(error)")
        }
    }

    private func ladeKontaktPersonenAusAWS() async {
        let document = """
        query ListKontaktPeople {
          listKontaktPeople {
            items {
              id
              liegenschaftId
              name
              rolle
              email
              telefon
              kontoStatus
              wohnungsNummer
            }
          }
        }
        """

        do {
            let request = GraphQLRequest<ListKontaktPersonsResponse>(
                document: document,
                responseType: ListKontaktPersonsResponse.self
            )
            let result = try await Amplify.API.query(request: request)
            if case .success(let response) = result {
                await MainActor.run {
                    kontaktPersonen = response.listKontaktPeople.items.filter { istAktiveKontaktPerson($0) }
                }
            }
        } catch {
            print("Portal-Kontaktpersonen nutzen Fallback: \(error)")
        }
    }

    private func ladeHandwerkerAusAWS() async {
        let document = """
        query ListHandwerkers {
          listHandwerkers {
            items {
              id
              firma
              gewerk
              kontaktperson
              email
              telefon
              notfallTelefon
              adresse
              status
            }
          }
        }
        """

        do {
            let request = GraphQLRequest<ListHandwerkersResponse>(
                document: document,
                responseType: ListHandwerkersResponse.self
            )
            let result = try await Amplify.API.query(request: request)
            if case .success(let response) = result {
                await MainActor.run {
                    handwerkerListe = response.listHandwerkers.items.filter { istAktiverStatus($0.status) && !istGeloeschterName($0.firma) }
                }
            }
        } catch {
            print("Portal-Handwerker nutzen Fallback: \(error)")
        }
    }

    // MARK: - Geräte

    func ladeGeraeteAusAWS() async {
        let query = """
        query ListDokumentsGeraete {
          listDokuments(filter: { kategorie: { eq: "Gerät" } }) {
            items {
              id
              liegenschaftId
              titel
              dateiname
              volltext
            }
          }
        }
        """
        do {
            let request = GraphQLRequest<ListDokumentsResponse>(
                document: query,
                responseType: ListDokumentsResponse.self
            )
            let result = try await Amplify.API.query(request: request)
            if case .success(let response) = result {
                let geraete = response.listDokuments.items.map { doc -> AppGeraet in
                    var standort: String? = nil
                    var hersteller: String? = nil
                    var modell: String? = nil
                    var status: String? = nil
                    var seriennummer: String? = nil
                    var einbaujahr: Int? = nil
                    if let volltext = doc.volltext,
                       let data = volltext.data(using: .utf8),
                       let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                        standort = json["standort"] as? String
                        hersteller = json["hersteller"] as? String
                        modell = json["modell"] as? String
                        status = json["status"] as? String
                        seriennummer = json["seriennummer"] as? String
                        if let jEj = json["einbaujahr"] { einbaujahr = jEj as? Int }
                    }
                    return AppGeraet(
                        id: doc.id,
                        liegenschaftId: doc.liegenschaftId,
                        bezeichnung: doc.titel,
                        typ: doc.dateiname,
                        standort: standort?.isEmpty == false ? standort : nil,
                        hersteller: hersteller?.isEmpty == false ? hersteller : nil,
                        modell: modell?.isEmpty == false ? modell : nil,
                        status: status?.isEmpty == false ? status : nil,
                        seriennummer: seriennummer?.isEmpty == false ? seriennummer : nil,
                        einbaujahr: einbaujahr
                    )
                }
                await MainActor.run { liegenschaftGeraete = geraete }
            }
        } catch {
            print("Geräte konnten nicht geladen werden: \(error)")
        }
    }

    func geraeteFuer(liegenschaftId: String) -> [AppGeraet] {
        liegenschaftGeraete.filter { $0.liegenschaftId == liegenschaftId }
    }

    // MARK: - Auftrag erstellen

    func erstelleAuftrag(
        fuer fall: SchadenfallDetail,
        handwerkerId: String,
        handwerkerName: String,
        auftragstext: String,
        geraetBezeichnung: String?,
        completion: @escaping (Bool) -> Void
    ) {
        let updateDoc = """
        mutation UpdateSchadenfall($input: UpdateSchadenfallInput!) {
          updateSchadenfall(input: $input) {
            id fallNummer titel beschreibung status handwerkerId
            liegenschaftAdresse plzOrt gemeldetVon createdAt updatedAt
          }
        }
        """
        let chatDoc = """
        mutation CreateChatMessage($input: CreateChatMessageInput!) {
          createChatMessage(input: $input) {
            id schadenfallId absender nachricht zeitstempel
          }
        }
        """
        Task {
            await MainActor.run { ladeDaten = true; letzteFehlermeldung = nil }
            do {
                // 1. Status + Handwerker updaten
                let updateVars: [String: Any] = ["input": [
                    "id": fall.id,
                    "status": "HANDWERKER_BEAUFTRAGT",
                    "handwerkerId": handwerkerId
                ]]
                let updateReq = GraphQLRequest<UpdateSchadenfallResponse>(
                    document: updateDoc, variables: updateVars,
                    responseType: UpdateSchadenfallResponse.self
                )
                let updateResult = try await Amplify.API.mutate(request: updateReq)
                if case .success(let res) = updateResult {
                    let aktualisiert = SchadenfallDetail(backend: res.updateSchadenfall, chatVerlauf: fall.chatVerlauf)
                    await MainActor.run {
                        if let idx = schadenfaelle.firstIndex(where: { $0.id == fall.id }) {
                            schadenfaelle[idx] = aktualisiert
                        }
                    }
                }

                // 2. Chat-Eintrag als Verlaufsnotiz
                var nachricht = "Auftrag erteilt an \(handwerkerName)."
                if let gerät = geraetBezeichnung, !gerät.isEmpty { nachricht += " Gerät: \(gerät)." }
                if !auftragstext.isEmpty { nachricht += " \(auftragstext)" }

                let chatVars: [String: Any] = ["input": [
                    "schadenfallId": fall.id,
                    "absender": "Verwaltung",
                    "absenderTyp": "mitarbeiter",
                    "nachricht": nachricht,
                    "zeitstempel": ISO8601DateFormatter().string(from: Date())
                ]]
                let chatReq = GraphQLRequest<CreateChatMessageResponse>(
                    document: chatDoc, variables: chatVars,
                    responseType: CreateChatMessageResponse.self
                )
                let chatResult = try await Amplify.API.mutate(request: chatReq)
                if case .success(let chatRes) = chatResult {
                    await MainActor.run {
                        if let idx = schadenfaelle.firstIndex(where: { $0.id == fall.id }) {
                            schadenfaelle[idx].chatVerlauf.append(chatRes.createChatMessage)
                        }
                        ladeDaten = false
                        completion(true)
                    }
                } else {
                    await MainActor.run { ladeDaten = false; completion(true) }
                }
            } catch {
                print("❌ erstelleAuftrag error: \(error)")
                await MainActor.run { ladeDaten = false; letzteFehlermeldung = "\(error)"; completion(false) }
            }
        }
    }

    func sendeAllgemeineAnfrage(
        betreff: String,
        kategorie: String,
        nachricht: String,
        completion: @escaping (Bool) -> Void
    ) {
        let person = aktiveKundenPerson
        let liegenschaft = aktiveKundenLiegenschaft

        let titel = betreff.getrimmt.isEmpty ? kategorie : betreff.getrimmt
        let beschreibung = nachricht.getrimmt.isEmpty ? "(Keine Nachricht)" : nachricht.getrimmt
        let liegenschaftAdresse = liegenschaft?.strasse ?? ""
        let plzOrt = liegenschaft.map { "\($0.plz) \($0.ort)" } ?? ""
        let gemeldetVon = person?.name ?? eingeloggterUserEmail

        let document = """
        mutation CreateSchadenfall($input: CreateSchadenfallInput!) {
          createSchadenfall(input: $input) {
            id
            fallNummer
            titel
            beschreibung
            status
            kategorie
            liegenschaftAdresse
            plzOrt
            gemeldetVon
            createdAt
            updatedAt
          }
        }
        """

        Task {
            await MainActor.run { ladeDaten = true; letzteFehlermeldung = nil }
            do {
                var input: [String: Any] = [
                    "titel": titel,
                    "beschreibung": beschreibung,
                    "status": "OFFEN",
                    "kategorie": kategorie,
                    "liegenschaftAdresse": liegenschaftAdresse,
                    "plzOrt": plzOrt,
                    "gemeldetVon": gemeldetVon
                ]
                if let pid = person?.id { input["personId"] = pid }
                if let lid = liegenschaft?.id { input["liegenschaftId"] = lid }

                let request = GraphQLRequest<CreateSchadenfallResponse>(
                    document: document,
                    variables: ["input": input],
                    responseType: CreateSchadenfallResponse.self
                )
                let result = try await Amplify.API.mutate(request: request)
                switch result {
                case .success(let response):
                    let detail = SchadenfallDetail(backend: response.createSchadenfall, chatVerlauf: [])
                    await MainActor.run {
                        schadenfaelle.insert(detail, at: 0)
                        cacheSchadenfaelleSpeichern()
                        ladeDaten = false
                        completion(true)
                    }
                case .failure(let err):
                    await MainActor.run {
                        ladeDaten = false
                        letzteFehlermeldung = "Anfrage konnte nicht gesendet werden."
                        completion(false)
                    }
                    print("❌ sendeAllgemeineAnfrage failure: \(err)")
                }
            } catch {
                await MainActor.run {
                    ladeDaten = false
                    letzteFehlermeldung = "Anfrage konnte nicht gesendet werden."
                    completion(false)
                }
                print("❌ sendeAllgemeineAnfrage error: \(error)")
            }
        }
    }

    // MARK: - Push-Token registrieren

    func registriereDeviceToken(token: String) {
        let document = """
        mutation RegistriereToken($userId: String!, $userType: String!, $deviceToken: String!, $platform: String) {
          registriereGeraetToken(userId: $userId, userType: $userType, deviceToken: $deviceToken, platform: $platform) {
            ok endpointArn message
          }
        }
        """
        let userType = istMitarbeiterAnsicht ? "mitarbeiter" : "kunde"
        let userId: String
        if istMitarbeiterAnsicht {
            userId = verfuegbareMitarbeiter.first(where: {
                $0.email?.lowercased() == eingeloggterUserEmail.lowercased()
            })?.id ?? eingeloggterUserEmail
        } else {
            userId = aktiveKundenPerson?.id ?? eingeloggterUserEmail
        }

        Task {
            do {
                let variables: [String: Any] = [
                    "userId": userId,
                    "userType": userType,
                    "deviceToken": token,
                    "platform": "ios"
                ]
                let request = GraphQLRequest<String>(
                    document: document,
                    variables: variables,
                    responseType: String.self
                )
                let result = try await Amplify.API.mutate(request: request)
                switch result {
                case .success: print("✅ Push-Token registriert für \(userId)")
                case .failure(let err): print("⚠️ Push-Token Fehler: \(err)")
                }
            } catch {
                print("⚠️ Push-Token Registrierung: \(error)")
            }
        }
    }

    func sendeStammdatenAenderung(feld: String, alterWert: String?, neuerWert: String) {
        let document = """
        mutation CreateStammdatenAenderung($input: CreateStammdatenAenderungInput!) {
          createStammdatenAenderung(input: $input) { id feld status neuerWert }
        }
        """
        let input = StammdatenAenderungInput(personId: nil, mitarbeiterId: nil, feld: feld, alterWert: alterWert, neuerWert: neuerWert, status: "Offen", eingereichtVon: eingeloggterUserEmail)
        Task {
            do {
                let variables: [String: Any] = [
                    "input": [
                        "personId": input.personId as Any,
                        "mitarbeiterId": input.mitarbeiterId as Any,
                        "feld": input.feld,
                        "alterWert": input.alterWert as Any,
                        "neuerWert": input.neuerWert,
                        "status": input.status,
                        "eingereichtVon": input.eingereichtVon
                    ]
                ]
                let request = GraphQLRequest<String>(
                    document: document,
                    variables: variables,
                    responseType: String.self
                )
                _ = try await Amplify.API.mutate(request: request)
                await MainActor.run { letzteFehlermeldung = "Änderung wurde zur Prüfung eingereicht." }
            } catch {
                await MainActor.run { letzteFehlermeldung = "Änderungsantrag konnte nicht gesendet werden." }
            }
        }
    }

    // MARK: - Bildverarbeitung

    private func holeStorageURL(path: String) async throws -> String {
        let result = try await Amplify.Storage.getURL(
            path: .fromString(path)
        )
        return result.absoluteString
    }
}

// MARK: - UIImage Helpers

extension UIImage {
    func skaliert(maxBreite: CGFloat) -> UIImage? {
        guard size.width > maxBreite else { return self }

        let faktor = maxBreite / size.width
        let neueGroesse = CGSize(width: maxBreite, height: size.height * faktor)

        let renderer = UIGraphicsImageRenderer(size: neueGroesse)
        return renderer.image { _ in
            draw(in: CGRect(origin: .zero, size: neueGroesse))
        }
    }
}
