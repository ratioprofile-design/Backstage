#include "SpatialGrid.h"
#include <algorithm>
#include <unordered_set>

namespace Backstage {
namespace Causality {

SpatialGrid::SpatialGrid(float cellWidth, float cellHeight)
    : m_cellWidth(cellWidth > 1.0f ? cellWidth : 500.0f)
    , m_cellHeight(cellHeight > 1.0f ? cellHeight : 160.0f)
{
    m_grid.reserve(1024);
}

void SpatialGrid::insert(uint32_t beatId, float x, float y, float width, float height) {
    int32_t minCellX = static_cast<int32_t>(std::floor(x / m_cellWidth));
    int32_t maxCellX = static_cast<int32_t>(std::floor((x + width) / m_cellWidth));
    int32_t minCellY = static_cast<int32_t>(std::floor(y / m_cellHeight));
    int32_t maxCellY = static_cast<int32_t>(std::floor((y + height) / m_cellHeight));

    for (int32_t cy = minCellY; cy <= maxCellY; ++cy) {
        for (int32_t cx = minCellX; cx <= maxCellX; ++cx) {
            uint64_t key = hashKey(cx, cy);
            m_grid[key].push_back(beatId);
        }
    }
}

void SpatialGrid::remove(uint32_t beatId, float x, float y, float width, float height) {
    int32_t minCellX = static_cast<int32_t>(std::floor(x / m_cellWidth));
    int32_t maxCellX = static_cast<int32_t>(std::floor((x + width) / m_cellWidth));
    int32_t minCellY = static_cast<int32_t>(std::floor(y / m_cellHeight));
    int32_t maxCellY = static_cast<int32_t>(std::floor((y + height) / m_cellHeight));

    for (int32_t cy = minCellY; cy <= maxCellY; ++cy) {
        for (int32_t cx = minCellX; cx <= maxCellX; ++cx) {
            uint64_t key = hashKey(cx, cy);
            auto it = m_grid.find(key);
            if (it != m_grid.end()) {
                auto& vec = it->second;
                vec.erase(std::remove(vec.begin(), vec.end(), beatId), vec.end());
                if (vec.empty()) {
                    m_grid.erase(it);
                }
            }
        }
    }
}

void SpatialGrid::update(uint32_t beatId, float oldX, float oldY, float oldW, float oldH,
                                          float newX, float newY, float newW, float newH) {
    remove(beatId, oldX, oldY, oldW, oldH);
    insert(beatId, newX, newY, newW, newH);
}

void SpatialGrid::clear() {
    m_grid.clear();
}

size_t SpatialGrid::queryRange(
    const BoundingBox& range,
    uint32_t* outBeatIds,
    size_t maxCount
) const {
    if (!outBeatIds || maxCount == 0) return 0;

    int32_t minCellX = static_cast<int32_t>(std::floor(range.minX / m_cellWidth));
    int32_t maxCellX = static_cast<int32_t>(std::floor(range.maxX / m_cellWidth));
    int32_t minCellY = static_cast<int32_t>(std::floor(range.minY / m_cellHeight));
    int32_t maxCellY = static_cast<int32_t>(std::floor(range.maxY / m_cellHeight));

    size_t count = 0;
    std::unordered_set<uint32_t> visited;
    visited.reserve(128);

    for (int32_t cy = minCellY; cy <= maxCellY && count < maxCount; ++cy) {
        for (int32_t cx = minCellX; cx <= maxCellX && count < maxCount; ++cx) {
            uint64_t key = hashKey(cx, cy);
            auto it = m_grid.find(key);
            if (it != m_grid.end()) {
                for (uint32_t beatId : it->second) {
                    if (visited.insert(beatId).second) {
                        outBeatIds[count++] = beatId;
                        if (count >= maxCount) break;
                    }
                }
            }
        }
    }

    return count;
}

} // namespace Causality
} // namespace Backstage
