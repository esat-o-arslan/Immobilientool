// Immobilientool – Sync-Einstellungen
// Wird in der Einstellungen-View (SetupView) eingebettet

import SwiftUI
import SwiftData

struct PortalSyncSettingsView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \WorkEntry.startTime, order: .reverse) private var entries: [WorkEntry]
    @Query(sort: \SpesenEintrag.date, order: .reverse) private var spesen: [SpesenEintrag]

    let auth: CognitoAuthService
    let syncManager: PortalSyncManager

    @State private var showLogin = false
    @State private var syncEnabled: Bool = UserDefaults.standard.portalSyncEnabled

    private var lastSyncText: String {
        guard let date = syncManager.lastSyncDate else { return "Noch nicht synchronisiert" }
        let f = RelativeDateTimeFormatter()
        f.locale = Locale(identifier: "de_CH")
        return f.localizedString(for: date, relativeTo: Date())
    }

    var body: some View {
        Section {
            // Sync-Toggle
            Toggle(isOn: $syncEnabled) {
                Label("Mit IMMOBILIENTOOL Server synchronisieren", systemImage: "arrow.triangle.2.circlepath.circle.fill")
            }
            .onChange(of: syncEnabled) { _, newValue in
                UserDefaults.standard.portalSyncEnabled = newValue
                if newValue && !auth.isAuthenticated { showLogin = true }
            }

            // Status
            if syncEnabled {
                if auth.isAuthenticated {
                    HStack {
                        Image(systemName: "person.circle.fill")
                            .foregroundStyle(.green)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(UserDefaults.standard.portalEmail ?? "Angemeldet")
                                .font(.subheadline)
                            Text("Letzter Sync: \(lastSyncText)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        if syncManager.isSyncing {
                            ProgressView()
                        }
                    }

                    // Manueller Sync-Button
                    Button {
                        Task { await syncManager.syncAll(entries: entries, spesen: spesen) }
                    } label: {
                        Label(
                            syncManager.isSyncing ? "Wird synchronisiert …" : "Jetzt synchronisieren",
                            systemImage: syncManager.isSyncing ? "arrow.clockwise" : "icloud.and.arrow.up"
                        )
                    }
                    .disabled(syncManager.isSyncing)

                    if let error = syncManager.lastSyncError {
                        Label(error, systemImage: "exclamationmark.triangle")
                            .font(.caption)
                            .foregroundStyle(.red)
                    }

                    if syncManager.syncedCount > 0 {
                        Label("\(syncManager.syncedCount) Einträge synchronisiert", systemImage: "checkmark.circle")
                            .font(.caption)
                            .foregroundStyle(.green)
                    }

                    // Abmelden
                    Button(role: .destructive) {
                        auth.signOut()
                        UserDefaults.standard.portalMitarbeiterId = nil
                        UserDefaults.standard.portalMitarbeiterName = nil
                        syncEnabled = false
                        UserDefaults.standard.portalSyncEnabled = false
                    } label: {
                        Label("Vom IMMOBILIENTOOL Server abmelden", systemImage: "rectangle.portrait.and.arrow.right")
                    }

                } else {
                    Button {
                        showLogin = true
                    } label: {
                        Label("Mit Portal anmelden", systemImage: "person.badge.plus")
                    }
                }
            }
        } header: {
            Text("Immobilientool Portal")
        } footer: {
            if syncEnabled {
                Text("Arbeitsstunden, Urlaub und Spesen werden freiwillig mit dem Verwaltungsportal synchronisiert. Die Daten sind für HR und Geschäftsführung einsehbar.")
            } else {
                Text("Aktivieren Sie die Synchronisation, um Ihre Zeiterfassung mit dem Verwaltungsportal zu verbinden.")
            }
        }
        .sheet(isPresented: $showLogin) {
            LoginView(auth: auth) {
                Task { await syncManager.syncAll(entries: entries, spesen: spesen) }
            }
        }
    }
}
