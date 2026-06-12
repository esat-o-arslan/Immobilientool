//
//  TrackingActionGate.swift
//  Zeiterfassung
//
//  Open-source template on 22.05.2026.
//

import Foundation

actor TrackingActionGate {
    static let shared = TrackingActionGate()

    private var isProcessing = false

    func run<T>(_ operation: @Sendable () async throws -> T) async rethrows -> T? {
        guard !isProcessing else { return nil }
        isProcessing = true
        defer { isProcessing = false }
        return try await operation()
    }
}
