// Immobilientool – Urlaub Manager
// Synchronisiert Urlaubsanträge mit dem IMMOBILIENTOOL Portal

import Foundation
import Observation
import UserNotifications

struct PortalUrlaubsAntrag: Identifiable, Codable {
    let id: String
    let mitarbeiterId: String?
    let mitarbeiterName: String
    let email: String?
    let startDatum: String      // "yyyy-MM-dd"
    let endDatum: String
    let anzahlTage: Double?
    let typ: String             // Ferien | Krank | Überzeitabbau | Sonstiges
    var status: String          // Ausstehend | Genehmigt | Abgelehnt
    let beschreibung: String?
    let antragsDatum: String?
    let genehmigungsNotiz: String?
    let genehmigtVon: String?
    let quelle: String?

    var startDate: Date? { Self.date(from: startDatum) }
    var endDate: Date? { Self.date(from: endDatum) }

    static func date(from s: String) -> Date? {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "de_CH")
        return f.date(from: s)
    }

    static func from(_ dict: [String: Any]) -> PortalUrlaubsAntrag? {
        guard let id = dict["id"] as? String,
              let name = dict["mitarbeiterName"] as? String,
              let start = dict["startDatum"] as? String,
              let end = dict["endDatum"] as? String,
              let typ = dict["typ"] as? String,
              let status = dict["status"] as? String else { return nil }
        return PortalUrlaubsAntrag(
            id: id,
            mitarbeiterId: dict["mitarbeiterId"] as? String,
            mitarbeiterName: name,
            email: dict["email"] as? String,
            startDatum: start,
            endDatum: end,
            anzahlTage: dict["anzahlTage"] as? Double,
            typ: typ,
            status: status,
            beschreibung: dict["beschreibung"] as? String,
            antragsDatum: dict["antragsDatum"] as? String,
            genehmigungsNotiz: dict["genehmigungsNotiz"] as? String,
            genehmigtVon: dict["genehmigtVon"] as? String,
            quelle: dict["quelle"] as? String
        )
    }
}

@MainActor
@Observable
final class PortalUrlaubManager {

    var meineAntraege: [PortalUrlaubsAntrag] = []
    var alleAntraege: [PortalUrlaubsAntrag] = []    // für Kalender
    var isLoading = false
    var lastError: String?
    var lastRefresh: Date?

    let auth: CognitoAuthService
    private let appsync: AppSyncService
    private let defaults = UserDefaults.standard

    init(auth: CognitoAuthService) {
        self.auth = auth
        self.appsync = AppSyncService(auth: auth)
    }

    // MARK: - Refresh

    func refresh() async {
        guard auth.isAuthenticated, let email = defaults.portalEmail else { return }
        isLoading = true
        lastError = nil
        do {
            let alteAntraege = meineAntraege

            let meineRaw = try await appsync.fetchMeineUrlaube(email: email)
            let alleRaw  = try await appsync.fetchAlleGenehmigten()

            meineAntraege = meineRaw.compactMap { PortalUrlaubsAntrag.from($0) }
                .sorted { $0.startDatum > $1.startDatum }
            alleAntraege  = alleRaw.compactMap { PortalUrlaubsAntrag.from($0) }

            lastRefresh = Date()
            await pruefeStatusAenderungen(alt: alteAntraege, neu: meineAntraege)
        } catch {
            lastError = error.localizedDescription
        }
        isLoading = false
    }

    // MARK: - Antrag stellen

    func stelleAntrag(start: String, end: String, tage: Double, typ: String, beschreibung: String) async throws {
        guard let email = defaults.portalEmail,
              let mitarbeiterId = defaults.portalMitarbeiterId,
              let name = defaults.portalMitarbeiterName else {
            throw SyncError.graphql("Bitte zuerst im Portal anmelden.")
        }
        _ = try await appsync.createUrlaubsAntrag(
            mitarbeiterId: mitarbeiterId,
            mitarbeiterName: name,
            email: email,
            startDatum: start,
            endDatum: end,
            anzahlTage: tage,
            typ: typ,
            beschreibung: beschreibung
        )
        await refresh()
    }

    // MARK: - Lokale Benachrichtigungen bei Statusänderung

    private func pruefeStatusAenderungen(alt: [PortalUrlaubsAntrag], neu: [PortalUrlaubsAntrag]) async {
        guard !alt.isEmpty else { return }
        for neuerAntrag in neu {
            guard let alter = alt.first(where: { $0.id == neuerAntrag.id }) else { continue }
            guard alter.status != neuerAntrag.status else { continue }
            await sendeLocalNotification(antrag: neuerAntrag)
        }
    }

    private func sendeLocalNotification(antrag: PortalUrlaubsAntrag) async {
        let content = UNMutableNotificationContent()
        let df = DateFormatter()
        df.dateFormat = "dd.MM.yyyy"
        let startStr = antrag.startDate.map { df.string(from: $0) } ?? antrag.startDatum
        let endStr   = antrag.endDate.map { df.string(from: $0) } ?? antrag.endDatum

        switch antrag.status {
        case "Genehmigt":
            content.title = "🌴 Urlaub genehmigt"
            content.body  = "\(antrag.typ) \(startStr)–\(endStr) wurde genehmigt."
            if let von = antrag.genehmigtVon { content.body += " (von \(von))" }
        case "Abgelehnt":
            content.title = "❌ Urlaub abgelehnt"
            var body = "\(antrag.typ) \(startStr)–\(endStr) wurde abgelehnt."
            if let notiz = antrag.genehmigungsNotiz, !notiz.isEmpty {
                body += "\nGrund: \(notiz)"
            }
            content.body = body
        default:
            content.title = "Urlaubsantrag aktualisiert"
            content.body  = "Status: \(antrag.status)"
        }

        content.sound = .default
        content.categoryIdentifier = "URLAUB_STATUS"

        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)
        let request = UNNotificationRequest(identifier: "urlaub-\(antrag.id)-\(antrag.status)", content: content, trigger: trigger)

        try? await UNUserNotificationCenter.current().add(request)
    }

    // MARK: - Werktagsberechnung

    func berechneWerktage(start: Date, end: Date) -> Double {
        var count = 0
        var cur = Calendar.current.startOfDay(for: start)
        let endDay = Calendar.current.startOfDay(for: end)
        while cur <= endDay {
            let wd = Calendar.current.component(.weekday, from: cur)
            if wd != 1 && wd != 7 { count += 1 }
            cur = Calendar.current.date(byAdding: .day, value: 1, to: cur)!
        }
        return Double(count)
    }
}
