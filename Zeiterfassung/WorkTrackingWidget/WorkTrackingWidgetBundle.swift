//
//  WorkTrackingWidgetBundle.swift
//  WorkTrackingWidget
//
//  Open-source template on 13.05.2026.
//

import WidgetKit
import SwiftUI

@main
struct WorkTrackingWidgetBundle: WidgetBundle {
    var body: some Widget {
        WorkTrackingWidget()
        if #available(iOS 18.0, *) {
            WorkTrackingWidgetControl()
        }
        WorkTrackingWidgetLiveActivity()
    }
}
