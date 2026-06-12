// Immobilientool – Sync Manager
// Orchestriert den Upload lokaler SwiftData-Einträge an den IMMOBILIENTOOL Server

import Foundation
import SwiftData
import Observation

@MainActor
@Observable
final class PortalSyncManager {

    var isSyncing = false
    var lastSyncDate: Date? { UserDefaults.standard.portalLastSync }
    var lastSyncError: String?
    var syncedCount = 0

    let auth: CognitoAuthService
    private let appsync: AppSyncService
    private let defaults = UserDefaults.standard

    init(auth: CognitoAuthService) {
        self.auth = auth
        self.appsync = AppSyncService(auth: auth)
    }

    // MARK: - Vollsync

    func syncAll(entries: [WorkEntry], spesen: [SpesenEintrag]) async {
        guard defaults.portalSyncEnabled, auth.isAuthenticated else { return }
        guard !isSyncing else { return }

        isSyncing = true
        lastSyncError = nil
        syncedCount = 0

        do {
            // Mitarbeiter-ID aus Portal laden (cached nach erstem Abruf)
            let email = defaults.portalEmail ?? ""
            let mitarbeiterId: String
            let mitarbeiterName: String

            if let cachedId = defaults.portalMitarbeiterId, !cachedId.isEmpty {
                mitarbeiterId = cachedId
                mitarbeiterName = defaults.portalMitarbeiterName ?? email
            } else if let result = try await appsync.fetchMitarbeiterId(email: email) {
                mitarbeiterId = result.id
                mitarbeiterName = result.name
                defaults.portalMitarbeiterId = result.id
                defaults.portalMitarbeiterName = result.name
            } else {
                throw SyncError.graphql("Mitarbeiter mit E-Mail '\(email)' nicht im Portal gefunden.")
            }

            // WorkEntries hochladen
            for entry in entries {
                if entry.isVacation || entry.isSick || entry.isOvertimeReduction {
                    try await appsync.uploadVacationEntry(entry, mitarbeiterId: mitarbeiterId, email: email, name: mitarbeiterName)
                } else if entry.endTime > entry.startTime {
                    try await appsync.uploadWorkEntry(entry, mitarbeiterId: mitarbeiterId, email: email)
                }
                syncedCount += 1
            }

            // Spesen hochladen
            for spese in spesen {
                try await appsync.uploadSpesen(spese, mitarbeiterId: mitarbeiterId, email: email)
                syncedCount += 1
            }

            defaults.portalLastSync = Date()
        } catch {
            lastSyncError = error.localizedDescription
        }

        isSyncing = false
    }

    // MARK: - Einzelnen Eintrag sofort hochladen

    func syncEntry(_ entry: WorkEntry) async {
        guard defaults.portalSyncEnabled, auth.isAuthenticated else { return }
        let email = defaults.portalEmail ?? ""
        guard let mitarbeiterId = defaults.portalMitarbeiterId else { return }
        let name = defaults.portalMitarbeiterName ?? email
        do {
            if entry.isVacation || entry.isSick || entry.isOvertimeReduction {
                try await appsync.uploadVacationEntry(entry, mitarbeiterId: mitarbeiterId, email: email, name: name)
            } else if entry.endTime > entry.startTime {
                try await appsync.uploadWorkEntry(entry, mitarbeiterId: mitarbeiterId, email: email)
            }
        } catch {
            lastSyncError = error.localizedDescription
        }
    }
}
