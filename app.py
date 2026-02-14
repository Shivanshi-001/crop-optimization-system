import os
import pandas as pd
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from predictors import predict_crop

app = Flask(__name__)
CORS(app)


@app.route("/")
def index():
    """Serve the main dashboard."""
    return render_template("index.html")


@app.route("/metrics", methods=["GET"])
def get_metrics():
    try:
        base_path = os.path.dirname(os.path.abspath(__file__))
        csv_path  = os.path.join(base_path, "models", "saved_models", "model_metrics.csv")

        if os.path.exists(csv_path):
            df = pd.read_csv(csv_path)
            df = df.round(2)
            return jsonify(df.to_dict(orient="records"))
        else:
            return jsonify([{
                "Model":     "No Data",
                "Accuracy":  0,
                "Precision": 0,
                "F1_Score":  0
            }])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.json

        input_data = {
            "N":           float(data.get("N")),
            "P":           float(data.get("P")),
            "K":           float(data.get("K")),
            "temperature": float(data.get("temperature")),
            "humidity":    float(data.get("humidity")),
            "ph":          float(data.get("ph")),
            "rainfall":    float(data.get("rainfall")),
            "soil_type":   data.get("soil_type", "loamy")
        }

        # ← FIX: Extract model choice from frontend
        model_choice = data.get("model_choice", "Naive Bayes")
        
        # ← FIX: Pass model_name to predict_crop
        result = predict_crop(input_data, model_name=model_choice)
        
        return jsonify({"status": "success", "data": result})

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400


if __name__ == "__main__":
    app.run(debug=True, port=5000)