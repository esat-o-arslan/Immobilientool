//
//  TrackingIntents.swift
//  Zeiterfassung
//
//  Open-source template on 22.05.2026.
//

import Foundation
import AppIntents

struct StartTrackingIntent: AppIntent {
    static var title: LocalizedStringResource = "Zeiterfassung starten"
    static var description = IntentDescription("Startet die Zeiterfassung.")

    func perform() async throws -> some IntentResult {
        let snapshot = TrackingBridge.loadSnapshot()

        if snapshot.isTracking == false {
            let newSnapshot = TrackingSnapshot(
                isTracking: true,
                startTime: Date(),
                startLocation: nil,
                sessionID: UUID().uuidString,
                lastUpdatedAt: Date()
            )
            TrackingBridge.saveSnapshot(newSnapshot)
            TrackingBridge.reloadWidgets()
        }

        return .result(dialog: "Zeiterfassung gestartet.")
    }
}

struct StopTrackingIntent: AppIntent {
    static var title: LocalizedStringResource = "Zeiterfassung stoppen"
    static var description = IntentDescription("Stoppt die laufende Zeiterfassung.")

    func perform() async throws -> some IntentResult {
        let snapshot = TrackingBridge.loadSnapshot()

        if snapshot.isTracking {
            TrackingBridge.clearTracking()
            TrackingBridge.reloadWidgets()
        }

        return .result(dialog: "Zeiterfassung gestoppt.")
    }
}

struct RefreshTrackingIntent: AppIntent {
    static var title: LocalizedStringResource = "Tracking aktualisieren"
    static var description = IntentDescription("Aktualisiert Widget und Live-Daten.")

    func perform() async throws -> some IntentResult {
        TrackingBridge.reloadWidgets()
        return .result()
    }
}
