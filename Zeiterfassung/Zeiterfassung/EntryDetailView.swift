//
//  EntryDetailView.swift
//  Zeiterfassung
//
//  Open-source template on 17.05.2026.
//

import SwiftUI
import SwiftData
import MapKit
import CoreLocation

struct EntryDetailView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @Bindable var entry: WorkEntry
    @State private var addr = "Suche Adresse..."

    var body: some View {
        List {
            if entry.isLocked {
                Section {
                    HStack(spacing: 10) {
                        Image(systemName: "lock.fill")
                            .foregroundStyle(.orange)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Festgeschrieben")
                                .font(.subheadline.bold())
                            if let lockedAt = entry.lockedAt {
                                Text("Am \(lockedAt.formatted(date: .abbreviated, time: .shortened))")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                    .padding(.vertical, 4)
                }
            }

            Section("Zeit") {
                Text("Datum: \(entry.startTime, style: .date)")

                if !entry.isVacation {
                    DatePicker("Start", selection: $entry.startTime, displayedComponents: [.hourAndMinute])
                        .disabled(entry.isLocked)

                    DatePicker("Ende", selection: $entry.endTime, displayedComponents: [.hourAndMinute])
                        .disabled(entry.isLocked)

                    Stepper("Manuelle Pause: \(entry.pauseMinutes) Min.", value: $entry.pauseMinutes, in: 0...240, step: 5)
                        .disabled(entry.isLocked)

                    HStack {
                        Text("Dauer")
                        Spacer()
                        Text(formatSeconds(entry.totalSeconds)).bold()
                    }
                }
            }

            if let s = entry.startLoc, !entry.isVacation {
                Section("Ort") {
                    MapView(coords: s)
                        .frame(height: 200)
                        .cornerRadius(10)
                        .listRowInsets(EdgeInsets())

                    Text(addr)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            if entry.isLocked {
                HStack {
                    Image(systemName: "lock.fill").foregroundStyle(.secondary)
                    Text("Festgeschriebene Einträge können nicht gelöscht werden.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            } else {
                Button("Löschen", role: .destructive) {
                    modelContext.delete(entry)
                    do {
                        try modelContext.save()
                        TrackingBridge.markDataChanged()
                        dismiss()
                    } catch {
                        print("Fehler beim Löschen des Eintrags: \(error)")
                    }
                }
            }
        }
        .navigationTitle("Eintrag bearbeiten")
        .task {
            if let loc = entry.startLoc {
                addr = await lookUp(loc)
            }
        }
        .onChange(of: entry.startTime) { _, _ in
            persistEntryChanges()
        }
        .onChange(of: entry.endTime) { _, _ in
            persistEntryChanges()
        }
    }

    func formatSeconds(_ s: Int) -> String {
        String(format: "%02d:%02d:%02d", s / 3600, (s % 3600) / 60, s % 60)
    }
    
    func persistEntryChanges() {
        do {
            try modelContext.save()
            TrackingBridge.markDataChanged()
        } catch {
            print("Fehler beim Speichern der Eintragsänderung: \(error)")
        }
    }

    func lookUp(_ c: String) async -> String {
        let comp = c.split(separator: ",")
        guard comp.count == 2,
              let lat = Double(comp[0]),
              let lon = Double(comp[1]) else {
            return "Ungültige Koordinaten"
        }

        let location = CLLocation(latitude: lat, longitude: lon)

        do {
            let placemarks = try await CLGeocoder().reverseGeocodeLocation(location)

            guard let placemark = placemarks.first else {
                return "Adresse nicht gefunden"
            }

            let parts: [String?] = [
                placemark.thoroughfare,
                placemark.subThoroughfare,
                placemark.locality
            ]
            let address = parts.compactMap { $0 }.joined(separator: " ")

            if !address.isEmpty {
                return address
            }

            if let name = placemark.name, !name.isEmpty {
                return name
            }

            return "Adresse nicht gefunden"
        } catch {
            print("Geocoding Fehler: \(error.localizedDescription)")
            return "Fehler beim Laden der Adresse"
        }
    }
}

struct MapView: View {
    let coords: String

    private var coordinate: CLLocationCoordinate2D? {
        let comp = coords.split(separator: ",")
        guard comp.count == 2,
              let lat = Double(comp[0]),
              let lon = Double(comp[1]) else {
            return nil
        }
        return CLLocationCoordinate2D(latitude: lat, longitude: lon)
    }

    var body: some View {
        if let coordinate {
            Map(position: .constant(.region(MKCoordinateRegion(
                center: coordinate,
                latitudinalMeters: 500,
                longitudinalMeters: 500
            )))) {
                Marker("Arbeitsort", coordinate: coordinate)
                    .tint(.orange)
            }
            .mapControls {
                MapCompass()
                MapScaleView()
            }
        } else {
            ContentUnavailableView(
                "Keine Kartendaten",
                systemImage: "map.slash",
                description: Text("Koordinaten konnten nicht gelesen werden.")
            )
        }
    }
}
