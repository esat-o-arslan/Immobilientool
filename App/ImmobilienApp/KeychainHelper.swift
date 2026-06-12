//
//  KeychainHelper.swift
//  ImmobilienApp
//
//  Open-source template on 20.05.2026.
//

import Foundation
import Security

enum KeychainHelper {
    private static let service = "ch.example.immobilientool.myhome"

    static func speichern(_ wert: String, fuer konto: String) -> Bool {
        guard let data = wert.data(using: .utf8) else { return false }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: konto
        ]

        SecItemDelete(query as CFDictionary)

        let attributes: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: konto,
            kSecValueData as String: data
        ]

        return SecItemAdd(attributes as CFDictionary, nil) == errSecSuccess
    }

    static func laden(fuer konto: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: konto,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)

        guard status == errSecSuccess,
              let data = item as? Data,
              let wert = String(data: data, encoding: .utf8) else {
            return nil
        }

        return wert
    }

    static func loeschen(fuer konto: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: konto
        ]

        SecItemDelete(query as CFDictionary)
    }
}
