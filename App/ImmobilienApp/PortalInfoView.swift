//
//  PortalInfoView.swift
//  ImmobilienApp
//

import SwiftUI
import MapKit

struct PortalInfoView: View {
    @EnvironmentObject var syncManager: AWSDataSyncManager

    var sichtbareInhalte: [PortalInhalt] {
        syncManager.portalInhalte
            .filter { $0.sichtbar ?? true }
            .sorted { ($0.sortierung ?? 100) < ($1.sortierung ?? 100) }
    }

    var sichtbaresTeam: [Mitarbeiter] {
        syncManager.verfuegbareMitarbeiter.sorted { $0.name < $1.name }
    }

    var body: some View {
        NavigationStack {
            List {
                Section("Kontakt") {
                    Button { openMap() } label: { Label("Adresse in Karten öffnen", systemImage: "map.fill") }
                    Link(destination: URL(string: "tel://+41000000000")!) { Label("000 000 00 00 anrufen", systemImage: "phone.fill") }
                    Link(destination: URL(string: "mailto:info@example.invalid")!) { Label("E-Mail schreiben", systemImage: "envelope.fill") }
                    Link(destination: URL(string: "https://example.invalid")!) { Label("Webseite öffnen", systemImage: "safari.fill") }
                }

                Section("Informationen") {
                    ForEach(sichtbareInhalte) { info in
                        VStack(alignment: .leading, spacing: 5) {
                            Text(info.titel).bold()
                            if let inhalt = info.inhalt { Text(inhalt).foregroundColor(.secondary) }
                        }
                    }
                }

                Section("Unser Team") {
                    ForEach(sichtbaresTeam) { mitarbeiter in
                        HStack(spacing: 14) {
                            TeamAvatarView(mitarbeiter: mitarbeiter, initialen: initialen(mitarbeiter.name))
                            VStack(alignment: .leading, spacing: 3) {
                                Text(mitarbeiter.name).bold()
                                Text(mitarbeiter.funktion).font(.footnote).foregroundColor(.secondary)
                            }
                        }
                    }
                }
            }
            .portalPullToRefresh()
            .navigationTitle("Über Portal")
        }
    }

    private func initialen(_ name: String) -> String {
        name.split(separator: " ").prefix(2).compactMap { $0.first }.map(String.init).joined()
    }

    private func openMap() {
        let query = "Immobilientool Musterstrasse 1 4000 Basel".addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "Portal%20Immobilien"
        if let url = URL(string: "http://maps.apple.com/?q=\(query)") {
            UIApplication.shared.open(url)
        }
    }
}

private struct TeamAvatarView: View {
    let mitarbeiter: Mitarbeiter
    let initialen: String

    var body: some View {
        if let urlText = mitarbeiter.photoUrl, let url = URL(string: urlText), !urlText.isEmpty {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFill()
                default:
                    fallback
                }
            }
            .frame(width: 46, height: 46)
            .clipShape(Circle())
        } else {
            fallback
        }
    }

    private var fallback: some View {
        Circle()
            .fill(Color.blue.gradient)
            .frame(width: 46, height: 46)
            .overlay(Text(initialen).foregroundColor(.white).bold())
    }
}
