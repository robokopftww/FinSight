from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest


@dataclass
class AnomalyPrediction:
    index: int
    amount: float
    category: str
    is_anomaly: bool
    anomaly_score: float


class TransactionAnomalyDetector:
    """IsolationForest wrapper for per-transaction anomaly detection.

    Features per transaction: absolute amount + one-hot category. The
    forest learns a joint distribution so an amount that is normal for
    one category (e.g. rent) but extreme for another (e.g. coffee) is
    still flagged in the second context.
    """

    def __init__(self, contamination: float = 0.05, random_state: int = 42) -> None:
        self.contamination = contamination
        self.random_state = random_state
        self._model = IsolationForest(
            contamination=contamination,
            random_state=random_state,
            n_estimators=200,
        )
        self._category_columns: list[str] = []
        self._fitted = False

    def _to_frame(self, transactions: list[dict]) -> pd.DataFrame:
        if not transactions:
            return pd.DataFrame(columns=["amount", "category"])
        frame = pd.DataFrame(transactions)
        if "amount" not in frame.columns or "category" not in frame.columns:
            raise ValueError("transactions must contain 'amount' and 'category'")
        frame["amount"] = frame["amount"].astype(float).abs()
        frame["category"] = frame["category"].astype(str)
        return frame

    def _featurize(self, frame: pd.DataFrame, *, fitting: bool) -> np.ndarray:
        one_hot = pd.get_dummies(frame["category"], prefix="cat")
        if fitting:
            self._category_columns = list(one_hot.columns)
        else:
            one_hot = one_hot.reindex(columns=self._category_columns, fill_value=0)
        features = pd.concat(
            [frame[["amount"]].reset_index(drop=True), one_hot.reset_index(drop=True)],
            axis=1,
        )
        return features.to_numpy(dtype=float)

    def fit(self, transactions: list[dict]) -> "TransactionAnomalyDetector":
        frame = self._to_frame(transactions)
        if frame.empty:
            raise ValueError("cannot fit on empty transactions")
        matrix = self._featurize(frame, fitting=True)
        self._model.fit(matrix)
        self._fitted = True
        return self

    def predict(self, transactions: list[dict]) -> list[AnomalyPrediction]:
        if not self._fitted:
            raise RuntimeError("detector is not fitted; call fit() first")
        frame = self._to_frame(transactions)
        if frame.empty:
            return []
        matrix = self._featurize(frame, fitting=False)
        raw_predictions = self._model.predict(matrix)
        raw_scores = self._model.decision_function(matrix)
        results: list[AnomalyPrediction] = []
        for idx, (pred, score, row) in enumerate(
            zip(raw_predictions, raw_scores, frame.itertuples(index=False))
        ):
            results.append(
                AnomalyPrediction(
                    index=idx,
                    amount=float(row.amount),
                    category=str(row.category),
                    is_anomaly=bool(pred == -1),
                    anomaly_score=float(score),
                )
            )
        return results

    def fit_predict(self, transactions: list[dict]) -> list[AnomalyPrediction]:
        self.fit(transactions)
        return self.predict(transactions)
