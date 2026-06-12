// Immobilientool – AWS Konfiguration
// Verbindung zu demselben AWS Amplify Backend wie das Verwaltungsportal

import Foundation
import Security

enum PortalAWSConfig {
    static let region          = "eu-central-1"
    static let userPoolId      = "REGION_POOL_ID"
    static let clientId        = "CLIENT_ID"
    static let graphqlEndpoint = "https://example.invalid/graphql"

    static let cognitoEndpoint = "https://cognito-idp.\(region).amazonaws.com/"
}

// MARK: - Keychain helper for sensitive tokens

private enum PortalKeychain {
    private static let service = "ch.example.immobilientool.time.portal"

    static func save(_ value: String?, forKey key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)
        guard let value, let data = value.data(using: .utf8) else { return }
        var attributes = query
        attributes[kSecValueData as String] = data
        SecItemAdd(attributes as CFDictionary, nil)
    }

    static func load(forKey key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func delete(forKey key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)
    }
}

// MARK: - Persistenz-Keys

extension UserDefaults {
    static let portalGroup = UserDefaults(suiteName: "group.ch.example.immobilientool.time") ?? .standard

    // Sensitive tokens are stored in Keychain, not UserDefaults.
    var portalIdToken: String? {
        get { PortalKeychain.load(forKey: "portal.idToken") }
        set { PortalKeychain.save(newValue, forKey: "portal.idToken") }
    }
    var portalAccessToken: String? {
        get { PortalKeychain.load(forKey: "portal.accessToken") }
        set { PortalKeychain.save(newValue, forKey: "portal.accessToken") }
    }
    var portalRefreshToken: String? {
        get { PortalKeychain.load(forKey: "portal.refreshToken") }
        set { PortalKeychain.save(newValue, forKey: "portal.refreshToken") }
    }

    // Non-sensitive fields remain in UserDefaults.
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
