// IMMOBILIENTOOL KI-Assistent – AWS Bedrock via AppSync
// Ruft die bedrockChat-Mutation auf und gibt die Antwort zurück.

import Foundation
import Amplify

struct BedrockChatResponse: Codable {
    let bedrockChat: BedrockChatResult
}

struct BedrockChatResult: Codable {
    let ok: Bool
    let antwort: String?
}

struct ChatMessage: Identifiable, Equatable {
    let id = UUID()
    let role: String    // "user" | "assistant"
    let content: String
}

@MainActor
final class BedrockService {
    static let shared = BedrockService()
    private init() {}

    func senden(
        nachrichten: [ChatMessage],
        systemPrompt: String? = nil,
        kontext: String? = nil
    ) async -> String {
        let messagesJSON = nachrichten.map { ["role": $0.role, "content": $0.content] }
        guard let data = try? JSONSerialization.data(withJSONObject: messagesJSON),
              let messagesString = String(data: data, encoding: .utf8)
        else { return "Fehler beim Kodieren der Nachrichten." }

        let document = """
        mutation BedrockChat($messages: String!, $systemPrompt: String, $kontext: String) {
          bedrockChat(messages: $messages, systemPrompt: $systemPrompt, kontext: $kontext) {
            ok
            antwort
          }
        }
        """

        var variables: [String: Any] = ["messages": messagesString]
        if let sp = systemPrompt { variables["systemPrompt"] = sp }
        if let k = kontext { variables["kontext"] = k }

        do {
            let request = GraphQLRequest<BedrockChatResponse>(
                document: document,
                variables: variables,
                responseType: BedrockChatResponse.self
            )
            let result = try await Amplify.API.mutate(request: request)
            switch result {
            case .success(let resp):
                return resp.bedrockChat.antwort ?? "Keine Antwort erhalten."
            case .failure(let err):
                return "API-Fehler: \(err.errorDescription)"
            }
        } catch {
            return "Fehler: \(error.localizedDescription)"
        }
    }
}
