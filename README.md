Crop Optimization System
A machine learning-based application that recommends optimal crops using soil data and real-time weather integration.

Prerequisites
Python Version: 3.12

Operating System: Windows, macOS, or Linux

Installation and Setup
1. Create a Virtual Environment
Isolate the project dependencies by creating a virtual environment:

Bash
python -m venv venv
2. Activate the Environment
Windows:

Bash
.\venv\Scripts\activate
macOS/Linux:

Bash
source venv/bin/activate
3. Install Required Packages
Ensure pip is updated and install the libraries:

Bash
pip install --upgrade pip
pip install -r requirements.txt
Execution Pipeline
1. Train the Models
You must train the models to generate the necessary serialized files (.pkl) before running the server:

Bash
python train_model.py
This script trains Naive Bayes, Random Forest, XGBoost, CatBoost, and SVM, and saves the label_encoder.pkl.

2. Start the Flask Application
Launch the web-based dashboard:

Bash
python app.py
3. Access the Dashboard
Once the server is running, open your web browser and navigate to:
http://127.0.0.1:5000

Technical Overview
Model Inference Logic
The system uses a hybrid approach to prediction:

ML Inference: Probability scores are generated from multiple models.

Agronomic Constraints: Predictions are filtered through constraints.py to ensure soil compatibility.

Scoring: A final match percentage is calculated by weighting the ML probability against an Agronomic Suitability score (pH, Rainfall, and Nutrients).

Directory Structure
app.py: Main Flask entry point.

predictors.py: Prediction logic and hybrid scoring formulas.

train_model.py: Data processing and model training script.

constraints.py: Soil and crop-specific threshold rules.

models/saved_models/: Storage for trained .pkl files.

static/: Frontend assets (CSS/JS).

templates/: HTML user interface.
