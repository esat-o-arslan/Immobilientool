// Immobilientool – Urlaub Views
// Antrag-Zeile und Antrag-stellen-Sheet

import SwiftUI

// MARK: - Antrag-Zeile in VacationSettingsView

struct PortalUrlaubAntragZeile: View {
    let antrag: PortalUrlaubsAntrag

    private var statusFarbe: Color {
        switch antrag.status {
        case "Genehmigt": return .green
        case "Abgelehnt": return .red
        default: return .orange
        }
    }

    private var statusIcon: String {
        switch antrag.status {
        case "Genehmigt": return "checkmark.circle.fill"
        case "Abgelehnt": return "xmark.circle.fill"
        default: return "clock.fill"
        }
    }

    private var typIcon: String {
        switch antrag.typ {
        case "Krank": return "🤒"
        case "Überzeitabbau": return "⏱"
        default: return "🌴"
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(typIcon).font(.title3)
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(antrag.typ) · \(antrag.startDatum) – \(antrag.endDatum)")
                        .font(.subheadline.weight(.semibold))
                    if let tage = antrag.anzahlTage {
                        Text("\(tage, specifier: "%.0f") Arbeitstage")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer()
                Label(antrag.status, systemImage: statusIcon)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(statusFarbe)
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    .background(statusFarbe.opacity(0.12))
                    .clipShape(Capsule())
            }

            if let notiz = antrag.genehmigungsNotiz, !notiz.isEmpty {
                HStack(alignment: .top, spacing: 6) {
                    Image(systemName: antrag.status == "Abgelehnt" ? "exclamationmark.triangle.fill" : "info.circle.fill")
                        .font(.caption)
                        .foregroundStyle(statusFarbe)
                    Text(notiz)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding(8)
                .background(statusFarbe.opacity(0.06))
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }

            if let von = antrag.genehmigtVon, !von.isEmpty {
                Text(antrag.status == "Abgelehnt" ? "Abgelehnt von \(von)" : "Genehmigt von \(von)")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Neuer Antrag Sheet

struct PortalUrlaubAntragView: View {
    let urlaubManager: PortalUrlaubManager
    @Environment(\.dismiss) private var dismiss

    @State private var startDatum = Date()
    @State private var endDatum = Date()
    @State private var typ = "Ferien"
    @State private var beschreibung = ""
    @State private var isLoading = false
    @State private var fehler: String?

    private let typen = ["Ferien", "Krank", "Überzeitabbau", "Sonstiges"]

    private var tage: Double {
        urlaubManager.berechneWerktage(start: startDatum, end: endDatum)
    }

    private var datumFormatter: DateFormatter {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; return f
    }

    var body: some View {
        NavigationStack {
            Form {
                Section(header: Text("Urlaubsart")) {
                    Picker("Typ", selection: $typ) {
                        ForEach(typen, id: \.self) { Text($0) }
                    }
                    .pickerStyle(.segmented)
                }

                Section(header: Text("Zeitraum")) {
                    DatePicker("Von", selection: $startDatum, displayedComponents: .date)
                        .environment(\.locale, Locale(identifier: "de_CH"))
                    DatePicker("Bis (inkl.)", selection: $endDatum, in: startDatum..., displayedComponents: .date)
                        .environment(\.locale, Locale(identifier: "de_CH"))
                    HStack {
                        Text("Arbeitstage")
                        Spacer()
                        Text("\(tage, specifier: "%.0f") Tage")
                            .fontWeight(.semibold)
                            .foregroundStyle(.blue)
                    }
                }

                Section(header: Text("Bemerkung (optional)")) {
                    TextField("Kurze Beschreibung …", text: $beschreibung, axis: .vertical)
                        .lineLimit(3)
                }

                if let f = fehler {
                    Section {
                        Label(f, systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(.red)
                            .font(.caption)
                    }
                }

                Section {
                    Button {
                        Task { await stellen() }
                    } label: {
                        HStack {
                            if isLoading { ProgressView().scaleEffect(0.85) }
                            Text(isLoading ? "Wird gesendet …" : "Antrag einreichen")
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isLoading || tage <= 0)
                }

                Section(footer: Text("Der Antrag wird zur Genehmigung an HR / Geschäftsführung weitergeleitet.")) {
                    EmptyView()
                }
            }
            .navigationTitle("Urlaub beantragen")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { dismiss() }
                }
            }
        }
    }

    private func stellen() async {
        isLoading = true
        fehler = nil
        do {
            try await urlaubManager.stelleAntrag(
                start: datumFormatter.string(from: startDatum),
                end: datumFormatter.string(from: endDatum),
                tage: tage,
                typ: typ,
                beschreibung: beschreibung.trimmingCharacters(in: .whitespaces)
            )
            dismiss()
        } catch {
            fehler = error.localizedDescription
        }
        isLoading = false
    }
}
