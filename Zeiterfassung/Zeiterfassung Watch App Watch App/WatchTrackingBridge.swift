//
//  WatchTrackingBridge.swift
//  Zeiterfassung Watch App
//
//  Liest/schreibt denselben App-Group-UserDefaults wie die iOS-App (TrackingBridge),
//  aber ohne WidgetKit (auf watchOS nicht verfügbar).
//

import Foundation

enum WatchTrackingBridge {
    private static let groupID = "group.ch.example.immobilientool.time"

    private static var defaults: UserDefaults? {
        UserDefaults(suiteName: groupID)
    }

    // MARK: - Lesen

    static func loadSnapshot() -> WatchSyncPayload {
        guard let d = defaults else { return WatchSyncPayload() }
        let isTracking = d.bool(forKey: "trackingIsActive")
        let ts = d.double(forKey: "trackingStartTime")
        let startTime = ts > 0 ? Date(timeIntervalSince1970: ts) : nil
        let sessionID = d.string(forKey: "trackingSessionID").flatMap { $0.isEmpty ? nil : $0 }
        return WatchSyncPayload(
            isTracking: isTracking,
            startTime: startTime,
            sessionID: sessionID,
            lastUpdatedAt: Date()
        )
    }

    // MARK: - Starten

    static func saveStart(startTime: Date, sessionID: String) {
        guard let d = defaults else { return }
        // Tracking-Zustand setzen (same keys as TrackingBridge)
        d.set(true,                              forKey: "trackingIsActive")
        d.set(startTime.timeIntervalSince1970,   forKey: "trackingStartTime")
        d.set(sessionID,                         forKey: "trackingSessionID")
        d.set(Date().timeIntervalSince1970,      forKey: "latestTrackingChangeToken")
        // PendingStart → ContentView speichert Eintrag via SwiftData beim nächsten Foreground
        d.set(startTime.timeIntervalSince1970,   forKey: "pendingStartTime")
        d.set(sessionID,                         forKey: "pendingStartSessionID")
        d.set("watch",                           forKey: "pendingStartSource")
        d.removeObject(forKey: "pendingStartLocation")
    }

    // MARK: - Stoppen

    @discardableResult
    static func saveStop() -> (startTime: Date?, endTime: Date) {
        guard let d = defaults else { return (nil, Date()) }
        let ts = d.double(forKey: "trackingStartTime")
        let startTime = ts > 0 ? Date(timeIntervalSince1970: ts) : nil
        let sessionID = d.string(forKey: "trackingSessionID") ?? ""
        let endTime = Date()

        if startTime != nil {
            // PendingStop → ContentView speichert Eintrag via SwiftData beim nächsten Foreground
            d.set(ts,                            forKey: "pendingStopStartTime")
            d.set(endTime.timeIntervalSince1970, forKey: "pendingStopEndTime")
            d.set(sessionID,                     forKey: "pendingStopSessionID")
            d.set("watch",                       forKey: "pendingStopSource")
            d.removeObject(forKey: "pendingStopStartLocation")
        }

        // Tracking-Zustand löschen
        d.set(false, forKey: "trackingIsActive")
        d.set(0,     forKey: "trackingStartTime")
        d.removeObject(forKey: "trackingSessionID")
        d.set(Date().timeIntervalSince1970, forKey: "latestTrackingChangeToken")

        return (startTime, endTime)
    }
}
