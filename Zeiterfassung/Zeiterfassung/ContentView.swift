//
//  ContentView.swift
//  Zeiterfassung
//
//  Open-source template on 17.05.2026.
//

import SwiftUI
import SwiftData
import CoreLocation
import ActivityKit
import UserNotifications
import UIKit

struct URLItem: Identifiable {
    let id = UUID()
    let url: URL
}

struct ContentView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.colorScheme) private var colorScheme
    @Environment(TrackingStore.self) private var trackingStore

    @Query(sort: \WorkEntry.startTime, order: .reverse) private var entries: [WorkEntry]
    @Query private var weeklySolls: [WeeklySoll]
    @Query(sort: \Holiday.date, order: .reverse) private var storedHolidays: [Holiday]
    @Query(sort: \SpesenEintrag.date, order: .reverse) private var expenses: [SpesenEintrag]

    @AppStorage(SharedDefaults.userName, store: .sharedGroup) private var userName = ""
    @AppStorage(SharedDefaults.userLastName, store: .sharedGroup) private var userLastName = ""
    @AppStorage(SharedDefaults.isGeofenceEnabled, store: .sharedGroup) private var isGeofenceEnabled = false

    @AppStorage("sollMo") private var sollMo = 8.3
    @AppStorage("sollDi") private var sollDi = 8.3
    @AppStorage("sollMi") private var sollMi = 8.3
    @AppStorage("sollDo") private var sollDo = 8.3
    @AppStorage("sollFr") private var sollFr = 8.3
    @AppStorage("sollSa") private var sollSa = 0.0
    @AppStorage("sollSo") private var sollSo = 0.0

    @State private var locationManager = LocationManager()
    @State private var secondsElapsed = 0
    @State private var timer: Timer?
    @State private var selectedDate = Date()
    @State private var isCalendarExpanded = false
    @State private var showManualEntry = false
    @State private var activeShareURL: URLItem?
    @State private var showExpenseScanner = false
    @State private var selectedExpense: SpesenEintrag? = nil
    @State private var isProcessingTrackingAction = false
    @State private var refreshTrigger = UUID()
    @State private var showLockView = false

    private var entryDate: Date {
        TrackingBridge.entryDate()
    }

    // MARK: - Woche
    var currentWeekWorkTime: Double {
        let calendar = Calendar.current
        guard let startOfWeek = calendar.date(from: calendar.dateComponents([.yearForWeekOfYear, .weekOfYear], from: selectedDate)) else {
            return 0
        }

        var totalHours: Double = 0

        for dayOffset in 0..<7 {
            guard let currentDate = calendar.date(byAdding: .day, value: dayOffset, to: startOfWeek) else { continue }

            let dayEntries = entries.filter { calendar.isDate($0.startTime, inSameDayAs: currentDate) }
            let isHoliday = storedHolidays.contains(where: { calendar.isDate($0.date, inSameDayAs: currentDate) })
            let hasVacation = dayEntries.contains(where: { $0.isVacation })
            let hasSick = dayEntries.contains(where: { $0.isSick })
            let soll = getSollForDate(currentDate)

            if isHoliday || hasVacation || hasSick {
                totalHours += soll
            } else {
                let storedSeconds = dayEntries.reduce(0) { $0 + $1.totalSeconds }
                let liveSeconds = WorkDayCalculator.liveWorkedSeconds(
                    selectedDate: currentDate,
                    trackingStore: trackingStore
                )
                totalHours += Double(storedSeconds + liveSeconds) / 3600.0
            }
        }
        return totalHours
    }

    var currentWeekSoll: Double {
        let cal = Calendar.current
        guard let startOfWeek = cal.date(from: cal.dateComponents([.yearForWeekOfYear, .weekOfYear], from: selectedDate)) else {
            return 0
        }

        return (0..<7).compactMap { offset in
            cal.date(byAdding: .day, value: offset, to: startOfWeek)
        }
        .reduce(0) { partialResult, date in
            partialResult + getSollForDate(date)
        }
    }

    // MARK: - Body
    var body: some View {
        TabView {
            trackerTab.tabItem { Label("Tracker", systemImage: "clock.fill") }
            historyTab.tabItem { Label("Verlauf", systemImage: "calendar") }
            AnalyticsView().tabItem { Label("Auswertungen", systemImage: "chart.bar.doc.horizontal.fill") }
            SalaryCalculatorView().tabItem { Label("Lohnrechner", systemImage: "banknote.fill") }
            NavigationStack { SetupView() }.tabItem { Label("Einstellungen", systemImage: "gear") }
        }
        .onAppear {
            finalizePendingExternalStartIfNeeded()
            finalizePendingExternalStopIfNeeded()
            trackingStore.syncFromExternalSource()
            restoreTrackingUIIfNeeded()
            finalizeExternallyStoppedTrackingIfNeeded()
            refreshReportsIfNeeded()
        }
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.willEnterForegroundNotification)) { _ in
            finalizePendingExternalStartIfNeeded()
            finalizePendingExternalStopIfNeeded()
            trackingStore.syncFromExternalSource()
            restoreTrackingUIIfNeeded()
            finalizeExternallyStoppedTrackingIfNeeded()
            refreshReportsIfNeeded()
        }
        .onReceive(NotificationCenter.default.publisher(for: .watchDidTriggerAction)) { _ in
            finalizePendingExternalStartIfNeeded()
            finalizePendingExternalStopIfNeeded()
            trackingStore.syncFromExternalSource()
            restoreTrackingUIIfNeeded()
        }
        .onChange(of: trackingStore.isTracking) { _, isRunning in
            if isRunning {
                restoreTrackingUIIfNeeded()
            } else {
                stopUITimerOnly()
            }
        }
    }

    // MARK: - Tabs
    private var trackerTab: some View {
        NavigationStack {
            VStack {
                headerSection
                Spacer()
                Text(formatSecondsToTime(secondsElapsed))
                    .font(.system(size: 75, weight: .thin, design: .monospaced))
                Button(action: toggleTimer) {
                    ZStack {
                        Circle()
                            .fill(trackingStore.isTracking ? Color.red.gradient : Color.green.gradient)
                            .frame(width: 220, height: 220)
                        Text(trackingStore.isTracking ? "STOPP" : "START")
                            .foregroundColor(.white)
                            .font(.system(size: 30, weight: .bold))
                    }
                }
                .disabled(isProcessingTrackingAction)
                .opacity(isProcessingTrackingAction ? 0.7 : 1.0)
                .buttonStyle(.plain)
                Spacer()
                Spacer()
            }
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Text(userName.isEmpty ? "Zeiterfassung" : "\(getGreeting()), \(userName)")
                        .font(.headline)
                }
            }
        }
    }

    private var hasUnlockedPastEntries: Bool {
        let cal = Calendar.current
        let startOfThisMonth = cal.date(from: cal.dateComponents([.year, .month], from: Date())) ?? Date()
        return entries.contains { !$0.isLocked && $0.startTime < startOfThisMonth }
    }

    private var shouldShowLockRecommendation: Bool {
        let cal = Calendar.current
        let today = Date()
        let day = cal.component(.day, from: today)
        guard let range = cal.range(of: .day, in: .month, for: today) else { return false }
        let isEndOfMonth = day >= range.count - 3
        let isStartOfMonth = day <= 5
        return (isEndOfMonth || isStartOfMonth) && hasUnlockedPastEntries
    }

    private var historyTab: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if shouldShowLockRecommendation {
                    Button { showLockView = true } label: {
                        HStack(spacing: 10) {
                            Image(systemName: "lock.doc.fill")
                                .foregroundStyle(.orange)
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Zeiten festschreiben empfohlen")
                                    .font(.subheadline.bold())
                                    .foregroundStyle(.primary)
                                Text("Schreibe vergangene Monate zur Revisionssicherheit fest.")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .padding(12)
                        .background(Color.orange.opacity(0.1))
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.orange.opacity(0.3), lineWidth: 1))
                        .padding(.horizontal, 12)
                        .padding(.top, 8)
                    }
                    .buttonStyle(.plain)
                }
                calendarHeader
                List {
                    Section {
                        DashboardHeaderView(
                            ist: currentWeekWorkTime,
                            soll: currentWeekSoll,
                            date: selectedDate
                        )
                        .listRowInsets(EdgeInsets())
                        .background(Color(.systemGroupedBackground))
                    }
                    dailySummarySection
                    overtimeSection
                    entriesSection
                    expensesDaySection
                }
            }
            .navigationTitle("Verlauf")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { showManualEntry = true } label: {
                        HStack {
                            Image(systemName: "plus.circle")
                            Text("Manuell")
                        }
                    }
                }
                ToolbarItem(placement: .principal) {
                    Text(userName.isEmpty ? "Zeiterfassung" : "\(getGreeting()), \(userName)")
                        .font(.headline)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    HStack(spacing: 4) {
                        Button {
                            showLockView = true
                        } label: {
                            ZStack(alignment: .topTrailing) {
                                Image(systemName: "lock.doc")
                                if hasUnlockedPastEntries {
                                    Circle()
                                        .fill(.orange)
                                        .frame(width: 8, height: 8)
                                        .offset(x: 4, y: -4)
                                }
                            }
                        }

                        Menu {
                            Section("Monats-Bericht") {
                                Button { prepareExport(asPdf: true, isYearly: false) } label: { Label("PDF Export", systemImage: "doc.text") }
                                Button { prepareExport(asPdf: false, isYearly: false) } label: { Label("Excel (CSV) Export", systemImage: "tablecells") }
                            }
                            Section("Jahres-Bericht") {
                                Button { prepareExport(asPdf: true, isYearly: true) } label: { Label("Jahres-PDF", systemImage: "doc.text.fill") }
                                Button { prepareExport(asPdf: false, isYearly: true) } label: { Label("Jahres-Excel (CSV)", systemImage: "tablecells.fill") }
                            }
                        } label: {
                            Image(systemName: "square.and.arrow.up")
                        }
                    }
                }
            }
        }
        .sheet(isPresented: $showLockView) { LockEntriesView() }
        .sheet(item: $activeShareURL) { item in ShareSheet(activityItems: [item.url]) }
        .sheet(isPresented: $showExpenseScanner) {
            DocumentScannerView(isPresented: $showExpenseScanner) { scannedImage in
                let imgData = scannedImage.jpegData(compressionQuality: 0.7)
                let newExpense = SpesenEintrag(
                    date: selectedDate,
                    title: "Spese \(selectedDate.formatted(date: .abbreviated, time: .omitted))",
                    amount: 0.0,
                    image: imgData
                )
                modelContext.insert(newExpense)
                saveContextAndRefresh()
            }
        }
        .sheet(item: $selectedExpense) { expense in ExpenseDetailView(expense: expense) }
        .sheet(isPresented: $showManualEntry) { AddManualWorkView(preselectedDate: selectedDate) }
    }

    // MARK: - Hilfsfunktion für neue Einträge
    private func addSpecialEntry(_ type: SpecialEntryType) {
        let calendar = Calendar.current
        let dayEntries = entries.filter { calendar.isDate($0.startTime, inSameDayAs: selectedDate) }
        
        let alreadyExists = dayEntries.contains {
            switch type {
            case .vacation: return $0.isVacation
            case .sick: return $0.isSick
            case .overtimeReduction: return $0.isOvertimeReduction
            }
        }
        guard !alreadyExists else { return }
        
        let entry = WorkEntry(
            startTime: selectedDate,
            endTime: selectedDate,
            isVacation: type == .vacation,
            isSick: type == .sick,
            isOvertimeReduction: type == .overtimeReduction,
            overtimeReductionHours: type == .overtimeReduction ? 4.0 : 0.0
        )
        
        modelContext.insert(entry)
        saveContextAndRefresh()
    }

    enum SpecialEntryType {
        case vacation, sick, overtimeReduction
    }

    // MARK: - UI-Sektionen
    var headerSection: some View {
        VStack(spacing: 12) {
            Image("logo-immobilientool")
                .resizable()
                .scaledToFit()
                .frame(maxWidth: 250, maxHeight: 45)
                .padding(8)
                .background(colorScheme == .dark ? Color.white.opacity(0.9) : Color.clear)
                .cornerRadius(8)
                .padding(.top, 30)

            Text("Zeiterfassung für Portal-Immobilien")
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(.secondary)
        }
    }

    var calendarHeader: some View {
        VStack {
            if isCalendarExpanded {
                DatePicker("Datum", selection: $selectedDate, displayedComponents: .date)
                    .datePickerStyle(.graphical)
            } else {
                DatePicker("Datum", selection: $selectedDate, displayedComponents: .date)
                    .datePickerStyle(.compact)
            }

            Button(isCalendarExpanded ? "Zusammenfalten" : "Kalender zeigen") {
                withAnimation { isCalendarExpanded.toggle() }
            }
            .font(.caption)
        }
        .padding()
        .background(Color(UIColor.secondarySystemBackground))
    }

    var dailySummarySection: some View {
        Section("Tages-Bilanz") {
            let calendar = Calendar.current
            let dayEntries = entries.filter { calendar.isDate($0.startTime, inSameDayAs: selectedDate) }
            let isHoliday = storedHolidays.contains(where: { calendar.isDate($0.date, inSameDayAs: selectedDate) })
            let hasVacation = dayEntries.contains(where: { $0.isVacation })
            let hasSick = dayEntries.contains(where: { $0.isSick })
            let soll = getSollForDate(selectedDate)

            let storedSeconds = dayEntries.reduce(0) { $0 + $1.totalSeconds }
            let liveSeconds = WorkDayCalculator.liveWorkedSeconds(selectedDate: selectedDate, trackingStore: trackingStore)

            let ist = (isHoliday || hasVacation || hasSick) ? Int(soll * 3600) : (storedSeconds + liveSeconds)
            let diff = ist - Int(soll * 3600)

            HStack {
                Text("IST:")
                Spacer()
                if isHoliday { Text("Feiertag").bold().foregroundColor(.orange) }
                else if hasVacation { Text("Urlaub").bold().foregroundColor(.orange) }
                else if hasSick { Text("Krankheitstag").bold().foregroundColor(.red) }
                else { Text(formatSecondsToTime(ist)).bold() }
            }

            HStack {
                Text("SOLL:")
                Spacer()
                Text(String(format: "%.2f h", soll))
            }

            HStack {
                Text("Diff:")
                Spacer()
                let prefix = diff >= 0 ? "+" : "-"
                Text("\(prefix)\(formatSecondsToTime(abs(diff)))")
                    .foregroundColor(diff >= 0 ? .green : .red)
                    .bold()
            }
        }
    }
    
    var overtimeSection: some View {
        Section("Überstunden") {
            HStack {
                Text("Gesamt Überstunden")
                Spacer()
                Text(String(format: "%+.2f h", currentOvertimeBalance))
                    .foregroundColor(currentOvertimeBalance >= 0 ? .green : .red)
                    .bold()
            }
        }
    }

    var entriesSection: some View {
        Section("Einträge") {
            if let holiday = storedHolidays.first(where: { Calendar.current.isDate($0.date, inSameDayAs: selectedDate) }) {
                HStack {
                    Image(systemName: "calendar.badge.exclamationmark")
                    Text("\(holiday.name) (Feiertag)")
                    Spacer()
                }
                .foregroundColor(.orange)
                .listRowBackground(Color.orange.opacity(0.1))
            }

            let dayEntries = entries.filter { Calendar.current.isDate($0.startTime, inSameDayAs: selectedDate) }

            if dayEntries.isEmpty &&
                !storedHolidays.contains(where: { Calendar.current.isDate($0.date, inSameDayAs: selectedDate) }) &&
                WorkDayCalculator.liveWorkedSeconds(selectedDate: selectedDate, trackingStore: trackingStore) == 0 {
                Text("Keine Einträge für diesen Tag")
                    .foregroundColor(.secondary)
                    .font(.caption)
            }

            if WorkDayCalculator.liveWorkedSeconds(selectedDate: selectedDate, trackingStore: trackingStore) > 0,
               let liveStart = trackingStore.currentStart {
                VStack(alignment: .leading, spacing: 4) {
                    Text("🟢 Laufende Erfassung").font(.headline)
                    Text("\(liveStart, style: .time) - jetzt").font(.subheadline)
                    Text(formatSecondsToTime(WorkDayCalculator.liveWorkedSeconds(selectedDate: selectedDate, trackingStore: trackingStore)))
                        .font(.caption)
                        .foregroundColor(.green)
                }
            }

            ForEach(dayEntries) { entry in
                NavigationLink(destination: EntryDetailView(entry: entry)) {
                    VStack(alignment: .leading, spacing: 4) {
                        Group {
                            if entry.isVacation {
                                Text("🌴 Urlaubstag")
                            } else if entry.isSick {
                                Text("🤒 Krankheitstag")
                            } else if entry.isOvertimeReduction {
                                Text("⏰ Überstundenabbau (- \(entry.overtimeReductionHours, specifier: "%.1f") h)")
                            } else {
                                Text("⏱️ \(entry.startTime, style: .time) - \(entry.endTime, style: .time)")
                            }
                        }
                        .font(.headline)

                        if !entry.isVacation && !entry.isSick && !entry.isOvertimeReduction {
                            Text(formatSecondsToTime(entry.totalSeconds))
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                }
            }
            .onDelete { offsets in
                for i in offsets {
                    let entry = dayEntries[i]
                    guard !entry.isLocked else { continue }
                    modelContext.delete(entry)
                }
                saveContextAndRefresh()
            }

            // === PROFESSIONELLERE BUTTON-LEISTE ===
            VStack(spacing: 12) {
                HStack(spacing: 12) {
                    ActionButton(title: "Spesen erfassen", icon: "doc.viewfinder", color: .blue) {
                        showExpenseScanner = true
                    }
                    
                    ActionButton(title: "Urlaub eintragen", icon: "sun.max.fill", color: .orange) {
                        addSpecialEntry(.vacation)
                    }
                }
                
                HStack(spacing: 12) {
                    ActionButton(title: "Krankheitstag", icon: "cross.case.fill", color: .red) {
                        addSpecialEntry(.sick)
                    }
                    
                    ActionButton(title: "Überst. abbauen", icon: "timer", color: .purple) {
                        addSpecialEntry(.overtimeReduction)
                    }
                }
            }
            .padding(.top, 8)
        }
    }

    // Hilfs-View für schöne Buttons
    struct ActionButton: View {
        let title: String
        let icon: String
        let color: Color
        let action: () -> Void
        
        var body: some View {
            Button(action: action) {
                HStack {
                    Image(systemName: icon)
                    Text(title)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(color.opacity(0.1))
                .foregroundColor(color)
                .cornerRadius(12)
                .font(.subheadline.weight(.semibold))
            }
            .buttonStyle(.plain)
        }
    }
    
    var expensesDaySection: some View {
        Section("Erfasste Spesen an diesem Tag") {
            let dayExpenses = expenses.filter { Calendar.current.isDate($0.date, inSameDayAs: selectedDate) }

            if dayExpenses.isEmpty {
                Text("Keine Spesen für diesen Tag")
                    .font(.caption)
                    .foregroundColor(.secondary)
            } else {
                ForEach(dayExpenses) { expense in
                    HStack {
                        if let imgData = expense.image, let uiImg = UIImage(data: imgData) {
                            Image(uiImage: uiImg)
                                .resizable()
                                .scaledToFill()
                                .frame(width: 40, height: 40)
                                .cornerRadius(4)
                        }

                        VStack(alignment: .leading) {
                            Text(expense.title).font(.headline)
                            Text("\(String(format: "%.2f", expense.amount)) CHF")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }
                        Spacer()
                    }
                    .contentShape(Rectangle())
                    .onTapGesture { selectedExpense = expense }
                }
                .onDelete { offsets in
                    for index in offsets {
                        modelContext.delete(dayExpenses[index])
                    }
                    saveContextAndRefresh()
                }
            }
        }
    }

    // MARK: - currentOvertimeBalance
    var currentOvertimeBalance: Double {
        let _ = refreshTrigger  // Dummy-Abhängigkeit → erzwingt Update
        
        let calendar = Calendar.current
        let endOfSelectedDate = calendar.startOfDay(for: selectedDate)

        let relevantEntries = entries.filter {
            calendar.startOfDay(for: $0.startTime) <= endOfSelectedDate
        }

        let groupedEntries = Dictionary(grouping: relevantEntries) {
            calendar.startOfDay(for: $0.startTime)
        }

        // Safeguard: entryDate kann .distantPast sein wenn nie gesetzt → Loop würde von Jahr 1 iterieren
        let safeEntryDate: Date
        if entryDate <= calendar.date(byAdding: .year, value: -10, to: Date()) ?? Date() {
            // Kein gültiges Eintrittsdatum gesetzt → frühesten Eintrag oder Jahresanfang nutzen
            let earliest = entries.min(by: { $0.startTime < $1.startTime })?.startTime
            safeEntryDate = earliest ?? (calendar.date(from: DateComponents(
                year: calendar.component(.year, from: Date()), month: 1, day: 1
            )) ?? Date())
        } else {
            safeEntryDate = entryDate
        }

        var totalBalance: Double = 0
        var currentDate = calendar.startOfDay(for: safeEntryDate)
        let lastDate = endOfSelectedDate

        while currentDate <= lastDate {
            let dayEntries = groupedEntries[currentDate] ?? []
            let isHoliday = storedHolidays.contains(where: {
                calendar.isDate($0.date, inSameDayAs: currentDate)
            })
            let hasVacation = dayEntries.contains(where: { $0.isVacation })
            let soll = getSollForDate(currentDate)

            let istHours: Double
            if isHoliday || hasVacation {
                istHours = soll
            } else {
                let storedSeconds = dayEntries.reduce(0) { $0 + $1.totalSeconds }
                let liveSeconds = calendar.isDate(currentDate, inSameDayAs: Date()) ?
                    WorkDayCalculator.liveWorkedSeconds(selectedDate: currentDate, trackingStore: trackingStore) : 0
                istHours = Double(storedSeconds + liveSeconds) / 3600.0
            }

            totalBalance += (istHours - soll)

            guard let nextDate = calendar.date(byAdding: .day, value: 1, to: currentDate) else { break }
            currentDate = nextDate
        }

        return totalBalance
    }

    // MARK: - Timer / Tracking
    func toggleTimer() {
        guard !isProcessingTrackingAction else { return }
        isProcessingTrackingAction = true

        if trackingStore.isTracking {
            stopTracking(trigger: "app")
        } else {
            startTracking()
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
            isProcessingTrackingAction = false
        }
    }

    func startTracking() {
        locationManager.startUpdating()

        let now = Date()
        let startLocation: String? = locationManager.lastLocation.map {
            "\($0.coordinate.latitude),\($0.coordinate.longitude)"
        }

        trackingStore.start(startTime: now, startLocation: startLocation)
        secondsElapsed = 0
        startUITimer()
        startLiveActivity(startTime: now)
        TrackingBridge.markDataChanged()
        WatchSessionManager.shared.sendCurrentState()
    }

    func stopTracking(trigger: String) {
        guard trackingStore.isTracking, let startDate = trackingStore.currentStart else {
            trackingStore.stop()
            stopUITimerOnly()
            stopLiveActivity()
            return
        }

        let endDate = Date()
        let entry = WorkEntry(startTime: startDate, endTime: endDate, startLoc: trackingStore.currentStartLocation)

        modelContext.insert(entry)
        try? modelContext.save()

        locationManager.stopUpdating()
        trackingStore.stop()
        stopUITimerOnly()
        stopLiveActivity()
        refreshReportsIfNeeded()
        TrackingBridge.markDataChanged()
        WatchSessionManager.shared.sendCurrentState()

        print("Tracking gestoppt via: \(trigger)")
    }

    func restoreTrackingUIIfNeeded() {
        if trackingStore.isTracking {
            secondsElapsed = trackingStore.elapsedSeconds
            startUITimer()
            if let start = trackingStore.currentStart {
                startLiveActivity(startTime: start)
            }
        } else {
            stopUITimerOnly()
            secondsElapsed = 0
        }
    }

    func finalizePendingExternalStartIfNeeded() {
        guard let payload = PendingStartBridge.load() else { return }

        if trackingStore.isTracking {
            PendingStartBridge.clear()
            return
        }

        let snapshot = TrackingBridge.loadSnapshot()
        if snapshot.isTracking,
           snapshot.sessionID == payload.sessionID,
           snapshot.startTime == payload.startTime {
            trackingStore.syncFromExternalSource()
            secondsElapsed = trackingStore.elapsedSeconds
            startUITimer()
            if let start = trackingStore.currentStart {
                startLiveActivity(startTime: start)
            }
            PendingStartBridge.clear()
          
            return
        }

        trackingStore.start(
            startTime: payload.startTime,
            startLocation: payload.startLocation,
            sessionID: payload.sessionID
        )

        secondsElapsed = trackingStore.elapsedSeconds
        startUITimer()
        startLiveActivity(startTime: payload.startTime)
        PendingStartBridge.clear()
        TrackingBridge.markDataChanged()

        print("Externer Start übernommen: \(payload.source)")
    }

    func finalizePendingExternalStopIfNeeded() {
        guard let payload = PendingStopBridge.load() else { return }

        let alreadyExists = entries.contains {
            $0.startTime == payload.startTime &&
            $0.endTime == payload.endTime &&
            $0.startLoc == payload.startLocation
        }

        if alreadyExists {
            PendingStopBridge.clear()
            return
        }

        let entry = WorkEntry(
            startTime: payload.startTime,
            endTime: payload.endTime,
            startLoc: payload.startLocation
        )

        modelContext.insert(entry)

        do {
            try modelContext.save()
            PendingStopBridge.clear()
            TrackingBridge.markDataChanged()
            refreshReportsIfNeeded()

            print("Externer Stop verbucht: \(payload.source)")
        } catch {
            print("Fehler beim finalen Verbuchen des externen Stops: \(error)")
        }
    }

    func finalizeExternallyStoppedTrackingIfNeeded() {
        let sharedSnapshot = TrackingBridge.loadSnapshot()

        if sharedSnapshot.isTracking == false {
            trackingStore.syncFromExternalSource()
            stopUITimerOnly()
            secondsElapsed = 0
            stopLiveActivity()
        }
    }

    func startUITimer() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
            Task { @MainActor in
                guard trackingStore.isTracking, let start = trackingStore.currentStart else {
                    stopUITimerOnly()
                    return
                }

                let elapsed = max(0, Int(Date().timeIntervalSince(start)))
                secondsElapsed = elapsed
                updateLiveActivity(startTime: start, seconds: elapsed)
            }
        }
    }

    func stopUITimerOnly() {
        timer?.invalidate()
        timer = nil
    }

    // MARK: - Soll / Reports

    func getSollForDate(_ date: Date) -> Double {
        WorkDayCalculator.sollForDate(
            date,
            weeklySolls: weeklySolls,
            defaultMo: sollMo,
            defaultDi: sollDi,
            defaultMi: sollMi,
            defaultDo: sollDo,
            defaultFr: sollFr,
            defaultSa: sollSa,
            defaultSo: sollSo,
            entryDate: entryDate
        )
    }

    func prepareExport(asPdf: Bool, isYearly: Bool = false) {
        let cal = Calendar.current
        let year = cal.component(.year, from: selectedDate)
        let month = cal.component(.month, from: selectedDate)

        let generatedURL: URL?

        if isYearly {
            generatedURL = asPdf
                ? ExportManager.createYearlyPDF(
                    entries: entries,
                    year: year,
                    firstName: userName,
                    lastName: userLastName,
                    logo: UIImage(named: "logo-immobilientool"),
                    sollProvider: { getSollForDate($0) }
                )
                : ExportManager.createYearlyCSV(
                    entries: entries,
                    year: year,
                    sollProvider: { getSollForDate($0) }
                )
        } else {
            generatedURL = asPdf
                ? ExportManager.createMonthPDF(
                    entries: entries,
                    holidays: storedHolidays,
                    year: year,
                    month: month,
                    firstName: userName,
                    lastName: userLastName,
                    logo: UIImage(named: "logo-immobilientool"),
                    sollProvider: { getSollForDate($0) }
                )
                : ExportManager.createMonthCSV(
                    entries: entries,
                    year: year,
                    month: month,
                    sollProvider: { getSollForDate($0) }
                )
        }

        guard let url = generatedURL else { return }

        activeShareURL = URLItem(url: url)

        guard asPdf, let fileData = try? Data(contentsOf: url) else { return }

        let targetDate: Date
        let docTitle: String
        let docType: String
        let category: String
        let docMonth: Int

        let cal2 = Calendar.current

        if isYearly {
            targetDate = cal2.date(from: DateComponents(year: year, month: 1, day: 1)) ?? selectedDate
            docTitle = "Jahresreport \(year)"
            docType = "jahresbericht"
            category = "yearlyReport"
            docMonth = 1
        } else {
            targetDate = cal2.date(from: DateComponents(year: year, month: month, day: 1)) ?? selectedDate
            let monthName = targetDate.formatted(.dateTime.month(.wide))
            docTitle = "Monatsreport \(monthName) \(year)"
            docType = "monatsbericht"
            category = "monthlyReport"
            docMonth = month
        }

        do {
            let existingDocs = try modelContext.fetch(FetchDescriptor<StoredDocument>())

            if let existing = existingDocs.first(where: {
                $0.title == docTitle &&
                $0.category == category &&
                $0.year == year &&
                $0.month == docMonth
            }) {
                existing.fileData = fileData
                existing.date = targetDate
                existing.source = "historyExport"
            } else {
                let reportDoc = StoredDocument(
                    date: targetDate,
                    title: docTitle,
                    fileData: fileData,
                    type: docType,
                    year: year,
                    month: docMonth,
                    category: category,
                    source: "historyExport"
                )
                modelContext.insert(reportDoc)
            }

            try modelContext.save()
            TrackingBridge.markReportsRefreshed()
        } catch {
            print("Fehler beim Speichern des Reports: \(error)")
        }
    }

    func refreshReportsIfNeeded() {
        ReportRefreshService.refreshStoredReports(
            modelContext: modelContext,
            entries: entries,
            holidays: storedHolidays,
            firstName: userName,
            lastName: userLastName,
            logo: UIImage(named: "logo-immobilientool"),
            sollProvider: { getSollForDate($0) }
        )
    }

    func saveContextAndRefresh() {
        do {
            try modelContext.save()
            TrackingBridge.markDataChanged()
            refreshReportsIfNeeded()
            
            refreshTrigger = UUID()
        } catch {
            print("Fehler beim Speichern: \(error)")
        }
    }

    // MARK: - Live Activities (App‑Seite)

    func startLiveActivity(startTime: Date) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }

        Task {
            let existing = Activity<WorkAttributes>.activities

            if existing.count > 1 {
                for activity in existing.dropFirst() {
                    let endState = WorkAttributes.ContentState(
                        startTime: startTime,
                        isRunning: false
                    )
                    let content = ActivityContent(state: endState, staleDate: Date())
                    await activity.end(content, dismissalPolicy: .immediate)
                }
            }

            if let current = Activity<WorkAttributes>.activities.first {
                let updatedState = WorkAttributes.ContentState(
                    startTime: startTime,
                    isRunning: true
                )
                let content = ActivityContent(state: updatedState, staleDate: nil)
                await current.update(content)
                return
            }

            let attributes = WorkAttributes(title: "Zeiterfassung")
            let state = WorkAttributes.ContentState(
                startTime: startTime,
                isRunning: true
            )
            let content = ActivityContent(state: state, staleDate: nil)

            do {
                _ = try Activity<WorkAttributes>.request(
                    attributes: attributes,
                    content: content,
                    pushType: nil
                )
            } catch {
                print("Live Activity konnte nicht gestartet werden: \(error.localizedDescription)")
            }
        }
    }

    func updateLiveActivity(startTime: Date, seconds: Int) {
        let updatedState = WorkAttributes.ContentState(
            startTime: startTime,
            isRunning: true
        )

        let content = ActivityContent(state: updatedState, staleDate: nil)

        Task {
            for activity in Activity<WorkAttributes>.activities {
                await activity.update(content)
            }
        }
    }

    func stopLiveActivity() {
        Task {
            for activity in Activity<WorkAttributes>.activities {
                let endState = WorkAttributes.ContentState(
                    startTime: Date(),
                    isRunning: false
                )

                let content = ActivityContent(state: endState, staleDate: Date())
                await activity.end(content, dismissalPolicy: .immediate)
            }
        }
    }

    // MARK: - Helpers

    func getGreeting() -> String {
        let hour = Calendar.current.component(.hour, from: Date())
        switch hour {
        case 5..<11: return "Guten Morgen"
        case 11..<14: return "Guten Mittag"
        case 14..<18: return "Guten Tag"
        default: return "Guten Abend"
        }
    }

    func formatSecondsToTime(_ seconds: Int) -> String {
        let h = seconds / 3600
        let m = (seconds % 3600) / 60
        let s = seconds % 60
        return String(format: "%02d:%02d:%02d", h, m, s)
    }

    func sendGeofenceNotification() {
        let content = UNMutableNotificationContent()
        content.title = "Arbeitsort verlassen"
        content.body = "Deine Zeiterfassung wurde automatisch gestoppt."
        content.sound = .default

        let request = UNNotificationRequest(
            identifier: "geofence",
            content: content,
            trigger: nil
        )
        UNUserNotificationCenter.current().add(request)
    }
}
