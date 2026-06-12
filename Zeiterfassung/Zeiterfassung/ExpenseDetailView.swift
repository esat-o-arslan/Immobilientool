//
//  ExpenseDetailView.swift
//  Zeiterfassung
//
//  Open-source template on 17.05.2026.
//

import SwiftUI
import SwiftData // <-- Das hat hier gefehlt!

struct ExpenseDetailView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @Bindable var expense: SpesenEintrag
    
    @State private var expenseTitle: String = ""
    @State private var amountString: String = ""
    
    var body: some View {
        NavigationStack {
            Form {
                Section(header: Text("Details")) {
                    TextField("Zweck / Name", text: $expenseTitle)
                    
                    HStack {
                        Text("Betrag (CHF)")
                        Spacer()
                        TextField("0.00", text: $amountString)
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.trailing)
                    }
                }
                
                if let imageData = expense.image, let uiImage = UIImage(data: imageData) {
                    Section(header: Text("Beleg")) {
                        Image(uiImage: uiImage)
                            .resizable()
                            .scaledToFit()
                            .frame(maxHeight: 300)
                            .cornerRadius(8)
                            .contextMenu {
                                ShareLink(item: Image(uiImage: uiImage), preview: SharePreview("Spesenbeleg", image: Image(uiImage: uiImage))) {
                                    Label("Beleg teilen", systemImage: "square.and.arrow.up")
                                }
                            }
                    }
                }
            }
            .navigationTitle("Spese bearbeiten")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Speichern") {
                        expense.title = expenseTitle
                        if let parsedAmount = Double(amountString.replacingOccurrences(of: ",", with: ".")) {
                            expense.amount = parsedAmount
                        }
                        do {
                            try modelContext.save()
                            TrackingBridge.markDataChanged()
                            dismiss()
                        } catch {
                            print("Fehler beim Speichern der Spese: \(error)")
                        }
                    }
                    .bold()
                }
                ToolbarItem(placement: .topBarTrailing) {
                    ShareLink(item: "\(expense.title): \(String(format: "%.2f", expense.amount)) CHF") {
                        Image(systemName: "square.and.arrow.up")
                    }
                }
            }
            .onAppear {
                expenseTitle = expense.title
                amountString = expense.amount > 0 ? String(format: "%.2f", expense.amount) : ""
            }
        }
    }
}
