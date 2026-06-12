//
//  SalaryCalculatorProfile.swift
//  Zeiterfassung
//
//  Open-source template on 21.05.2026.
//

import Foundation

struct SalaryCalculatorProfile: Codable, Equatable {
    var cantonRawValue: String = "Basel-Landschaft"
    var civilStatusRawValue: String = "Ledig"
    var churchTaxApplies: Bool = false
    var childrenCount: Int = 0
    var useSuggestedTariff: Bool = true
    var manualTariffCodeRawValue: String = "A"

    var ahvPercent: Double = 5.3
    var alvPercent: Double = 1.10
    var nbuvPercent: Double = 1.009
    var ktgPercent: Double = 0.396

    var useBVGFixedCHF: Bool = true
    var bvgFixedCHF: Double = 0
    var bvgPercent: Double = 0

    static let `default` = SalaryCalculatorProfile()
}

enum SalaryProfileStorage {
    private static let key = "salaryCalculatorProfile"

    static func load() -> SalaryCalculatorProfile {
        guard
            let data = UserDefaults.standard.data(forKey: key),
            let profile = try? JSONDecoder().decode(SalaryCalculatorProfile.self, from: data)
        else {
            return .default
        }

        return profile
    }

    static func save(_ profile: SalaryCalculatorProfile) {
        guard let data = try? JSONEncoder().encode(profile) else { return }
        UserDefaults.standard.set(data, forKey: key)
    }
}
