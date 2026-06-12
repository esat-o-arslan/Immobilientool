//
//  WorkDayCalculator.swift
//  Zeiterfassung
//
//  Open-source template on 22.05.2026.
//

import Foundation

enum WorkDayCalculator {
    static func sollForDate(
        _ date: Date,
        weeklySolls: [WeeklySoll],
        defaultMo: Double,
        defaultDi: Double,
        defaultMi: Double,
        defaultDo: Double,
        defaultFr: Double,
        defaultSa: Double,
        defaultSo: Double,
        entryDate: Date
    ) -> Double {
        let calendar = Calendar.current
        let normalizedDate = calendar.startOfDay(for: date)
        let normalizedEntryDate = calendar.startOfDay(for: entryDate)

        if normalizedDate < normalizedEntryDate {
            return 0
        }

        let week = calendar.component(.weekOfYear, from: date)
        let year = calendar.component(.year, from: date)
        let weekday = calendar.component(.weekday, from: date)

        if let config = weeklySolls.first(where: { $0.year == year && $0.weekNumber == week }) {
            switch weekday {
            case 2: return config.moSoll
            case 3: return config.diSoll
            case 4: return config.miSoll
            case 5: return config.doSoll
            case 6: return config.frSoll
            case 7: return config.saSoll
            case 1: return config.soSoll
            default: return 0
            }
        }

        switch weekday {
        case 2: return defaultMo
        case 3: return defaultDi
        case 4: return defaultMi
        case 5: return defaultDo
        case 6: return defaultFr
        case 7: return defaultSa
        case 1: return defaultSo
        default: return 0
        }
    }

    @MainActor
    static func liveWorkedSeconds(
        selectedDate: Date,
        trackingStore: TrackingStore
    ) -> Int {
        let calendar = Calendar.current
        guard trackingStore.isTracking, let start = trackingStore.currentStart else { return 0 }
        guard calendar.isDate(start, inSameDayAs: selectedDate) else { return 0 }
        return max(0, Int(Date().timeIntervalSince(start)))
    }
}
