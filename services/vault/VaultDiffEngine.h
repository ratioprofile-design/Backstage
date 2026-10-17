#pragma once

#include "VaultDiffTypes.h"
#include <string>
#include <vector>
#include <unordered_map>
#include <cstdint>

namespace backstage::vault {

// Representation of a script scene for diffing
struct ScriptSceneInput {
    std::string id;
    std::string sceneNumber;
    std::string heading;
    std::string scriptText;
    int32_t pageEighths{8};
    std::vector<std::pair<std::string, std::string>> breakdownItems; // category, name
};

class VaultDiffEngine {
public:
    VaultDiffEngine() = default;
    ~VaultDiffEngine() = default;

    // Fast line-level diff between two text blocks using Myers O(ND) algorithm with FNV-1a hashing
    static std::vector<DiffLine> diffLines(
        const std::string& textA, 
        const std::string& textB
    );

    // Group diff lines into contextual hunks (e.g. 3 lines of unchanged context)
    static std::vector<DiffHunk> createHunks(
        const std::vector<DiffLine>& lines, 
        uint32_t contextLines = 3
    );

    // Full screenplay revision comparison across two drafts
    static ScriptDiffSummary compareScriptDrafts(
        const std::vector<ScriptSceneInput>& scenesA,
        const std::vector<ScriptSceneInput>& scenesB
    );

    // Generate standard unified diff string (git diff style)
    static std::string formatUnifiedDiff(
        const std::string& fileA,
        const std::string& fileB,
        const std::vector<DiffHunk>& hunks
    );

private:
    static uint64_t hashLine(const std::string_view& line);
    static std::vector<std::string_view> splitLines(const std::string& text);
};

} // namespace backstage::vault
