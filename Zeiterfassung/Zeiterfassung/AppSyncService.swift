// Immobilientool – AppSync GraphQL Client
// Sendet lokale WorkEntries, SpesenEinträge usw. an den IMMOBILIENTOOL Server

import Foundation
import SwiftData

@MainActor
final class AppSyncService {

    private let auth: CognitoAuthService
    private let defaults = UserDefaults.standard

    init(auth: CognitoAuthService) {
        self.auth = auth
    }

    // MARK: - GraphQL Anfrage

    func query(_ gql: String, variables: [String: Any] = [:]) async throws -> [String: Any] {
        let token = try await auth.currentIdToken()
        guard let url = URL(string: PortalAWSConfig.graphqlEndpoint) else { throw SyncError.config }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(token, forHTTPHeaderField: "Authorization")
        let payload: [String: Any] = variables.isEmpty
            ? ["query": gql]
            : ["query": gql, "variables": variables]
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            throw SyncError.http
        }
        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw SyncError.parse
        }
        if let errors = json["errors"] as? [[String: Any]], let first = errors.first {
            let msg = (first["message"] as? String) ?? "GraphQL Fehler"
            throw SyncError.graphql(msg)
        }
        return (json["data"] as? [String: Any]) ?? [:]
    }

    // MARK: - ZeiterfassungEintrag hochladen

    func uploadWorkEntry(_ entry: WorkEntry, mitarbeiterId: String, email: String) async throws {
        let entryId = entry.id.uuidString
        let syncedIds = defaults.portalSyncedEntryIds
        guard !syncedIds.contains(entryId) else { return }

        let mutation = """
        mutation CreateZeit($input: CreateZeiterfassungEintragInput!) {
          createZeiterfassungEintrag(input: $input) { id }
        }
        """
        let variables: [String: Any] = ["input": [
            "mitarbeiterId": mitarbeiterId,
            "email": email,
            "appEntryId": entryId,
            "startZeit": iso8601(entry.startTime),
            "endZeit": iso8601(entry.endTime),
            "startOrt": entry.startLoc ?? "",
            "endOrt": entry.endLoc ?? "",
            "pauseMinuten": entry.pauseMinutes,
            "istUrlaub": entry.isVacation,
            "istKrank": entry.isSick,
            "istUeberzeitabbau": entry.isOvertimeReduction,
            "ueberzeitAbbauStunden": entry.overtimeReductionHours,
            "istGesperrt": entry.isLocked,
        ]]
        _ = try await query(mutation, variables: variables)
        var ids = defaults.portalSyncedEntryIds
        ids.insert(entryId)
        defaults.portalSyncedEntryIds = ids
    }

    // MARK: - Urlaubsantrag aus Urlaubseintrag erstellen

    func uploadVacationEntry(_ entry: WorkEntry, mitarbeiterId: String, email: String, name: String) async throws {
        let entryId = "urlaub-\(entry.id.uuidString)"
        let syncedIds = defaults.portalSyncedEntryIds
        guard !syncedIds.contains(entryId) else { return }

        let mutation = """
        mutation CreateUrlaub($input: CreateUrlaubsAntragInput!) {
          createUrlaubsAntrag(input: $input) { id }
        }
        """
        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd"
        let variables: [String: Any] = ["input": [
            "mitarbeiterId": mitarbeiterId,
            "mitarbeiterName": name,
            "email": email,
            "startDatum": df.string(from: entry.startTime),
            "endDatum": df.string(from: entry.endTime),
            "anzahlTage": 1,
            "typ": entry.isSick ? "Krank" : entry.isOvertimeReduction ? "Überzeitabbau" : "Ferien",
            "status": "Ausstehend",
            "antragsDatum": iso8601(Date()),
            "quelle": "App",
        ]]
        _ = try await query(mutation, variables: variables)
        var ids = defaults.portalSyncedEntryIds
        ids.insert(entryId)
        defaults.portalSyncedEntryIds = ids
    }

    // MARK: - Spesen hochladen

    func uploadSpesen(_ spese: SpesenEintrag, mitarbeiterId: String, email: String) async throws {
        let entryId = spese.id.uuidString
        let syncedIds = defaults.portalSyncedEntryIds
        guard !syncedIds.contains("spesen-\(entryId)") else { return }

        let mutation = """
        mutation CreateSpesen($input: CreateSpesenSyncEintragInput!) {
          createSpesenSyncEintrag(input: $input) { id }
        }
        """
        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd"
        let variables: [String: Any] = ["input": [
            "mitarbeiterId": mitarbeiterId,
            "email": email,
            "appEntryId": entryId,
            "datum": df.string(from: spese.date),
            "titel": spese.title,
            "betrag": spese.amount,
            "kategorie": "Allgemein",
            "status": "Eingereicht",
        ]]
        _ = try await query(mutation, variables: variables)
        var ids = defaults.portalSyncedEntryIds
        ids.insert("spesen-\(entryId)")
        defaults.portalSyncedEntryIds = ids
    }

    // MARK: - Mitarbeiter-ID abrufen

    func fetchMitarbeiterId(email: String) async throws -> (id: String, name: String)? {
        let q = """
        query ListMitarbeiter {
          listMitarbeiters {
            items { id name email }
          }
        }
        """
        let data = try await query(q)
        guard let items = (data["listMitarbeiters"] as? [String: Any])?["items"] as? [[String: Any]] else {
            return nil
        }
        if let match = items.first(where: { ($0["email"] as? String)?.lowercased() == email.lowercased() }) {
            return (id: match["id"] as? String ?? "", name: match["name"] as? String ?? email)
        }
        return nil
    }

    // MARK: - Urlaub-Anträge laden (eigene)

    func fetchMeineUrlaube(email: String) async throws -> [[String: Any]] {
        let q = """
        query ListUrlaub {
          listUrlaubsAntrags {
            items {
              id mitarbeiterId mitarbeiterName email
              startDatum endDatum anzahlTage typ
              status beschreibung antragsDatum
              genehmigungsNotiz genehmigtVon genehmigtAm quelle
              createdAt updatedAt
            }
          }
        }
        """
        let data = try await query(q)
        let items = (data["listUrlaubsAntrags"] as? [String: Any])?["items"] as? [[String: Any]] ?? []
        return items.filter { ($0["email"] as? String)?.lowercased() == email.lowercased() }
    }

    // MARK: - Alle genehmigten Urlaube (für Kalender)

    func fetchAlleGenehmigten() async throws -> [[String: Any]] {
        let q = """
        query ListAlleUrlaub {
          listUrlaubsAntrags {
            items {
              id mitarbeiterName startDatum endDatum typ status anzahlTage
            }
          }
        }
        """
        let data = try await query(q)
        let items = (data["listUrlaubsAntrags"] as? [String: Any])?["items"] as? [[String: Any]] ?? []
        return items.filter { ($0["status"] as? String) != "Abgelehnt" }
    }

    // MARK: - Neuen Urlaubsantrag erstellen

    func createUrlaubsAntrag(
        mitarbeiterId: String, mitarbeiterName: String, email: String,
        startDatum: String, endDatum: String, anzahlTage: Double,
        typ: String, beschreibung: String
    ) async throws -> String {
        let mutation = """
        mutation CreateUrlaub($input: CreateUrlaubsAntragInput!) {
          createUrlaubsAntrag(input: $input) { id status }
        }
        """
        let variables: [String: Any] = ["input": [
            "mitarbeiterId": mitarbeiterId,
            "mitarbeiterName": mitarbeiterName,
            "email": email,
            "startDatum": startDatum,
            "endDatum": endDatum,
            "anzahlTage": anzahlTage,
            "typ": typ,
            "beschreibung": beschreibung,
            "status": "Ausstehend",
            "antragsDatum": iso8601(Date()),
            "quelle": "App",
        ]]
        let data = try await query(mutation, variables: variables)
        return (data["createUrlaubsAntrag"] as? [String: Any])?["id"] as? String ?? ""
    }

    // MARK: - Hilfsfunktionen

    private func iso8601(_ date: Date) -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.string(from: date)
    }
}

enum SyncError: LocalizedError {
    case config, http, parse
    case graphql(String)

    var errorDescription: String? {
        switch self {
        case .config:           return "Konfigurationsfehler."
        case .http:             return "Server nicht erreichbar."
        case .parse:            return "Antwort konnte nicht verarbeitet werden."
        case .graphql(let m):   return m
        }
    }
}
