import pandas as pd
import joblib
import os
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from xgboost import XGBClassifier
from catboost import CatBoostClassifier
from sklearn.svm import SVC
from sklearn.naive_bayes import GaussianNB
from sklearn.metrics import accuracy_score, precision_score, f1_score
from sklearn.preprocessing import LabelEncoder

# ── 1. Load Data ──────────────────────────────────────────────────────────────
df        = pd.read_csv("data/crop_dataset.csv")
X         = df.drop(columns=["crop"])
y         = df["crop"]

# Create and fit label encoder
le        = LabelEncoder()
y_encoded = le.fit_transform(y)

X_train, X_test, y_train, y_test = train_test_split(
    X, y_encoded, test_size=0.2, random_state=42
)

# ── 2. Define 5 Models ────────────────────────────────────────────────────────
models = {
    "Naive Bayes":   GaussianNB(),
    "Random Forest": RandomForestClassifier(n_estimators=100, random_state=42),
    "XGBoost":       XGBClassifier(use_label_encoder=False, eval_metric='mlogloss', random_state=42),
    "CatBoost":      CatBoostClassifier(iterations=100, silent=True, random_state=42),
    "SVM":           SVC(probability=True, kernel='rbf', random_state=42),
}

# ── 3. File name mapping (must match MODEL_FILES in predictors.py) ────────────
MODEL_FILENAMES = {
    "Naive Bayes":   "naive_bayes.pkl",
    "Random Forest": "random_forest.pkl",
    "XGBoost":       "xgboost.pkl",
    "CatBoost":      "catboost.pkl",
    "SVM":           "svm.pkl",
}

os.makedirs("models/saved_models", exist_ok=True)

# ── 4. Train, evaluate, and save each model individually ─────────────────────
results_list = []

for name, model in models.items():
    print(f"Training {name}...")
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)

    acc  = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred, average='weighted')
    f1   = f1_score(y_test, y_pred, average='weighted')

    results_list.append({
        "Model":     name,
        "Accuracy":  round(acc  * 100, 2),
        "Precision": round(prec * 100, 2),
        "F1_Score":  round(f1   * 100, 2)
    })

    # Save each model as its own file so the UI can switch between them
    save_path = os.path.join("models", "saved_models", MODEL_FILENAMES[name])
    joblib.dump(model, save_path)
    print(f"  Saved → {save_path}")

# ── 5. Save metrics CSV for the /metrics endpoint ─────────────────────────────
metrics_df = pd.DataFrame(results_list)
metrics_df.to_csv("models/saved_models/model_metrics.csv", index=False)

# ── 6. Save the best model as model.pkl (fallback default) ───────────────────
best_name = metrics_df.loc[metrics_df['F1_Score'].idxmax(), 'Model']

with open("models/saved_models/active_model.txt", "w") as f:
    f.write(best_name)

joblib.dump(models[best_name], "models/saved_models/model.pkl")
joblib.dump(le,                "models/saved_models/label_encoder.pkl")

print("\n--- Final Evaluation Summary ---")
print(metrics_df.to_string(index=False))
print(f"\nBest model: {best_name} → saved as model.pkl (fallback default)")
print(f"\n⚠️  Note: SVM training may take 5-10 minutes due to probability calibration")