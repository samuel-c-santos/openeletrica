import type { Point2D } from '../../types/index.ts';
import { Vector2D } from '../math/vector2d.ts';

export interface ViewportTransform {
  panX: number;
  panY: number;
  zoom: number; // Pixels por metro
}

/**
 * Gerenciador de coordenadas, projeção e zoom/pan do Canvas 2D.
 */
export class Viewport {
  public panX: number = 0;
  public panY: number = 0;
  public zoom: number = 50; // Padrão: 50 pixels por metro (1m = 50px)

  public minZoom: number = 5;
  public maxZoom: number = 500;

  constructor(panX: number = 0, panY: number = 0, zoom: number = 50) {
    this.panX = panX;
    this.panY = panY;
    this.zoom = zoom;
  }

  /**
   * Converte coordenadas de tela (pixels do canvas) para o espaço do mundo (metros).
   */
  screenToWorld(screenPt: Point2D): Vector2D {
    return new Vector2D(
      (screenPt.x - this.panX) / this.zoom,
      (screenPt.y - this.panY) / this.zoom
    );
  }

  /**
   * Converte coordenadas do mundo (metros) para o espaço de tela (pixels).
   */
  worldToScreen(worldPt: Point2D): Vector2D {
    return new Vector2D(
      worldPt.x * this.zoom + this.panX,
      worldPt.y * this.zoom + this.panY
    );
  }

  /**
   * Aplica pan com deslocamento em pixels de tela.
   */
  panBy(deltaX: number, deltaY: number) {
    this.panX += deltaX;
    this.panY += deltaY;
  }

  /**
   * Aplica zoom centrado na posição atual do mouse.
   */
  zoomAt(screenPt: Point2D, factor: number) {
    const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * factor));
    if (newZoom === this.zoom) return;

    // Garante que o ponto do mundo sob o cursor permaneça exatamente sob o cursor
    const worldPt = this.screenToWorld(screenPt);
    this.zoom = newZoom;
    this.panX = screenPt.x - worldPt.x * this.zoom;
    this.panY = screenPt.y - worldPt.y * this.zoom;
  }

  /**
   * Renderiza a grade de fundo adaptativa (grid em metros).
   */
  renderGrid(ctx: CanvasRenderingContext2D, width: number, height: number) {
    ctx.save();

    // Determina o espaçamento da grade conforme o nível de zoom
    let gridSpacingMeters = 1.0;
    if (this.zoom > 150) gridSpacingMeters = 0.5;
    if (this.zoom > 300) gridSpacingMeters = 0.1;
    if (this.zoom < 25) gridSpacingMeters = 5.0;

    const spacingPixels = gridSpacingMeters * this.zoom;

    // Calcula os limites visíveis no mundo
    const topLeft = this.screenToWorld({ x: 0, y: 0 });
    const bottomRight = this.screenToWorld({ x: width, y: height });

    const startX = Math.floor(topLeft.x / gridSpacingMeters) * gridSpacingMeters;
    const endX = Math.ceil(bottomRight.x / gridSpacingMeters) * gridSpacingMeters;
    const startY = Math.floor(topLeft.y / gridSpacingMeters) * gridSpacingMeters;
    const endY = Math.ceil(bottomRight.y / gridSpacingMeters) * gridSpacingMeters;

    // Desenha linhas de grade discretas
    ctx.strokeStyle = '#e2e8f0'; // Cinza claro
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let x = startX; x <= endX; x += gridSpacingMeters) {
      const screenX = x * this.zoom + this.panX;
      ctx.moveTo(screenX, 0);
      ctx.lineTo(screenX, height);
    }

    for (let y = startY; y <= endY; y += gridSpacingMeters) {
      const screenY = y * this.zoom + this.panY;
      ctx.moveTo(0, screenY);
      ctx.lineTo(width, screenY);
    }
    ctx.stroke();

    // Desenha eixos principais (X = 0 e Y = 0)
    const origin = this.worldToScreen({ x: 0, y: 0 });
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(origin.x, 0);
    ctx.lineTo(origin.x, height);
    ctx.moveTo(0, origin.y);
    ctx.lineTo(width, origin.y);
    ctx.stroke();

    ctx.restore();
  }
}
