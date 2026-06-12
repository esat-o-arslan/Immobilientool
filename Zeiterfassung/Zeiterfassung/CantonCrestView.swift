//
//  CantonCrestView.swift
//  Zeiterfassung
//
//  Open-source template on 21.05.2026.
//

import SwiftUI

struct CantonCrestView: View {
    let canton: SalaryCalculatorView.SupportedCanton

    var body: some View {
        Image(assetName)
            .resizable()
            .interpolation(.high)
            .antialiased(true)
            .scaledToFit()
            .frame(width: 30, height: 36)
            .accessibilityLabel(Text(accessibilityName))
    }

    private var assetName: String {
        switch canton {
        case .baselLandschaft:
            return "canton_bl"
        case .baselStadt:
            return "canton_bs"
        case .aargau:
            return "canton_ag"
        case .solothurn:
            return "canton_so"
        }
    }

    private var accessibilityName: String {
        switch canton {
        case .baselLandschaft:
            return "Wappen Basel-Landschaft"
        case .baselStadt:
            return "Wappen Basel-Stadt"
        case .aargau:
            return "Wappen Aargau"
        case .solothurn:
            return "Wappen Solothurn"
        }
    }
}
