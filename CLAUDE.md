# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React-based Mystery Pack Revenue Simulator - a single-page application that models the financial dynamics of mystery box/pack businesses with a buyback system. The application allows users to simulate revenue scenarios by configuring pack prices, item value distributions, buyback rates, and commission structures.

## Architecture

**Single-file React Application**: The entire application is contained in `index.tsx` (545 lines). This is a standalone React component with no external project structure, build configuration, or package management files.

**Key Business Model**: The simulator models two revenue streams:
1. **Keep Flow**: Users pay pack price, receive item, keep it. Business pays product cost.
2. **Buyback Flow**: Users pay pack price, receive item, sell it back at configured percentage. Business earns commission and item returns to inventory (no additional product cost).

**Core State Management**: Uses React hooks (`useState`) to manage:
- Base parameters (numPacks, costPerPack, productCostPercent, buybackPercent, commissionPercent)
- Optimization settings (optimizeMode, targetEV)
- Price ranges array with probability distributions and buyback rates

**Critical Calculation Flow**:
1. For each price range, calculates how many items fall into that range based on probability
2. Splits items into "kept" vs "bought back" using the buyback rate
3. Calculates costs only for kept items (buyback items return to circulation)
4. Calculates commission earned on buyback transactions
5. Aggregates totals to compute net revenue and profit per pack

## Key Features

**EV Optimization (lines 29-82)**: Implements a pyramid probability model where lower-value items have higher probability. Uses iterative optimization to find probability distribution that matches target expected value while maintaining descending probability constraint.

**Dynamic Price Ranges**: Configurable value ranges with individual min/max/avgValue/probability/buybackRate parameters. Default setup has 6 ranges from $40-$4000.

**Real-time Calculations**: All financial metrics recalculate reactively when any input changes. Includes detailed per-range breakdowns and aggregate summaries.

## Development Notes

This appears to be a development/prototype file meant for environments like CodeSandbox, StackBlitz, or similar React playgrounds. There are no build commands, test suites, or deployment configurations present.

**To run this code**: This TSX file needs to be placed in a React environment with the following dependencies:
- React 18+ with hooks support
- `lucide-react` for icons (Package, Calculator, Info components)
- Tailwind CSS for styling (uses utility classes extensively)

**Component Structure**: Single default export `MysteryPackSimulator` - this is the root component containing all UI and logic.

**Mathematical Model**: The optimization algorithm (lines 43-71) uses exponential decay weighting to maintain pyramid shape while achieving target EV. Critical constraint: probabilities must sum to 1.0 (100%).
