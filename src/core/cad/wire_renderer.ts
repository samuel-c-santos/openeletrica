import type { WireIndicator } from '../graph/router.ts';
import { Vector2D } from '../math/vector2d.ts';
import type { Viewport } from './viewport.ts';
import type { Point2D } from '../../types/index.ts';

/**
 * Renderizador de traçados de condutores (Fase, Neutro, Terra e Retorno) sobre o eletroduto.
 */
export class WireRenderer {
  /**
   * Renderiza o cluster completo de fiação em um ponto do eletroduto.
   */
  static renderWiresOnConduit(
    ctx: CanvasRenderingContext2D,
    startScreen: Point2D,
    endScreen: Point2D,
    wires: WireIndicator[],
    positionT: number = 0.5 // Ponto médio padrão
  ) {
    if (wires.length === 0) return;

    // Vetor diretor da tubulação na tela
    const dir = new Vector2D(endScreen.x - startScreen.x, endScreen.y - startScreen.y);
    const len = dir.length();
    if (len < 20) return; // Tubulação muito curta para desenhar

    const u = dir.normalize(); // Vetor unitário tangente
    const n = u.orthogonal();  // Vetor unitário normal

    // Ponto base na tubulação onde o cluster será desenhado
    const basePt = new Vector2D(
      startScreen.x + (endScreen.x - startScreen.x) * positionT,
      startScreen.y + (endScreen.y - startScreen.y) * positionT
    );

    const wireSpacing = 6; // Espaçamento entre traços sucessivos (px)
    const scale = 0.8;

    ctx.save();
    ctx.strokeStyle = '#0f172a'; // Quase preto
    ctx.lineWidth = 1.6;

    // Agrupa condutores por circuito
    const circuitsMap = new Map<number, WireIndicator[]>();
    for (const w of wires) {
      if (!circuitsMap.has(w.circuitId)) {
        circuitsMap.set(w.circuitId, []);
      }
      circuitsMap.get(w.circuitId)!.push(w);
    }

    let currentOffset = -((wires.length - 1) * wireSpacing) / 2;

    for (const [circuitId, circuitWires] of circuitsMap.entries()) {
      const clusterStartOffset = currentOffset;

      for (const wire of circuitWires) {
        // Posição central deste condutor ao longo da tubulação
        const pt = new Vector2D(basePt.x + u.x * currentOffset, basePt.y + u.y * currentOffset);

        switch (wire.type) {
          case 'phase':
            this.drawPhase(ctx, pt, n, scale);
            break;
          case 'neutral':
            this.drawNeutral(ctx, pt, u, n, scale);
            break;
          case 'earth':
            this.drawEarth(ctx, pt, u, n, scale);
            break;
          case 'return':
            this.drawReturn(ctx, pt, n, scale, wire.command);
            break;
        }

        currentOffset += wireSpacing;
      }

      // Desenha o número do circuito acima do grupo
      const clusterMidOffset = (clusterStartOffset + (currentOffset - wireSpacing)) / 2;
      const textPos = new Vector2D(
        basePt.x + u.x * clusterMidOffset + n.x * (15 * scale),
        basePt.y + u.y * clusterMidOffset + n.y * (15 * scale)
      );

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(circuitId), textPos.x, textPos.y);

      // Se a bitola for diferente de 2.5 mm², exibe abaixo da tubulação
      const gauge = circuitWires[0]?.gaugeMm2;
      if (gauge && gauge !== 2.5) {
        const gaugePos = new Vector2D(
          basePt.x + u.x * clusterMidOffset - n.x * (14 * scale),
          basePt.y + u.y * clusterMidOffset - n.y * (14 * scale)
        );
        ctx.font = '8px sans-serif';
        ctx.fillText(`${gauge}#`, gaugePos.x, gaugePos.y);
      }
    }

    ctx.restore();
  }

  /**
   * Fase: Traço que cruza a tubulação completamente.
   */
  private static drawPhase(ctx: CanvasRenderingContext2D, p: Point2D, n: Vector2D, s: number) {
    const h = 10 * s;
    ctx.beginPath();
    ctx.moveTo(p.x - n.x * h, p.y - n.y * h);
    ctx.lineTo(p.x + n.x * h, p.y + n.y * h);
    ctx.stroke();
  }

  /**
   * Neutro: Traço com bandeira horizontal de 90 graus no topo.
   */
  private static drawNeutral(ctx: CanvasRenderingContext2D, p: Point2D, u: Vector2D, n: Vector2D, s: number) {
    const h = 10 * s;
    const flag = 4 * s;

    // Traço principal
    ctx.beginPath();
    ctx.moveTo(p.x - n.x * h, p.y - n.y * h);
    ctx.lineTo(p.x + n.x * h, p.y + n.y * h);
    // Bandeira no topo
    ctx.moveTo(p.x + n.x * h, p.y + n.y * h);
    ctx.lineTo(p.x + n.x * h + u.x * flag, p.y + n.y * h + u.y * flag);
    ctx.stroke();
  }

  /**
   * Terra: Traço com cruzamento em "T" no topo.
   */
  private static drawEarth(ctx: CanvasRenderingContext2D, p: Point2D, u: Vector2D, n: Vector2D, s: number) {
    const h = 10 * s;
    const bar = 3.5 * s;

    // Traço central
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + n.x * h, p.y + n.y * h);
    // Barra transversal no topo
    ctx.moveTo(p.x + n.x * h - u.x * bar, p.y + n.y * h - u.y * bar);
    ctx.lineTo(p.x + n.x * h + u.x * bar, p.y + n.y * h + u.y * bar);
    ctx.stroke();
  }

  /**
   * Retorno: Meio traço saindo do centro da tubulação.
   */
  private static drawReturn(
    ctx: CanvasRenderingContext2D,
    p: Point2D,
    n: Vector2D,
    s: number,
    command?: string
  ) {
    const h = 9 * s;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + n.x * h, p.y + n.y * h);
    ctx.stroke();

    if (command) {
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(command, p.x + n.x * (h + 6), p.y + n.y * (h + 6));
    }
  }
}
