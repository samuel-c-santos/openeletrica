import type { Conduit, ElectricNode, ElectricNodeType, Point2D } from '../../types/index.ts';
import { ElectricalGraph, type WireIndicator } from '../graph/router.ts';
import { Vector2D } from '../math/vector2d.ts';
import { SnappingEngine, type SnapResult } from './snapping.ts';
import { SymbolRenderer } from './symbols.ts';
import { Viewport } from './viewport.ts';
import { WireRenderer } from './wire_renderer.ts';

export type CadTool = 'select' | 'pan' | 'conduit' | 'add_node';

/**
 * Motor central de interação, renderização e estado do Canvas 2D.
 */
export class CadEngine {
  public viewport: Viewport = new Viewport();
  public snapping: SnappingEngine = new SnappingEngine();

  public nodes: ElectricNode[] = [];
  public conduits: Conduit[] = [];
  public wireAllocations: Map<string, WireIndicator[]> = new Map();

  public activeTool: CadTool = 'select';
  public pendingNodeType: ElectricNodeType = 'outlet_medium';

  public selectedNodeId: string | null = null;
  public conduitStartNodeId: string | null = null;

  public isDragging: boolean = false;
  public isPanning: boolean = false;
  private dragStartScreen: Point2D = { x: 0, y: 0 };
  private dragStartWorld: Point2D = { x: 0, y: 0 };

  public currentSnap: SnapResult = { snapped: false, point: new Vector2D() };

  private onStateChangeCallbacks: (() => void)[] = [];

  constructor() {}

  subscribe(callback: () => void) {
    this.onStateChangeCallbacks.push(callback);
  }

  private notify() {
    for (const cb of this.onStateChangeCallbacks) {
      cb();
    }
  }

  /**
   * Recalcula a rota de fiação em tempo real utilizando o grafo de eletrodutos.
   */
  recalculateWiring() {
    const panel = this.nodes.find(n => n.type === 'distribution_board');
    if (!panel) {
      this.wireAllocations.clear();
      return;
    }

    const graph = new ElectricalGraph(this.nodes, this.conduits);
    this.wireAllocations = graph.routeAllWires(panel.id, { 1: 1.5, 2: 2.5, 3: 4.0 });
  }

  /**
   * Adiciona um novo ponto elétrico no espaço do mundo.
   */
  addNode(type: ElectricNodeType, worldPos: Point2D, circuitId?: number, command?: string): ElectricNode {
    const id = `node_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const newNode: ElectricNode = {
      id,
      type,
      position: { x: worldPos.x, y: worldPos.y, z: type === 'light_ceiling' ? 2.8 : 1.2 },
      rotation: 0,
      powerWatts: type.startsWith('light') ? 100 : 600,
      powerVA: type.startsWith('light') ? 100 : 600,
      powerFactor: 1.0,
      voltage: 127,
      circuitId: circuitId ?? (type.startsWith('light') ? 1 : 2),
      command: command ?? (type.startsWith('light') || type.startsWith('switch') ? 'a' : undefined),
      label: type === 'distribution_board' ? 'QDC' : undefined
    };

    this.nodes.push(newNode);
    this.recalculateWiring();
    this.notify();
    return newNode;
  }

  /**
   * Conecta dois nós através de um novo eletroduto.
   */
  addConduit(nodeAId: string, nodeBId: string, type: 'ceiling' | 'wall' | 'floor' = 'ceiling'): Conduit | null {
    if (nodeAId === nodeBId) return null;

    // Evita eletroduto duplicado entre os mesmos dois nós
    const exists = this.conduits.some(
      c => (c.nodeAId === nodeAId && c.nodeBId === nodeBId) || (c.nodeAId === nodeBId && c.nodeBId === nodeAId)
    );
    if (exists) return null;

    const newConduit: Conduit = {
      id: `conduit_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      nodeAId,
      nodeBId,
      installationType: type,
      diameterMm: 20
    };

    this.conduits.push(newConduit);
    this.recalculateWiring();
    this.notify();
    return newConduit;
  }

  // --- Handlers de Eventos do Mouse ---

  onMouseDown(screenPt: Point2D, button: number) {
    if (button === 1 || this.activeTool === 'pan') {
      // Botão do meio do mouse ou ferramenta Pan
      this.isPanning = true;
      this.dragStartScreen = screenPt;
      return;
    }

    if (button !== 0) return; // Apenas botão esquerdo daqui em diante

    const snap = this.snapping.findSnap(screenPt, this.nodes, this.conduits, this.viewport);
    const worldPos = snap.snapped ? snap.point : this.viewport.screenToWorld(screenPt);

    if (this.activeTool === 'add_node') {
      this.addNode(this.pendingNodeType, worldPos);
      return;
    }

    if (this.activeTool === 'conduit') {
      if (snap.snapped && snap.targetType === 'node' && snap.targetNodeId) {
        if (!this.conduitStartNodeId) {
          // Primeiro clique: seleciona nó inicial
          this.conduitStartNodeId = snap.targetNodeId;
        } else {
          // Segundo clique: conecta ao nó final
          this.addConduit(this.conduitStartNodeId, snap.targetNodeId);
          this.conduitStartNodeId = null;
        }
        this.notify();
      } else {
        // Clicou no vazio, cancela traçado
        this.conduitStartNodeId = null;
      }
      return;
    }

    if (this.activeTool === 'select') {
      if (snap.snapped && snap.targetType === 'node' && snap.targetNodeId) {
        this.selectedNodeId = snap.targetNodeId;
        this.isDragging = true;
        this.dragStartWorld = worldPos;
      } else {
        this.selectedNodeId = null;
      }
      this.notify();
    }
  }

  onMouseMove(screenPt: Point2D) {
    if (this.isPanning) {
      const dx = screenPt.x - this.dragStartScreen.x;
      const dy = screenPt.y - this.dragStartScreen.y;
      this.viewport.panBy(dx, dy);
      this.dragStartScreen = screenPt;
      return;
    }

    if (this.isDragging && this.selectedNodeId) {
      const node = this.nodes.find(n => n.id === this.selectedNodeId);
      if (node) {
        const currentWorld = this.viewport.screenToWorld(screenPt);
        node.position.x = currentWorld.x;
        node.position.y = currentWorld.y;
        this.recalculateWiring();
      }
    }

    // Atualiza o snap sob o cursor
    this.currentSnap = this.snapping.findSnap(screenPt, this.nodes, this.conduits, this.viewport);
  }

  onMouseUp() {
    this.isPanning = false;
    this.isDragging = false;
  }

  onWheel(screenPt: Point2D, deltaY: number) {
    const factor = deltaY < 0 ? 1.15 : 0.85;
    this.viewport.zoomAt(screenPt, factor);
    this.notify();
  }

  /**
   * Ciclo de renderização completo do Canvas.
   */
  render(ctx: CanvasRenderingContext2D, width: number, height: number) {
    ctx.clearRect(0, 0, width, height);

    // 1. Grade de fundo em metros
    this.viewport.renderGrid(ctx, width, height);

    const nodeMap = new Map<string, ElectricNode>(this.nodes.map(n => [n.id, n]));

    // 2. Renderiza Eletrodutos
    for (const conduit of this.conduits) {
      const a = nodeMap.get(conduit.nodeAId);
      const b = nodeMap.get(conduit.nodeBId);
      if (!a || !b) continue;

      const screenA = this.viewport.worldToScreen(a.position);
      const screenB = this.viewport.worldToScreen(b.position);

      ctx.save();
      ctx.strokeStyle = '#0284c7'; // Azul ciano de tubulação
      ctx.lineWidth = 2.2;

      if (conduit.installationType === 'floor') {
        ctx.setLineDash([6, 6]); // Tracejado para tubulação de piso
      } else {
        ctx.setLineDash([]);
      }

      ctx.beginPath();
      ctx.moveTo(screenA.x, screenA.y);
      ctx.lineTo(screenB.x, screenB.y);
      ctx.stroke();
      ctx.restore();

      // 3. Renderiza a fiação no ponto médio do eletroduto
      const wires = this.wireAllocations.get(conduit.id);
      if (wires && wires.length > 0) {
        WireRenderer.renderWiresOnConduit(ctx, screenA, screenB, wires, 0.5);
      }
    }

    // 4. Linha de pré-visualização quando traçando eletroduto
    if (this.activeTool === 'conduit' && this.conduitStartNodeId) {
      const startNode = nodeMap.get(this.conduitStartNodeId);
      if (startNode) {
        const screenStart = this.viewport.worldToScreen(startNode.position);
        const screenEnd = this.currentSnap.snapped
          ? this.viewport.worldToScreen(this.currentSnap.point)
          : this.viewport.worldToScreen(this.currentSnap.point);

        ctx.save();
        ctx.strokeStyle = '#10b981'; // Verde guia
        ctx.lineWidth = 1.8;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(screenStart.x, screenStart.y);
        ctx.lineTo(screenEnd.x, screenEnd.y);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 5. Renderiza Nós Elétricos (Simbologia ABNT)
    for (const node of this.nodes) {
      const isSelected = node.id === this.selectedNodeId;
      SymbolRenderer.renderNode(ctx, node, this.viewport, isSelected);
    }

    // 6. Renderiza Indicador de Snapping
    SnappingEngine.renderSnapIndicator(ctx, this.currentSnap, this.viewport);
  }
}
