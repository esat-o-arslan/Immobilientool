//
//  SalaryCalculatorView.swift
//  Zeiterfassung
//
//  Open-source template on 17.05.2026.
//

import SwiftUI

struct SalaryCalculatorView: View {
    @State private var monthlySalary: Double = 0
    @State private var thirteenthSalary: Double = 0
    @State private var bonus: Double = 0
    @State private var otherIncome: Double = 0

    @State private var thirteenthMode: ThirteenthMode = .monthly
    @State private var canton: SupportedCanton = .baselLandschaft
    @State private var civilStatus: CivilStatus = .single
    @State private var childrenCount: Int = 0
    @State private var churchTaxApplies: Bool = false

    @State private var useSuggestedTariff: Bool = true
    @State private var manualTariffCode: TariffCode = .A

    @State private var ahvPercent: Double = 5.3
    @State private var alvPercent: Double = 1.10
    @State private var nbuvPercent: Double = 1.009
    @State private var ktgPercent: Double = 0.396

    @State private var useBVGFixedCHF: Bool = true
    @State private var bvgFixedCHF: Double = 0
    @State private var bvgPercent: Double = 0

    @State private var focusedInput: InputField?
    @State private var didLoadProfile = false
    @State private var showProfileSheet = false
    @State private var expandQST = false
    @State private var expandSocial = false
    @State private var expandBVG = false
    @State private var expandBreakdown = false

    enum InputField: Hashable {
        case monthlySalary, thirteenthSalary, bonus, otherIncome
        case ahv, alv, nbuv, ktg, bvgFixedCHF, bvgPercent
    }

    enum ThirteenthMode: String, CaseIterable, Identifiable {
        case monthly = "Monatlich ausbezahlt"
        case yearly = "Einmalig ausbezahlt"
        var id: String { rawValue }
    }

    enum SupportedCanton: String, CaseIterable, Identifiable {
        case baselStadt = "Basel-Stadt"
        case baselLandschaft = "Basel-Landschaft"
        case aargau = "Aargau"
        var id: String { rawValue }
    }

    enum TariffCode: String, CaseIterable, Identifiable {
        case A, B, C, H
        var id: String { rawValue }

        var description: String {
            switch self {
            case .A: return "Alleinstehend"
            case .B: return "Verheiratet, 1 Einkommen"
            case .C: return "Verheiratet, 2 Einkommen"
            case .H: return "Alleinerziehend"
            }
        }
    }

    enum CivilStatus: String, CaseIterable, Identifiable {
        case single = "Ledig"
        case marriedSingleIncome = "Verheiratet, 1 Einkommen"
        case marriedDualIncome = "Verheiratet, 2 Einkommen"
        case singleParent = "Alleinerziehend"
        var id: String { rawValue }
    }

    private let alvAnnualCap: Double = 148_200

    private var activeTariffCode: TariffCode {
        useSuggestedTariff ? suggestedTariffCode : manualTariffCode
    }

    private var suggestedTariffCode: TariffCode {
        switch civilStatus {
        case .single: return .A
        case .marriedSingleIncome: return .B
        case .marriedDualIncome: return .C
        case .singleParent: return .H
        }
    }

    private var fullTaxCodePreview: String {
        "\(cantonPrefix(canton))\(activeTariffCode.rawValue)\(min(childrenCount, 9))\(churchTaxApplies ? "Y" : "N")"
    }

    private var yearlyGross: Double {
        (monthlySalary * 12) + thirteenthSalary + bonus + otherIncome
    }

    private var monthlyGrossForTax: Double {
        switch thirteenthMode {
        case .monthly:
            return monthlySalary + (thirteenthSalary / 12)
        case .yearly:
            return monthlySalary
        }
    }

    private var ahvDeduction: Double { yearlyGross * ahvPercent / 100 }
    private var alvDeduction: Double { min(yearlyGross, alvAnnualCap) * alvPercent / 100 }
    private var nbuvDeduction: Double { yearlyGross * nbuvPercent / 100 }
    private var ktgDeduction: Double { yearlyGross * ktgPercent / 100 }
    private var bvgDeduction: Double { useBVGFixedCHF ? bvgFixedCHF : yearlyGross * bvgPercent / 100 }

    private var monthlySourceTaxRate: Double {
        interpolatedSourceTaxRate(
            canton: canton,
            tariff: activeTariffCode,
            churchTax: churchTaxApplies,
            children: childrenCount,
            monthlyIncome: monthlyGrossForTax
        )
    }

    private var special13thRate: Double {
        interpolatedSourceTaxRate(
            canton: canton,
            tariff: activeTariffCode,
            churchTax: churchTaxApplies,
            children: childrenCount,
            monthlyIncome: monthlySalary + thirteenthSalary
        )
    }

    private var yearlySourceTax: Double {
        switch thirteenthMode {
        case .monthly:
            return yearlyGross * monthlySourceTaxRate / 100
        case .yearly:
            // Monat mit 13. Gehalt: Satz auf Gesamtzahlung (Monatslohn + 13. Gehalt)
            let decemberTax = (monthlySalary + thirteenthSalary) * special13thRate / 100
            // Übrige 11 Monate: regulärer Monatssatz
            let otherMonthsTax = monthlySalary * 11.0 * monthlySourceTaxRate / 100
            let extrasTax = (bonus + otherIncome) * monthlySourceTaxRate / 100
            return decemberTax + otherMonthsTax + extrasTax
        }
    }

    private var totalDeductions: Double {
        ahvDeduction + alvDeduction + nbuvDeduction + ktgDeduction + bvgDeduction + yearlySourceTax
    }

    private var yearlyNet: Double { yearlyGross - totalDeductions }

    private var monthlyNet: Double {
        switch thirteenthMode {
        case .monthly:
            return yearlyNet / 12
        case .yearly:
            let thirteenthNet = thirteenthSalary - (thirteenthSalary * special13thRate / 100)
            return (yearlyNet - thirteenthNet) / 12
        }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                // Header: Wappen + Kanton + Profil-Button
                headerCard

                // Einnahmen (nur Lohn)
                card("Einnahmen") {
                    VStack(spacing: 0) {
                        incomeDividerRow("Monatslohn", value: $monthlySalary, field: .monthlySalary)
                        incomeDividerRow("13. Monatslohn", value: $thirteenthSalary, field: .thirteenthSalary, last: true)
                    }
                }

                // Ergebnis
                resultCard

                // Abrechnung im Detail (aufklappbar)
                collapsibleCard(
                    title: "Abrechnung im Detail",
                    icon: "list.bullet.rectangle",
                    isExpanded: $expandBreakdown
                ) {
                    VStack(spacing: 6) {
                        breakdownRow("Bruttolohn / Jahr", yearlyGross)
                        Divider()
                        breakdownRow("AHV", -ahvDeduction)
                        breakdownRow("ALV", -alvDeduction)
                        breakdownRow("NBUV", -nbuvDeduction)
                        breakdownRow("KTG", -ktgDeduction)
                        breakdownRow("BVG", -bvgDeduction)
                        breakdownRow("Quellensteuer", -yearlySourceTax)
                        Divider()
                        breakdownRow("Total Abzüge", -totalDeductions)
                        breakdownRow("Nettolohn / Jahr", yearlyNet, highlight: true)
                        breakdownRow("Nettolohn / Monat", monthlyNet, highlight: true)
                    }
                }
            }
            .padding()
            .padding(.bottom, 24)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("Lohnrechner")
        .navigationBarTitleDisplayMode(.inline)
        .scrollDismissesKeyboard(.interactively)
        .contentShape(Rectangle())
        .onTapGesture { focusedInput = nil }
        .onAppear {
            guard !didLoadProfile else { return }
            didLoadProfile = true
            applyProfile(SalaryProfileStorage.load())
        }
        .sheet(isPresented: $showProfileSheet) {
            SalaryProfileSheetView(
                canton: $canton,
                civilStatus: $civilStatus,
                childrenCount: $childrenCount,
                churchTaxApplies: $churchTaxApplies,
                useSuggestedTariff: $useSuggestedTariff,
                manualTariffCode: $manualTariffCode,
                thirteenthMode: $thirteenthMode,
                bonus: $bonus,
                otherIncome: $otherIncome,
                ahvPercent: $ahvPercent,
                alvPercent: $alvPercent,
                nbuvPercent: $nbuvPercent,
                ktgPercent: $ktgPercent,
                useBVGFixedCHF: $useBVGFixedCHF,
                bvgFixedCHF: $bvgFixedCHF,
                bvgPercent: $bvgPercent,
                onSave: { saveProfile() },
                onLoadDefault: { loadDefaultBLProfile() }
            )
        }
    }

    // MARK: - Header

    private var headerCard: some View {
        HStack(spacing: 14) {
            CantonCrestView(canton: canton)
                .frame(width: 52, height: 52)

            VStack(alignment: .leading, spacing: 2) {
                Text(canton.rawValue)
                    .font(.headline)
                Text(fullTaxCodePreview)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            Button {
                showProfileSheet = true
            } label: {
                Label("Profil", systemImage: "person.text.rectangle")
                    .font(.subheadline.weight(.semibold))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Color.blue.opacity(0.12))
                    .foregroundColor(.blue)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
        }
        .padding(16)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    // MARK: - Ergebnis

    private var resultCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Monatslohn netto")
                .font(.subheadline)
                .foregroundColor(.secondary)

            Text(formatCHF(monthlyNet))
                .font(.system(size: 40, weight: .bold, design: .rounded))
                .foregroundColor(monthlyNet > 0 ? .green : .primary)

            Divider()

            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Jahreslohn netto")
                        .font(.caption).foregroundColor(.secondary)
                    Text(formatCHF(yearlyNet))
                        .font(.subheadline.weight(.semibold))
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text("Total Abzüge")
                        .font(.caption).foregroundColor(.secondary)
                    Text(formatCHF(totalDeductions))
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(.orange)
                }
            }

            HStack(spacing: 8) {
                Text(fullTaxCodePreview)
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    .background(Color.purple.opacity(0.12))
                    .foregroundColor(.purple)
                    .clipShape(Capsule())
                Text(formatPercent(monthlySourceTaxRate) + " Quellensteuer")
                    .font(.caption).foregroundColor(.secondary)
                Spacer()
            }
        }
        .padding(16)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    // MARK: - Helpers

    private func card<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.headline)
            content()
        }
        .padding(16)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private func collapsibleCard<Content: View>(
        title: String,
        icon: String,
        isExpanded: Binding<Bool>,
        @ViewBuilder content: @escaping () -> Content
    ) -> some View {
        VStack(spacing: 0) {
            DisclosureGroup(isExpanded: isExpanded) {
                Divider().padding(.top, 10)
                content()
                    .padding(.top, 8)
            } label: {
                Label(title, systemImage: icon)
                    .font(.headline)
                    .foregroundColor(.primary)
            }
        }
        .padding(16)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private func incomeDividerRow(_ title: String, value: Binding<Double>, field: InputField, last: Bool = false) -> some View {
        VStack(spacing: 0) {
            HStack {
                Text(title).font(.subheadline)
                Spacer()
                FormattedNumberField(
                    title: title,
                    value: value,
                    formatter: editableDotFormatter,
                    keyboardType: .decimalPad,
                    allowsDecimal: true,
                    isFocused: Binding(
                        get: { focusedInput == field },
                        set: { focusedInput = $0 ? field : nil }
                    )
                )
                .frame(width: 110)
                Text("CHF").font(.subheadline).foregroundColor(.secondary)
            }
            .padding(.vertical, 10)
            if !last { Divider() }
        }
    }

    private func percentDividerRow(_ title: String, value: Binding<Double>, field: InputField, last: Bool = false) -> some View {
        VStack(spacing: 0) {
            HStack {
                Text(title).font(.subheadline)
                Spacer()
                FormattedNumberField(
                    title: title,
                    value: value,
                    formatter: editableDotFormatter,
                    keyboardType: .decimalPad,
                    allowsDecimal: true,
                    isFocused: Binding(
                        get: { focusedInput == field },
                        set: { focusedInput = $0 ? field : nil }
                    )
                )
                .frame(width: 80)
                Text("%").font(.subheadline).foregroundColor(.secondary)
            }
            .padding(.vertical, 10)
            if !last { Divider() }
        }
    }

    private func infoRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).foregroundColor(.secondary)
            Spacer()
            Text(value)
        }
        .font(.subheadline)
    }

    private func breakdownRow(_ title: String, _ value: Double, highlight: Bool = false) -> some View {
        HStack {
            Text(title)
                .font(.subheadline)
                .fontWeight(highlight ? .semibold : .regular)
            Spacer()
            Text(formatCHF(value))
                .font(.subheadline)
                .fontWeight(highlight ? .semibold : .regular)
                .foregroundColor(highlight ? (value >= 0 ? .green : .orange) : .primary)
        }
    }

    private func currencyRow(_ title: String, value: Binding<Double>, field: InputField) -> some View {
        HStack {
            Text(title)
            Spacer()

            FormattedNumberField(
                title: title,
                value: value,
                formatter: editableDotFormatter,
                keyboardType: .decimalPad,
                allowsDecimal: true,
                isFocused: Binding(
                    get: { focusedInput == field },
                    set: { focusedInput = $0 ? field : nil }
                )
            )
            .frame(width: 120)

            Text("CHF")
                .foregroundColor(.secondary)
        }
    }

    private func percentRow(_ title: String, value: Binding<Double>, field: InputField) -> some View {
        HStack {
            Text(title)
            Spacer()

            FormattedNumberField(
                title: title,
                value: value,
                formatter: editableDotFormatter,
                keyboardType: .decimalPad,
                allowsDecimal: true,
                isFocused: Binding(
                    get: { focusedInput == field },
                    set: { focusedInput = $0 ? field : nil }
                )
            )
            .frame(width: 90)

            Text("%")
                .foregroundColor(.secondary)
        }
    }

    private func saveProfile() {
        let profile = SalaryCalculatorProfile(
            cantonRawValue: canton.rawValue,
            civilStatusRawValue: civilStatus.rawValue,
            churchTaxApplies: churchTaxApplies,
            childrenCount: childrenCount,
            useSuggestedTariff: useSuggestedTariff,
            manualTariffCodeRawValue: manualTariffCode.rawValue,
            ahvPercent: ahvPercent,
            alvPercent: alvPercent,
            nbuvPercent: nbuvPercent,
            ktgPercent: ktgPercent,
            useBVGFixedCHF: useBVGFixedCHF,
            bvgFixedCHF: bvgFixedCHF,
            bvgPercent: bvgPercent
        )

        SalaryProfileStorage.save(profile)
        focusedInput = nil
    }

    private func loadDefaultBLProfile() {
        applyProfile(.default)
        saveProfile()
    }

    private func applyProfile(_ profile: SalaryCalculatorProfile) {
        canton = SupportedCanton(rawValue: profile.cantonRawValue) ?? .baselLandschaft
        civilStatus = CivilStatus(rawValue: profile.civilStatusRawValue) ?? .single
        churchTaxApplies = profile.churchTaxApplies
        childrenCount = profile.childrenCount
        useSuggestedTariff = profile.useSuggestedTariff
        manualTariffCode = TariffCode(rawValue: profile.manualTariffCodeRawValue) ?? .A
        ahvPercent = profile.ahvPercent
        alvPercent = profile.alvPercent
        nbuvPercent = profile.nbuvPercent
        ktgPercent = profile.ktgPercent
        useBVGFixedCHF = profile.useBVGFixedCHF
        bvgFixedCHF = profile.bvgFixedCHF
        bvgPercent = profile.bvgPercent
    }

    private func cantonPrefix(_ canton: SupportedCanton) -> String {
        switch canton {
        case .baselStadt: return "BS"
        case .baselLandschaft: return "BL"
        case .aargau: return "AG"
        }
    }

    private func interpolatedSourceTaxRate(
        canton: SupportedCanton,
        tariff: TariffCode,
        churchTax: Bool,
        children: Int,
        monthlyIncome: Double
    ) -> Double {
        let curve = taxCurve(for: canton, tariff: tariff, churchTax: churchTax)

        if monthlyIncome <= curve[0].income {
            return max(curve[0].rate - childReduction(for: tariff, children: children), 0)
        }

        for index in 0..<(curve.count - 1) {
            let lower = curve[index]
            let upper = curve[index + 1]

            if monthlyIncome >= lower.income && monthlyIncome <= upper.income {
                let fraction = (monthlyIncome - lower.income) / (upper.income - lower.income)
                let rate = lower.rate + (upper.rate - lower.rate) * fraction
                return max(rate - childReduction(for: tariff, children: children), 0)
            }
        }

        return max((curve.last?.rate ?? 0) - childReduction(for: tariff, children: children), 0)
    }

    private func childReduction(for tariff: TariffCode, children: Int) -> Double {
        let cappedChildren = min(children, 9)
        let factor: Double = tariff == .H ? 0.18 : 0.12
        return Double(cappedChildren) * factor
    }

    // Quellensteuer 2026 – offizielle ESTV-Tarife (tar26bl/bs/ag.zip).
    // Monatliches Bruttoeinkommen in CHF → Steuersatz in %.
    // Tarif H basiert auf H1N (1 Kind) gemäss ESTV-Nomenklatur.
    private func taxCurve(
        for canton: SupportedCanton,
        tariff: TariffCode,
        churchTax: Bool
    ) -> [(income: Double, rate: Double)] {
        let incomes: [Double] = [
            0, 500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500,
            5000, 5500, 6000, 6500, 7000, 7500, 8000, 8500, 9000,
            9500, 10000, 11000, 12000, 14000, 16000
        ]

        let rates: [Double]

        switch (canton, tariff, churchTax) {

        // ── Basel-Landschaft ─────────────────────────────────────────────────
        case (.baselLandschaft, .A, false):
            rates = [0.0, 0.03, 0.07, 0.07, 0.15, 0.95, 2.38, 3.74, 5.09, 6.34,
                     7.52, 8.72, 9.78, 10.71, 11.56, 12.33, 13.05, 13.77, 14.5, 15.2,
                     15.85, 17.01, 18.11, 20.11, 21.82]
        case (.baselLandschaft, .A, true):
            rates = [0.0, 0.03, 0.07, 0.07, 0.15, 0.99, 2.48, 3.94, 5.32, 6.63,
                     7.88, 9.14, 10.22, 11.22, 12.1, 12.9, 13.64, 14.4, 15.17, 15.9,
                     16.56, 17.76, 18.9, 20.96, 22.73]
        case (.baselLandschaft, .B, false):
            rates = [0.0, 0.0, 0.0, 0.07, 0.1, 0.12, 0.6, 0.62, 0.67, 1.1,
                     1.89, 2.66, 3.42, 4.17, 4.94, 5.7, 6.45, 7.18, 7.86, 8.56,
                     9.21, 10.42, 11.54, 13.65, 15.68]
        case (.baselLandschaft, .B, true):
            rates = [0.0, 0.0, 0.0, 0.07, 0.1, 0.12, 0.6, 0.65, 0.7, 1.15,
                     1.97, 2.77, 3.57, 4.35, 5.15, 5.97, 6.75, 7.5, 8.21, 8.93,
                     9.62, 10.88, 12.04, 14.24, 16.32]
        case (.baselLandschaft, .C, false):
            rates = [0.0, 0.07, 0.13, 0.2, 0.3, 0.99, 2.31, 3.74, 5.14, 6.5,
                     7.84, 9.09, 10.06, 10.64, 11.2, 11.75, 12.25, 12.75, 13.23, 13.7,
                     14.15, 15.06, 15.97, 17.93, 19.61]
        case (.baselLandschaft, .C, true):
            rates = [0.0, 0.07, 0.13, 0.2, 0.3, 1.03, 2.41, 3.91, 5.37, 6.78,
                     8.2, 9.48, 10.51, 11.11, 11.7, 12.27, 12.79, 13.31, 13.81, 14.3,
                     14.76, 15.7, 16.64, 18.66, 20.38]
        case (.baselLandschaft, .H, false):
            rates = [0.0, 0.03, 0.07, 0.07, 0.15, 0.16, 0.17, 0.17, 0.2, 0.2,
                     0.2, 1.03, 1.91, 2.73, 3.57, 4.43, 5.28, 6.09, 6.85, 7.59,
                     8.3, 9.59, 10.78, 12.98, 15.03]
        case (.baselLandschaft, .H, true):
            rates = [0.0, 0.03, 0.07, 0.07, 0.15, 0.16, 0.17, 0.17, 0.2, 0.2,
                     0.2, 1.09, 1.99, 2.87, 3.74, 4.64, 5.53, 6.37, 7.16, 7.93,
                     8.68, 10.01, 11.25, 13.55, 15.66]

        // ── Basel-Stadt ──────────────────────────────────────────────────────
        case (.baselStadt, .A, false):
            rates = [0.0, 0.0, 0.0, 0.0, 0.0, 0.1, 2.1, 4.47, 6.22, 7.62,
                     8.76, 9.79, 10.67, 11.42, 12.05, 12.63, 13.13, 13.64, 14.17, 14.67,
                     15.1, 15.88, 16.62, 17.98, 19.18]
        case (.baselStadt, .A, true):
            rates = [0.0, 0.0, 0.0, 0.0, 0.0, 0.1, 2.25, 4.81, 6.69, 8.2,
                     9.43, 10.53, 11.47, 12.27, 12.94, 13.55, 14.09, 14.63, 15.18, 15.71,
                     16.16, 16.98, 17.74, 19.16, 20.39]
        case (.baselStadt, .B, false):
            rates = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.1,
                     0.63, 2.26, 3.64, 4.84, 5.88, 6.85, 7.71, 8.45, 9.13, 9.78,
                     10.35, 11.4, 12.31, 14.0, 15.57]
        case (.baselStadt, .B, true):
            rates = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.1,
                     0.66, 2.42, 3.91, 5.2, 6.32, 7.35, 8.27, 9.06, 9.79, 10.48,
                     11.09, 12.2, 13.17, 14.95, 16.59]
        case (.baselStadt, .C, false):
            rates = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.93, 4.29, 6.13, 7.63,
                     8.9, 9.99, 10.92, 11.64, 12.31, 12.88, 13.42, 13.91, 14.35, 14.78,
                     15.18, 15.92, 16.65, 18.23, 19.49]
        case (.baselStadt, .C, true):
            rates = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 2.09, 4.63, 6.6, 8.21,
                     9.56, 10.73, 11.72, 12.48, 13.2, 13.81, 14.37, 14.9, 15.36, 15.81,
                     16.23, 17.01, 17.77, 19.4, 20.7]
        case (.baselStadt, .H, false):
            rates = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
                     0.66, 2.22, 3.54, 4.67, 5.65, 6.6, 7.48, 8.23, 8.92, 9.56,
                     10.14, 11.19, 12.11, 13.8, 15.34]
        case (.baselStadt, .H, true):
            rates = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
                     0.71, 2.39, 3.83, 5.04, 6.1, 7.12, 8.05, 8.86, 9.59, 10.27,
                     10.89, 12.0, 12.98, 14.76, 16.35]

        // ── Aargau ───────────────────────────────────────────────────────────
        case (.aargau, .A, false):
            rates = [0.0, 0.0, 0.0, 0.0, 0.0, 0.9, 2.5, 3.6, 4.6, 5.6,
                     6.2, 7.0, 7.8, 8.5, 9.2, 9.8, 10.3, 10.9, 11.5, 12.1,
                     12.9, 13.7, 14.6, 16.2, 17.7]
        case (.aargau, .A, true):
            rates = [0.0, 0.0, 0.0, 0.0, 0.0, 0.9, 2.8, 3.9, 5.0, 6.1,
                     6.8, 7.6, 8.4, 9.2, 9.9, 10.6, 11.2, 11.8, 12.5, 13.1,
                     13.9, 14.8, 15.8, 17.5, 18.9]
        case (.aargau, .B, false):
            rates = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.3, 0.9, 1.4, 2.0,
                     2.6, 3.0, 3.6, 4.1, 4.7, 5.2, 5.8, 6.3, 6.8, 7.3,
                     8.0, 8.9, 9.8, 11.5, 13.2]
        case (.aargau, .B, true):
            rates = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.3, 1.0, 1.5, 2.1,
                     2.8, 3.3, 3.9, 4.4, 5.1, 5.7, 6.3, 6.8, 7.4, 7.9,
                     8.7, 9.7, 10.6, 12.4, 14.2]
        case (.aargau, .C, false):
            rates = [0.0, 0.0, 0.0, 0.0, 1.3, 2.3, 3.1, 4.0, 4.8, 5.5,
                     6.3, 7.1, 7.9, 8.4, 8.9, 9.3, 9.8, 10.2, 10.6, 11.0,
                     11.6, 12.3, 13.2, 14.9, 16.3]
        case (.aargau, .C, true):
            rates = [0.0, 0.0, 0.0, 0.0, 1.4, 2.6, 3.4, 4.3, 5.2, 6.0,
                     6.9, 7.7, 8.5, 9.1, 9.6, 10.1, 10.6, 11.0, 11.4, 11.9,
                     12.5, 13.3, 14.1, 15.9, 17.4]
        case (.aargau, .H, false):
            rates = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.1, 0.2, 0.7, 1.1,
                     1.5, 2.0, 2.5, 3.0, 3.5, 4.1, 4.6, 5.2, 5.7, 6.2,
                     6.9, 7.9, 8.8, 10.6, 12.3]
        case (.aargau, .H, true):
            rates = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.1, 0.2, 0.7, 1.2,
                     1.7, 2.2, 2.7, 3.3, 3.8, 4.4, 5.1, 5.6, 6.2, 6.8,
                     7.5, 8.6, 9.5, 11.4, 13.2]
        }

        return Array(zip(incomes, rates))
    }

    private var editableDotFormatter: NumberFormatter {
        let formatter = NumberFormatter()
        formatter.locale = Locale(identifier: "en_CH")
        formatter.numberStyle = .decimal
        formatter.usesGroupingSeparator = false
        formatter.decimalSeparator = "."
        formatter.maximumFractionDigits = 3
        formatter.minimumFractionDigits = 0
        return formatter
    }

    private func formatCHF(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.locale = Locale(identifier: "de_CH")
        formatter.numberStyle = .currency
        formatter.currencyCode = "CHF"
        formatter.maximumFractionDigits = 2
        formatter.minimumFractionDigits = 2
        return formatter.string(from: NSNumber(value: value)) ?? "CHF 0.00"
    }

    private func formatPercent(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.locale = Locale(identifier: "en_CH")
        formatter.numberStyle = .decimal
        formatter.maximumFractionDigits = 2
        formatter.minimumFractionDigits = 2
        formatter.decimalSeparator = "."
        formatter.groupingSeparator = ""
        return (formatter.string(from: NSNumber(value: value)) ?? "0.00") + " %"
    }
}

// MARK: - Profil-Sheet

struct SalaryProfileSheetView: View {
    @Binding var canton: SalaryCalculatorView.SupportedCanton
    @Binding var civilStatus: SalaryCalculatorView.CivilStatus
    @Binding var childrenCount: Int
    @Binding var churchTaxApplies: Bool
    @Binding var useSuggestedTariff: Bool
    @Binding var manualTariffCode: SalaryCalculatorView.TariffCode
    @Binding var thirteenthMode: SalaryCalculatorView.ThirteenthMode
    @Binding var bonus: Double
    @Binding var otherIncome: Double
    @Binding var ahvPercent: Double
    @Binding var alvPercent: Double
    @Binding var nbuvPercent: Double
    @Binding var ktgPercent: Double
    @Binding var useBVGFixedCHF: Bool
    @Binding var bvgFixedCHF: Double
    @Binding var bvgPercent: Double
    let onSave: () -> Void
    let onLoadDefault: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var focusedField: ProfileField?

    enum ProfileField: Hashable {
        case bonus, otherIncome, ahv, alv, nbuv, ktg, bvgFixed, bvgPct
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Einnahmen") {
                    Picker("Auszahlung 13. Gehalt", selection: $thirteenthMode) {
                        ForEach(SalaryCalculatorView.ThirteenthMode.allCases) { m in
                            Text(m.rawValue).tag(m)
                        }
                    }
                    chfRow("Bonus", value: $bonus, field: .bonus)
                    chfRow("Weitere Einnahmen", value: $otherIncome, field: .otherIncome)
                }

                Section("Steuerlicher Wohnsitz") {
                    Picker("Kanton", selection: $canton) {
                        ForEach(SalaryCalculatorView.SupportedCanton.allCases) { item in
                            Text(item.rawValue).tag(item)
                        }
                    }
                }

                Section("Persönliche Angaben") {
                    Picker("Zivilstand", selection: $civilStatus) {
                        ForEach(SalaryCalculatorView.CivilStatus.allCases) { item in
                            Text(item.rawValue).tag(item)
                        }
                    }
                    Stepper(value: $childrenCount, in: 0...9) {
                        HStack {
                            Text("Kinder")
                            Spacer()
                            Text("\(childrenCount)").foregroundColor(.secondary)
                        }
                    }
                    Toggle("Kirchensteuerpflichtig", isOn: $churchTaxApplies)
                }

                Section("Quellensteuer-Tarif") {
                    Toggle("Tarif automatisch bestimmen", isOn: $useSuggestedTariff)
                    if !useSuggestedTariff {
                        Picker("Tarifcode", selection: $manualTariffCode) {
                            ForEach(SalaryCalculatorView.TariffCode.allCases) { code in
                                Text("\(code.rawValue) – \(code.description)").tag(code)
                            }
                        }
                    }
                }

                Section(header: Text("Sozialabzüge"), footer: Text("ALV wird nur bis CHF 148'200 Jahreslohn berechnet.")) {
                    pctRow("AHV", value: $ahvPercent, field: .ahv)
                    pctRow("ALV", value: $alvPercent, field: .alv)
                    pctRow("NBUV", value: $nbuvPercent, field: .nbuv)
                    pctRow("KTG", value: $ktgPercent, field: .ktg)
                }

                Section("BVG / Pensionskasse") {
                    Toggle("Als fixer CHF-Betrag", isOn: $useBVGFixedCHF)
                    if useBVGFixedCHF {
                        chfRow("BVG-Prämie", value: $bvgFixedCHF, field: .bvgFixed)
                    } else {
                        pctRow("BVG-Prämie", value: $bvgPercent, field: .bvgPct)
                    }
                }

                Section {
                    Button {
                        onSave()
                        dismiss()
                    } label: {
                        Label("Als Standard speichern", systemImage: "tray.and.arrow.down")
                    }
                    Button {
                        onLoadDefault()
                        dismiss()
                    } label: {
                        Label("BL-Standardwerte laden", systemImage: "arrow.counterclockwise")
                    }
                    .foregroundColor(.secondary)
                }
            }
            .navigationTitle("Profil")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fertig") { dismiss() }
                }
            }
        }
    }

    private func pctRow(_ title: String, value: Binding<Double>, field: ProfileField) -> some View {
        HStack {
            Text(title)
            Spacer()
            FormattedNumberField(
                title: title,
                value: value,
                formatter: dotFormatter,
                keyboardType: .decimalPad,
                allowsDecimal: true,
                isFocused: Binding(
                    get: { focusedField == field },
                    set: { focusedField = $0 ? field : nil }
                )
            )
            .frame(width: 80)
            Text("%").foregroundColor(.secondary)
        }
    }

    private func chfRow(_ title: String, value: Binding<Double>, field: ProfileField) -> some View {
        HStack {
            Text(title)
            Spacer()
            FormattedNumberField(
                title: title,
                value: value,
                formatter: dotFormatter,
                keyboardType: .decimalPad,
                allowsDecimal: true,
                isFocused: Binding(
                    get: { focusedField == field },
                    set: { focusedField = $0 ? field : nil }
                )
            )
            .frame(width: 100)
            Text("CHF").foregroundColor(.secondary)
        }
    }

    private var dotFormatter: NumberFormatter {
        let f = NumberFormatter()
        f.locale = Locale(identifier: "en_CH")
        f.numberStyle = .decimal
        f.usesGroupingSeparator = false
        f.decimalSeparator = "."
        f.maximumFractionDigits = 3
        f.minimumFractionDigits = 0
        return f
    }
}
