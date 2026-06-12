//
//  BackupRestoreService.swift
//  Zeiterfassung
//

import Foundation
import SwiftData

// MARK: - Backup Container

struct AppBackup: Codable {
    let version: Int
    let createdAt: Date
    let workEntries: [WorkEntryData]
    let holidays: [HolidayData]
    let spesenEintraege: [SpesenData]
    let weeklySolls: [WeeklySollData]
    let settings: SettingsData

    init(
        createdAt: Date,
        workEntries: [WorkEntryData],
        holidays: [HolidayData],
        spesenEintraege: [SpesenData],
        weeklySolls: [WeeklySollData],
        settings: SettingsData
    ) {
        self.version = 1
        self.createdAt = createdAt
        self.workEntries = workEntries
        self.holidays = holidays
        self.spesenEintraege = spesenEintraege
        self.weeklySolls = weeklySolls
        self.settings = settings
    }

    struct WorkEntryData: Codable {
        let id: UUID
        let startTime: Date
        let endTime: Date
        let startLoc: String?
        let endLoc: String?
        let pauseMinutes: Int
        let isVacation: Bool
        let isSick: Bool
        let isOvertimeReduction: Bool
        let overtimeReductionHours: Double
        let isLocked: Bool
        let lockedAt: Date?
    }

    struct HolidayData: Codable {
        let id: UUID
        let date: Date
        let name: String
    }

    struct SpesenData: Codable {
        let id: UUID
        let date: Date
        let title: String
        let amount: Double
    }

    struct WeeklySollData: Codable {
        let id: UUID
        let year: Int
        let weekNumber: Int
        let moSoll: Double
        let diSoll: Double
        let miSoll: Double
        let doSoll: Double
        let frSoll: Double
        let saSoll: Double
        let soSoll: Double
    }

    struct SettingsData: Codable {
        let userName: String
        let userLastName: String
        let entryDate: Double
        let workLocationName: String
        let workLocationLat: Double
        let workLocationLon: Double
        let workGeofenceRadius: Double
        let isGeofenceEnabled: Bool
        let sollMo: Double
        let sollDi: Double
        let sollMi: Double
        let sollDo: Double
        let sollFr: Double
        let sollSa: Double
        let sollSo: Double
    }
}

// MARK: - Service

@MainActor
@Observable
final class BackupRestoreService {
    var isWorking = false
    var errorMessage: String?
    var successMessage: String?

    // Returns the backup file URL for sharing
    func createBackup(context: ModelContext) async -> URL? {
        isWorking = true
        errorMessage = nil
        successMessage = nil
        defer { isWorking = false }

        do {
            let backup = try gatherBackup(from: context)
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            let data = try encoder.encode(backup)

            let formatter = DateFormatter()
            formatter.dateFormat = "yyyy-MM-dd_HH-mm"
            let filename = "Zeiterfassung_Backup_\(formatter.string(from: Date())).zeitbackup"
            let url = FileManager.default.temporaryDirectory.appendingPathComponent(filename)
            try data.write(to: url, options: .atomic)

            successMessage = "\(backup.workEntries.count) Einträge gesichert"
            return url
        } catch {
            errorMessage = error.localizedDescription
            return nil
        }
    }

    func restoreBackup(from url: URL, context: ModelContext) async {
        isWorking = true
        errorMessage = nil
        successMessage = nil
        defer { isWorking = false }

        let accessed = url.startAccessingSecurityScopedResource()
        defer { if accessed { url.stopAccessingSecurityScopedResource() } }

        do {
            let data = try Data(contentsOf: url)
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            let backup = try decoder.decode(AppBackup.self, from: data)

            try context.delete(model: WorkEntry.self)
            try context.delete(model: Holiday.self)
            try context.delete(model: SpesenEintrag.self)
            try context.delete(model: WeeklySoll.self)

            for e in backup.workEntries {
                context.insert(WorkEntry(
                    id: e.id, startTime: e.startTime, endTime: e.endTime,
                    startLoc: e.startLoc, endLoc: e.endLoc,
                    pauseMinutes: e.pauseMinutes,
                    isVacation: e.isVacation, isSick: e.isSick,
                    isOvertimeReduction: e.isOvertimeReduction,
                    overtimeReductionHours: e.overtimeReductionHours,
                    isLocked: e.isLocked, lockedAt: e.lockedAt
                ))
            }
            for h in backup.holidays {
                context.insert(Holiday(id: h.id, date: h.date, name: h.name))
            }
            for s in backup.spesenEintraege {
                context.insert(SpesenEintrag(id: s.id, date: s.date, title: s.title, amount: s.amount))
            }
            for w in backup.weeklySolls {
                context.insert(WeeklySoll(
                    id: w.id, year: w.year, weekNumber: w.weekNumber,
                    moSoll: w.moSoll, diSoll: w.diSoll, miSoll: w.miSoll,
                    doSoll: w.doSoll, frSoll: w.frSoll, saSoll: w.saSoll, soSoll: w.soSoll
                ))
            }

            try context.save()
            applySettings(backup.settings)
            TrackingBridge.markDataChanged()

            let entryWord = backup.workEntries.count == 1 ? "Eintrag" : "Einträge"
            successMessage = "\(backup.workEntries.count) \(entryWord) wiederhergestellt"
        } catch {
            errorMessage = "Fehler: \(error.localizedDescription)"
        }
    }

    // MARK: - Private

    private func gatherBackup(from context: ModelContext) throws -> AppBackup {
        let entries  = try context.fetch(FetchDescriptor<WorkEntry>())
        let holidays = try context.fetch(FetchDescriptor<Holiday>())
        let spesen   = try context.fetch(FetchDescriptor<SpesenEintrag>())
        let solls    = try context.fetch(FetchDescriptor<WeeklySoll>())

        let ud  = UserDefaults.standard
        let sud = UserDefaults.sharedGroup

        let settings = AppBackup.SettingsData(
            userName:          sud.string(forKey: SharedDefaults.userName) ?? "",
            userLastName:      sud.string(forKey: SharedDefaults.userLastName) ?? "",
            entryDate:         sud.double(forKey: SharedDefaults.entryDate),
            workLocationName:  ud.string(forKey: SharedDefaults.workLocationName) ?? "",
            workLocationLat:   (ud.object(forKey: SharedDefaults.workLocationLat)  as? Double) ?? 47.5135,
            workLocationLon:   (ud.object(forKey: SharedDefaults.workLocationLon)  as? Double) ?? 7.5564,
            workGeofenceRadius:(ud.object(forKey: SharedDefaults.workGeofenceRadius) as? Double) ?? 300,
            isGeofenceEnabled: sud.bool(forKey: SharedDefaults.isGeofenceEnabled),
            sollMo: ud.object(forKey: "sollMo") as? Double ?? 8.3,
            sollDi: ud.object(forKey: "sollDi") as? Double ?? 8.3,
            sollMi: ud.object(forKey: "sollMi") as? Double ?? 8.3,
            sollDo: ud.object(forKey: "sollDo") as? Double ?? 8.3,
            sollFr: ud.object(forKey: "sollFr") as? Double ?? 8.3,
            sollSa: ud.object(forKey: "sollSa") as? Double ?? 0,
            sollSo: ud.object(forKey: "sollSo") as? Double ?? 0
        )

        return AppBackup(
            createdAt: Date(),
            workEntries: entries.map {
                .init(id: $0.id, startTime: $0.startTime, endTime: $0.endTime,
                      startLoc: $0.startLoc, endLoc: $0.endLoc,
                      pauseMinutes: $0.pauseMinutes,
                      isVacation: $0.isVacation, isSick: $0.isSick,
                      isOvertimeReduction: $0.isOvertimeReduction,
                      overtimeReductionHours: $0.overtimeReductionHours,
                      isLocked: $0.isLocked, lockedAt: $0.lockedAt)
            },
            holidays: holidays.map {
                .init(id: $0.id, date: $0.date, name: $0.name)
            },
            spesenEintraege: spesen.map {
                .init(id: $0.id, date: $0.date, title: $0.title, amount: $0.amount)
            },
            weeklySolls: solls.map {
                .init(id: $0.id, year: $0.year, weekNumber: $0.weekNumber,
                      moSoll: $0.moSoll, diSoll: $0.diSoll, miSoll: $0.miSoll,
                      doSoll: $0.doSoll, frSoll: $0.frSoll, saSoll: $0.saSoll, soSoll: $0.soSoll)
            },
            settings: settings
        )
    }

    private func applySettings(_ s: AppBackup.SettingsData) {
        let ud  = UserDefaults.standard
        let sud = UserDefaults.sharedGroup

        if !s.userName.isEmpty     { sud.set(s.userName,     forKey: SharedDefaults.userName) }
        if !s.userLastName.isEmpty { sud.set(s.userLastName, forKey: SharedDefaults.userLastName) }
        if s.entryDate > 0         { sud.set(s.entryDate,    forKey: SharedDefaults.entryDate) }

        if !s.workLocationName.isEmpty { ud.set(s.workLocationName,  forKey: SharedDefaults.workLocationName) }
        if s.workLocationLat != 0      { ud.set(s.workLocationLat,   forKey: SharedDefaults.workLocationLat) }
        if s.workLocationLon != 0      { ud.set(s.workLocationLon,   forKey: SharedDefaults.workLocationLon) }
        if s.workGeofenceRadius > 0    { ud.set(s.workGeofenceRadius, forKey: SharedDefaults.workGeofenceRadius) }
        sud.set(s.isGeofenceEnabled, forKey: SharedDefaults.isGeofenceEnabled)

        ud.set(s.sollMo, forKey: "sollMo")
        ud.set(s.sollDi, forKey: "sollDi")
        ud.set(s.sollMi, forKey: "sollMi")
        ud.set(s.sollDo, forKey: "sollDo")
        ud.set(s.sollFr, forKey: "sollFr")
        ud.set(s.sollSa, forKey: "sollSa")
        ud.set(s.sollSo, forKey: "sollSo")
    }
}
