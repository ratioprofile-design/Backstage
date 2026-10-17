#include "VaultDiffEngine.h"
#include <algorithm>
#include <sstream>
#include <set>
#include <map>

namespace backstage::vault {

// 64-bit FNV-1a Hash
uint64_t VaultDiffEngine::hashLine(const std::string_view& line) {
    uint64_t hash = 14695981039346656037ULL;
    for (char c : line) {
        hash ^= static_cast<uint8_t>(c);
        hash *= 1099511628211ULL;
    }
    return hash;
}

std::vector<std::string_view> VaultDiffEngine::splitLines(const std::string& text) {
    std::vector<std::string_view> lines;
    if (text.empty()) return lines;

    size_t start = 0;
    while (start < text.size()) {
        size_t end = text.find('\n', start);
        if (end == std::string::npos) {
            std::string_view line(text.data() + start, text.size() - start);
            if (!line.empty() && line.back() == '\r') {
                line.remove_suffix(1);
            }
            lines.push_back(line);
            break;
        } else {
            size_t len = end - start;
            std::string_view line(text.data() + start, len);
            if (!line.empty() && line.back() == '\r') {
                line.remove_suffix(1);
            }
            lines.push_back(line);
            start = end + 1;
        }
    }
    return lines;
}

std::vector<DiffLine> VaultDiffEngine::diffLines(
    const std::string& textA, 
    const std::string& textB
) {
    std::vector<DiffLine> result;

    auto linesA = splitLines(textA);
    auto linesB = splitLines(textB);

    const int32_t N = static_cast<int32_t>(linesA.size());
    const int32_t M = static_cast<int32_t>(linesB.size());

    if (N == 0 && M == 0) return result;

    if (N == 0) {
        for (int32_t j = 0; j < M; ++j) {
            result.push_back({DiffOp::INSERT, 0, static_cast<uint32_t>(j + 1), std::string(linesB[j])});
        }
        return result;
    }

    if (M == 0) {
        for (int32_t i = 0; i < N; ++i) {
            result.push_back({DiffOp::DELETE, static_cast<uint32_t>(i + 1), 0, std::string(linesA[i])});
        }
        return result;
    }

    // Precompute line hashes for fast integer comparisons
    std::vector<uint64_t> hashesA(N);
    for (int32_t i = 0; i < N; ++i) hashesA[i] = hashLine(linesA[i]);

    std::vector<uint64_t> hashesB(M);
    for (int32_t j = 0; j < M; ++j) hashesB[j] = hashLine(linesB[j]);

    // Fast-path: Common Prefix
    int32_t prefix = 0;
    while (prefix < N && prefix < M && hashesA[prefix] == hashesB[prefix] && linesA[prefix] == linesB[prefix]) {
        result.push_back({DiffOp::EQUAL, static_cast<uint32_t>(prefix + 1), static_cast<uint32_t>(prefix + 1), std::string(linesA[prefix])});
        prefix++;
    }

    // Fast-path: Common Suffix
    int32_t suffix = 0;
    while (suffix < (N - prefix) && suffix < (M - prefix) && 
           hashesA[N - 1 - suffix] == hashesB[M - 1 - suffix] && 
           linesA[N - 1 - suffix] == linesB[M - 1 - suffix]) {
        suffix++;
    }

    const int32_t subN = N - prefix - suffix;
    const int32_t subM = M - prefix - suffix;

    if (subN > 0 || subM > 0) {
        const int32_t maxD = subN + subM;
        const int32_t offset = maxD;
        std::vector<int32_t> V(2 * maxD + 1, 0);
        std::vector<std::vector<int32_t>> trace;

        for (int32_t d = 0; d <= maxD; ++d) {
            trace.push_back(V);
            for (int32_t k = -d; k <= d; k += 2) {
                int32_t x = 0;
                if (k == -d || (k != d && V[k - 1 + offset] < V[k + 1 + offset])) {
                    x = V[k + 1 + offset]; // down (insertion)
                } else {
                    x = V[k - 1 + offset] + 1; // right (deletion)
                }
                int32_t y = x - k;

                // Snake: traverse diagonals with identical hashes
                while (x < subN && y < subM && 
                       hashesA[prefix + x] == hashesB[prefix + y] && 
                       linesA[prefix + x] == linesB[prefix + y]) {
                    x++;
                    y++;
                }

                V[k + offset] = x;

                if (x >= subN && y >= subM) {
                    // Reached end of trimmed diff; backtrack path
                    std::vector<DiffLine> middleDiff;
                    int32_t curX = subN;
                    int32_t curY = subM;

                    for (int32_t backD = d; backD > 0; --backD) {
                        const auto& prevV = trace[backD];
                        int32_t curK = curX - curY;
                        int32_t prevK = 0;

                        if (curK == -backD || (curK != backD && prevV[curK - 1 + offset] < prevV[curK + 1 + offset])) {
                            prevK = curK + 1;
                        } else {
                            prevK = curK - 1;
                        }

                        int32_t prevX = prevV[prevK + offset];
                        int32_t prevY = prevX - prevK;

                        // Follow snake backwards
                        while (curX > prevX && curY > prevY) {
                            curX--;
                            curY--;
                            middleDiff.push_back({
                                DiffOp::EQUAL, 
                                static_cast<uint32_t>(prefix + curX + 1), 
                                static_cast<uint32_t>(prefix + curY + 1), 
                                std::string(linesA[prefix + curX])
                            });
                        }

                        if (curX > prevX) {
                            curX--;
                            middleDiff.push_back({
                                DiffOp::DELETE, 
                                static_cast<uint32_t>(prefix + curX + 1), 
                                0, 
                                std::string(linesA[prefix + curX])
                            });
                        } else if (curY > prevY) {
                            curY--;
                            middleDiff.push_back({
                                DiffOp::INSERT, 
                                0, 
                                static_cast<uint32_t>(prefix + curY + 1), 
                                std::string(linesB[prefix + curY])
                            });
                        }
                    }

                    // Remaining snake at d=0
                    while (curX > 0 && curY > 0) {
                        curX--;
                        curY--;
                        middleDiff.push_back({
                            DiffOp::EQUAL, 
                            static_cast<uint32_t>(prefix + curX + 1), 
                            static_cast<uint32_t>(prefix + curY + 1), 
                            std::string(linesA[prefix + curX])
                        });
                    }

                    std::reverse(middleDiff.begin(), middleDiff.end());
                    result.insert(result.end(), middleDiff.begin(), middleDiff.end());
                    goto diff_finished;
                }
            }
        }
    }

diff_finished:
    // Append suffix EQUALs
    for (int32_t s = 0; s < suffix; ++s) {
        int32_t idxA = N - suffix + s;
        int32_t idxB = M - suffix + s;
        result.push_back({
            DiffOp::EQUAL, 
            static_cast<uint32_t>(idxA + 1), 
            static_cast<uint32_t>(idxB + 1), 
            std::string(linesA[idxA])
        });
    }

    return result;
}

std::vector<DiffHunk> VaultDiffEngine::createHunks(
    const std::vector<DiffLine>& lines, 
    uint32_t contextLines
) {
    std::vector<DiffHunk> hunks;
    if (lines.empty()) return hunks;

    const size_t total = lines.size();
    size_t i = 0;

    while (i < total) {
        // Find next non-equal line
        if (lines[i].op == DiffOp::EQUAL) {
            i++;
            continue;
        }

        // Determine hunk boundaries with context
        size_t hunkStart = (i > contextLines) ? (i - contextLines) : 0;
        size_t hunkEnd = i;

        while (hunkEnd < total) {
            if (lines[hunkEnd].op != DiffOp::EQUAL) {
                hunkEnd++;
            } else {
                // Check if there are other changes within context window (2 * contextLines)
                size_t lookAhead = hunkEnd;
                bool foundAnotherChange = false;
                while (lookAhead < total && (lookAhead - hunkEnd) <= (2 * contextLines)) {
                    if (lines[lookAhead].op != DiffOp::EQUAL) {
                        foundAnotherChange = true;
                        hunkEnd = lookAhead + 1;
                        break;
                    }
                    lookAhead++;
                }
                if (!foundAnotherChange) {
                    hunkEnd = std::min(total, hunkEnd + contextLines);
                    break;
                }
            }
        }

        // Build the hunk
        DiffHunk hunk;
        hunk.lines.assign(lines.begin() + hunkStart, lines.begin() + hunkEnd);

        uint32_t countA = 0;
        uint32_t countB = 0;
        uint32_t firstLineA = 0;
        uint32_t firstLineB = 0;

        for (const auto& l : hunk.lines) {
            if (l.op == DiffOp::EQUAL) {
                if (firstLineA == 0) firstLineA = l.lineA;
                if (firstLineB == 0) firstLineB = l.lineB;
                countA++;
                countB++;
            } else if (l.op == DiffOp::DELETE) {
                if (firstLineA == 0) firstLineA = l.lineA;
                countA++;
            } else if (l.op == DiffOp::INSERT) {
                if (firstLineB == 0) firstLineB = l.lineB;
                countB++;
            }
        }

        hunk.startLineA = firstLineA;
        hunk.countA = countA;
        hunk.startLineB = firstLineB;
        hunk.countB = countB;

        hunks.push_back(std::move(hunk));
        i = hunkEnd;
    }

    return hunks;
}

ScriptDiffSummary VaultDiffEngine::compareScriptDrafts(
    const std::vector<ScriptSceneInput>& scenesA,
    const std::vector<ScriptSceneInput>& scenesB
) {
    ScriptDiffSummary summary;

    std::map<std::string, const ScriptSceneInput*> mapA;
    std::map<std::string, const ScriptSceneInput*> mapB;

    for (const auto& s : scenesA) mapA[s.sceneNumber] = &s;
    for (const auto& s : scenesB) mapB[s.sceneNumber] = &s;

    // Collect all scene numbers maintaining order
    std::vector<std::string> allNumbers;
    for (const auto& s : scenesA) allNumbers.push_back(s.sceneNumber);
    for (const auto& s : scenesB) {
        if (mapA.find(s.sceneNumber) == mapA.end()) {
            allNumbers.push_back(s.sceneNumber);
        }
    }

    for (const auto& num : allNumbers) {
        auto itA = mapA.find(num);
        auto itB = mapB.find(num);

        const ScriptSceneInput* sA = (itA != mapA.end()) ? itA->second : nullptr;
        const ScriptSceneInput* sB = (itB != mapB.end()) ? itB->second : nullptr;

        SceneDiffResult res;
        res.sceneNumber = num;

        if (!sA && sB) {
            // ADDED Scene
            summary.addedScenesCount++;
            res.sceneId = sB->id;
            res.status = "ADDED";
            res.titleB = sB->heading;
            res.pageShiftEighths = sB->pageEighths;
            summary.netPageShiftEighths += sB->pageEighths;

            // All items are added
            for (const auto& item : sB->breakdownItems) {
                res.elementDeltas.push_back({item.first, item.second, true});
            }

            // All lines are insertions
            auto diffLinesRes = diffLines("", sB->scriptText);
            res.hunks = createHunks(diffLinesRes, 3);
            summary.scenes.push_back(std::move(res));

        } else if (sA && !sB) {
            // REMOVED Scene
            summary.removedScenesCount++;
            res.sceneId = sA->id;
            res.status = "REMOVED";
            res.titleA = sA->heading;
            res.pageShiftEighths = -sA->pageEighths;
            summary.netPageShiftEighths -= sA->pageEighths;

            // All items are removed
            for (const auto& item : sA->breakdownItems) {
                res.elementDeltas.push_back({item.first, item.second, false});
            }

            auto diffLinesRes = diffLines(sA->scriptText, "");
            res.hunks = createHunks(diffLinesRes, 3);
            summary.scenes.push_back(std::move(res));

        } else if (sA && sB) {
            res.sceneId = sB->id;
            res.titleA = sA->heading;
            res.titleB = sB->heading;

            int32_t shift = sB->pageEighths - sA->pageEighths;
            res.pageShiftEighths = shift;
            summary.netPageShiftEighths += shift;

            // Check element diffs
            std::set<std::pair<std::string, std::string>> setA(sA->breakdownItems.begin(), sA->breakdownItems.end());
            std::set<std::pair<std::string, std::string>> setB(sB->breakdownItems.begin(), sB->breakdownItems.end());

            for (const auto& item : setB) {
                if (setA.find(item) == setA.end()) {
                    res.elementDeltas.push_back({item.first, item.second, true}); // added
                }
            }
            for (const auto& item : setA) {
                if (setB.find(item) == setB.end()) {
                    res.elementDeltas.push_back({item.first, item.second, false}); // removed
                }
            }

            // Check if text or heading changed
            bool textChanged = (sA->scriptText != sB->scriptText) || (sA->heading != sB->heading);
            if (textChanged || !res.elementDeltas.empty()) {
                summary.modifiedScenesCount++;
                res.status = "MODIFIED";
                auto diffLinesRes = diffLines(sA->scriptText, sB->scriptText);
                res.hunks = createHunks(diffLinesRes, 3);
            } else {
                summary.unchangedScenesCount++;
                res.status = "UNCHANGED";
            }

            summary.scenes.push_back(std::move(res));
        }
    }

    return summary;
}

std::string VaultDiffEngine::formatUnifiedDiff(
    const std::string& fileA,
    const std::string& fileB,
    const std::vector<DiffHunk>& hunks
) {
    std::ostringstream oss;
    oss << "--- " << fileA << "\n";
    oss << "+++ " << fileB << "\n";

    for (const auto& hunk : hunks) {
        oss << "@@ -" << hunk.startLineA << "," << hunk.countA 
            << " +" << hunk.startLineB << "," << hunk.countB << " @@\n";
        for (const auto& line : hunk.lines) {
            if (line.op == DiffOp::EQUAL) {
                oss << " " << line.text << "\n";
            } else if (line.op == DiffOp::INSERT) {
                oss << "+" << line.text << "\n";
            } else if (line.op == DiffOp::DELETE) {
                oss << "-" << line.text << "\n";
            }
        }
    }

    return oss.str();
}

} // namespace backstage::vault
