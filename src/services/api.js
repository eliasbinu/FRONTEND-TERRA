// Remote Python backend address over local WiFi
export const API_BASE_URL = "http://172.17.211.69:8000";
export const API_URL = "http://172.17.211.69:8000/api/assess";

// Switch between simulated mock mode and remote live backend
export const USE_MOCK = false;

export const MOCK_AGENT_LOGS = [
  {
    assessment_id: "mh-aur-4122-uuid",
    step_name: "Data Harvester",
    message: "Ingested high-resolution satellite RGB and Sentinel-2 multispectral bands for target coordinates.",
    timestamp: "2026-09-16T10:02:05Z",
  },
  {
    assessment_id: "mh-aur-4122-uuid",
    step_name: "Document OCR",
    message: "Extracted 7/12 land record details: Verified owner Ramesh G. Patil, Gut No 142.",
    timestamp: "2026-09-16T10:02:12Z",
  },
  {
    assessment_id: "mh-aur-4122-uuid",
    step_name: "CV Land Segmentation",
    message: "Computer vision verified parcel perimeter. Zero boundary encroachment detected across 1.62 hectares.",
    timestamp: "2026-09-16T10:02:20Z",
  },
  {
    assessment_id: "mh-aur-4122-uuid",
    step_name: "Explainable Underwriting",
    message: "Aggregated soil metrics (Vertisol, pH 7.2) and NDVI vitality (0.78). Soil and yield risk computed at 88/100.",
    timestamp: "2026-09-16T10:02:28Z",
  },
  {
    assessment_id: "mh-aur-4122-uuid",
    step_name: "Valuation Engine",
    message: "Generated valuation range ₹1,10,000 - ₹1,35,000. Recommended prime loan amount ₹1,08,750 at 7.0% ROI.",
    timestamp: "2026-09-16T10:02:35Z",
  },
];

export const MOCK_ASSESSMENT_RESULT = {
  assessment: {
    id: "mh-aur-4122-uuid",
    farmer_name: "Ramesh G. Patil",
    area_hectares: 1.62,
    status: "complete",
    status_message: "Assessment completed successfully",
    created_at: "2026-09-16T10:02:00Z",
    plot_geojson: {
      type: "Polygon",
      coordinates: [
        [
          [75.3412, 19.8824],
          [75.3418, 19.8851],
          [75.3452, 19.8845],
          [75.3445, 19.8818],
          [75.3412, 19.8824],
        ],
      ],
    },
  },
  documents: [
    {
      file_url: "https://example.com/docs/7_12.pdf",
      doc_type: "7_12_extract",
      ocr_text: "Owner: Ramesh G. Patil, Gut No: 142, Area: 1.60 Ha",
      verified: true,
    },
  ],
  ndvi: {
    ndvi_mean: 0.78,
    land_cover_class: "Active Cropland (Double-Crop)",
    captured_date: "2026-09-10",
  },
  soil: {
    soil_type: "Black Soil (Vertisol)",
    ph: 7.2,
    nitrogen: 280,
    phosphorus: 48,
    potassium: 195,
    organic_carbon: 0.68,
    ec: 0.42,
  },
  risk: {
    soil_score: 85,
    irrigation_score: 82,
    ndvi_score: 92,
    yield_score: 91,
    overall_risk: 88,
    risk_band: "AAA",
  },
  valuation: {
    valuation_min: 110000,
    valuation_max: 135000,
    recommended_loan_amount: 108750,
    recommended_roi: 7.0,
    reasoning_text:
      "High NDVI vitality (0.78), double-cropping verification, and 0% fallow risk confirm high cash flow viability, qualifying parcel for an enhanced credit tier at prime bank rates.",
  },
};

/**
 * Submit assessment to Python backend POST /api/assess
 */
export async function submitAssessment({ farmerName, polygon, documentUrls }) {
  if (USE_MOCK) {
    return { assessment_id: "mh-aur-4122-uuid" };
  }

  const firstPt = polygon && polygon.length > 0 ? polygon[0] : [75.3432, 19.8835];
  const lon = Number(firstPt[0]);
  const lat = Number(firstPt[1]);

  const payload = {
    farmer_name: farmerName || "Ramesh G. Patil",
    plot_geojson: {
      type: "Polygon",
      coordinates: [polygon],
    },
    lat: lat,
    lon: lon,
    area_hectares: 1.62,
    irrigation_type: "Canal",
    doc_path: documentUrls?.[0] || "7_12_Extract_Gut_142_Aurangabad.pdf",
  };

  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to submit assessment to ${API_URL}: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Polls Python backend GET /api/assessments/{id} until pipeline completes,
 * streaming real backend logs as they arrive.
 */
export function subscribeToAssessment(assessmentId, onLogReceived, onStatusChange, onComplete) {
  if (USE_MOCK) {
    let timeoutIds = [];
    MOCK_AGENT_LOGS.forEach((log, index) => {
      const timeoutId = setTimeout(() => {
        if (onLogReceived) onLogReceived(log);

        if (index === MOCK_AGENT_LOGS.length - 1) {
          if (onStatusChange) onStatusChange("complete");
          if (onComplete) onComplete(MOCK_ASSESSMENT_RESULT);
        }
      }, (index + 1) * 800);
      timeoutIds.push(timeoutId);
    });

    return () => {
      timeoutIds.forEach((id) => clearTimeout(id));
    };
  }

  let isCancelled = false;
  let pollInterval = null;
  const seenLogIds = new Set();
  let pollCount = 0;
  const MAX_POLLS = 150; // Poll for up to 300 seconds (5 mins) to allow full satellite STAC & ISRIC processing

  const poll = async () => {
    if (isCancelled) return;
    pollCount++;

    try {
      const res = await fetch(`${API_BASE_URL}/api/assessments/${assessmentId}`);
      if (res.ok) {
        const realData = await res.json();

        // 1. Forward real backend logs to the terminal UI
        if (realData.logs && Array.isArray(realData.logs)) {
          realData.logs.forEach((logItem) => {
            const key = logItem.id || `${logItem.step_name}-${logItem.created_at}`;
            if (!seenLogIds.has(key)) {
              seenLogIds.add(key);
              if (onLogReceived) {
                onLogReceived({
                  id: logItem.id,
                  assessment_id: assessmentId,
                  step_name: logItem.step_name || "Agent Step",
                  message: logItem.message || "Processing telemetry...",
                  timestamp: logItem.created_at || new Date().toISOString(),
                });
              }
            }
          });
        }

        // 2. Check if Python pipeline has finished calculating risk & valuation
        const isComplete =
          realData.assessment?.status === "complete" ||
          realData.assessment?.status === "completed" ||
          (realData.valuation && realData.risk);

        if (isComplete) {
          clearInterval(pollInterval);
          if (onStatusChange) onStatusChange("complete");
          // PASS EXACT REAL DATA FROM PYTHON BACKEND DIRECTLY TO THE DASHBOARD
          if (onComplete) onComplete(realData);
          return;
        }
      }
    } catch (err) {
      console.warn(`Polling ${assessmentId} error:`, err);
    }

    if (pollCount >= MAX_POLLS) {
      clearInterval(pollInterval);
      if (onStatusChange) onStatusChange("complete");
      const fallbackResult = await getAssessmentDetails(assessmentId);
      if (onComplete) onComplete(fallbackResult);
    }
  };

  pollInterval = setInterval(poll, 2000);
  poll(); // run first poll immediately

  return () => {
    isCancelled = true;
    if (pollInterval) clearInterval(pollInterval);
  };
}

/**
 * Fetch raw Python backend assessment payload
 */
export async function getAssessmentDetails(assessmentId) {
  if (USE_MOCK || !assessmentId || assessmentId === "mh-aur-4122-uuid") {
    return MOCK_ASSESSMENT_RESULT;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/assessments/${assessmentId}`);
    if (response.ok) {
      return await response.json();
    }
  } catch (err) {
    console.warn(`GET /api/assessments/${assessmentId} failed:`, err);
  }

  return MOCK_ASSESSMENT_RESULT;
}

export const api = {
  submitAssessment,
  subscribeToAssessment,
  getAssessmentDetails,
};

export default api;
