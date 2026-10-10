import pandas as pd
from sklearn.ensemble import IsolationForest
from detection.features import get_feature_columns

class IsolationForestDetector:
    def __init__(self, contamination: float = 0.1, random_state: int = 42):
        self.model = IsolationForest(contamination=contamination, random_state=random_state)
        self.is_fitted = False
        
    def fit(self, features_df: pd.DataFrame):
        if features_df.empty:
            return
        feature_cols = get_feature_columns(features_df)
        X = features_df[feature_cols]
        self.model.fit(X)
        self.is_fitted = True
        
    def detect(self, features_df: pd.DataFrame) -> pd.Series:
        if features_df.empty or not self.is_fitted:
            return pd.Series(dtype=bool)
            
        feature_cols = get_feature_columns(features_df)
        X = features_df[feature_cols]
        
        # predict returns -1 for anomalies, 1 for normal
        preds = self.model.predict(X)
        return pd.Series(preds == -1, index=features_df.index)
        
    def score(self, features_df: pd.DataFrame) -> pd.Series:
        """Returns anomaly scores (lower is more anomalous)"""
        if features_df.empty or not self.is_fitted:
            return pd.Series(dtype=float)
            
        feature_cols = get_feature_columns(features_df)
        X = features_df[feature_cols]
        return pd.Series(self.model.decision_function(X), index=features_df.index)
