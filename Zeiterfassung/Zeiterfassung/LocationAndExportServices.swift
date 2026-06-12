//
//  LocationAndExportServices.swift
//  Zeiterfassung
//
//  Open-source template on 17.05.2026.
//

import Foundation
import CoreLocation
import Observation

@Observable
final class LocationManager: NSObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()

    var lastLocation: CLLocation?
    var authorizationStatus: CLAuthorizationStatus = .notDetermined
    var isInsideWorkRegion: Bool = false

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.distanceFilter = 25
        authorizationStatus = manager.authorizationStatus
    }

    func requestPermissions() {
        manager.requestAlwaysAuthorization()
    }

    func startUpdating() {
        manager.startUpdatingLocation()
    }

    func stopUpdating() {
        manager.stopUpdatingLocation()
    }

    func startMonitoringWorkRegion() {
        guard CLLocationManager.isMonitoringAvailable(for: CLCircularRegion.self) else { return }

        let region = CLCircularRegion(
            center: workLocation.coordinate,
            radius: geofenceRadius,
            identifier: "portal_work_region"
        )
        region.notifyOnEntry = true
        region.notifyOnExit = true

        manager.startMonitoring(for: region)
        manager.requestState(for: region)
    }

    func stopMonitoringWorkRegion() {
        for region in manager.monitoredRegions {
            if let circular = region as? CLCircularRegion, circular.identifier == "portal_work_region" {
                manager.stopMonitoring(for: circular)
            }
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        authorizationStatus = manager.authorizationStatus
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        lastLocation = locations.last
    }

    func locationManager(_ manager: CLLocationManager, didEnterRegion region: CLRegion) {
        if region.identifier == "portal_work_region" {
            isInsideWorkRegion = true
        }
    }

    func locationManager(_ manager: CLLocationManager, didExitRegion region: CLRegion) {
        if region.identifier == "portal_work_region" {
            isInsideWorkRegion = false
        }
    }

    func locationManager(_ manager: CLLocationManager, didDetermineState state: CLRegionState, for region: CLRegion) {
        guard region.identifier == "portal_work_region" else { return }

        switch state {
        case .inside:
            isInsideWorkRegion = true
        case .outside, .unknown:
            isInsideWorkRegion = false
        @unknown default:
            isInsideWorkRegion = false
        }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        print("Standort-Fehler: \(error.localizedDescription)")
    }
}

extension LocationManager {
    var workLocation: CLLocation {
        let lat = UserDefaults.standard.object(forKey: SharedDefaults.workLocationLat) as? Double ?? 47.5135
        let lon = UserDefaults.standard.object(forKey: SharedDefaults.workLocationLon) as? Double ?? 7.5564
        return CLLocation(latitude: lat, longitude: lon)
    }

    var geofenceRadius: CLLocationDistance {
        (UserDefaults.standard.object(forKey: SharedDefaults.workGeofenceRadius) as? Double) ?? 300
    }

    func isAtWork(currentLocation: CLLocation) -> Bool {
        currentLocation.distance(from: workLocation) <= geofenceRadius
    }
}
