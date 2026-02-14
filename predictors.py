import joblib
import os
import pandas as pd
import numpy as np
from constraints import CROP_CONSTRAINTS

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR  = os.path.join(BASE_DIR, "models", "saved_models")

# ── Load the label encoder once (shared across all models) ───────────────────
le = joblib.load(os.path.join(MODELS_DIR, "label_encoder.pkl"))

# ── Model registry: maps the UI name → saved .pkl filename ───────────────────
MODEL_FILES = {
    "Naive Bayes":   "naive_bayes.pkl",
    "Random Forest": "random_forest.pkl",
    "XGBoost":       "xgboost.pkl",
    "CatBoost":      "catboost.pkl",
    "SVM":           "svm.pkl",
}

# ── Model cache: load on first use, reuse after ───────────────────────────────
_model_cache = {}

def load_model(model_name: str):
    """
    Load a model by name. Falls back to the best model (model.pkl)
    if the individual file doesn't exist yet.
    """
    if model_name in _model_cache:
        return _model_cache[model_name]

    filename = MODEL_FILES.get(model_name)
    path     = os.path.join(MODELS_DIR, filename) if filename else None

    if path and os.path.exists(path):
        model = joblib.load(path)
    else:
        # Fallback: load the best model saved by train_model.py
        fallback = os.path.join(MODELS_DIR, "model.pkl")
        model    = joblib.load(fallback)

    _model_cache[model_name] = model
    return model


def normalize(text):
    """
    Normalize text to lowercase for consistent key matching.
    """
    return text.strip().lower() if isinstance(text, str) else str(text)


def filter_by_soil(predicted_crops, soil_type):
    """
    Filter crops based on soil type constraints.
    Returns only crops that can grow in the given soil type.
    """
    soil_type = normalize(soil_type)
    valid = []
    for crop in predicted_crops:
        crop_key     = normalize(crop)
        allowed_soils = CROP_CONSTRAINTS.get(crop_key, [])
        if not allowed_soils or soil_type in allowed_soils:
            valid.append(crop)
    return valid


def calculate_agronomic_metrics(data, crop_name):
    """
    Implements the 4 Research Formulas for display/evaluation only.
    These metrics are shown in the UI but do NOT affect match percentages.
    
    Returns:
        dict: Contains nutrient_index, suitability_score, water_stress, ph_suitability
    """

    # 1. Nutrient Index (NI)
    avg_npk = (data['N'] + data['P'] + data['K']) / 3
    if avg_npk > 80:   ni = "High (Fertile)"
    elif avg_npk > 40: ni = "Medium (Average)"
    else:              ni = "Low (Poor)"

    # 2. pH Deviation Factor (Gaussian Bell Curve)
    ideal_ph = 6.5
    ph_dev   = np.exp(-0.5 * ((data['ph'] - ideal_ph) / 1.0) ** 2)

    # 3. Water Stress Index (WSI)
    required_rain = 150
    wsi = max(0, 1 - (data['rainfall'] / required_rain))

    # 4. Land Suitability Rating (LSR)
    soil_score    = 0.2  # default
    allowed_soils = CROP_CONSTRAINTS.get(crop_name.lower(), [])
    if data['soil_type'].lower() in allowed_soils:
        soil_score = 1.0
    elif "loamy" in allowed_soils:
        soil_score = 0.6

    lsr = (ph_dev * 35) + ((1 - wsi) * 35) + (soil_score * 30)

    return {
        "nutrient_index":    ni,
        "suitability_score": round(lsr, 2),
        "water_stress":      "Low" if wsi < 0.3 else "High",
        "ph_suitability":    "Optimal" if ph_dev > 0.8 else "Sub-optimal"
    }


def predict_crop(data: dict, model_name: str = "Naive Bayes") -> dict:
    """
    Predict the best crop match using the selected ML model.
    
    Args:
        data: Dictionary with keys: N, P, K, temperature, humidity, ph, rainfall, soil_type
        model_name: Name of the model to use (matches keys in MODEL_FILES)
    
    Returns:
        dict: Contains recommended_crop, other_valid_options, crop_matches, metrics, logic
    """
    model = load_model(model_name)

    feature_cols = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]
    features     = pd.DataFrame(
        [[data[col] for col in feature_cols]],
        columns=feature_cols
    )

    # Get probabilities for all classes, take top 10 to have room after soil filter
    probs   = model.predict_proba(features)[0]
    top_idx = np.argsort(probs)[::-1][:10]

    soil_type = data.get("soil_type", "loamy")

    # Build list of (crop_name, raw_probability) and filter by soil
    candidates = []
    for i in top_idx:
        crop = le.inverse_transform([i])[0]
        prob = float(probs[i])
        allowed_soils = CROP_CONSTRAINTS.get(normalize(crop), [])
        if not allowed_soils or normalize(soil_type) in allowed_soils:
            candidates.append({"crop": crop, "raw_prob": prob})

    if not candidates:
        return {
            "recommended_crop":    "No suitable match for this soil",
            "other_valid_options": [],
            "crop_matches":        [],
            "metrics":             None,
            "logic":               f"{model_name} + Soil constraint filter"
        }

    # Keep top 5 after soil filtering
    candidates = candidates[:5]

    # ── ADAPTIVE TEMPERATURE SMOOTHING ────────────────────────────────────────
    # Prevents 100%/0% problem by spreading out overconfident predictions
    # Naive Bayes is extremely overconfident → needs more aggressive smoothing
    # Other models (RF, XGBoost, SVM) are more balanced → need less smoothing
    temperature = 4.0 if model_name == "Naive Bayes" else 2.5
    
    raw_probs = np.array([c["raw_prob"] for c in candidates])
    
    # Apply temperature scaling: softens extreme probabilities
    # Higher temperature = more uniform distribution
    # Formula: softmax(log_probs / temperature)
    smoothed_probs = np.exp(np.log(raw_probs + 1e-10) / temperature)
    smoothed_probs = smoothed_probs / smoothed_probs.sum()  # Re-normalize to sum to 1
    
    # Apply minimum floor: each candidate gets at least 5%
    # This ensures no crop shows 0% in the UI
    min_pct = 5.0
    
    # Convert to percentages with floor
    for idx, c in enumerate(candidates):
        base_pct = smoothed_probs[idx] * 100
        c["match_pct"] = max(min_pct, base_pct)
    
    # Re-normalize to ensure sum = 100% (floor may have pushed us over)
    total_pct = sum(c["match_pct"] for c in candidates)
    for c in candidates:
        c["match_pct"] = round((c["match_pct"] / total_pct) * 100, 1)
    
    # Final safety check: handle rounding errors to guarantee exactly 100%
    actual_total = sum(c["match_pct"] for c in candidates)
    if actual_total != 100.0:
        # Adjust the top candidate to make it exactly 100%
        candidates[0]["match_pct"] = round(candidates[0]["match_pct"] + (100.0 - actual_total), 1)

    primary_crop     = candidates[0]["crop"]
    research_metrics = calculate_agronomic_metrics(data, primary_crop)

    # crop_matches: full list with rank + percentage for the UI
    crop_matches = [
        {
            "rank":      idx + 1,
            "crop":      c["crop"],
            "match_pct": c["match_pct"]
        }
        for idx, c in enumerate(candidates)
    ]

    return {
        "recommended_crop":    primary_crop,
        "other_valid_options": [c["crop"] for c in candidates[1:]],
        "crop_matches":        crop_matches,
        "metrics":             research_metrics,
        "logic":               f"{model_name} + Adaptive temp. smoothing (T={temperature})"
    }