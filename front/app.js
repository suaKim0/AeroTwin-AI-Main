// -----------------------------
// 1. Cesium Viewer 생성
// -----------------------------
const viewer = new Cesium.Viewer("cesiumContainer", {
    baseLayerPicker: false,
    animation: false,
    imageryProvider: false,
    skyBox: new Cesium.SkyBox({
        sources: {
            positiveX: "./public/cesium/Assets/Textures/SkyBox/tycho2t3_80_px.jpg",
            negativeX: "./public/cesium/Assets/Textures/SkyBox/tycho2t3_80_mx.jpg",
            positiveY: "./public/cesium/Assets/Textures/SkyBox/tycho2t3_80_py.jpg",
            negativeY: "./public/cesium/Assets/Textures/SkyBox/tycho2t3_80_my.jpg",
            positiveZ: "./public/cesium/Assets/Textures/SkyBox/tycho2t3_80_pz.jpg",
            negativeZ: "./public/cesium/Assets/Textures/SkyBox/tycho2t3_80_mz.jpg"
        }
    })
});
window.viewer = viewer;

// -----------------------------
// 2. 활주로 좌표 (인천공항 33L → 15R)
// -----------------------------
const runwayElevation = 7.0;

const runwayStart = Cesium.Cartesian3.fromDegrees(
    126.458053,
    37.457393,
    runwayElevation
);

const runwayEnd = Cesium.Cartesian3.fromDegrees(
    126.439216,
    37.478612,
    runwayElevation
);

// -----------------------------
// 3. 시간에 따른 비행기 위치 생성
// -----------------------------
const start = Cesium.JulianDate.now();

const stop = Cesium.JulianDate.addSeconds(
    start,
    20,
    new Cesium.JulianDate()
);

const positionProperty = new Cesium.SampledPositionProperty();

positionProperty.addSample(start, runwayStart);
positionProperty.addSample(stop, runwayEnd);

positionProperty.setInterpolationOptions({
    interpolationDegree: 2,
    interpolationAlgorithm: Cesium.HermitePolynomialApproximation
});

// -----------------------------
// 4. Clock 설정
// -----------------------------
viewer.clock.startTime = start.clone();
viewer.clock.stopTime = stop.clone();
viewer.clock.currentTime = start.clone();
viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
viewer.clock.multiplier = 1;
viewer.clock.shouldAnimate = true;

// -----------------------------
// 5. 비행기 모델 생성
// -----------------------------
const airplaneEntity = viewer.entities.add({
    position: positionProperty,

    orientation: new Cesium.VelocityOrientationProperty(
        positionProperty
    ),

    model: {
        uri: "./models/airplane.glb",
        minimumPixelSize: 64,
        maximumScale: 200
    },

    path: {
        resolution: 1,
        material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.2,
            color: Cesium.Color.YELLOW
        }),
        width: 5
    }
});

// 다른 스크립트에서도 비행기 위치를 사용할 수 있도록 공개
window.airplaneEntity = airplaneEntity;
window.positionProperty = positionProperty;

// -----------------------------
// 6. 카메라 이동
// -----------------------------
viewer.zoomTo(airplaneEntity).then(() => {
    viewer.trackedEntity = airplaneEntity;
});

console.log("비행기 모델 초기화 완료");