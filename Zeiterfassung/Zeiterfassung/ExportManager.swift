//
//  ExportManager.swift
//  Zeiterfassung
//
//  Open-source template on 17.05.2026.
//

import SwiftUI
import PDFKit
import ImageIO

final class ExportManager {

    static func createMonthPDF(
        entries: [WorkEntry],
        holidays: [Holiday],
        year: Int,
        month: Int,
        firstName: String,
        lastName: String,
        logo: UIImage?,
        sollProvider: (Date) -> Double
    ) -> URL {
        let pdfMetaData = [
            kCGPDFContextCreator as String: "Portal-Immobilien Zeiterfassung",
            kCGPDFContextAuthor as String: "\(firstName) \(lastName)"
        ]

        let format = UIGraphicsPDFRendererFormat()
        format.documentInfo = pdfMetaData

        let pageWidth: CGFloat = 595.2
        let pageHeight: CGFloat = 841.8
        let bounds = CGRect(x: 0, y: 0, width: pageWidth, height: pageHeight)
        let renderer = UIGraphicsPDFRenderer(bounds: bounds, format: format)

        let url = FileManager.default.temporaryDirectory.appendingPathComponent("Auswertung_\(month)_\(year).pdf")

        let calendar = Calendar.current
        guard let monthStart = calendar.date(from: DateComponents(year: year, month: month, day: 1)),
              let range = calendar.range(of: .day, in: .month, for: monthStart) else {
            return url
        }

        try? renderer.writePDF(to: url) { context in
            var currentY: CGFloat = 40
            let left: CGFloat = 40

            func beginNewPage() {
                context.beginPage()
                currentY = 40

                if let logo {
                    logo.draw(in: CGRect(x: left, y: currentY, width: 140, height: 38))
                }

                let nameAttr: [NSAttributedString.Key: Any] = [
                    .font: UIFont.systemFont(ofSize: 11),
                    .foregroundColor: UIColor.secondaryLabel
                ]
                "\(firstName) \(lastName)".draw(at: CGPoint(x: 390, y: currentY + 8), withAttributes: nameAttr)

                currentY += 60

                let title = "Monatsauswertung \(String(format: "%02d", month))/\(year)"
                title.draw(at: CGPoint(x: left, y: currentY), withAttributes: [
                    .font: UIFont.boldSystemFont(ofSize: 18)
                ])

                currentY += 28

                let headers = ["Datum", "IST", "SOLL", "Diff", "Status", ""]
                let x: [CGFloat] = [40, 140, 225, 310, 395, 540]

                for (index, header) in headers.enumerated() {
                    header.draw(at: CGPoint(x: x[index], y: currentY), withAttributes: [
                        .font: UIFont.boldSystemFont(ofSize: 10)
                    ])
                }

                currentY += 18

                let path = UIBezierPath()
                path.move(to: CGPoint(x: 40, y: currentY))
                path.addLine(to: CGPoint(x: pageWidth - 40, y: currentY))
                UIColor.systemGray4.setStroke()
                path.lineWidth = 1
                path.stroke()

                currentY += 10
            }

            beginNewPage()

            let dateFormatter = DateFormatter()
            dateFormatter.dateFormat = "dd.MM.yyyy"

            var totalIst = 0.0
            var totalSoll = 0.0

            for day in range {
                guard let date = calendar.date(from: DateComponents(year: year, month: month, day: day)) else { continue }

                let daily = DailyExportCalculator.result(
                    for: date,
                    entries: entries,
                    holidays: holidays,
                    sollProvider: sollProvider
                )

                totalIst += daily.istHours
                totalSoll += daily.sollHours

                if currentY > 760 {
                    beginNewPage()
                }

                let diffColor: UIColor = daily.diffHours >= 0 ? .systemGreen : .systemRed
                let x: [CGFloat] = [40, 140, 225, 310, 395, 540]

                let dayEntries = entries.filter { Calendar.current.isDate($0.startTime, inSameDayAs: date) }
                let allLocked = !dayEntries.isEmpty && dayEntries.allSatisfy { $0.isLocked }
                let lockedDate = allLocked ? dayEntries.compactMap(\.lockedAt).max() : nil

                dateFormatter.string(from: date).draw(at: CGPoint(x: x[0], y: currentY), withAttributes: [
                    .font: UIFont.systemFont(ofSize: 9)
                ])

                String(format: "%.2f h", daily.istHours).draw(at: CGPoint(x: x[1], y: currentY), withAttributes: [
                    .font: UIFont.systemFont(ofSize: 9)
                ])

                String(format: "%.2f h", daily.sollHours).draw(at: CGPoint(x: x[2], y: currentY), withAttributes: [
                    .font: UIFont.systemFont(ofSize: 9)
                ])

                String(format: "%@%.2f h", daily.diffHours >= 0 ? "+" : "", daily.diffHours).draw(at: CGPoint(x: x[3], y: currentY), withAttributes: [
                    .font: UIFont.boldSystemFont(ofSize: 9),
                    .foregroundColor: diffColor
                ])

                daily.status.draw(at: CGPoint(x: x[4], y: currentY), withAttributes: [
                    .font: UIFont.systemFont(ofSize: 9)
                ])

                if allLocked {
                    let lockLabel = lockedDate.map { "F \($0.formatted(.dateTime.day().month()))" } ?? "F"
                    lockLabel.draw(at: CGPoint(x: x[5], y: currentY), withAttributes: [
                        .font: UIFont.systemFont(ofSize: 8),
                        .foregroundColor: UIColor.systemOrange
                    ])
                }

                currentY += 18
            }

            currentY += 20

            let summary = "Gesamt IST: \(String(format: "%.2f", totalIst)) h   |   SOLL: \(String(format: "%.2f", totalSoll)) h   |   Saldo: \(String(format: "%.2f", totalIst - totalSoll)) h"
            summary.draw(at: CGPoint(x: left, y: currentY), withAttributes: [
                .font: UIFont.boldSystemFont(ofSize: 11)
            ])

            let monthEntries = entries.filter {
                Calendar.current.component(.year, from: $0.startTime) == year &&
                Calendar.current.component(.month, from: $0.startTime) == month
            }
            let lockedCount = monthEntries.filter { $0.isLocked }.count
            if lockedCount > 0 {
                currentY += 16
                let allMonthLocked = lockedCount == monthEntries.count
                let latestLock = monthEntries.compactMap(\.lockedAt).max()
                let lockInfo: String
                if allMonthLocked, let d = latestLock {
                    lockInfo = "Vollständig festgeschrieben am \(d.formatted(date: .abbreviated, time: .shortened)) – Revisionssicher"
                } else {
                    lockInfo = "\(lockedCount) von \(monthEntries.count) Einträgen festgeschrieben"
                }
                lockInfo.draw(at: CGPoint(x: left, y: currentY), withAttributes: [
                    .font: UIFont.systemFont(ofSize: 9),
                    .foregroundColor: UIColor.systemOrange
                ])
            }
        }

        return url
    }

    static func createYearlyPDF(
        entries: [WorkEntry],
        year: Int,
        firstName: String,
        lastName: String,
        logo: UIImage?,
        sollProvider: (Date) -> Double
    ) -> URL {
        let pdfMetaData = [
            kCGPDFContextCreator as String: "Portal-Immobilien Zeiterfassung",
            kCGPDFContextAuthor as String: "\(firstName) \(lastName)"
        ]

        let format = UIGraphicsPDFRendererFormat()
        format.documentInfo = pdfMetaData

        let pageWidth: CGFloat = 595.2
        let pageHeight: CGFloat = 841.8
        let bounds = CGRect(x: 0, y: 0, width: pageWidth, height: pageHeight)
        let renderer = UIGraphicsPDFRenderer(bounds: bounds, format: format)

        let url = FileManager.default.temporaryDirectory.appendingPathComponent("Jahresauswertung_\(year).pdf")
        let calendar = Calendar.current

        try? renderer.writePDF(to: url) { context in
            context.beginPage()

            var currentY: CGFloat = 40

            if let logo {
                logo.draw(in: CGRect(x: 40, y: currentY, width: 140, height: 38))
            }

            "\(firstName) \(lastName)".draw(at: CGPoint(x: 390, y: currentY + 8), withAttributes: [
                .font: UIFont.systemFont(ofSize: 11),
                .foregroundColor: UIColor.secondaryLabel
            ])

            currentY += 60

            "Jahresauswertung \(year)".draw(at: CGPoint(x: 40, y: currentY), withAttributes: [
                .font: UIFont.boldSystemFont(ofSize: 18)
            ])

            currentY += 30

            let headers = ["Monat", "IST", "SOLL", "Saldo"]
            let x: [CGFloat] = [40, 180, 280, 380]
            for (index, header) in headers.enumerated() {
                header.draw(at: CGPoint(x: x[index], y: currentY), withAttributes: [
                    .font: UIFont.boldSystemFont(ofSize: 11)
                ])
            }

            currentY += 18

            var totalYearIst = 0.0
            var totalYearSoll = 0.0

            for month in 1...12 {
                guard let monthDate = calendar.date(from: DateComponents(year: year, month: month, day: 1)) else { continue }
                let monthEntries = entries.filter {
                    calendar.component(.year, from: $0.startTime) == year &&
                    calendar.component(.month, from: $0.startTime) == month
                }

                let daysRange = calendar.range(of: .day, in: .month, for: monthDate) ?? 1..<29
                var monthIst = 0.0
                var monthSoll = 0.0

                for day in daysRange {
                    guard let date = calendar.date(from: DateComponents(year: year, month: month, day: day)) else { continue }

                    let dayEntries = monthEntries.filter { calendar.isDate($0.startTime, inSameDayAs: date) }
                    let hasVacation = dayEntries.contains(where: { $0.isVacation })
                    let soll = sollProvider(date)

                    if hasVacation {
                        monthIst += soll
                    } else {
                        monthIst += Double(dayEntries.reduce(0) { $0 + $1.totalSeconds }) / 3600.0
                    }

                    monthSoll += soll
                }

                totalYearIst += monthIst
                totalYearSoll += monthSoll

                let name = monthDate.formatted(.dateTime.month(.wide))
                let diff = monthIst - monthSoll

                name.draw(at: CGPoint(x: x[0], y: currentY), withAttributes: [
                    .font: UIFont.systemFont(ofSize: 10)
                ])

                String(format: "%.2f h", monthIst).draw(at: CGPoint(x: x[1], y: currentY), withAttributes: [
                    .font: UIFont.systemFont(ofSize: 10)
                ])

                String(format: "%.2f h", monthSoll).draw(at: CGPoint(x: x[2], y: currentY), withAttributes: [
                    .font: UIFont.systemFont(ofSize: 10)
                ])

                String(format: "%@%.2f h", diff >= 0 ? "+" : "", diff).draw(at: CGPoint(x: x[3], y: currentY), withAttributes: [
                    .font: UIFont.boldSystemFont(ofSize: 10),
                    .foregroundColor: diff >= 0 ? UIColor.systemGreen : UIColor.systemRed
                ])

                currentY += 22
            }

            currentY += 24

            let summary = "Jahres-Saldo: \(String(format: "%.2f", totalYearIst - totalYearSoll)) h"
            summary.draw(at: CGPoint(x: 40, y: currentY), withAttributes: [
                .font: UIFont.boldSystemFont(ofSize: 12)
            ])
        }

        return url
    }

    static func createMonthCSV(
        entries: [WorkEntry],
        year: Int,
        month: Int,
        sollProvider: (Date) -> Double
    ) -> URL {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("Auswertung_\(month)_\(year).csv")
        let calendar = Calendar.current
        guard let monthStart = calendar.date(from: DateComponents(year: year, month: month, day: 1)),
              let range = calendar.range(of: .day, in: .month, for: monthStart) else {
            return url
        }

        var csv = "Datum;IST Stunden;SOLL Stunden;Saldo;Status\n"

        let formatter = DateFormatter()
        formatter.dateFormat = "dd.MM.yyyy"

        for day in range {
            guard let date = calendar.date(from: DateComponents(year: year, month: month, day: day)) else { continue }

            let daily = DailyExportCalculator.result(
                for: date,
                entries: entries,
                holidays: [],
                sollProvider: sollProvider
            )

            csv += "\(formatter.string(from: date));\(String(format: "%.2f", daily.istHours));\(String(format: "%.2f", daily.sollHours));\(String(format: "%.2f", daily.diffHours));\(daily.status)\n"
        }

        try? csv.write(to: url, atomically: true, encoding: .utf8)
        return url
    }

    static func createYearlyCSV(
        entries: [WorkEntry],
        year: Int,
        sollProvider: (Date) -> Double
    ) -> URL {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("Jahresauswertung_\(year).csv")
        let calendar = Calendar.current

        var csv = "Monat;IST Stunden;SOLL Stunden;Saldo\n"

        for month in 1...12 {
            guard let monthDate = calendar.date(from: DateComponents(year: year, month: month, day: 1)) else { continue }
            let monthEntries = entries.filter {
                calendar.component(.year, from: $0.startTime) == year &&
                calendar.component(.month, from: $0.startTime) == month
            }

            let daysRange = calendar.range(of: .day, in: .month, for: monthDate) ?? 1..<29
            var monthIst = 0.0
            var monthSoll = 0.0

            for day in daysRange {
                guard let date = calendar.date(from: DateComponents(year: year, month: month, day: day)) else { continue }
                let dayEntries = monthEntries.filter { calendar.isDate($0.startTime, inSameDayAs: date) }
                let hasVacation = dayEntries.contains(where: { $0.isVacation })
                let soll = sollProvider(date)

                if hasVacation {
                    monthIst += soll
                } else {
                    monthIst += Double(dayEntries.reduce(0) { $0 + $1.totalSeconds }) / 3600.0
                }

                monthSoll += soll
            }

            let monthName = monthDate.formatted(.dateTime.month(.wide))
            let saldo = monthIst - monthSoll
            csv += "\(monthName);\(String(format: "%.2f", monthIst));\(String(format: "%.2f", monthSoll));\(String(format: "%.2f", saldo))\n"
        }

        try? csv.write(to: url, atomically: true, encoding: .utf8)
        return url
    }
}
