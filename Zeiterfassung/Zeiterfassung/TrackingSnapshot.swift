//
//  TrackingSnapshot.swift
//  Zeiterfassung
//
//  Open-source template on 22.05.2026.
//

import Foundation

struct TrackingSnapshot: Codable, Equatable {
    var isTracking: Bool
    var startTime: Date?
    var startLocation: String?
    var sessionID: String?
    var lastUpdatedAt: Date

    static let empty = TrackingSnapshot(
        isTracking: false,
        startTime: nil,
        startLocation: nil,
        sessionID: nil,
        lastUpdatedAt: Date()
    )
}
