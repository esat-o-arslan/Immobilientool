//
//  StoredDocument.swift
//  Zeiterfassung
//
//  Open-source template on 18.05.2026.
//

import Foundation
import SwiftData

@Model
final class StoredDocument {
    var id: UUID
    var date: Date
    var title: String
    @Attribute(.externalStorage) var fileData: Data
    var type: String

    var year: Int
    var month: Int
    var category: String
    var source: String

    init(
        id: UUID = UUID(),
        date: Date,
        title: String,
        fileData: Data,
        type: String,
        year: Int,
        month: Int,
        category: String,
        source: String
    ) {
        self.id = id
        self.date = date
        self.title = title
        self.fileData = fileData
        self.type = type
        self.year = year
        self.month = month
        self.category = category
        self.source = source
    }
}
