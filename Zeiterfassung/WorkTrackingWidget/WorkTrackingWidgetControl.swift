//
//  WorkTrackingWidgetControl.swift
//
//  Open-source template on 13.05.2026.
//

import AppIntents
import SwiftUI
import WidgetKit
import Foundation

@available(iOS 18.0, *)
struct WorkTrackingWidgetControl: ControlWidget {
    static let kind: String = "ch.example.immobilientool.time.WorkTrackingWidgetControl"

    var body: some ControlWidgetConfiguration {
        AppIntentControlConfiguration(
            kind: Self.kind,
            provider: Provider()
        ) { value in
            ControlWidgetToggle(
                value.isRunning ? "Arbeitszeit stoppen" : "Arbeitszeit starten",
                isOn: value.isRunning,
                action: ToggleTrackingIntent(value: value.isRunning)
            ) { isRunning in
                Label(
                    isRunning ? "Läuft" : "Gestoppt",
                    systemImage: isRunning ? "stop.circle.fill" : "play.circle.fill"
                )
            }
        }
        .displayName("Zeiterfassung")
        .description("Startet oder stoppt deine Zeiterfassung.")
    }
}

@available(iOS 18.0, *)
extension WorkTrackingWidgetControl {
    struct Value {
        var isRunning: Bool
    }

    struct Provider: AppIntentControlValueProvider {
        func previewValue(configuration: TimerConfiguration) -> Value {
            Value(isRunning: false)
        }

        func currentValue(configuration: TimerConfiguration) async throws -> Value {
            let snapshot = TrackingBridge.loadSnapshot()
            return Value(isRunning: snapshot.isTracking)
        }
    }
}

@available(iOS 18.0, *)
struct TimerConfiguration: ControlConfigurationIntent {
    static let title: LocalizedStringResource = "Zeiterfassung Konfiguration"

    @Parameter(title: "Timer Name", default: "Portal Timer")
    var timerName: String
}

@available(iOS 18.0, *)
struct ToggleTrackingIntent: SetValueIntent {
    static let title: LocalizedStringResource = "Zeiterfassung umschalten"

    @Parameter(title: "Aktiv")
    var value: Bool

    init() { }

    init(value: Bool) {
        self.value = value
    }

    func perform() async throws -> some IntentResult {
        let currentSnapshot = TrackingBridge.loadSnapshot()

        if value == true {
            if currentSnapshot.isTracking == false {
                let snapshot = TrackingSnapshot(
                    isTracking: true,
                    startTime: Date(),
                    startLocation: nil,
                    sessionID: UUID().uuidString,
                    lastUpdatedAt: Date()
                )
                TrackingBridge.saveSnapshot(snapshot)
            }
        } else {
            TrackingBridge.clearTracking()
        }

        TrackingBridge.reloadWidgets()
        return .result()
    }
}
