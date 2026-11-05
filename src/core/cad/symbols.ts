import type { ElectricNode } from '../../types/index.ts';
import { Vector2D } from '../math/vector2d.ts';
import type { Viewport } from './viewport.ts';

/**
 * Renderizador de simbologia elétrica predial conforme normas ABNT.
 */
export class SymbolRenderer {
  /**
   * Renderiza um ponto elétrico completo (símbolo + identificadores de circuito/comando/potência).
   */
  static renderNode(
    ctx: CanvasRenderingContext2D,
    node: ElectricNode,
    viewport: Viewport,
    isSelected: boolean = false
  ) {
    const screenPos = viewport.worldToScreen(node.position);
    ctx.save();
    ctx.translate(screenPos.x, screenPos.y);
    ctx.rotate((node.rotation * Math.PI) / 180);

    const radius = 14; // Tamanho fixo legível na tela

    // Efeito de seleção
    if (isSelected) {
      ctx.strokeStyle = '#3b82f6'; // Azul royal
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, radius + 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.strokeStyle = '#0f172a'; // Quase preto (slate-900)
    ctx.fillStyle = '#0f172a';
    ctx.lineWidth = 1.8;

    switch (node.type) {
      case 'distribution_board':
        this.drawDistributionBoard(ctx, node.label || 'QD');
        break;

      case 'light_ceiling':
        this.drawCeilingLight(ctx, radius, node.circuitId, node.powerWatts, node.command);
        break;

      case 'light_wall':
        this.drawWallLight(ctx, radius, node.circuitId, node.command);
        break;

      case 'outlet_low':
        this.drawOutlet(ctx, radius, 'low', node.circuitId, node.powerWatts);
        break;

      case 'outlet_medium':
        this.drawOutlet(ctx, radius, 'medium', node.circuitId, node.powerWatts);
        break;

      case 'outlet_high':
        this.drawOutlet(ctx, radius, 'high', node.circuitId, node.powerWatts);
        break;

      case 'outlet_double':
        this.drawDoubleOutlet(ctx, radius, node.circuitId);
        break;

      case 'switch_simple':
        this.drawSwitch(ctx, radius, 'simple', node.command);
        break;

      case 'switch_three_way':
        this.drawSwitch(ctx, radius, 'three_way', node.command);
        break;

      case 'switch_four_way':
        this.drawSwitch(ctx, radius, 'four_way', node.command);
        break;

      case 'junction_box':
      default:
        this.drawJunctionBox(ctx, radius);
        break;
    }

    ctx.restore();
  }

  /**
   * Quadro de Distribuição de Circuitos (QDC).
   * Retângulo dividido diagonalmente com metade escura e metade clara.
   */
  private static drawDistributionBoard(ctx: CanvasRenderingContext2D, label: string) {
    const w = 36;
    const h = 18;
    ctx.strokeRect(-w / 2, -h / 2, w, h);

    // Metade preenchida
    ctx.beginPath();
    ctx.moveTo(-w / 2, -h / 2);
    ctx.lineTo(w / 2, -h / 2);
    ctx.lineTo(-w / 2, h / 2);
    ctx.closePath();
    ctx.fill();

    // Rótulo
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(label, 0, -h / 2 - 4);
  }

  /**
   * Ponto de iluminação em teto (ABNT).
   * Círculo com divisões de circuito, potência e comando.
   */
  private static drawCeilingLight(
    ctx: CanvasRenderingContext2D,
    r: number,
    circuitId?: number,
    powerWatts?: number,
    command?: string
  ) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    // Linha horizontal e vertical interna formando 4 quadrantes
    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.lineTo(r, 0);
    ctx.moveTo(0, -r);
    ctx.lineTo(0, r);
    ctx.stroke();

    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Número do circuito no quadrante superior
    if (circuitId !== undefined) {
      ctx.fillText(String(circuitId), 0, -r / 2);
    }

    // Potência no quadrante inferior
    if (powerWatts !== undefined && powerWatts > 0) {
      ctx.fillText(`${powerWatts}W`, 0, r / 2);
    }

    // Letra de comando à direita
    if (command) {
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(command, r + 8, 0);
    }
  }

  /**
   * Arandela (Lâmpada de parede).
   */
  private static drawWallLight(
    ctx: CanvasRenderingContext2D,
    r: number,
    circuitId?: number,
    command?: string
  ) {
    ctx.beginPath();
    ctx.arc(0, 0, r, Math.PI, 0); // Semicírculo
    ctx.closePath();
    ctx.stroke();

    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (circuitId !== undefined) {
      ctx.fillText(String(circuitId), 0, -r / 2);
    }
    if (command) {
      ctx.fillText(command, r + 6, -r / 2);
    }
  }

  /**
   * Tomada ABNT (triângulo encostado na linha imaginária).
   * Baixa = Vazia; Média = Metade preenchida; Alta = Totalmente preenchida.
   */
  private static drawOutlet(
    ctx: CanvasRenderingContext2D,
    size: number,
    heightType: 'low' | 'medium' | 'high',
    circuitId?: number,
    powerWatts?: number
  ) {
    const s = size * 0.9;
    ctx.beginPath();
    ctx.moveTo(-s, s / 2);
    ctx.lineTo(0, -s / 2);
    ctx.lineTo(s, s / 2);
    ctx.closePath();
    ctx.stroke();

    if (heightType === 'high') {
      ctx.fill(); // Totalmente preenchida
    } else if (heightType === 'medium') {
      // Metade preenchida
      ctx.beginPath();
      ctx.moveTo(0, -s / 2);
      ctx.lineTo(s, s / 2);
      ctx.lineTo(0, s / 2);
      ctx.closePath();
      ctx.fill();
    }

    // Textos informativos
    ctx.fillStyle = '#0f172a';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';

    if (circuitId !== undefined) {
      ctx.fillText(String(circuitId), 0, s + 10);
    }
    if (powerWatts && powerWatts > 100) {
      ctx.fillText(`${powerWatts}W`, 0, -s / 2 - 4);
    }
  }

  /**
   * Tomada dupla.
   */
  private static drawDoubleOutlet(ctx: CanvasRenderingContext2D, size: number, circuitId?: number) {
    this.drawOutlet(ctx, size, 'medium', circuitId);
    // Desenha uma segunda haste/aba
    ctx.beginPath();
    ctx.moveTo(size * 0.5, size * 0.5);
    ctx.lineTo(size * 0.9, size * 0.5);
    ctx.stroke();
  }

  /**
   * Interruptores ABNT.
   * Simples = Círculo vazio; Three-way = Metade preenchida; Four-way = Em "X".
   */
  private static drawSwitch(
    ctx: CanvasRenderingContext2D,
    r: number,
    type: 'simple' | 'three_way' | 'four_way',
    command?: string
  ) {
    const swR = r * 0.7;
    ctx.beginPath();
    ctx.arc(0, 0, swR, 0, Math.PI * 2);
    ctx.stroke();

    if (type === 'three_way') {
      ctx.beginPath();
      ctx.arc(0, 0, swR, Math.PI / 2, (3 * Math.PI) / 2);
      ctx.closePath();
      ctx.fill();
    } else if (type === 'four_way') {
      ctx.beginPath();
      ctx.moveTo(-swR * 0.7, -swR * 0.7);
      ctx.lineTo(swR * 0.7, swR * 0.7);
      ctx.moveTo(-swR * 0.7, swR * 0.7);
      ctx.lineTo(swR * 0.7, -swR * 0.7);
      ctx.stroke();
    }

    // Letra de comando
    if (command) {
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(command, 0, -swR - 8);
    }
  }

  /**
   * Caixa de passagem.
   */
  private static drawJunctionBox(ctx: CanvasRenderingContext2D, r: number) {
    const s = r * 0.8;
    ctx.strokeRect(-s / 2, -s / 2, s, s);
  }
}
