/**
 * High-Performance C++ Markdown Pagination Engine
 * 
 * Provides sub-millisecond calculation of discrete A4 printable pages from raw Markdown,
 * preventing orphaned headings, breaking long tables across page boundaries,
 * and generating running headers & "Page X of Y" footers.
 *
 * Compile:
 *   clang++ -std=c++17 -O3 markdown_paginator.cpp -o markdown_paginator
 */

#include <iostream>
#include <string>
#include <vector>
#include <sstream>
#include <regex>
#include <cmath>

namespace backstage {

struct PageMetrics {
    int maxLinesPerPage = 42;       // Standard A4 at 12pt line-height
    int charsPerLine = 78;          // Standard 1-inch margins
    int headerLines = 2;            // Running header reserved lines
    int footerLines = 2;            // Running footer reserved lines
    int minLinesAfterHeading = 3;   // Orphan prevention
};

struct MarkdownBlock {
    enum Type {
        HEADING_1,
        HEADING_2,
        HEADING_3,
        PARAGRAPH,
        LIST_ITEM,
        TABLE_ROW,
        CODE_BLOCK,
        CALLOUT,
        DIVIDER
    };

    Type type;
    std::string content;
    int estimatedLines;
    bool isHeading;
};

struct PaginatedPage {
    int pageNumber;
    int totalPages;
    std::string runningHeader;
    std::string runningFooter;
    std::vector<MarkdownBlock> blocks;
    int wordCount;
    int charCount;
};

class MarkdownPaginator {
public:
    explicit MarkdownPaginator(PageMetrics metrics = PageMetrics())
        : metrics_(metrics) {}

    std::vector<PaginatedPage> paginate(const std::string& markdown, const std::string& docTitle = "Master Document") {
        std::vector<MarkdownBlock> blocks = parseBlocks(markdown);
        std::vector<PaginatedPage> pages;

        int currentLines = 0;
        int currentPageNumber = 1;
        PaginatedPage currentPage;
        currentPage.pageNumber = currentPageNumber;
        currentPage.runningHeader = docTitle;
        currentPage.wordCount = 0;
        currentPage.charCount = 0;

        int usableLines = metrics_.maxLinesPerPage - metrics_.headerLines - metrics_.footerLines;

        for (size_t i = 0; i < blocks.size(); ++i) {
            const auto& block = blocks[i];

            // Orphan check: If this is a heading and there isn't room for the heading + min body lines, start a new page
            if (block.isHeading && (currentLines + block.estimatedLines + metrics_.minLinesAfterHeading > usableLines)) {
                if (!currentPage.blocks.empty()) {
                    pages.push_back(currentPage);
                    currentPage = PaginatedPage();
                    currentPageNumber++;
                    currentPage.pageNumber = currentPageNumber;
                    currentPage.runningHeader = docTitle;
                    currentPage.wordCount = 0;
                    currentPage.charCount = 0;
                    currentLines = 0;
                }
            }
            // Standard overflow check
            else if (currentLines + block.estimatedLines > usableLines && !currentPage.blocks.empty()) {
                pages.push_back(currentPage);
                currentPage = PaginatedPage();
                currentPageNumber++;
                currentPage.pageNumber = currentPageNumber;
                currentPage.runningHeader = docTitle;
                currentPage.wordCount = 0;
                currentPage.charCount = 0;
                currentLines = 0;
            }

            currentPage.blocks.push_back(block);
            currentLines += block.estimatedLines;
            currentPage.charCount += block.content.length();
            currentPage.wordCount += countWords(block.content);
        }

        if (!currentPage.blocks.empty() || pages.empty()) {
            pages.push_back(currentPage);
        }

        // Set totalPages and footer in all pages
        int total = static_cast<int>(pages.size());
        for (auto& page : pages) {
            page.totalPages = total;
            std::ostringstream footer;
            footer << "Page " << page.pageNumber << " of " << total << " • Backstage Production Core";
            page.runningFooter = footer.str();
        }

        return pages;
    }

    std::string toJSON(const std::vector<PaginatedPage>& pages) {
        std::ostringstream json;
        json << "{\n  \"totalPages\": " << pages.size() << ",\n  \"pages\": [\n";
        for (size_t i = 0; i < pages.size(); ++i) {
            const auto& p = pages[i];
            json << "    {\n";
            json << "      \"pageNumber\": " << p.pageNumber << ",\n";
            json << "      \"totalPages\": " << p.totalPages << ",\n";
            json << "      \"runningHeader\": \"" << escapeJson(p.runningHeader) << "\",\n";
            json << "      \"runningFooter\": \"" << escapeJson(p.runningFooter) << "\",\n";
            json << "      \"wordCount\": " << p.wordCount << ",\n";
            json << "      \"charCount\": " << p.charCount << ",\n";
            json << "      \"blockCount\": " << p.blocks.size() << "\n";
            json << "    }" << (i + 1 < pages.size() ? "," : "") << "\n";
        }
        json << "  ]\n}";
        return json.str();
    }

private:
    PageMetrics metrics_;

    int countWords(const std::string& str) {
        std::istringstream stream(str);
        std::string word;
        int count = 0;
        while (stream >> word) count++;
        return count;
    }

    std::string escapeJson(const std::string& s) {
        std::ostringstream o;
        for (char c : s) {
            if (c == '"') o << "\\\"";
            else if (c == '\\') o << "\\\\";
            else if (c == '\n') o << "\\n";
            else if (c == '\r') o << "\\r";
            else if (c == '\t') o << "\\t";
            else o << c;
        }
        return o.str();
    }

    std::vector<MarkdownBlock> parseBlocks(const std::string& markdown) {
        std::vector<MarkdownBlock> blocks;
        std::istringstream stream(markdown);
        std::string line;
        std::string currentParagraph = "";

        auto flushParagraph = [&]() {
            if (!currentParagraph.empty()) {
                MarkdownBlock b;
                b.type = MarkdownBlock::PARAGRAPH;
                b.content = currentParagraph;
                b.isHeading = false;
                b.estimatedLines = std::max(1, static_cast<int>(std::ceil(static_cast<double>(currentParagraph.length()) / metrics_.charsPerLine)));
                blocks.push_back(b);
                currentParagraph.clear();
            }
        };

        while (std::getline(stream, line)) {
            // Trim trailing \r
            if (!line.empty() && line.back() == '\r') {
                line.pop_back();
            }

            if (line.empty()) {
                flushParagraph();
                continue;
            }

            // Headings
            if (line.rfind("# ", 0) == 0) {
                flushParagraph();
                blocks.push_back({MarkdownBlock::HEADING_1, line, 3, true});
            } else if (line.rfind("## ", 0) == 0) {
                flushParagraph();
                blocks.push_back({MarkdownBlock::HEADING_2, line, 2, true});
            } else if (line.rfind("### ", 0) == 0) {
                flushParagraph();
                blocks.push_back({MarkdownBlock::HEADING_3, line, 2, true});
            }
            // Divider
            else if (line == "---" || line == "***" || line == "___") {
                flushParagraph();
                blocks.push_back({MarkdownBlock::DIVIDER, line, 1, false});
            }
            // List item
            else if (line.rfind("- ", 0) == 0 || line.rfind("* ", 0) == 0 || line.rfind("1. ", 0) == 0) {
                flushParagraph();
                int lines = std::max(1, static_cast<int>(std::ceil(static_cast<double>(line.length()) / metrics_.charsPerLine)));
                blocks.push_back({MarkdownBlock::LIST_ITEM, line, lines, false});
            }
            // Table row
            else if (line.rfind("|", 0) == 0) {
                flushParagraph();
                blocks.push_back({MarkdownBlock::TABLE_ROW, line, 1, false});
            }
            // Callout or quote
            else if (line.rfind("> ", 0) == 0) {
                flushParagraph();
                int lines = std::max(1, static_cast<int>(std::ceil(static_cast<double>(line.length()) / metrics_.charsPerLine)));
                blocks.push_back({MarkdownBlock::CALLOUT, line, lines, false});
            }
            // Paragraph continuation
            else {
                if (!currentParagraph.empty()) currentParagraph += " ";
                currentParagraph += line;
            }
        }

        flushParagraph();
        return blocks;
    }
};

} // namespace backstage

int main() {
    std::string sampleMarkdown = 
        "# Master Production Breakdown\n\n"
        "**Project:** Backstage Action Heist\n\n"
        "| Sc # | Slugline | Cast | Notes |\n"
        "| :---: | :--- | :--- | :--- |\n"
        "| 1 | EXT. HARBOR - NIGHT | Maya | Tactical entrance |\n"
        "| 2 | INT. CORRIDOR - NIGHT | Maya | Vent crawl |\n"
        "| 3 | INT. LASER - NIGHT | Maya | Laser avoidance |\n"
        "| 4 | INT. VAULT - NIGHT | Maya, Sterling | Final confrontation |\n\n"
        "## Department Checklists\n\n"
        "- [ ] Stunts: Catwalk 15ft decelerator rig\n"
        "- [ ] Props: Optical Core cryo key\n"
        "- [ ] SFX: Conduit spark discharge box\n"
        "- [ ] Safety: 2 Fire Marshals on standby\n";

    backstage::MarkdownPaginator paginator;
    auto pages = paginator.paginate(sampleMarkdown, "Master Production Breakdown");
    std::cout << paginator.toJSON(pages) << std::endl;
    return 0;
}
