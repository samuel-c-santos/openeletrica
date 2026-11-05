import { Point2D } from '../../types/index.js';

/**
 * Biblioteca matemática 2D otimizada para o motor de CAD.
 */
export class Vector2D implements Point2D {
  constructor(public x: number = 0, public y: number = 0) {}

  static from(p: Point2D): Vector2D {
    return new Vector2D(p.x, p.y);
  }

  clone(): Vector2D {
    return new Vector2D(this.x, this.y);
  }

  add(v: Point2D): Vector2D {
    this.x += v.x;
    this.y += v.y;
    return this;
  }

  sub(v: Point2D): Vector2D {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }

  mul(scalar: number): Vector2D {
    this.x *= scalar;
    this.y *= scalar;
    return this;
  }

  div(scalar: number): Vector2D {
    if (scalar !== 0) {
      this.x /= scalar;
      this.y /= scalar;
    }
    return this;
  }

  dot(v: Point2D): number {
    return this.x * v.x + this.y * v.y;
  }

  lengthSq(): number {
    return this.x * this.x + this.y * this.y;
  }

  length(): number {
    return Math.hypot(this.x, this.y);
  }

  normalize(): Vector2D {
    const len = this.length();
    return len > 0 ? this.div(len) : this;
  }

  /**
   * Retorna o vetor normal ortogonal (rotacionado 90 graus no sentido anti-horário).
   */
  orthogonal(): Vector2D {
    return new Vector2D(-this.y, this.x);
  }

  distanceTo(v: Point2D): number {
    return Math.hypot(this.x - v.x, this.y - v.y);
  }

  angle(): number {
    return Math.atan2(this.y, this.x);
  }

  rotate(radians: number): Vector2D {
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const rx = this.x * cos - this.y * sin;
    const ry = this.x * sin + this.y * cos;
    this.x = rx;
    this.y = ry;
    return this;
  }
}

/**
 * Calcula a distância euclidiana mínima entre um ponto e um segmento de reta AB.
 */
export function pointSegmentDistance(p: Point2D, a: Point2D, b: Point2D): number {
  const ab = new Vector2D(b.x - a.x, b.y - a.y);
  const ap = new Vector2D(p.x - a.x, p.y - a.y);
  const abLenSq = ab.lengthSq();

  if (abLenSq === 0) return ap.length();

  const t = Math.max(0, Math.min(1, ap.dot(ab) / abLenSq));
  const projection = new Vector2D(a.x + t * ab.x, a.y + t * ab.y);
  return projection.distanceTo(p);
}
