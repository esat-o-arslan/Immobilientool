//
//  SetupView.swift
//  Zeiterfassung
//
//  Open-source template on 17.05.2026.
//

import SwiftUI
import SwiftData
import CoreLocation
import UserNotifications

struct SetupView: View {
    @AppStorage(SharedDefaults.userName, store: .sharedGroup) private var userName = ""
    @AppStorage(SharedDefaults.userLastName, store: .sharedGroup) private var userLastName = ""
    @AppStorage(SharedDefaults.isGeofenceEnabled, store: .sharedGroup) private var isGeofenceEnabled = false

    @Environment(CloudSyncManager.self) private var cloudSync
    @Environment(CognitoAuthService.self) private var portalAuth
    @Environment(PortalSyncManager.self) private var portalSync

    @State private var locationManager = LocationManager()

    var body: some View {
        Form {
            // IMMOBILIENTOOL Server Sync (neu)
            PortalSyncSettingsView(auth: portalAuth, syncManager: portalSync)

            Section(header: Text("Benutzerprofil")) {
                NavigationLink(destination: ProfileSettingsView()) {
                    HStack {
                        Image(systemName: "person.crop.circle.fill")
                            .foregroundColor(.blue)
                            .imageScale(.large)
                        Text("Profil & Eintrittsdatum")
                    }
                }
            }

            Section(header: Text("Verwaltung & Planung")) {
                NavigationLink(destination: ArbeitszeitModelleView()) {
                    HStack {
                        Image(systemName: "clock.badge.checkmark")
                            .foregroundColor(.purple)
                            .imageScale(.large)
                        Text("Arbeitszeitmodelle (Soll-Stunden)")
                    }
                }
                NavigationLink(destination: VacationSettingsView()) {
                    HStack {
                        Image(systemName: "calendar.badge.checkmark")
                            .foregroundColor(.orange)
                            .imageScale(.large)
                        Text("Urlaubsverwaltung")
                    }
                }
                NavigationLink(destination: HolidaySettingsView()) {
                    HStack {
                        Image(systemName: "globe.europe.africa.fill")
                            .foregroundColor(.blue)
                            .imageScale(.large)
                        Text("Feiertage")
                    }
                }
            }

            Section(header: Text("System")) {
                NavigationLink(destination: GeofencingSettingsView()) {
                    HStack {
                        Image(systemName: "location.fill")
                            .foregroundColor(.green)
                            .imageScale(.large)
                        Text("Standort & Geofencing")
                    }
                }
                NavigationLink(destination: NotificationSettingsView()) {
                    HStack {
                        Image(systemName: "bell.fill")
                            .foregroundColor(.red)
                            .imageScale(.large)
                        Text("Mitteilungen")
                    }
                }
                NavigationLink(destination: ICloudSyncSettingsView()) {
                    HStack {
                        Image(systemName: "icloud.fill")
                            .foregroundColor(.blue)
                            .imageScale(.large)
                        Text("iCloud Sync")
                    }
                }
            }
        }
        .navigationTitle("Einstellungen")
        .onAppear {
            if isGeofenceEnabled {
                locationManager.startMonitoringWorkRegion()
            }
        }
    }

}

// MARK: - Standort & Geofencing

struct GeofencingSettingsView: View {
    @AppStorage(SharedDefaults.isGeofenceEnabled, store: .sharedGroup) private var isGeofenceEnabled = false
    @State private var locationManager = LocationManager()

    var body: some View {
        Form {
            Section {
                Toggle("Automatischer Stopp (>300m)", isOn: $isGeofenceEnabled)
                    .onChange(of: isGeofenceEnabled) { _, newValue in
                        if newValue {
                            locationManager.requestPermissions()
                            locationManager.startMonitoringWorkRegion()
                        } else {
                            locationManager.stopMonitoringWorkRegion()
                        }
                    }

                HStack {
                    Text("Büro-Standort")
                    Spacer()
                    Text("Immobilientool").foregroundColor(.secondary)
                }

                HStack {
                    Text("Radius")
                    Spacer()
                    Text("\(Int(locationManager.geofenceRadius)) m").foregroundColor(.secondary)
                }

                HStack {
                    Text("Standortberechtigung")
                    Spacer()
                    Text(locationStatusText(locationManager.authorizationStatus)).foregroundColor(.secondary)
                }

                HStack {
                    Text("Region Status")
                    Spacer()
                    Text(locationManager.isInsideWorkRegion ? "Im Arbeitsbereich" : "Außerhalb")
                        .foregroundColor(locationManager.isInsideWorkRegion ? .green : .secondary)
                }

                Button("Standortberechtigung anfragen") {
                    locationManager.requestPermissions()
                }
            }
        }
        .navigationTitle("Standort & Geofencing")
        .onAppear {
            if isGeofenceEnabled { locationManager.startMonitoringWorkRegion() }
        }
    }

    private func locationStatusText(_ status: CLAuthorizationStatus) -> String {
        switch status {
        case .authorizedAlways:    return "Immer erlaubt"
        case .authorizedWhenInUse: return "Beim Verwenden"
        case .denied:              return "Verweigert"
        case .restricted:          return "Eingeschränkt"
        case .notDetermined:       return "Nicht angefragt"
        @unknown default:          return "Unbekannt"
        }
    }
}

// MARK: - Mitteilungen

struct NotificationSettingsView: View {
    @State private var statusText = "Unbekannt"

    var body: some View {
        Form {
            Section {
                HStack {
                    Text("Status")
                    Spacer()
                    Text(statusText).foregroundColor(.secondary)
                }
                Button("Mitteilungen anfragen") { requestPermission() }
            }
        }
        .navigationTitle("Mitteilungen")
        .onAppear { refreshStatus() }
    }

    private func requestPermission() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in
            refreshStatus()
        }
    }

    private func refreshStatus() {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            DispatchQueue.main.async {
                switch settings.authorizationStatus {
                case .authorized, .provisional, .ephemeral: statusText = "Erlaubt"
                case .denied:                               statusText = "Verweigert"
                case .notDetermined:                        statusText = "Nicht angefragt"
                @unknown default:                           statusText = "Unbekannt"
                }
            }
        }
    }
}

// MARK: - iCloud Sync

struct ICloudSyncSettingsView: View {
    @Environment(CloudSyncManager.self) private var cloudSync

    var body: some View {
        Form {
            Section(footer: Text("Wenn aktiviert, werden alle Zeiteinträge in iCloud gespeichert und auf deinen Geräten synchronisiert. Benötigt einen aktiven iCloud-Account.")) {
                Toggle(isOn: iCloudEnabledBinding) {
                    HStack(spacing: 10) {
                        Image(systemName: "icloud.fill")
                            .foregroundStyle(cloudSync.iCloudEnabled ? .blue : .secondary)
                        Text("iCloud Sync aktivieren")
                    }
                }

                HStack {
                    Text("iCloud-Account")
                    Spacer()
                    Circle().fill(cloudSync.accountStatusColor).frame(width: 8, height: 8)
                    Text(cloudSync.accountStatusText).foregroundStyle(.secondary)
                }

                HStack {
                    Text("Letzter Sync")
                    Spacer()
                    if let date = cloudSync.lastSyncDate {
                        VStack(alignment: .trailing, spacing: 2) {
                            Text(date, style: .date).font(.subheadline).foregroundStyle(.secondary)
                            Text(date, style: .time).font(.caption).foregroundStyle(.secondary)
                        }
                    } else {
                        Text("Noch kein Sync").foregroundStyle(.secondary)
                    }
                }

                if cloudSync.needsRestart {
                    HStack(spacing: 8) {
                        Image(systemName: "info.circle.fill").foregroundStyle(.orange)
                        Text("Änderung wird beim nächsten App-Start übernommen.")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
        }
        .navigationTitle("iCloud Sync")
    }

    private var iCloudEnabledBinding: Binding<Bool> {
        Binding(
            get: { cloudSync.iCloudEnabled },
            set: { cloudSync.iCloudEnabled = $0 }
        )
    }
}

struct EditableHourRow: View {
    let label: String
    @Binding var value: Double
    @State private var isFocused = false

    var body: some View {
        HStack {
            Text(label)
                .font(.body.weight(.semibold))
                .frame(width: 36, alignment: .leading)

            Spacer()

            HStack(spacing: 0) {
                Button {
                    value = max(0, round((value - 0.01) * 100) / 100)
                } label: {
                    Image(systemName: "minus")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(.primary)
                        .frame(width: 44, height: 36)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                Rectangle()
                    .fill(Color(.systemGray4))
                    .frame(width: 0.5, height: 20)
                    .allowsHitTesting(false)

                FormattedNumberField(
                    title: label,
                    value: $value,
                    formatter: decimalHourFormatter,
                    keyboardType: .decimalPad,
                    allowsDecimal: true,
                    isFocused: $isFocused
                )
                .frame(width: 52, height: 36)

                Text("h")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .padding(.trailing, 6)
                    .allowsHitTesting(false)

                Rectangle()
                    .fill(Color(.systemGray4))
                    .frame(width: 0.5, height: 20)
                    .allowsHitTesting(false)

                Button {
                    value = min(24, round((value + 0.01) * 100) / 100)
                } label: {
                    Image(systemName: "plus")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(.primary)
                        .frame(width: 44, height: 36)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
            .background(Color(.systemGray6))
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color(.systemGray4), lineWidth: 0.5))
        }
    }

    private var decimalHourFormatter: NumberFormatter {
        let formatter = NumberFormatter()
        formatter.locale = Locale(identifier: "en_CH")
        formatter.numberStyle = .decimal
        formatter.usesGroupingSeparator = false
        formatter.decimalSeparator = "."
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = 2
        return formatter
    }
}

struct StepperControl: View {
    @Binding var value: Int
    let range: ClosedRange<Int>
    let displayText: (Int) -> String

    var body: some View {
        HStack(spacing: 0) {
            Button {
                if value > range.lowerBound { value -= 1 }
            } label: {
                Image(systemName: "minus")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundColor(.primary)
                    .frame(width: 40, height: 32)
            }
            .buttonStyle(.plain)

            Rectangle()
                .fill(Color(.systemGray4))
                .frame(width: 0.5, height: 18)

            Text(displayText(value))
                .font(.body.monospacedDigit())
                .frame(minWidth: 60)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 8)

            Rectangle()
                .fill(Color(.systemGray4))
                .frame(width: 0.5, height: 18)

            Button {
                if value < range.upperBound { value += 1 }
            } label: {
                Image(systemName: "plus")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundColor(.primary)
                    .frame(width: 40, height: 32)
            }
            .buttonStyle(.plain)
        }
        .background(Color(.systemGray6))
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color(.systemGray4), lineWidth: 0.5))
    }
}

struct ProfileSettingsView: View {
    @AppStorage(SharedDefaults.userName, store: .sharedGroup) private var userName = ""
    @AppStorage(SharedDefaults.userLastName, store: .sharedGroup) private var userLastName = ""
    @AppStorage(SharedDefaults.entryDate, store: .sharedGroup) private var entryDate: Double = Date().timeIntervalSince1970

    @Environment(CognitoAuthService.self) private var portalAuth

    private var portalName: String? { UserDefaults.standard.portalMitarbeiterName }
    private var portalEmail: String? { UserDefaults.standard.portalEmail }

    var body: some View {
        Form {
            // IMMOBILIENTOOL-Übernahme wenn eingeloggt
            if portalAuth.isAuthenticated, let vollName = portalName, !vollName.isEmpty {
                Section {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(vollName).fontWeight(.semibold)
                            if let email = portalEmail {
                                Text(email).font(.caption).foregroundStyle(.secondary)
                            }
                        }
                        Spacer()
                        Button("Übernehmen") { applyFromPortal(vollName) }
                            .buttonStyle(.borderedProminent)
                            .controlSize(.small)
                    }
                } header: {
                    Text("Vom IMMOBILIENTOOL-Portal")
                } footer: {
                    Text("Übernimmt deinen Namen automatisch aus deinem Portal-Account.")
                }
            }

            Section(header: Text("Name")) {
                TextField("Vorname", text: $userName)
                TextField("Nachname", text: $userLastName)
            }

            Section(
                header: Text("Anstellungsverhältnis"),
                footer: Text("Stunden vor dem Eintrittsdatum werden in der Auswertung mit 0 berechnet.")
            ) {
                DatePicker(
                    "Eintrittsdatum",
                    selection: Binding(
                        get: { Date(timeIntervalSince1970: entryDate) },
                        set: { entryDate = $0.timeIntervalSince1970 }
                    ),
                    displayedComponents: .date
                )
            }
        }
        .navigationTitle("Profil")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { autoFillIfEmpty() }
    }

    private func autoFillIfEmpty() {
        guard userName.isEmpty, userLastName.isEmpty,
              let vollName = portalName, !vollName.isEmpty else { return }
        applyFromPortal(vollName)
    }

    private func applyFromPortal(_ vollName: String) {
        let parts = vollName.split(separator: " ", maxSplits: 1).map(String.init)
        if parts.count >= 2 {
            userName = parts[0]
            userLastName = parts[1]
        } else {
            userName = vollName
            userLastName = ""
        }
    }
}

struct ArbeitszeitModelleView: View {
    var body: some View {
        List {
            Section("Regulär") {
                NavigationLink(destination: StandardWocheView()) {
                    Label("Standard-Woche", systemImage: "clock")
                }
            }

            Section("KW Abweichungen") {
                NavigationLink(destination: SpezielleWochenListView()) {
                    Label("Spezielle Wochen", systemImage: "calendar.badge.exclamationmark")
                }
            }
        }
        .navigationTitle("Modelle")
    }
}

struct StandardWocheView: View {
    @AppStorage("sollMo") private var mo = 8.3
    @AppStorage("sollDi") private var di = 8.3
    @AppStorage("sollMi") private var mi = 8.3
    @AppStorage("sollDo") private var dou = 8.3
    @AppStorage("sollFr") private var fr = 8.3
    @AppStorage("sollSa") private var sa = 0.0
    @AppStorage("sollSo") private var so = 0.0

    var body: some View {
        Form {
            Section("Werktage") {
                EditableHourRow(label: "Mo", value: $mo)
                EditableHourRow(label: "Di", value: $di)
                EditableHourRow(label: "Mi", value: $mi)
                EditableHourRow(label: "Do", value: $dou)
                EditableHourRow(label: "Fr", value: $fr)
            }
            Section("Wochenende") {
                EditableHourRow(label: "Sa", value: $sa)
                EditableHourRow(label: "So", value: $so)
            }
        }
        .navigationTitle("Standard")
    }
}

struct SpezielleWochenListView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \WeeklySoll.year, order: .reverse) var allSolls: [WeeklySoll]
    @State private var showingAddSheet = false

    var body: some View {
        List {
            if allSolls.isEmpty {
                Text("Keine abweichenden Wochenpläne definiert.")
                    .font(.caption)
                    .foregroundColor(.secondary)
            } else {
                ForEach(allSolls) { week in
                    NavigationLink(destination: EditWeeklySollView(weekPlan: week)) {
                        Text("KW \(week.weekNumber) (\(week.year))")
                    }
                }
                .onDelete { indexSet in
                    for i in indexSet {
                        modelContext.delete(allSolls[i])
                    }
                    try? modelContext.save()
                }
            }
        }
        .navigationTitle("Spezielle Wochen")
        .toolbar {
            Button {
                showingAddSheet = true
            } label: {
                Image(systemName: "plus")
            }
        }
        .sheet(isPresented: $showingAddSheet) {
            AddSpezielleWocheSheet()
        }
    }
}

struct AddSpezielleWocheSheet: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    @State private var year = Calendar.current.component(.year, from: Date())
    @State private var week = Calendar.current.component(.weekOfYear, from: Date())
    @State private var mo = 8.3
    @State private var di = 8.3
    @State private var mi = 8.3
    @State private var dou = 8.3
    @State private var fr = 8.3
    @State private var sa = 0.0
    @State private var so = 0.0

    var body: some View {
        NavigationStack {
            Form {
                Section("Zeitraum") {
                    HStack {
                        Text("Jahr")
                            .font(.body.weight(.semibold))
                        Spacer()
                        StepperControl(value: $year, range: 2020...2035) { "\($0)" }
                    }

                    HStack {
                        Text("Kalenderwoche")
                            .font(.body.weight(.semibold))
                        Spacer()
                        StepperControl(value: $week, range: 1...53) { "KW \($0)" }
                    }
                }

                Section("Werktage") {
                    EditableHourRow(label: "Mo", value: $mo)
                    EditableHourRow(label: "Di", value: $di)
                    EditableHourRow(label: "Mi", value: $mi)
                    EditableHourRow(label: "Do", value: $dou)
                    EditableHourRow(label: "Fr", value: $fr)
                }
                Section("Wochenende") {
                    EditableHourRow(label: "Sa", value: $sa)
                    EditableHourRow(label: "So", value: $so)
                }
            }
            .navigationTitle("Neue Woche")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Speichern") {
                        let neueWoche = WeeklySoll(
                            year: year,
                            weekNumber: week,
                            moSoll: mo,
                            diSoll: di,
                            miSoll: mi,
                            doSoll: dou,
                            frSoll: fr,
                            saSoll: sa,
                            soSoll: so
                        )
                        modelContext.insert(neueWoche)

                        do {
                            try modelContext.save()
                            dismiss()
                        } catch {
                            print("Fehler beim Speichern der Soll-Woche: \(error)")
                        }
                    }
                }
            }
        }
    }
}

struct EditWeeklySollView: View {
    @Bindable var weekPlan: WeeklySoll

    var body: some View {
        Form {
            Section("Werktage") {
                EditableHourRow(label: "Mo", value: $weekPlan.moSoll)
                EditableHourRow(label: "Di", value: $weekPlan.diSoll)
                EditableHourRow(label: "Mi", value: $weekPlan.miSoll)
                EditableHourRow(label: "Do", value: $weekPlan.doSoll)
                EditableHourRow(label: "Fr", value: $weekPlan.frSoll)
            }
            Section("Wochenende") {
                EditableHourRow(label: "Sa", value: $weekPlan.saSoll)
                EditableHourRow(label: "So", value: $weekPlan.soSoll)
            }
        }
        .navigationTitle("KW \(weekPlan.weekNumber)")
    }
}

struct VacationSettingsView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(PortalUrlaubManager.self) private var urlaubManager

    @AppStorage("activatedYears") private var activatedYearsString = "2026"
    @AppStorage("selectedTabYear") private var selectedYear = 2026

    @State private var showAddVacation = false
    @State private var showPortalAntrag = false
    @State private var zeigeKalender = false

    @Query(sort: \WorkEntry.startTime, order: .reverse) var allEntries: [WorkEntry]

    private var years: [Int] {
        activatedYearsString.split(separator: ",").compactMap { Int($0) }.sorted()
    }

    private var vacationEntries: [WorkEntry] {
        allEntries.filter { entry in
            let calendar = Calendar.current
            let year = calendar.component(.year, from: entry.startTime)
            return entry.isVacation && year == selectedYear
        }
    }

    private var totalVacationBinding: Binding<Double> {
        Binding(
            get: {
                let key = "totalVacationDays_\(selectedYear)"
                let value = UserDefaults.standard.double(forKey: key)
                return value == 0 ? 20.0 : value
            },
            set: { UserDefaults.standard.set($0, forKey: "totalVacationDays_\(selectedYear)") }
        )
    }

    private var stats: (totalAvailable: Double, taken: Double, remaining: Double) {
        calculateStats(for: selectedYear)
    }

    var body: some View {
        VStack(spacing: 0) {
            Picker("Jahr", selection: $selectedYear) {
                ForEach(years, id: \.self) { year in
                    Text(String(year)).tag(year)
                }
            }
            .pickerStyle(.segmented)
            .task { await urlaubManager.refresh() }
            .padding()
            .background(Color(UIColor.systemGroupedBackground))

            Form {
                portalSektion

                Section {
                    DisclosureGroup("Konfiguration \(String(selectedYear))") {
                        YearlyConfigView(year: selectedYear, total: totalVacationBinding)
                    }
                }

                Section(header: Text("Status \(String(selectedYear))")) {
                    HStack {
                        Label("Gesamtanspruch", systemImage: "calendar.circle.fill")
                            .foregroundColor(.blue)
                        Spacer()
                        Text("\(stats.totalAvailable, specifier: "%.2f") Tage")
                            .fontWeight(.medium)
                    }

                    HStack {
                        Label("Genommen", systemImage: "checkmark.circle.fill")
                            .foregroundColor(.orange)
                        Spacer()
                        Text("\(Int(stats.taken)) Tage")
                            .foregroundColor(.orange)
                            .fontWeight(.medium)
                    }

                    HStack {
                        Label("Resturlaub", systemImage: "leaf.circle.fill")
                            .foregroundColor(stats.remaining < 0 ? .red : .green)
                        Spacer()
                        Text("\(stats.remaining, specifier: "%.2f") Tage")
                            .bold()
                            .foregroundColor(stats.remaining < 0 ? .red : .green)
                    }
                }

                Section(header: HStack {
                    Text("Urlaubstage \(String(selectedYear))")
                    Spacer()
                    Button {
                        showAddVacation = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .foregroundColor(.blue)
                    }
                }) {
                    if vacationEntries.isEmpty {
                        HStack {
                            Image(systemName: "sun.horizon")
                                .foregroundColor(.secondary)
                            Text("Keine Einträge für dieses Jahr")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        .padding(.vertical, 4)
                    } else {
                        ForEach(vacationEntries) { entry in
                            HStack {
                                Image(systemName: "sun.max.fill")
                                    .foregroundColor(.orange)
                                Text(entry.startTime, style: .date)
                                    .fontWeight(.medium)
                                Spacer()
                                Text("1 Tag")
                                    .font(.caption.weight(.semibold))
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 3)
                                    .background(Color.orange.opacity(0.15))
                                    .foregroundColor(.orange)
                                    .clipShape(Capsule())
                            }
                        }
                        .onDelete(perform: deleteVacation)
                    }
                }

                Section(footer: Text("Erstellt einen Reiter für das Folgejahr und überträgt den Resturlaub.")) {
                    Button {
                        transferToNextYear(remaining: stats.remaining)
                    } label: {
                        HStack {
                            Image(systemName: "arrow.right.circle.fill")
                            Text("Urlaub nach \(String(selectedYear + 1)) übertragen")
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(years.contains(selectedYear + 1))
                }
            }
            .refreshable { await urlaubManager.refresh() }
        }
        .navigationTitle("Urlaubsverwaltung")
        .sheet(isPresented: $showAddVacation) {
            AddVacationView(preselectedYear: selectedYear)
        }
        .sheet(isPresented: $showPortalAntrag) {
            PortalUrlaubAntragView(urlaubManager: urlaubManager)
        }
        .sheet(isPresented: $zeigeKalender) {
            NavigationStack {
                ScrollView {
                    PortalUrlaubKalenderView(urlaubManager: urlaubManager)
                }
                .refreshable { await urlaubManager.refresh() }
                .navigationTitle("Team-Kalender")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Fertig") { zeigeKalender = false }
                    }
                }
            }
        }
    }

    // MARK: - Portal-Sektion (in Form eingebettet)
    var portalSektion: some View {
        Group {
            if urlaubManager.auth.isAuthenticated {
                Section {
                    if urlaubManager.isLoading {
                        HStack {
                            ProgressView().scaleEffect(0.8)
                            Text("Wird geladen …").font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    if let err = urlaubManager.lastError {
                        Label(err, systemImage: "exclamationmark.triangle").font(.caption).foregroundStyle(.red)
                    }

                    // Kalender-Button
                    Button {
                        Task { await urlaubManager.refresh() }
                        zeigeKalender = true
                    } label: {
                        Label("Team-Kalender anzeigen", systemImage: "calendar")
                    }

                    // Neuer Antrag
                    Button { showPortalAntrag = true } label: {
                        Label("Urlaub beim Portal beantragen", systemImage: "plus.circle.fill")
                    }
                } header: {
                    Text("IMMOBILIENTOOL Portal")
                }

                if !urlaubManager.meineAntraege.isEmpty {
                    Section(header: Text("Meine Portal-Anträge")) {
                        ForEach(urlaubManager.meineAntraege.filter {
                            let y = $0.startDatum.prefix(4)
                            return y == String(selectedYear)
                        }) { antrag in
                            PortalUrlaubAntragZeile(antrag: antrag)
                        }
                    }
                }
            }
        }
    }

    private func transferToNextYear(remaining: Double) {
        let nextYear = selectedYear + 1
        if !years.contains(nextYear) {
            activatedYearsString += ",\(nextYear)"
        }
        UserDefaults.standard.set(remaining, forKey: "vacationCarriedOver_\(nextYear)")
        selectedYear = nextYear
    }

    private func calculateStats(for year: Int) -> (totalAvailable: Double, taken: Double, remaining: Double) {
        let totalKey = "totalVacationDays_\(year)"
        let carriedKey = "vacationCarriedOver_\(year)"

        let total = UserDefaults.standard.double(forKey: totalKey) == 0
            ? 20.0
            : UserDefaults.standard.double(forKey: totalKey)
        let carried = UserDefaults.standard.double(forKey: carriedKey)
        let taken = Double(vacationEntries.count)

        return (total + carried, taken, total + carried - taken)
    }

    private func deleteVacation(at offsets: IndexSet) {
        for index in offsets {
            modelContext.delete(vacationEntries[index])
        }

        do {
            try modelContext.save()
            TrackingBridge.markDataChanged()
        } catch {
            print("Fehler beim Löschen des Urlaubseintrags: \(error)")
        }
    }
}

struct YearlyConfigView: View {
    let year: Int
    @Binding var total: Double

    @AppStorage(SharedDefaults.entryDate, store: .sharedGroup) private var joinDate: Double = Date().timeIntervalSince1970
    @AppStorage("useJoinDateCalculation_global") private var useJoin: Bool = false
    @AppStorage("baseYearlyEntitlement_global") private var baseEntitlement: Double = 20.0

    var body: some View {
        VStack(spacing: 12) {
            Stepper(
                value: Binding(
                    get: { baseEntitlement },
                    set: {
                        baseEntitlement = $0
                        runCalculation()
                    }
                ),
                in: 0...50,
                step: 0.5
            ) {
                HStack {
                    Text("Basisanspruch:")
                    Spacer()
                    Text("\(baseEntitlement, specifier: "%.1f") Tage")
                }
            }

            Toggle("Anteilig berechnen (Eintritt)", isOn: Binding(
                get: { useJoin },
                set: {
                    useJoin = $0
                    runCalculation()
                }
            ))

            if useJoin {
                DatePicker(
                    "Eintrittsdatum",
                    selection: Binding(
                        get: { Date(timeIntervalSince1970: joinDate) },
                        set: {
                            joinDate = $0.timeIntervalSince1970
                            runCalculation()
                        }
                    ),
                    displayedComponents: .date
                )
            }
        }
        .onAppear {
            runCalculation()
        }
    }

    private func runCalculation() {
        let calendar = Calendar.current
        let entryDate = Date(timeIntervalSince1970: joinDate)
        let entryYear = calendar.component(.year, from: entryDate)

        if useJoin {
            if entryYear == year {
                let startMonth = calendar.component(.month, from: entryDate)
                let monthsRemaining = 12 - startMonth + 1
                let proRata = (baseEntitlement / 12.0) * Double(monthsRemaining)
                total = (proRata * 100).rounded() / 100
            } else if entryYear < year {
                total = baseEntitlement
            } else {
                total = 0.0
            }
        } else {
            total = baseEntitlement
        }
    }
}

struct AddVacationView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @State private var selectedDate: Date

    init(preselectedYear: Int) {
        let defaultDate = Calendar.current.date(
            from: DateComponents(year: preselectedYear, month: 1, day: 1)
        ) ?? Date()
        _selectedDate = State(initialValue: defaultDate)
    }

    var body: some View {
        NavigationStack {
            Form {
                DatePicker("Datum wählen", selection: $selectedDate, displayedComponents: .date)
                    .datePickerStyle(.graphical)
            }
            .navigationTitle("Urlaub eintragen")
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarItems(
                leading:
                    Button("Abbrechen") {
                        dismiss()
                    },
                trailing:
                    Button("Speichern") {
                        let newEntry = WorkEntry(startTime: selectedDate, endTime: selectedDate, isVacation: true)
                        modelContext.insert(newEntry)

                        do {
                            try modelContext.save()
                            TrackingBridge.markDataChanged()
                            dismiss()
                        } catch {
                            print("Fehler beim Speichern des Urlaubseintrags: \(error)")
                        }
                    }
            )
        }
    }
}

struct HolidaySettingsView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \Holiday.date) private var storedHolidays: [Holiday]
    @AppStorage("syncedYearsJSON") private var syncedYearsJSON: String = "[]"
    @AppStorage("selectedHolidayCanton") private var selectedCanton: String = "BL"

    @State private var sectionExpandedStates: [Int: Bool] = [:]

    private let cantons: [(code: String, label: String)] = [
        ("BS", "Basel-Stadt"),
        ("BL", "Basel-Landschaft"),
        ("AG", "Aargau"),
        ("SO", "Solothurn")
    ]

    private var syncedYears: Set<Int> {
        let data = syncedYearsJSON.data(using: .utf8) ?? Data()
        return (try? JSONDecoder().decode(Set<Int>.self, from: data)) ?? []
    }

    private let years: [Int] = [2026, 2027, 2028, 2029, 2030]

    private var holidaysByYear: [Int: [Holiday]] {
        Dictionary(grouping: storedHolidays) { holiday in
            Calendar.current.component(.year, from: holiday.date)
        }
    }

    var body: some View {
        List {
            Section(header: Text("Kanton")) {
                Picker("Kanton", selection: $selectedCanton) {
                    ForEach(cantons, id: \.code) { c in
                        Text(c.label).tag(c.code)
                    }
                }
                .pickerStyle(.segmented)
                .onChange(of: selectedCanton) {
                    // Bestehende Feiertage löschen damit beim nächsten Sync der richtige Kanton geladen wird
                    for holiday in storedHolidays { modelContext.delete(holiday) }
                    syncedYearsJSON = "[]"
                    try? modelContext.save()
                }
            }

            ForEach(years, id: \.self) { year in
                DisclosureGroup(isExpanded: Binding(
                    get: { sectionExpandedStates[year, default: false] },
                    set: { sectionExpandedStates[year] = $0 }
                )) {
                    let holidays = holidaysByYear[year] ?? []
                    if holidays.isEmpty {
                        HStack {
                            Text("Noch keine Feiertage geladen")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                            Spacer()
                            Button("Sync") {
                                syncHolidays(for: year)
                            }
                            .buttonStyle(.borderedProminent)
                            .controlSize(.small)
                        }
                        .padding(.vertical, 4)
                    } else {
                        ForEach(holidays) { holiday in
                            HStack {
                                Text(holiday.name)
                                Spacer()
                                Text(holiday.date, format: .dateTime.day().month().year())
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                } label: {
                    HStack {
                        Text("Jahr \(String(year))")
                            .font(.body)
                            .foregroundColor(.primary)
                        Spacer()
                        if syncedYears.contains(year) {
                            HStack(spacing: 4) {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(.green)
                                Text("Aktuell")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("Feiertage (\(selectedCanton))")
        .onAppear {
            if sectionExpandedStates.isEmpty {
                sectionExpandedStates[2026] = true
            }
        }
    }

    func syncHolidays(for year: Int) {
        let calendar = Calendar.current
        var holidaysToInsert: [(date: Date, name: String)] = []

        // Gemeinsame Feiertage aller vier Kantone
        let gemeinsam: [(month: Int, day: Int, name: String)] = [
            (1, 1, "Neujahr"),
            (5, 1, "Tag der Arbeit"),
            (8, 1, "Nationalfeiertag"),
            (12, 25, "Weihnachten"),
            (12, 26, "Stephanstag")
        ]
        for def in gemeinsam {
            if let date = calendar.date(from: DateComponents(year: year, month: def.month, day: def.day)) {
                holidaysToInsert.append((date, def.name))
            }
        }

        // Berchtoldstag: AG und SO (2. Januar)
        if selectedCanton == "AG" || selectedCanton == "SO" {
            if let date = calendar.date(from: DateComponents(year: year, month: 1, day: 2)) {
                holidaysToInsert.append((date, "Berchtoldstag"))
            }
        }

        // Osterbasierte Feiertage
        if let ostern = calculateEaster(for: year) {
            // Karfreitag, Ostermontag, Auffahrt, Pfingstmontag: alle vier Kantone
            let alleKantone: [(days: Int, name: String)] = [
                (-2, "Karfreitag"),
                (1, "Ostermontag"),
                (39, "Auffahrt"),
                (50, "Pfingstmontag")
            ]
            for shift in alleKantone {
                if let date = calendar.date(byAdding: .day, value: shift.days, to: ostern) {
                    holidaysToInsert.append((date, shift.name))
                }
            }

            // Fronleichnam (60 Tage nach Ostern): AG und SO
            if selectedCanton == "AG" || selectedCanton == "SO" {
                if let date = calendar.date(byAdding: .day, value: 60, to: ostern) {
                    holidaysToInsert.append((date, "Fronleichnam"))
                }
            }
        }

        // Allerheiligen (1. November): AG und SO
        if selectedCanton == "AG" || selectedCanton == "SO" {
            if let date = calendar.date(from: DateComponents(year: year, month: 11, day: 1)) {
                holidaysToInsert.append((date, "Allerheiligen"))
            }
        }

        // Maria Empfängnis (8. Dezember): AG und SO
        if selectedCanton == "AG" || selectedCanton == "SO" {
            if let date = calendar.date(from: DateComponents(year: year, month: 12, day: 8)) {
                holidaysToInsert.append((date, "Maria Empfängnis"))
            }
        }

        for holiday in holidaysToInsert {
            if !storedHolidays.contains(where: { calendar.isDate($0.date, inSameDayAs: holiday.date) }) {
                modelContext.insert(Holiday(date: holiday.date, name: holiday.name))
            }
        }

        var updatedSet = syncedYears
        updatedSet.insert(year)
        if let data = try? JSONEncoder().encode(updatedSet),
           let jsonString = String(data: data, encoding: .utf8) {
            syncedYearsJSON = jsonString
        }

        do {
            try modelContext.save()
            TrackingBridge.markDataChanged()
        } catch {
            print("Fehler beim Speichern der Feiertage: \(error)")
        }
    }

    private func calculateEaster(for year: Int) -> Date? {
        let a = year % 19
        let b = year / 100
        let c = year % 100
        let d = b / 4
        let e = b % 4
        let f = (b + 8) / 25
        let g = (b - f + 1) / 3
        let h = (19 * a + b - d - g + 15) % 30
        let i = c / 4
        let k = c % 4
        let l = (32 + 2 * e + 2 * i - h - k) % 7
        let m = (a + 11 * h + 22 * l) / 451
        let month = (h + l - 7 * m + 114) / 31
        let day = ((h + l - 7 * m + 114) % 31) + 1
        return Calendar.current.date(from: DateComponents(year: year, month: month, day: day))
    }
}

struct HolidayYearSection: View {
    let year: Int
    var isExpanded: Binding<Bool>
    let holidays: [Holiday]

    var body: some View {
        Section(isExpanded: isExpanded) {
            ForEach(holidays) { holiday in
                HStack {
                    Text(holiday.name)
                    Spacer()
                    Text(holiday.date, format: .dateTime.day().month().year())
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        } header: {
            Text("Feiertage \(String(year))")
        }
    }
}
