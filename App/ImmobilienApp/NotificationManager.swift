// NotificationManager.swift – Push-Benachrichtigungen für ImmobilienApp

import UserNotifications
import UIKit
import Amplify
import Combine

final class NotificationManager: NSObject, UNUserNotificationCenterDelegate, ObservableObject {
    static let shared = NotificationManager()

    @Published var erlaubnis: UNAuthorizationStatus = .notDetermined

    private override init() { super.init() }

    // MARK: - Berechtigung anfordern

    func berechtigungAnfordern() {
        let center = UNUserNotificationCenter.current()
        center.delegate = self

        center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
            DispatchQueue.main.async {
                if granted {
                    UIApplication.shared.registerForRemoteNotifications()
                }
                if let error { print("Push-Berechtigung Fehler: \(error)") }
            }
        }
    }

    // MARK: - Device Token registrieren (wird von AppDelegate aufgerufen)

    func tokenEmpfangen(_ deviceToken: Data, syncManager: AWSDataSyncManager) {
        let tokenString = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
        print("APNs Device Token: \(tokenString)")

        guard !syncManager.eingeloggterUserEmail.isEmpty else { return }

        // Token an AWS Lambda senden
        syncManager.registriereDeviceToken(token: tokenString)
    }

    // MARK: - Benachrichtigungen im Vordergrund anzeigen

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound, .badge])
    }

    // MARK: - Tippen auf Benachrichtigung

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo
        print("Push getippt: \(userInfo)")
        // Hier könnte man auf den spezifischen Fall navigieren (fallId aus daten)
        completionHandler()
    }
}
