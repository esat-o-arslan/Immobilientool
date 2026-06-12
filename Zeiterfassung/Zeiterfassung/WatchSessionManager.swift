//
//  WatchSessionManager.swift
//  Zeiterfassung
//
//  Open-source template on 23.05.2026.
//

import Foundation
import WatchConnectivity

extension Notification.Name {
    static let watchDidTriggerAction = Notification.Name("watchDidTriggerAction")
}

final class WatchSessionManager: NSObject {
    static let shared = WatchSessionManager()

    private override init() {
        super.init()
    }

    func activate() {
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    /// Schickt den aktuellen Tracking-Zustand zur Uhr (applicationContext = kein Reachability nötig)
    func sendCurrentState() {
        guard WCSession.default.activationState == .activated,
              WCSession.default.isPaired,
              WCSession.default.isWatchAppInstalled else { return }

        let snapshot = TrackingBridge.loadSnapshot()
        let context: [String: Any] = [
            "isTracking": snapshot.isTracking,
            "startTime": snapshot.startTime?.timeIntervalSince1970 ?? 0,
            "sessionID": snapshot.sessionID ?? "",
            "lastUpdatedAt": Date().timeIntervalSince1970
        ]
        try? WCSession.default.updateApplicationContext(context)
    }
}

// MARK: - WCSessionDelegate

extension WatchSessionManager: WCSessionDelegate {

    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        sendCurrentState()
    }

    func sessionDidBecomeInactive(_ session: WCSession) {}

    func sessionDidDeactivate(_ session: WCSession) {
        WCSession.default.activate()
    }

    // Sofort-Nachrichten (wenn iPhone erreichbar)
    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        handleAction(message, replyHandler: nil)
    }

    func session(
        _ session: WCSession,
        didReceiveMessage message: [String: Any],
        replyHandler: @escaping ([String: Any]) -> Void
    ) {
        handleAction(message, replyHandler: replyHandler)
    }

    // Garantierte Zustellung (transferUserInfo) — läuft auch wenn iPhone im Hintergrund war
    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
        handleAction(userInfo, replyHandler: nil)
    }

    // MARK: - Aktion verarbeiten

    private func handleAction(_ msg: [String: Any], replyHandler: (([String: Any]) -> Void)?) {
        guard let action = msg["action"] as? String else { return }

        switch action {

        case "start":
            // startTime und sessionID kommen von der Uhr mit
            let ts = msg["startTime"] as? Double ?? Date().timeIntervalSince1970
            let startTime = Date(timeIntervalSince1970: ts)
            let sessionID = (msg["sessionID"] as? String) ?? UUID().uuidString

            // 1. TrackingBridge sofort auf isTracking=true setzen
            TrackingBridge.saveSnapshot(TrackingSnapshot(
                isTracking: true,
                startTime: startTime,
                startLocation: nil,
                sessionID: sessionID,
                lastUpdatedAt: Date()
            ))

            // 2. PendingStart → ContentView speichert den Eintrag beim nächsten Foreground
            PendingStartBridge.save(PendingStartPayload(
                startTime: startTime,
                startLocation: nil,
                sessionID: sessionID,
                source: "watch"
            ))

            // 3. Antwort + applicationContext
            replyHandler?([
                "isTracking": true,
                "startTime": startTime.timeIntervalSince1970,
                "sessionID": sessionID,
                "lastUpdatedAt": Date().timeIntervalSince1970
            ])
            sendCurrentState()
            // ContentView im Vordergrund sofort benachrichtigen
            DispatchQueue.main.async {
                NotificationCenter.default.post(name: .watchDidTriggerAction, object: nil)
            }

        case "stop":
            let defaults = UserDefaults.sharedGroup
            let startTs = defaults.double(forKey: SharedDefaults.trackingStartTime)
            let sessionID = defaults.string(forKey: SharedDefaults.trackingSessionID)

            // 1. PendingStop → ContentView speichert den Eintrag beim nächsten Foreground
            if startTs > 0 {
                PendingStopBridge.save(PendingStopPayload(
                    startTime: Date(timeIntervalSince1970: startTs),
                    endTime: Date(),
                    startLocation: nil,
                    sessionID: sessionID,
                    source: "watch"
                ))
            }

            // 2. TrackingBridge leeren
            TrackingBridge.clearTracking()

            // 3. Antwort + applicationContext
            replyHandler?([
                "isTracking": false,
                "startTime": 0,
                "sessionID": "",
                "lastUpdatedAt": Date().timeIntervalSince1970
            ])
            sendCurrentState()
            // ContentView im Vordergrund sofort benachrichtigen
            DispatchQueue.main.async {
                NotificationCenter.default.post(name: .watchDidTriggerAction, object: nil)
            }

        case "refresh":
            let snapshot = TrackingBridge.loadSnapshot()
            replyHandler?([
                "isTracking": snapshot.isTracking,
                "startTime": snapshot.startTime?.timeIntervalSince1970 ?? 0,
                "sessionID": snapshot.sessionID ?? "",
                "lastUpdatedAt": Date().timeIntervalSince1970
            ])

        default:
            break
        }
    }
}
