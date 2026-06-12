//
//  TrackingBridge.swift
//  Zeiterfassung
//
//  Open-source template on 22.05.2026.
//

import Foundation
import WidgetKit

enum TrackingBridge {
    private static let suite = UserDefaults.sharedGroup

    static func loadSnapshot() -> TrackingSnapshot {
        let isTracking = suite.bool(forKey: SharedDefaults.trackingIsActive)

        let startTimestamp = suite.double(forKey: SharedDefaults.trackingStartTime)
        let startTime = startTimestamp > 0 ? Date(timeIntervalSince1970: startTimestamp) : nil

        let startLocation = suite.string(forKey: SharedDefaults.trackingStartLocation)
        let sessionID = suite.string(forKey: SharedDefaults.trackingSessionID)

        return TrackingSnapshot(
            isTracking: isTracking,
            startTime: startTime,
            startLocation: startLocation,
            sessionID: sessionID,
            lastUpdatedAt: Date()
        )
    }

    static func saveSnapshot(_ snapshot: TrackingSnapshot) {
        suite.set(snapshot.isTracking, forKey: SharedDefaults.trackingIsActive)
        suite.set(snapshot.startTime?.timeIntervalSince1970 ?? 0, forKey: SharedDefaults.trackingStartTime)

        if let startLocation = snapshot.startLocation, !startLocation.isEmpty {
            suite.set(startLocation, forKey: SharedDefaults.trackingStartLocation)
        } else {
            suite.removeObject(forKey: SharedDefaults.trackingStartLocation)
        }

        if let sessionID = snapshot.sessionID, !sessionID.isEmpty {
            suite.set(sessionID, forKey: SharedDefaults.trackingSessionID)
        } else {
            suite.removeObject(forKey: SharedDefaults.trackingSessionID)
        }

        suite.set(Date().timeIntervalSince1970, forKey: SharedDefaults.latestTrackingChangeToken)
        suite.set(Date().timeIntervalSince1970, forKey: SharedDefaults.watchTrackingSnapshot)

        reloadWidgets()
    }

    static func clearTracking() {
        saveSnapshot(.empty)
    }

    static func markDataChanged() {
        suite.set(Date().timeIntervalSince1970, forKey: SharedDefaults.latestDataChangeToken)
        reloadWidgets()
    }

    static func markReportsRefreshed() {
        suite.set(Date().timeIntervalSince1970, forKey: SharedDefaults.latestReportRefreshToken)
        reloadWidgets()
    }

    static func entryDate() -> Date {
        let ts = suite.double(forKey: SharedDefaults.entryDate)
        if ts > 0 {
            return Date(timeIntervalSince1970: ts)
        }

        let fallback = UserDefaults.standard.double(forKey: SharedDefaults.entryDate)
        if fallback > 0 {
            return Date(timeIntervalSince1970: fallback)
        }

        return .distantPast
    }

    static func reloadWidgets() {
        WidgetCenter.shared.reloadAllTimelines()
    }
}
