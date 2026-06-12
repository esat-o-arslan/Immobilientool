//
//  ZentralChatView.swift
//  ImmobilienApp
//
//  Open-source template on 18.05.2026.
//

import SwiftUI

struct ZentralChatView: View {
    @EnvironmentObject var syncManager: AWSDataSyncManager
    @State private var zeigeMitarbeiterAuswahl = false
    @State private var ausgewaehltesZiel: Mitarbeiter?

    var body: some View {
        NavigationStack {
            VStack {
                if syncManager.allgemeineChats.isEmpty {
                    Spacer()
                    ContentUnavailableView(
                        "Keine Chats",
                        systemImage: "bubble.left.and.bubble.right",
                        description: Text("Starte eine neue Unterhaltung mit dem Support-Team über das Stift-Symbol oben rechts.")
                    )
                    Spacer()
                } else {
                    List(syncManager.allgemeineChats) { chat in
                        if let mitarbeiter = syncManager.verfuegbareMitarbeiter.first(where: { $0.id == chat.mitarbeiterId }) {
                            NavigationLink(destination: AllgemeinerChatDetailView(mitarbeiter: mitarbeiter)) {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(mitarbeiter.name)
                                        .font(.headline)

                                    Text(mitarbeiter.funktion)
                                        .font(.caption)
                                        .foregroundColor(.blue)

                                    if let letzteMsg = chat.nachrichten.last {
                                        Text(letzteMsg.text)
                                            .font(.subheadline)
                                            .foregroundColor(.secondary)
                                            .lineLimit(1)
                                    }
                                }
                            }
                        }
                    }
                    .portalPullToRefresh()
                }
            }
            .navigationTitle("Support Chat")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        zeigeMitarbeiterAuswahl = true
                    } label: {
                        Image(systemName: "square.and.pencil")
                            .font(.title3)
                    }
                }
            }
            .sheet(isPresented: $zeigeMitarbeiterAuswahl) {
                MitarbeiterAuswahlView(ausgewaehltesZiel: $ausgewaehltesZiel)
                    .environmentObject(syncManager)
            }
            .navigationDestination(item: $ausgewaehltesZiel) { mitarbeiter in
                AllgemeinerChatDetailView(mitarbeiter: mitarbeiter)
            }
        }
    }
}

struct AllgemeinerChatDetailView: View {
    let mitarbeiter: Mitarbeiter
    @EnvironmentObject var syncManager: AWSDataSyncManager
    @State private var textNachricht = ""

    var liveChat: AllgemeinerChat? {
        syncManager.allgemeineChats.first(where: { $0.mitarbeiterId == mitarbeiter.id })
    }

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(spacing: 12) {
                    if let nachrichten = liveChat?.nachrichten, !nachrichten.isEmpty {
                        ForEach(nachrichten) { msg in
                            let istVonMir = msg.isVonMir(aktuelleEmail: syncManager.eingeloggterUserEmail)

                            HStack {
                                if istVonMir { Spacer() }

                                VStack(alignment: istVonMir ? .trailing : .leading, spacing: 4) {
                                    Text(msg.absender)
                                        .font(.caption)
                                        .foregroundColor(.secondary)

                                    Text(msg.text)
                                        .padding(12)
                                        .background(istVonMir ? Color.blue : Color(.systemGray5))
                                        .foregroundColor(istVonMir ? .white : .primary)
                                        .cornerRadius(12)
                                }

                                if !istVonMir { Spacer() }
                            }
                            .padding(.horizontal)
                        }
                        .padding(.top)
                    } else {
                        VStack(spacing: 8) {
                            Image(systemName: "hand.wave")
                                .font(.largeTitle)
                                .foregroundColor(.gray)

                            Text("Starte die Unterhaltung mit \(mitarbeiter.name).")
                                .font(.subheadline)
                                .foregroundColor(.gray)
                        }
                        .padding(.top, 40)
                    }
                }
                .frame(maxWidth: .infinity)
            }
            .portalPullToRefresh()

            HStack {
                TextField("Nachricht an \(mitarbeiter.name)...", text: $textNachricht)
                    .textFieldStyle(.roundedBorder)

                Button {
                    let bereinigt = textNachricht.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !bereinigt.isEmpty else { return }

                    syncManager.sendeAllgemeineNachricht(an: mitarbeiter.id, text: bereinigt)
                    textNachricht = ""
                } label: {
                    Image(systemName: "paperplane.fill")
                        .padding(8)
                }
                .disabled(textNachricht.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            .padding()
            .background(Color(.systemBackground))
        }
        .navigationTitle(mitarbeiter.name)
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct MitarbeiterAuswahlView: View {
    @EnvironmentObject var syncManager: AWSDataSyncManager
    @Environment(\.dismiss) var dismiss
    @Binding var ausgewaehltesZiel: Mitarbeiter?

    var body: some View {
        NavigationStack {
            List(syncManager.verfuegbareMitarbeiter) { mitarbeiter in
                Button {
                    syncManager.sendeAllgemeineNachricht(
                        an: mitarbeiter.id,
                        text: "Hallo \(mitarbeiter.name), ich habe eine Frage."
                    )

                    dismiss()

                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                        ausgewaehltesZiel = mitarbeiter
                    }
                } label: {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(mitarbeiter.name)
                            .font(.body)
                            .bold()
                            .foregroundColor(.primary)

                        Text(mitarbeiter.funktion)
                            .font(.footnote)
                            .foregroundColor(.secondary)
                    }
                }
            }
            .portalPullToRefresh()
            .navigationTitle("Neuer Chat mit...")
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Schliessen") {
                        dismiss()
                    }
                }
            }
        }
    }
}
