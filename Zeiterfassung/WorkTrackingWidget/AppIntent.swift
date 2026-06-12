//
//  AppIntent.swift
//  WorkTrackingWidget
//
//  Open-source template on 13.05.2026.
//

import WidgetKit
import AppIntents

struct ConfigurationAppIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Widget Konfiguration"
    static var description = IntentDescription("Konfiguriert das Zeiterfassungs-Widget.")

    @Parameter(title: "Kurztitel", default: "Portal Timer")
    var shortTitle: String
}
