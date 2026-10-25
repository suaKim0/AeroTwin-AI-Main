// ==========================================
// AeroFlow AI
// Aircraft Airflow + Wake Vortex Visualization
// ==========================================

const fluidConfig = {
    color: "rgba(0, 180, 255, 0.9)",
    windDirection: 180,
    windSpeed: 10
};

const canvas = document.getElementById("fluidCanvas");
const ctx = canvas ? canvas.getContext("2d") : null;

let particles = [];
let lastFrameTime = 0;

// ------------------------------------------
// 시뮬레이션 설정
// ------------------------------------------

const PARTICLE_COUNT = 320;

const EARTH_RADIUS = 6378137;

// 비행기 주변 시각화 영역
const FRONT_LIMIT = 100;
const BACK_LIMIT = 200;
const SIDE_LIMIT = 45;

// 화면상 흐름 속도 배율
const VISUAL_SPEED_FACTOR = 1.5;

// 기체 주변 흐름의 근사 크기
const BODY_LENGTH = 24;
const WING_HALF_SPAN = 13;

// 후류 소용돌이 위치
const VORTEX_DISTANCE = 32;
const VORTEX_SPACING = 9;
const VORTEX_STRENGTH = 180;

// ------------------------------------------
// 1. 풍속에 따른 색상
// ------------------------------------------

function setFluidWind(direction, speed) {
    fluidConfig.windDirection =
        ((Number(direction) % 360) + 360) % 360;

    fluidConfig.windSpeed = Math.max(
        0,
        Math.min(30, Number(speed) || 0)
    );

    updateWindColor();

    console.log(
        `[AeroFlow AI] 풍향: ${fluidConfig.windDirection}°, ` +
        `풍속: ${fluidConfig.windSpeed} m/s`
    );
}

function updateWindColor() {
    if (fluidConfig.windSpeed >= 20) {
        fluidConfig.color = "rgba(255, 65, 65, 0.95)";
    } else if (fluidConfig.windSpeed >= 10) {
        fluidConfig.color = "rgba(255, 165, 0, 0.95)";
    } else {
        fluidConfig.color = "rgba(0, 180, 255, 0.9)";
    }
}

// 기존 기능과의 호환성 유지
function updateFluidColor(riskScore) {
    if (riskScore >= 70) {
        fluidConfig.color = "rgba(255, 65, 65, 0.95)";
    } else if (riskScore >= 40) {
        fluidConfig.color = "rgba(255, 165, 0, 0.95)";
    } else {
        fluidConfig.color = "rgba(0, 180, 255, 0.9)";
    }
}

// ------------------------------------------
// 2. 캔버스 크기 설정
// ------------------------------------------

function resizeFluidCanvas() {
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener("resize", resizeFluidCanvas);

resizeFluidCanvas();

// ------------------------------------------
// 3. 입자 생성
//
// along: 비행기 진행 방향 기준 거리
// side:  비행기 진행 방향의 좌우 거리
// up:    비행기 기준 높이
//
// along이 양수면 앞쪽,
// 음수면 뒤쪽이다.
// ------------------------------------------

function createParticles() {
    particles = [];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
            along:
                -BACK_LIMIT +
                Math.random() * (BACK_LIMIT + FRONT_LIMIT),

            side:
                (Math.random() * 2 - 1) * SIDE_LIMIT,

            up: 2 + Math.random() * 15,

            previousPosition: null,

            opacity: 0.35 + Math.random() * 0.65,

            size: 0.8 + Math.random() * 1.3
        });
    }

    console.log(
        `[AeroFlow AI] 유체 입자 ${particles.length}개 생성 완료`
    );
}

// ------------------------------------------
// 4. 바람 성분 계산
//
// 풍향은 바람이 불어오는 방향 기준
// ------------------------------------------

function getWindComponents() {
    const radians =
        fluidConfig.windDirection * Math.PI / 180;

    return {
        east:
            -Math.sin(radians) * fluidConfig.windSpeed,

        north:
            -Math.cos(radians) * fluidConfig.windSpeed
    };
}

// ------------------------------------------
// 5. 비행기 위치 및 진행 방향 계산
// ------------------------------------------

function getAircraftFrame() {
    const viewer = window.viewer;
    const airplane = window.airplaneEntity;
    const positionProperty = window.positionProperty;

    if (
        !viewer ||
        viewer.isDestroyed() ||
        !airplane ||
        !airplane.position ||
        !positionProperty
    ) {
        return null;
    }

    const time = viewer.clock.currentTime;

    const position = airplane.position.getValue(time);

    if (!position) return null;

    const cartographic =
        Cesium.Cartographic.fromCartesian(position);

    // 현재 시각보다 조금 앞선 위치를 이용해
    // 비행기의 진행 방향을 계산한다.
    const timeStep = 0.2;

    const futureTime = Cesium.JulianDate.addSeconds(
        time,
        timeStep,
        new Cesium.JulianDate()
    );

    const previousTime = Cesium.JulianDate.addSeconds(
        time,
        -timeStep,
        new Cesium.JulianDate()
    );

    const futurePosition =
        positionProperty.getValue(futureTime);

    const previousPosition =
        positionProperty.getValue(previousTime);

    let directionStart = position;
    let directionEnd = futurePosition;

    // 경로 끝부분에서 미래 위치가 없으면
    // 이전 위치를 이용한다.
    if (!directionEnd) {
        directionStart = previousPosition;
        directionEnd = position;
    }

    let headingEast = 0;
    let headingNorth = 1;

    if (directionStart && directionEnd) {
        const difference = Cesium.Cartesian3.subtract(
            directionEnd,
            directionStart,
            new Cesium.Cartesian3()
        );

        // 현재 위치의 동쪽/북쪽 단위 벡터
        const lon = cartographic.longitude;
        const lat = cartographic.latitude;

        const eastUnit = new Cesium.Cartesian3(
            -Math.sin(lon),
            Math.cos(lon),
            0
        );

        const northUnit = new Cesium.Cartesian3(
            -Math.sin(lat) * Math.cos(lon),
            -Math.sin(lat) * Math.sin(lon),
            Math.cos(lat)
        );

        const eastVelocity =
            Cesium.Cartesian3.dot(difference, eastUnit);

        const northVelocity =
            Cesium.Cartesian3.dot(difference, northUnit);

        const horizontalLength = Math.hypot(
            eastVelocity,
            northVelocity
        );

        if (horizontalLength > 0.001) {
            headingEast = eastVelocity / horizontalLength;
            headingNorth = northVelocity / horizontalLength;
        }
    }

    return {
        cartographic,

        headingEast,
        headingNorth,

        // 진행 방향의 오른쪽을 가리키는 벡터
        rightEast: headingNorth,
        rightNorth: -headingEast
    };
}

// ------------------------------------------
// 6. 비행기 기준 좌표를 지리 좌표로 변환
// ------------------------------------------

function projectParticle(particle, aircraftFrame) {
    const viewer = window.viewer;

    const cartographic = aircraftFrame.cartographic;

    const latitude = cartographic.latitude;
    const longitude = cartographic.longitude;

    // 비행기 진행 방향과 좌우 방향을
    // 동쪽/북쪽 좌표로 변환한다.
    const east =
        aircraftFrame.headingEast * particle.along +
        aircraftFrame.rightEast * particle.side;

    const north =
        aircraftFrame.headingNorth * particle.along +
        aircraftFrame.rightNorth * particle.side;

    const cosLatitude = Math.max(
        0.01,
        Math.abs(Math.cos(latitude))
    );

    const particleLongitude =
        longitude + east / (EARTH_RADIUS * cosLatitude);

    const particleLatitude =
        latitude + north / EARTH_RADIUS;

    const particleAltitude =
        cartographic.height + particle.up;

    const worldPosition = Cesium.Cartesian3.fromRadians(
        particleLongitude,
        particleLatitude,
        particleAltitude
    );

    return Cesium.SceneTransforms.worldToWindowCoordinates(
        viewer.scene,
        worldPosition
    );
}

// ------------------------------------------
// 7. 입자 재생성
// ------------------------------------------

function recycleParticle(particle) {
    particle.along =
        FRONT_LIMIT + Math.random() * 25;

    particle.side =
        (Math.random() * 2 - 1) * SIDE_LIMIT;

    particle.up = 2 + Math.random() * 15;

    particle.previousPosition = null;

    particle.opacity = 0.35 + Math.random() * 0.65;

    particle.size = 0.8 + Math.random() * 1.3;
}

// ------------------------------------------
// 8. 유체 흐름 계산
//
// 기체 주변의 흐름을 시각적으로 근사한다.
// 실제 CFD 계산은 아니다.
// ------------------------------------------

function calculateFlow(particle, aircraftFrame, wind) {
    const x = particle.along;
    const y = particle.side;

    // 바람을 비행기 진행 방향 기준으로 변환
    const windAlong =
        wind.east * aircraftFrame.headingEast +
        wind.north * aircraftFrame.headingNorth;

    const windSide =
        wind.east * aircraftFrame.rightEast +
        wind.north * aircraftFrame.rightNorth;

    // 비행기가 전진할 때 발생하는 상대 흐름을
    // 시각화용 기본 유속으로 근사한다.
    //
    // 풍속이 달라지면 흐름의 속도와 방향도 바뀐다.
    let velocityAlong =
        -35 + windAlong * 1.5;

    let velocitySide =
        windSide * 1.5;

    // --------------------------------------
    // A. 동체 주변의 흐름
    // --------------------------------------

    const bodyInfluence = Math.exp(
        -(
            Math.pow(x / BODY_LENGTH, 2) +
            Math.pow(y / 5, 2)
        )
    );

    // 기체 가까이에서 흐름이 느려지는 시각적 효과
    velocityAlong *= 1 - 0.75 * bodyInfluence;

    // --------------------------------------
    // B. 날개 주변의 흐름
    // --------------------------------------

    const wingInfluence = Math.exp(
        -(
            Math.pow((x + 1) / 17, 2) +
            Math.pow(y / WING_HALF_SPAN, 2)
        )
    );

    // 날개 주변에서 흐름이 양옆으로 휘어진다.
    const sideSign = y >= 0 ? 1 : -1;

    velocitySide +=
        sideSign * 24 * wingInfluence;

    // --------------------------------------
    // C. 비행기 뒤쪽의 후류 소용돌이
    // --------------------------------------

    const wakeX = x + VORTEX_DISTANCE;

    // 양쪽에 서로 반대 방향으로 회전하는
    // 두 개의 근사 소용돌이를 만든다.
    for (const sideSign of [-1, 1]) {
        const vortexY = sideSign * VORTEX_SPACING;

        const dx = x + VORTEX_DISTANCE;
        const dy = y - vortexY;

        const radiusSquared =
            dx * dx + dy * dy + 36;

        // 뒤쪽에서만 소용돌이가 작용한다.
        const wakeStrength =
            1 / (1 + Math.exp((wakeX - 5) / 8));

        const circulation =
            VORTEX_STRENGTH * sideSign * wakeStrength;

        velocityAlong +=
            -circulation * dy / radiusSquared;

        velocitySide +=
            circulation * dx / radiusSquared;
    }

    // 후류는 뒤쪽으로 갈수록 점차 약해진다.
    if (x < -VORTEX_DISTANCE) {
        const decay = Math.exp(
            (x + VORTEX_DISTANCE) / 120
        );

        velocityAlong *= decay;
        velocitySide *= decay;
    }

    return {
        along: velocityAlong,
        side: velocitySide
    };
}

// ------------------------------------------
// 9. 입자 그리기
// ------------------------------------------

function drawParticle(particle, screenPosition) {
    if (!screenPosition) return;

    if (
        !Number.isFinite(screenPosition.x) ||
        !Number.isFinite(screenPosition.y)
    ) {
        return;
    }

    const x = screenPosition.x;
    const y = screenPosition.y;

    // 화면 바깥의 점은 그리지 않는다.
    if (
        x < -50 ||
        x > canvas.clientWidth + 50 ||
        y < -50 ||
        y > canvas.clientHeight + 50
    ) {
        particle.previousPosition = null;
        return;
    }

    ctx.globalAlpha = particle.opacity;

    // 이전 좌표와 연결해 흐름의 궤적을 표시한다.
    if (particle.previousPosition) {
        const previous = particle.previousPosition;

        const dx = x - previous.x;
        const dy = y - previous.y;

        // 화면에서 갑자기 크게 이동한 경우
        // 긴 선이 생기는 것을 방지한다.
        if (Math.hypot(dx, dy) < 45) {
            ctx.beginPath();

            ctx.moveTo(previous.x, previous.y);
            ctx.lineTo(x, y);

            ctx.strokeStyle = fluidConfig.color;
            ctx.lineWidth = 1.2;
            ctx.stroke();
        }
    }

    // 입자 자체를 그린다.
    ctx.beginPath();

    ctx.arc(
        x,
        y,
        particle.size,
        0,
        Math.PI * 2
    );

    ctx.fillStyle = fluidConfig.color;
    ctx.fill();

    particle.previousPosition = { x, y };

    ctx.globalAlpha = 1;
}

// ------------------------------------------
// 10. 애니메이션
// ------------------------------------------

function animateFluid(timestamp) {
    requestAnimationFrame(animateFluid);

    if (!canvas || !ctx) return;

    const viewer = window.viewer;

    if (!viewer || viewer.isDestroyed()) return;

    const aircraftFrame = getAircraftFrame();

    if (!aircraftFrame) return;

    const deltaTime = lastFrameTime
        ? Math.min((timestamp - lastFrameTime) / 1000, 0.04)
        : 0;

    lastFrameTime = timestamp;

    ctx.clearRect(
        0,
        0,
        canvas.clientWidth,
        canvas.clientHeight
    );

    const wind = getWindComponents();

    for (const particle of particles) {
        // 현재 입자 위치에서 유체 흐름 계산
        const flow = calculateFlow(
            particle,
            aircraftFrame,
            wind
        );

        // 입자 이동
        particle.along +=
            flow.along * VISUAL_SPEED_FACTOR * deltaTime;

        particle.side +=
            flow.side * VISUAL_SPEED_FACTOR * deltaTime;

        // 시각화 영역을 벗어나면 앞쪽에서 재생성
        if (
            particle.along < -BACK_LIMIT ||
            particle.along > FRONT_LIMIT + 40 ||
            Math.abs(particle.side) > SIDE_LIMIT
        ) {
            recycleParticle(particle);
        }

        // 비행기 기준 좌표를 화면 좌표로 투영
        const screenPosition = projectParticle(
            particle,
            aircraftFrame
        );

        drawParticle(particle, screenPosition);
    }
}

// ------------------------------------------
// 11. 초기화 및 외부 연결
// ------------------------------------------

window.setFluidWind = setFluidWind;
window.updateFluidColor = updateFluidColor;

createParticles();

requestAnimationFrame(animateFluid);

console.log("[AeroFlow AI] 유체 시각화 모듈 초기화 완료");