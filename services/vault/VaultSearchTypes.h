#pragma once

#include <cstdint>
#include <string>
#include <vector>

namespace backstage::vault {

// Search Match Item
struct SearchMatch {
    std::string docId;
    std::string docTitle;
    std::string category;
    double score{0.0};
    uint32_t lineNumber{0};
    std::string matchedSnippet;
    std::vector<std::string> matchedTokens;
};

// Overall Search Result
struct SearchResult {
    std::vector<SearchMatch> matches;
    uint32_t totalHits{0};
    double queryTimeUs{0.0}; // in microseconds
};

// Document input for indexing
struct VaultDocumentInput {
    std::string id;
    std::string title;
    std::string category;
    std::string content;
};

} // namespace backstage::vault
