//
//  DailyExportCalculator.swift
//  Zeiterfassung
//
//  Open-source template on 22.05.2026.
//

import Foundation

struct DailyExportResult {
    let date: Date
    let istHours: Double
    let sollHours: Double
    let status: String
    let diffHours: Double
}

enum DailyExportCalculator {
    static func result(
        for date: Date,
        entries: [WorkEntry],
        holidays: [Holiday],
        sollProvider: (Date) -> Double
    ) -> DailyExportResult {
        let calendar = Calendar.current
        let dayEntries = entries.filter { calendar.isDate($0.startTime, inSameDayAs: date) }
        let isHoliday = holidays.contains(where: { calendar.isDate($0.date, inSameDayAs: date) })
        let isVacation = dayEntries.contains(where: { $0.isVacation })
        let sollHours = sollProvider(date)

        let istHours: Double
        let status: String

        if isHoliday {
            istHours = sollHours
            status = "Feiertag"
        } else if isVacation {
            istHours = sollHours
            status = "Urlaub"
        } else {
            let istSeconds = dayEntries.reduce(0) { $0 + $1.totalSeconds }
            istHours = Double(istSeconds) / 3600.0
            status = dayEntries.isEmpty ? "-" : "Arbeit"
        }

        return DailyExportResult(
            date: date,
            istHours: istHours,
            sollHours: sollHours,
            status: status,
            diffHours: istHours - sollHours
        )
    }
}
