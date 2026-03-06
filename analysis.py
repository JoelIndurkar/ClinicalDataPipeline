import os
import sys

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns
import scipy.stats as stats

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))
from db import get_connection, DB_PATH

os.makedirs("output", exist_ok=True)


def get_data(conn):
    query = """
        SELECT
            s.sample, s.subject, s.project, s.sample_type,
            s.time_from_treatment_start, s.treatment, s.response,
            subj.condition, subj.age, subj.sex,
            cc.population, cc.count
        FROM samples s
        JOIN subjects subj ON s.subject = subj.subject
        JOIN cell_counts cc ON s.sample = cc.sample
    """
    return pd.read_sql_query(query, conn)


def part2(df):
    totalCounts = df.groupby("sample")["count"].sum().rename("total_count")
    merged = df.merge(totalCounts, on="sample")
    merged["percentage"] = (merged["count"] / merged["total_count"]) * 100
    result = merged[["sample", "total_count", "population", "count", "percentage"]]
    result.to_csv("output/part2_summary.csv", index=False)
    print(f"Part 2: {len(result)} rows -> output/part2_summary.csv")
    return result


def part3(df):
    filtered = df[
        (df["condition"] == "melanoma") &
        (df["sample_type"] == "PBMC") &
        (df["treatment"] == "miraclib") &
        (df["response"].notna())
    ].copy()

    totalCounts = filtered.groupby("sample")["count"].sum().rename("total_count")
    filtered = filtered.merge(totalCounts, on="sample")
    filtered["percentage"] = (filtered["count"] / filtered["total_count"]) * 100

    populations = sorted(filtered["population"].unique())
    statsRows = []
    for pop in populations:
        popDf = filtered[filtered["population"] == pop]
        responders = popDf[popDf["response"] == "yes"]["percentage"]
        nonResponders = popDf[popDf["response"] == "no"]["percentage"]
        stat, pVal = stats.mannwhitneyu(responders, nonResponders, alternative="two-sided")
        statsRows.append({
            "population": pop,
            "n_responders": len(responders),
            "n_non_responders": len(nonResponders),
            "u_statistic": stat,
            "p_value": pVal,
        })

    statsDf = pd.DataFrame(statsRows)
    statsDf.to_csv("output/part3_stats.csv", index=False)
    print(f"Part 3: stats -> output/part3_stats.csv")

    fig, axes = plt.subplots(1, len(populations), figsize=(4 * len(populations), 5))
    if len(populations) == 1:
        axes = [axes]

    for ax, pop in zip(axes, populations):
        popDf = filtered[filtered["population"] == pop]
        sns.boxplot(data=popDf, x="response", y="percentage", ax=ax, order=["yes", "no"])
        pVal = statsDf[statsDf["population"] == pop]["p_value"].values[0]
        ax.set_title(f"{pop}\np={pVal:.4f}")
        ax.set_xlabel("Response")
        ax.set_ylabel("Frequency (%)")

    plt.tight_layout()
    plt.savefig("output/part3_boxplots.png", dpi=150)
    plt.close()
    print("Part 3: boxplots -> output/part3_boxplots.png")
    return filtered, statsDf


def part4(df):
    filtered = df[
        (df["condition"] == "melanoma") &
        (df["sample_type"] == "PBMC") &
        (df["treatment"] == "miraclib") &
        (df["time_from_treatment_start"] == 0)
    ].copy()

    # unique samples for aggregate counts
    uniqueSamples = filtered.drop_duplicates("sample")

    print("\nPart 4 subset (melanoma, PBMC, miraclib, time=0):")
    print("  samples per project:")
    print(uniqueSamples.groupby("project").size().to_string())
    print("  responder counts:")
    print(uniqueSamples.groupby("response").size().to_string())
    print("  sex counts:")
    print(uniqueSamples.groupby("sex").size().to_string())

    filtered.to_csv("output/part4_subset.csv", index=False)
    print(f"\nPart 4: {len(uniqueSamples)} samples -> output/part4_subset.csv")

    avgBCell = filtered[
        (filtered["population"] == "b_cell") &
        (filtered["sex"] == "M") &
        (filtered["response"] == "yes")
    ]["count"].mean()
    print(f"  avg B cells (male responders): {avgBCell:.2f}")

    return filtered


if __name__ == "__main__":
    conn = get_connection()
    df = get_data(conn)
    conn.close()

    part2(df)
    part3(df)
    part4(df)
