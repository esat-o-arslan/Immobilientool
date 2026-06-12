//
//  FormattedNumberField.swift
//  Zeiterfassung
//
//  Open-source template on 21.05.2026.
//

import SwiftUI
import UIKit

struct FormattedNumberField: UIViewRepresentable {
    final class Coordinator: NSObject, UITextFieldDelegate {
        var parent: FormattedNumberField
        var isFormatting = false

        init(parent: FormattedNumberField) {
            self.parent = parent
        }

        @objc func editingChanged(_ textField: UITextField) {
            guard !isFormatting else { return }
            isFormatting = true
            defer { isFormatting = false }

            let originalText = textField.text ?? ""
            let cursorOffset = currentCursorOffset(in: textField)
            let digitsBeforeCursor = countRelevantCharacters(before: cursorOffset, in: originalText)

            let sanitized = sanitize(originalText, allowsDecimal: parent.allowsDecimal)
            let numericValue = Double(sanitized) ?? 0

            if parent.value != numericValue {
                parent.value = numericValue
            }

            let formatted = parent.formatter.string(from: NSNumber(value: numericValue)) ?? ""
            textField.text = formatted
            restoreCursor(in: textField, relevantCharacterOffset: digitsBeforeCursor)
        }

        @objc func doneButtonTapped(_ textField: UITextField) {
            textField.resignFirstResponder()
            parent.isFocused = false
        }

        func textFieldDidBeginEditing(_ textField: UITextField) {
            parent.isFocused = true
        }

        func textFieldDidEndEditing(_ textField: UITextField) {
            parent.isFocused = false
            textField.text = parent.formatter.string(from: NSNumber(value: parent.value)) ?? ""
        }

        func textField(
            _ textField: UITextField,
            shouldChangeCharactersIn range: NSRange,
            replacementString string: String
        ) -> Bool {
            if string.isEmpty { return true }

            let allowedCharacters = parent.allowsDecimal ? "0123456789." : "0123456789"
            return string.allSatisfy { allowedCharacters.contains($0) }
        }

        private func sanitize(_ text: String, allowsDecimal: Bool) -> String {
            let allowedCharacters = allowsDecimal ? "0123456789." : "0123456789"
            let filtered = text.filter { allowedCharacters.contains($0) }

            guard allowsDecimal else { return filtered }

            var result = ""
            var dotSeen = false

            for char in filtered {
                if char == "." {
                    if !dotSeen {
                        result.append(".")
                        dotSeen = true
                    }
                } else {
                    result.append(char)
                }
            }

            return result
        }

        private func currentCursorOffset(in textField: UITextField) -> Int {
            guard let selectedRange = textField.selectedTextRange else {
                return (textField.text ?? "").count
            }

            return textField.offset(from: textField.beginningOfDocument, to: selectedRange.start)
        }

        private func countRelevantCharacters(before offset: Int, in text: String) -> Int {
            let prefix = String(text.prefix(offset))
            if parent.allowsDecimal {
                return prefix.filter { $0.isNumber || $0 == "." }.count
            } else {
                return prefix.filter(\.isNumber).count
            }
        }

        private func restoreCursor(in textField: UITextField, relevantCharacterOffset: Int) {
            let text = textField.text ?? ""
            var relevantSeen = 0
            var targetIndex = text.endIndex

            for index in text.indices {
                let char = text[index]
                let isRelevant = parent.allowsDecimal ? (char.isNumber || char == ".") : char.isNumber

                if isRelevant {
                    relevantSeen += 1
                }

                if relevantSeen >= relevantCharacterOffset {
                    if index < text.endIndex {
                        targetIndex = text.index(after: index)
                    }
                    break
                }
            }

            let offset = text.distance(from: text.startIndex, to: targetIndex)
            let position = textField.position(from: textField.beginningOfDocument, offset: offset) ?? textField.endOfDocument
            textField.selectedTextRange = textField.textRange(from: position, to: position)
        }

        func makeAccessoryToolbar(for textField: UITextField) -> UIToolbar {
            let screenWidth = textField.window?.windowScene?.screen.bounds.width ?? 0
            let toolbar = UIToolbar(frame: CGRect(x: 0, y: 0, width: screenWidth, height: 44))

            let spacer = UIBarButtonItem(barButtonSystemItem: .flexibleSpace, target: nil, action: nil)
            let done = UIBarButtonItem(
                title: "Fertig",
                style: .done,
                target: self,
                action: #selector(doneAccessoryTapped(_:))
            )

            done.tintColor = .systemBlue
            toolbar.items = [spacer, done]
            toolbar.sizeToFit()
            return toolbar
        }

        @objc private func doneAccessoryTapped(_ sender: UIBarButtonItem) {
            UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
            parent.isFocused = false
        }
    }

    let title: String
    @Binding var value: Double
    let formatter: NumberFormatter
    let keyboardType: UIKeyboardType
    let allowsDecimal: Bool
    @Binding var isFocused: Bool

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    func makeUIView(context: Context) -> UITextField {
        let textField = UITextField(frame: .zero)
        textField.delegate = context.coordinator
        textField.keyboardType = keyboardType
        textField.textAlignment = .center
        textField.adjustsFontSizeToFitWidth = true
        textField.minimumFontSize = 12
        textField.inputAccessoryView = context.coordinator.makeAccessoryToolbar(for: textField)
        textField.addTarget(
            context.coordinator,
            action: #selector(Coordinator.editingChanged(_:)),
            for: .editingChanged
        )

        textField.text = formatter.string(from: NSNumber(value: value)) ?? ""
        return textField
    }

    func updateUIView(_ uiView: UITextField, context: Context) {
        let formatted = formatter.string(from: NSNumber(value: value)) ?? ""

        if !uiView.isFirstResponder && uiView.text != formatted {
            uiView.text = formatted
        }

        if isFocused && !uiView.isFirstResponder {
            uiView.becomeFirstResponder()
        } else if !isFocused && uiView.isFirstResponder {
            uiView.resignFirstResponder()
        }
    }
}
