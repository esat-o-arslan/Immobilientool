//
//  WorkTrackingWidget.swift
//
//  Open-source template on 13.05.2026.
//

import WidgetKit
import SwiftUI
import AppIntents

struct WorkTrackingProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> WorkTrackingEntry {
        WorkTrackingEntry(
            date: Date(),
            configuration: ConfigurationAppIntent(),
            isTracking: false,
            startTime: nil,
            elapsedText: "00:00:00"
        )
    }

    func snapshot(for configuration: ConfigurationAppIntent, in context: Context) async -> WorkTrackingEntry {
        makeEntry(configuration: configuration)
    }

    func timeline(for configuration: ConfigurationAppIntent, in context: Context) async -> Timeline<WorkTrackingEntry> {
        let entry = makeEntry(configuration: configuration)
        let refreshDate = Date().addingTimeInterval(60)
        return Timeline(entries: [entry], policy: .after(refreshDate))
    }

    private func makeEntry(configuration: ConfigurationAppIntent) -> WorkTrackingEntry {
        let snapshot = TrackingBridge.loadSnapshot()

        let elapsedText: String
        if snapshot.isTracking, let startTime = snapshot.startTime {
            let seconds = max(0, Int(Date().timeIntervalSince(startTime)))
            elapsedText = format(seconds: seconds)
        } else {
            elapsedText = "Nicht aktiv"
        }

        return WorkTrackingEntry(
            date: Date(),
            configuration: configuration,
            isTracking: snapshot.isTracking,
            startTime: snapshot.startTime,
            elapsedText: elapsedText
        )
    }

    private func format(seconds: Int) -> String {
        let h = seconds / 3600
        let m = (seconds % 3600) / 60
        let s = seconds % 60
        return String(format: "%02d:%02d:%02d", h, m, s)
    }
}

struct WorkTrackingEntry: TimelineEntry {
    let date: Date
    let configuration: ConfigurationAppIntent
    let isTracking: Bool
    let startTime: Date?
    let elapsedText: String
}

struct WorkTrackingWidgetEntryView: View {
    var entry: WorkTrackingProvider.Entry

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: entry.isTracking ? "clock.fill" : "clock.badge.xmark")
                    .foregroundStyle(entry.isTracking ? .green : .secondary)

                Text(entry.isTracking ? "Arbeitszeit läuft" : "Nicht gestartet")
                    .font(.headline)
                    .lineLimit(1)
            }

            Spacer(minLength: 4)

            if let startTime = entry.startTime, entry.isTracking {
                Text("Start: \(startTime.formatted(date: .omitted, time: .shortened))")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Text(entry.elapsedText)
                    .font(.system(size: 24, weight: .bold, design: .monospaced))
                    .minimumScaleFactor(0.8)
                    .lineLimit(1)
            } else {
                Text("Öffne die App oder das Control Widget zum Starten.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer(minLength: 0)
        }
        .padding()
    }
}

struct WorkTrackingWidget: Widget {
    let kind: String = "WorkTrackingWidget"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(
            kind: kind,
            intent: ConfigurationAppIntent.self,
            provider: WorkTrackingProvider()
        ) { entry in
            WorkTrackingWidgetEntryView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Zeiterfassung")
        .description("Zeigt den aktuellen Arbeitsstatus und die laufende Zeit.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

#Preview(as: .systemSmall) {
    WorkTrackingWidget()
} timeline: {
    WorkTrackingEntry(
        date: .now,
        configuration: ConfigurationAppIntent(),
        isTracking: true,
        startTime: Date().addingTimeInterval(-5420),
        elapsedText: "01:30:20"
    )
}
