let fluidConfig = {
  color: { r: 0.0, g: 0.5, b: 1.0 },
  velocity: 1.0
};

/**
 * AI 위험도 점수(0~100) 수치에 따라 유체 시뮬레이션의 색상 및 파라미터를 변경합니다.
 * @param {number} riskScore - 0 ~ 100 범위의 위험도 점수
 */
function updateFluidColor(riskScore) {
  if (riskScore > 70) {
    // DANGER: 빨강
    fluidConfig.color = { r: 1.0, g: 0.1, b: 0.1 };
    fluidConfig.velocity = 3.5;
    console.log(`[AeroFlow AI] DANGER (Score: ${riskScore}) -> 유체 색상: RED`);
  } else if (riskScore > 40) {
    // CAUTION: 주황
    fluidConfig.color = { r: 1.0, g: 0.6, b: 0.0 };
    fluidConfig.velocity = 2.0;
    console.log(`[AeroFlow AI] CAUTION (Score: ${riskScore}) -> 유체 색상: ORANGE`);
  } else {
    // SAFE: 파랑
    fluidConfig.color = { r: 0.0, g: 0.5, b: 1.0 };
    fluidConfig.velocity = 1.0;
    console.log(`[AeroFlow AI] SAFE (Score: ${riskScore}) -> 유체 색상: BLUE`);
  }
}
