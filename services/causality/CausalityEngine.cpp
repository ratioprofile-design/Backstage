#include "CausalityEngine.h"
#include <cmath>
#include <queue>
#include <unordered_set>
#include <algorithm>

namespace Backstage {
namespace Causality {

CausalityEngine::CausalityEngine(size_t initialCapacity) {
    m_beats.reserve(initialCapacity);
    m_lanes.reserve(32);
    m_connections.reserve(initialCapacity * 2);

    m_beatIndexMap.reserve(initialCapacity);
    m_laneIndexMap.reserve(32);
    m_connIndexMap.reserve(initialCapacity * 2);
}

// ==========================================
// 1. BEAT NODE MANAGEMENT
// ==========================================
bool CausalityEngine::addBeat(
    uint32_t id,
    float x,
    float y,
    float width,
    float height,
    int32_t laneIndex,
    uint32_t colorRgba,
    float durationSecs,
    uint32_t actIndex
) {
    // Disallow duplicate IDs
    if (m_beatIndexMap.find(id) != m_beatIndexMap.end()) {
        return false;
    }

    BeatNode node;
    node.id = id;
    node.x = x;
    node.y = y;
    node.width = width;
    node.height = height;
    node.laneIndex = laneIndex;
    node.sequenceOrder = static_cast<uint32_t>(m_beats.size());
    node.colorRgba = colorRgba;
    node.flags = BEAT_FLAG_ACTIVE;
    node.durationSecs = durationSecs;
    node.actIndex = actIndex;
    node.padding = 0;

    size_t index = m_beats.size();
    m_beats.push_back(node);
    m_beatIndexMap[id] = index;

    // Track lane beat count if lane exists
    auto laneIt = m_laneIndexMap.find(laneIndex);
    if (laneIt != m_laneIndexMap.end()) {
        m_lanes[laneIt->second].beatCount++;
    }

    return true;
}

bool CausalityEngine::updateBeatPosition(uint32_t id, float x, float y) {
    auto it = m_beatIndexMap.find(id);
    if (it == m_beatIndexMap.end()) {
        return false;
    }
    m_beats[it->second].x = x;
    m_beats[it->second].y = y;
    return true;
}

bool CausalityEngine::setBeatFlags(uint32_t id, uint32_t flags) {
    auto it = m_beatIndexMap.find(id);
    if (it == m_beatIndexMap.end()) {
        return false;
    }
    m_beats[it->second].flags = flags;
    return true;
}

bool CausalityEngine::removeBeat(uint32_t id) {
    auto it = m_beatIndexMap.find(id);
    if (it == m_beatIndexMap.end()) {
        return false;
    }

    size_t indexToRemove = it->second;
    int32_t laneIndex = m_beats[indexToRemove].laneIndex;

    // Update lane count
    auto laneIt = m_laneIndexMap.find(laneIndex);
    if (laneIt != m_laneIndexMap.end() && m_lanes[laneIt->second].beatCount > 0) {
        m_lanes[laneIt->second].beatCount--;
    }

    // O(1) Swap-and-Pop deletion
    size_t lastIndex = m_beats.size() - 1;
    if (indexToRemove != lastIndex) {
        BeatNode lastNode = m_beats[lastIndex];
        m_beats[indexToRemove] = lastNode;
        m_beatIndexMap[lastNode.id] = indexToRemove;
    }

    m_beats.pop_back();
    m_beatIndexMap.erase(it);

    // Remove any connected causal links
    m_forwardAdjacency.erase(id);
    m_backwardAdjacency.erase(id);

    return true;
}

BeatNode* CausalityEngine::getBeatById(uint32_t id) {
    auto it = m_beatIndexMap.find(id);
    if (it == m_beatIndexMap.end()) {
        return nullptr;
    }
    return &m_beats[it->second];
}

const BeatNode* CausalityEngine::getBeatById(uint32_t id) const {
    auto it = m_beatIndexMap.find(id);
    if (it == m_beatIndexMap.end()) {
        return nullptr;
    }
    return &m_beats[it->second];
}

// ==========================================
// 2. STORY LANE MANAGEMENT
// ==========================================
bool CausalityEngine::addLane(int32_t laneIndex, float yOffset, float height, uint32_t colorRgba) {
    if (m_laneIndexMap.find(laneIndex) != m_laneIndexMap.end()) {
        return false;
    }

    StoryLane lane;
    lane.laneIndex = laneIndex;
    lane.yOffset = yOffset;
    lane.height = height;
    lane.colorRgba = colorRgba;
    lane.flags = LANE_FLAG_VISIBLE;
    lane.beatCount = 0;
    lane.minX = 0.0f;
    lane.maxX = 0.0f;

    size_t index = m_lanes.size();
    m_lanes.push_back(lane);
    m_laneIndexMap[laneIndex] = index;
    return true;
}

bool CausalityEngine::updateLane(int32_t laneIndex, float yOffset, float height) {
    auto it = m_laneIndexMap.find(laneIndex);
    if (it == m_laneIndexMap.end()) {
        return false;
    }
    m_lanes[it->second].yOffset = yOffset;
    m_lanes[it->second].height = height;
    return true;
}

bool CausalityEngine::removeLane(int32_t laneIndex) {
    auto it = m_laneIndexMap.find(laneIndex);
    if (it == m_laneIndexMap.end()) {
        return false;
    }

    size_t indexToRemove = it->second;
    size_t lastIndex = m_lanes.size() - 1;

    if (indexToRemove != lastIndex) {
        StoryLane lastLane = m_lanes[lastIndex];
        m_lanes[indexToRemove] = lastLane;
        m_laneIndexMap[lastLane.laneIndex] = indexToRemove;
    }

    m_lanes.pop_back();
    m_laneIndexMap.erase(it);
    return true;
}

StoryLane* CausalityEngine::getLaneByIndex(int32_t laneIndex) {
    auto it = m_laneIndexMap.find(laneIndex);
    if (it == m_laneIndexMap.end()) {
        return nullptr;
    }
    return &m_lanes[it->second];
}

const StoryLane* CausalityEngine::getLaneByIndex(int32_t laneIndex) const {
    auto it = m_laneIndexMap.find(laneIndex);
    if (it == m_laneIndexMap.end()) {
        return nullptr;
    }
    return &m_lanes[it->second];
}

// ==========================================
// 3. CAUSAL CONNECTION GRAPH
// ==========================================
bool CausalityEngine::addConnection(uint32_t id, uint32_t sourceBeatId, uint32_t targetBeatId, uint32_t type) {
    if (m_connIndexMap.find(id) != m_connIndexMap.end()) {
        return false;
    }
    if (sourceBeatId == targetBeatId) {
        return false; // Direct self-loop disallow
    }

    CausalConnection conn;
    conn.id = id;
    conn.sourceBeatId = sourceBeatId;
    conn.targetBeatId = targetBeatId;
    conn.type = type;
    conn.strength = 1.0f;
    conn.flags = 0;

    size_t index = m_connections.size();
    m_connections.push_back(conn);
    m_connIndexMap[id] = index;

    m_forwardAdjacency[sourceBeatId].push_back(targetBeatId);
    m_backwardAdjacency[targetBeatId].push_back(sourceBeatId);

    return true;
}

bool CausalityEngine::removeConnection(uint32_t id) {
    auto it = m_connIndexMap.find(id);
    if (it == m_connIndexMap.end()) {
        return false;
    }

    size_t indexToRemove = it->second;
    uint32_t src = m_connections[indexToRemove].sourceBeatId;
    uint32_t dst = m_connections[indexToRemove].targetBeatId;

    size_t lastIndex = m_connections.size() - 1;
    if (indexToRemove != lastIndex) {
        CausalConnection lastConn = m_connections[lastIndex];
        m_connections[indexToRemove] = lastConn;
        m_connIndexMap[lastConn.id] = indexToRemove;
    }

    m_connections.pop_back();
    m_connIndexMap.erase(it);

    // Clean adjacency
    auto& fwd = m_forwardAdjacency[src];
    fwd.erase(std::remove(fwd.begin(), fwd.end(), dst), fwd.end());

    auto& bwd = m_backwardAdjacency[dst];
    bwd.erase(std::remove(bwd.begin(), bwd.end(), src), bwd.end());

    return true;
}

bool CausalityEngine::hasConnection(uint32_t sourceBeatId, uint32_t targetBeatId) const {
    auto it = m_forwardAdjacency.find(sourceBeatId);
    if (it == m_forwardAdjacency.end()) {
        return false;
    }
    return std::find(it->second.begin(), it->second.end(), targetBeatId) != it->second.end();
}

// ==========================================
// 3b. PHASE 2: CAUSAL DAG & MULTI-LANE RIPPLE SOLVER
// ==========================================

size_t CausalityEngine::solveLaneRipple(int32_t laneIndex, uint32_t movedBeatId, float newX, float minGap) {
    auto movedIt = m_beatIndexMap.find(movedBeatId);
    if (movedIt == m_beatIndexMap.end()) {
        return 0;
    }

    // Collect all beat indices in this lane
    std::vector<size_t> laneBeatIndices;
    laneBeatIndices.reserve(32);
    for (size_t i = 0; i < m_beats.size(); ++i) {
        if (m_beats[i].laneIndex == laneIndex) {
            laneBeatIndices.push_back(i);
        }
    }

    // Sort lane beats by CURRENT X coordinate before moving
    std::sort(laneBeatIndices.begin(), laneBeatIndices.end(), [this](size_t a, size_t b) {
        if (std::abs(m_beats[a].x - m_beats[b].x) > 0.001f) {
            return m_beats[a].x < m_beats[b].x;
        }
        return m_beats[a].id < m_beats[b].id;
    });

    // Find the position of movedBeat in the sorted lane
    size_t movedPos = laneBeatIndices.size();
    for (size_t i = 0; i < laneBeatIndices.size(); ++i) {
        if (laneBeatIndices[i] == movedIt->second) {
            movedPos = i;
            break;
        }
    }

    // Now update the moved beat's position
    m_beats[movedIt->second].x = newX;
    m_beats[movedIt->second].laneIndex = laneIndex;

    size_t rippledCount = 0;
    // Ripple downstream beats forward so they never overlap
    for (size_t i = movedPos + 1; i < laneBeatIndices.size(); ++i) {
        size_t prevIdx = laneBeatIndices[i - 1];
        size_t currIdx = laneBeatIndices[i];

        float requiredMinX = m_beats[prevIdx].x + m_beats[prevIdx].width + minGap;
        if (m_beats[currIdx].x < requiredMinX) {
            m_beats[currIdx].x = requiredMinX;
            rippledCount++;
        }
    }

    return rippledCount;
}

size_t CausalityEngine::propagateCausalRipple(uint32_t sourceBeatId, float minCausalGap) {
    auto srcIt = m_beatIndexMap.find(sourceBeatId);
    if (srcIt == m_beatIndexMap.end()) {
        return 0;
    }

    std::queue<uint32_t> queue;
    queue.push(sourceBeatId);

    std::unordered_set<uint32_t> visited;
    visited.insert(sourceBeatId);

    size_t affectedCount = 0;

    while (!queue.empty()) {
        uint32_t currId = queue.front();
        queue.pop();

        auto currIt = m_beatIndexMap.find(currId);
        if (currIt == m_beatIndexMap.end()) continue;
        const BeatNode& parent = m_beats[currIt->second];

        auto adjIt = m_forwardAdjacency.find(currId);
        if (adjIt == m_forwardAdjacency.end()) continue;

        for (uint32_t childId : adjIt->second) {
            auto childIt = m_beatIndexMap.find(childId);
            if (childIt == m_beatIndexMap.end()) continue;

            BeatNode& child = m_beats[childIt->second];
            float requiredMinX = parent.x + parent.width + minCausalGap;

            if (child.x < requiredMinX) {
                child.x = requiredMinX;
                affectedCount++;

                // Ripple downstream beats in the child's own lane
                solveLaneRipple(child.laneIndex, child.id, child.x, 24.0f);

                // If not visited in this ripple pass, push child to propagate its downstream causal effects
                if (visited.find(childId) == visited.end()) {
                    visited.insert(childId);
                    queue.push(childId);
                }
            }
        }
    }

    return affectedCount;
}

bool CausalityEngine::wouldCreateCycle(uint32_t sourceBeatId, uint32_t targetBeatId) const {
    if (sourceBeatId == targetBeatId) {
        return true; // Self-loop is an immediate cycle
    }

    // Check if targetBeatId can already reach sourceBeatId via forward connections
    std::queue<uint32_t> queue;
    queue.push(targetBeatId);
    std::unordered_set<uint32_t> visited;
    visited.insert(targetBeatId);

    while (!queue.empty()) {
        uint32_t curr = queue.front();
        queue.pop();

        if (curr == sourceBeatId) {
            return true;
        }

        auto it = m_forwardAdjacency.find(curr);
        if (it != m_forwardAdjacency.end()) {
            for (uint32_t nextId : it->second) {
                if (nextId == sourceBeatId) {
                    return true;
                }
                if (visited.find(nextId) == visited.end()) {
                    visited.insert(nextId);
                    queue.push(nextId);
                }
            }
        }
    }

    return false;
}

size_t CausalityEngine::validateDAGAndMarkErrors() {
    // Clear BEAT_FLAG_CAUSAL_ERR on all beats first
    for (auto& beat : m_beats) {
        beat.flags &= ~BEAT_FLAG_CAUSAL_ERR;
    }

    // 0: Unvisited, 1: Visiting (in recursion stack), 2: Visited
    std::unordered_map<uint32_t, int> state;
    state.reserve(m_beats.size());
    for (const auto& beat : m_beats) {
        state[beat.id] = 0;
    }

    std::unordered_set<uint32_t> cycleNodes;
    std::vector<uint32_t> path;

    // Helper DFS lambda
    auto dfs = [&](auto self, uint32_t u) -> void {
        state[u] = 1; // In stack
        path.push_back(u);

        auto it = m_forwardAdjacency.find(u);
        if (it != m_forwardAdjacency.end()) {
            for (uint32_t v : it->second) {
                if (state[v] == 1) {
                    // Back-edge detected! All nodes from v to end of path are in cycle
                    bool inCycle = false;
                    for (uint32_t node : path) {
                        if (node == v) inCycle = true;
                        if (inCycle) cycleNodes.insert(node);
                    }
                } else if (state[v] == 0) {
                    self(self, v);
                }
            }
        }

        path.pop_back();
        state[u] = 2; // Visited
    };

    for (const auto& beat : m_beats) {
        if (state[beat.id] == 0) {
            dfs(dfs, beat.id);
        }
    }

    // Flag all participating nodes with BEAT_FLAG_CAUSAL_ERR
    for (uint32_t id : cycleNodes) {
        auto it = m_beatIndexMap.find(id);
        if (it != m_beatIndexMap.end()) {
            m_beats[it->second].flags |= BEAT_FLAG_CAUSAL_ERR;
        }
    }

    return cycleNodes.size();
}

float CausalityEngine::snapBeatPosition(float rawX, int32_t laneIndex, float snapThreshold) const {
    float bestX = rawX;
    float minDiff = snapThreshold + 1.0f;

    // 1. Grid snap (50px interval)
    float gridInterval = 50.0f;
    float nearestGrid = std::round(rawX / gridInterval) * gridInterval;
    float gridDiff = std::abs(rawX - nearestGrid);
    if (gridDiff <= snapThreshold && gridDiff < minDiff) {
        minDiff = gridDiff;
        bestX = nearestGrid;
    }

    // 2. Snap to neighbor beats in the same lane
    for (const auto& beat : m_beats) {
        if (beat.laneIndex == laneIndex) {
            // Snap to right edge of neighbor
            float rightEdge = beat.x + beat.width + 16.0f;
            float rDiff = std::abs(rawX - rightEdge);
            if (rDiff <= snapThreshold && rDiff < minDiff) {
                minDiff = rDiff;
                bestX = rightEdge;
            }

            // Snap to left edge of neighbor
            float lDiff = std::abs(rawX - beat.x);
            if (lDiff <= snapThreshold && lDiff < minDiff) {
                minDiff = lDiff;
                bestX = beat.x;
            }
        }
    }

    return bestX;
}

// ==========================================
// 4. FRUSTUM CULLING & SPATIAL HIT-TESTING
// ==========================================
size_t CausalityEngine::queryVisibleBeats(
    const ViewportCamera& camera,
    uint32_t* outIndices,
    size_t maxCount
) const {
    if (!outIndices || maxCount == 0 || camera.zoom <= 0.0001f) {
        return 0;
    }

    // Compute visible canvas world bounds
    float halfW = (camera.screenWidth * 0.5f) / camera.zoom;
    float halfH = (camera.screenHeight * 0.5f) / camera.zoom;

    BoundingBox frustum;
    frustum.minX = camera.x - halfW;
    frustum.maxX = camera.x + halfW;
    frustum.minY = camera.y - halfH;
    frustum.maxY = camera.y + halfH;

    size_t count = 0;
    const size_t totalBeats = m_beats.size();

    // Fast memory scan (cache-friendly contiguous traversal)
    for (size_t i = 0; i < totalBeats && count < maxCount; ++i) {
        const BeatNode& beat = m_beats[i];

        BoundingBox beatBox;
        beatBox.minX = beat.x;
        beatBox.minY = beat.y;
        beatBox.maxX = beat.x + beat.width;
        beatBox.maxY = beat.y + beat.height;

        if (frustum.intersects(beatBox)) {
            outIndices[count++] = static_cast<uint32_t>(i);
        }
    }

    return count;
}

int32_t CausalityEngine::hitTestBeat(float worldX, float worldY) const {
    // Reverse scan so top-most/recently added beats take click priority
    const size_t totalBeats = m_beats.size();
    for (size_t i = totalBeats; i > 0; --i) {
        const BeatNode& beat = m_beats[i - 1];
        if (worldX >= beat.x && worldX <= (beat.x + beat.width) &&
            worldY >= beat.y && worldY <= (beat.y + beat.height)) {
            return static_cast<int32_t>(beat.id);
        }
    }
    return -1; // No beat hit
}

void CausalityEngine::clearAll() {
    m_beats.clear();
    m_lanes.clear();
    m_connections.clear();

    m_beatIndexMap.clear();
    m_laneIndexMap.clear();
    m_connIndexMap.clear();

    m_forwardAdjacency.clear();
    m_backwardAdjacency.clear();
}

} // namespace Causality
} // namespace Backstage
