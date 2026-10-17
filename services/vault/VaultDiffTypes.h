#pragma once

#include <cstdint>
#include <string>
#include <vector>
#include <string_view>

namespace backstage::vault {

// Operation type for line-level and token-level diffs
enum class DiffOp : uint8_t {
    EQUAL = 0,
    INSERT = 1,
    DELETE = 2
};

// Represents a single line in a diff result
struct DiffLine {
    DiffOp op{DiffOp::EQUAL};
    uint32_t lineA{0}; // 1-indexed, 0 if INSERT
    uint32_t lineB{0}; // 1-indexed, 0 if DELETE
    std::string text;
};

// Represents a contiguous hunk of changes (like unified diff @@ -l,s +l,s @@)
struct DiffHunk {
    uint32_t startLineA{0};
    uint32_t countA{0};
    uint32_t startLineB{0};
    uint32_t countB{0};
    std::vector<DiffLine> lines;
};

// Breakdown element delta between revisions
struct ElementDelta {
    std::string category; // CAST, PROPS, STUNTS, SFX, VFX, etc.
    std::string name;
    bool isAdded{false};   // true = added in Rev B, false = removed from Rev A
};

// Diff result for an individual scene within a screenplay
struct SceneDiffResult {
    std::string sceneId;
    std::string sceneNumber;
    std::string status; // "ADDED", "REMOVED", "MODIFIED", "UNCHANGED"
    std::string titleA;
    std::string titleB;
    int32_t pageShiftEighths{0};
    std::vector<DiffHunk> hunks;
    std::vector<ElementDelta> elementDeltas;
};

// Overall script comparison summary across drafts
struct ScriptDiffSummary {
    uint32_t addedScenesCount{0};
    uint32_t removedScenesCount{0};
    uint32_t modifiedScenesCount{0};
    uint32_t unchangedScenesCount{0};
    int32_t netPageShiftEighths{0};
    std::vector<SceneDiffResult> scenes;
    uint32_t totalInsertions{0};
    uint32_t totalDeletions{0};
};

} // namespace backstage::vault
