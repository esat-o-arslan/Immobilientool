//
//  WatchContentView.swift
//  Zeiterfassung Watch App
//
//  Open-source template on 23.05.2026.
//

import SwiftUI
import Combine
import WatchConnectivity

struct WatchContentView: View {
    @State private var bridge = WatchConnectivityBridge.shared
    @State private var now = Date()

    private let ticker = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    private var payload: WatchSyncPayload {
        bridge.latestPayload
    }

    private var isTracking: Bool {
        payload.isTracking
    }

    private var startTime: Date? {
        payload.startTime
    }

    private var elapsedText: String {
        guard isTracking, let startTime else { return "00:00:00" }
        let seconds = max(0, Int(now.timeIntervalSince(startTime)))
        let h = seconds / 3600
        let m = (seconds % 3600) / 60
        let s = seconds % 60
        return String(format: "%02d:%02d:%02d", h, m, s)
    }

    private var syncStatusText: String {
        if bridge.activationState != .activated {
            return "Sync startet …"
        }
        return bridge.isReachable ? "iPhone verbunden" : "Nicht direkt erreichbar"
    }

    private var sessionStateText: String {
        switch bridge.activationState {
        case .notActivated: return "nicht aktiviert"
        case .inactive:     return "inaktiv"
        case .activated:    return "aktiv"
        @unknown default:   return "unbekannt"
        }
    }

    private var shortSessionID: String {
        guard let id = payload.sessionID, !id.isEmpty else { return "—" }
        return String(id.prefix(8))
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 10) {

                // MARK: - Logo
                brandHeader

                // MARK: - Status
                VStack(spacing: 3) {
                    Text(isTracking ? "Aktiv" : "Nicht aktiv")
                        .font(.title3.weight(.bold))
                        .foregroundStyle(.primary)

                    Text(isTracking ? "Zeiterfassung läuft" : "Keine laufende Erfassung")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }

                // MARK: - Timer
                Text(elapsedText)
                    .font(.system(size: 40, weight: .bold, design: .monospaced))
                    .monospacedDigit()
                    .minimumScaleFactor(0.7)
                    .lineLimit(1)
                    .padding(.vertical, 4)

                // MARK: - START / STOPP
                Button {
                    if isTracking {
                        bridge.stopTrackingFromWatch()
                    } else {
                        bridge.startTrackingFromWatch()
                    }
                } label: {
                    Text(isTracking ? "STOPP" : "START")
                        .font(.headline.bold())
                        .frame(maxWidth: .infinity, minHeight: 48)
                }
                .buttonStyle(.borderedProminent)
                .tint(isTracking ? .red : .green)

                // MARK: - Sync
                Button {
                    bridge.requestImmediateRefresh()
                } label: {
                    Text("Jetzt syncen")
                        .font(.footnote)
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.borderedProminent)
                .tint(Color(white: 0.22))

                // MARK: - Debug
                debugBlock
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
        }
        .navigationTitle("Zeiterfassung")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            bridge.requestImmediateRefresh()
        }
        .onChange(of: bridge.activationState) { _, newState in
            if newState == .activated {
                bridge.requestImmediateRefresh()
            }
        }
        .onReceive(ticker) { value in
            now = value
        }
    }

    // MARK: - Brand Header
    private var brandHeader: some View {
        VStack(spacing: 4) {
            ZStack {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(Color.white.opacity(0.96))

                VStack(spacing: 1) {
                    Text("IMMOBILIENTOOL")
                        .font(.system(size: 18, weight: .bold, design: .rounded))
                        .tracking(2)
                        .foregroundStyle(.black)

                    Text("IMMOBILIEN")
                        .font(.system(size: 9, weight: .medium, design: .rounded))
                        .tracking(2.2)
                        .foregroundStyle(Color.black.opacity(0.45))
                }
                .padding(.vertical, 8)
            }
            .frame(maxWidth: 122, minHeight: 46)

            Text("für Immobilientool")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }

    // MARK: - Debug Block
    private var debugBlock: some View {
        VStack(alignment: .leading, spacing: 3) {
            Divider().padding(.top, 2)

            Text(syncStatusText)
                .font(.caption2)
                .foregroundStyle(bridge.isReachable ? .green : .orange)

            Text("Session: \(sessionStateText)")
                .font(.caption2)
                .foregroundStyle(.secondary)

            Text("Update: \(payload.lastUpdatedAt, style: .relative)")
                .font(.caption2)
                .foregroundStyle(.secondary)

            Text("Start: \(startTime.map { $0.formatted(date: .omitted, time: .shortened) } ?? "—")")
                .font(.caption2)
                .foregroundStyle(.secondary)

            Text("ID: \(shortSessionID)")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 2)
    }
}
