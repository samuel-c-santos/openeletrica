import type { Conduit, ElectricNode, Point2D } from '../../types/index.ts';
import { Vector2D } from '../math/vector2d.ts';
import type { Viewport } from './viewport.ts';

export interface SnapResult {
  snapped: boolean;
  point: Vector2D; // Ponto no espaço do mundo (metros)
  targetType?: 'node' | 'conduit_midpoint' | 'grid';
  targetNodeId?: string;
  targetConduitId?: string;
}

/**
 * Motor de atracamento magnético (Snapping).
 */
export class SnappingEngine {
  public snapTolerancePixels: number = 16; // Raio em pixels na tela

  /**
   * Encontra o ponto de atracamento mais próximo da posição atual do cursor.
   */
  findSnap(
    cursorScreenPt: Point2D,
    nodes: ElectricNode[],
    conduits: Conduit[],
    viewport: Viewport,
    snapToGrid: boolean = false
  ): SnapResult {
    let closestDist = this.snapTolerancePixels;
    let bestSnap: SnapResult = {
      snapped: false,
      point: viewport.screenToWorld(cursorScreenPt)
    };

    // 1. Atracamento aos nós elétricos (Centro da caixa / luminária / tomada)
    for (const node of nodes) {
      const screenPos = viewport.worldToScreen(node.position);
      const dist = screenPos.distanceTo(cursorScreenPt);

      if (dist < closestDist) {
        closestDist = dist;
        bestSnap = {
          snapped: true,
          point: new Vector2D(node.position.x, node.position.y),
          targetType: 'node',
          targetNodeId: node.id
        };
      }
    }

    if (bestSnap.snapped) return bestSnap;

    // 2. Atracamento ao ponto médio de eletrodutos existentes
    const nodeMap = new Map<string, ElectricNode>(nodes.map(n => [n.id, n]));
    for (const conduit of conduits) {
      const a = nodeMap.get(conduit.nodeAId);
      const b = nodeMap.get(conduit.nodeBId);
      if (!a || !b) continue;

      const midWorld = new Vector2D((a.position.x + b.position.x) / 2, (a.position.y + b.position.y) / 2);
      const midScreen = viewport.worldToScreen(midWorld);
      const dist = midScreen.distanceTo(cursorScreenPt);

      if (dist < closestDist) {
        closestDist = dist;
        bestSnap = {
          snapped: true,
          point: midWorld,
          targetType: 'conduit_midpoint',
          targetConduitId: conduit.id
        };
      }
    }

    if (bestSnap.snapped) return bestSnap;

    // 3. Atracamento à grade (Opcional)
    if (snapToGrid) {
      const worldCursor = viewport.screenToWorld(cursorScreenPt);
      const gridStep = 0.5; // Passos de 0.5m
      const snappedGrid = new Vector2D(
        Math.round(worldCursor.x / gridStep) * gridStep,
        Math.round(worldCursor.y / gridStep) * gridStep
      );
      const gridScreen = viewport.worldToScreen(snappedGrid);
      const dist = gridScreen.distanceTo(cursorScreenPt);

      if (dist < this.snapTolerancePixels) {
        return {
          snapped: true,
          point: snappedGrid,
          targetType: 'grid'
        };
      }
    }

    return bestSnap;
  }

  /**
   * Renderiza a mira / guia visual do snap na tela.
   */
  static renderSnapIndicator(ctx: CanvasRenderingContext2D, snap: SnapResult, viewport: Viewport) {
    if (!snap.snapped) return;

    const screenPos = viewport.worldToScreen(snap.point);
    ctx.save();
    ctx.strokeStyle = '#10b981'; // Verde esmeralda brilhante
    ctx.lineWidth = 2;

    if (snap.targetType === 'node') {
      // Círculo com mira para nós
      ctx.beginPath();
      ctx.arc(screenPos.x, screenPos.y, 10, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(screenPos.x - 14, screenPos.y);
      ctx.lineTo(screenPos.x + 14, screenPos.y);
      ctx.moveTo(screenPos.x, screenPos.y - 14);
      ctx.lineTo(screenPos.x, screenPos.y + 14);
      ctx.stroke();
    } else {
      // Losango para ponto médio de tubulação ou grid
      const s = 8;
      ctx.beginPath();
      ctx.moveTo(screenPos.x, screenPos.y - s);
      ctx.lineTo(screenPos.x + s, screenPos.y);
      ctx.lineTo(screenPos.x, screenPos.y + s);
      ctx.lineTo(screenPos.x - s, screenPos.y);
      ctx.closePath();
      ctx.stroke();
    }

    ctx.restore();
  }
}
