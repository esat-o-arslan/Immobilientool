// Immobilientool – AWS Konfiguration
// Verbindung zu demselben AWS Amplify Backend wie das Verwaltungsportal

import Foundation

enum PortalAWSConfig {
    static let region          = "eu-central-1"
    static let userPoolId      = "REGION_POOL_ID"
    static let clientId        = "CLIENT_ID"
    static let graphqlEndpoint = "https://example.invalid/graphql"

    static let cognitoEndpoint = "https://cognito-idp.\(region).amazonaws.com/"
}

// Persistenz-Keys
extension UserDefaults {
    static let portalGroup = UserDefaults(suiteName: "group.ch.example.immobilientool.time") ?? .standard

    var portalIdToken: String?        { get { string(forKey: "portal.idToken") }        set { set(newValue, forKey: "portal.idToken") } }
    var portalAccessToken: String?    { get { string(forKey: "portal.accessToken") }    set { set(newValue, forKey: "portal.accessToken") } }
    var portalRefreshToken: String?   { get { string(forKey: "portal.refreshToken") }   set { set(newValue, forKey: "portal.refreshToken") } }
    var portalTokenExpiry: Date?      { get { object(forKey: "portal.tokenExpiry") as? Date } set { set(newValue, forKey: "portal.tokenExpiry") } }
    var portalEmail: String?          { get { string(forKey: "portal.email") }          set { set(newValue, forKey: "portal.email") } }
    var portalMitarbeiterId: String?  { get { string(forKey: "portal.mitarbeiterId") }  set { set(newValue, forKey: "portal.mitarbeiterId") } }
    var portalMitarbeiterName: String? { get { string(forKey: "portal.mitarbeiterName") } set { set(newValue, forKey: "portal.mitarbeiterName") } }
    var portalSyncEnabled: Bool       { get { bool(forKey: "portal.syncEnabled") }      set { set(newValue, forKey: "portal.syncEnabled") } }
    var portalLastSync: Date?         { get { object(forKey: "portal.lastSync") as? Date } set { set(newValue, forKey: "portal.lastSync") } }
    var portalSyncedEntryIds: Set<String> {
        get { Set((array(forKey: "portal.syncedIds") as? [String]) ?? []) }
        set { set(Array(newValue), forKey: "portal.syncedIds") }
    }
}
