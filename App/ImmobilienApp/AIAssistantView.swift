// IMMOBILIENTOOL KI-Assistent – Chat mit tiefer App-Integration
// Aktionen: fill_form | open_document | navigate | call | email | open_maps

import SwiftUI
import Combine

// MARK: - Aktion-Parsing

private let AKTION_START_TAG = "<<<PORTAL_AKTION>>>"
private let AKTION_ENDE_TAG = "<<<ENDE_AKTION>>>"

struct KIAktion: Codable {
    let typ: String
    let felder: [String: String]?
    let id: String?
    let titel: String?
    let nummer: String?
    let adresse: String?
    let ziel: String?
}

func kiParseAntwort(rohText: String) -> (anzeigeText: String, aktion: KIAktion?) {
    guard let startIdx = rohText.range(of: AKTION_START_TAG),
          let endeIdx = rohText.range(of: AKTION_ENDE_TAG),
          startIdx.upperBound <= endeIdx.lowerBound
    else { return (rohText, nil) }

    let jsonRoh = String(rohText[startIdx.upperBound..<endeIdx.lowerBound])
        .trimmingCharacters(in: .whitespacesAndNewlines)
    let anzeigeText = String(rohText[rohText.startIndex..<startIdx.lowerBound])
        .trimmingCharacters(in: .whitespacesAndNewlines)

    guard let data = jsonRoh.data(using: .utf8),
          let aktion = try? JSONDecoder().decode(KIAktion.self, from: data)
    else { return (anzeigeText.isEmpty ? rohText : anzeigeText, nil) }

    return (anzeigeText, aktion)
}

// MARK: - AIAssistantView

struct AIAssistantView: View {
    let kontext: String?
    let systemPrompt: String?
    let schnellstarts: [String]

    var onFormFill: (([String: String]) -> Void)?
    var onOpenDocument: ((String, String?) -> Void)?
    var onNavigate: ((String) -> Void)?

    private let bedrock = BedrockService.shared
    @State private var nachrichten: [ChatMessage] = []
    @State private var eingabe = ""
    @State private var laedt = false
    @State private var aktionsBanner: String? = nil
    @Environment(\.dismiss) private var dismiss

    init(
        kontext: String? = nil,
        systemPrompt: String? = nil,
        schnellstarts: [String] = [],
        onFormFill: (([String: String]) -> Void)? = nil,
        onOpenDocument: ((String, String?) -> Void)? = nil,
        onNavigate: ((String) -> Void)? = nil
    ) {
        self.kontext = kontext
        self.systemPrompt = systemPrompt
        self.schnellstarts = schnellstarts
        self.onFormFill = onFormFill
        self.onOpenDocument = onOpenDocument
        self.onNavigate = onNavigate
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {

                if let banner = aktionsBanner {
                    HStack(spacing: 8) {
                        Image(systemName: "checkmark.circle.fill").foregroundStyle(.green)
                        Text(banner).font(.caption.weight(.medium))
                        Spacer()
                    }
                    .padding(.horizontal, 16).padding(.vertical, 8)
                    .background(Color.green.opacity(0.12))
                    .transition(.move(edge: .top).combined(with: .opacity))
                }

                if kontext != nil {
                    HStack(spacing: 6) {
                        Image(systemName: "checkmark.circle.fill").foregroundStyle(.green).font(.caption)
                        Text("Kontext geladen").font(.caption).foregroundStyle(.secondary)
                        Spacer()
                    }
                    .padding(.horizontal, 16).padding(.vertical, 6)
                    .background(Color(.systemGroupedBackground))
                }

                if !schnellstarts.isEmpty && nachrichten.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(schnellstarts, id: \.self) { s in
                                Button(s) { eingabe = s }
                                    .font(.caption.weight(.medium))
                                    .padding(.horizontal, 12).padding(.vertical, 6)
                                    .background(Color(.secondarySystemGroupedBackground))
                                    .foregroundStyle(.primary)
                                    .clipShape(Capsule())
                                    .overlay(Capsule().stroke(Color(.separator), lineWidth: 0.5))
                            }
                        }
                        .padding(.horizontal, 16).padding(.vertical, 8)
                    }
                }

                Divider()

                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 10) {
                            if nachrichten.isEmpty {
                                VStack(spacing: 10) {
                                    Image(systemName: "sparkles").font(.system(size: 36)).foregroundStyle(.secondary)
                                    Text("Wie kann ich helfen?").font(.subheadline).foregroundStyle(.secondary)
                                }
                                .frame(maxWidth: .infinity).padding(.top, 60)
                            }
                            ForEach(nachrichten) { m in
                                NachrichtBubble(nachricht: m).id(m.id)
                            }
                            if laedt {
                                HStack { TypingIndicator(); Spacer() }
                                    .padding(.horizontal, 16).id("laedt")
                            }
                        }
                        .padding(.vertical, 12)
                    }
                    .onChange(of: nachrichten.count) { _, _ in
                        if let last = nachrichten.last {
                            withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
                        }
                    }
                    .onChange(of: laedt) { _, neu in
                        if neu { withAnimation { proxy.scrollTo("laedt", anchor: .bottom) } }
                    }
                }

                Divider()

                HStack(spacing: 10) {
                    TextField("Nachricht…", text: $eingabe, axis: .vertical)
                        .lineLimit(1...4).textFieldStyle(.plain)
                        .padding(.horizontal, 12).padding(.vertical, 8)
                        .background(Color(.secondarySystemGroupedBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 20))

                    Button { Task { await senden() } } label: {
                        Image(systemName: laedt ? "ellipsis" : "arrow.up.circle.fill")
                            .font(.title2)
                            .foregroundStyle(
                                eingabe.trimmingCharacters(in: .whitespaces).isEmpty || laedt
                                    ? Color.secondary : Color.blue
                            )
                    }
                    .disabled(eingabe.trimmingCharacters(in: .whitespaces).isEmpty || laedt)
                }
                .padding(.horizontal, 12).padding(.vertical, 10)
                .background(Color(.systemBackground))
            }
            .navigationTitle("✦ IMMOBILIENTOOL KI-Assistent")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fertig") { dismiss() }
                }
                if !nachrichten.isEmpty {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Leeren") { nachrichten = [] }.foregroundStyle(.red)
                    }
                }
            }
            .animation(.easeInOut(duration: 0.3), value: aktionsBanner)
        }
    }

    private func senden() async {
        let text = eingabe.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty else { return }
        eingabe = ""
        laedt = true
        nachrichten.append(ChatMessage(role: "user", content: text))

        let rohAntwort = await bedrock.senden(
            nachrichten: nachrichten,
            systemPrompt: systemPrompt,
            kontext: kontext
        )

        let (anzeigeText, aktion) = kiParseAntwort(rohText: rohAntwort)
        nachrichten.append(ChatMessage(role: "assistant", content: anzeigeText.isEmpty ? rohAntwort : anzeigeText))
        laedt = false

        if let aktion {
            Task { await fuehreAktionAus(aktion) }
        }
    }

    @MainActor
    private func fuehreAktionAus(_ aktion: KIAktion) async {
        switch aktion.typ {

        case "fill_form":
            guard let felder = aktion.felder, !felder.isEmpty, let onFormFill else { return }
            onFormFill(felder)
            withAnimation { aktionsBanner = "✓ Formular wurde ausgefüllt" }
            try? await Task.sleep(nanoseconds: 1_300_000_000)
            dismiss()

        case "open_document":
            guard let id = aktion.id, let onOpenDocument else { return }
            withAnimation { aktionsBanner = "✓ Dokument wird geöffnet…" }
            onOpenDocument(id, aktion.titel)
            try? await Task.sleep(nanoseconds: 800_000_000)
            dismiss()

        case "navigate":
            guard let ziel = aktion.ziel, let onNavigate else { return }
            withAnimation { aktionsBanner = "✓ Navigiere zu \(ziel.capitalized)" }
            onNavigate(ziel)
            try? await Task.sleep(nanoseconds: 800_000_000)
            dismiss()

        case "call":
            guard let nummer = aktion.nummer,
                  let url = URL(string: "tel://\(nummer.replacingOccurrences(of: " ", with: ""))") else { return }
            withAnimation { aktionsBanner = "✓ Anruf wird gestartet…" }
            await UIApplication.shared.open(url)

        case "email":
            guard let adresse = aktion.adresse,
                  let url = URL(string: "mailto:\(adresse)") else { return }
            withAnimation { aktionsBanner = "✓ E-Mail wird geöffnet…" }
            await UIApplication.shared.open(url)

        case "open_maps":
            guard let adresse = aktion.adresse,
                  let encoded = adresse.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
                  let url = URL(string: "http://maps.apple.com/?q=\(encoded)") else { return }
            withAnimation { aktionsBanner = "✓ Karte wird geöffnet…" }
            await UIApplication.shared.open(url)

        default:
            break
        }
    }
}

// MARK: - NachrichtBubble

private func inlineAttributed(_ s: String) -> AttributedString {
    (try? AttributedString(
        markdown: s,
        options: AttributedString.MarkdownParsingOptions(interpretedSyntax: .inlineOnlyPreservingWhitespace)
    )) ?? AttributedString(s)
}

private struct MarkdownView: View {
    let text: String
    let textColor: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            ForEach(Array(text.components(separatedBy: "\n").enumerated()), id: \.offset) { _, line in
                lineView(for: line)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private func lineView(for line: String) -> some View {
        if line.hasPrefix("### ") {
            Text(inlineAttributed(String(line.dropFirst(4))))
                .font(.subheadline.weight(.bold)).foregroundStyle(textColor).padding(.top, 6)
        } else if line.hasPrefix("## ") {
            Text(inlineAttributed(String(line.dropFirst(3))))
                .font(.headline).foregroundStyle(textColor).padding(.top, 8)
        } else if line.hasPrefix("# ") {
            Text(inlineAttributed(String(line.dropFirst(2))))
                .font(.title3.weight(.bold)).foregroundStyle(textColor).padding(.top, 10)
        } else if line.hasPrefix("- ") || line.hasPrefix("• ") {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text("•").font(.callout).foregroundStyle(textColor)
                Text(inlineAttributed(String(line.dropFirst(2)))).font(.callout).foregroundStyle(textColor)
            }
        } else if line == "---" || line == "***" {
            Divider().padding(.vertical, 4)
        } else if line.trimmingCharacters(in: .whitespaces).isEmpty {
            Spacer().frame(height: 4)
        } else {
            Text(inlineAttributed(line)).font(.callout).foregroundStyle(textColor)
        }
    }
}

private struct NachrichtBubble: View {
    let nachricht: ChatMessage
    var istUser: Bool { nachricht.role == "user" }

    var body: some View {
        HStack(alignment: .top) {
            if istUser { Spacer(minLength: 40) }
            Group {
                if istUser {
                    Text(nachricht.content)
                        .font(.callout).foregroundStyle(Color.white)
                        .padding(.horizontal, 14).padding(.vertical, 10)
                        .background(Color.blue)
                        .clipShape(RoundedRectangle(cornerRadius: 18))
                } else {
                    MarkdownView(text: nachricht.content, textColor: Color.primary)
                        .padding(.horizontal, 14).padding(.vertical, 10)
                        .background(Color(.secondarySystemGroupedBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 18))
                }
            }
            .contextMenu {
                Button {
                    UIPasteboard.general.string = nachricht.content
                } label: {
                    Label("Kopieren", systemImage: "doc.on.doc")
                }
            }
            if !istUser { Spacer(minLength: 40) }
        }
        .padding(.horizontal, 14)
    }
}

private struct TypingIndicator: View {
    @State private var phase = 0
    let timer = Timer.publish(every: 0.35, on: .main, in: .common).autoconnect()

    var body: some View {
        HStack(spacing: 5) {
            ForEach(0..<3, id: \.self) { i in
                Circle().fill(Color.secondary).frame(width: 7, height: 7)
                    .scaleEffect(phase == i ? 1.3 : 0.8)
                    .animation(.easeInOut(duration: 0.3), value: phase)
            }
        }
        .padding(.horizontal, 14).padding(.vertical, 10)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 18))
        .onReceive(timer) { _ in phase = (phase + 1) % 3 }
    }
}
