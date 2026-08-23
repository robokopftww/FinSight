"""Evaluate TransactionAnomalyDetector on a synthetic labeled dataset.

Run from the ai-service directory:

    python -m anomaly.evaluate

Prints precision, recall, F1, and ROC-AUC. Uses a fixed seed so runs
are reproducible; numbers reported here are what appear in a resume /
README claim, not an average across random splits.
"""

from __future__ import annotations

import json
from dataclasses import dataclass

import numpy as np
from sklearn.metrics import (
    average_precision_score,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split

from anomaly.service import TransactionAnomalyDetector


CATEGORY_STATS = {
    "rent": {"mean": 1_800.0, "std": 40.0},
    "groceries": {"mean": 90.0, "std": 25.0},
    "coffee": {"mean": 5.5, "std": 1.2},
    "subscriptions": {"mean": 14.0, "std": 3.0},
    "dining": {"mean": 42.0, "std": 12.0},
}

ANOMALY_MULTIPLIER = 3.5
ANOMALY_NOISE_MULTIPLIER = 2.0
NORMAL_COUNT = 950
ANOMALY_COUNT = 50
SEED = 42


@dataclass
class EvaluationResult:
    precision: float
    recall: float
    f1: float
    roc_auc: float
    average_precision: float
    train_size: int
    test_size: int
    test_anomaly_count: int


def _generate_dataset(seed: int = SEED) -> tuple[list[dict], np.ndarray]:
    rng = np.random.default_rng(seed)
    categories = list(CATEGORY_STATS.keys())

    normal_categories = rng.choice(categories, size=NORMAL_COUNT)
    normal_amounts = np.array(
        [
            max(0.01, rng.normal(CATEGORY_STATS[c]["mean"], CATEGORY_STATS[c]["std"]))
            for c in normal_categories
        ]
    )

    anomaly_categories = rng.choice(categories, size=ANOMALY_COUNT)
    anomaly_amounts = np.array(
        [
            max(
                0.01,
                CATEGORY_STATS[c]["mean"] * ANOMALY_MULTIPLIER
                + rng.normal(0, CATEGORY_STATS[c]["std"] * ANOMALY_NOISE_MULTIPLIER),
            )
            for c in anomaly_categories
        ]
    )

    amounts = np.concatenate([normal_amounts, anomaly_amounts])
    cats = np.concatenate([normal_categories, anomaly_categories])
    labels = np.concatenate([np.zeros(NORMAL_COUNT), np.ones(ANOMALY_COUNT)])

    order = rng.permutation(len(amounts))
    transactions = [
        {"amount": float(amounts[i]), "category": str(cats[i])} for i in order
    ]
    return transactions, labels[order]


def evaluate() -> EvaluationResult:
    transactions, labels = _generate_dataset()
    train_txns, test_txns, _train_labels, test_labels = train_test_split(
        transactions,
        labels,
        test_size=0.3,
        random_state=SEED,
        stratify=labels,
    )

    detector = TransactionAnomalyDetector(
        contamination=ANOMALY_COUNT / (NORMAL_COUNT + ANOMALY_COUNT),
        random_state=SEED,
    )
    detector.fit(train_txns)
    predictions = detector.predict(test_txns)

    y_pred = np.array([1 if p.is_anomaly else 0 for p in predictions])
    y_score = -np.array([p.anomaly_score for p in predictions])

    return EvaluationResult(
        precision=precision_score(test_labels, y_pred, zero_division=0),
        recall=recall_score(test_labels, y_pred, zero_division=0),
        f1=f1_score(test_labels, y_pred, zero_division=0),
        roc_auc=roc_auc_score(test_labels, y_score),
        average_precision=average_precision_score(test_labels, y_score),
        train_size=len(train_txns),
        test_size=len(test_txns),
        test_anomaly_count=int(test_labels.sum()),
    )


def main() -> None:
    result = evaluate()
    payload = {
        "model": "IsolationForest",
        "features": ["amount", "one_hot(category)"],
        "train_size": result.train_size,
        "test_size": result.test_size,
        "test_anomaly_count": result.test_anomaly_count,
        "metrics": {
            "precision": round(result.precision, 4),
            "recall": round(result.recall, 4),
            "f1": round(result.f1, 4),
            "roc_auc": round(result.roc_auc, 4),
            "average_precision": round(result.average_precision, 4),
        },
    }
    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
