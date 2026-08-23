from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Source:
    url: str
    title: str
    publisher: str
    kind: str  # "GOV" | "COMMERCIAL"


SEED_SOURCES: list[Source] = [
    # =========== CFPB (Consumer Financial Protection Bureau) ===========
    Source(
        url="https://files.consumerfinance.gov/f/documents/cfpb_ymyg-savings-booklet.pdf",
        title="Building your savings? Start with small goals",
        publisher="CFPB",
        kind="GOV",
    ),
    Source(
        url="https://files.consumerfinance.gov/f/documents/cfpb_your-money-your-goals_financial-empowerment_toolkit.pdf",
        title="Your Money Your Goals — Financial empowerment toolkit",
        publisher="CFPB",
        kind="GOV",
    ),
    Source(
        url="https://files.consumerfinance.gov/f/documents/cfpb_ymyg_focus-on-people-with-disabilities.pdf",
        title="Your Money Your Goals — Focus on people with disabilities",
        publisher="CFPB",
        kind="GOV",
    ),
    # =========== IRS (Internal Revenue Service) ===========
    Source(
        url="https://www.irs.gov/pub/irs-pdf/p17.pdf",
        title="Publication 17: Your Federal Income Tax",
        publisher="IRS",
        kind="GOV",
    ),
    Source(
        url="https://www.irs.gov/pub/irs-pdf/p590a.pdf",
        title="Publication 590-A: Contributions to Individual Retirement Arrangements",
        publisher="IRS",
        kind="GOV",
    ),
    Source(
        url="https://www.irs.gov/pub/irs-pdf/p590b.pdf",
        title="Publication 590-B: Distributions from Individual Retirement Arrangements",
        publisher="IRS",
        kind="GOV",
    ),
    Source(
        url="https://www.irs.gov/pub/irs-pdf/p505.pdf",
        title="Publication 505: Tax Withholding and Estimated Tax",
        publisher="IRS",
        kind="GOV",
    ),
    Source(
        url="https://www.irs.gov/pub/irs-pdf/p550.pdf",
        title="Publication 550: Investment Income and Expenses",
        publisher="IRS",
        kind="GOV",
    ),
    Source(
        url="https://www.irs.gov/pub/irs-pdf/p551.pdf",
        title="Publication 551: Basis of Assets",
        publisher="IRS",
        kind="GOV",
    ),
    Source(
        url="https://www.irs.gov/pub/irs-pdf/p557.pdf",
        title="Publication 557: Tax-Exempt Status for Your Organization",
        publisher="IRS",
        kind="GOV",
    ),
    Source(
        url="https://www.irs.gov/pub/irs-pdf/p560.pdf",
        title="Publication 560: Retirement Plans for Small Business",
        publisher="IRS",
        kind="GOV",
    ),
    Source(
        url="https://www.irs.gov/pub/irs-pdf/p523.pdf",
        title="Publication 523: Selling Your Home",
        publisher="IRS",
        kind="GOV",
    ),
    Source(
        url="https://www.irs.gov/pub/irs-pdf/p527.pdf",
        title="Publication 527: Residential Rental Property",
        publisher="IRS",
        kind="GOV",
    ),
    Source(
        url="https://www.irs.gov/pub/irs-pdf/p537.pdf",
        title="Publication 537: Installment Sales",
        publisher="IRS",
        kind="GOV",
    ),
    Source(
        url="https://www.irs.gov/pub/irs-pdf/p544.pdf",
        title="Publication 544: Sales of Assets",
        publisher="IRS",
        kind="GOV",
    ),
    Source(
        url="https://www.irs.gov/pub/irs-pdf/p587.pdf",
        title="Publication 587: Business Use of Your Home",
        publisher="IRS",
        kind="GOV",
    ),
    Source(
        url="https://www.irs.gov/pub/irs-pdf/p936.pdf",
        title="Publication 936: Home Mortgage Interest Deduction",
        publisher="IRS",
        kind="GOV",
    ),
    Source(
        url="https://www.irs.gov/pub/irs-pdf/p946.pdf",
        title="Publication 946: How to Depreciate Property",
        publisher="IRS",
        kind="GOV",
    ),
    Source(
        url="https://www.irs.gov/pub/irs-pdf/p970.pdf",
        title="Publication 970: Tax Benefits for Education",
        publisher="IRS",
        kind="GOV",
    ),
    Source(
        url="https://www.irs.gov/pub/irs-pdf/p3.pdf",
        title="Publication 3: Armed Forces' Tax Guide",
        publisher="IRS",
        kind="GOV",
    ),
    Source(
        url="https://www.irs.gov/pub/irs-pdf/p334.pdf",
        title="Publication 334: Tax Guide for Small Business",
        publisher="IRS",
        kind="GOV",
    ),
    Source(
        url="https://www.irs.gov/pub/irs-pdf/p1544.pdf",
        title="Publication 1544: Reporting Cash Payments of Over $10,000",
        publisher="IRS",
        kind="GOV",
    ),
    Source(
        url="https://www.irs.gov/pub/irs-pdf/p225.pdf",
        title="Publication 225: Farmer's Tax Guide",
        publisher="IRS",
        kind="GOV",
    ),
]
