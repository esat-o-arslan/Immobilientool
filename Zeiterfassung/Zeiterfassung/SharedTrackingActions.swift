//
//  SharedTrackingActions.swift
//  Zeiterfassung
//
//  Open-source template on 22.05.2026.
//

import Foundation
import WidgetKit
#if canImport(ActivityKit)
import ActivityKit
#endif

enum SharedTrackingActions {
    static func startTrackingFromExternalSurface(
        startTime: Date = Date(),
        startLocation: String? = nil,
        source: String = "external"
    ) async {
        await TrackingActionGate.shared.run {
            await MainActor.run {
                let existingSnapshot = TrackingBridge.loadSnapshot()
                guard existingSnapshot.isTracking == false else { return }

                PendingStopBridge.clear()

                let sessionID = UUID().uuidString

                let payload = PendingStartPayload(
                    startTime: startTime,
                    startLocation: startLocation,
                    sessionID: sessionID,
                    source: source
                )
                PendingStartBridge.save(payload)

                let snapshot = TrackingSnapshot(
                    isTracking: true,
                    startTime: startTime,
                    startLocation: startLocation,
                    sessionID: sessionID,
                    lastUpdatedAt: Date()
                )
                TrackingBridge.saveSnapshot(snapshot)

                WidgetCenter.shared.reloadAllTimelines()
            }

            #if canImport(ActivityKit)
            let attributes = WorkAttributes(title: "Zeiterfassung")
            let state = WorkAttributes.ContentState(
                startTime: startTime,
                isRunning: true
            )
            let content = ActivityContent(state: state, staleDate: nil)

            do {
                if ActivityAuthorizationInfo().areActivitiesEnabled {
                    let existingActivities = Activity<WorkAttributes>.activities
                    if existingActivities.isEmpty {
                        _ = try Activity.request(
                            attributes: attributes,
                            content: content,
                            pushType: nil
                        )
                    } else {
                        for activity in existingActivities {
                            await activity.update(content)
                        }
                    }
                }
            } catch {
                print("Live Activity konnte nicht gestartet werden: \(error)")
            }
            #endif

            await MainActor.run {
                WidgetCenter.shared.reloadAllTimelines()
            }
        }
    }

    static func stopTrackingFromExternalSurface(source: String = "external") async {
        await TrackingActionGate.shared.run {
            let snapshot = await MainActor.run {
                TrackingBridge.loadSnapshot()
            }

            guard snapshot.isTracking else {
                await MainActor.run {
                    PendingStartBridge.clear()
                    WidgetCenter.shared.reloadAllTimelines()
                }
                return
            }

            await MainActor.run {
                PendingStartBridge.clear()

                if let startTime = snapshot.startTime {
                    let payload = PendingStopPayload(
                        startTime: startTime,
                        endTime: Date(),
                        startLocation: snapshot.startLocation,
                        sessionID: snapshot.sessionID,
                        source: source
                    )
                    PendingStopBridge.save(payload)
                }

                TrackingBridge.clearTracking()
                WidgetCenter.shared.reloadAllTimelines()
            }

            #if canImport(ActivityKit)
            for activity in Activity<WorkAttributes>.activities {
                let endState = WorkAttributes.ContentState(
                    startTime: snapshot.startTime ?? Date(),
                    isRunning: false
                )

                let content = ActivityContent(state: endState, staleDate: Date())
                await activity.end(content, dismissalPolicy: .immediate)
            }
            #endif

            await MainActor.run {
                WidgetCenter.shared.reloadAllTimelines()
            }
        }
    }

    static func refreshSurfaces() async {
        await MainActor.run {
            TrackingBridge.reloadWidgets()
            WidgetCenter.shared.reloadAllTimelines()
        }
    }
}
