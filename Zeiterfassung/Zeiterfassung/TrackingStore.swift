//
//  TrackingStore.swift
//  Zeiterfassung
//
//  Open-source template on 22.05.2026.
//

import Foundation
import Observation

@MainActor
@Observable
final class TrackingStore {
    static let shared = TrackingStore()

    var isTracking: Bool = false
    var currentStart: Date?
    var currentStartLocation: String?
    var sessionID: String?

    private init() {
        restoreFromSharedDefaults()
    }

    func restoreFromSharedDefaults() {
        let snapshot = TrackingBridge.loadSnapshot()
        isTracking = snapshot.isTracking
        currentStart = snapshot.startTime
        currentStartLocation = snapshot.startLocation
        sessionID = snapshot.sessionID
    }

    func start(startTime: Date, startLocation: String?, sessionID externalSessionID: String? = nil) {
        guard isTracking == false else { return }

        let resolvedSessionID = externalSessionID ?? UUID().uuidString

        isTracking = true
        currentStart = startTime
        currentStartLocation = startLocation
        sessionID = resolvedSessionID

        TrackingBridge.saveSnapshot(
            TrackingSnapshot(
                isTracking: true,
                startTime: startTime,
                startLocation: startLocation,
                sessionID: resolvedSessionID,
                lastUpdatedAt: Date()
            )
        )
    }

    func stop() {
        isTracking = false
        currentStart = nil
        currentStartLocation = nil
        sessionID = nil

        TrackingBridge.clearTracking()
    }

    func syncFromExternalSource() {
        restoreFromSharedDefaults()
    }

    var elapsedSeconds: Int {
        guard isTracking, let currentStart else { return 0 }
        return max(0, Int(Date().timeIntervalSince(currentStart)))
    }
}
