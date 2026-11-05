import {
  AMPACITY_TABLE_B1_COPPER_PVC,
  CABLE_EXTERNAL_AREAS,
  CONDUIT_INTERNAL_AREAS,
  getGroupingFactor,
  STANDARD_BREAKERS,
  STANDARD_GAUGES
} from './tables.ts';

export interface SizingInput {
  powerWatts: number;
  voltage: number;
  powerFactor?: number;
  circuitType: 'light' | 'outlet' | 'dedicated' | 'feeder';
  nPhases: 1 | 2 | 3;
  ambientTemperature?: number;
  groupingCircuitsCount?: number;
  lengthMeters: number;
  maxVoltageDropPercent?: number; // Padrão: 4%
}

export interface SizingResult {
  currentIb: number;
  gaugeMm2: number;
  breakerAmperes: number;
  izPrime: number;
  voltageDropPercent: number;
  fca: number;
  conduitDiameterMm: number;
}

/**
 * Calcula a corrente de projeto (Ib) conforme o tipo de sistema elétrico.
 */
export function calculateCurrentIb(
  powerWatts: number,
  voltage: number,
  powerFactor: number = 1.0,
  nPhases: 1 | 2 | 3 = 1
): number {
  if (voltage <= 0 || powerFactor <= 0) return 0;
  if (nPhases === 3) {
    return powerWatts / (Math.sqrt(3) * voltage * powerFactor);
  }
  return powerWatts / (voltage * powerFactor);
}

/**
 * Dimensiona o condutor e a proteção conforme a ABNT NBR 5410.
 */
export function sizeCircuit(input: SizingInput): SizingResult {
  const pf = input.powerFactor ?? (input.circuitType === 'light' ? 1.0 : 0.95);
  const ib = calculateCurrentIb(input.powerWatts, input.voltage, pf, input.nPhases);
  const fca = getGroupingFactor(input.groupingCircuitsCount ?? 1);
  const minGauge = input.circuitType === 'light' ? 1.5 : 2.5; // Item 6.2.6.1.1 NBR 5410

  // 1. Critério da Capacidade de Condução de Corrente (Ampacidade)
  let selectedGauge = minGauge;
  let selectedBreaker = 10;
  let selectedIzPrime = 0;

  for (const gauge of STANDARD_GAUGES) {
    if (gauge < minGauge) continue;
    const tableRow = AMPACITY_TABLE_B1_COPPER_PVC[gauge];
    if (!tableRow) continue;

    const baseIz = input.nPhases === 3 ? tableRow.threeLoaded : tableRow.twoLoaded;
    const izPrime = baseIz * fca;

    // Encontra o disjuntor padrão comercial tal que Ib <= In <= Iz'
    const breaker = STANDARD_BREAKERS.find(b => b >= ib && b <= izPrime);
    if (breaker) {
      selectedGauge = gauge;
      selectedBreaker = breaker;
      selectedIzPrime = izPrime;
      break;
    }
  }

  // 2. Critério da Queda de Tensão (Delta V <= 4%)
  const maxDrop = input.maxVoltageDropPercent ?? 4.0;
  let voltageDrop = calculateVoltageDrop(ib, input.lengthMeters, selectedGauge, input.voltage, input.nPhases, pf);

  // Se a queda de tensão ultrapassar o limite, sobe a bitola progressivamente
  while (voltageDrop > maxDrop) {
    const nextIdx = STANDARD_GAUGES.indexOf(selectedGauge) + 1;
    if (nextIdx >= STANDARD_GAUGES.length) break; // Chegou ao limite de tabela
    selectedGauge = STANDARD_GAUGES[nextIdx];
    voltageDrop = calculateVoltageDrop(ib, input.lengthMeters, selectedGauge, input.voltage, input.nPhases, pf);
  }

  // 3. Dimensionamento de Eletroduto
  const conduitDiameter = sizeConduitForGauges([selectedGauge, selectedGauge, selectedGauge]); // Fase, Neutro, Terra

  return {
    currentIb: Number(ib.toFixed(2)),
    gaugeMm2: selectedGauge,
    breakerAmperes: selectedBreaker,
    izPrime: Number(selectedIzPrime.toFixed(2)),
    voltageDropPercent: Number(voltageDrop.toFixed(2)),
    fca,
    conduitDiameterMm: conduitDiameter
  };
}

/**
 * Calcula a queda de tensão percentual em condutores de cobre a 75ºC.
 */
export function calculateVoltageDrop(
  ib: number,
  lengthMeters: number,
  gaugeMm2: number,
  voltage: number,
  nPhases: 1 | 2 | 3,
  powerFactor: number = 0.95
): number {
  if (voltage <= 0 || gaugeMm2 <= 0) return 0;

  // Resistividade do cobre a 75ºC = 0,021 ohm.mm²/m
  const rho = 0.021;
  const resistance = (rho * lengthMeters) / gaugeMm2;
  const k = nPhases === 3 ? Math.sqrt(3) : 2.0;
  const deltaV = k * ib * resistance * powerFactor;

  return (deltaV / voltage) * 100;
}

/**
 * Dimensiona o eletroduto pela taxa máxima de ocupação da NBR 5410.
 */
export function sizeConduitForGauges(cableGauges: number[]): number {
  if (cableGauges.length === 0) return 20;

  const totalCableArea = cableGauges.reduce((acc, g) => acc + (CABLE_EXTERNAL_AREAS[g] || 10), 0);
  // Taxa de ocupação: 53% (1 cabo), 31% (2 cabos), 40% (>= 3 cabos)
  const maxOccupancyRate = cableGauges.length === 1 ? 0.53 : cableGauges.length === 2 ? 0.31 : 0.40;
  const requiredInternalArea = totalCableArea / maxOccupancyRate;

  const standardConduitSizes = [20, 25, 32, 40, 50];
  for (const size of standardConduitSizes) {
    if (CONDUIT_INTERNAL_AREAS[size] >= requiredInternalArea) {
      return size;
    }
  }
  return 50;
}
