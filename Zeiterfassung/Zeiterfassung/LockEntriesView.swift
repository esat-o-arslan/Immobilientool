//
//  LockEntriesView.swift
//  Zeiterfassung
//
//  Open-source template on 06.06.2026.
//

import SwiftUI
import SwiftData

struct LockEntriesView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    @Query(
        filter: #Predicate<WorkEntry> { !$0.isLocked },
        sort: \WorkEntry.startTime,
        order: .reverse
    )
    private var unlockedEntries: [WorkEntry]

    @State private var showConfirmAll = false

    private var groupedByMonth: [(key: String, entries: [WorkEntry])] {
        let cal = Calendar.current
        let fmt = DateFormatter()
        fmt.dateFormat = "MMMM yyyy"
        fmt.locale = Locale(identifier: "de_DE")

        let grouped = Dictionary(grouping: unlockedEntries) { entry in
            let comps = cal.dateComponents([.year, .month], from: entry.startTime)
            return "\(comps.year ?? 0)-\(String(format: "%02d", comps.month ?? 0))"
        }

        return grouped
            .map { key, entries in
                let date = entries.first!.startTime
                return (key: fmt.string(from: date), entries: entries.sorted { $0.startTime > $1.startTime })
            }
            .sorted { $0.key > $1.key }
    }

    var body: some View {
        NavigationStack {
            Group {
                if unlockedEntries.isEmpty {
                    VStack(spacing: 16) {
                        Image(systemName: "checkmark.seal.fill")
                            .font(.system(size: 60))
                            .foregroundStyle(.green)
                        Text("Alle Einträge festgeschrieben")
                            .font(.title2.bold())
                        Text("Es gibt keine offenen Einträge mehr.")
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding()
                } else {
                    List {
                        Section {
                            Button {
                                showConfirmAll = true
                            } label: {
                                Label("Alle \(unlockedEntries.count) Einträge festschreiben",
                                      systemImage: "lock.fill")
                                    .foregroundStyle(.orange)
                                    .font(.headline)
                            }
                        } footer: {
                            Text("Festgeschriebene Einträge können nicht mehr bearbeitet oder gelöscht werden.")
                        }

                        ForEach(groupedByMonth, id: \.key) { group in
                            Section {
                                ForEach(group.entries) { entry in
                                    entryRow(entry)
                                }

                                Button {
                                    lockEntries(group.entries)
                                } label: {
                                    Label("\(group.key) festschreiben", systemImage: "lock")
                                        .font(.subheadline.bold())
                                        .foregroundStyle(.blue)
                                }
                            } header: {
                                HStack {
                                    Text(group.key)
                                    Spacer()
                                    Text("\(group.entries.count) Einträge")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Festschreiben")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Fertig") { dismiss() }
                }
            }
            .confirmationDialog(
                "Alle \(unlockedEntries.count) Einträge festschreiben?",
                isPresented: $showConfirmAll,
                titleVisibility: .visible
            ) {
                Button("Alle festschreiben", role: .destructive) {
                    lockEntries(unlockedEntries)
                }
                Button("Abbrechen", role: .cancel) {}
            } message: {
                Text("Festgeschriebene Einträge können nicht mehr bearbeitet oder gelöscht werden.")
            }
        }
    }

    @ViewBuilder
    private func entryRow(_ entry: WorkEntry) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(entryTypeLabel(entry))
                        .font(.subheadline.bold())
                    if entry.isVacation || entry.isSick || entry.isOvertimeReduction {
                        Text(entryTypeBadge(entry))
                            .font(.caption2.bold())
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(entryTypeColor(entry).opacity(0.15))
                            .foregroundStyle(entryTypeColor(entry))
                            .clipShape(Capsule())
                    }
                }
                Text(entry.startTime, style: .date)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            if !entry.isVacation && !entry.isSick && !entry.isOvertimeReduction {
                Text(formatHours(entry.totalSeconds))
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.secondary)
            }

            Button {
                lockEntries([entry])
            } label: {
                Image(systemName: "lock")
                    .foregroundStyle(.orange)
            }
            .buttonStyle(.plain)
        }
    }

    private func lockEntries(_ entries: [WorkEntry]) {
        let now = Date()
        for entry in entries {
            entry.isLocked = true
            entry.lockedAt = now
        }
        try? modelContext.save()
        TrackingBridge.markDataChanged()
    }

    private func entryTypeLabel(_ e: WorkEntry) -> String {
        if e.isVacation { return "Urlaubstag" }
        if e.isSick { return "Krankheitstag" }
        if e.isOvertimeReduction { return "Überstundenabbau" }
        let h = e.startTime.formatted(date: .omitted, time: .shortened)
        let end = e.endTime.formatted(date: .omitted, time: .shortened)
        return "\(h) – \(end)"
    }

    private func entryTypeBadge(_ e: WorkEntry) -> String {
        if e.isVacation { return "Urlaub" }
        if e.isSick { return "Krank" }
        return "Abbau"
    }

    private func entryTypeColor(_ e: WorkEntry) -> Color {
        if e.isVacation { return .orange }
        if e.isSick { return .red }
        return .purple
    }

    private func formatHours(_ seconds: Int) -> String {
        String(format: "%d:%02d h", seconds / 3600, (seconds % 3600) / 60)
    }
}
