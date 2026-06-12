//
//  WatchSyncPayload.swift
//  Zeiterfassung Watch App
//
//  Open-source template on 23.05.2026.
//

import Foundation

struct WatchSyncPayload {
    var isTracking: Bool = false
    var startTime: Date? = nil
    var sessionID: String? = nil
    var lastUpdatedAt: Date = .distantPast
}
