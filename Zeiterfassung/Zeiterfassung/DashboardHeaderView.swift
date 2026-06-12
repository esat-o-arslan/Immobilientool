//
//  DashboardHeaderView.swift
//  Zeiterfassung
//
//  Open-source template on 17.05.2026.
//

import SwiftUI

struct DashboardHeaderView: View {
    let ist: Double
    let soll: Double
    let date: Date
    
    var body: some View {
        VStack(spacing: 10) {
            Text("Wochenübersicht")
                .font(.subheadline)
                .foregroundColor(.secondary)
            
            HStack(spacing: 30) {
                VStack(spacing: 2) {
                    Text("IST")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text(String(format: "%.2f h", ist))
                        .font(.title3.bold())
                        .foregroundColor(.green)
                }
                
                VStack(spacing: 2) {
                    Text("SOLL")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text(String(format: "%.2f h", soll))
                        .font(.title3.bold())
                        .foregroundColor(.blue)
                }
                
                VStack(spacing: 2) {
                    Text("SALDO")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
                    let diff = ist - soll
                    Text(String(format: "%+.2f h", diff))
                        .font(.title3.bold())
                        .foregroundColor(diff >= 0 ? .green : .red)
                }
            }
        }
        .padding()
        .frame(maxWidth: .infinity)
        .background(Color(UIColor.secondarySystemGroupedBackground))
        .cornerRadius(16)
        .padding(.horizontal)
    }
}
