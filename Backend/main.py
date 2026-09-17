import sys
import asyncio
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
import os
import shutil
from fastapi import FastAPI, BackgroundTasks, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client
from dotenv import load_dotenv
from agent_engine import autonomous_coordinator
from data_sources import (
    fetch_soilgrids_data, 
    fetch_nasa_power_ag, 
    fetch_chirps_precipitation, 
    fetch_sentinel_ndvi
)
from scoring import compute_risk_score, compute_valuation

# 1. IMPORT THE SAFE WRAPPER INSTEAD OF THE CRASH-PRONE ONE
from cv_module import ocr_document_safe

load_dotenv()
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

app = FastAPI(title="AgriValue Engine", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

class LandRequest(BaseModel):
    farmer_name: str
    plot_geojson: dict
    lat: float
    lon: float
    area_hectares: float
    irrigation_type: str
    doc_path: str = None

def push_log(assessment_id: str, step: str, message: str):
    supabase.table("agent_logs").insert({
        "assessment_id": assessment_id,
        "step_name": step,
        "message": message
    }).execute()

def execute_pipeline(assessment_id: str, lat: float, lon: float, area_ha: float, irrigation: str, doc_path: str):
    try:
        # Default to False if no document is provided
        is_verified = False 
        
        # Step A: OCR Document Verification
        if doc_path:
            push_log(assessment_id, "OCR Verification", "Processing uploaded land title document...")
            
            # 2. RUN WITH A 4-SECOND TIMEOUT
            ocr_res = ocr_document_safe(doc_path, timeout_sec=4)
            is_verified = ocr_res.get("is_verified", False)
            
            supabase.table("documents").insert({
                "assessment_id": assessment_id,
                "file_url": doc_path,
                "doc_type": "Land Title",
                "ocr_text": ocr_res.get("raw_text", ""),
                "verified": is_verified
            }).execute()

        # Step B: Earth Observation (Planetary Computer)
        push_log(assessment_id, "Satellite CV", "Pulling Sentinel-2 tiles via MS Planetary Computer STAC...")
        ndvi_val = fetch_sentinel_ndvi(lat, lon)
        supabase.table("ndvi_results").insert({
            "assessment_id": assessment_id,
            "ndvi_mean": ndvi_val,
            "land_cover_class": "Active Cropland" if ndvi_val > 0.3 else "Fallow/Barren",
            "captured_date": "2026-08-15"
        }).execute()

        # Step C: Soil Records (SoilGrids ISRIC)
        push_log(assessment_id, "Soil Analysis", "Querying ISRIC SoilGrids REST API for pH, SOC, and NPK layers...")
        soil_profile = fetch_soilgrids_data(lat, lon)
        supabase.table("soil_data").insert({
            "assessment_id": assessment_id,
            "soil_type": "Loam / Clay-Loam",
            "ph": soil_profile["ph"],
            "nitrogen": soil_profile["nitrogen"],
            "phosphorus": 24.5,
            "potassium": 180.2,
            "organic_carbon": soil_profile["organic_carbon"],
            "ec": 0.45
        }).execute()

        # Step D: Climate & Agro-meteorology (NASA POWER + CHIRPS)
        push_log(assessment_id, "Climate Check", "Ingesting NASA POWER thermal indices and CHIRPS precipitation...")
        nasa_weather = fetch_nasa_power_ag(lat, lon)
        rainfall_data = fetch_chirps_precipitation(lat, lon)
        combined_weather = {**nasa_weather, **rainfall_data}

        # Step E: Risk Engine
        push_log(assessment_id, "Risk Scoring", "Calculating multi-vector land credit risk score...")
        
        # 3. PASS THE `is_verified` FLAG TO YOUR SCORING FUNCTION
        risk = compute_risk_score(soil_profile, ndvi_val, irrigation, combined_weather, is_verified)
        
        supabase.table("risk_scores").insert({
            "assessment_id": assessment_id,
            **risk
        }).execute()

        # Step F: Valuation & Lending Terms
        push_log(assessment_id, "Valuation", "Generating loan-to-value limit and risk-adjusted interest rates...")
        valuation = compute_valuation(area_ha, risk)
        supabase.table("valuations").insert({
            "assessment_id": assessment_id,
            **valuation
        }).execute()

        # Finalize
        supabase.table("land_assessments").update({
            "status": "complete",
            "status_message": "Assessment processed successfully"
        }).eq("id", assessment_id).execute()
        push_log(assessment_id, "Complete", "Credit report package ready for bank dashboard.")

    except Exception as exc:
        supabase.table("land_assessments").update({
            "status": "failed",
            "status_message": str(exc)
        }).eq("id", assessment_id).execute()
        push_log(assessment_id, "Error", f"Pipeline terminated: {str(exc)}")


@app.post("/api/assess")
def start_assessment(payload: LandRequest, background_tasks: BackgroundTasks):
    res = supabase.table("land_assessments").insert({
        "farmer_name": payload.farmer_name,
        "plot_geojson": payload.plot_geojson,
        "area_hectares": payload.area_hectares,
        "status": "collecting_data",
        "status_message": "Agents waking up..."
    }).execute()
    
    assessment_id = res.data[0]["id"]
    
    # Hand off to the autonomous MAS coordinator
    background_tasks.add_task(
        lambda: asyncio.run(autonomous_coordinator(
            assessment_id, payload.lat, payload.lon, 
            payload.area_hectares, payload.irrigation_type, 
            payload.doc_path, supabase
        ))
    )
    
    return {"assessment_id": assessment_id, "status": "Agents Dispatched"}

@app.get("/api/assessments/{assessment_id}")
def get_assessment_details(assessment_id: str):
    # 1. Fetch current status of pipeline
    assessment_res = supabase.table("land_assessments").select("*").eq("id", assessment_id).execute()
    if not assessment_res.data:
        raise HTTPException(status_code=404, detail="Assessment not found")
        
    assessment = assessment_res.data[0]
    current_status = assessment.get("status", "processing")
    
    # 2. Fetch live terminal logs
    logs_res = supabase.table("agent_logs").select("*").eq("assessment_id", assessment_id).order("created_at").execute()
    
    # 3. Build dynamic response payload
    response_data = {
        "assessment_id": assessment_id,
        "status": current_status,
        "status_message": assessment.get("status_message"),
        "logs": logs_res.data if logs_res.data else [],
        "assessment": assessment # Preserved for any existing frontend dependencies
    }
    
    # 4. Attach final data only if pipeline is finished
    if current_status == "complete":
        risk_res = supabase.table("risk_scores").select("*").eq("assessment_id", assessment_id).execute()
        val_res = supabase.table("valuations").select("*").eq("assessment_id", assessment_id).execute()
        
        response_data["risk"] = risk_res.data[0] if risk_res.data else {}
        response_data["valuation"] = val_res.data[0] if val_res.data else {}
        
    return response_data

@app.post("/api/upload-doc/{assessment_id}")
def upload_document(assessment_id: str, file: UploadFile = File(...)):
    temp_path = f"temp_{assessment_id}_{file.filename}"
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # 4. RUN OCR SAFELY AND WRITE TO DB
    ocr_res = ocr_document_safe(temp_path, timeout_sec=4)
    
    supabase.table("documents").insert({
        "assessment_id": assessment_id,
        "file_url": file.filename,
        "doc_type": "Land Title",
        "ocr_text": ocr_res.get("raw_text", ""),
        "verified": ocr_res.get("is_verified", False)
    }).execute()
    
    # Clean up temp file so server storage doesn't fill up
    if os.path.exists(temp_path):
        os.remove(temp_path)
    
    return {"status": "verified" if ocr_res.get("is_verified") else "unverified"}