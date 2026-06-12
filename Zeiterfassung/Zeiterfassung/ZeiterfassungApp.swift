//
//  ZeiterfassungApp.swift
//  Zeiterfassung
//
//  Open-source template on 12.05.2026.
//

import SwiftUI
import SwiftData
import UserNotifications

@main
struct ZeiterfassungApp: App {
    @State private var trackingStore = TrackingStore.shared
    @State private var cloudSync = CloudSyncManager.shared
    @State private var portalAuth = CognitoAuthService()
    @State private var portalSync: PortalSyncManager
    @State private var portalUrlaub: PortalUrlaubManager

    init() {
        WatchSessionManager.shared.activate()
        let auth = CognitoAuthService()
        _portalAuth    = State(initialValue: auth)
        _portalSync    = State(initialValue: PortalSyncManager(auth: auth))
        _portalUrlaub  = State(initialValue: PortalUrlaubManager(auth: auth))
        // Push-Notification-Erlaubnis anfragen
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in }
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(trackingStore)
                .environment(cloudSync)
                .environment(portalAuth)
                .environment(portalSync)
                .environment(portalUrlaub)
                .task { await cloudSync.checkAccountStatus() }
                .onReceive(
                    NotificationCenter.default.publisher(for: UIApplication.willEnterForegroundNotification)
                ) { _ in
                    Task {
                        await cloudSync.checkAccountStatus()
                        if cloudSync.iCloudEnabled { cloudSync.recordSync() }
                        await portalUrlaub.refresh()   // Status-Änderungen prüfen
                    }
                }
        }
        .modelContainer(Self.makeModelContainer())
    }

    static func makeModelContainer() -> ModelContainer {
        let schema = Schema([
            WorkEntry.self,
            Holiday.self,
            SpesenEintrag.self,
            WeeklySoll.self,
            StoredDocument.self
        ])

        let iCloudEnabled = UserDefaults.standard.bool(forKey: "iCloudSyncEnabled")

        do {
            let config = ModelConfiguration(
                schema: schema,
                cloudKitDatabase: iCloudEnabled ? .automatic : .none
            )
            return try ModelContainer(for: schema, configurations: config)
        } catch {
            // Fallback: lokal ohne CloudKit
            let fallback = ModelConfiguration(schema: schema, cloudKitDatabase: .none)
            return try! ModelContainer(for: schema, configurations: fallback)
        }
    }
}
