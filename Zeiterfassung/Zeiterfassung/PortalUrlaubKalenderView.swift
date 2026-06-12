// Immobilientool – Team-Urlaubskalender
// Zeigt eigene und alle genehmigten Abwesenheiten im Monatskalender

import SwiftUI

struct PortalUrlaubKalenderView: View {
    let urlaubManager: PortalUrlaubManager
    @State private var anzeigeMonat: Int = Calendar.current.component(.month, from: Date()) - 1
    @State private var anzeigeJahr: Int  = Calendar.current.component(.year, from: Date())

    private let monatsnamen = ["Januar","Februar","März","April","Mai","Juni",
                                "Juli","August","September","Oktober","November","Dezember"]
    private let wochentage = ["Mo","Di","Mi","Do","Fr","Sa","So"]

    private var myEmail: String { UserDefaults.standard.portalEmail ?? "" }

    private var tageImMonat: Int {
        Calendar.current.range(of: .day, in: .month, for: ersterTag)!.count
    }
    private var ersterTag: Date {
        var c = DateComponents()
        c.year = anzeigeJahr; c.month = anzeigeMonat + 1; c.day = 1
        return Calendar.current.date(from: c)!
    }
    private var startWochentag: Int {
        (Calendar.current.component(.weekday, from: ersterTag) + 5) % 7
    }

    private func antraegeAnTag(_ ds: String) -> [PortalUrlaubsAntrag] {
        urlaubManager.alleAntraege.filter { a in
            a.status != "Abgelehnt" && a.startDatum <= ds && a.endDatum >= ds
        }
    }

    private func ds(_ tag: Int) -> String {
        String(format: "%04d-%02d-%02d", anzeigeJahr, anzeigeMonat + 1, tag)
    }

    private func personFarbe(_ name: String) -> Color {
        let colors: [Color] = [.blue, .green, .orange, .purple, .pink, .teal, .red]
        let idx = (Int(name.unicodeScalars.first?.value ?? 65) + Int(name.unicodeScalars.dropFirst().first?.value ?? 0)) % colors.count
        return colors[idx]
    }

    var body: some View {
        VStack(spacing: 0) {
            // Monat-Navigation
            HStack {
                Button { vorheriger() } label: { Image(systemName: "chevron.left").font(.title3) }
                Spacer()
                Text("\(monatsnamen[anzeigeMonat]) \(String(anzeigeJahr))")
                    .font(.headline)
                Spacer()
                Button { naechster() } label: { Image(systemName: "chevron.right").font(.title3) }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)

            // Wochentag-Header
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 2), count: 7), spacing: 2) {
                ForEach(wochentage, id: \.self) { d in
                    Text(d)
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 4)
                }

                // Leere Zellen + Tage in einem einzigen ForEach (verhindert ID-Konflikte)
                ForEach(0..<(startWochentag + tageImMonat), id: \.self) { index in
                    if index < startWochentag {
                        Color.clear.frame(height: 64)
                    } else {
                        let tag = index - startWochentag + 1
                        let tagStr = ds(tag)
                        let eintraege = antraegeAnTag(tagStr)
                        let heute = tagStr == {
                            let d = Date()
                            return String(format: "%04d-%02d-%02d",
                                         Calendar.current.component(.year, from: d),
                                         Calendar.current.component(.month, from: d),
                                         Calendar.current.component(.day, from: d))
                        }()
                        let istWE: Bool = {
                            let wd = Calendar.current.component(.weekday, from:
                                PortalUrlaubsAntrag.date(from: tagStr) ?? Date())
                            return wd == 1 || wd == 7
                        }()
                        let meineEintraege = eintraege.filter { ($0.email ?? "").lowercased() == myEmail.lowercased() }

                        VStack(spacing: 2) {
                            Text("\(tag)")
                                .font(.caption.weight(heute ? .black : .regular))
                                .foregroundStyle(heute ? Color.white : istWE ? Color.secondary : Color.primary)
                                .frame(width: 24, height: 24)
                                .background(heute ? Color.blue : Color.clear)
                                .clipShape(Circle())

                            if !meineEintraege.isEmpty {
                                Text("Ich")
                                    .font(.system(size: 8, weight: .semibold))
                                    .padding(.horizontal, 4).padding(.vertical, 1)
                                    .background(meineEintraege.first?.typ == "Krank" ? Color.red.opacity(0.2) : Color.green.opacity(0.2))
                                    .foregroundStyle(meineEintraege.first?.typ == "Krank" ? .red : .green)
                                    .clipShape(Capsule())
                            }

                            let andere = eintraege.filter { ($0.email ?? "").lowercased() != myEmail.lowercased() }
                            if !andere.isEmpty {
                                HStack(spacing: 2) {
                                    ForEach(andere.prefix(3)) { a in
                                        Circle()
                                            .fill(personFarbe(a.mitarbeiterName))
                                            .frame(width: 6, height: 6)
                                    }
                                    if andere.count > 3 {
                                        Text("+\(andere.count - 3)")
                                            .font(.system(size: 7))
                                            .foregroundStyle(.secondary)
                                    }
                                }
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 64)
                        .background(
                            meineEintraege.isEmpty
                                ? (istWE ? Color(UIColor.systemGroupedBackground) : Color(UIColor.secondarySystemGroupedBackground))
                                : (meineEintraege.first?.typ == "Krank" ? Color.red.opacity(0.08) : Color.green.opacity(0.08))
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                        .overlay(
                            heute ? RoundedRectangle(cornerRadius: 6).stroke(Color.blue, lineWidth: 1.5) : nil
                        )
                    }
                }
            }
            .padding(.horizontal, 8)
            .padding(.bottom, 8)

            // Legende
            HStack(spacing: 16) {
                Label("Eigene Ferien", systemImage: "circle.fill").font(.caption).foregroundStyle(.green)
                Label("Krank", systemImage: "circle.fill").font(.caption).foregroundStyle(.red)
                HStack(spacing: 4) {
                    Circle().fill(.blue).frame(width: 8, height: 8)
                    Text("Team").font(.caption).foregroundStyle(.secondary)
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 12)
        }
    }

    private func vorheriger() {
        if anzeigeMonat == 0 { anzeigeMonat = 11; anzeigeJahr -= 1 }
        else { anzeigeMonat -= 1 }
    }
    private func naechster() {
        if anzeigeMonat == 11 { anzeigeMonat = 0; anzeigeJahr += 1 }
        else { anzeigeMonat += 1 }
    }
}
