import { ElectricalGraph } from './router.ts';
import type { Conduit, ElectricNode } from '../../types/index.ts';

function runRouterTest() {
  console.log('--- Testando Roteador de Fiação em Grafos ---');

  // Nós:
  // 1. QDC (Quadro)
  // 2. Lâmpada (Teto, comando 'a', circuito 1)
  // 3. Interruptor (Parede, comando 'a', circuito 1)
  // 4. Tomada (Parede, circuito 2)

  const nodes: ElectricNode[] = [
    {
      id: 'QDC',
      type: 'distribution_board',
      position: { x: 0, y: 0, z: 1.5 },
      rotation: 0,
      powerWatts: 0,
      powerVA: 0,
      powerFactor: 1,
      voltage: 127
    },
    {
      id: 'LIGHT_A',
      type: 'light_ceiling',
      position: { x: 3, y: 3, z: 2.8 },
      rotation: 0,
      circuitId: 1,
      command: 'a',
      powerWatts: 100,
      powerVA: 100,
      powerFactor: 1,
      voltage: 127
    },
    {
      id: 'SWITCH_A',
      type: 'switch_simple',
      position: { x: 3, y: 0, z: 1.2 },
      rotation: 0,
      circuitId: 1,
      command: 'a',
      powerWatts: 0,
      powerVA: 0,
      powerFactor: 1,
      voltage: 127
    },
    {
      id: 'OUTLET_1',
      type: 'outlet_medium',
      position: { x: 6, y: 3, z: 1.2 },
      rotation: 0,
      circuitId: 2,
      powerWatts: 600,
      powerVA: 600,
      powerFactor: 1,
      voltage: 127
    }
  ];

  // Eletrodutos:
  // E1: QDC -> LIGHT_A
  // E2: LIGHT_A -> SWITCH_A
  // E3: LIGHT_A -> OUTLET_1
  const conduits: Conduit[] = [
    { id: 'E1', nodeAId: 'QDC', nodeBId: 'LIGHT_A', installationType: 'ceiling', diameterMm: 20 },
    { id: 'E2', nodeAId: 'LIGHT_A', nodeBId: 'SWITCH_A', installationType: 'wall', diameterMm: 20 },
    { id: 'E3', nodeAId: 'LIGHT_A', nodeBId: 'OUTLET_1', installationType: 'wall', diameterMm: 20 }
  ];

  const graph = new ElectricalGraph(nodes, conduits);

  // Roteamento
  const wireAllocations = graph.routeAllWires('QDC', { 1: 1.5, 2: 2.5 });

  console.log('Alocação de fiação por eletroduto:');
  for (const [conduitId, wires] of wireAllocations.entries()) {
    const summary = wires.map(w => `${w.type.toUpperCase()}(C${w.circuitId}${w.command ? '-' + w.command : ''})`).join(', ');
    console.log(`  Eletroduto ${conduitId}: ${summary}`);
  }

  // Validações
  const e1 = wireAllocations.get('E1') || [];
  const e2 = wireAllocations.get('E2') || [];
  const e3 = wireAllocations.get('E3') || [];

  // No E1 deve passar alimentação do Circuito 1 e do Circuito 2
  const hasCirc1InE1 = e1.some(w => w.circuitId === 1 && w.type === 'phase');
  const hasCirc2InE1 = e1.some(w => w.circuitId === 2 && w.type === 'phase');

  // No E2 deve passar a Fase do Circuito 1 e o Retorno 'a'
  const hasReturnInE2 = e2.some(w => w.circuitId === 1 && w.type === 'return' && w.command === 'a');

  // No E3 deve passar o Circuito 2 (tomada)
  const hasCirc2InE3 = e3.some(w => w.circuitId === 2);

  if (hasCirc1InE1 && hasCirc2InE1 && hasReturnInE2 && hasCirc2InE3) {
    console.log('  [PASSOU] Grafo e roteamento de fiação funcionaram com precisão total!');
  } else {
    console.error('  [FALHOU] Erro na distribuição de condutores.');
  }
}

runRouterTest();
