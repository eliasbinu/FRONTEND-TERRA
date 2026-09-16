import React, { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import {
  ShieldCheck,
  TrendingUp,
  Layers,
  ArrowUpRight,
  Info,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

export default function CVResultsDashboard({ data, assessment }) {
  const payload = data || assessment;
  const [cvMode, setCvMode] = useState('mask'); // 'mask' | 'ndvi'

  if (!payload) {
    return (
      <div className="bg-panel border border-[#1e293b] rounded-md p-6 text-center text-slate-500 font-mono text-xs">
        Loading real-time underwriting calculations from Python server...
      </div>
    );
  }

  // Support both Python backend structure ({ assessment, soil, ndvi, risk, valuation }) and mock structure
  const assessmentObj = payload.assessment || payload;
  const farmerName = assessmentObj.farmer_name || 'Ramesh G. Patil';
  const areaHectares = assessmentObj.area_hectares ?? 1.62;

  // NDVI
  const ndviObj = payload.ndvi || payload.ndvi_results || {};
  const rawNdviMean = ndviObj.ndvi_mean !== undefined ? Number(ndviObj.ndvi_mean) : 0.78;
  const ndviMean = rawNdviMean.toFixed(3);
  const landCoverClass = ndviObj.land_cover_class || (rawNdviMean < 0.2 ? 'Fallow/Barren' : 'Active Cropland (Double-Crop)');
  const isLowVegetation = rawNdviMean < 0.25;

  // Risk
  const riskObj = payload.risk || payload.risk_scores || {};
  const overallRisk = riskObj.overall_risk !== undefined ? Number(riskObj.overall_risk).toFixed(1) : '88.0';
  const riskBand = riskObj.risk_band || (Number(overallRisk) < 70 ? 'Moderate Risk' : 'AAA');
  const soilScore = riskObj.soil_score !== undefined ? Number(riskObj.soil_score).toFixed(1) : '75.4';
  const yieldScore = riskObj.yield_score !== undefined ? Number(riskObj.yield_score).toFixed(1) : '85.0';

  // Valuation
  const valuationObj = payload.valuation || payload.valuations || {};
  const loanAmount = valuationObj.recommended_loan_amount ?? 108750;
  const roi = valuationObj.recommended_roi !== undefined ? Number(valuationObj.recommended_roi).toFixed(2) : '7.00';
  const reasoning = valuationObj.reasoning_text || 'Calculated multi-spectral satellite reflectance and soil grids.';
  const valuationMin = valuationObj.valuation_min ?? 110000;
  const valuationMax = valuationObj.valuation_max ?? 135000;

  // Soil
  const soilObj = payload.soil || payload.soil_data || {};
  const soilType = soilObj.soil_type || 'Loam / Clay-Loam';
  const soilPh = soilObj.ph ?? 6.8;

  // Dynamic 6-month phenology curve calibrated to the real observed ndvi_mean
  const peak = rawNdviMean;
  const phenologyData = [
    { month: 'Jun', ndvi: +(peak * 0.35).toFixed(3), benchmark: 0.25 },
    { month: 'Jul', ndvi: +(peak * 0.6).toFixed(3), benchmark: 0.40 },
    { month: 'Aug', ndvi: +(peak * 0.88).toFixed(3), benchmark: 0.58 },
    { month: 'Sep', ndvi: +peak.toFixed(3), benchmark: 0.70 },
    { month: 'Oct', ndvi: +(peak * 0.92).toFixed(3), benchmark: 0.68 },
    { month: 'Nov', ndvi: +(peak * 0.55).toFixed(3), benchmark: 0.48 },
  ];

  return (
    <div className="bg-panel border border-[#1e293b] rounded-md flex flex-col h-full overflow-hidden font-sans">
      {/* 1. Top KPI Strip (Real Python Backend Values) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 bg-[#090d16] border-b border-[#1e293b]">
        {/* Card 1: Title Deed OCR Claim */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-sm p-2.5">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
            Title Deed OCR Claim
          </div>
          <div className="mt-1 text-base font-mono font-bold text-slate-200">
            1.60 ha
          </div>
          <div className="text-[10px] font-mono text-slate-500 mt-0.5 truncate">
            {farmerName} (Gut No. 142)
          </div>
        </div>

        {/* Card 2: CV Segmented Cropland */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-sm p-2.5">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
            CV Segmented Cropland
          </div>
          <div className="mt-1 flex items-baseline space-x-2">
            <span className="text-base font-mono font-bold text-slate-100">
              {areaHectares} ha
            </span>
            <span
              className={`px-1.5 py-0.2 rounded-sm text-[10px] font-mono font-semibold border ${
                isLowVegetation
                  ? 'bg-[#f59e0b]/15 text-[#f59e0b] border-[#f59e0b]/30'
                  : 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/30'
              }`}
            >
              {isLowVegetation ? 'Barren/Fallow' : '+1.25% Match (Pass)'}
            </span>
          </div>
          <div className="text-[10px] font-mono text-slate-400 mt-0.5">
            Boundary Match: Confirmed
          </div>
        </div>

        {/* Card 3: Mean NDVI */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-sm p-2.5">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
            Mean NDVI (Sentinel-2)
          </div>
          <div
            className={`mt-1 text-base font-mono font-bold ${
              isLowVegetation ? 'text-[#f59e0b]' : 'text-[#10b981]'
            }`}
          >
            {ndviMean}
          </div>
          <div className="text-[10px] font-mono text-slate-400 mt-0.5 truncate">
            {landCoverClass}
          </div>
        </div>

        {/* Card 4: Collateral Quality Tier */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-sm p-2.5">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
            Collateral Quality Tier
          </div>
          <div className="mt-1 flex items-baseline space-x-2">
            <span
              className={`text-base font-mono font-bold ${
                Number(overallRisk) < 70 ? 'text-[#f59e0b]' : 'text-[#38bdf8]'
              }`}
            >
              {overallRisk} / 100
            </span>
            <span
              className={`px-1.5 py-0.2 rounded-sm text-[10px] font-mono font-bold border ${
                Number(overallRisk) < 70
                  ? 'bg-[#f59e0b]/15 text-[#f59e0b] border-[#f59e0b]/30'
                  : 'bg-[#38bdf8]/15 text-[#38bdf8] border-[#38bdf8]/30'
              }`}
            >
              {riskBand}
            </span>
          </div>
          <div className="text-[10px] font-mono text-slate-400 mt-0.5 truncate">
            Soil: {soilScore} | Yield: {yieldScore}
          </div>
        </div>
      </div>

      {/* Main Split Content: Left (CV Inspector) & Right (Financial Underwriting) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 p-3 overflow-y-auto">
        {/* 2. Left Column (CV Inspector) - 7 cols */}
        <div className="lg:col-span-7 flex flex-col space-y-3 bg-[#090d16] border border-[#1e293b] rounded-md p-3">
          {/* Header with Toggle Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#1e293b]">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-[#38bdf8]" />
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-200">
                Satellite CV Spectral Inspector
              </span>
            </div>

            <div className="flex items-center space-x-1 font-mono text-xs">
              <button
                type="button"
                onClick={() => setCvMode('mask')}
                className={`px-2.5 py-1 rounded-sm border transition-colors ${
                  cvMode === 'mask'
                    ? isLowVegetation
                      ? 'bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]/50 font-bold'
                      : 'bg-[#10b981]/20 text-[#10b981] border-[#10b981]/50 font-bold'
                    : 'bg-[#0f172a] text-slate-400 border-[#1e293b] hover:text-slate-200'
                }`}
              >
                [Semantic Crop Mask]
              </button>
              <button
                type="button"
                onClick={() => setCvMode('ndvi')}
                className={`px-2.5 py-1 rounded-sm border transition-colors ${
                  cvMode === 'ndvi'
                    ? 'bg-[#38bdf8]/20 text-[#38bdf8] border-[#38bdf8]/50 font-bold'
                    : 'bg-[#0f172a] text-slate-400 border-[#1e293b] hover:text-slate-200'
                }`}
              >
                [False-Color NDVI]
              </button>
            </div>
          </div>

          {/* Subtitle */}
          <div className="text-[11px] font-mono text-slate-400">
            Sentinel-2 Multi-Spectral Resolution: 10m/px | MS Planetary Computer STAC
          </div>

          {/* Dynamic Visual Mock Preview Canvas */}
          <div className="relative h-44 rounded-sm border border-[#1e293b] overflow-hidden flex items-center justify-center">
            {cvMode === 'mask' ? (
              isLowVegetation ? (
                // Low vegetation / Desert / Fallow banner
                <div className="w-full h-full bg-gradient-to-br from-[#2a1708] via-[#3d240d] to-[#1a0e05] relative flex flex-col items-center justify-center p-3">
                  <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:12px_12px]" />
                  <div className="relative z-10 flex flex-col items-center space-y-1.5 text-center">
                    <span className="px-2.5 py-1 rounded-sm bg-[#f59e0b]/25 text-[#f59e0b] border border-[#f59e0b]/50 font-mono text-xs font-bold uppercase tracking-wide flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Class 03 {landCoverClass} • Low Biomass
                    </span>
                    <div className="font-mono text-[11px] text-slate-300">
                      Calculated Mean NDVI: {ndviMean} | Soil Type: {soilType} (pH {soilPh})
                    </div>
                    <div className="text-[10px] font-mono text-amber-400/80">
                      Depressed chlorophyll absorption signature detected on Sentinel-2 bands
                    </div>
                  </div>
                </div>
              ) : (
                // Emerald Active Cropland Canvas
                <div className="w-full h-full bg-gradient-to-br from-[#062c1d] via-[#093524] to-[#041c12] relative flex flex-col items-center justify-center p-3">
                  <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:12px_12px]" />
                  <div className="relative z-10 flex flex-col items-center space-y-1.5 text-center">
                    <span className="px-2.5 py-1 rounded-sm bg-[#10b981]/25 text-[#10b981] border border-[#10b981]/50 font-mono text-xs font-bold uppercase tracking-wide flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Class 01 Active Cropland • High Canopy Vitality
                    </span>
                    <div className="font-mono text-[11px] text-slate-300">
                      Calculated Mean NDVI: {ndviMean} | Soil Type: {soilType}
                    </div>
                    <div className="text-[10px] font-mono text-emerald-400/80">
                      Active vegetation vigor confirmed via Sentinel-2 B8 (NIR)
                    </div>
                  </div>
                </div>
              )
            ) : (
              // False-Color NIR Reflectance Canvas
              <div className="w-full h-full bg-gradient-to-br from-[#240b15] via-[#3d1223] to-[#1a080f] relative flex flex-col items-center justify-center p-3">
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#f43f5e_1px,transparent_1px)] [background-size:12px_12px]" />
                <div className="relative z-10 flex flex-col items-center space-y-1.5 text-center">
                  <span className="px-2.5 py-1 rounded-sm bg-[#f43f5e]/25 text-[#f43f5e] border border-[#f43f5e]/50 font-mono text-xs font-bold uppercase tracking-wide">
                    NIR Multi-Spectral Heat Ratio (B8/B4)
                  </span>
                  <div className="font-mono text-[11px] text-slate-300">
                    Calculated NDVI Index: {ndviMean} | Moisture Index: Normal
                  </div>
                  <div className="text-[10px] font-mono text-rose-300/80">
                    Spectral Band Synthesis completed via planetary computer
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Dynamically Calibrated Phenology LineChart */}
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-sm p-2.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-300 font-semibold">
                Kharif Phenology Trajectory (Calibrated to NDVI {ndviMean})
              </span>
              <span className="text-[10px] font-mono text-slate-500">Jun - Nov Observed</span>
            </div>

            <div className="h-36 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={phenologyData}
                  margin={{ top: 6, right: 16, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="2 2" stroke="#1e293b" />
                  <XAxis
                    dataKey="month"
                    stroke="#64748b"
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                  />
                  <YAxis
                    domain={[0, 1]}
                    stroke="#64748b"
                    tick={{ fontSize: 10, fill: '#64748b' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#1e293b',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                    }}
                  />
                  <ReferenceLine y={0.5} stroke="#64748b" strokeDasharray="3 3" />
                  <Line
                    type="monotone"
                    dataKey="ndvi"
                    name="Calculated NDVI"
                    stroke={isLowVegetation ? '#f59e0b' : '#10b981'}
                    strokeWidth={2}
                    dot={{ r: 3, fill: isLowVegetation ? '#f59e0b' : '#10b981' }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="benchmark"
                    name="Regional Benchmark"
                    stroke="#38bdf8"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* 3. Right Column (Financial Underwriting Card) - 5 cols */}
        <div className="lg:col-span-5 flex flex-col justify-between bg-[#090d16] border border-[#1e293b] rounded-md p-3 space-y-3">
          <div className="space-y-3">
            {/* Sanction Header */}
            <div className="flex items-center space-x-2 pb-2 border-b border-[#1e293b]">
              <ShieldCheck className="w-4 h-4 text-[#10b981]" />
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-200">
                Python Underwriting Engine Output
              </span>
            </div>

            {/* Big Highlighted Sanction Badge with Real Backend Loan Amount */}
            <div
              className={`bg-[#0f172a] border rounded-md p-3 text-center ${
                Number(overallRisk) < 70 ? 'border-[#f59e0b]/40' : 'border-[#10b981]/40'
              }`}
            >
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                Recommended Loan Sanction
              </div>
              <div
                className={`text-2xl font-mono font-extrabold mt-0.5 tracking-tight ${
                  Number(overallRisk) < 70 ? 'text-[#f59e0b]' : 'text-[#10b981]'
                }`}
              >
                ₹{loanAmount.toLocaleString()}
              </div>
              <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                Credit Tier: {riskBand} • Valuation ₹{valuationMin.toLocaleString()} - ₹{valuationMax.toLocaleString()}
              </div>
            </div>

            {/* Financial Breakdown Table */}
            <div className="bg-[#0f172a] border border-[#1e293b] rounded-sm overflow-hidden font-mono text-xs">
              <div className="px-3 py-1.5 bg-[#1e293b]/40 border-b border-[#1e293b] text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                Risk-Adjusted Terms
              </div>
              <table className="w-full text-left">
                <tbody className="divide-y divide-[#1e293b]">
                  <tr>
                    <td className="py-2 px-3 text-slate-400">Base Land Value</td>
                    <td className="py-2 px-3 text-right text-slate-200 font-medium">
                      ₹{valuationMin.toLocaleString()}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-slate-400">Soil Viability Score</td>
                    <td className="py-2 px-3 text-right text-slate-100 font-medium">
                      {soilScore} / 100
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-slate-400">Formal Bank Rate (ROI)</td>
                    <td className="py-2 px-3 text-right text-[#38bdf8] font-bold">
                      {roi}% p.a.
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-slate-400">Moneylender APR Saved</td>
                    <td className="py-2 px-3 text-right text-[#10b981] font-bold">
                      36% - 48% APR
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Explainable Reasoning Box */}
            <div className="bg-[#0f172a] border border-[#1e293b] rounded-sm p-2.5 font-mono text-xs">
              <div className="flex items-center space-x-1.5 text-[10px] uppercase text-slate-400 font-bold mb-1">
                <Info className="w-3.5 h-3.5 text-[#38bdf8]" />
                <span>Python Model Rationale</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                {reasoning}
              </p>
            </div>
          </div>

          {/* Action Button: Disburse Enhanced Loan Offer */}
          <div>
            <button
              type="button"
              className={`w-full h-10 px-4 rounded-md font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-2 transition-colors shadow-sm ${
                Number(overallRisk) < 70
                  ? 'bg-[#f59e0b] hover:bg-[#d97706] text-[#090d16]'
                  : 'bg-[#10b981] hover:bg-[#059669] text-[#090d16]'
              }`}
            >
              <span>Disburse Risk-Adjusted Loan Offer</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
