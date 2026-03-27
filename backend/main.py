from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import router
from agent_routes import agent_router

app = FastAPI(title="RotCheck API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(router)
app.include_router(agent_router)
