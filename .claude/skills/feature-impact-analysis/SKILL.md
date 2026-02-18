---
name: feature-impact-analysis
description: Use when adding a new feature and need to identify edge cases, missing requirements, or affected areas before implementation. Use after you have a design doc or spec but before coding.
---

# Feature Impact Analysis

## Overview

Systematically identify edge cases and affected areas by analyzing how a new feature intersects with existing functionality. Read @DOCS/project-context to understand the system before getting started. The key insight: edge cases live at the boundaries between new and existing features.

## When to Use

- You have a design doc or feature spec ready
- You want to catch edge cases BEFORE implementation
- You're adding functionality that touches existing systems

## Workflow

```dot
digraph impact_analysis {
    rankdir=TB;

    "Load project context docs" [shape=box];
    "Load new feature design" [shape=box];
    "For each existing feature" [shape=diamond];
    "Ask: How does new feature interact?" [shape=box];
    "Document edge cases" [shape=box];
    "Synthesize findings" [shape=box];

    "Load project context docs" -> "Load new feature design";
    "Load new feature design" -> "For each existing feature";
    "For each existing feature" -> "Ask: How does new feature interact?" [label="next feature"];
    "Ask: How does new feature interact?" -> "Document edge cases";
    "Document edge cases" -> "For each existing feature" [label="more features"];
    "For each existing feature" -> "Synthesize findings" [label="done"];
}
```

## Analysis Framework

For each existing feature, ask these questions about the new feature:

| Question | Edge Case Type |
|----------|---------------|
| Does existing feature display items that new feature affects? | **Visibility** - What shows/hides where? |
| Does existing feature filter/search items that new feature modifies? | **Filtering** - Include or exclude? |
| Does existing feature have state that new feature changes? | **State conflicts** - What happens to in-flight operations? |
| Does existing feature have navigation that assumes old behavior? | **Navigation** - Broken links, stale references? |
| Does existing feature cache data that new feature invalidates? | **Cache invalidation** - Stale data scenarios? |
| Does existing feature have permissions/limits affected? | **Authorization** - Who can do what now? |

## Prompt Template

```
Consider the existing features and how this product works by studying [PROJECT_CONTEXT_DOCS].

Then consider the new feature design in [DESIGN_DOC].

For each existing feature:
1. How might the new feature interact with it?
2. What edge cases exist at the intersection?
3. What assumptions does the existing feature make that the new feature might violate?

List specific edge cases I might be missing.
```

## Example Output Categories

Good edge case analysis groups findings by:

- **Display/UI conflicts** - Where archived items shouldn't appear but might
- **Data consistency** - What happens to related records
- **User workflows** - Multi-step processes interrupted by new state
- **Search/filter behavior** - Include or exclude by default
- **Performance** - New queries, indexes needed
- **Migration** - Existing data needs updating

## Common Misses

Edge cases often missed without systematic analysis:

| Area | Example |
|------|---------|
| Recents/history lists | Do they show archived items? |
| Count badges | Do counts include archived? |
| Default sorts | Where do archived items appear? |
| Bulk operations | Can you bulk-archive? Bulk-unarchive? |
| Related item displays | Project shows chat count - include archived? |
| Export/import | How are archived items handled? |
| API responses | Do APIs filter by default or require flag? |

## Anti-Patterns

- **Analyzing in isolation** - New feature edge cases come from INTERSECTIONS with existing features
- **Only considering happy path** - What happens when user is mid-action and state changes?
- **Forgetting search** - Search almost always needs special consideration
- **Ignoring counts/badges** - Small UI elements often have hidden dependencies
