//
//  PendingStopPayload.swift
//  Zeiterfassung
//
//  Open-source template on 22.05.2026.
//

import Foundation

struct PendingStopPayload: Codable, Equatable {
    var startTime: Date
    var endTime: Date
    var startLocation: String?
    var sessionID: String?
    var source: String
}
