import pandas as pd
import numpy as np

class ThresholdDetector:
    """Detects anomalies using fixed threshold rules."""
    def __init__(self, latency_threshold: float = 200.0, error_count_threshold: int = 1):
        self.latency_threshold = latency_threshold
        self.error_count_threshold = error_count_threshold
        
    def detect(self, features_df: pd.DataFrame) -> pd.Series:
        if features_df.empty:
            return pd.Series(dtype=bool)
            
        anomalies = (
            (features_df['max_latency'] > self.latency_threshold) |
            (features_df['error_count'] >= self.error_count_threshold) |
            (features_df['error_rate'] > 0)
        )
        return anomalies

class RollingStatsDetector:
    """Detects anomalies using rolling mean and standard deviation (z-score)."""
    def __init__(self, window_size: int = 10, z_threshold: float = 3.0):
        self.window_size = window_size
        self.z_threshold = z_threshold
        
    def detect(self, features_df: pd.DataFrame) -> pd.Series:
        if features_df.empty:
            return pd.Series(dtype=bool)
            
        anomalies = pd.Series(False, index=features_df.index)
        
        # We process sequentially to prevent future information leakage
        # For each row, calculate mean/std of the previous 'window_size' rows
        for i in range(len(features_df)):
            if i < self.window_size:
                # Insufficient history, fallback to fixed threshold or safe assumption
                if features_df.loc[i, 'error_count'] > 0:
                    anomalies.iloc[i] = True
                continue
                
            history = features_df.loc[i - self.window_size : i - 1]
            
            # Check latency z-score
            mean_lat = history['avg_latency'].mean()
            std_lat = history['avg_latency'].std()
            
            if std_lat == 0 or pd.isna(std_lat):
                std_lat = 1.0 # Prevent division by zero
                
            current_lat = features_df.loc[i, 'avg_latency']
            z_score = (current_lat - mean_lat) / std_lat
            
            if z_score > self.z_threshold or features_df.loc[i, 'error_count'] > 0:
                anomalies.iloc[i] = True
                
        return anomalies
