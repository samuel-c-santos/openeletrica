/**
 * Definições fundamentais de tipos para o OpenElétrica.
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface Point3D extends Point2D {
  z: number;
}

export type InstallationHeight = 'low' | 'medium' | 'high' | 'ceiling';

export const HEIGHT_MAP: Record<InstallationHeight, number> = {
  low: 0.30,      // Tomada baixa (0,30m do piso)
  medium: 1.20,   // Interruptores e tomadas médias (1,20m do piso)
  high: 2.10,     // Tomadas altas (chuveiro, ar condicionado)
  ceiling: 2.80,  // Iluminação no teto / laje
};

export type ElectricNodeType =
  | 'outlet_low'
  | 'outlet_medium'
  | 'outlet_high'
  | 'outlet_double'
  | 'outlet_triple'
  | 'light_ceiling'
  | 'light_wall'       // Arandela
  | 'switch_simple'
  | 'switch_three_way' // Paralelo
  | 'switch_four_way'  // Intermediário
  | 'junction_box'     // Caixa de passagem
  | 'distribution_board'; // QDC / Quadro de Distribuição

export interface ElectricNode {
  id: string;
  type: ElectricNodeType;
  position: Point3D;
  rotation: number; // Ângulo em graus
  circuitId?: number; // Vínculo com o circuito do QDC
  command?: string;   // Letra de comando (ex: 'a', 'b', 'c' para interruptor/lâmpada)
  powerWatts: number;
  powerVA: number;
  powerFactor: number;
  voltage: number;
  label?: string;
}

export type ConduitInstallationType = 'ceiling' | 'wall' | 'floor';

export interface Conduit {
  id: string;
  nodeAId: string;
  nodeBId: string;
  installationType: ConduitInstallationType;
  diameterMm: number; // Diâmetro nominal (ex: 20, 25, 32)
  controlPoints?: Point2D[]; // Para eletrodutos curvados (Bézier)
}

export type PhaseType = 'A' | 'B' | 'C' | 'AB' | 'BC' | 'CA' | 'ABC';

export interface Circuit {
  id: number;
  name: string;
  type: 'light' | 'outlet' | 'dedicated' | 'feeder';
  voltage: number;
  phases: PhaseType;
  powerWatts: number;
  powerVA: number;
  currentIb: number;
  gaugeMm2: number;
  breakerAmperes: number;
  voltageDropPercent: number;
  drId?: number;
  groupingCount: number;
  groupingFactorFca: number;
  conduitDiameterMm: number;
}

export interface PanelBoard {
  id: string;
  label: string; // Ex: 'QGBT', 'QD1'
  position: Point3D;
  circuits: Circuit[];
  voltageSystem: string; // Ex: '127/220V', '220/380V'
  utilityCompany: string; // Ex: 'Cemig', 'Enel', 'Neoenergia'
  hasGeneralDr: boolean;
  hasDps: boolean;
}

export interface ProjectState {
  version: string;
  metadata: {
    title: string;
    author: string;
    date: string;
    utilityCompany: string;
    voltageSystem: string;
  };
  scale: {
    pixelsPerMeter: number;
  };
  panels: PanelBoard[];
  nodes: ElectricNode[];
  conduits: Conduit[];
}
