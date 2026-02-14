# backend-ml/constraints.py

# Soil types assumed in dataset / inputs:
# sandy, loamy, clayey, black, red, alluvial

CROP_CONSTRAINTS = {
    # Cereals
    "rice": ["clayey", "loamy", "alluvial"],
    "maize": ["loamy", "sandy", "alluvial", "black"],
    "wheat": ["loamy", "clayey", "alluvial"],
    "barley": ["loamy", "clayey"],
    "millet": ["sandy", "loamy"],
    "sorghum": ["loamy", "black"],

    # Cash crops
    "cotton": ["black", "loamy", "alluvial"],
    "sugarcane": ["loamy", "clayey", "alluvial", "black"],
    "jute": ["alluvial", "loamy"],

    # Pulses
    "chickpea": ["loamy", "sandy", "black"],
    "lentil": ["loamy", "clayey"],
    "pigeonpeas": ["loamy", "clayey", "black"],
    "mungbean": ["loamy", "sandy"],
    "blackgram": ["loamy", "clayey", "black"],
    "kidneybeans": ["loamy", "clayey"],

    # Oilseeds & Others
    "groundnut": ["sandy", "loamy"],
    "soybean": ["loamy", "black"],
    "mustard": ["loamy", "clayey", "alluvial"],
    "sunflower": ["loamy", "sandy"],
    "coconut": ["sandy", "alluvial", "loamy"],
    "coffee": ["loamy", "red"],
    "tea": ["loamy", "red"],

    # Fruits (Add these!)
    "papaya": ["loamy", "alluvial", "sandy"],
    "mango": ["loamy", "alluvial", "black", "red"],
    "banana": ["loamy", "clayey", "alluvial"],
    "pomegranate": ["loamy", "sandy", "black"],
    "orange": ["loamy", "alluvial", "sandy"],
    "grapes": ["loamy", "sandy", "black", "red"],
    "watermelon": ["sandy", "loamy"],
    "muskmelon": ["sandy", "loamy"],
    "apple": ["loamy", "alluvial"],

    # Vegetables
    "potato": ["sandy", "loamy", "alluvial"],
    "tomato": ["loamy", "sandy"],
    "onion": ["loamy", "sandy"]
}
