// Immobilientool – Login-View
// Cognito-Login mit denselben Zugangsdaten wie das Verwaltungsportal

import SwiftUI

struct LoginView: View {
    @Environment(\.dismiss) private var dismiss
    let auth: CognitoAuthService
    var onSuccess: (() -> Void)?

    @State private var email = ""
    @State private var password = ""
    @State private var newPassword = ""
    @State private var newPasswordConfirm = ""
    @FocusState private var focusField: Field?

    enum Field { case email, password, newPassword, newPasswordConfirm }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 0) {
                    // Header
                    VStack(spacing: 8) {
                        Image(systemName: "building.2.fill")
                            .font(.system(size: 44))
                            .foregroundStyle(.white)
                        Text("IMMOBILIENTOOL IMMOBILIEN")
                            .font(.system(size: 13, weight: .semibold))
                            .tracking(6)
                            .foregroundStyle(.white.opacity(0.9))
                        Text("Verwaltungsportal")
                            .font(.caption)
                            .tracking(2)
                            .foregroundStyle(.white.opacity(0.6))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 44)
                    .background(Color(red: 0.055, green: 0.114, blue: 0.196))

                    // Form
                    VStack(spacing: 20) {
                        switch auth.state {
                        case .unauthenticated, .error:
                            signInForm
                        case .requiresNewPassword(let session, let sessionEmail):
                            newPasswordForm(session: session, email: sessionEmail)
                        case .loading:
                            ProgressView("Anmelden …")
                                .padding(.vertical, 40)
                        case .authenticated(let email):
                            successView(email: email)
                        }
                    }
                    .padding(24)
                }
            }
            .navigationTitle("Anmelden")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Schliessen") { dismiss() }
                }
            }
        }
    }

    // MARK: - Login-Formular

    private var signInForm: some View {
        VStack(spacing: 16) {
            Text("Mit Ihren Portal-Zugangsdaten anmelden")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            if case .error(let msg) = auth.state {
                Label(msg, systemImage: "exclamationmark.triangle.fill")
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .padding(12)
                    .background(.red.opacity(0.08))
                    .clipShape(.rect(cornerRadius: 10))
            }

            VStack(spacing: 1) {
                TextField("E-Mail", text: $email)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.emailAddress)
                    .autocorrectionDisabled()
                    .focused($focusField, equals: .email)
                    .padding(14)
                    .background(Color(.systemBackground))

                Divider()

                SecureField("Passwort", text: $password)
                    .focused($focusField, equals: .password)
                    .padding(14)
                    .background(Color(.systemBackground))
            }
            .clipShape(.rect(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(.separator), lineWidth: 0.5))

            Button(action: { Task { await auth.signIn(email: email, password: password) } }) {
                Label("Anmelden", systemImage: "arrow.right.circle.fill")
                    .frame(maxWidth: .infinity)
                    .padding(14)
                    .background(Color(red: 0.055, green: 0.114, blue: 0.196))
                    .foregroundStyle(.white)
                    .font(.headline)
                    .clipShape(.rect(cornerRadius: 12))
            }
            .disabled(email.isEmpty || password.isEmpty)

            Text("Zugangsdaten erhalten Sie vom Verwaltungsportal.\nBei Fragen: info@example.invalid")
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
    }

    // MARK: - Neues Passwort (Erstanmeldung)

    private func newPasswordForm(session: String, email: String) -> some View {
        VStack(spacing: 16) {
            Label("Neues Passwort vergeben", systemImage: "lock.rotation")
                .font(.headline)

            Text("Dies ist Ihre erste Anmeldung. Bitte vergeben Sie ein persönliches Passwort.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            if case .error(let msg) = auth.state {
                Label(msg, systemImage: "exclamationmark.triangle.fill")
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .padding(12)
                    .background(.red.opacity(0.08))
                    .clipShape(.rect(cornerRadius: 10))
            }

            VStack(spacing: 1) {
                SecureField("Neues Passwort", text: $newPassword)
                    .focused($focusField, equals: .newPassword)
                    .padding(14)
                    .background(Color(.systemBackground))
                Divider()
                SecureField("Passwort bestätigen", text: $newPasswordConfirm)
                    .focused($focusField, equals: .newPasswordConfirm)
                    .padding(14)
                    .background(Color(.systemBackground))
            }
            .clipShape(.rect(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(.separator), lineWidth: 0.5))

            Text("Mind. 8 Zeichen, Gross- und Kleinbuchstaben, Ziffern, Sonderzeichen.")
                .font(.caption)
                .foregroundStyle(.secondary)

            Button(action: {
                guard newPassword == newPasswordConfirm else { return }
                Task { await auth.respondToNewPasswordChallenge(session: session, email: email, newPassword: newPassword) }
            }) {
                Label("Passwort speichern", systemImage: "checkmark.circle.fill")
                    .frame(maxWidth: .infinity)
                    .padding(14)
                    .background(Color(red: 0.055, green: 0.114, blue: 0.196))
                    .foregroundStyle(.white)
                    .font(.headline)
                    .clipShape(.rect(cornerRadius: 12))
            }
            .disabled(newPassword.count < 8 || newPassword != newPasswordConfirm)
        }
    }

    // MARK: - Erfolgreich

    private func successView(email: String) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 56))
                .foregroundStyle(.green)
            Text("Angemeldet als")
                .foregroundStyle(.secondary)
            Text(email)
                .font(.headline)
            Button("Fertig") { onSuccess?(); dismiss() }
                .buttonStyle(.borderedProminent)
        }
        .padding(.vertical, 20)
    }
}
