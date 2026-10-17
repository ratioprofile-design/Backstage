#include "VaultSearchEngine.h"
#include <algorithm>
#include <cctype>
#include <chrono>
#include <sstream>
#include <set>

namespace backstage::vault {

void VaultSearchEngine::clear() {
    documents_.clear();
    docIdToIndex_.clear();
    tokenIndex_.clear();
    trigramIndex_.clear();
    avgDocLength_ = 0.0;
}

void VaultSearchEngine::tokenize(const std::string& text, std::vector<std::string>& tokens) const {
    tokens.clear();
    std::string current;
    for (char c : text) {
        if (std::isalnum(static_cast<unsigned char>(c))) {
            current.push_back(std::tolower(static_cast<unsigned char>(c)));
        } else if (!current.empty()) {
            tokens.push_back(current);
            current.clear();
        }
    }
    if (!current.empty()) {
        tokens.push_back(current);
    }
}

std::vector<std::string> VaultSearchEngine::generateTrigrams(const std::string& word) const {
    std::vector<std::string> trigrams;
    if (word.length() < 3) return trigrams;
    for (size_t i = 0; i <= word.length() - 3; ++i) {
        trigrams.push_back(word.substr(i, 3));
    }
    return trigrams;
}

void VaultSearchEngine::indexDocument(const VaultDocumentInput& doc) {
    // If existing, remove first
    auto it = docIdToIndex_.find(doc.id);
    if (it != docIdToIndex_.end()) {
        removeDocument(doc.id);
    }

    DocRecord rec;
    rec.id = doc.id;
    rec.title = doc.title;
    rec.category = doc.category;
    rec.content = doc.content;

    // Split lines for snippet indexing
    std::istringstream stream(doc.content);
    std::string line;
    uint32_t lineNum = 1;

    std::unordered_map<std::string, std::pair<uint32_t, std::vector<uint32_t>>> termStats; // term -> (count, lines)

    while (std::getline(stream, line)) {
        if (!line.empty() && line.back() == '\r') line.pop_back();
        rec.lines.push_back(line);

        std::vector<std::string> lineTokens;
        tokenize(line, lineTokens);
        for (const auto& token : lineTokens) {
            auto& stat = termStats[token];
            stat.first++;
            if (stat.second.empty() || stat.second.back() != lineNum) {
                stat.second.push_back(lineNum);
            }
        }
        lineNum++;
    }

    // Also index title
    std::vector<std::string> titleTokens;
    tokenize(doc.title, titleTokens);
    for (const auto& token : titleTokens) {
        auto& stat = termStats[token];
        stat.first += 5; // boost title terms
        if (stat.second.empty() || stat.second.back() != 1) {
            stat.second.push_back(1);
        }
    }

    uint32_t totalWords = 0;
    for (const auto& kv : termStats) {
        totalWords += kv.second.first;
    }
    rec.wordCount = totalWords;

    uint32_t docIndex = static_cast<uint32_t>(documents_.size());
    documents_.push_back(std::move(rec));
    docIdToIndex_[doc.id] = docIndex;

    // Insert into token and trigram indices
    for (const auto& kv : termStats) {
        const std::string& term = kv.first;
        Posting p;
        p.docIndex = docIndex;
        p.termFrequency = kv.second.first;
        p.linePositions = kv.second.second;
        tokenIndex_[term].push_back(std::move(p));

        auto trigrams = generateTrigrams(term);
        for (const auto& tri : trigrams) {
            auto& termList = trigramIndex_[tri];
            if (std::find(termList.begin(), termList.end(), term) == termList.end()) {
                termList.push_back(term);
            }
        }
    }

    // Update average document length
    double totalDocLength = 0.0;
    for (const auto& d : documents_) {
        totalDocLength += d.wordCount;
    }
    avgDocLength_ = documents_.empty() ? 0.0 : (totalDocLength / documents_.size());
}

void VaultSearchEngine::removeDocument(const std::string& docId) {
    auto it = docIdToIndex_.find(docId);
    if (it == docIdToIndex_.end()) return;

    uint32_t idx = it->second;

    // Remove postings referencing this docIndex
    for (auto& kv : tokenIndex_) {
        auto& list = kv.second;
        list.erase(
            std::remove_if(list.begin(), list.end(), [idx](const Posting& p) { return p.docIndex == idx; }),
            list.end()
        );
    }

    // In-place mark deleted by clearing ID
    documents_[idx].id = "";
    documents_[idx].content = "";
    documents_[idx].lines.clear();
    documents_[idx].wordCount = 0;
    docIdToIndex_.erase(it);
}

std::string VaultSearchEngine::extractSnippet(
    const DocRecord& doc, 
    uint32_t lineNumber, 
    const std::string& term
) const {
    if (doc.lines.empty()) return doc.title;

    uint32_t actualLineIdx = (lineNumber > 0 && lineNumber <= doc.lines.size()) ? (lineNumber - 1) : 0;
    const std::string& line = doc.lines[actualLineIdx];

    if (line.size() <= 120) return line;

    // Center around term
    std::string lowerLine = line;
    for (char& c : lowerLine) c = std::tolower(static_cast<unsigned char>(c));

    size_t pos = lowerLine.find(term);
    if (pos == std::string::npos) {
        return line.substr(0, 117) + "...";
    }

    size_t start = (pos > 40) ? (pos - 40) : 0;
    size_t len = std::min(static_cast<size_t>(110), line.size() - start);

    std::string snippet = line.substr(start, len);
    if (start > 0) snippet = "..." + snippet;
    if (start + len < line.size()) snippet += "...";

    return snippet;
}

SearchResult VaultSearchEngine::search(const std::string& query, uint32_t limit) const {
    auto t0 = std::chrono::high_resolution_clock::now();

    SearchResult result;
    if (query.empty() || documents_.empty()) return result;

    std::vector<std::string> queryTokens;
    tokenize(query, queryTokens);
    if (queryTokens.empty()) return result;

    const size_t N = documents_.size();
    std::unordered_map<uint32_t, double> docScores;
    std::unordered_map<uint32_t, uint32_t> docBestLine;
    std::unordered_map<uint32_t, std::set<std::string>> docMatchedTerms;

    for (const auto& rawQ : queryTokens) {
        std::set<std::string> candidateTerms;

        // Exact term match
        if (tokenIndex_.find(rawQ) != tokenIndex_.end()) {
            candidateTerms.insert(rawQ);
        }

        // Fuzzy match via trigrams if term length >= 4
        if (rawQ.length() >= 4) {
            auto qTris = generateTrigrams(rawQ);
            for (const auto& tri : qTris) {
                auto itTri = trigramIndex_.find(tri);
                if (itTri != trigramIndex_.end()) {
                    for (const auto& termCandidate : itTri->second) {
                        candidateTerms.insert(termCandidate);
                    }
                }
            }
        }

        // Calculate BM25 for each candidate term
        for (const auto& term : candidateTerms) {
            auto itIdx = tokenIndex_.find(term);
            if (itIdx == tokenIndex_.end()) continue;

            const auto& postings = itIdx->second;
            size_t docFreq = postings.size();
            if (docFreq == 0) continue;

            // BM25 IDF
            double idf = std::log((N - docFreq + 0.5) / (docFreq + 0.5) + 1.0);
            if (idf < 0.1) idf = 0.1;

            // Fuzzy discount if candidate term differs from rawQ
            double termWeight = (term == rawQ) ? 1.0 : 0.65;

            for (const auto& p : postings) {
                const auto& doc = documents_[p.docIndex];
                if (doc.id.empty()) continue; // skip deleted

                double tf = static_cast<double>(p.termFrequency);
                double docLen = static_cast<double>(doc.wordCount);
                double normLen = (avgDocLength_ > 0.0) ? (docLen / avgDocLength_) : 1.0;

                // BM25 TF formula: (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (docLen / avgDocLen)))
                double score = idf * ((tf * (k1_ + 1.0)) / (tf + k1_ * (1.0 - b_ + b_ * normLen))) * termWeight;

                docScores[p.docIndex] += score;
                docMatchedTerms[p.docIndex].insert(term);

                if (!p.linePositions.empty()) {
                    if (docBestLine.find(p.docIndex) == docBestLine.end()) {
                        docBestLine[p.docIndex] = p.linePositions.front();
                    }
                }
            }
        }
    }

    // Rank documents by score
    std::vector<std::pair<uint32_t, double>> ranked(docScores.begin(), docScores.end());
    std::sort(ranked.begin(), ranked.end(), [](const auto& a, const auto& b) {
        return a.second > b.second;
    });

    result.totalHits = static_cast<uint32_t>(ranked.size());

    size_t count = std::min(static_cast<size_t>(limit), ranked.size());
    for (size_t i = 0; i < count; ++i) {
        uint32_t docIdx = ranked[i].first;
        const auto& doc = documents_[docIdx];

        SearchMatch match;
        match.docId = doc.id;
        match.docTitle = doc.title;
        match.category = doc.category;
        match.score = ranked[i].second;
        match.lineNumber = docBestLine[docIdx];
        
        for (const auto& t : docMatchedTerms[docIdx]) {
            match.matchedTokens.push_back(t);
        }

        std::string highlightTerm = match.matchedTokens.empty() ? queryTokens[0] : match.matchedTokens[0];
        match.matchedSnippet = extractSnippet(doc, match.lineNumber, highlightTerm);

        result.matches.push_back(std::move(match));
    }

    auto t1 = std::chrono::high_resolution_clock::now();
    result.queryTimeUs = std::chrono::duration<double, std::micro>(t1 - t0).count();

    return result;
}

} // namespace backstage::vault
