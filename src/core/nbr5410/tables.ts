/**
 * Tabelas paramétricas oficiais da ABNT NBR 5410.
 */

// Seções nominais padronizadas de cabos comerciais de cobre (mm²)
export const STANDARD_GAUGES: number[] = [
  1.5, 2.5, 4.0, 6.0, 10.0, 16.0, 25.0, 35.0, 50.0, 70.0, 95.0, 120.0
];

/**
 * Tabela 36 / Método B1:
 * Condutores de cobre com isolação de PVC (70ºC) em eletroduto embutido em alvenaria.
 * Temperatura de referência: 30ºC.
 */
export const AMPACITY_TABLE_B1_COPPER_PVC: Record<number, { twoLoaded: number; threeLoaded: number }> = {
  1.5: { twoLoaded: 17.5, threeLoaded: 15.5 },
  2.5: { twoLoaded: 24.0, threeLoaded: 21.0 },
  4.0: { twoLoaded: 32.0, threeLoaded: 28.0 },
  6.0: { twoLoaded: 41.0, threeLoaded: 36.0 },
  10.0: { twoLoaded: 57.0, threeLoaded: 50.0 },
  16.0: { twoLoaded: 76.0, threeLoaded: 68.0 },
  25.0: { twoLoaded: 101.0, threeLoaded: 89.0 },
  35.0: { twoLoaded: 125.0, threeLoaded: 110.0 },
  50.0: { twoLoaded: 151.0, threeLoaded: 134.0 },
  70.0: { twoLoaded: 192.0, threeLoaded: 171.0 },
  95.0: { twoLoaded: 232.0, threeLoaded: 207.0 },
  120.0: { twoLoaded: 269.0, threeLoaded: 239.0 }
};

/**
 * Tabela 40: Fatores de correção para temperaturas ambientes diferentes de 30ºC.
 */
export const TEMPERATURE_CORRECTION_FACTORS_PVC: Record<number, number> = {
  10: 1.22,
  15: 1.17,
  20: 1.12,
  25: 1.06,
  30: 1.00,
  35: 0.94,
  40: 0.87,
  45: 0.79,
  50: 0.71,
};

/**
 * Tabela 42: Fatores de agrupamento para circuitos no mesmo conduto (FCA).
 */
export const GROUPING_FACTORS: Record<number, number> = {
  1: 1.00,
  2: 0.80,
  3: 0.70,
  4: 0.65,
  5: 0.60,
  6: 0.57,
  7: 0.54,
  8: 0.52,
  9: 0.50,
  12: 0.45,
  16: 0.41,
  20: 0.38
};

export function getGroupingFactor(circuitsCount: number): number {
  if (circuitsCount <= 1) return 1.0;
  if (circuitsCount in GROUPING_FACTORS) return GROUPING_FACTORS[circuitsCount];
  if (circuitsCount <= 9) return 0.50;
  if (circuitsCount <= 12) return 0.45;
  if (circuitsCount <= 16) return 0.41;
  return 0.38;
}

// Disjuntores termomagnéticos padrão DIN (curva C) comerciais (A)
export const STANDARD_BREAKERS: number[] = [
  6, 10, 16, 20, 25, 32, 40, 50, 63, 70, 80, 100, 125
];

// Área total externa aproximada de cabos flexíveis de 750V / PVC (mm²)
export const CABLE_EXTERNAL_AREAS: Record<number, number> = {
  1.5: 7.1,
  2.5: 9.6,
  4.0: 13.8,
  6.0: 18.8,
  10.0: 30.2,
  16.0: 44.2,
  25.0: 69.4,
  35.0: 95.0,
  50.0: 132.7,
  70.0: 176.7,
  95.0: 240.5,
  120.0: 298.6
};

// Área interna útil de eletrodutos corrugados e de PVC rígido (mm²)
export const CONDUIT_INTERNAL_AREAS: Record<number, number> = {
  20: 176.7, // DN 20 (1/2")
  25: 314.1, // DN 25 (3/4")
  32: 530.9, // DN 32 (1")
  40: 855.3, // DN 40 (1 1/4")
  50: 1385.4 // DN 50 (1 1/2")
};
