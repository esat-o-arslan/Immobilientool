//
//  AnalyticsView.swift
//  Zeiterfassung
//
//  Open-source template on 18.05.2026.
//

import SwiftUI
import SwiftData
import PDFKit

struct AnalyticsView: View {
    @Query(sort: \StoredDocument.date, order: .reverse) private var documents: [StoredDocument]
    @Query(sort: \SpesenEintrag.date, order: .reverse) private var expenses: [SpesenEintrag]

    @State private var selectedPDFData: Data?
    @State private var expandedYears: Set<Int> = []
    @State private var expandedMonths: Set<String> = []

    var body: some View {
        NavigationStack {
            List {
                if groupedYears.isEmpty {
                    Section {
                        ContentUnavailableView(
                            "Keine Auswertungen",
                            systemImage: "tray",
                            description: Text("Gespeicherte Monatsberichte, Jahresberichte und Spesen erscheinen hier.")
                        )
                    }
                } else {
                    ForEach(groupedYears, id: \.year) { yearGroup in
                        Section {
                            DisclosureGroup(
                                isExpanded: bindingForYear(yearGroup.year),
                                content: {
                                    ForEach(yearGroup.months, id: \.key) { monthGroup in
                                        DisclosureGroup(
                                            isExpanded: bindingForMonth(monthGroup.key),
                                            content: {
                                                if !monthGroup.documents.isEmpty {
                                                    documentCategorySection(
                                                        title: "Dokumente",
                                                        items: monthGroup.documents
                                                    )
                                                }

                                                if !monthGroup.expenses.isEmpty {
                                                    expenseCategorySection(
                                                        title: "Spesen",
                                                        items: monthGroup.expenses
                                                    )
                                                }
                                            },
                                            label: {
                                                HStack {
                                                    Text(monthTitle(month: monthGroup.month, year: yearGroup.year))
                                                    Spacer()
                                                    Text("\(monthGroup.documents.count + monthGroup.expenses.count)")
                                                        .foregroundColor(.secondary)
                                                }
                                            }
                                        )
                                    }
                                },
                                label: {
                                    HStack {
                                        Text(String(yearGroup.year))
                                            .font(.headline)
                                        Spacer()
                                        Text("\(yearGroup.totalCount)")
                                            .foregroundColor(.secondary)
                                    }
                                }
                            )
                        }
                    }
                }
            }
            .navigationTitle("Auswertungen")
            .sheet(item: pdfItemBinding) { item in
                PDFPreviewView(data: item.data, title: item.title)
            }
        }
    }

    private var groupedYears: [AnalyticsYearGroup] {
        let calendar = Calendar.current

        let expenseMapped: [AnalyticsMonthExpense] = expenses.map {
            AnalyticsMonthExpense(
                id: $0.id,
                date: $0.date,
                title: $0.title,
                amount: $0.amount,
                imageData: $0.image
            )
        }

        let allYears = Set(documents.map(\.year)).union(expenseMapped.map { calendar.component(.year, from: $0.date) })

        return allYears
            .sorted(by: >)
            .map { year in
                let monthsWithDocs = documents.filter { $0.year == year }.map(\.month)
                let monthsWithExpenses = expenseMapped
                    .filter { calendar.component(.year, from: $0.date) == year }
                    .map { calendar.component(.month, from: $0.date) }

                let allMonths = Set(monthsWithDocs).union(monthsWithExpenses)

                let monthGroups = allMonths
                    .sorted(by: >)
                    .map { month -> AnalyticsMonthGroup in
                        let monthDocs = documents
                            .filter { $0.year == year && $0.month == month }
                            .sorted { $0.date > $1.date }

                        let monthExpenses = expenseMapped
                            .filter {
                                calendar.component(.year, from: $0.date) == year &&
                                calendar.component(.month, from: $0.date) == month
                            }
                            .sorted { $0.date > $1.date }

                        return AnalyticsMonthGroup(
                            key: "\(year)-\(month)",
                            month: month,
                            documents: monthDocs,
                            expenses: monthExpenses
                        )
                    }

                return AnalyticsYearGroup(
                    year: year,
                    months: monthGroups,
                    totalCount: monthGroups.reduce(0) { $0 + $1.documents.count + $1.expenses.count }
                )
            }
    }

    @ViewBuilder
    private func documentCategorySection(title: String, items: [StoredDocument]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundColor(.secondary)
                .padding(.top, 4)

            ForEach(items) { doc in
                Button {
                    selectedPDFData = doc.fileData
                    selectedPDFTitle = doc.title
                } label: {
                    HStack {
                        Image(systemName: iconName(for: doc))
                            .foregroundColor(.blue)

                        VStack(alignment: .leading, spacing: 3) {
                            Text(doc.title)
                                .foregroundColor(.primary)

                            Text(doc.date.formatted(date: .abbreviated, time: .omitted))
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }

                        Spacer()

                        Text(typeLabel(for: doc))
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                .buttonStyle(.plain)
            }
        }
    }

    @ViewBuilder
    private func expenseCategorySection(title: String, items: [AnalyticsMonthExpense]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundColor(.secondary)
                .padding(.top, 6)

            ForEach(items) { expense in
                HStack {
                    if let imageData = expense.imageData, let uiImage = UIImage(data: imageData) {
                        Image(uiImage: uiImage)
                            .resizable()
                            .scaledToFill()
                            .frame(width: 42, height: 42)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                    } else {
                        Image(systemName: "receipt")
                            .foregroundColor(.orange)
                            .frame(width: 42, height: 42)
                    }

                    VStack(alignment: .leading, spacing: 3) {
                        Text(expense.title)

                        Text(expense.date.formatted(date: .abbreviated, time: .omitted))
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    Spacer()

                    Text(String(format: "CHF %.2f", expense.amount))
                        .foregroundColor(.secondary)
                }
            }
        }
    }

    @State private var selectedPDFTitle: String = ""

    private var pdfItemBinding: Binding<PDFPreviewItem?> {
        Binding<PDFPreviewItem?>(
            get: {
                guard let selectedPDFData else { return nil }
                return PDFPreviewItem(data: selectedPDFData, title: selectedPDFTitle)
            },
            set: { newValue in
                if newValue == nil {
                    selectedPDFData = nil
                    selectedPDFTitle = ""
                }
            }
        )
    }

    private func bindingForYear(_ year: Int) -> Binding<Bool> {
        Binding(
            get: { expandedYears.contains(year) },
            set: { isExpanded in
                if isExpanded {
                    expandedYears.insert(year)
                } else {
                    expandedYears.remove(year)
                }
            }
        )
    }

    private func bindingForMonth(_ key: String) -> Binding<Bool> {
        Binding(
            get: { expandedMonths.contains(key) },
            set: { isExpanded in
                if isExpanded {
                    expandedMonths.insert(key)
                } else {
                    expandedMonths.remove(key)
                }
            }
        )
    }

    private func monthTitle(month: Int, year: Int) -> String {
        let calendar = Calendar.current
        let date = calendar.date(from: DateComponents(year: year, month: month, day: 1)) ?? .now
        return date.formatted(.dateTime.month(.wide))
    }

    private func iconName(for doc: StoredDocument) -> String {
        switch doc.category {
        case "monthlyReport":
            return "doc.text"
        case "yearlyReport":
            return "doc.richtext"
        case "payslip":
            return "banknote"
        default:
            return "doc"
        }
    }

    private func typeLabel(for doc: StoredDocument) -> String {
        switch doc.category {
        case "monthlyReport":
            return "Monat"
        case "yearlyReport":
            return "Jahr"
        case "payslip":
            return "Lohn"
        default:
            return doc.type
        }
    }
}

private struct AnalyticsYearGroup {
    let year: Int
    let months: [AnalyticsMonthGroup]
    let totalCount: Int
}

private struct AnalyticsMonthGroup {
    let key: String
    let month: Int
    let documents: [StoredDocument]
    let expenses: [AnalyticsMonthExpense]
}

private struct AnalyticsMonthExpense: Identifiable {
    let id: UUID
    let date: Date
    let title: String
    let amount: Double
    let imageData: Data?
}

private struct PDFPreviewItem: Identifiable, Equatable {
    let id = UUID()
    let data: Data
    let title: String
}
