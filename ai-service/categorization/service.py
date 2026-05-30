from __future__ import annotations


KNOWN_MERCHANTS = {
    "netflix": "Subscription",
    "spotify": "Subscription",
    "shell": "Transportation",
    "whole foods": "Food",
    "walmart": "Groceries",
}


def categorize_merchant(merchant_name: str) -> dict:
    category = KNOWN_MERCHANTS.get(merchant_name.strip().lower(), "Uncategorized")
    return {"merchantName": merchant_name, "category": category}
