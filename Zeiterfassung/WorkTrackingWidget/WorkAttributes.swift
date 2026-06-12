//
//  WorkAttributes.swift
//  Zeiterfassung
//
//  Open-source template on 13.05.2026.
//

import Foundation
import ActivityKit

struct WorkAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var startTime: Date
        var isRunning: Bool

        public init(
            startTime: Date,
            isRunning: Bool
        ) {
            self.startTime = startTime
            self.isRunning = isRunning
        }
    }

    var title: String

    init(title: String = "Zeiterfassung") {
        self.title = title
    }
}
