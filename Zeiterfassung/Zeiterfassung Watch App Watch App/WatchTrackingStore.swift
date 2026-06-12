//
//  WatchTrackingStore.swift
//  Zeiterfassung Watch App
//
//  Open-source template on 22.05.2026.
//

import Foundation
import Observation

@MainActor
@Observable
final class WatchTrackingStore {
    static let shared = WatchTrackingStore()

    var isTracking: Bool = false
    var startTime: Date?
    var sessionID: String?

    private init() {}

    func sync(from payload: WatchSyncPayload) {
        isTracking = payload.isTracking
        startTime = payload.startTime
        sessionID = payload.sessionID
    }

    var elapsedSeconds: Int {
        guard isTracking, let startTime else { return 0 }
        return max(0, Int(Date().timeIntervalSince(startTime)))
    }
}
