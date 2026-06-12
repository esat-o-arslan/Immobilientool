//
//  WatchConnectivityBridge.swift
//  Zeiterfassung Watch App
//
//  Open-source template on 23.05.2026.
//

import Foundation
import WatchConnectivity
import Observation

@MainActor
@Observable
final class WatchConnectivityBridge: NSObject {
    static let shared = WatchConnectivityBridge()

    private(set) var latestPayload = WatchSyncPayload()
    private(set) var activationState: WCSessionActivationState = .notActivated
    private(set) var isReachable: Bool = false

    private override init() {
        super.init()
    }

    func activate() {
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
        // Sofort aus App Group lesen — unabhängig von WatchConnectivity
        latestPayload = WatchTrackingBridge.loadSnapshot()
    }

    // MARK: - Start (primär via App Group, sekundär via WatchConnectivity)

    func startTrackingFromWatch() {
        let now = Date()
        let sid = UUID().uuidString

        // 1. Direkt in App Group schreiben — funktioniert immer, unabhängig von Reachability
        WatchTrackingBridge.saveStart(startTime: now, sessionID: sid)

        // 2. Lokalen Zustand sofort aktualisieren
        latestPayload = WatchSyncPayload(
            isTracking: true,
            startTime: now,
            sessionID: sid,
            lastUpdatedAt: Date()
        )

        // 3. iPhone benachrichtigen wenn erreichbar (für sofortige Reaktion)
        let msg: [String: Any] = [
            "action": "start",
            "startTime": now.timeIntervalSince1970,
            "sessionID": sid
        ]
        if WCSession.default.isReachable {
            WCSession.default.sendMessage(msg, replyHandler: nil, errorHandler: nil)
        }
        // Kein transferUserInfo nötig: App Group hat die Daten bereits
    }

    // MARK: - Stop (primär via App Group, sekundär via WatchConnectivity)

    func stopTrackingFromWatch() {
        // 1. Direkt aus App Group stoppen
        WatchTrackingBridge.saveStop()

        // 2. Lokalen Zustand sofort aktualisieren
        latestPayload = WatchSyncPayload(
            isTracking: false,
            startTime: nil,
            sessionID: nil,
            lastUpdatedAt: Date()
        )

        // 3. iPhone benachrichtigen wenn erreichbar
        if WCSession.default.isReachable {
            WCSession.default.sendMessage(["action": "stop"], replyHandler: nil, errorHandler: nil)
        }
    }

    // MARK: - Refresh vom iPhone anfordern

    func requestImmediateRefresh() {
        // Zuerst lokal aus App Group lesen
        let local = WatchTrackingBridge.loadSnapshot()
        latestPayload = local

        // Zusätzlich vom iPhone aktualisieren wenn erreichbar
        guard WCSession.default.activationState == .activated,
              WCSession.default.isReachable else { return }

        WCSession.default.sendMessage(["action": "refresh"], replyHandler: { [weak self] reply in
            Task { @MainActor in self?.apply(dict: reply) }
        }, errorHandler: nil)
    }

    // MARK: - Intern

    fileprivate func apply(dict: [String: Any]) {
        let isTracking = dict["isTracking"] as? Bool ?? false
        let ts = dict["startTime"] as? Double ?? 0
        let startTime = ts > 0 ? Date(timeIntervalSince1970: ts) : nil
        let sessionID = (dict["sessionID"] as? String).flatMap { $0.isEmpty ? nil : $0 }
        let lastTs = dict["lastUpdatedAt"] as? Double ?? Date().timeIntervalSince1970
        latestPayload = WatchSyncPayload(
            isTracking: isTracking,
            startTime: startTime,
            sessionID: sessionID,
            lastUpdatedAt: Date(timeIntervalSince1970: lastTs)
        )
    }
}

// MARK: - WCSessionDelegate

extension WatchConnectivityBridge: WCSessionDelegate {

    nonisolated func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        Task { @MainActor in
            self.activationState = activationState
            self.isReachable = session.isReachable
            // App Group als Fallback wenn Aktivierung abgeschlossen
            let local = WatchTrackingBridge.loadSnapshot()
            self.latestPayload = local
        }
    }

    nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
        Task { @MainActor in
            self.isReachable = session.isReachable
            if session.isReachable {
                session.sendMessage(["action": "refresh"], replyHandler: { reply in
                    Task { @MainActor in self.apply(dict: reply) }
                }, errorHandler: nil)
            }
        }
    }

    // iPhone schickt aktualisierten Zustand via applicationContext
    nonisolated func session(_ session: WCSession, didReceiveApplicationContext context: [String: Any]) {
        Task { @MainActor in self.apply(dict: context) }
    }

    nonisolated func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        Task { @MainActor in self.apply(dict: message) }
    }

    nonisolated func session(
        _ session: WCSession,
        didReceiveMessage message: [String: Any],
        replyHandler: @escaping ([String: Any]) -> Void
    ) {
        Task { @MainActor in
            self.apply(dict: message)
            replyHandler([:])
        }
    }
}
