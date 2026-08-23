from __future__ import annotations

import pytest

from anomaly.evaluate import evaluate
from anomaly.service import TransactionAnomalyDetector


def _normal_transactions() -> list[dict]:
    return [
        {"amount": 5.5, "category": "coffee"},
        {"amount": 6.0, "category": "coffee"},
        {"amount": 4.9, "category": "coffee"},
        {"amount": 90.0, "category": "groceries"},
        {"amount": 85.0, "category": "groceries"},
        {"amount": 100.0, "category": "groceries"},
        {"amount": 1_800.0, "category": "rent"},
        {"amount": 1_810.0, "category": "rent"},
        {"amount": 1_795.0, "category": "rent"},
    ] * 10


def test_detector_flags_an_obvious_outlier() -> None:
    detector = TransactionAnomalyDetector(contamination=0.05, random_state=0).fit(
        _normal_transactions()
    )

    predictions = detector.predict(
        [
            {"amount": 6.0, "category": "coffee"},
            {"amount": 5_000.0, "category": "coffee"},
        ]
    )

    # Lower decision_function score ⇒ more anomalous. The outlier must rank
    # more anomalous than the in-distribution coffee purchase.
    assert predictions[1].anomaly_score < predictions[0].anomaly_score
    assert predictions[0].is_anomaly is False


def test_predict_before_fit_raises() -> None:
    detector = TransactionAnomalyDetector()
    with pytest.raises(RuntimeError):
        detector.predict([{"amount": 10.0, "category": "coffee"}])


def test_fit_rejects_empty_input() -> None:
    with pytest.raises(ValueError):
        TransactionAnomalyDetector().fit([])


def test_predict_handles_unseen_category() -> None:
    detector = TransactionAnomalyDetector(contamination=0.1, random_state=0).fit(
        _normal_transactions()
    )

    predictions = detector.predict(
        [{"amount": 12.0, "category": "unseen_category"}]
    )
    assert len(predictions) == 1
    assert predictions[0].category == "unseen_category"


def test_evaluation_meets_quality_bar() -> None:
    """Guardrail: if the model regresses below these thresholds the resume
    bullet's numbers stop being true and CI fails."""
    result = evaluate()
    assert result.precision >= 0.8
    assert result.recall >= 0.8
    assert result.f1 >= 0.8
    assert result.roc_auc >= 0.9
