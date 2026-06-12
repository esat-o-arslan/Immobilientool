//
//  ImmobilienApp.swift
//  ImmobilienApp
//
//  Open-source template on 19.05.2026.
//

import SwiftUI
import Amplify
import AWSCognitoAuthPlugin
import AWSAPIPlugin
import AWSS3StoragePlugin
import UserNotifications

class AppDelegate: NSObject, UIApplicationDelegate {
    var syncManager: AWSDataSyncManager?

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        NotificationManager.shared.tokenEmpfangen(deviceToken, syncManager: syncManager ?? AWSDataSyncManager())
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        print("APNs Registrierung fehlgeschlagen: \(error)")
    }
}

@main
struct ImmobilienApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @StateObject private var syncManager = AWSDataSyncManager()
    @StateObject private var notifManager = NotificationManager.shared
    @State private var amplifyIstBereit = false

    init() {
        konfiguriereAmplify()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(syncManager)
                .environmentObject(notifManager)
                .task {
                    guard amplifyIstBereit else { return }
                    appDelegate.syncManager = syncManager
                    syncManager.starteApp()
                    // Push-Berechtigung nach Login anfordern
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                        NotificationManager.shared.berechtigungAnfordern()
                    }
                }
        }
    }

    private mutating func konfiguriereAmplify() {
        do {
            try Amplify.add(plugin: AWSCognitoAuthPlugin())
            try Amplify.add(plugin: AWSAPIPlugin())
            try Amplify.add(plugin: AWSS3StoragePlugin())
            try Amplify.configure(with: .amplifyOutputs)

            amplifyIstBereit = true
            print("Amplify Gen 2 Auth erfolgreich konfiguriert.")
        } catch {
            amplifyIstBereit = false
            print("Fehler bei Amplify Gen 2 Konfiguration: \(error)")
        }
    }
}
