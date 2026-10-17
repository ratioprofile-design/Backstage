#pragma once

#include "CausalityTypes.h"
#include <vector>
#include <unordered_map>
#include <cmath>
#include <cstdint>

namespace Backstage {
namespace Causality {

/**
 * High-performance 2D Spatial Hash Grid for sub-microsecond viewport culling
 * and spatial range queries across 50,000+ narrative beats.
 */
class SpatialGrid {
public:
    SpatialGrid(float cellWidth = 500.0f, float cellHeight = 160.0f);

    void insert(uint32_t beatId, float x, float y, float width, float height);
    void update(uint32_t beatId, float oldX, float oldY, float oldW, float oldH,
                                float newX, float newY, float newW, float newH);
    void remove(uint32_t beatId, float x, float y, float width, float height);
    void clear();

    // Queries all beat IDs that intersect the given bounding box frustum
    size_t queryRange(
        const BoundingBox& range,
        uint32_t* outBeatIds,
        size_t maxCount
    ) const;

    // Fast point hit testing
    uint32_t hitTest(float worldX, float worldY, const BeatNode* beatsData, const size_t* idToIndexMap) const;

    size_t getCellCount() const { return m_grid.size(); }
    float getCellWidth() const { return m_cellWidth; }
    float getCellHeight() const { return m_cellHeight; }

private:
    float m_cellWidth;
    float m_cellHeight;

    // 64-bit spatial hash key: (cellX << 32) | (cellY & 0xFFFFFFFF)
    static inline uint64_t hashKey(int32_t cx, int32_t cy) {
        return (static_cast<uint64_t>(cx) << 32) | (static_cast<uint64_t>(cy) & 0xFFFFFFFFULL);
    }

    // Grid cells storing beat IDs
    std::unordered_map<uint64_t, std::vector<uint32_t>> m_grid;
};

} // namespace Causality
} // namespace Backstage
