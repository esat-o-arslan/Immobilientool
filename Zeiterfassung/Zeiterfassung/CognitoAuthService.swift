// Immobilientool – Cognito Authentifizierung
// Verwendet die AWS Cognito REST API direkt (kein SDK nötig)

import Foundation

@MainActor
@Observable
final class CognitoAuthService {

    enum AuthState {
        case unauthenticated
        case loading
        case authenticated(email: String)
        case requiresNewPassword(session: String, email: String)
        case error(String)
    }

    var state: AuthState = .unauthenticated
    var isAuthenticated: Bool {
        if case .authenticated = state { return true }
        return false
    }

    private let defaults = UserDefaults.standard

    // MARK: - Init

    init() {
        if let _ = defaults.portalIdToken,
           let expiry = defaults.portalTokenExpiry,
           expiry > Date(),
           let email = defaults.portalEmail {
            state = .authenticated(email: email)
        }
    }

    // MARK: - Login

    func signIn(email: String, password: String) async {
        state = .loading
        let body: [String: Any] = [
            "AuthFlow": "USER_PASSWORD_AUTH",
            "ClientId": PortalAWSConfig.clientId,
            "AuthParameters": [
                "USERNAME": email.lowercased().trimmingCharacters(in: .whitespaces),
                "PASSWORD": password
            ]
        ]
        do {
            let response = try await cognitoRequest(target: "AWSCognitoIdentityProviderService.InitiateAuth", body: body)
            try handleAuthResponse(response: response, email: email)
        } catch let e as AuthError {
            state = .error(e.localizedDescription)
        } catch {
            state = .error(error.localizedDescription)
        }
    }

    // MARK: - Neues Passwort setzen (Erstanmeldung)

    func respondToNewPasswordChallenge(session: String, email: String, newPassword: String) async {
        state = .loading
        let body: [String: Any] = [
            "ChallengeName": "NEW_PASSWORD_REQUIRED",
            "ClientId": PortalAWSConfig.clientId,
            "Session": session,
            "ChallengeResponses": [
                "USERNAME": email,
                "NEW_PASSWORD": newPassword
            ]
        ]
        do {
            let response = try await cognitoRequest(target: "AWSCognitoIdentityProviderService.RespondToAuthChallenge", body: body)
            try handleAuthResponse(response: response, email: email)
        } catch let e as AuthError {
            state = .error(e.localizedDescription)
        } catch {
            state = .error(error.localizedDescription)
        }
    }

    // MARK: - Token erneuern

    func refreshIfNeeded() async throws {
        guard let expiry = defaults.portalTokenExpiry, expiry < Date().addingTimeInterval(300),
              let refresh = defaults.portalRefreshToken else { return }
        let body: [String: Any] = [
            "AuthFlow": "REFRESH_TOKEN_AUTH",
            "ClientId": PortalAWSConfig.clientId,
            "AuthParameters": ["REFRESH_TOKEN": refresh]
        ]
        let response = try await cognitoRequest(target: "AWSCognitoIdentityProviderService.InitiateAuth", body: body)
        if let result = response["AuthenticationResult"] as? [String: Any] {
            saveTokens(result: result, email: defaults.portalEmail ?? "")
        }
    }

    // MARK: - Abmelden

    func signOut() {
        defaults.portalIdToken = nil
        defaults.portalAccessToken = nil
        defaults.portalRefreshToken = nil
        defaults.portalTokenExpiry = nil
        defaults.portalEmail = nil
        state = .unauthenticated
    }

    // MARK: - Aktueller ID-Token

    func currentIdToken() async throws -> String {
        try await refreshIfNeeded()
        guard let token = defaults.portalIdToken else { throw AuthError.notAuthenticated }
        return token
    }

    // MARK: - Private

    private func handleAuthResponse(response: [String: Any], email: String) throws {
        if let challenge = response["ChallengeName"] as? String,
           challenge == "NEW_PASSWORD_REQUIRED",
           let session = response["Session"] as? String {
            state = .requiresNewPassword(session: session, email: email)
            return
        }
        guard let result = response["AuthenticationResult"] as? [String: Any] else {
            let msg = (response["message"] as? String) ?? (response["__type"] as? String) ?? "Unbekannter Fehler"
            throw AuthError.cognito(friendlyMessage(for: msg))
        }
        saveTokens(result: result, email: email)
        state = .authenticated(email: email)
    }

    private func saveTokens(result: [String: Any], email: String) {
        defaults.portalIdToken      = result["IdToken"] as? String
        defaults.portalAccessToken  = result["AccessToken"] as? String
        if let rt = result["RefreshToken"] as? String { defaults.portalRefreshToken = rt }
        let exp = (result["ExpiresIn"] as? Double) ?? 3600
        defaults.portalTokenExpiry  = Date().addingTimeInterval(exp - 60)
        defaults.portalEmail        = email
    }

    private func cognitoRequest(target: String, body: [String: Any]) async throws -> [String: Any] {
        guard let url = URL(string: PortalAWSConfig.cognitoEndpoint) else { throw AuthError.network }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/x-amz-json-1.1", forHTTPHeaderField: "Content-Type")
        request.setValue(target, forHTTPHeaderField: "X-Amz-Target")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, _) = try await URLSession.shared.data(for: request)
        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw AuthError.parse }
        if let errorType = json["__type"] as? String {
            throw AuthError.cognito(friendlyMessage(for: errorType))
        }
        return json
    }

    private func friendlyMessage(for code: String) -> String {
        switch code {
        case "NotAuthorizedException":
            return "E-Mail oder Passwort falsch.\n\nHinweis: Bei der ersten Anmeldung bitte das temporäre Passwort aus der Einladungs-E-Mail verwenden."
        case "UserNotFoundException":
            return "Kein Konto mit dieser E-Mail-Adresse gefunden."
        case "UserNotConfirmedException":
            return "Konto noch nicht bestätigt."
        case "PasswordResetRequiredException":
            return "Passwort-Reset erforderlich. Bitte zuerst im IMMOBILIENTOOL Webportal ein neues Passwort setzen."
        case "InvalidParameterException":
            return "Ungültige Eingabe – bitte E-Mail und Passwort prüfen."
        case "TooManyRequestsException":
            return "Zu viele Versuche. Bitte kurz warten."
        case "InvalidPasswordException":
            return "Das Passwort erfüllt die Anforderungen nicht (mind. 8 Zeichen, Gross-/Kleinbuchstaben, Ziffer, Sonderzeichen)."
        default:
            return code
        }
    }
}

enum AuthError: LocalizedError {
    case notAuthenticated
    case network
    case parse
    case cognito(String)

    var errorDescription: String? {
        switch self {
        case .notAuthenticated: return "Nicht angemeldet."
        case .network: return "Netzwerkfehler."
        case .parse: return "Antwort konnte nicht verarbeitet werden."
        case .cognito(let msg): return msg
        }
    }
}
