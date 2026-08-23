from dotenv import load_dotenv
from fastapi import FastAPI

from api.routes import router
from api.rag_routes import router as rag_router

load_dotenv(".env")

app = FastAPI(title="WealthLens AI Service", version="0.1.0")
app.include_router(router)
app.include_router(rag_router)
