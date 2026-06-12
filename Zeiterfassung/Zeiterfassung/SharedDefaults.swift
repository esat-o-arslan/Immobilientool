//
//  SharedDefaults.swift
//  Zeiterfassung
//
//  Open-source template on 20.05.2026.
//

import Foundation

enum SharedDefaults {
    static let appGroupID = "group.ch.example.immobilientool.time"

    static let trackingIsActive = "trackingIsActive"
    static let trackingStartTime = "trackingStartTime"
    static let trackingStartLocation = "trackingStartLocation"
    static let trackingSessionID = "trackingSessionID"

    static let pendingStartTime = "pendingStartTime"
    static let pendingStartLocation = "pendingStartLocation"
    static let pendingStartSessionID = "pendingStartSessionID"
    static let pendingStartSource = "pendingStartSource"

    static let pendingStopStartTime = "pendingStopStartTime"
    static let pendingStopEndTime = "pendingStopEndTime"
    static let pendingStopStartLocation = "pendingStopStartLocation"
    static let pendingStopSessionID = "pendingStopSessionID"
    static let pendingStopSource = "pendingStopSource"

    static let userName = "userName"
    static let userLastName = "userLastName"
    static let isGeofenceEnabled = "isGeofenceEnabled"
    static let workLocationName = "workLocationName"
    static let workLocationLat = "workLocationLat"
    static let workLocationLon = "workLocationLon"
    static let workGeofenceRadius = "workGeofenceRadius"

    static let entryDate = "entryDate"

    static let latestDataChangeToken = "latestDataChangeToken"
    static let latestTrackingChangeToken = "latestTrackingChangeToken"
    static let latestReportRefreshToken = "latestReportRefreshToken"

    static let watchTrackingSnapshot = "watchTrackingSnapshot"
}

extension UserDefaults {
    static var sharedGroup: UserDefaults {
        guard let defaults = UserDefaults(suiteName: SharedDefaults.appGroupID) else {
            fatalError("App Group '\(SharedDefaults.appGroupID)' ist nicht korrekt eingerichtet.")
        }
        return defaults
    }
}
