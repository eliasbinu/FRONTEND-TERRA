import os
import json
import asyncio
import google.generativeai as genai
from dotenv import load_dotenv

from data_sources import fetch_soilgrids_data, fetch_nasa_power_ag, fetch_chirps_precipitation, fetch_sentinel_ndvi
from scoring import compute_valuation

# Load env variables and configure Gemini
load_dotenv()
gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

if not gemini_key:
    print("🚨 FATAL ERROR: No API key loaded! Ensure your .env file is in the same directory and not named .env.txt.")
else:
    genai.configure(api_key=gemini_key)


# Initialize Gemini 3.6 Flash (Insanely fast, handles both Vision & Text natively)
model = genai.GenerativeModel('gemini-3.6-flash')

class StatePayload:
    def __init__(self, assessment_id, lat, lon, area_ha, irrigation, doc_path):
        self.id = assessment_id
        self.lat = lat
        self.lon = lon
        self.area = area_ha
        self.irrigation = irrigation
        self.doc_path = doc_path
        
        self.collected_data = {}
        self.verification_status = False
        self.verification_notes = ""
        self.risk_results = {}
        self.valuation_results = {}

class DataCollectorAgent:
    """Agent responsible for fetching all external remote sensing and API data concurrently."""
    async def process(self, state: StatePayload, supabase):
        print(f"[Agent 1] Fetching parallel data for Assessment {state.id}...")
        lat, lon = state.lat, state.lon
        
        # 1. Package the synchronous functions into background thread tasks
        soil_task = asyncio.to_thread(fetch_soilgrids_data, lat, lon)
        nasa_task = asyncio.to_thread(fetch_nasa_power_ag, lat, lon)
        chirps_task = asyncio.to_thread(fetch_chirps_precipitation, lat, lon)
        ndvi_task = asyncio.to_thread(fetch_sentinel_ndvi, lat, lon)
        
        # 2. Fire all 4 tasks at the exact same time (asyncio.gather)
        # The total wait time will only be as long as the single slowest API
        soil_data, nasa_data, chirps_data, ndvi_data = await asyncio.gather(
            soil_task, nasa_task, chirps_task, ndvi_task
        )
        
        # 3. Store the newly fetched data into the state payload
        state.collected_data = {
            "soil": soil_data,
            "weather": {**nasa_data, **chirps_data},  # Merges NASA and CHIRPS together
            "ndvi": ndvi_data
        }
        
        # 4. Log success to Supabase
        supabase.table("agent_logs").insert({
            "assessment_id": state.id, 
            "step_name": "Data Collector", 
            "message": "Remote sensing and climate data fetched concurrently."
        }).execute()
        
        return state

class AIVerificationAgent:
    """Gemini-powered agent that reads the document like a human underwriter."""
    async def process(self, state: StatePayload, supabase):
        print(f"[Agent 2] Gemini Verifier checking legal document for {state.id}...")
        
        valid_exts = ('.jpg', '.jpeg', '.png')
        has_valid_image = state.doc_path and os.path.exists(state.doc_path) and state.doc_path.lower().endswith(valid_exts)
        
        if has_valid_image:
            try:
                # Prepare image for Gemini
                ext = os.path.splitext(state.doc_path)[1].lower()
                mime_type = 'image/png' if ext == '.png' else 'image/jpeg'
                
                with open(state.doc_path, "rb") as f:
                    image_data = {"mime_type": mime_type, "data": f.read()}

                prompt = 'You are a strict bank compliance officer. Review this land document. Does it establish clear ownership? Are there red flags? Respond STRICTLY in valid JSON format with keys "is_verified" (boolean) and "reasoning" (string).'

                # Generate async response enforcing JSON output
                response = await model.generate_content_async(
                    [prompt, image_data],
                    generation_config=genai.GenerationConfig(
                        response_mime_type="application/json",
                        temperature=0.1
                    )
                )
                
                ai_decision = json.loads(response.text)
                
                state.verification_status = ai_decision.get("is_verified", False)
                state.verification_notes = ai_decision.get("reasoning", "No reasoning provided.")
            except Exception as e:
                print(f"Gemini Verification Error: {e}")
                state.verification_status = "Skipped"
                state.verification_notes = "AI parsing failed due to processing error."
        else:
            state.verification_status = "Skipped"
            state.verification_notes = "No valid image document provided. Verification bypassed."
            
        supabase.table("agent_logs").insert({
            "assessment_id": state.id, 
            "step_name": "Gemini Verifier", 
            "message": f"Status: {state.verification_status}. {state.verification_notes}"
        }).execute()
        return state

class AIScoringAgent:
    """Gemini-powered agent that synthesizes data into a qualitative credit thesis."""
    async def process(self, state: StatePayload, supabase):
        print(f"[Agent 3] Gemini Scorer writing risk narrative for {state.id}...")
        
        prompt = f"""
        Act as a Senior Fintech Underwriter. Analyze this raw farm data:
        - Soil: {state.collected_data.get('soil')}
        - Weather/Climate: {state.collected_data.get('weather')}
        - Satellite NDVI: {state.collected_data.get('ndvi')}
        - Document Verified: {state.verification_status}
        
        Calculate a final risk score (0-100, where 100 is safe). Write a brief justification.
        Determine the risk_band ("Low Risk", "Moderate Risk", or "High Risk").
        
        You must output ONLY a valid JSON object with the keys "score", "risk_band", "justification", "ndvi_score", and "soil_score".
        For "ndvi_score", just return the raw Satellite NDVI value provided above.
        For "soil_score", estimate a 0-100 score based on the Soil data quality provided above.
        """
        
        try:
            # Force Gemini to output raw JSON without markdown formatting
            response = model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    response_mime_type="application/json",
                    temperature=0.4
                )
            )
            
            ai_assessment = json.loads(response.text)
            
            state.risk_results = {
                "overall_risk": ai_assessment.get("score", 50),
                "final_score": ai_assessment.get("score", 50), # Added alias for your DB
                "risk_band": ai_assessment.get("risk_band", "Moderate Risk"),
                "risk_tier": ai_assessment.get("risk_band", "Moderate Risk"), # Added alias for your DB
                "ai_narrative": ai_assessment.get("justification", "Default assessment applied."),
                "ndvi_score": ai_assessment.get("ndvi_score", state.collected_data.get('ndvi', 0.5)),
                "soil_score": ai_assessment.get("soil_score", 50.0) # <--- FIX: Added soil_score
            }
            print(f"[Agent 3] Success: Scored {state.risk_results['overall_risk']} ({state.risk_results['risk_band']})")
            
        except Exception as e:
            print(f"🚨 Gemini JSON Parsing Error: {e}")
            # Fallback dictionary ensuring all required keys are present
            state.risk_results = {
                "overall_risk": 50, 
                "final_score": 50,
                "risk_band": "Moderate Risk", 
                "risk_tier": "Moderate Risk",
                "ai_narrative": "Fallback triggered.",
                "ndvi_score": state.collected_data.get('ndvi', 0.5),
                "soil_score": 50.0  # <--- FIX: Added soil_score to fallback
            }
        
        state.valuation_results = compute_valuation(state.area, state.risk_results)
        supabase.table("agent_logs").insert({"assessment_id": state.id, "step_name": "Gemini Scorer", "message": "Risk narrative and valuation calculated."}).execute()
        return state
class UpdationAgent:
    """Deterministic agent that finalizes records in the database."""
    async def process(self, state: StatePayload, supabase):
        print(f"[Agent 4] Updater finalizing records for {state.id}...")
        supabase.table("risk_scores").insert({"assessment_id": state.id, **state.risk_results}).execute()
        supabase.table("valuations").insert({"assessment_id": state.id, **state.valuation_results}).execute()
        supabase.table("land_assessments").update({"status": "complete", "status_message": "Multi-Agent Gemini processing complete."}).eq("id", state.id).execute()
        supabase.table("agent_logs").insert({"assessment_id": state.id, "step_name": "Updation Agent", "message": "Pipeline terminated successfully."}).execute()
        return state

async def autonomous_coordinator(assessment_id, lat, lon, area_ha, irrigation, doc_path, supabase):
    state = StatePayload(assessment_id, lat, lon, area_ha, irrigation, doc_path)
    
    collector = DataCollectorAgent()
    verifier = AIVerificationAgent()
    scorer = AIScoringAgent()
    updater = UpdationAgent()
    
    try:
        state = await collector.process(state, supabase)
        state = await verifier.process(state, supabase)
        state = await scorer.process(state, supabase)
        await updater.process(state, supabase)
        print(f"[Coordinator] Assessment {assessment_id} completed successfully.")
        
    except Exception as e:
        print(f"[Coordinator] Agent Pipeline Failed: {e}")
        supabase.table("land_assessments").update({"status": "failed", "status_message": f"Agent failure: {str(e)}"}).eq("id", assessment_id).execute()