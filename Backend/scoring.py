def normalize(val, min_val, ideal_low, ideal_high, max_val):
    """
    Zero-penalty normalizer for satellite indices.
    Extreme drought/urban values (<= min_val) score a strict 0.
    """
    if val is None:
        return 0.5  # Neutral default only if genuinely missing data
    if val <= min_val:
        return 0.0  # Zero or extreme drought/desert scores a strict 0
    if ideal_low <= val <= ideal_high: 
        return 1.0
    elif val < ideal_low: 
        return max(0.0, (val - min_val) / (ideal_low - min_val))
    else: 
        return max(0.0, (max_val - val) / (max_val - ideal_high))

def compute_risk_score(soil: dict, ndvi: float, irrigation: str, weather: dict, is_verified: bool = False) -> dict:
    # Soil sub-score (0 - 100)
    ph_score = 40 if (6.0 <= soil["ph"] <= 7.8) else 20
    soc_score = min(60, soil["organic_carbon"] * 4)
    soil_score = round(ph_score + soc_score, 1)

    # Remote sensing NDVI sub-score (0 - 100) - USING THE NEW NORMALIZE LOGIC
    # min_val=0.1 means urban/desert overrides (like 0.08) will become exactly 0.0
    normalized_ndvi = normalize(ndvi, min_val=0.1, ideal_low=0.3, ideal_high=0.8, max_val=1.0)
    ndvi_score = round(normalized_ndvi * 100.0, 1)

    # Water security sub-score (0 - 100)
    irrig_weights = {"canal": 95, "borewell": 75, "drip": 90, "rainfed": 40}
    irrigation_base = irrig_weights.get(irrigation.lower(), 50)
    
    # Rainfall bonus/penalty
    rainfall_adj = 10 if weather["annual_rainfall_mm"] >= 650 else -15
    irrigation_score = max(10, min(100, irrigation_base + rainfall_adj))

    # Thermal & Solar Productivity index
    gdd = weather.get("total_growing_degree_days", 400)
    yield_potential_score = 85 if gdd >= 350 else 55

    # Weighted Overall Index (Fintech Credit Model)
    overall = round(
        (soil_score * 0.30) +
        (ndvi_score * 0.30) +
        (irrigation_score * 0.25) +
        (yield_potential_score * 0.15),
        1
    )

    # DOCUMENT VERIFICATION MODIFIER
    if is_verified:
        overall = min(100.0, overall + 10.0) # +10 Point boost for verified land titles
    else:
        overall = max(0.0, overall - 30.0)   # -30 Point penalty for unverified titles/missing docs

    band = "Low Risk" if overall >= 72 else "Moderate Risk" if overall >= 50 else "High Risk"

    return {
        "soil_score": soil_score,
        "ndvi_score": ndvi_score,
        "irrigation_score": irrigation_score,
        "yield_score": yield_potential_score,
        "overall_risk": overall,
        "risk_band": band
    }

def compute_valuation(area_ha: float, risk_data: dict, base_rate_per_ha: float = 350000) -> dict:
    score = risk_data["overall_risk"]
    multiplier = 0.65 + (score / 100.0) * 0.70
    base_val = area_ha * base_rate_per_ha * multiplier

    min_val = round(base_val * 0.85)
    max_val = round(base_val * 1.15)
    loan_lending_cap = round(min_val * 0.70) # 70% Loan-to-Value (LTV)
    
    # Risk-based interest pricing
    interest_roi = round(13.5 - (score / 100.0) * 5.0, 2)

    reasoning = (
        f"Loan risk classified as {risk_data['risk_band']} (Score: {score}/100). "
        f"Vegetation index ({risk_data['ndvi_score']}/100) and soil viability ({risk_data['soil_score']}/100) "
        f"justify an LTV ratio of 70% against a base land valuation of ₹{int(base_val):,}. "
        f"Recommended interest rate locked at {interest_roi}%."
    )

    return {
        "valuation_min": min_val,
        "valuation_max": max_val,
        "recommended_loan_amount": loan_lending_cap,
        "recommended_roi": interest_roi,
        "reasoning_text": reasoning
    }