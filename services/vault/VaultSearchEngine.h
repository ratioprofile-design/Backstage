#pragma once

#include "VaultSearchTypes.h"
#include <string>
#include <vector>
#include <unordered_map>
#include <cmath>

namespace backstage::vault {

struct Posting {
    uint32_t docIndex{0};
    uint32_t termFrequency{0};
    std::vector<uint32_t> linePositions;
};

class VaultSearchEngine {
public:
    VaultSearchEngine() = default;
    ~VaultSearchEngine() = default;

    // Index or re-index a document
    void indexDocument(const VaultDocumentInput& doc);

    // Remove a document from the index
    void removeDocument(const std::string& docId);

    // Clear all indices
    void clear();

    // Query documents using BM25 ranking and trigram fuzzy matching
    SearchResult search(const std::string& query, uint32_t limit = 20) const;

    size_t documentCount() const { return documents_.size(); }

private:
    struct DocRecord {
        std::string id;
        std::string title;
        std::string category;
        std::string content;
        std::vector<std::string> lines;
        uint32_t wordCount{0};
    };

    std::vector<DocRecord> documents_;
    std::unordered_map<std::string, uint32_t> docIdToIndex_;
    
    // Inverted Index: Term -> Postings
    std::unordered_map<std::string, std::vector<Posting>> tokenIndex_;

    // Trigram Index: Trigram -> Set of Terms
    std::unordered_map<std::string, std::vector<std::string>> trigramIndex_;

    double avgDocLength_{0.0};
    const double k1_{1.2};
    const double b_{0.75};

    void tokenize(const std::string& text, std::vector<std::string>& tokens) const;
    std::vector<std::string> generateTrigrams(const std::string& word) const;
    std::string extractSnippet(const DocRecord& doc, uint32_t lineNumber, const std::string& term) const;
};

} // namespace backstage::vault
