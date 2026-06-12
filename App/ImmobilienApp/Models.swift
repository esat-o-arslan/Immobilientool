//
//  Models.swift
//  ImmobilienApp
//

import Foundation

enum SchadenfallStatus: String, CaseIterable, Codable, Hashable, Sendable {
    case OFFEN
    case IN_BEARBEITUNG
    case OFFERTEN_EINGEHOLT
    case HANDWERKER_BEAUFTRAGT
    case BELEG_NACHGEREICHT
    case ERLEDIGT
    case ARCHIVIERT

    init(from decoder: Decoder) throws {
        let value = try decoder.singleValueContainer().decode(String.self)

        switch value {
        case "OFFEN", "Offen", "Neu":
            self = .OFFEN
        case "IN_BEARBEITUNG", "In Bearbeitung":
            self = .IN_BEARBEITUNG
        case "OFFERTEN_EINGEHOLT", "Offerten eingeholt":
            self = .OFFERTEN_EINGEHOLT
        case "HANDWERKER_BEAUFTRAGT", "Handwerker beauftragt":
            self = .HANDWERKER_BEAUFTRAGT
        case "BELEG_NACHGEREICHT", "Beleg nachgereicht":
            self = .BELEG_NACHGEREICHT
        case "ERLEDIGT", "Erledigt":
            self = .ERLEDIGT
        case "ARCHIVIERT", "Archiviert":
            self = .ARCHIVIERT
        default:
            self = .OFFEN
        }
    }

    var anzeigeText: String {
        switch self {
        case .OFFEN: return "Offen"
        case .IN_BEARBEITUNG: return "In Bearbeitung"
        case .OFFERTEN_EINGEHOLT: return "Offerten eingeholt"
        case .HANDWERKER_BEAUFTRAGT: return "Handwerker beauftragt"
        case .BELEG_NACHGEREICHT: return "Beleg nachgereicht"
        case .ERLEDIGT: return "Erledigt"
        case .ARCHIVIERT: return "Archiviert"
        }
    }
}

enum Dringlichkeit: String, CaseIterable, Codable, Hashable, Sendable {
    case niedrig = "Niedrig"
    case mittel = "Mittel"
    case hoch = "Hoch"
    case dringend = "Dringend"
}

struct Mitarbeiter: Identifiable, Hashable, Codable, Sendable {
    let id: String
    let name: String
    let funktion: String
    let email: String?
    let telefon: String?
    let photoUrl: String?
    let teamSichtbar: Bool?
    let teamSortierung: Int?

    init(id: String, name: String, funktion: String, email: String? = nil, telefon: String? = nil, photoUrl: String? = nil, teamSichtbar: Bool? = nil, teamSortierung: Int? = nil) {
        self.id = id
        self.name = name
        self.funktion = funktion
        self.email = email
        self.telefon = telefon
        self.photoUrl = photoUrl
        self.teamSichtbar = teamSichtbar
        self.teamSortierung = teamSortierung
    }
}

struct ChatNachricht: Identifiable, Hashable, Codable, Sendable {
    let id: String
    let schadenfallId: String?
    let absender: String
    let nachricht: String
    let zeitstempel: Date?

    init(
        id: String = UUID().uuidString,
        schadenfallId: String? = nil,
        absender: String,
        nachricht: String,
        zeitstempel: Date? = Date()
    ) {
        self.id = id
        self.schadenfallId = schadenfallId
        self.absender = absender
        self.nachricht = nachricht
        self.zeitstempel = zeitstempel
    }

    func isVonMir(aktuelleEmail: String) -> Bool {
        let sender = absender.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let current = aktuelleEmail.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return sender == current || sender == "mieter" || sender == "kunde"
    }

    var text: String {
        nachricht
    }
}

struct AllgemeinerChat: Identifiable, Hashable, Codable, Sendable {
    var id: String { mitarbeiterId }
    let mitarbeiterId: String
    var nachrichten: [ChatNachricht]
}

struct Schadenfall: Identifiable, Hashable, Codable, Sendable {
    let id: String
    let fallNummer: String?
    let titel: String
    let beschreibung: String
    var status: SchadenfallStatus?

    let prioritaet: String?
    let kategorie: String?
    let liegenschaftId: String?
    let personId: String?
    let handwerkerId: String?
    let verantwortlicherMitarbeiterId: String?
    let frist: String?

    let liegenschaftAdresse: String
    let plzOrt: String
    let fotoUrl: String?
    let gemeldetVon: String?
    let createdAt: String?
    let updatedAt: String?
}

struct SchadenfallDetail: Identifiable, Hashable, Codable, Sendable {
    let id: String
    let fallNummer: String?
    let titel: String
    let beschreibung: String
    let liegenschaftAdresse: String
    let plzOrt: String
    let status: SchadenfallStatus

    let prioritaet: String?
    let kategorie: String?
    let liegenschaftId: String?
    let personId: String?
    let handwerkerId: String?
    let verantwortlicherMitarbeiterId: String?
    let frist: String?

    let gemeldetVon: String
    let dringlichkeit: Dringlichkeit?
    let fotoUrls: [String]
    var chatVerlauf: [ChatNachricht]
    let createdAt: String?
    let updatedAt: String?

    init(
        backend: Schadenfall,
        chatVerlauf: [ChatNachricht] = [],
        dringlichkeit: Dringlichkeit? = nil,
        fotoUrls: [String] = []
    ) {
        self.id = backend.id
        self.fallNummer = backend.fallNummer
        self.titel = backend.titel
        self.beschreibung = backend.beschreibung
        self.liegenschaftAdresse = backend.liegenschaftAdresse
        self.plzOrt = backend.plzOrt
        self.status = backend.status ?? .OFFEN

        self.prioritaet = backend.prioritaet
        self.kategorie = backend.kategorie
        self.liegenschaftId = backend.liegenschaftId
        self.personId = backend.personId
        self.handwerkerId = backend.handwerkerId
        self.verantwortlicherMitarbeiterId = backend.verantwortlicherMitarbeiterId
        self.frist = backend.frist

        self.gemeldetVon = backend.gemeldetVon ?? "Unbekannt"
        self.dringlichkeit = dringlichkeit
        self.fotoUrls = backend.fotoUrl.map { [$0] } ?? fotoUrls
        self.chatVerlauf = chatVerlauf
        self.createdAt = backend.createdAt
        self.updatedAt = backend.updatedAt
    }
}

// MARK: - Gerät (stored as Dokument with kategorie='Gerät')

struct AppGeraet: Identifiable, Hashable, Codable, Sendable {
    let id: String
    let liegenschaftId: String?
    let bezeichnung: String   // = titel des Dokument
    let typ: String           // = dateiname (Gerät-Typ)
    let standort: String?
    let hersteller: String?
    let modell: String?
    let status: String?
    let seriennummer: String?
    let einbaujahr: Int?

    var anzeigeText: String {
        [typ, standort].compactMap { $0?.isEmpty == false ? $0 : nil }.joined(separator: " · ")
    }
}

// MARK: - Dokument / Termin AWS Response Types

struct AppDokumentResult: Identifiable, Codable, Sendable {
    let id: String
    let liegenschaftId: String?
    let personId: String?
    let titel: String
    let kategorie: String
    let jahr: Int
    let dateiname: String
    let dateiUrl: String?
    let volltext: String?
    let sichtbarFuerKunden: Bool?
    let createdAt: String?
}

struct ListDokumentsResultContainer: Codable, Sendable { let items: [AppDokumentResult] }
struct ListDokumentsResponse: Codable, Sendable { let listDokuments: ListDokumentsResultContainer }

struct AppKalenderTerminResult: Identifiable, Codable, Sendable {
    let id: String
    let titel: String
    let typ: String
    let liegenschaftId: String?
    let personIds: [String]?
    let start: String
    let ende: String
    let ort: String?
    let beschreibung: String?
    let status: String?
    let sichtbarInApp: Bool?
}

struct ListKalenderTerminsContainer: Codable, Sendable { let items: [AppKalenderTerminResult] }
struct ListKalenderTerminsResponse: Codable, Sendable { let listKalenderTermins: ListKalenderTerminsContainer }

struct SchadenFormularInput: Hashable, Sendable {
    var titel: String = ""
    var beschreibung: String = ""
    var kategorie: String = "Schaden"
    var dringlichkeit: Dringlichkeit = .mittel

    var vorname: String = ""
    var nachname: String = ""
    var strasse: String = ""
    var plzOrt: String = ""
    var email: String = ""

    var telefon: String = ""
    var liegenschaftAdresse: String = ""
    var bemerkungIntern: String = ""

    var pflichtfelderSindGueltig: Bool {
        !titel.getrimmt.isEmpty &&
        !beschreibung.getrimmt.isEmpty &&
        !vorname.getrimmt.isEmpty &&
        !nachname.getrimmt.isEmpty &&
        !strasse.getrimmt.isEmpty &&
        !plzOrt.getrimmt.isEmpty &&
        !email.getrimmt.isEmpty
    }

    var gemeldetVonText: String {
        "\(vorname.getrimmt) \(nachname.getrimmt), \(strasse.getrimmt), \(plzOrt.getrimmt), \(email.getrimmt)"
    }
}

struct VertretungsInfo: Hashable, Codable, Sendable {
    let zeitraum: String
    let grund: String
    let mitarbeiterName: String
    let telefon: String
}

struct ListSchadenfallsContainer: Codable, Sendable {
    let items: [Schadenfall]
}

struct ListSchadenfallsResponse: Codable, Sendable {
    let listSchadenfalls: ListSchadenfallsContainer
}

struct ListChatMessagesContainer: Codable, Sendable {
    let items: [ChatNachricht]
}

struct ListChatMessagesResponse: Codable, Sendable {
    let listChatMessages: ListChatMessagesContainer
}

struct ListMitarbeitersContainer: Codable, Sendable {
    let items: [Mitarbeiter]
}

struct ListMitarbeitersResponse: Codable, Sendable {
    let listMitarbeiters: ListMitarbeitersContainer
}

struct CreateSchadenfallResponse: Codable, Sendable {
    let createSchadenfall: Schadenfall
}

struct UpdateSchadenfallResponse: Codable, Sendable {
    let updateSchadenfall: Schadenfall
}

struct CreateChatMessageResponse: Codable, Sendable {
    let createChatMessage: ChatNachricht
}

struct CreateSchadenfallInput: Encodable, Sendable {
    let titel: String
    let beschreibung: String
    let status: SchadenfallStatus
    let liegenschaftAdresse: String
    let plzOrt: String
    let fotoUrl: String?
    let gemeldetVon: String?
}

struct CreateChatMessageInput: Encodable, Sendable {
    let schadenfallId: String
    let absender: String
    let nachricht: String
    let zeitstempel: String
}

extension String {
    var getrimmt: String {
        trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

struct KundenDokument: Identifiable, Hashable, Codable, Sendable {
    let id: String
    let titel: String
    let kategorie: String
    let jahr: Int
    let dateiname: String
    let dateiUrl: String?
    let hochgeladenAm: String
}

struct KundenTermin: Identifiable, Hashable, Codable, Sendable {
    let id: String
    let titel: String
    let typ: String
    let start: String
    let ende: String
    let ort: String
    let beschreibung: String?
    let status: String
}

struct KundenMeldungInput: Hashable, Sendable {
    var typ: String = "Schadensmeldung"
    var titel: String = ""
    var beschreibung: String = ""
    var kategorie: String = "Schaden"
    var dringlichkeit: Dringlichkeit = .mittel
}

enum PortalRolle: String, Codable, Hashable, Sendable {
    case admin = "Admin"
    case hr = "HR"
    case bewirtschafter = "Bewirtschafter"
    case buchhaltung = "Buchhaltung"
    case mitarbeiter = "Mitarbeiter"
    case eigentuemer = "Eigentümer"
    case mieter = "Mieter"
    case handwerker = "Handwerker"
}

struct AppLiegenschaft: Identifiable, Hashable, Codable, Sendable {
    let id: String
    let liegenschaftNummer: String
    let name: String
    let strasse: String
    let plz: String
    let ort: String
    let status: String?
}

struct AppKontaktPerson: Identifiable, Hashable, Codable, Sendable {
    let id: String
    let liegenschaftId: String
    let name: String
    let rolle: String
    let email: String
    let telefon: String?
    let wohnungsNummer: String?
    let kontoStatus: String?
}

struct ListLiegenschaftsContainer: Codable, Sendable {
    let items: [AppLiegenschaft]
}

struct ListLiegenschaftsResponse: Codable, Sendable {
    let listLiegenschafts: ListLiegenschaftsContainer
}

struct ListKontaktPersonsContainer: Codable, Sendable {
    let items: [AppKontaktPerson]
}

struct ListKontaktPersonsResponse: Codable, Sendable {
    let listKontaktPeople: ListKontaktPersonsContainer
}

struct AppHandwerker: Identifiable, Hashable, Codable, Sendable {
    let id: String
    let firma: String
    let gewerk: String
    let kontaktperson: String?
    let email: String?
    let telefon: String?
    let notfallTelefon: String?
    let adresse: String?
    let status: String?
}

struct ListHandwerkersContainer: Codable, Sendable {
    let items: [AppHandwerker]
}

struct ListHandwerkersResponse: Codable, Sendable {
    let listHandwerkers: ListHandwerkersContainer
}

struct PortalInhalt: Identifiable, Hashable, Codable, Sendable {
    let id: String
    let bereich: String
    let titel: String
    let inhalt: String?
    let sortierung: Int?
    let sichtbar: Bool?
}

struct ListPortalInhaltsContainer: Codable, Sendable {
    let items: [PortalInhalt]
}

struct ListPortalInhaltsResponse: Codable, Sendable {
    let listPortalInhalts: ListPortalInhaltsContainer
}

struct MitarbeiterDokument: Identifiable, Hashable, Codable, Sendable {
    let id: String
    let mitarbeiterId: String
    let titel: String
    let kategorie: String
    let jahr: Int
    let dateiname: String
    let dateiUrl: String?
}

struct StammdatenAenderungInput: Encodable, Sendable {
    let personId: String?
    let mitarbeiterId: String?
    let feld: String
    let alterWert: String?
    let neuerWert: String
    let status: String
    let eingereichtVon: String
}
