//
//  AddManualWorkView.swift
//  Zeiterfassung
//
//  Open-source template on 17.05.2026.
//

import SwiftUI
import SwiftData

struct AddManualWorkView: View {
    @Environment(\.modelContext) var modelContext
    @Environment(\.dismiss) var dismiss
    
    let preselectedDate: Date
    
    @State private var entryType: EntryType = .normal
    @State private var start: Date
    @State private var end: Date
    @State private var overtimeHours: Double = 4.0
    
    init(preselectedDate: Date = Date()) {
        self.preselectedDate = preselectedDate
        
        let isToday = Calendar.current.isDateInToday(preselectedDate)
        
        if isToday {
            // Heutiger Tag → aktuelle Uhrzeit
            _start = State(initialValue: preselectedDate)
            _end = State(initialValue: preselectedDate.addingTimeInterval(8.3 * 3600))
        } else {
            // Vergangener Tag → Standard 08:00 Uhr
            let startOfDay = Calendar.current.startOfDay(for: preselectedDate)
            let eightAM = Calendar.current.date(bySettingHour: 8, minute: 0, second: 0, of: startOfDay) ?? startOfDay
            
            _start = State(initialValue: eightAM)
            _end = State(initialValue: eightAM.addingTimeInterval(8.3 * 3600))
        }
    }
    
    enum EntryType: String, CaseIterable, Identifiable {
        case normal = "Normale Arbeitszeit"
        case vacation = "Urlaubstag"
        case sick = "Krankheitstag"
        case overtimeReduction = "Überstundenabbau"
        
        var id: String { rawValue }
    }
    
    var body: some View {
        NavigationStack {
            Form {
                Picker("Eintragstyp", selection: $entryType) {
                    ForEach(EntryType.allCases) { type in
                        Text(type.rawValue).tag(type)
                    }
                }
                .pickerStyle(.inline)
                
                if entryType == .normal {
                    DatePicker("Startzeit", selection: $start)
                    DatePicker("Endzeit", selection: $end)
                } else if entryType == .overtimeReduction {
                    Stepper(value: $overtimeHours, in: 0.5...12.0, step: 0.5) {
                        HStack {
                            Text("Stunden abbauen")
                            Spacer()
                            Text("\(overtimeHours, specifier: "%.1f") h")
                                .foregroundColor(.purple)
                                .fontWeight(.semibold)
                        }
                    }
                }
            }
            .navigationTitle("Manueller Eintrag")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Sichern") {
                        let newEntry = WorkEntry(
                            startTime: start,
                            endTime: entryType == .normal ? end : start,
                            isVacation: entryType == .vacation,
                            isSick: entryType == .sick,
                            isOvertimeReduction: entryType == .overtimeReduction,
                            overtimeReductionHours: entryType == .overtimeReduction ? overtimeHours : 0.0
                        )
                        modelContext.insert(newEntry)
                        try? modelContext.save()
                        TrackingBridge.markDataChanged()
                        dismiss()
                    }
                }
            }
        }
    }
}
