//
//  CloudSyncManager.swift
//  Zeiterfassung
//
//  Open-source template on 06.06.2026.
//

import Foundation
import CloudKit
import SwiftUI

@MainActor
@Observable
final class CloudSyncManager {
    static let shared = CloudSyncManager()

    private(set) var accountStatus: CKAccountStatus = .couldNotDetermine
    private(set) var lastSyncDate: Date?
    private(set) var needsRestart: Bool = false
    private(set) var syncError: String?

    var iCloudEnabled: Bool {
        didSet {
            guard iCloudEnabled != oldValue else { return }
            UserDefaults.standard.set(iCloudEnabled, forKey: "iCloudSyncEnabled")
            needsRestart = true
        }
    }

    var accountStatusText: String {
        switch accountStatus {
        case .available:            return "Verbunden"
        case .noAccount:            return "Kein iCloud-Account"
        case .restricted:           return "Eingeschränkt"
        case .couldNotDetermine:    return "Unbekannt"
        case .temporarilyUnavailable: return "Vorübergehend nicht verfügbar"
        @unknown default:           return "Unbekannt"
        }
    }

    var accountStatusColor: Color {
        switch accountStatus {
        case .available:    return .green
        case .noAccount:    return .red
        default:            return .secondary
        }
    }

    private init() {
        iCloudEnabled = UserDefaults.standard.bool(forKey: "iCloudSyncEnabled")
        if let ts = UserDefaults.standard.double(forKey: "iCloudLastSync") as Double?, ts > 0 {
            lastSyncDate = Date(timeIntervalSince1970: ts)
        }
        observeRemoteChanges()
    }

    func checkAccountStatus() async {
        do {
            let status = try await CKContainer.default().accountStatus()
            accountStatus = status
        } catch {
            accountStatus = .couldNotDetermine
        }
    }

    func recordSync() {
        let now = Date()
        lastSyncDate = now
        UserDefaults.standard.set(now.timeIntervalSince1970, forKey: "iCloudLastSync")
    }

    private func observeRemoteChanges() {
        NotificationCenter.default.addObserver(
            forName: NSNotification.Name("NSPersistentStoreRemoteChangeNotification"),
            object: nil,
            queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated {
                self?.recordSync()
            }
        }
    }
}
