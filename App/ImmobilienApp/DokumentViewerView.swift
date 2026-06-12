// DokumentViewerView.swift – In-App PDF/Dokument Viewer mit Druckfunktion

import SwiftUI
import QuickLook
import PDFKit

// MARK: - QuickLook Wrapper

struct QuickLookViewer: UIViewControllerRepresentable {
    let fileURL: URL
    @Binding var isPresented: Bool

    func makeUIViewController(context: Context) -> QLPreviewController {
        let vc = QLPreviewController()
        vc.dataSource = context.coordinator
        vc.delegate = context.coordinator
        vc.currentPreviewItemIndex = 0
        return vc
    }

    func updateUIViewController(_ uiViewController: QLPreviewController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(fileURL: fileURL, isPresented: $isPresented)
    }

    class Coordinator: NSObject, QLPreviewControllerDataSource, QLPreviewControllerDelegate {
        let fileURL: URL
        @Binding var isPresented: Bool

        init(fileURL: URL, isPresented: Binding<Bool>) {
            self.fileURL = fileURL
            _isPresented = isPresented
        }

        func numberOfPreviewItems(in controller: QLPreviewController) -> Int { 1 }

        func previewController(_ controller: QLPreviewController, previewItemAt index: Int) -> any QLPreviewItem {
            fileURL as QLPreviewItem
        }

        func previewControllerWillDismiss(_ controller: QLPreviewController) {
            isPresented = false
        }
    }
}

// MARK: - Download + Temp-Datei

actor DokumentCache {
    static let shared = DokumentCache()
    private var cache: [String: URL] = [:]

    func cachedURL(fuer key: String) -> URL? { cache[key] }
    func speichere(url: URL, fuer key: String) { cache[key] = url }
}

func ladeUndCacheDokument(von remoteURL: URL, dateiname: String) async throws -> URL {
    let key = remoteURL.absoluteString
    if let cached = await DokumentCache.shared.cachedURL(fuer: key) {
        if FileManager.default.fileExists(atPath: cached.path) { return cached }
    }

    let (tmpURL, _) = try await URLSession.shared.download(from: remoteURL)
    let zielOrdner = FileManager.default.temporaryDirectory.appendingPathComponent("portal-docs", isDirectory: true)
    try? FileManager.default.createDirectory(at: zielOrdner, withIntermediateDirectories: true)

    // Dateiname sicher machen und Extension erhalten
    let saferName = dateiname
        .components(separatedBy: CharacterSet.alphanumerics.union(.init(charactersIn: ".-_")).inverted)
        .joined()
    let zielURL = zielOrdner.appendingPathComponent(saferName.isEmpty ? "dokument.pdf" : saferName)

    try? FileManager.default.removeItem(at: zielURL)
    try FileManager.default.moveItem(at: tmpURL, to: zielURL)

    await DokumentCache.shared.speichere(url: zielURL, fuer: key)
    return zielURL
}

// MARK: - Vollbild Viewer Modal

struct DokumentVollbildView: View {
    let fileURL: URL
    let titel: String
    @Binding var isPresented: Bool
    @State private var zeigeQuickLook = true
    @State private var zeigeTeilen = false

    var body: some View {
        NavigationStack {
            Group {
                if fileURL.pathExtension.lowercased() == "pdf" {
                    PDFViewWrapper(url: fileURL)
                        .ignoresSafeArea(edges: .bottom)
                } else {
                    QuickLookViewer(fileURL: fileURL, isPresented: $zeigeQuickLook)
                        .ignoresSafeArea()
                }
            }
            .navigationTitle(titel)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Schliessen") { isPresented = false }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    HStack(spacing: 14) {
                        // Drucken
                        Button {
                            drucken()
                        } label: {
                            Image(systemName: "printer")
                        }
                        // Teilen (Airplay, Mail, etc.)
                        Button {
                            zeigeTeilen = true
                        } label: {
                            Image(systemName: "square.and.arrow.up")
                        }
                    }
                }
            }
            .sheet(isPresented: $zeigeTeilen) {
                ShareSheet(items: [fileURL])
            }
        }
    }

    private func drucken() {
        guard UIPrintInteractionController.isPrintingAvailable else { return }
        let printer = UIPrintInteractionController.shared
        let info = UIPrintInfo(dictionary: nil)
        info.jobName = titel
        info.outputType = fileURL.pathExtension.lowercased() == "pdf" ? .general : .general
        printer.printInfo = info
        printer.printingItem = fileURL
        printer.present(animated: true)
    }
}

// MARK: - PDFView Wrapper für native PDF-Anzeige

struct PDFViewWrapper: UIViewRepresentable {
    let url: URL

    func makeUIView(context: Context) -> PDFView {
        let pdfView = PDFView()
        pdfView.autoScales = true
        pdfView.displayMode = .singlePageContinuous
        pdfView.displayDirection = .vertical
        pdfView.usePageViewController(true, withViewOptions: nil)
        pdfView.backgroundColor = UIColor.systemGroupedBackground
        if let document = PDFDocument(url: url) {
            pdfView.document = document
        }
        return pdfView
    }

    func updateUIView(_ pdfView: PDFView, context: Context) {}
}

// MARK: - ShareSheet

struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        let vc = UIActivityViewController(activityItems: items, applicationActivities: nil)
        return vc
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
