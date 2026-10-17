#pragma once

#include "CausalityTypes.h"
#include <vector>
#include <unordered_map>
#include <memory>
#include <algorithm>

namespace Backstage {
namespace Causality {

/**
 * High-Performance C++ Causality Engine
 * Manages beats, lanes, and causal dependencies in contiguous flat memory arrays.
 * Zero dynamic heap allocation per frame.
 * Directly exposes raw memory pointers for WebGL instanced rendering and Wasm zero-copy reads.
 */
class CausalityEngine {
public:
    explicit CausalityEngine(size_t initialCapacity = 10000);
    ~CausalityEngine() = default;

    // Disallow copy to prevent accidental memory duplication
    CausalityEngine(const CausalityEngine&) = delete;
    CausalityEngine& operator=(const CausalityEngine&) = delete;

    // Move constructor & assignment
    CausalityEngine(CausalityEngine&&) noexcept = default;
    CausalityEngine& operator=(CausalityEngine&&) noexcept = default;

    // ==========================================
    // 1. BEAT NODE MANAGEMENT (O(1))
    // ==========================================
    bool addBeat(
        uint32_t id,
        float x,
        float y,
        float width,
        float height,
        int32_t laneIndex,
        uint32_t colorRgba = 0x38bdf8ff, // Sky Blue default
        float durationSecs = 120.0f,
        uint32_t actIndex = 1
    );

    bool updateBeatPosition(uint32_t id, float x, float y);
    bool setBeatFlags(uint32_t id, uint32_t flags);
    bool removeBeat(uint32_t id);
    BeatNode* getBeatById(uint32_t id);
    const BeatNode* getBeatById(uint32_t id) const;
    BeatNode* getBeatByIndex(size_t index) { return index < m_beats.size() ? &m_beats[index] : nullptr; }
    const BeatNode* getBeatByIndex(size_t index) const { return index < m_beats.size() ? &m_beats[index] : nullptr; }

    // ==========================================
    // 2. STORY LANE MANAGEMENT (O(1))
    // ==========================================
    bool addLane(int32_t laneIndex, float yOffset, float height, uint32_t colorRgba = 0x1e293bff);
    bool updateLane(int32_t laneIndex, float yOffset, float height);
    bool removeLane(int32_t laneIndex);
    StoryLane* getLaneByIndex(int32_t laneIndex);
    const StoryLane* getLaneByIndex(int32_t laneIndex) const;

    // ==========================================
    // 3. CAUSAL CONNECTION GRAPH
    // ==========================================
    bool addConnection(uint32_t id, uint32_t sourceBeatId, uint32_t targetBeatId, uint32_t type = CONN_TYPE_CAUSAL_HARD);
    bool removeConnection(uint32_t id);
    bool hasConnection(uint32_t sourceBeatId, uint32_t targetBeatId) const;

    // ==========================================
    // 3b. PHASE 2: CAUSAL DAG & MULTI-LANE RIPPLE SOLVER
    // ==========================================
    // Automatically slides downstream beats in the same lane to prevent overlapping (ripple editing)
    size_t solveLaneRipple(int32_t laneIndex, uint32_t movedBeatId, float newX, float minGap = 24.0f);

    // Propagates forward causal pushes across lanes: if Cause moves right, Effect must not precede Cause
    size_t propagateCausalRipple(uint32_t sourceBeatId, float minCausalGap = 40.0f);

    // Checks for circular causal paradoxes (A -> B -> C -> A) before creating an edge
    bool wouldCreateCycle(uint32_t sourceBeatId, uint32_t targetBeatId) const;

    // Detects any existing cycles across the graph and marks offending nodes with BEAT_FLAG_CAUSAL_ERR
    size_t validateDAGAndMarkErrors();

    // Snaps raw coordinate to closest neighboring beat edge or lane boundary within snapThreshold
    float snapBeatPosition(float rawX, int32_t laneIndex, float snapThreshold = 16.0f) const;

    // ==========================================
    // 4. FRUSTUM CULLING & SPATIAL HIT-TESTING
    // ==========================================
    // Efficiently returns only beats visible within the current camera viewport (sub-millisecond)
    size_t queryVisibleBeats(
        const ViewportCamera& camera,
        uint32_t* outIndices,
        size_t maxCount
    ) const;

    // Hit-tests a world coordinate point against all active beat bounding boxes
    int32_t hitTestBeat(float worldX, float worldY) const;

    // ==========================================
    // 5. DIRECT MEMORY EXPORT (FOR WEBGL & WASM)
    // ==========================================
    const BeatNode* getBeatsData() const { return m_beats.data(); }
    size_t getBeatsCount() const { return m_beats.size(); }
    size_t getBeatsByteSize() const { return m_beats.size() * sizeof(BeatNode); }

    const StoryLane* getLanesData() const { return m_lanes.data(); }
    size_t getLanesCount() const { return m_lanes.size(); }
    size_t getLanesByteSize() const { return m_lanes.size() * sizeof(StoryLane); }

    const CausalConnection* getConnectionsData() const { return m_connections.data(); }
    size_t getConnectionsCount() const { return m_connections.size(); }
    size_t getConnectionsByteSize() const { return m_connections.size() * sizeof(CausalConnection); }

    void clearAll();

private:
    // Contiguous flat arrays
    std::vector<BeatNode> m_beats;
    std::vector<StoryLane> m_lanes;
    std::vector<CausalConnection> m_connections;

    // O(1) Hash Map lookups (ID -> index in flat vector)
    std::unordered_map<uint32_t, size_t> m_beatIndexMap;
    std::unordered_map<int32_t, size_t> m_laneIndexMap;
    std::unordered_map<uint32_t, size_t> m_connIndexMap;

    // Causal adjacency list for fast forward/backward traversal
    std::unordered_map<uint32_t, std::vector<uint32_t>> m_forwardAdjacency;
    std::unordered_map<uint32_t, std::vector<uint32_t>> m_backwardAdjacency;
};

} // namespace Causality
} // namespace Backstage
