#pragma once

#include <cstdint>
#include <cstddef>
#include <vector>
#include <string>

namespace Backstage {
namespace Causality {

// Node Flag Bitmasks
enum BeatFlags : uint32_t {
    BEAT_FLAG_NONE       = 0,
    BEAT_FLAG_SELECTED   = 1 << 0,
    BEAT_FLAG_HOVERED    = 1 << 1,
    BEAT_FLAG_LOCKED     = 1 << 2,
    BEAT_FLAG_COLLAPSED  = 1 << 3,
    BEAT_FLAG_DRAGGING   = 1 << 4,
    BEAT_FLAG_CAUSAL_ERR = 1 << 5, // Highlighted when participating in circular causal logic
    BEAT_FLAG_ACTIVE     = 1 << 6  // Live item in pool (not deleted)
};

enum ConnectionType : uint32_t {
    CONN_TYPE_CAUSAL_HARD   = 0, // Strict Direct Cause -> Effect
    CONN_TYPE_CAUSAL_SOFT   = 1, // Indirect / Supporting condition
    CONN_TYPE_SUBPLOT       = 2, // Thematic / Subplot link
    CONN_TYPE_CHARACTER_ARC = 3, // Character motivation progression
    CONN_TYPE_TEMPORAL      = 4  // Chronological anchor
};

enum LaneFlags : uint32_t {
    LANE_FLAG_VISIBLE = 1 << 0,
    LANE_FLAG_LOCKED  = 1 << 1,
    LANE_FLAG_MUTED   = 1 << 2
};

#pragma pack(push, 4)
/**
 * Flat Memory Beat Node (48 bytes per beat).
 * Contiguous in RAM. Directly readable by WebGL Instanced Vertex Buffers.
 * Zero pointer indirection.
 */
struct alignas(16) BeatNode {
    uint32_t id;            // Unique Beat identifier (numeric index)
    float x;                // Absolute X position on infinite canvas
    float y;                // Absolute Y position (derived from lane offset)
    float width;            // Card visual width (e.g. 240px default)
    float height;           // Card visual height (e.g. 96px default)
    int32_t laneIndex;      // Story Lane index (0 = Main Plot, 1 = Subplot A, etc.)
    uint32_t sequenceOrder; // Sequence order within the lane
    uint32_t colorRgba;     // Packed 32-bit RGBA color
    uint32_t flags;         // BeatFlags bitfield
    float durationSecs;     // Estimated screentime duration in seconds
    uint32_t actIndex;      // Act index (1 = Act I, 2 = Act II-A, etc.)
    uint32_t padding;       // Aligns struct to 48 bytes (clean 16-byte SIMD multiple)
};

/**
 * Flat Memory Connection between Beats (24 bytes).
 */
struct CausalConnection {
    uint32_t id;            // Unique connection ID
    uint32_t sourceBeatId;  // Cause Beat ID
    uint32_t targetBeatId;  // Effect Beat ID
    uint32_t type;          // ConnectionType
    float strength;         // Tension / connection strength (0.0 - 1.0)
    uint32_t flags;         // Connection status flags
};

/**
 * Story Lane track defining horizontal workflow channels (32 bytes).
 */
struct StoryLane {
    int32_t laneIndex;      // Lane index (0, 1, 2...)
    float yOffset;          // Vertical Y starting coordinate
    float height;           // Lane height (e.g. 140px)
    uint32_t colorRgba;     // Lane thematic color
    uint32_t flags;         // LaneFlags
    uint32_t beatCount;     // Number of beats currently occupying this lane
    float minX;             // Current bounding start
    float maxX;             // Current bounding end
};

/**
 * Viewport Camera definition for Frustum Culling queries
 */
struct ViewportCamera {
    float x;                // Camera center X on canvas
    float y;                // Camera center Y on canvas
    float zoom;             // Current zoom factor (e.g. 1.0 = 100%)
    float screenWidth;      // Viewport width in pixels
    float screenHeight;     // Viewport height in pixels
};
#pragma pack(pop)

// Bounding box for fast spatial queries
struct BoundingBox {
    float minX;
    float minY;
    float maxX;
    float maxY;

    bool intersects(const BoundingBox& other) const {
        return (minX <= other.maxX && maxX >= other.minX &&
                minY <= other.maxY && maxY >= other.minY);
    }

    bool contains(float px, float py) const {
        return (px >= minX && px <= maxX && py >= minY && py <= maxY);
    }
};

} // namespace Causality
} // namespace Backstage
