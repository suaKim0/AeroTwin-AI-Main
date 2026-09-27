Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjRiTU9mUkpXcEJDZnBxU1IiLCJqdGkiOiJlZTQ0YTQ3Yy02MmQwLTQ5NjQtYjM0Ni04Nzg3NTU5M2Y5MTEiLCJpZCI6NDg0Mzc3LCJzdWIiOiJkb2RvaGciLCJpc3MiOiJodHRwczovL2FwaS5jZXNpdW0uY29tIiwiYXVkIjoiZG9kb2hnX2RlZmF1bHQiLCJpYXQiOjE3OTA0MjI4MzJ9.bxtXbRPYuUmUzmuQWEn02DnIzg6jMpY0Xm7g8MTYkRc';

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