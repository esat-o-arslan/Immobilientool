//
//  PendingStopBridge.swift
//  Zeiterfassung
//
//  Open-source template on 22.05.2026.
//

import Foundation
import WidgetKit

enum PendingStopBridge {
    private static let suite = UserDefaults.sharedGroup

    static func save(_ payload: PendingStopPayload) {
        suite.set(payload.startTime.timeIntervalSince1970, forKey: SharedDefaults.pendingStopStartTime)
        suite.set(payload.endTime.timeIntervalSince1970, forKey: SharedDefaults.pendingStopEndTime)
        suite.set(payload.startLocation ?? "", forKey: SharedDefaults.pendingStopStartLocation)
        suite.set(payload.sessionID ?? "", forKey: SharedDefaults.pendingStopSessionID)
        suite.set(payload.source, forKey: SharedDefaults.pendingStopSource)
        WidgetCenter.shared.reloadAllTimelines()
    }

    static func load() -> PendingStopPayload? {
        let startTS = suite.double(forKey: SharedDefaults.pendingStopStartTime)
        let endTS = suite.double(forKey: SharedDefaults.pendingStopEndTime)

        guard startTS > 0, endTS > 0 else { return nil }

        let startLocationRaw = suite.string(forKey: SharedDefaults.pendingStopStartLocation)
        let sessionIDRaw = suite.string(forKey: SharedDefaults.pendingStopSessionID)
        let source = suite.string(forKey: SharedDefaults.pendingStopSource) ?? "external"

        return PendingStopPayload(
            startTime: Date(timeIntervalSince1970: startTS),
            endTime: Date(timeIntervalSince1970: endTS),
            startLocation: (startLocationRaw?.isEmpty == false) ? startLocationRaw : nil,
            sessionID: (sessionIDRaw?.isEmpty == false) ? sessionIDRaw : nil,
            source: source
        )
    }

    static func clear() {
        suite.removeObject(forKey: SharedDefaults.pendingStopStartTime)
        suite.removeObject(forKey: SharedDefaults.pendingStopEndTime)
        suite.removeObject(forKey: SharedDefaults.pendingStopStartLocation)
        suite.removeObject(forKey: SharedDefaults.pendingStopSessionID)
        suite.removeObject(forKey: SharedDefaults.pendingStopSource)
        WidgetCenter.shared.reloadAllTimelines()
    }
}
