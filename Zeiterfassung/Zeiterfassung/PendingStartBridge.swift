//
//  PendingStartBridge.swift
//  Zeiterfassung
//
//  Open-source template on 22.05.2026.
//

import Foundation
import WidgetKit

enum PendingStartBridge {
    private static let suite = UserDefaults.sharedGroup

    static func save(_ payload: PendingStartPayload) {
        suite.set(payload.startTime.timeIntervalSince1970, forKey: SharedDefaults.pendingStartTime)
        suite.set(payload.startLocation ?? "", forKey: SharedDefaults.pendingStartLocation)
        suite.set(payload.sessionID, forKey: SharedDefaults.pendingStartSessionID)
        suite.set(payload.source, forKey: SharedDefaults.pendingStartSource)
        WidgetCenter.shared.reloadAllTimelines()
    }

    static func load() -> PendingStartPayload? {
        let startTS = suite.double(forKey: SharedDefaults.pendingStartTime)
        guard startTS > 0 else { return nil }

        let sessionID = suite.string(forKey: SharedDefaults.pendingStartSessionID) ?? ""
        guard !sessionID.isEmpty else { return nil }

        let startLocationRaw = suite.string(forKey: SharedDefaults.pendingStartLocation)
        let source = suite.string(forKey: SharedDefaults.pendingStartSource) ?? "external"

        return PendingStartPayload(
            startTime: Date(timeIntervalSince1970: startTS),
            startLocation: (startLocationRaw?.isEmpty == false) ? startLocationRaw : nil,
            sessionID: sessionID,
            source: source
        )
    }

    static func clear() {
        suite.removeObject(forKey: SharedDefaults.pendingStartTime)
        suite.removeObject(forKey: SharedDefaults.pendingStartLocation)
        suite.removeObject(forKey: SharedDefaults.pendingStartSessionID)
        suite.removeObject(forKey: SharedDefaults.pendingStartSource)
        WidgetCenter.shared.reloadAllTimelines()
    }
}
