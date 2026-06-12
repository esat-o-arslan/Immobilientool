//
//  WorkTrackingWidgetLiveActivity.swift
//
//  Open-source template on 13.05.2026.
//

import ActivityKit
import WidgetKit
import SwiftUI
import AppIntents

struct WorkTrackingWidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: WorkAttributes.self) { context in
            LiveActivityView(context: context)
                .activityBackgroundTint(Color(.systemBackground))
                .activitySystemActionForegroundColor(.primary)
        } dynamicIsland: { context in
            DynamicIsland {
                // MARK: - ERWEITERTE ANSICHT (Expanded)
                DynamicIslandExpandedRegion(.leading) {
                    VStack {
                        Spacer()
                        HStack(spacing: 6) {
                            Image(systemName: "clock.fill")
                                .foregroundStyle(.green)
                            Text("Arbeitszeit")
                                .font(.headline)
                        }
                        .padding(.leading, 8)
                        Spacer()
                    }
                }

                DynamicIslandExpandedRegion(.trailing) {
                    VStack {
                        Spacer()
                        Text(context.state.startTime, style: .timer)
                            .font(.system(.title3, design: .monospaced))
                            .fontWeight(.bold)
                            .monospacedDigit()
                            .minimumScaleFactor(0.8)
                            .padding(.trailing, 8)
                        Spacer()
                    }
                }

                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        Text("Start \(context.state.startTime.formatted(date: .omitted, time: .shortened))")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)

                        Spacer()

                        Button(intent: StopTrackingIntent()) {
                            Label("Stoppen", systemImage: "stop.fill")
                                .font(.subheadline.weight(.semibold))
                        }
                        .tint(.red)
                        .buttonStyle(.borderedProminent)
                        .buttonBorderShape(.capsule)
                    }
                    .padding([.leading, .trailing], 8)
                    .padding(.top, 10)
                }
                
            } compactLeading: {
                // MARK: - KOMPAKTE ANSICHT LINKS
                Image(systemName: "clock.fill")
                    .foregroundStyle(.green)
                    
            } compactTrailing: {
                // MARK: - KOMPAKTE ANSICHT RECHTS (Endgültiger Fix)
                // Durch den festen Frame wird verhindert, dass der Timer die Dynamic Island aufbläht.
                Text(context.state.startTime, style: .timer)
                    .font(.system(size: 13, weight: .semibold, design: .monospaced))
                    .monospacedDigit()
                    .lineLimit(1)
                    .frame(maxWidth: 50, alignment: .trailing) // Begrenzt die Breite radikal
                    .fixedSize(horizontal: true, vertical: true)
                
            } minimal: {
                // MARK: - MINIMALE ANSICHT
                Image(systemName: "clock.fill")
                    .foregroundStyle(.green)
            }
        }
    }

    // MARK: - LOCKSCREEN WIDGET VIEW
    private struct LiveActivityView: View {
        let context: ActivityViewContext<WorkAttributes>

        var body: some View {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .center) {
                    Label {
                        Text("Arbeitszeit läuft")
                            .font(.headline)
                    } icon: {
                        Image(systemName: "clock.fill")
                            .foregroundStyle(.green)
                    }

                    Spacer()

                    Button(intent: StopTrackingIntent()) {
                        Image(systemName: "stop.fill")
                            .font(.headline)
                    }
                    .tint(.red)
                }

                Text(context.state.startTime, style: .timer)
                    .font(.system(size: 28, weight: .bold, design: .monospaced))
                    .monospacedDigit()

                Text("Start: \(context.state.startTime.formatted(date: .omitted, time: .shortened))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding()
        }
    }
}
