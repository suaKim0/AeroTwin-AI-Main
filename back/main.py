from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

# -----------------------------
# CORS 설정 (프론트엔드에서 접근 허용)
# -----------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 개발 단계이므로 전체 허용
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------
# 요청 데이터 형식 정의
# -----------------------------
class PositionData(BaseModel):
    latitude: float
    longitude: float
    altitude: float

# -----------------------------
# calculate_turbulence_risk 추후 삽입
# -----------------------------
def calculate_turbulence_risk(latitude: float, longitude: float, altitude: float):
    # TODO: 교체 예정
    return {
        "risk_score": None,
        "level": None,
        "position": {
            "latitude": latitude,
            "longitude": longitude,
            "altitude": altitude,
        },
    }

# -----------------------------
# API 엔드포인트
# -----------------------------
@app.post("/api/v1/predict-turbulence")
def predict_turbulence(data: PositionData):
    result = calculate_turbulence_risk(data.latitude, data.longitude, data.altitude)
    return result

@app.get("/")
def read_root():
    return {"message": "Aerotwin backend is running"}