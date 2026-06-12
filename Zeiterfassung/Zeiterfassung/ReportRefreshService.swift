//
//  ReportRefreshService.swift
//  Zeiterfassung
//
//  Open-source template on 22.05.2026.
//

import Foundation
import SwiftData
import UIKit

@MainActor
enum ReportRefreshService {
    static func refreshStoredReports(
        modelContext: ModelContext,
        entries: [WorkEntry],
        holidays: [Holiday],
        firstName: String,
        lastName: String,
        logo: UIImage?,
        sollProvider: @escaping (Date) -> Double
    ) {
        let existingDocuments: [StoredDocument]

        do {
            existingDocuments = try modelContext.fetch(FetchDescriptor<StoredDocument>())
        } catch {
            print("Fehler beim Laden bestehender Reports: \(error)")
            return
        }

        let monthlyDocs = existingDocuments.filter { $0.category == "monthlyReport" }
        let yearlyDocs = existingDocuments.filter { $0.category == "yearlyReport" }

        for doc in monthlyDocs {
            let updatedURL = ExportManager.createMonthPDF(
                entries: entries,
                holidays: holidays,
                year: doc.year,
                month: doc.month,
                firstName: firstName,
                lastName: lastName,
                logo: logo,
                sollProvider: sollProvider
            )

            if let updatedData = try? Data(contentsOf: updatedURL) {
                doc.fileData = updatedData
                doc.date = Calendar.current.date(from: DateComponents(year: doc.year, month: doc.month, day: 1)) ?? doc.date
                doc.source = "autoRefresh"
            }
        }

        for doc in yearlyDocs {
            let updatedURL = ExportManager.createYearlyPDF(
                entries: entries,
                year: doc.year,
                firstName: firstName,
                lastName: lastName,
                logo: logo,
                sollProvider: sollProvider
            )

            if let updatedData = try? Data(contentsOf: updatedURL) {
                doc.fileData = updatedData
                doc.date = Calendar.current.date(from: DateComponents(year: doc.year, month: 1, day: 1)) ?? doc.date
                doc.source = "autoRefresh"
            }
        }

        do {
            try modelContext.save()
            TrackingBridge.markReportsRefreshed()
        } catch {
            print("Fehler beim Aktualisieren gespeicherter Reports: \(error)")
        }
    }
}
