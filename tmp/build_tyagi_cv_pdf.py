from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    HRFlowable,
    ListFlowable,
    ListItem,
    Paragraph,
    PageBreak,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


OUT = Path("/Users/keshavtyagi/Developer/WealthLens/output/cv/Keshav_Tyagi_CV.pdf")
BLUE = colors.HexColor("#2E74B5")
DARK = colors.HexColor("#1F4D78")
MUTED = colors.HexColor("#5A5A5A")
GRID = colors.HexColor("#D9E2EC")
LIGHT = colors.HexColor("#F2F4F7")


def p(text, style):
    return Paragraph(text, style)


def bullets(items, style):
    return ListFlowable(
        [ListItem(Paragraph(item, style), leftIndent=0) for item in items],
        bulletType="bullet",
        start="circle",
        leftIndent=13,
        bulletFontSize=7,
        bulletOffsetY=1,
        spaceBefore=0,
        spaceAfter=4,
    )


def role(title, org=None, loc=None, dates=None, style=None):
    left = title
    if org:
        left += f" | {org}"
    if loc:
        left += f" - {loc}"
    if dates:
        return p(f"<b>{left}</b> &nbsp;&nbsp; <font color='#666666'><i>{dates}</i></font>", style)
    return p(f"<b>{left}</b>", style)


def build():
    styles = getSampleStyleSheet()
    body = ParagraphStyle(
        "Body",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=9.5,
        leading=11.4,
        spaceAfter=5,
        alignment=TA_LEFT,
    )
    small = ParagraphStyle(
        "Small",
        parent=body,
        fontSize=8.8,
        leading=10.4,
        spaceAfter=3,
    )
    title = ParagraphStyle(
        "Title",
        parent=body,
        fontName="Helvetica-Bold",
        fontSize=24,
        leading=28,
        alignment=TA_CENTER,
        spaceAfter=1,
    )
    contact = ParagraphStyle(
        "Contact",
        parent=body,
        fontSize=9.2,
        leading=11,
        alignment=TA_CENTER,
        textColor=MUTED,
        spaceAfter=4,
    )
    h1 = ParagraphStyle(
        "H1",
        parent=body,
        fontName="Helvetica-Bold",
        fontSize=14.5,
        leading=17,
        textColor=BLUE,
        spaceBefore=10,
        spaceAfter=5,
    )
    role_style = ParagraphStyle(
        "Role",
        parent=body,
        fontSize=10,
        leading=12,
        spaceBefore=3,
        spaceAfter=2,
    )
    tech = ParagraphStyle(
        "Tech",
        parent=small,
        fontSize=8.7,
        leading=10.2,
        spaceAfter=3,
    )

    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=letter,
        rightMargin=0.7 * inch,
        leftMargin=0.7 * inch,
        topMargin=0.55 * inch,
        bottomMargin=0.55 * inch,
    )
    story = []
    story += [
        p("Keshav Tyagi", title),
        p("(813) 327-9470 | Tampa, FL | keshav54@usf.edu | linkedin.com/in/keshav--tyagi", contact),
        HRFlowable(width="100%", thickness=1, color=BLUE, spaceAfter=10),
    ]

    story += [
        p("Professional Profile", h1),
        p(
            "Computer Science undergraduate at the University of South Florida with hands-on experience building full-stack, AI-enabled web applications. Project work spans financial technology, real-time public safety data, LLM-assisted user workflows, REST APIs, PostgreSQL data systems, and production deployment across modern cloud platforms.",
            body,
        ),
        p("Education", h1),
        role("B.S. Computer Science", "University of South Florida", "Tampa, FL", style=role_style),
        p("Technical Competencies", h1),
    ]

    skill_rows = [
        ("Languages", "Python, TypeScript, JavaScript, C++, SQL"),
        ("Frontend", "Next.js, React, Tailwind CSS, ShadCN UI, Recharts, responsive UI/UX"),
        ("Backend & Data", "Node.js, Fastify, Express, REST APIs, PostgreSQL, Prisma ORM, Neon, Redis"),
        ("AI / ML", "FastAPI, Pandas, NumPy, scikit-learn, Gemini LLM, AI agents, Plaid API, forecasting, anomaly detection"),
        ("DevOps", "Git, GitHub Actions CI/CD, Vercel, Render, production debugging, testing"),
    ]
    table = Table(
        [[p(f"<b>{a}</b>", small), p(b, small)] for a, b in skill_rows],
        colWidths=[1.25 * inch, 4.9 * inch],
        hAlign="LEFT",
    )
    table.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.35, GRID),
                ("BACKGROUND", (0, 0), (0, -1), LIGHT),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story += [table, Spacer(1, 7)]

    story += [
        p("Selected Technical Projects", h1),
        role("WealthLens - AI Financial Copilot", "Full-Stack + AI Engineering", dates="2026", style=role_style),
        p(
            "<b>Technologies:</b> Next.js, React, TypeScript, Node.js/Fastify, PostgreSQL, Prisma, Python FastAPI, scikit-learn, Gemini LLM, Plaid API, Vercel",
            tech,
        ),
        bullets(
            [
                "Built a production-deployed AI financial copilot with REST API endpoints, Clerk authentication, Plaid bank-account connectivity, real-time spending tracking, and personalized financial insights.",
                "Engineered a Python FastAPI analytics service using Pandas, NumPy, and scikit-learn to forecast cash flow, score financial health, and detect subscriptions and anomalies from transaction data.",
                "Integrated Gemini LLM with transaction-aware context for advisor chat, automated weekly reports, and goal planning; deployed across Vercel, Render, and Neon with GitHub Actions CI/CD.",
            ],
            small,
        ),
        role("BayGuard Tampa - Disaster Intelligence Web App", "Hackathon", dates="2026", style=role_style),
        p(
            "<b>Technologies:</b> React 19, Vite, TypeScript, Node.js/Express, Google Maps API, Gemini AI, Redis, Vercel",
            tech,
        ),
        bullets(
            [
                "Collaborated in a team of four to build a Tampa disaster intelligence app that pulls live data from NWS, NOAA, NHC, FL-511, and Tampa Electric into a real-time neighborhood risk map.",
                "Architected a multi-agent AI layer using Google Gemini, with specialized weather, flood, storm, and report-verification agents feeding a final synthesis layer for readable evacuation guidance and situational summaries.",
                "Built resident report submission with AI-assisted verification, evidence cross-referencing, SMS alerting, subscriber management, cooldown controls, and simulation modes for flood and hurricane drills.",
            ],
            small,
        ),
        PageBreak(),
        p("Professional Experience", h1),
        role("Student Assistant", "USF Office of the Provost (Academic Affairs)", "Tampa, FL", "Jun 2026 - Present", role_style),
        bullets(
            [
                "Manage and triage JIRA tickets, coordinate task workflows, and collaborate with office staff to resolve administrative and technical requests efficiently.",
                "Use Office 365 tools including Teams, Word, and Excel to support communication, documentation, and daily office operations.",
            ],
            small,
        ),
        role("Import & Export Assistant", "Family Business", "Riverview, FL", "2022 - 2024", role_style),
        bullets(
            ["Managed vendor pricing research, bulk inventory procurement, shipment coordination, and online inventory tracking."],
            small,
        ),
        role("Cashier & Stock Associate", "Local Grocery Store", "Gibsonton, FL", "2023 - 2024", role_style),
        bullets(
            ["Processed high-volume transactions, restocked inventory, and maintained customer-facing areas in a fast-paced retail environment."],
            small,
        ),
        p("Community Service & Activities", h1),
        role("Volunteer", "Feeding Tampa Bay", "Tampa, FL", "2022 - 2023", role_style),
        bullets(
            ["Supported high-volume community food distribution through meal preparation, pantry operations, and service logistics."],
            small,
        ),
        role("JV Wrestling", dates="Student Activity", style=role_style),
        bullets(
            ["Competed in tournaments and developed discipline, teamwork, and resilience through consistent training."],
            small,
        ),
    ]

    def footer(canvas, doc_obj):
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(MUTED)
        canvas.drawCentredString(letter[0] / 2, 0.32 * inch, f"Keshav Tyagi - Curriculum Vitae | Page {doc_obj.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    print(OUT)


if __name__ == "__main__":
    build()
