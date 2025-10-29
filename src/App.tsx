import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Package, Calculator, Info, ChevronDown, ChevronRight, Download, Plus, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';

// Tooltip Component
interface TooltipProps {
  text: string;
  children?: React.ReactNode;
}

function Tooltip({ text, children }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.top,
        left: rect.right + 8
      });
    }
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  return (
    <>
      <div className="relative inline-block" style={{ zIndex: 10 }}>
        <div
          ref={triggerRef}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="cursor-help inline-flex relative"
          style={{ zIndex: 10 }}
        >
          {children || <Info className="w-4 h-4 text-gray-400 hover:text-gray-600" />}
        </div>
      </div>
      {isVisible && createPortal(
        <div
          className="fixed w-64 p-3 text-sm text-white bg-gray-800 rounded-lg shadow-2xl"
          style={{
            zIndex: 999999,
            top: `${position.top - 8}px`,
            left: `${position.left}px`,
            pointerEvents: 'none'
          }}
        >
          <div className="absolute w-2 h-2 bg-gray-800 transform rotate-45 -left-1 top-4"></div>
          {text}
        </div>,
        document.body
      )}
    </>
  );
}

export default function MysteryPackSimulator() {
  const [numPacks, setNumPacks] = useState(1000);
  const [costPerPack, setCostPerPack] = useState(100);
  const [productCostPercent, setProductCostPercent] = useState(95);
  const [buybackPercent, setBuybackPercent] = useState(90);
  const [commissionPercent, setCommissionPercent] = useState(10);

  const [optimizeMode, setOptimizeMode] = useState(false);
  const [targetEV, setTargetEV] = useState(100);

  const [optimizeRevenue, setOptimizeRevenue] = useState(false);
  const [targetNetRevenuePercent, setTargetNetRevenuePercent] = useState(5);

  // Platform and payment fees
  const [platformFeePercent, setPlatformFeePercent] = useState(6);
  const [includePlatformFees, setIncludePlatformFees] = useState(true);
  const [paymentProcessingPercent, setPaymentProcessingPercent] = useState(2.9);
  const [paymentProcessingFlat, setPaymentProcessingFlat] = useState(0.30);

  // Track which range details are expanded
  const [expandedRanges, setExpandedRanges] = useState<Set<number>>(new Set());
  
  const [priceRanges, setPriceRanges] = useState([
    { id: 1, name: 'Range 1', min: 40, max: 59.99, probability: 0.57, buybackRate: 0.8179, avgValue: 45.72 },
    { id: 2, name: 'Range 2', min: 60, max: 89.99, probability: 0.26, buybackRate: 0.7738, avgValue: 65.59 },
    { id: 3, name: 'Range 3', min: 90, max: 149.99, probability: 0.104, buybackRate: 0.6358, avgValue: 93.00 },
    { id: 4, name: 'Range 4', min: 150, max: 299.99, probability: 0.03995, buybackRate: 0.3478, avgValue: 176.59 },
    { id: 5, name: 'Range 5', min: 300, max: 599.99, probability: 0.01649, buybackRate: 0, avgValue: 306.25 },
    { id: 6, name: 'Range 6', min: 600, max: 4000, probability: 0.00956, buybackRate: 0, avgValue: 1732.65 }
  ]);

  const updatePriceRange = (id: number, field: string, value: string | number) => {
    setPriceRanges(priceRanges.map(r => {
      if (r.id === id) {
        // Handle string fields (like name) vs numeric fields
        if (field === 'name') {
          return { ...r, name: String(value) };
        } else {
          const numValue = typeof value === 'number' ? value : parseFloat(value) || 0;
          return { ...r, [field]: numValue };
        }
      }
      return r;
    }));
  };

  const addPriceRange = () => {
    const maxId = Math.max(...priceRanges.map(r => r.id), 0);
    const lastRange = priceRanges[priceRanges.length - 1];

    const newRange = {
      id: maxId + 1,
      name: `Range ${maxId + 1}`,
      min: lastRange ? lastRange.max + 0.01 : 0,
      max: lastRange ? lastRange.max + 100 : 100,
      avgValue: lastRange ? lastRange.max + 50 : 50,
      probability: 0.01,
      buybackRate: 0.5
    };

    setPriceRanges([...priceRanges, newRange]);
  };

  const removePriceRange = (id: number) => {
    if (priceRanges.length <= 1) {
      alert('Cannot remove the last price range. At least one range is required.');
      return;
    }
    setPriceRanges(priceRanges.filter(r => r.id !== id));

    // Remove from expanded ranges if it was expanded
    const newExpanded = new Set(expandedRanges);
    newExpanded.delete(id);
    setExpandedRanges(newExpanded);
  };

  const toggleRangeExpanded = (id: number) => {
    const newExpanded = new Set(expandedRanges);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRanges(newExpanded);
  };

  // Helper function to calculate net revenue % for given probabilities
  const calculateNetRevenuePercent = (probs: number[], ranges: typeof priceRanges) => {
    let totalItemsKept = 0;
    let totalCostForKeptItems = 0;
    let totalBuybacks = 0;
    let totalBuybackValue = 0;
    let totalCommissionEarned = 0;

    ranges.forEach((range, idx) => {
      const packsWithThisRange = numPacks * probs[idx];
      // avgValue is already the cost basis, no need to multiply by productCostPercent
      const productCostPerItem = range.avgValue;

      const itemsKept = packsWithThisRange * (1 - range.buybackRate);
      totalItemsKept += itemsKept;
      totalCostForKeptItems += itemsKept * productCostPerItem;

      const itemsBoughtBack = packsWithThisRange * range.buybackRate;
      totalBuybacks += itemsBoughtBack;

      // Buyback calculated on cost basis (avgValue), not market value
      const buybackValue = range.avgValue * (buybackPercent / 100);
      const commissionEarned = buybackValue * (commissionPercent / 100);

      totalBuybackValue += itemsBoughtBack * buybackValue;
      totalCommissionEarned += itemsBoughtBack * commissionEarned;
    });

    const totalRevenue = numPacks * costPerPack;

    // Calculate fees for optimization
    const totalPaymentProcessingFees = (numPacks * costPerPack * (paymentProcessingPercent / 100)) + (numPacks * paymentProcessingFlat);
    const platformFeesOnSales = !includePlatformFees ? numPacks * costPerPack * (platformFeePercent / 100) : 0;

    // Option B: subtract full buyback value, then add commission
    const netRevenue = totalRevenue
      - totalBuybackValue
      + totalCommissionEarned
      - platformFeesOnSales
      - totalCostForKeptItems
      - totalPaymentProcessingFees;

    return (netRevenue / totalRevenue) * 100;
  };

  // Optimization function - Pyramid model: lowest value items = highest probability
  const optimizeProbabilities = () => {
    const sortedRanges = [...priceRanges].sort((a, b) => a.avgValue - b.avgValue);

    let pyramidWeights = [1.0, 0.5, 0.25, 0.12, 0.06, 0.03];

    while (pyramidWeights.length < sortedRanges.length) {
      pyramidWeights.push(pyramidWeights[pyramidWeights.length - 1] * 0.5);
    }
    pyramidWeights = pyramidWeights.slice(0, sortedRanges.length);

    let bestProbs: number[] = [];
    let bestScore = Infinity;

    for (let steepness = 0.1; steepness <= 5.0; steepness += 0.05) {
      const weights = pyramidWeights.map((w, idx) => w * Math.exp(-steepness * idx / sortedRanges.length));
      const totalWeight = weights.reduce((sum, w) => sum + w, 0);
      const probs = weights.map(w => w / totalWeight);

      let validPyramid = true;
      for (let i = 1; i < probs.length; i++) {
        if (probs[i] >= probs[i - 1]) {
          validPyramid = false;
          break;
        }
      }

      if (!validPyramid) continue;

      let score = 0;

      // Calculate EV difference if optimizing for EV
      if (optimizeMode) {
        let avgItemValue = 0;
        sortedRanges.forEach((range, idx) => {
          avgItemValue += probs[idx] * range.avgValue;
        });
        const evDiff = Math.abs(avgItemValue - targetEV);
        score += evDiff;
      }

      // Calculate Net Revenue % difference if optimizing for revenue
      if (optimizeRevenue) {
        const netRevenuePercent = calculateNetRevenuePercent(probs, sortedRanges);
        const revenueDiff = Math.abs(netRevenuePercent - targetNetRevenuePercent);
        score += revenueDiff * 10; // Weight revenue difference higher
      }

      if (score < bestScore) {
        bestScore = score;
        bestProbs = [...probs];
      }

      if (score < 0.1) break;
    }

    const newProbabilities: { [key: number]: number } = {};
    sortedRanges.forEach((range, idx) => {
      newProbabilities[range.id] = bestProbs[idx];
    });

    setPriceRanges(priceRanges.map(r => ({
      ...r,
      probability: newProbabilities[r.id]
    })));
  };

  // Calculations
  const totalProbability = priceRanges.reduce((sum, r) => sum + r.probability, 0);
  
  const calculations = priceRanges.map(range => {
    const packsWithThisRange = numPacks * range.probability;
    const gmvForRange = packsWithThisRange * range.avgValue;
    // avgValue is already the cost basis, no need to multiply by productCostPercent
    const productCostPerItem = range.avgValue;

    // Items kept by users
    const itemsKept = packsWithThisRange * (1 - range.buybackRate);
    const costForKeptItems = itemsKept * productCostPerItem;
    
    // Items bought back
    const itemsBoughtBack = packsWithThisRange * range.buybackRate;
    // Buyback calculated on cost basis (avgValue), not market value
    const buybackValue = range.avgValue * (buybackPercent / 100);
    const commissionEarned = buybackValue * (commissionPercent / 100);
    const netPayoutToUser = buybackValue - commissionEarned;
    const totalBuybackValue = itemsBoughtBack * buybackValue;  // Full buyback value (before commission)
    const totalPayoutForBuybacks = itemsBoughtBack * netPayoutToUser;  // Actual payout to users
    const totalCommissionEarned = itemsBoughtBack * commissionEarned;
    
    // NOTE: We don't include cost for buyback items because those items return to circulation
    // We only purchase inventory for items that will be kept by users (+ buffer)
    
    return {
      ...range,
      packsWithThisRange,
      gmvForRange,
      productCostPerItem,
      itemsKept,
      costForKeptItems,
      itemsBoughtBack,
      buybackValue,
      commissionEarned,
      netPayoutToUser,
      totalBuybackValue,
      totalPayoutForBuybacks,
      totalCommissionEarned
    };
  });

  const totalGMV = calculations.reduce((sum, c) => sum + c.gmvForRange, 0);
  const totalItemsKept = calculations.reduce((sum, c) => sum + c.itemsKept, 0);
  const totalCostForKeptItems = calculations.reduce((sum, c) => sum + c.costForKeptItems, 0);
  const totalBuybacks = calculations.reduce((sum, c) => sum + c.itemsBoughtBack, 0);
  const totalBuybackValue = calculations.reduce((sum, c) => sum + c.totalBuybackValue, 0);
  const totalPayoutForBuybacks = calculations.reduce((sum, c) => sum + c.totalPayoutForBuybacks, 0);
  const totalCommissionEarned = calculations.reduce((sum, c) => sum + c.totalCommissionEarned, 0);

  const totalRevenue = numPacks * costPerPack;

  // Calculate fees
  // Payment processing fees - ONLY on pack sales
  // Formula: paymentProcessingPercent * (numPacks * packPrice) + (numPacks * flatFee)
  const totalPaymentProcessingFees = (numPacks * costPerPack * (paymentProcessingPercent / 100)) + (numPacks * paymentProcessingFlat);

  // Platform fees on pack sales
  // If we're NOT the platform, we pay platform fees (it's a cost)
  // If we ARE the platform, we don't pay ourselves (it's zero)
  const totalPlatformFees = !includePlatformFees ? numPacks * costPerPack * (platformFeePercent / 100) : 0;

  // Only factor in cost for items KEPT by users (buyback items return to circulation)
  const totalItemCosts = totalCostForKeptItems;

  // Net revenue calculation with fees (Option B: subtract full buyback value, then add commission)
  const netRevenue = totalRevenue
    - totalBuybackValue              // Subtract full buyback value (90% of item value)
    + totalCommissionEarned          // Add back commission (10% of buyback value)
    - totalPlatformFees              // Subtract platform fees (unless we ARE the platform, then it's 0)
    - totalItemCosts
    - totalPaymentProcessingFees;

  const profitPerPack = netRevenue / numPacks;
  // Calculate customer-facing EV (fair market value)
  // avgValue represents our cost basis, so divide by productCostPercent to get FMV
  const averageItemValue = (totalGMV / numPacks) / (productCostPercent / 100);

  // Export to Excel functionality
  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    // First, prepare all sheets data

    // Parameters Data (divide percentages by 100 for Excel % format)
    const parametersData = [
      ['Mystery Pack Revenue Simulator - Export'],
      [''],
      ['BASE PARAMETERS'],
      ['Number of Mystery Packs', numPacks],
      ['Pack Price ($)', costPerPack],
      ['Product Cost (%)', productCostPercent / 100],
      ['Buyback Rate (%)', buybackPercent / 100],
      ['Commission on Buybacks (%)', commissionPercent / 100],
      [''],
      ['TRANSACTION FEES'],
      ['Platform Fee (%)', platformFeePercent / 100],
      ['I AM the platform (Yes = no fees)', includePlatformFees ? 'Yes' : 'No'],
      ['Payment Processing (%)', paymentProcessingPercent / 100],
      ['Payment Processing Flat Fee ($)', paymentProcessingFlat],
    ];
    const wsParams = XLSX.utils.aoa_to_sheet(parametersData);

    // Price Ranges Data
    const rangesData = [
      ['PRICE RANGES & PROBABILITIES'],
      [''],
      ['Range Name', 'Min ($)', 'Max ($)', 'Avg Cost Basis ($)', 'Probability (%)', 'Buyback Rate (%)'],
      ...priceRanges.map((range) => [
        range.name,
        range.min,
        range.max,
        range.avgValue,
        range.probability * 100,
        range.buybackRate * 100
      ])
    ];
    const wsRanges = XLSX.utils.aoa_to_sheet(rangesData);

    // Calculations Data
    const calcData: any[][] = [
      ['DETAILED CALCULATIONS BY RANGE'],
      [''],
      ['Range', 'Packs in Range', 'Items Kept', 'Cost for Kept Items', 'Items Bought Back', 'Buyback Value (Full)', 'Commission Earned'],
    ];

    priceRanges.forEach((range, idx) => {
      const calcRow = idx + 4; // Row in Calculations sheet
      const rangeRow = idx + 4; // Row in Price Ranges sheet (data starts at row 4)

      calcData.push([
        range.name,
        // Packs in Range = numPacks * (probability% / 100)
        { f: `Parameters!$B$4*('Price Ranges'!$E$${rangeRow}/100)` },
        // Items Kept = Packs in Range * (1 - buybackRate% / 100)
        { f: `B${calcRow}*(1-'Price Ranges'!$F$${rangeRow}/100)` },
        // Cost for Kept Items = Items Kept * avgValue (avgValue is already cost basis)
        { f: `C${calcRow}*'Price Ranges'!$D$${rangeRow}` },
        // Items Bought Back = Packs in Range * (buybackRate% / 100)
        { f: `B${calcRow}*('Price Ranges'!$F$${rangeRow}/100)` },
        // Buyback Value (Full) = Items Bought Back * avgValue * buybackPercent (B7 has decimal value now)
        { f: `E${calcRow}*'Price Ranges'!$D$${rangeRow}*Parameters!$B$7` },
        // Commission Earned = Buyback Value * commission (B8 has decimal value now)
        { f: `F${calcRow}*Parameters!$B$8` }
      ]);
    });

    // Add totals row
    const lastRow = calcData.length + 1;
    calcData.push([
      'TOTALS',
      { f: `SUM(B4:B${lastRow - 1})` },
      { f: `SUM(C4:C${lastRow - 1})` },
      { f: `SUM(D4:D${lastRow - 1})` },
      { f: `SUM(E4:E${lastRow - 1})` },
      { f: `SUM(F4:F${lastRow - 1})` },
      { f: `SUM(G4:G${lastRow - 1})` }
    ]);

    const wsCalc = XLSX.utils.aoa_to_sheet(calcData);

    // Summary Data
    const summaryData = [
      ['SUMMARY RESULTS'],
      [''],
      ['Total Packs Sold', { f: 'Parameters!$B$4' }],
      ['Pack Price ($)', { f: 'Parameters!$B$5' }],
      ['Average Item Value (EV)', { f: `SUMPRODUCT('Price Ranges'!$D$4:$D$${3 + priceRanges.length},'Price Ranges'!$E$4:$E$${3 + priceRanges.length})/Parameters!$B$6` }],
      ['Total Buybacks', { f: `Calculations!$E$${lastRow}` }],
      [''],
      ['REVENUE BREAKDOWN'],
      ['Pack Sales Revenue', { f: 'Parameters!$B$4*Parameters!$B$5' }],
      ['- Platform Fees', { f: `IF(Parameters!$B$12="No",Parameters!$B$4*Parameters!$B$5*Parameters!$B$11/100,0)` }],
      ['- Buyback Value (Full)', { f: `Calculations!$F$${lastRow}` }],
      ['+ Commission from Buybacks', { f: `Calculations!$G$${lastRow}` }],
      ['- Inventory Cost (Kept Items)', { f: `Calculations!$D$${lastRow}` }],
      ['- Payment Processing Fees', { f: `(Parameters!$B$4*Parameters!$B$5*Parameters!$B$13/100)+(Parameters!$B$4*Parameters!$B$14)` }],
      [''],
      ['Net Revenue', { f: `B9-B10-B11+B12-B13-B14` }],
      ['Net Revenue Margin (%)', { f: 'B16/B9*100' }],
      ['Profit per Pack', { f: 'B16/Parameters!$B$4' }],
      ['Per Pack Margin (%)', { f: 'B18/Parameters!$B$5*100' }],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);

    // Format numbers in Summary sheet
    // Pack Price
    if (wsSummary['B4']) wsSummary['B4'].z = '$#,##0.00';
    // Average Item Value (EV)
    if (wsSummary['B5']) wsSummary['B5'].z = '$#,##0.00';
    // Pack Sales Revenue
    if (wsSummary['B9']) wsSummary['B9'].z = '$#,##0.00';
    // Platform Fees
    if (wsSummary['B10']) wsSummary['B10'].z = '$#,##0.00';
    // Buyback Value
    if (wsSummary['B11']) wsSummary['B11'].z = '$#,##0.00';
    // Commission
    if (wsSummary['B12']) wsSummary['B12'].z = '$#,##0.00';
    // Inventory Cost
    if (wsSummary['B13']) wsSummary['B13'].z = '$#,##0.00';
    // Payment Processing
    if (wsSummary['B14']) wsSummary['B14'].z = '$#,##0.00';
    // Net Revenue
    if (wsSummary['B16']) wsSummary['B16'].z = '$#,##0.00';
    // Net Revenue Margin %
    if (wsSummary['B17']) wsSummary['B17'].z = '0.00%';
    // Profit per Pack
    if (wsSummary['B18']) wsSummary['B18'].z = '$#,##0.00';
    // Per Pack Margin %
    if (wsSummary['B19']) wsSummary['B19'].z = '0.00%';

    // Format Parameters sheet
    if (wsParams['B5']) wsParams['B5'].z = '$#,##0.00'; // Pack Price
    if (wsParams['B6']) wsParams['B6'].z = '0.00%'; // Product Cost %
    if (wsParams['B7']) wsParams['B7'].z = '0.00%'; // Buyback Rate %
    if (wsParams['B8']) wsParams['B8'].z = '0.00%'; // Commission %
    if (wsParams['B11']) wsParams['B11'].z = '0.00%'; // Platform Fee %
    if (wsParams['B13']) wsParams['B13'].z = '0.00%'; // Payment Processing %
    if (wsParams['B14']) wsParams['B14'].z = '$#,##0.00'; // Payment Processing Flat

    // Format Price Ranges sheet
    priceRanges.forEach((_range, idx) => {
      const row = idx + 4;
      if (wsRanges[`B${row}`]) wsRanges[`B${row}`].z = '$#,##0.00'; // Min
      if (wsRanges[`C${row}`]) wsRanges[`C${row}`].z = '$#,##0.00'; // Max
      if (wsRanges[`D${row}`]) wsRanges[`D${row}`].z = '$#,##0.00'; // Avg Cost Basis
      if (wsRanges[`E${row}`]) wsRanges[`E${row}`].z = '0.000%'; // Probability
      if (wsRanges[`F${row}`]) wsRanges[`F${row}`].z = '0.00%'; // Buyback Rate
    });

    // Format Calculations sheet
    for (let i = 4; i < 4 + priceRanges.length; i++) {
      if (wsCalc[`D${i}`]) wsCalc[`D${i}`].z = '$#,##0.00'; // Cost for Kept Items
      if (wsCalc[`F${i}`]) wsCalc[`F${i}`].z = '$#,##0.00'; // Buyback Value
      if (wsCalc[`G${i}`]) wsCalc[`G${i}`].z = '$#,##0.00'; // Commission
    }
    // Totals row
    if (wsCalc[`D${lastRow}`]) wsCalc[`D${lastRow}`].z = '$#,##0.00';
    if (wsCalc[`F${lastRow}`]) wsCalc[`F${lastRow}`].z = '$#,##0.00';
    if (wsCalc[`G${lastRow}`]) wsCalc[`G${lastRow}`].z = '$#,##0.00';

    // Append sheets in order: Summary first for CEO visibility
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
    XLSX.utils.book_append_sheet(wb, wsParams, 'Parameters');
    XLSX.utils.book_append_sheet(wb, wsRanges, 'Price Ranges');
    XLSX.utils.book_append_sheet(wb, wsCalc, 'Calculations');

    // Set column widths for better readability
    const summaryColWidths = [{ wch: 35 }, { wch: 15 }];
    wsSummary['!cols'] = summaryColWidths;

    const paramsColWidths = [{ wch: 35 }, { wch: 15 }];
    wsParams['!cols'] = paramsColWidths;

    const rangesColWidths = [{ wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 18 }, { wch: 15 }, { wch: 15 }];
    wsRanges['!cols'] = rangesColWidths;

    const calcColWidths = [{ wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 18 }];
    wsCalc['!cols'] = calcColWidths;

    // Generate and download
    XLSX.writeFile(wb, `MysteryPackSimulator_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-xl p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Package className="w-8 h-8 text-purple-600" />
              <h1 className="text-3xl font-bold text-gray-800">Mystery Pack Revenue Simulator</h1>
            </div>
            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition shadow-md"
            >
              <Download className="w-5 h-5" />
              Export to Excel
            </button>
          </div>

          {/* Explanation */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-900">
                <p className="font-semibold mb-1">Revenue Model:</p>
                <p><strong>Keep:</strong> User pays pack price, receives item (we pay product cost)</p>
                <p><strong>Buyback:</strong> User pays pack price, receives item, sells back at {buybackPercent}% value. We earn {commissionPercent}% commission and item returns to inventory.</p>
              </div>
            </div>
          </div>

          {/* Base Inputs */}
          <div className="bg-purple-50 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-700 mb-4">Base Parameters</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  Number of Mystery Packs
                  <Tooltip text="The total number of mystery packs you plan to sell in this simulation. All calculations are based on this volume." />
                </label>
                <input
                  type="number"
                  value={numPacks}
                  onChange={(e) => setNumPacks(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  Pack Price ($)
                  <Tooltip text="The price customers pay to purchase one mystery pack. This is your main revenue source before accounting for buybacks." />
                </label>
                <input
                  type="number"
                  value={costPerPack}
                  onChange={(e) => setCostPerPack(parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  Product Cost (%)
                  <Tooltip text="The percentage of an item's value that you pay to acquire it from suppliers. For example, if an item is worth $100 and this is set to 95%, you pay $95 to acquire it. Only applies to items kept by users." />
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    value={productCostPercent}
                    onChange={(e) => setProductCostPercent(parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                  <span className="text-gray-600 font-medium">%</span>
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  Buyback Rate (%)
                  <Tooltip text="The percentage of an item's market value that you pay to buy it back from customers. For example, if an item is worth $100 and this is set to 90%, you pay the customer $90 to buy it back (minus commission)." />
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    value={buybackPercent}
                    onChange={(e) => setBuybackPercent(parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                  <span className="text-gray-600 font-medium">%</span>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                Commission on Buybacks (%)
                <Tooltip text="The platform fee you keep from each buyback transaction. For example, if buyback value is $90 and commission is 10%, you keep $9 and pay the customer $81. This is profit from buyback transactions." />
              </label>
              <div className="flex items-center gap-2 max-w-xs">
                <input
                  type="number"
                  step="0.1"
                  value={commissionPercent}
                  onChange={(e) => setCommissionPercent(parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
                <span className="text-gray-600 font-medium">%</span>
              </div>
            </div>

            {/* Platform and Payment Processing Fees */}
            <div className="mt-6 pt-6 border-t border-purple-200">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">Transaction Fees</h3>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    Platform Fees (%)
                    <Tooltip text="Fees charged by the platform on each pack sale. Default is 6%. Only applies if you're operating as the platform AND seller." />
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.1"
                      value={platformFeePercent}
                      onChange={(e) => setPlatformFeePercent(parseFloat(e.target.value) || 0)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                    <span className="text-gray-600 font-medium">%</span>
                  </div>
                  <label className="flex items-center gap-2 mt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includePlatformFees}
                      onChange={(e) => setIncludePlatformFees(e.target.checked)}
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700">I AM the platform (check to zero out platform fees - uncheck if selling ON a platform)</span>
                  </label>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    Payment Processing Fees
                    <Tooltip text="Fees charged by payment processors (Stripe, PayPal, etc.) on all transactions. Default is 2.9% + $0.30 per transaction. Applied to both pack sales and buyback payouts." />
                  </label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.1"
                        value={paymentProcessingPercent}
                        onChange={(e) => setPaymentProcessingPercent(parseFloat(e.target.value) || 0)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      />
                      <span className="text-gray-600 font-medium">%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600 font-medium">+</span>
                      <input
                        type="number"
                        step="0.01"
                        value={paymentProcessingFlat}
                        onChange={(e) => setPaymentProcessingFlat(parseFloat(e.target.value) || 0)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      />
                      <span className="text-gray-600 font-medium">$ per transaction</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Optimization Section */}
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-orange-200 rounded-lg p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-gray-700 mb-1">EV Optimization (Pyramid Model)</h2>
                <Tooltip text="Automatically adjusts probability distributions across your value ranges to achieve a target average item value. Uses a pyramid model where lower-value items have higher probability than higher-value items, which is typical for mystery boxes." />
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <span className="text-sm font-medium text-gray-700">Enable</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={optimizeMode}
                    onChange={(e) => setOptimizeMode(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-14 h-8 rounded-full transition ${optimizeMode ? 'bg-orange-500' : 'bg-gray-300'}`}>
                    <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition transform ${optimizeMode ? 'translate-x-6' : ''}`}></div>
                  </div>
                </div>
              </label>
            </div>

            {optimizeMode && (
              <div>
                <div className="flex items-end gap-4 mb-3">
                  <div className="flex-1">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                      Target Average Item Value ($)
                      <Tooltip text="The desired average value of items across all packs. The optimizer will adjust probabilities to hit this target while maintaining the pyramid structure (low value = high probability)." />
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={targetEV}
                      onChange={(e) => setTargetEV(parseFloat(e.target.value) || 0)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <button
                    onClick={optimizeProbabilities}
                    className="px-6 py-2 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition flex items-center gap-2"
                  >
                    <Calculator className="w-4 h-4" />
                    Optimize
                  </button>
                </div>
                <div className="bg-orange-100 rounded p-3 text-sm text-orange-900">
                  Maintains pyramid: low-value items = high probability, high-value items = low probability
                </div>
              </div>
            )}
          </div>

          {/* Net Revenue Optimization Section */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-gray-700 mb-1">Net Revenue % Optimization</h2>
                <Tooltip text="Automatically adjusts probability distributions to achieve a target profit margin percentage. This helps you find the right balance between customer satisfaction (EV) and profitability." />
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <span className="text-sm font-medium text-gray-700">Enable</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={optimizeRevenue}
                    onChange={(e) => setOptimizeRevenue(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-14 h-8 rounded-full transition ${optimizeRevenue ? 'bg-blue-500' : 'bg-gray-300'}`}>
                    <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition transform ${optimizeRevenue ? 'translate-x-6' : ''}`}></div>
                  </div>
                </div>
              </label>
            </div>

            {optimizeRevenue && (
              <div>
                <div className="flex items-end gap-4 mb-3">
                  <div className="flex-1">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                      Target Net Revenue Margin (%)
                      <Tooltip text="The desired profit margin as a percentage of pack sales revenue. Formula: (Net Revenue ÷ Pack Sales) × 100. The optimizer will adjust probabilities to hit this target while maintaining the pyramid structure." />
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={targetNetRevenuePercent}
                      onChange={(e) => setTargetNetRevenuePercent(parseFloat(e.target.value) || 0)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <button
                    onClick={optimizeProbabilities}
                    className="px-6 py-2 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition flex items-center gap-2"
                  >
                    <Calculator className="w-4 h-4" />
                    Optimize
                  </button>
                </div>
                <div className="bg-blue-100 rounded p-3 text-sm text-blue-900">
                  {optimizeMode && optimizeRevenue ? (
                    <span>Combined optimization: Will balance both target EV and target net revenue %</span>
                  ) : (
                    <span>Maintains pyramid structure while optimizing for profit margin</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Probability Check */}
          {Math.abs(totalProbability - 1) > 0.001 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-yellow-600" />
                <span className="text-sm text-yellow-800">
                  Warning: Probabilities sum to {(totalProbability * 100).toFixed(2)}% (should equal 100%)
                </span>
              </div>
            </div>
          )}

          {/* Price Ranges Table */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-700">Item Value Ranges & Buyback Rates</h2>
              <button
                onClick={addPriceRange}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition"
              >
                <Plus className="w-4 h-4" />
                Add Range
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold">
                      <div className="flex items-center gap-2">
                        Range Name
                        <Tooltip text="Custom name for this range. Click to edit and rename (e.g., 'Common', 'Rare', 'Legendary')." />
                      </div>
                    </th>
                    <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold">
                      <div className="flex items-center gap-2">
                        Min ($)
                        <Tooltip text="The minimum market value for items in this price range. Items in your inventory with values at or above this amount (up to Max) fall into this range." />
                      </div>
                    </th>
                    <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold">
                      <div className="flex items-center gap-2">
                        Max ($)
                        <Tooltip text="The maximum market value for items in this price range. Items with values above this fall into the next higher range." />
                      </div>
                    </th>
                    <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold">
                      <div className="flex items-center gap-2">
                        Avg Cost Basis ($)
                        <Tooltip text={`Your average cost to acquire items in this range (typically ${productCostPercent}% of market value). This is used directly for inventory cost and buyback calculations. Customer EV is calculated by converting this to market value (÷ ${productCostPercent}%).`} />
                      </div>
                    </th>
                    <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold">
                      <div className="flex items-center gap-2">
                        Probability (%)
                        <Tooltip text="The chance that a customer receives an item from this value range. All probabilities must sum to 100%. Controls the distribution of items across different value tiers." />
                      </div>
                    </th>
                    <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold">
                      <div className="flex items-center gap-2">
                        Buyback Rate (%)
                        <Tooltip text="The percentage of customers in this range who choose to sell their item back to you instead of keeping it. For example, 80% means 80% of customers will use the buyback option. Based on historical data or estimates." />
                      </div>
                    </th>
                    <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {priceRanges.map((range, idx) => (
                    <tr key={range.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="border border-gray-300 px-4 py-2">
                        <input
                          type="text"
                          value={range.name}
                          onChange={(e) => updatePriceRange(range.id, 'name', e.target.value)}
                          className="w-32 px-2 py-1 border border-gray-300 rounded font-medium"
                          placeholder="Range name"
                        />
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        <input
                          type="number"
                          value={range.min}
                          onChange={(e) => updatePriceRange(range.id, 'min', e.target.value)}
                          className="w-20 px-2 py-1 border border-gray-300 rounded"
                        />
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        <input
                          type="number"
                          value={range.max}
                          onChange={(e) => updatePriceRange(range.id, 'max', e.target.value)}
                          className="w-20 px-2 py-1 border border-gray-300 rounded"
                        />
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        <input
                          type="number"
                          value={range.avgValue}
                          onChange={(e) => updatePriceRange(range.id, 'avgValue', e.target.value)}
                          className="w-20 px-2 py-1 border border-gray-300 rounded"
                        />
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        <input
                          type="number"
                          step="0.001"
                          value={(range.probability * 100).toFixed(3)}
                          onChange={(e) => updatePriceRange(range.id, 'probability', parseFloat(e.target.value) / 100)}
                          className="w-20 px-2 py-1 border border-gray-300 rounded"
                          disabled={optimizeMode}
                        />
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        <input
                          type="number"
                          step="0.01"
                          value={(range.buybackRate * 100).toFixed(2)}
                          onChange={(e) => updatePriceRange(range.id, 'buybackRate', parseFloat(e.target.value) / 100)}
                          className="w-20 px-2 py-1 border border-gray-300 rounded"
                        />
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        <button
                          onClick={() => removePriceRange(range.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded transition"
                          title="Remove this range"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detailed Calculations */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-700 mb-4">Detailed Calculations by Range</h2>
            <div className="space-y-3">
              {calculations.map((calc) => {
                const isExpanded = expandedRanges.has(calc.id);
                return (
                  <div key={calc.id} className="bg-white rounded-lg shadow-sm">
                    <button
                      onClick={() => toggleRangeExpanded(calc.id)}
                      className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition"
                    >
                      <h3 className="font-semibold text-lg text-gray-700">
                        {calc.name}: ${calc.min} - ${calc.max} (Avg: ${calc.avgValue})
                      </h3>
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-gray-600" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-600" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="px-5 pb-5 border-t border-gray-200">
                        <div className="grid md:grid-cols-2 gap-4 mt-4">
                          {/* Keep Flow */}
                          <div className="space-y-3 text-sm">
                            <div className="font-semibold text-indigo-600 text-base mb-2">Items KEPT by Users</div>

                            <div className="bg-blue-50 p-3 rounded">
                              <div className="font-medium text-gray-700 mb-1">Number of Items Kept</div>
                              <div className="text-gray-600 mb-1">
                                Formula: Items in Range × (1 - Buyback Rate)
                              </div>
                              <div className="text-gray-600 mb-1">
                                = {calc.packsWithThisRange.toFixed(2)} × {((1 - calc.buybackRate) * 100).toFixed(2)}%
                              </div>
                              <div className="font-semibold text-indigo-600">
                                = {calc.itemsKept.toFixed(2)} items
                              </div>
                            </div>

                            <div className="bg-red-50 p-3 rounded">
                              <div className="font-medium text-gray-700 mb-1">Our Cost for Kept Items</div>
                              <div className="text-gray-600 mb-1">
                                Formula: Items Kept × Product Cost
                              </div>
                              <div className="text-gray-600 mb-1">
                                Product Cost (Avg Value is our cost basis) = ${calc.productCostPerItem.toFixed(2)}
                              </div>
                              <div className="text-gray-600 mb-1">
                                = {calc.itemsKept.toFixed(2)} × ${calc.productCostPerItem.toFixed(2)}
                              </div>
                              <div className="font-semibold text-red-600">
                                = ${calc.costForKeptItems.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                              </div>
                              <div className="text-xs text-gray-500 mt-2 italic">
                                Note: We only purchase inventory for kept items. Buyback items return to circulation.
                              </div>
                            </div>
                          </div>

                          {/* Buyback Flow */}
                          <div className="space-y-3 text-sm">
                            <div className="font-semibold text-green-600 text-base mb-2">Items BOUGHT BACK</div>

                            <div className="bg-orange-50 p-3 rounded">
                              <div className="font-medium text-gray-700 mb-1">Number of Buybacks</div>
                              <div className="text-gray-600 mb-1">
                                Formula: Items in Range × Buyback Rate
                              </div>
                              <div className="text-gray-600 mb-1">
                                = {calc.packsWithThisRange.toFixed(2)} × {(calc.buybackRate * 100).toFixed(2)}%
                              </div>
                              <div className="font-semibold text-orange-600">
                                = {calc.itemsBoughtBack.toFixed(2)} buybacks
                              </div>
                            </div>

                            <div className="bg-green-50 p-3 rounded">
                              <div className="font-medium text-gray-700 mb-1">Buyback Transaction Details</div>
                              <div className="text-gray-600 space-y-1">
                                <div>Buyback Value ({buybackPercent}% of ${calc.avgValue}) = ${calc.buybackValue.toFixed(2)}</div>
                                <div>Our Commission ({commissionPercent}%) = ${calc.commissionEarned.toFixed(2)}</div>
                                <div>Net Payout to User = ${calc.netPayoutToUser.toFixed(2)}</div>
                                <div className="border-t border-green-200 pt-1 mt-1">
                                  <strong>Total Commission Earned:</strong>
                                  <div>= {calc.itemsBoughtBack.toFixed(2)} × ${calc.commissionEarned.toFixed(2)}</div>
                                  <div className="font-semibold text-green-600">
                                    = ${calc.totalCommissionEarned.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="bg-purple-50 p-3 rounded">
                              <div className="font-medium text-gray-700 mb-1">Total Payout for Buybacks</div>
                              <div className="text-gray-600 mb-1">
                                = {calc.itemsBoughtBack.toFixed(2)} × ${calc.netPayoutToUser.toFixed(2)}
                              </div>
                              <div className="font-semibold text-purple-600">
                                = ${calc.totalPayoutForBuybacks.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                              </div>
                            </div>

                            <div className="bg-gray-50 p-3 rounded border-2 border-gray-300">
                              <div className="font-medium text-gray-700 mb-1">💡 Items Return to Inventory</div>
                              <div className="text-xs text-gray-600">
                                Buyback items return to circulation and can be resold. We don't need to purchase new inventory for these items.
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary Results */}
          <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg p-6 text-white">
            <h2 className="text-2xl font-bold mb-6">Summary Results</h2>

            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white/10 rounded-lg p-4 backdrop-blur">
                <div className="flex items-center gap-2 text-sm opacity-90 mb-1">
                  Total Packs Sold
                  <Tooltip text="The total number of mystery packs in this simulation (from Base Parameters)." />
                </div>
                <div className="text-2xl font-bold">{numPacks.toLocaleString()}</div>
              </div>

              <div className="bg-white/10 rounded-lg p-4 backdrop-blur">
                <div className="flex items-center gap-2 text-sm opacity-90 mb-1">
                  Avg Item Value (Customer EV)
                  <Tooltip text={`Expected Value: The average fair market value of items customers receive. Calculated as: Σ(Probability × Avg Value) ÷ Product Cost % across all ranges. Since your cost basis is ${productCostPercent}% of FMV, this shows the customer-facing market value. This is what customers statistically expect to get per pack.`} />
                </div>
                <div className="text-2xl font-bold">${averageItemValue.toFixed(2)}</div>
              </div>

              <div className="bg-white/10 rounded-lg p-4 backdrop-blur">
                <div className="flex items-center gap-2 text-sm opacity-90 mb-1">
                  Total Buybacks
                  <Tooltip text="The total number of items that customers sell back to you instead of keeping. Calculated by summing: (Items in Range × Buyback Rate) across all ranges." />
                </div>
                <div className="text-2xl font-bold">{totalBuybacks.toFixed(2)}</div>
                <div className="text-xs opacity-75 mt-1">{((totalBuybacks/numPacks)*100).toFixed(2)}% of items</div>
              </div>
            </div>

            {/* Items Needed for Inventory */}
            <div className="bg-white/20 rounded-lg p-5 backdrop-blur mt-6">
              <div className="flex items-center gap-2 text-lg font-semibold mb-3">
                <span>Items Needed for Inventory</span>
                <Tooltip text="Breakdown of how many items from each range you need to stock. Numbers in parentheses show conservative (-10%) and liberal (+10%) inventory levels. Only includes items that customers keep (not buyback items, which return to circulation)." />
              </div>
              <div className="grid md:grid-cols-2 gap-3 text-sm">
                {calculations.map((calc) => {
                  const target = Math.ceil(calc.itemsKept);
                  const conservative = Math.ceil(calc.itemsKept * 0.9);
                  const liberal = Math.ceil(calc.itemsKept * 1.1);
                  return (
                    <div key={calc.id} className="bg-white/10 rounded p-3 flex justify-between items-center">
                      <span className="font-medium">{calc.name} (${calc.min}-${calc.max}):</span>
                      <span className="font-bold text-lg">{target} <span className="text-xs opacity-75">({conservative}-{liberal})</span></span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 pt-4 border-t border-white/30 flex justify-between items-center">
                <span className="font-semibold">Total Items Needed:</span>
                <span className="font-bold text-xl">{Math.ceil(totalItemsKept)} <span className="text-sm opacity-75">({Math.ceil(totalItemsKept * 0.9)}-{Math.ceil(totalItemsKept * 1.1)})</span></span>
              </div>
            </div>

            <div className="space-y-4 mt-6">
              <div className="bg-white/20 rounded-lg p-5 backdrop-blur">
                <div className="text-lg font-semibold mb-3">Revenue Breakdown</div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span>Pack Sales Revenue:</span>
                      <Tooltip text={`Total revenue from selling packs. Formula: Number of Packs × Pack Price = ${numPacks.toLocaleString()} × $${costPerPack} = $${totalRevenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} />
                    </div>
                    <span className="font-semibold">${totalRevenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                  </div>
                  {totalPlatformFees > 0 && (
                    <div className="flex justify-between items-center text-red-200">
                      <div className="flex items-center gap-2">
                        <span>− Platform Fees:</span>
                        <Tooltip text={`Platform fees paid to the marketplace. ${platformFeePercent}% of ${numPacks.toLocaleString()} packs × $${costPerPack} = $${totalPlatformFees.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}. If you ARE the platform, uncheck the box to zero this out.`} />
                      </div>
                      <span className="font-semibold">${totalPlatformFees.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-red-200">
                    <div className="flex items-center gap-2">
                      <span>− Buyback Value (Full):</span>
                      <Tooltip text={`Full value paid for buybacks at ${buybackPercent}% of item value. ${totalBuybacks.toFixed(2)} items bought back at ${buybackPercent}% = $${totalBuybackValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}. This includes the commission we earn.`} />
                    </div>
                    <span className="font-semibold">${totalBuybackValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                  </div>
                  <div className="flex justify-between items-center text-green-200">
                    <div className="flex items-center gap-2">
                      <span>+ Commission from Buybacks:</span>
                      <Tooltip text={`Platform fee earned from buyback transactions. We earn ${commissionPercent}% of the ${buybackPercent}% buyback value. ${totalBuybacks.toFixed(2)} items × ${commissionPercent}% commission = $${totalCommissionEarned.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}. Net payout to users: $${totalPayoutForBuybacks.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} />
                    </div>
                    <span className="font-semibold">${totalCommissionEarned.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                  </div>
                  <div className="flex justify-between items-center text-red-200">
                    <div className="flex items-center gap-2">
                      <span>− Inventory Cost (Kept Items Only):</span>
                      <Tooltip text={`Cost to acquire items that customers keep (not buyback items, which return to inventory). ${totalItemsKept.toFixed(0)} items kept × average cost basis = $${totalCostForKeptItems.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}. Note: Avg Value field represents your cost basis (${productCostPercent}% of market value).`} />
                    </div>
                    <span className="font-semibold">${totalCostForKeptItems.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                  </div>
                  <div className="flex justify-between items-center text-red-200">
                    <div className="flex items-center gap-2">
                      <span>− Payment Processing Fees:</span>
                      <Tooltip text={`Fees charged by payment processors on pack sales only. Formula: ${paymentProcessingPercent}% × (${numPacks.toLocaleString()} packs × $${costPerPack}) + (${numPacks.toLocaleString()} × $${paymentProcessingFlat}) = ${paymentProcessingPercent}% × $${totalRevenue.toLocaleString()} + $${(numPacks * paymentProcessingFlat).toFixed(2)} = $${totalPaymentProcessingFees.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} />
                    </div>
                    <span className="font-semibold">${totalPaymentProcessingFees.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                  </div>
                  <div className="border-t border-white/30 pt-3 mt-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold">Net Revenue:</span>
                        <Tooltip text={`Total profit after all revenue and costs. Formula: Pack Sales ($${totalRevenue.toLocaleString()})${totalPlatformFees > 0 ? ` - Platform Fees ($${totalPlatformFees.toLocaleString()})` : ''} - Buyback Value ($${totalBuybackValue.toLocaleString()}) + Commission ($${totalCommissionEarned.toLocaleString()}) - Inventory Cost ($${totalCostForKeptItems.toLocaleString()}) - Payment Processing Fees ($${totalPaymentProcessingFees.toLocaleString()}) = $${netRevenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} />
                      </div>
                      <span className="text-2xl font-bold">${netRevenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                    <div className="flex justify-between items-center mt-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span>Net Revenue Margin:</span>
                        <Tooltip text={`Profit margin as a percentage of total pack sales revenue. Formula: (Net Revenue ÷ Pack Sales Revenue) × 100 = ($${netRevenue.toLocaleString()} ÷ $${totalRevenue.toLocaleString()}) × 100 = ${((netRevenue / totalRevenue) * 100).toFixed(2)}%`} />
                      </div>
                      <span className="font-semibold">{((netRevenue / totalRevenue) * 100).toFixed(2)}%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white/20 rounded-lg p-5 backdrop-blur">
                <div className="text-lg font-semibold mb-3">Profit per Pack</div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    Formula: Net Revenue ÷ Number of Packs
                    <Tooltip text={`Average profit earned per pack sold. Formula: Total Net Revenue ÷ Number of Packs = $${netRevenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} ÷ ${numPacks.toLocaleString()} = $${profitPerPack.toFixed(2)} per pack`} />
                  </div>
                  <div>= ${netRevenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} ÷ {numPacks.toLocaleString()}</div>
                  <div className="border-t border-white/30 pt-3 mt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold">Profit per Pack:</span>
                      <span className="text-2xl font-bold">${profitPerPack.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center mt-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span>Per Pack Margin:</span>
                        <Tooltip text={`Profit margin per pack as a percentage of pack price. Formula: (Profit per Pack ÷ Pack Price) × 100 = ($${profitPerPack.toFixed(2)} ÷ $${costPerPack}) × 100 = ${((profitPerPack / costPerPack) * 100).toFixed(2)}%`} />
                      </div>
                      <span className="font-semibold">{((profitPerPack / costPerPack) * 100).toFixed(2)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}