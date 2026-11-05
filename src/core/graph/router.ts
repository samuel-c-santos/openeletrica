import type { Conduit, ElectricNode } from '../../types/index.ts';

export interface WireIndicator {
  type: 'phase' | 'neutral' | 'earth' | 'return';
  circuitId: number;
  command?: string;
  gaugeMm2: number;
}

export interface ConduitWireAllocation {
  conduitId: string;
  wires: WireIndicator[];
}

interface Edge {
  conduitId: string;
  targetNodeId: string;
  weight: number;
}

/**
 * Grafo topológico da instalação para roteamento automático de fiação.
 */
export class ElectricalGraph {
  private adjacencyList: Map<string, Edge[]> = new Map();
  private nodesMap: Map<string, ElectricNode> = new Map();

  constructor(nodes: ElectricNode[], conduits: Conduit[]) {
    for (const node of nodes) {
      this.nodesMap.set(node.id, node);
      this.adjacencyList.set(node.id, []);
    }

    for (const conduit of conduits) {
      const nodeA = this.nodesMap.get(conduit.nodeAId);
      const nodeB = this.nodesMap.get(conduit.nodeBId);
      if (!nodeA || !nodeB) continue;

      // Distância 3D real incluindo desnível vertical de altura
      const dx = nodeB.position.x - nodeA.position.x;
      const dy = nodeB.position.y - nodeA.position.y;
      const dz = nodeB.position.z - nodeA.position.z;
      const dist = Math.hypot(dx, dy, dz);

      this.adjacencyList.get(conduit.nodeAId)?.push({
        conduitId: conduit.id,
        targetNodeId: conduit.nodeBId,
        weight: dist
      });

      this.adjacencyList.get(conduit.nodeBId)?.push({
        conduitId: conduit.id,
        targetNodeId: conduit.nodeAId,
        weight: dist
      });
    }
  }

  /**
   * Executa o algoritmo de Dijkstra para encontrar o menor caminho entre dois nós.
   * Retorna os IDs dos eletrodutos percorridos em ordem.
   */
  findShortestPath(startNodeId: string, endNodeId: string): string[] | null {
    if (!this.adjacencyList.has(startNodeId) || !this.adjacencyList.has(endNodeId)) {
      return null;
    }

    const distances = new Map<string, number>();
    const previous = new Map<string, { nodeId: string; conduitId: string }>();
    const unvisited = new Set<string>();

    for (const nodeId of this.nodesMap.keys()) {
      distances.set(nodeId, Infinity);
      unvisited.add(nodeId);
    }
    distances.set(startNodeId, 0);

    while (unvisited.size > 0) {
      // Nó não visitado com a menor distância
      let currentId: string | null = null;
      let minDistance = Infinity;

      for (const id of unvisited) {
        const d = distances.get(id) ?? Infinity;
        if (d < minDistance) {
          minDistance = d;
          currentId = id;
        }
      }

      if (currentId === null || minDistance === Infinity) break;
      if (currentId === endNodeId) break;

      unvisited.delete(currentId);

      const neighbors = this.adjacencyList.get(currentId) ?? [];
      for (const edge of neighbors) {
        if (!unvisited.has(edge.targetNodeId)) continue;

        const alt = minDistance + edge.weight;
        if (alt < (distances.get(edge.targetNodeId) ?? Infinity)) {
          distances.set(edge.targetNodeId, alt);
          previous.set(edge.targetNodeId, { nodeId: currentId, conduitId: edge.conduitId });
        }
      }
    }

    // Reconstrói a rota a partir do destino
    const pathConduits: string[] = [];
    let curr = endNodeId;

    while (previous.has(curr)) {
      const step = previous.get(curr)!;
      pathConduits.unshift(step.conduitId);
      curr = step.nodeId;
    }

    return curr === startNodeId ? pathConduits : null;
  }

  /**
   * Roteia a fiação completa do projeto:
   * Aloca Fase, Neutro e Terra do QDC até cada carga, e Retornos entre interruptores e luminárias.
   */
  routeAllWires(panelNodeId: string, circuitGauges: Record<number, number>): Map<string, WireIndicator[]> {
    const allocations = new Map<string, WireIndicator[]>();

    const addWire = (conduitId: string, wire: WireIndicator) => {
      if (!allocations.has(conduitId)) {
        allocations.set(conduitId, []);
      }
      const list = allocations.get(conduitId)!;
      // Evita duplicatas do mesmo condutor no mesmo eletroduto
      const exists = list.some(w =>
        w.circuitId === wire.circuitId &&
        w.type === wire.type &&
        w.command === wire.command
      );
      if (!exists) {
        list.push(wire);
      }
    };

    // 1. Roteia Fase, Neutro e Terra do QDC para cada carga
    for (const node of this.nodesMap.values()) {
      if (node.circuitId === undefined) continue;

      const path = this.findShortestPath(panelNodeId, node.id);
      if (!path) continue;

      const gauge = circuitGauges[node.circuitId] || 2.5;

      for (const conduitId of path) {
        addWire(conduitId, { type: 'phase', circuitId: node.circuitId, gaugeMm2: gauge });
        addWire(conduitId, { type: 'neutral', circuitId: node.circuitId, gaugeMm2: gauge });
        addWire(conduitId, { type: 'earth', circuitId: node.circuitId, gaugeMm2: gauge });
      }
    }

    // 2. Roteia Retornos entre Interruptores e Lâmpadas correspondentes
    const switches = Array.from(this.nodesMap.values()).filter(n =>
      n.type.startsWith('switch_') && n.command
    );

    for (const sw of switches) {
      if (!sw.command || sw.circuitId === undefined) continue;

      // Encontra a lâmpada associada ao mesmo comando
      const matchingLight = Array.from(this.nodesMap.values()).find(n =>
        n.type.startsWith('light_') && n.command === sw.command
      );
      if (!matchingLight) continue;

      const switchPath = this.findShortestPath(sw.id, matchingLight.id);
      if (!switchPath) continue;

      const gauge = circuitGauges[sw.circuitId] || 1.5;

      for (const conduitId of switchPath) {
        addWire(conduitId, {
          type: 'return',
          circuitId: sw.circuitId,
          command: sw.command,
          gaugeMm2: gauge
        });
      }
    }

    return allocations;
  }
}
