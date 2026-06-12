//
//  Zeiterfassung_Watch_AppApp.swift
//  Zeiterfassung Watch App
//
//  Open-source template on 23.05.2026.
//

import SwiftUI

@main
struct Zeiterfassung_Watch_AppApp: App {
    init() {
        WatchConnectivityBridge.shared.activate()
    }

    var body: some Scene {
        WindowGroup {
            NavigationStack {
                WatchContentView()
            }
        }
    }
}
