//
//  DataModels.swift
//  Zeiterfassung
//
//  Open-source template on 17.05.2026.
//

import Foundation
import SwiftData

@Model
final class WorkEntry {
    var id: UUID
    var startTime: Date
    var endTime: Date
    var startLoc: String?
    var endLoc: String?
    var pauseMinutes: Int
    var isVacation: Bool
    var isSick: Bool
    var isOvertimeReduction: Bool
    var overtimeReductionHours: Double
    var isLocked: Bool
    var lockedAt: Date?

    init(
        id: UUID = UUID(),
        startTime: Date,
        endTime: Date,
        startLoc: String? = nil,
        endLoc: String? = nil,
        pauseMinutes: Int = 0,
        isVacation: Bool = false,
        isSick: Bool = false,
        isOvertimeReduction: Bool = false,
        overtimeReductionHours: Double = 0.0,
        isLocked: Bool = false,
        lockedAt: Date? = nil
    ) {
        self.id = id
        self.startTime = startTime
        self.endTime = endTime
        self.startLoc = startLoc
        self.endLoc = endLoc
        self.pauseMinutes = pauseMinutes
        self.isVacation = isVacation
        self.isSick = isSick
        self.isOvertimeReduction = isOvertimeReduction
        self.overtimeReductionHours = overtimeReductionHours
        self.isLocked = isLocked
        self.lockedAt = lockedAt
    }

    var durationInSeconds: Int {
        max(0, Int(endTime.timeIntervalSince(startTime)))
    }

    var legalAutoPauseMinutes: Int {
        guard !isVacation, !isSick, !isOvertimeReduction else { return 0 }

        let workedHours = Double(durationInSeconds) / 3600.0

        if workedHours > 9.0 { return 60 }
        if workedHours > 7.0 { return 30 }
        if workedHours > 5.5 { return 15 }
        return 0
    }

    var totalPauseMinutes: Int {
        max(pauseMinutes, legalAutoPauseMinutes)
    }

    var totalSeconds: Int {
        guard !isVacation, !isSick, !isOvertimeReduction else { return 0 }
        return max(0, durationInSeconds - (totalPauseMinutes * 60))
    }

    var totalHours: Double {
        Double(totalSeconds) / 3600.0
    }
}

// Die anderen Modelle (Holiday, SpesenEintrag, WeeklySoll) bleiben unverändert
@Model
final class Holiday {
    var id: UUID
    var date: Date
    var name: String

    init(id: UUID = UUID(), date: Date, name: String) {
        self.id = id
        self.date = date
        self.name = name
    }
}

@Model
final class SpesenEintrag {
    var id: UUID
    var date: Date
    var title: String
    var amount: Double
    @Attribute(.externalStorage) var image: Data?

    init(
        id: UUID = UUID(),
        date: Date,
        title: String,
        amount: Double,
        image: Data? = nil
    ) {
        self.id = id
        self.date = date
        self.title = title
        self.amount = amount
        self.image = image
    }
}

@Model
final class WeeklySoll {
    var id: UUID
    var year: Int
    var weekNumber: Int
    var moSoll: Double
    var diSoll: Double
    var miSoll: Double
    var doSoll: Double
    var frSoll: Double
    var saSoll: Double
    var soSoll: Double

    init(
        id: UUID = UUID(),
        year: Int,
        weekNumber: Int,
        moSoll: Double,
        diSoll: Double,
        miSoll: Double,
        doSoll: Double,
        frSoll: Double,
        saSoll: Double,
        soSoll: Double
    ) {
        self.id = id
        self.year = year
        self.weekNumber = weekNumber
        self.moSoll = moSoll
        self.diSoll = diSoll
        self.miSoll = miSoll
        self.doSoll = doSoll
        self.frSoll = frSoll
        self.saSoll = saSoll
        self.soSoll = soSoll
    }
}
