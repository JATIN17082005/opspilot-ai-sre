import pandas as pd
import json

def run_eda():
    data = []
    with open("data/telemetry.jsonl", "r") as f:
        for line in f:
            if line.strip():
                data.append(json.loads(line))
                
    df = pd.DataFrame(data)
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df = df.sort_values('timestamp')
    
    print("=== Basic Info ===")
    print(f"Total events: {len(df)}")
    print(f"Services: {df['service'].unique()}")
    print(f"Labels: {df['label'].unique()}")
    
    print("\n=== Event Types by Label ===")
    print(pd.crosstab(df['label'], df['event_type']))
    
    print("\n=== Missing Values ===")
    print(df.isnull().sum())
    
    print("\n=== Metric Distributions (Normal vs Fault) ===")
    metrics_df = df[df['event_type'] == 'metric'].copy()
    for metric in metrics_df['metric_name'].unique():
        print(f"\nMetric: {metric}")
        mdf = metrics_df[metrics_df['metric_name'] == metric]
        print(mdf.groupby('label')['value'].describe().round(2))
        
    print("\n=== Log Levels by Label ===")
    logs_df = df[df['event_type'] == 'log'].copy()
    if not logs_df.empty:
        print(pd.crosstab(logs_df['label'], logs_df['level']))
        
    # Temporal ordering and duplicate check
    is_monotonic = df['timestamp'].is_monotonic_increasing
    print(f"\nTimestamps monotonically increasing: {is_monotonic}")
    
    if 'id' in df.columns:
        dups = df.duplicated(subset=['id']).sum()
        print(f"Duplicate IDs: {dups}")
        
    # Output to a file for artifact persistence if needed
    with open("analysis/eda_summary.txt", "w") as f:
        f.write("EDA completed successfully.\n")

if __name__ == "__main__":
    run_eda()
