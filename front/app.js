// UI 슬라이더나 wind_data.json과 연동될 전역 바람 상태값 정의
window.currentWindState = window.currentWindState || {
  speed: 10.0,     // 기본 풍속 (m/s)
  direction: 45.0, // 기본 풍향 (도)
  type: 'SAFE'     // SAFE, WINDSHEAR, DOWNDRAFT 중 택일
};
Cesium.Ion.defaultAccessToken = '';

const viewer = new Cesium.Viewer('cesiumContainer');

// -----------------------------
// 1. 활주로 좌표 (인천공항 33L → 15R)
// -----------------------------
const runwayElevation = 7.0; // 표고 약 7m

const runwayStart = Cesium.Cartesian3.fromDegrees(126.458053, 37.457393, runwayElevation); // 33L
const runwayEnd   = Cesium.Cartesian3.fromDegrees(126.439216, 37.478612, runwayElevation); // 15R

// -----------------------------
// 2. 시간에 따른 위치(SampledPositionProperty) 생성
// -----------------------------
const start = Cesium.JulianDate.now();
const stop = Cesium.JulianDate.addSeconds(start, 20, new Cesium.JulianDate()); // 20초 동안 이동

const positionProperty = new Cesium.SampledPositionProperty();
positionProperty.addSample(start, runwayStart);
positionProperty.addSample(stop, runwayEnd);

positionProperty.setInterpolationOptions({
  interpolationDegree: 2,
  interpolationAlgorithm: Cesium.HermitePolynomialApproximation,
});

// -----------------------------
// 3. Clock(시간) 설정
// -----------------------------
viewer.clock.startTime = start.clone();
viewer.clock.stopTime = stop.clone();
viewer.clock.currentTime = start.clone();
viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP; // 끝나면 반복
viewer.clock.multiplier = 1;
viewer.clock.shouldAnimate = true;

viewer.timeline.zoomTo(start, stop);

// -----------------------------
// 4. 비행기 모델(Entity) 생성
// -----------------------------
const airplaneEntity = viewer.entities.add({
  position: positionProperty,
  orientation: new Cesium.VelocityOrientationProperty(positionProperty),
  model: {
    uri: './models/airplane.glb',
    minimumPixelSize: 64,
    maximumScale: 200,
  },
  path: {
    resolution: 1,
    material: new Cesium.PolylineGlowMaterialProperty({
      glowPower: 0.2,
      color: Cesium.Color.YELLOW,
    }),
    width: 5,
  },
});

// -----------------------------
// 5. 카메라 이동
// -----------------------------
viewer.zoomTo(airplaneEntity);

// -----------------------------
// 6. 전방 바람장 데이터 패치 및 유체 시뮬레이션 연동 (0.2초마다 실행)
// -----------------------------
let lastFetchTime = 0;
const fetchInterval = 200;

viewer.clock.onTick.addEventListener(function(clock) {
  const now = performance.now();
  if (now - lastFetchTime < fetchInterval) return;
  lastFetchTime = now;

  const currentTime = clock.currentTime;
  const currentPosition = positionProperty.getValue(currentTime);
  if (!currentPosition) return;

  const cartographic = Cesium.Cartographic.fromCartesian(currentPosition);
  const lon = Cesium.Math.toDegrees(cartographic.longitude);
  const lat = Cesium.Math.toDegrees(cartographic.latitude);
  const alt = cartographic.height;

  const currentWind = window.currentWindState;
  const speed = currentWind.speed;
  const direction = currentWind.direction;

  if (typeof fluidConfig !== 'undefined') {
      fluidConfig.velocity = speed / 5.0;
  }

  const gridPoints = [];
  const spacing = 0.0005;
  let idCounter = 1;

  for (let row = -1; row <= 1; row++) {
    for (let col = -1; col <= 1; col++) {
      const rad = (direction * Math.PI) / 180;
      let u = -speed * Math.sin(rad);
      let v = -speed * Math.cos(rad);
      let w = 0.0;

      if (currentWind.type === 'DOWNDRAFT') {
        w = -5.0;
      } else if (currentWind.type === 'WINDSHEAR') {
        u += (Math.random() - 0.5 * row) * 8;
      }

      gridPoints.push({
        id: idCounter++,
        lat: lat + (row * spacing),
        lon: lon + (col * spacing),
        alt: alt,
        u: Number(u.toFixed(2)),
        v: Number(v.toFixed(2)),
        w: Number(w.toFixed(2))
      });
    }
  }

  const payload = {
    timestamp: Date.now(),
    airplane_position: { lat, lon, alt },
    grid_points: gridPoints
  };

  fetch('http://localhost:8000/api/v1/predict-turbulence', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload)
  })
  .then(response => response.json())
  .then(data => {
    console.log('위험도 예측 결과:', data.risk_score, data.message);
    
    if (typeof updateFluidColor === 'function' && data.risk_score !== undefined) {
        updateFluidColor(data.risk_score);
    }
  })
  .catch(error => {
    console.error('FastAPI 통신 에러:', error);
  });
});

