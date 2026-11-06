/**
 * OpenElétrica — Motor 2D CAD e Dimensionamento NBR 5410 (Standalone ESM)
 * Arquitetura gráfica profissional com paredes, eletrodutos curvos e simbologia ABNT.
 */

// ==================== MATEMÁTICA VETORIAL ====================
export class Vector2D {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  clone() {
    return new Vector2D(this.x, this.y);
  }

  add(v) {
    this.x += v.x;
    this.y += v.y;
    return this;
  }

  sub(v) {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }

  mul(s) {
    this.x *= s;
    this.y *= s;
    return this;
  }

  multiply(s) {
    return this.mul(s);
  }

  div(s) {
    if (s !== 0) {
      this.x /= s;
      this.y /= s;
    }
    return this;
  }

  dot(v) {
    return this.x * v.x + this.y * v.y;
  }

  length() {
    return Math.hypot(this.x, this.y);
  }

  normalize() {
    const len = this.length();
    return len > 0 ? this.div(len) : this;
  }

  orthogonal() {
    return new Vector2D(-this.y, this.x);
  }

  angle() {
    return Math.atan2(this.y, this.x);
  }

  distanceTo(v) {
    return Math.hypot(this.x - v.x, this.y - v.y);
  }

  static projectOnSegment(p, a, b) {
    const ab = new Vector2D(b.x - a.x, b.y - a.y);
    const lenSq = ab.x * ab.x + ab.y * ab.y;
    if (lenSq === 0) return { point: new Vector2D(a.x, a.y), t: 0, distance: Math.hypot(p.x - a.x, p.y - a.y) };
    const ap = new Vector2D(p.x - a.x, p.y - a.y);
    let t = (ap.x * ab.x + ap.y * ab.y) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const proj = new Vector2D(a.x + ab.x * t, a.y + ab.y * t);
    return { point: proj, t, distance: Math.hypot(p.x - proj.x, p.y - proj.y) };
  }
}

export function lineIntersect(p1, d1, p2, d2) {
  const cross = d1.x * d2.y - d1.y * d2.x;
  if (Math.abs(cross) < 1e-4) return null;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const t = (dx * d2.y - dy * d2.x) / cross;
  return new Vector2D(p1.x + t * d1.x, p1.y + t * d1.y);
}

// ==================== TABELAS & DIMENSIONAMENTO NBR 5410 ====================
export const STANDARD_GAUGES = [1.5, 2.5, 4.0, 6.0, 10.0, 16.0, 25.0, 35.0, 50.0];
export const STANDARD_BREAKERS = [6, 10, 16, 20, 25, 32, 40, 50, 63, 70, 80];

export const AMPACITY_B1_COPPER_PVC = {
  1.5: { two: 17.5, three: 15.5 },
  2.5: { two: 24.0, three: 21.0 },
  4.0: { two: 32.0, three: 28.0 },
  6.0: { two: 41.0, three: 36.0 },
  10.0: { two: 57.0, three: 50.0 },
  16.0: { two: 76.0, three: 68.0 },
  25.0: { two: 101.0, three: 89.0 }
};

export const GROUPING_FACTORS = {
  1: 1.0, 2: 0.8, 3: 0.7, 4: 0.65, 5: 0.6, 6: 0.57, 7: 0.54, 8: 0.52, 9: 0.5
};

export function sizeCircuit(input) {
  const pf = input.powerFactor || (input.circuitType === 'light' ? 1.0 : 0.95);
  const v = input.voltage || 127;
  const ib = input.powerWatts / (v * pf);
  const minGauge = input.circuitType === 'light' ? 1.5 : 2.5;
  const fca = GROUPING_FACTORS[input.groupingCircuitsCount || 1] || 0.7;

  let selectedGauge = minGauge;
  let selectedBreaker = 10;
  let selectedIzPrime = 0;

  for (const g of STANDARD_GAUGES) {
    if (g < minGauge) continue;
    const row = AMPACITY_B1_COPPER_PVC[g];
    if (!row) continue;
    const baseIz = input.nPhases === 3 ? row.three : row.two;
    const izPrime = baseIz * fca;

    const breaker = STANDARD_BREAKERS.find(b => b >= ib && b <= izPrime);
    if (breaker) {
      selectedGauge = g;
      selectedBreaker = breaker;
      selectedIzPrime = izPrime;
      break;
    }
  }

  const rho = 0.021;
  const r = (rho * (input.lengthMeters || 15)) / selectedGauge;
  const deltaV = ((2 * ib * r * pf) / v) * 100;

  return {
    currentIb: Number(ib.toFixed(2)),
    gaugeMm2: selectedGauge,
    breakerAmperes: selectedBreaker,
    izPrime: Number(selectedIzPrime.toFixed(2)),
    voltageDropPercent: Number(deltaV.toFixed(2)),
    conduitDiameterMm: selectedGauge >= 4.0 ? 25 : 20
  };
}

// ==================== GRAFO & ROTEAMENTO ====================
export class ElectricalGraph {
  constructor(nodes, conduits) {
    this.nodesMap = new Map(nodes.map(n => [n.id, n]));
    this.adj = new Map();
    for (const n of nodes) this.adj.set(n.id, []);

    for (const c of conduits) {
      const a = this.nodesMap.get(c.nodeAId);
      const b = this.nodesMap.get(c.nodeBId);
      if (!a || !b) continue;

      const dist = Math.hypot(b.position.x - a.position.x, b.position.y - a.position.y);
      this.adj.get(c.nodeAId)?.push({ conduitId: c.id, target: c.nodeBId, weight: dist });
      this.adj.get(c.nodeBId)?.push({ conduitId: c.id, target: c.nodeAId, weight: dist });
    }
  }

  findShortestPath(startId, endId) {
    if (!this.adj.has(startId) || !this.adj.has(endId)) return null;

    const distances = new Map();
    const previous = new Map();
    const unvisited = new Set(this.nodesMap.keys());

    for (const id of this.nodesMap.keys()) distances.set(id, Infinity);
    distances.set(startId, 0);

    while (unvisited.size > 0) {
      let currentId = null;
      let minD = Infinity;

      for (const id of unvisited) {
        const d = distances.get(id);
        if (d < minD) {
          minD = d;
          currentId = id;
        }
      }

      if (currentId === null || minD === Infinity || currentId === endId) break;
      unvisited.delete(currentId);

      for (const edge of this.adj.get(currentId) || []) {
        if (!unvisited.has(edge.target)) continue;
        const alt = minD + edge.weight;
        if (alt < distances.get(edge.target)) {
          distances.set(edge.target, alt);
          previous.set(edge.target, { node: currentId, conduitId: edge.conduitId });
        }
      }
    }

    const path = [];
    let curr = endId;
    while (previous.has(curr)) {
      const step = previous.get(curr);
      path.unshift(step.conduitId);
      curr = step.node;
    }
    return curr === startId ? path : null;
  }

  routeAllWires(panelId, gauges) {
    const allocations = new Map();

    const addWire = (conduitId, wire) => {
      if (!allocations.has(conduitId)) allocations.set(conduitId, []);
      const list = allocations.get(conduitId);
      const exists = list.some(w => w.circuitId === wire.circuitId && w.type === wire.type && w.command === wire.command);
      if (!exists) list.push(wire);
    };

    // 1. Alimentação dos Nós a partir do Quadro de Distribuição
    for (const node of this.nodesMap.values()) {
      if (node.type === 'distribution_board') continue;

      // Dispositivos Conjugados com Módulos Internos (NBR 5410)
      if ((node.type === 'combo_switch_outlet' || node.type === 'combo_switch_switch' || node.type === 'gang_box') && Array.isArray(node.modules)) {
        for (const mod of node.modules) {
          const cId = mod.circuitId || node.circuitId || 1;
          const path = this.findShortestPath(panelId, node.id);
          if (!path) continue;
          const gauge = gauges[cId] || 2.5;
          const isSwitch = mod.type.startsWith('switch');

          for (const cid of path) {
            addWire(cid, { type: 'phase', circuitId: cId, gaugeMm2: gauge });
            if (!isSwitch) {
              addWire(cid, { type: 'neutral', circuitId: cId, gaugeMm2: gauge });
              addWire(cid, { type: 'earth', circuitId: cId, gaugeMm2: gauge });
            }
          }
        }
        continue;
      }

      if (node.circuitId === undefined) continue;
      const path = this.findShortestPath(panelId, node.id);
      if (!path) continue;
      const gauge = gauges[node.circuitId] || 2.5;
      const isSwitch = node.type.startsWith('switch_');

      for (const cid of path) {
        addWire(cid, { type: 'phase', circuitId: node.circuitId, gaugeMm2: gauge });
        if (!isSwitch) {
          // Conforme NBR 5410, interruptores não recebem condutor neutro nem condutor de proteção (terra)
          addWire(cid, { type: 'neutral', circuitId: node.circuitId, gaugeMm2: gauge });
          addWire(cid, { type: 'earth', circuitId: node.circuitId, gaugeMm2: gauge });
        }
      }
    }

    // 2. Retornos de Comandos de Iluminação (Interruptores -> Luminárias)
    const switchItems = [];
    for (const node of this.nodesMap.values()) {
      if (node.type.startsWith('switch_') && node.command) {
        switchItems.push({ id: node.id, circuitId: node.circuitId || 1, command: node.command });
      } else if ((node.type === 'combo_switch_outlet' || node.type === 'combo_switch_switch' || node.type === 'gang_box') && Array.isArray(node.modules)) {
        for (const mod of node.modules) {
          if (mod.type.startsWith('switch') && mod.command) {
            switchItems.push({ id: node.id, circuitId: mod.circuitId || node.circuitId || 1, command: mod.command });
          }
        }
      }
    }

    for (const sw of switchItems) {
      const lights = Array.from(this.nodesMap.values()).filter(n => n.type.startsWith('light_') && n.command === sw.command);
      for (const light of lights) {
        const path = this.findShortestPath(sw.id, light.id);
        if (!path) continue;
        const gauge = gauges[sw.circuitId] || 1.5;

        for (const cid of path) {
          addWire(cid, { type: 'return', circuitId: sw.circuitId, command: sw.command, gaugeMm2: gauge });
        }
      }
    }

    return allocations;
  }
}

// ==================== VIEWPORT & COORDENADAS ====================
export class Viewport {
  constructor(panX = 60, panY = 50, zoom = 55) {
    this.panX = panX;
    this.panY = panY;
    this.zoom = zoom; // Pixels por metro
  }

  screenToWorld(p) {
    return new Vector2D((p.x - this.panX) / this.zoom, (p.y - this.panY) / this.zoom);
  }

  worldToScreen(p) {
    return new Vector2D(p.x * this.zoom + this.panX, p.y * this.zoom + this.panY);
  }

  panBy(dx, dy) {
    this.panX += dx;
    this.panY += dy;
  }

  zoomAt(screenPt, factor) {
    const newZoom = Math.max(10, Math.min(300, this.zoom * factor));
    if (newZoom === this.zoom) return;
    const worldPt = this.screenToWorld(screenPt);
    this.zoom = newZoom;
    this.panX = screenPt.x - worldPt.x * this.zoom;
    this.panY = screenPt.y - worldPt.y * this.zoom;
  }

  renderGrid(ctx, w, h) {
    ctx.save();
    let subStep = 0.2;
    let mainStep = 1.0;

    if (this.zoom > 100) { subStep = 0.1; mainStep = 0.5; }
    if (this.zoom < 35) { subStep = 1.0; mainStep = 5.0; }

    const tl = this.screenToWorld({ x: 0, y: 0 });
    const br = this.screenToWorld({ x: w, y: h });

    const startX = Math.floor(tl.x / subStep) * subStep;
    const endX = Math.ceil(br.x / subStep) * subStep;
    const startY = Math.floor(tl.y / subStep) * subStep;
    const endY = Math.ceil(br.y / subStep) * subStep;

    // Grade milimetrada de fundo
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = startX; x <= endX; x += subStep) {
      const sx = x * this.zoom + this.panX;
      ctx.moveTo(sx, 0); ctx.lineTo(sx, h);
    }
    for (let y = startY; y <= endY; y += subStep) {
      const sy = y * this.zoom + this.panY;
      ctx.moveTo(0, sy); ctx.lineTo(w, sy);
    }
    ctx.stroke();

    // Linhas mestras de 1m
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    const startMainX = Math.floor(tl.x / mainStep) * mainStep;
    const endMainX = Math.ceil(br.x / mainStep) * mainStep;
    const startMainY = Math.floor(tl.y / mainStep) * mainStep;
    const endMainY = Math.ceil(br.y / mainStep) * mainStep;

    for (let x = startMainX; x <= endMainX; x += mainStep) {
      const sx = x * this.zoom + this.panX;
      ctx.moveTo(sx, 0); ctx.lineTo(sx, h);
    }
    for (let y = startMainY; y <= endMainY; y += mainStep) {
      const sy = y * this.zoom + this.panY;
      ctx.moveTo(0, sy); ctx.lineTo(w, sy);
    }
    ctx.stroke();

    ctx.restore();
  }
}

// ==================== SIMBOLOGIA ABNT PROFISSIONAL ====================
export class SymbolRenderer {
  static renderNode(ctx, node, viewport, isSelected) {
    const s = viewport.worldToScreen(node.position);
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate((node.rotation * Math.PI) / 180);

    const r = 13;

    if (isSelected) {
      ctx.strokeStyle = '#0284c7';
      ctx.fillStyle = 'rgba(2, 132, 199, 0.15)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, r + 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Rótulo Deslocado de Ponto Elétrico (Chamada de Detalhe conforme NBR 6492)
    if (node.labelOffset && (Math.abs(node.labelOffset.x) > 0.05 || Math.abs(node.labelOffset.y) > 0.05)) {
      const zoom = viewport.zoom;
      const offX = node.labelOffset.x * zoom;
      const offY = node.labelOffset.y * zoom;

      ctx.save();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.0;
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(offX, offY);
      ctx.stroke();

      let tag = `C${node.circuitId || 1}`;
      if (node.command) tag += ` • ${node.command}`;
      if (node.powerWatts) tag += ` (${node.powerWatts}W)`;

      ctx.font = 'bold 8.5px Arial, sans-serif';
      const tw = ctx.measureText(tag).width;
      const bw = tw + 10;
      const bh = 17;

      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = isSelected ? '#0284c7' : '#94a3b8';
      ctx.lineWidth = isSelected ? 1.6 : 1.0;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.roundRect(offX - bw / 2, offY - bh / 2, bw, bh, 3);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isSelected ? '#0284c7' : '#0f172a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tag, offX, offY);

      if (isSelected) {
        ctx.fillStyle = '#0284c7';
        ctx.beginPath();
        ctx.arc(offX, offY - bh / 2 - 4, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.strokeStyle = '#000000';
    ctx.fillStyle = '#000000';
    ctx.lineWidth = 1.6;

    switch (node.type) {
      case 'distribution_board': {
        const bw = 32, bh = 16;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
        ctx.strokeRect(-bw / 2, -bh / 2, bw, bh);

        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.moveTo(-bw / 2, -bh / 2);
        ctx.lineTo(bw / 2, -bh / 2);
        ctx.lineTo(-bw / 2, bh / 2);
        ctx.closePath();
        ctx.fill();

        ctx.font = 'bold 10px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(node.label || 'QD', 0, -bh / 2 - 3);
        break;
      }
      case 'light_ceiling': {
        const cr = r + 2;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, cr, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Linha horizontal dividindo o círculo ao meio
        ctx.beginPath();
        ctx.moveTo(-cr, 0); ctx.lineTo(cr, 0);
        // Linha vertical dividindo APENAS a metade inferior (esq/dir)
        ctx.moveTo(0, 0); ctx.lineTo(0, cr);
        ctx.stroke();

        ctx.fillStyle = '#000000';

        // Metade superior inteira: Potência em Watts / VA
        ctx.font = 'bold 8px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const pwr = node.powerWatts ? `${node.powerWatts}W` : '100W';
        ctx.fillText(pwr, 0, -cr * 0.48);

        // Metade inferior esquerda: Número do circuito (com respiro e sem colisão)
        ctx.font = 'bold 8px Arial, sans-serif';
        ctx.fillText(String(node.circuitId || 1), -cr * 0.50, cr * 0.52);

        // Metade inferior direita: Letra do comando / interruptor (com respiro e sem colisão)
        ctx.font = 'bold 8px Arial, sans-serif';
        ctx.fillText(node.command || 'a', cr * 0.50, cr * 0.52);
        break;
      }
      case 'outlet_low':
      case 'outlet_medium':
      case 'outlet_high': {
        const sz = r * 0.9;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(-sz, sz / 2);
        ctx.lineTo(0, -sz / 2);
        ctx.lineTo(sz, sz / 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        if (node.type === 'outlet_high') {
          ctx.fillStyle = '#000000';
          ctx.fill();
        } else if (node.type === 'outlet_medium') {
          ctx.fillStyle = '#000000';
          ctx.beginPath();
          ctx.moveTo(0, -sz / 2);
          ctx.lineTo(sz, sz / 2);
          ctx.lineTo(0, sz / 2);
          ctx.closePath();
          ctx.fill();
        }

        ctx.fillStyle = '#000000';
        ctx.font = 'bold 9px Arial, sans-serif';
        ctx.textAlign = 'center';
        if (node.circuitId) ctx.fillText(String(node.circuitId), 0, sz + 9);
        if (node.powerWatts && node.powerWatts > 100) {
          ctx.font = '8px Arial, sans-serif';
          ctx.fillText(`${node.powerWatts}W`, 0, -sz / 2 - 4);
        }
        break;
      }
      case 'switch_simple':
      case 'switch_three_way': {
        const swR = r * 0.65;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, swR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        if (node.type === 'switch_three_way') {
          ctx.fillStyle = '#000000';
          ctx.beginPath();
          ctx.arc(0, 0, swR, Math.PI / 2, (3 * Math.PI) / 2);
          ctx.closePath();
          ctx.fill();
        }

        if (node.command) {
          ctx.fillStyle = '#000000';
          ctx.font = 'bold 10px Arial, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(node.command, 0, -swR - 7);
        }
        break;
      }
      case 'combo_switch_outlet': {
        // Dispositivo conjugado NBR 5410 e NBR 6492: Interruptor + Tomada Média (1,20m)
        const swR = r * 0.55;
        const sz = r * 0.75;
        const swMod = node.modules?.[0] || { command: node.command || 'a', circuitId: node.circuitId || 1 };
        const outMod = node.modules?.[1] || { circuitId: 2, powerWatts: node.powerWatts || 600 };

        // 1. Interruptor Simples à esquerda
        ctx.save();
        ctx.translate(-r * 0.55, 0);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, swR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        if (swMod.command) {
          ctx.fillStyle = '#000000';
          ctx.font = 'bold 9px Arial, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(swMod.command, 0, -swR - 6);
        }
        ctx.restore();

        // 2. Tomada Média à direita (semi-preenchida conforme NBR 6492)
        ctx.save();
        ctx.translate(r * 0.55, 0);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(-sz, sz / 2);
        ctx.lineTo(0, -sz / 2);
        ctx.lineTo(sz, sz / 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.moveTo(0, -sz / 2);
        ctx.lineTo(sz, sz / 2);
        ctx.lineTo(0, sz / 2);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#000000';
        ctx.font = 'bold 9px Arial, sans-serif';
        ctx.textAlign = 'center';
        if (outMod.circuitId) ctx.fillText(String(outMod.circuitId), 0, sz + 8);
        ctx.restore();
        break;
      }
      case 'combo_switch_switch': {
        // Interruptor de 2 Seções / 2 Teclas (NBR 6492)
        const swR = r * 0.75;
        const cmdA = node.modules?.[0]?.command || 'a';
        const cmdB = node.modules?.[1]?.command || 'b';

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, swR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Linha divisória vertical representando as 2 teclas
        ctx.beginPath();
        ctx.moveTo(0, -swR);
        ctx.lineTo(0, swR);
        ctx.stroke();

        ctx.fillStyle = '#000000';
        ctx.font = 'bold 9px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(cmdA, -swR * 0.45, 0);
        ctx.fillText(cmdB, swR * 0.45, 0);

        if (node.circuitId) {
          ctx.font = 'bold 8px Arial, sans-serif';
          ctx.fillText(String(node.circuitId), 0, swR + 7);
        }
        break;
      }
      default:
        ctx.strokeRect(-8, -8, 16, 16);
        break;
    }

    ctx.restore();
  }
}

// ==================== RENDERIZADOR DE FIAÇÃO ====================
export class WireRenderer {
  static renderWiresOnConduit(ctx, sA, sB, ctrlPt, wires, t = 0.5, side = 1, isSelected = false) {
    if (!wires || wires.length === 0) return;

    const mt = 1 - t;
    const px = mt * mt * sA.x + 2 * mt * t * ctrlPt.x + t * t * sB.x;
    const py = mt * mt * sA.y + 2 * mt * t * ctrlPt.y + t * t * sB.y;
    const base = new Vector2D(px, py);

    const tx = 2 * mt * (ctrlPt.x - sA.x) + 2 * t * (sB.x - ctrlPt.x);
    const ty = 2 * mt * (ctrlPt.y - sA.y) + 2 * t * (sB.y - ctrlPt.y);
    const dir = new Vector2D(tx, ty);
    const len = dir.length();
    if (len < 5) return;

    const u = dir.normalize();
    // Multiplica pela orientação de lado do eletroduto (side: +1 ou -1)
    const n = u.orthogonal().mul(side || 1);

    const spacing = 6;
    const sc = 0.85;

    ctx.save();

    if (isSelected) {
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 2.0;
      ctx.shadowColor = 'rgba(2, 132, 199, 0.35)';
      ctx.shadowBlur = 6;
    } else {
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5;
    }

    const totalWidth = (wires.length - 1) * spacing;
    let offset = -totalWidth / 2;

    for (const w of wires) {
      const p = new Vector2D(base.x + u.x * offset, base.y + u.y * offset);
      const h = 9 * sc;

      if (w.type === 'phase') {
        ctx.beginPath();
        ctx.moveTo(p.x - n.x * h, p.y - n.y * h);
        ctx.lineTo(p.x + n.x * h, p.y + n.y * h);
        ctx.stroke();
      } else if (w.type === 'neutral') {
        const flag = 4 * sc;
        ctx.beginPath();
        ctx.moveTo(p.x - n.x * h, p.y - n.y * h);
        ctx.lineTo(p.x + n.x * h, p.y + n.y * h);
        ctx.moveTo(p.x + n.x * h, p.y + n.y * h);
        ctx.lineTo(p.x + n.x * h + u.x * flag, p.y + n.y * h + u.y * flag);
        ctx.stroke();
      } else if (w.type === 'earth') {
        const bar = 3 * sc;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + n.x * h, p.y + n.y * h);
        ctx.moveTo(p.x + n.x * h - u.x * bar, p.y + n.y * h - u.y * bar);
        ctx.lineTo(p.x + n.x * h + u.x * bar, p.y + n.y * h + u.y * bar);
        ctx.stroke();
      } else if (w.type === 'return') {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + n.x * (h * 0.9), p.y + n.y * (h * 0.9));
        ctx.stroke();
        if (w.command) {
          ctx.fillStyle = isSelected ? '#0284c7' : '#000000';
          ctx.font = 'bold 8.5px Arial, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(w.command, p.x + n.x * (h + 6), p.y + n.y * (h + 6));
        }
      }
      offset += spacing;
    }

    // Número do Circuito posicionado no lado OPOSTO da tubulação (-n)
    // Isso garante que o número do circuito NUNCA sobreponha as letras de comando de retorno (como '1' e 'e')
    const circIds = [...new Set(wires.map(w => w.circuitId).filter(Boolean))].join(',');
    if (circIds) {
      const labelPos = new Vector2D(base.x - n.x * (11 * sc), base.y - n.y * (11 * sc));
      ctx.fillStyle = isSelected ? '#0284c7' : '#000000';
      ctx.font = 'bold 9px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(circIds, labelPos.x, labelPos.y);
    }

    // Alça visual sutil indicando possibilidade de arrasto quando selecionado
    if (isSelected) {
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1.0;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(base.x - totalWidth / 2 - 8, base.y - 14, totalWidth + 16, 28);
    }

    ctx.restore();
  }
}

// ==================== MOTOR CAD CENTRAL ====================
export class CadEngine {
  constructor() {
    this.viewport = new Viewport();
    this.nodes = [];
    this.conduits = [];
    this.walls = [];
    this.rooms = [];
    this.doors = [];
    this.windows = [];
    this.dimensions = []; // Cotas lineares e alinhadas técnicas (NBR 6492)
    this.dimStartPoint = null; // 1º ponto de inserção de cota (Origem)
    this.dimEndPoint = null;   // 2º ponto de inserção de cota (Destino)
    this.dimPendingOffset = 0.40; // Offset perpendicular dinâmico da cota
    this.dimStage = 0;         // 0: aguardando P1, 1: aguardando P2, 2: posicionando offset dinâmico
    this.dimensionSnapMode = 'faces'; // 'faces' | 'axes' | 'all' (Atracamento preferencial em faces que delimitam os ambientes)
    this.typedLength = '';     // Buffer de entrada direta de comprimento de parede
    this.draggedWallVertices = []; // Vértices coincidentes arrastados em grupo para manter quinas fechadas
    this.roomDividers = [];
    this.wireAllocations = new Map();

    this.activeTool = 'select';
    this.pendingNodeType = 'outlet_medium';
    this.selectedNodeId = null;
    this.selectedElement = null; // { type: 'node' | 'wall' | 'door' | 'window' | 'room' | 'unifilar' | 'dimension' | 'multi', ... }
    this.selectedElements = []; // Itens selecionados em massa via janela retangular
    this.conduitStartNodeId = null;

    this.isPlanLocked = false; // Inicia destravada para edição imediata de paredes, portas e pontos
    this.isPaperSpace = false; // Suprime grips, halos e caixas de seleção na impressão/layout
    this.isSelectingBox = false; // Seleção em massa por retângulo ativo
    this.selectionBoxStart = null;
    this.selectionBoxCurrent = null;
    this.wallStartPoint = null; // Início de parede contínua
    this.currentWallThickness = 0.15; // 15cm padrão
    this.currentDoorWidth = 0.80; // 0.80m padrão
    this.currentDoorType = 'abrir'; // 'abrir' | 'pivotante' | 'embutida' | 'correr' | 'articulada' | 'sanfonada' (NBR 6492)
    this.currentWindowWidth = 1.20; // 1.20m padrão
    this.currentRoomName = 'SALA DE ESTAR';
    this.doorOrientationIndex = 0; // 0..3 (4 posições: esq/dentro, dir/dentro, dir/fora, esq/fora)
    this.sldPosition = { x: 11.2, y: 2.2 }; // Posição móvel do Diagrama Unifilar
    this.wiringWarnings = []; // Alertas normativos NBR 5410

    // Modo da aplicação: 'model' (CAD 2D) ou 'layout' (Compositor de Prancha QGIS/ABNT)
    this.mode = 'model';
    this.layoutConfig = {
      sheetSize: 'A1',
      scale: 50,
      orientation: 'landscape',
      title: 'PROJETO DE INSTALAÇÕES ELÉTRICAS RESIDENCIAIS',
      owner: 'PROPRIETÁRIO EXEMPLO',
      address: 'RUA DAS PALMEIRAS, Nº 100, BAIRRO CENTRO',
      engineer: 'ENG. ELETRICISTA RESPONSÁVEL',
      crea: 'CREA-SP 5061234567/D',
      date: '05/11/2026',
      sheetNumber: '01/01',
      viewportItem: { x: 25, y: 20, w: 560, h: 420 },
      isMovingContent: false
    };

    this.circuits = [
      { id: 1, desc: 'Iluminação Sala / Terraço', panel: 'QD1', v: 127, w: 200, type: 'light', phase: 'A', breaker: 10, dr: 'Geral 30mA' },
      { id: 2, desc: 'TUGs Sala Comercial', panel: 'QD1', v: 127, w: 1200, type: 'outlet', phase: 'B', breaker: 20, dr: 'Geral 30mA' },
      { id: 3, desc: 'TUE - Chuveiro Elétrico', panel: 'QD1', v: 220, w: 5500, type: 'outlet', phase: 'AB', breaker: 25, dr: 'DDR 30mA' },
      { id: 4, desc: 'TUGs Cozinha / Área', panel: 'QD1', v: 127, w: 1800, type: 'outlet', phase: 'C', breaker: 20, dr: 'Geral 30mA' },
      { id: 5, desc: 'Iluminação Circulação', panel: 'QD1', v: 127, w: 100, type: 'light', phase: 'B', breaker: 10, dr: 'Geral 30mA' }
    ];

    this.panels = [
      { id: 'QD1', name: 'QD1 - Quadro Geral de Distribuição', location: 'Circulação', mainBreaker: 40, phases: 'Trifásico (3F+N+T)' }
    ];

    this.viewport.panX = 70;
    this.viewport.panY = 40;
    this.viewport.zoom = 52;

    this.projectMeta = {
      title: 'PROJETO ELÉTRICO RESIDENCIAL - UNIFAMILIAR',
      owner: 'PROPRIETÁRIO EXEMPLO',
      address: 'RUA DAS PALMEIRAS, Nº 100, BAIRRO CENTRO',
      engineer: 'ENG. ELETRICISTA RESPONSÁVEL',
      crea: 'CREA-SP 5061234567/D',
      utilityCompany: 'Equatorial Energia',
      date: '05/11/2026',
      revision: '00'
    };

    // Multi-pavimentos e Prumadas Verticais (NBR 5410 / NBR 6492)
    this.levels = [
      {
        id: 'level_terreo',
        name: 'Pavimento Térreo',
        elevation: 0.0,
        height: 2.80,
        walls: [],
        rooms: [],
        doors: [],
        windows: [],
        roomDividers: [],
        dimensions: [],
        nodes: [],
        conduits: []
      }
    ];
    this.activeLevelId = 'level_terreo';
    this.underlayLevelId = null; // ID do nível exibido em plano fantasma / subjacente
    this.risers = []; // Prumadas verticais interligando pavimentos
    this.risers = []; // Prumadas verticais interligando pavimentos

    // Snap e Guia Polar
    this.snapSettings = {
      endpoint: true,
      midpoint: true,
      perpendicular: true,
      nearest: true,
      ortho45: true
    };
    this.polarGuide = null; // { start, angleDeg, dist }

    // Camadas (Layers)
    this.layers = {
      grid: true,
      walls: true,
      openings: true,
      rooms: true,
      electric: true,
      conduits: true,
      wiring: true,
      dimensions: true,
      unifilar: true
    };

    // Histórico de Desfazer / Refazer (Undo / Redo)
    this.undoStack = [];
    this.redoStack = [];

    this.isDragging = false;
    this.isPanning = false;
    this.dragStartScreen = { x: 0, y: 0 };
    this.dragStartWorld = new Vector2D();
    this.currentSnap = { snapped: false, point: new Vector2D() };
    this.mouseScreenPos = { x: 0, y: 0 };
    this.mouseWorldPos = new Vector2D();
    this.attachedWall = null; // Parede sob o mouse para portas/janelas
    this.listeners = [];

    // Sistema de Seleção Avançado com Alternância de Candidatos via Tecla Tab
    this.hoverCandidates = [];
    this.hoverCandidateIndex = 0;
    this.hoverDrivingDimension = null; // Cota vinculada sob o cursor para edição direta
    this.onEditDrivingDimension = null; // Callback para mini-modal flutuante de edição direta de cota

    this.saveSnapshot();
  }

  saveSnapshot() {
    this.saveCurrentLevelState();
    const state = {
      levels: JSON.parse(JSON.stringify(this.levels)),
      activeLevelId: this.activeLevelId,
      underlayLevelId: this.underlayLevelId,
      risers: JSON.parse(JSON.stringify(this.risers)),
      nodes: JSON.parse(JSON.stringify(this.nodes)),
      conduits: JSON.parse(JSON.stringify(this.conduits)),
      walls: JSON.parse(JSON.stringify(this.walls)),
      rooms: JSON.parse(JSON.stringify(this.rooms)),
      doors: JSON.parse(JSON.stringify(this.doors)),
      windows: JSON.parse(JSON.stringify(this.windows || [])),
      dimensions: JSON.parse(JSON.stringify(this.dimensions || [])),
      roomDividers: JSON.parse(JSON.stringify(this.roomDividers || [])),
      sldPosition: { ...this.sldPosition }
    };
    this.undoStack.push(state);
    if (this.undoStack.length > 50) this.undoStack.shift();
    this.redoStack = [];
  }

  undo() {
    if (this.undoStack.length <= 1) return;
    const currentState = this.undoStack.pop();
    this.redoStack.push(currentState);
    const prevState = this.undoStack[this.undoStack.length - 1];
    this.loadState(prevState);
  }

  redo() {
    if (this.redoStack.length === 0) return;
    const nextState = this.redoStack.pop();
    this.undoStack.push(nextState);
    this.loadState(nextState);
  }

  loadState(state) {
    if (state.levels) {
      this.levels = JSON.parse(JSON.stringify(state.levels));
      this.activeLevelId = state.activeLevelId || this.levels[0].id;
      this.underlayLevelId = state.underlayLevelId || null;
      this.risers = JSON.parse(JSON.stringify(state.risers || []));
    }
    this.nodes = JSON.parse(JSON.stringify(state.nodes));
    this.conduits = JSON.parse(JSON.stringify(state.conduits));
    this.walls = JSON.parse(JSON.stringify(state.walls));
    this.rooms = JSON.parse(JSON.stringify(state.rooms));
    this.doors = JSON.parse(JSON.stringify(state.doors));
    this.windows = JSON.parse(JSON.stringify(state.windows || []));
    this.dimensions = JSON.parse(JSON.stringify(state.dimensions || []));
    this.roomDividers = JSON.parse(JSON.stringify(state.roomDividers || []));
    this.sldPosition = { ...state.sldPosition };
    this.selectedNodeId = null;
    this.selectedElement = null;
    this.recalculateWiring();
    this.notify();
  }

  subscribe(fn) {
    this.listeners.push(fn);
  }

  notify() {
    for (const fn of this.listeners) fn();
  }

  // Serializa o estado completo do projeto conforme a Seção 2.2 das diretrizes
  serializeProject() {
    this.saveCurrentLevelState();
    return {
      version: '1.0.0',
      generator: 'OpenElétrica CAD',
      timestamp: new Date().toISOString(),
      meta: {
        title: this.projectMeta?.title || 'PROJETO ELÉTRICO RESIDENCIAL - UNIFAMILIAR',
        owner: this.projectMeta?.owner || 'PROPRIETÁRIO EXEMPLO',
        address: this.projectMeta?.address || 'RUA DAS PALMEIRAS, Nº 100, BAIRRO CENTRO',
        engineer: this.projectMeta?.engineer || 'ENG. ELETRICISTA RESPONSÁVEL',
        crea: this.projectMeta?.crea || 'CREA-SP 5061234567/D',
        utilityCompany: this.projectMeta?.utilityCompany || 'Equatorial Energia',
        date: this.projectMeta?.date || '05/11/2026',
        revision: this.projectMeta?.revision || '00'
      },
      levels: JSON.parse(JSON.stringify(this.levels)),
      activeLevelId: this.activeLevelId,
      underlayLevelId: this.underlayLevelId,
      risers: JSON.parse(JSON.stringify(this.risers)),
      architecture: {
        scale: 50,
        walls: JSON.parse(JSON.stringify(this.walls)),
        doors: JSON.parse(JSON.stringify(this.doors)),
        windows: JSON.parse(JSON.stringify(this.windows || [])),
        rooms: JSON.parse(JSON.stringify(this.rooms)),
        roomDividers: JSON.parse(JSON.stringify(this.roomDividers || [])),
        dimensions: JSON.parse(JSON.stringify(this.dimensions || []))
      },
      electricNodes: JSON.parse(JSON.stringify(this.nodes)),
      conduits: JSON.parse(JSON.stringify(this.conduits)),
      circuits: JSON.parse(JSON.stringify(this.circuits || [])),
      panels: JSON.parse(JSON.stringify(this.panels || [])),
      sldPosition: { ...this.sldPosition },
      sheet: JSON.parse(JSON.stringify(this.layoutConfig || {})),
      viewport: {
        panX: this.viewport.panX,
        panY: this.viewport.panY,
        zoom: this.viewport.zoom
      }
    };
  }

  // Carrega e valida um projeto completo (.openelt ou .json)
  loadProject(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Arquivo de projeto inválido: objeto JSON esperado.');
    }

    if (Array.isArray(data.levels) && data.levels.length > 0) {
      this.levels = JSON.parse(JSON.stringify(data.levels));
      this.activeLevelId = (data.activeLevelId && this.levels.find(l => l.id === data.activeLevelId))
        ? data.activeLevelId
        : this.levels[0].id;
      this.underlayLevelId = data.underlayLevelId || null;
      this.risers = Array.isArray(data.risers) ? JSON.parse(JSON.stringify(data.risers)) : [];

      const currentLvl = this.levels.find(l => l.id === this.activeLevelId) || this.levels[0];
      this.walls = Array.isArray(currentLvl.walls) ? JSON.parse(JSON.stringify(currentLvl.walls)) : [];
      this.doors = Array.isArray(currentLvl.doors) ? JSON.parse(JSON.stringify(currentLvl.doors)) : [];
      this.windows = Array.isArray(currentLvl.windows) ? JSON.parse(JSON.stringify(currentLvl.windows)) : [];
      this.rooms = Array.isArray(currentLvl.rooms) ? JSON.parse(JSON.stringify(currentLvl.rooms)) : [];
      this.roomDividers = Array.isArray(currentLvl.roomDividers) ? JSON.parse(JSON.stringify(currentLvl.roomDividers)) : [];
      this.dimensions = Array.isArray(currentLvl.dimensions) ? JSON.parse(JSON.stringify(currentLvl.dimensions)) : [];
      this.nodes = Array.isArray(currentLvl.nodes) ? JSON.parse(JSON.stringify(currentLvl.nodes)) : (Array.isArray(currentLvl.electricNodes) ? JSON.parse(JSON.stringify(currentLvl.electricNodes)) : []);
      this.conduits = Array.isArray(currentLvl.conduits) ? JSON.parse(JSON.stringify(currentLvl.conduits)) : [];
    } else {
      const arch = data.architecture || {};
      this.walls = Array.isArray(arch.walls) ? JSON.parse(JSON.stringify(arch.walls)) : (Array.isArray(data.walls) ? JSON.parse(JSON.stringify(data.walls)) : []);
      this.doors = Array.isArray(arch.doors) ? JSON.parse(JSON.stringify(arch.doors)) : (Array.isArray(data.doors) ? JSON.parse(JSON.stringify(data.doors)) : []);
      this.windows = Array.isArray(arch.windows) ? JSON.parse(JSON.stringify(arch.windows)) : (Array.isArray(data.windows) ? JSON.parse(JSON.stringify(data.windows)) : []);
      this.rooms = Array.isArray(arch.rooms) ? JSON.parse(JSON.stringify(arch.rooms)) : (Array.isArray(data.rooms) ? JSON.parse(JSON.stringify(data.rooms)) : []);
      this.roomDividers = Array.isArray(arch.roomDividers) ? JSON.parse(JSON.stringify(arch.roomDividers)) : (Array.isArray(data.roomDividers) ? JSON.parse(JSON.stringify(data.roomDividers)) : []);
      this.dimensions = Array.isArray(arch.dimensions) ? JSON.parse(JSON.stringify(arch.dimensions)) : (Array.isArray(data.dimensions) ? JSON.parse(JSON.stringify(data.dimensions)) : []);
      this.nodes = Array.isArray(data.electricNodes) ? JSON.parse(JSON.stringify(data.electricNodes)) : (Array.isArray(data.nodes) ? JSON.parse(JSON.stringify(data.nodes)) : []);
      this.conduits = Array.isArray(data.conduits) ? JSON.parse(JSON.stringify(data.conduits)) : [];

      this.levels = [
        {
          id: 'level_terreo',
          name: 'Pavimento Térreo',
          elevation: 0.0,
          height: 2.80,
          walls: JSON.parse(JSON.stringify(this.walls)),
          doors: JSON.parse(JSON.stringify(this.doors)),
          windows: JSON.parse(JSON.stringify(this.windows)),
          rooms: JSON.parse(JSON.stringify(this.rooms)),
          roomDividers: JSON.parse(JSON.stringify(this.roomDividers)),
          dimensions: JSON.parse(JSON.stringify(this.dimensions)),
          nodes: JSON.parse(JSON.stringify(this.nodes)),
          conduits: JSON.parse(JSON.stringify(this.conduits))
        }
      ];
      this.activeLevelId = 'level_terreo';
      this.underlayLevelId = null;
      this.risers = [];
    }

    this.circuits = Array.isArray(data.circuits) ? JSON.parse(JSON.stringify(data.circuits)) : [];
    this.panels = Array.isArray(data.panels) ? JSON.parse(JSON.stringify(data.panels)) : [];

    if (data.sldPosition && typeof data.sldPosition.x === 'number') {
      this.sldPosition = { ...data.sldPosition };
    }

    if (data.meta && typeof data.meta === 'object') {
      this.projectMeta = { ...this.projectMeta, ...data.meta };
    }

    if (data.sheet && typeof data.sheet === 'object') {
      this.layoutConfig = { ...this.layoutConfig, ...data.sheet };
    }

    if (data.viewport && typeof data.viewport.zoom === 'number') {
      this.viewport.panX = data.viewport.panX ?? this.viewport.panX;
      this.viewport.panY = data.viewport.panY ?? this.viewport.panY;
      this.viewport.zoom = data.viewport.zoom ?? this.viewport.zoom;
    }

    this.selectedElement = null;
    this.selectedElements = [];
    this.selectedNodeId = null;
    this.undoStack = [];
    this.redoStack = [];
    this.saveSnapshot();
    this.recalculateWiring();
    this.notify();
    return true;
  }

  // Inicia um projeto em branco
  clearProject() {
    this.walls = [];
    this.doors = [];
    this.windows = [];
    this.rooms = [];
    this.roomDividers = [];
    this.dimensions = [];
    this.nodes = [];
    this.conduits = [];
    this.circuits = [];
    this.panels = [];
    this.levels = [
      {
        id: 'level_terreo',
        name: 'Pavimento Térreo',
        elevation: 0.0,
        height: 2.80,
        walls: [],
        doors: [],
        windows: [],
        rooms: [],
        roomDividers: [],
        dimensions: [],
        nodes: [],
        conduits: []
      }
    ];
    this.activeLevelId = 'level_terreo';
    this.underlayLevelId = null;
    this.risers = [];
    this.projectMeta = {
      title: 'NOVO PROJETO ELÉTRICO',
      owner: '',
      address: '',
      engineer: '',
      crea: '',
      utilityCompany: 'Equatorial Energia',
      date: new Date().toLocaleDateString('pt-BR'),
      revision: '00'
    };
    this.selectedElement = null;
    this.selectedElements = [];
    this.selectedNodeId = null;
    this.undoStack = [];
    this.redoStack = [];
    this.saveSnapshot();
    this.recalculateWiring();
    this.notify();
  }

  // Métodos de Gerenciamento de Pavimentos e Prumadas
  saveCurrentLevelState() {
    const lvl = this.levels ? this.levels.find(l => l.id === this.activeLevelId) : null;
    if (lvl) {
      lvl.walls = JSON.parse(JSON.stringify(this.walls));
      lvl.rooms = JSON.parse(JSON.stringify(this.rooms));
      lvl.doors = JSON.parse(JSON.stringify(this.doors));
      lvl.windows = JSON.parse(JSON.stringify(this.windows || []));
      lvl.roomDividers = JSON.parse(JSON.stringify(this.roomDividers || []));
      lvl.dimensions = JSON.parse(JSON.stringify(this.dimensions || []));
      lvl.nodes = JSON.parse(JSON.stringify(this.nodes));
      lvl.conduits = JSON.parse(JSON.stringify(this.conduits));
    }
  }

  switchLevel(newLevelId) {
    if (!newLevelId || newLevelId === this.activeLevelId) return;
    const target = this.levels ? this.levels.find(l => l.id === newLevelId) : null;
    if (!target) return;

    this.saveCurrentLevelState();

    this.activeLevelId = newLevelId;
    this.walls = Array.isArray(target.walls) ? JSON.parse(JSON.stringify(target.walls)) : [];
    this.rooms = Array.isArray(target.rooms) ? JSON.parse(JSON.stringify(target.rooms)) : [];
    this.doors = Array.isArray(target.doors) ? JSON.parse(JSON.stringify(target.doors)) : [];
    this.windows = Array.isArray(target.windows) ? JSON.parse(JSON.stringify(target.windows)) : [];
    this.roomDividers = Array.isArray(target.roomDividers) ? JSON.parse(JSON.stringify(target.roomDividers)) : [];
    this.dimensions = Array.isArray(target.dimensions) ? JSON.parse(JSON.stringify(target.dimensions)) : [];
    this.nodes = Array.isArray(target.nodes) ? JSON.parse(JSON.stringify(target.nodes)) : [];
    this.conduits = Array.isArray(target.conduits) ? JSON.parse(JSON.stringify(target.conduits)) : [];

    this.selectedElement = null;
    this.selectedElements = [];
    this.selectedNodeId = null;
    this.wallStartPoint = null;
    this.conduitStartNodeId = null;

    this.recalculateWiring();
    this.saveSnapshot();
    this.notify();
  }

  addLevel(name, elevation, height = 2.80, copyFromLevelId = null) {
    this.saveCurrentLevelState();
    const id = 'level_' + Date.now();
    let walls = [];
    let doors = [];
    let windows = [];
    let rooms = [];

    if (copyFromLevelId) {
      const src = this.levels.find(l => l.id === copyFromLevelId);
      if (src) {
        walls = JSON.parse(JSON.stringify(src.walls || []));
        doors = JSON.parse(JSON.stringify(src.doors || []));
        windows = JSON.parse(JSON.stringify(src.windows || []));
        rooms = JSON.parse(JSON.stringify(src.rooms || []));
      }
    }

    const newLevel = {
      id,
      name: name || `Pavimento ${this.levels.length + 1}`,
      elevation: Number(elevation) || 0.0,
      height: Number(height) || 2.80,
      walls,
      rooms,
      doors,
      windows,
      roomDividers: [],
      dimensions: [],
      nodes: [],
      conduits: []
    };

    this.levels.push(newLevel);
    this.levels.sort((a, b) => a.elevation - b.elevation);

    if (copyFromLevelId) {
      this.underlayLevelId = copyFromLevelId;
    }

    this.switchLevel(id);
    return newLevel;
  }

  deleteLevel(levelId) {
    if (this.levels.length <= 1) return false;
    this.levels = this.levels.filter(l => l.id !== levelId);
    this.risers = this.risers.filter(r => r.fromLevelId !== levelId && r.toLevelId !== levelId);
    if (this.underlayLevelId === levelId) this.underlayLevelId = null;

    if (this.activeLevelId === levelId) {
      const nextId = this.levels[0].id;
      this.activeLevelId = null;
      this.switchLevel(nextId);
    } else {
      this.notify();
    }
    return true;
  }

  setUnderlayLevel(levelId) {
    this.underlayLevelId = levelId && levelId !== this.activeLevelId ? levelId : null;
    this.notify();
  }

  addRiser(pos, fromLevelId, toLevelId, label = '', diameter = 25) {
    const num = (this.risers.length + 1).toString().padStart(2, '0');
    const riser = {
      id: 'pr_' + Date.now(),
      name: label || `PR-${num}`,
      position: { x: Number(pos.x.toFixed(2)), y: Number(pos.y.toFixed(2)) },
      fromLevelId,
      toLevelId,
      diameter: diameter || 25
    };
    this.risers.push(riser);
    this.saveSnapshot();
    this.notify();
    return riser;
  }

  deleteRiser(riserId) {
    this.risers = this.risers.filter(r => r.id !== riserId);
    this.saveSnapshot();
    this.notify();
  }

  getAllLevelsWithData() {
    this.saveCurrentLevelState();
    return JSON.parse(JSON.stringify(this.levels));
  }

  // Carrega o cenário residencial demonstrativo canônico
  loadSampleProject() {
    this.walls = [
      { id: 'w1', a: { x: 1.0, y: 1.0 }, b: { x: 10.0, y: 1.0 }, thickness: 0.15 },
      { id: 'w2', a: { x: 10.0, y: 1.0 }, b: { x: 10.0, y: 11.0 }, thickness: 0.15 },
      { id: 'w3', a: { x: 10.0, y: 11.0 }, b: { x: 1.0, y: 11.0 }, thickness: 0.15 },
      { id: 'w4', a: { x: 1.0, y: 11.0 }, b: { x: 1.0, y: 1.0 }, thickness: 0.15 },
      { id: 'w5', a: { x: 1.0, y: 4.5 }, b: { x: 6.5, y: 4.5 }, thickness: 0.15 },
      { id: 'w6', a: { x: 6.5, y: 1.0 }, b: { x: 6.5, y: 6.5 }, thickness: 0.15 },
      { id: 'w7', a: { x: 6.5, y: 6.5 }, b: { x: 10.0, y: 6.5 }, thickness: 0.15 }
    ];

    this.rooms = [
      { id: 'r1', name: 'TERRAÇO', pos: { x: 3.5, y: 2.8 }, areaM2: 18.2 },
      { id: 'r2', name: 'SALA COMERCIAL', pos: { x: 3.5, y: 7.8 }, areaM2: 32.5 },
      { id: 'r3', name: 'CIRCULAÇÃO / COZINHA', pos: { x: 8.2, y: 3.8 }, areaM2: 16.0 }
    ];

    this.doors = [
      { id: 'd1', pos: { x: 5.2, y: 4.5 }, radius: 0.8, startAngle: 0, endAngle: Math.PI / 2, rotation: 0, orientationIndex: 0 },
      { id: 'd2', pos: { x: 8.0, y: 6.5 }, radius: 0.8, startAngle: 0, endAngle: Math.PI / 2, rotation: 0, orientationIndex: 0 }
    ];

    this.windows = [
      { id: 'win1', pos: { x: 3.5, y: 1.0 }, width: 1.5, rotation: 0 },
      { id: 'win2', pos: { x: 10.0, y: 8.5 }, width: 1.2, rotation: Math.PI / 2 }
    ];

    this.dimensions = [
      { id: 'dim1', a: { x: 1.0, y: 1.0 }, b: { x: 10.0, y: 1.0 }, dist: 9.0, offset: 0.8 },
      { id: 'dim2', a: { x: 1.0, y: 1.0 }, b: { x: 1.0, y: 11.0 }, dist: 10.0, offset: -0.8 },
      { id: 'dim3', a: { x: 1.0, y: 3.2 }, b: { x: 6.5, y: 3.2 }, dist: 5.5, offset: -0.5 }
    ];

    this.nodes = [];
    const qd = this.addNode('distribution_board', { x: 1.15, y: 10.2 });
    const lamp1 = this.addNode('light_ceiling', { x: 3.5, y: 2.8 }, 1, 'a');
    const lamp2 = this.addNode('light_ceiling', { x: 3.5, y: 7.8 }, 1, 'b');
    const lamp3 = this.addNode('light_ceiling', { x: 8.2, y: 3.8 }, 5, 'c');

    const sw1 = this.addNode('switch_simple', { x: 1.15, y: 3.5 }, 1, 'a');
    const sw2 = this.addNode('switch_simple', { x: 1.15, y: 6.5 }, 1, 'b');
    const sw3 = this.addNode('switch_simple', { x: 6.65, y: 3.5 }, 5, 'c');

    const t1 = this.addNode('outlet_medium', { x: 1.15, y: 2.0 }, 2);
    const t2 = this.addNode('outlet_medium', { x: 5.8, y: 1.15 }, 2);
    const t3 = this.addNode('outlet_medium', { x: 3.5, y: 10.85 }, 4);
    const t4 = this.addNode('outlet_high', { x: 9.85, y: 2.5 }, 3);
    t4.powerWatts = 5500;

    this.conduits = [];
    this.addConduit(qd.id, lamp2.id, 'ceiling', -1);
    this.addConduit(lamp2.id, lamp1.id, 'ceiling', 1);
    this.addConduit(lamp1.id, lamp3.id, 'ceiling', -1);

    this.addConduit(lamp1.id, sw1.id, 'wall', 1);
    this.addConduit(lamp2.id, sw2.id, 'wall', 1);
    this.addConduit(lamp3.id, sw3.id, 'wall', -1);

    this.addConduit(lamp1.id, t1.id, 'ceiling', -1);
    this.addConduit(lamp1.id, t2.id, 'ceiling', 1);
    this.addConduit(lamp2.id, t3.id, 'ceiling', 1);
    this.addConduit(lamp3.id, t4.id, 'ceiling', 1);

    this.circuits = [
      { id: 1, desc: 'Iluminação Sala / Terraço', panel: 'QD1', v: 127, w: 200, type: 'light', phase: 'A', breaker: 10, dr: 'Geral 30mA' },
      { id: 2, desc: 'TUGs Sala Comercial', panel: 'QD1', v: 127, w: 1200, type: 'outlet', phase: 'B', breaker: 20, dr: 'Geral 30mA' },
      { id: 3, desc: 'TUE - Chuveiro Elétrico', panel: 'QD1', v: 220, w: 5500, type: 'outlet', phase: 'AB', breaker: 25, dr: 'DDR 30mA' },
      { id: 4, desc: 'TUGs Cozinha / Área', panel: 'QD1', v: 127, w: 1800, type: 'outlet', phase: 'C', breaker: 20, dr: 'Geral 30mA' },
      { id: 5, desc: 'Iluminação Circulação', panel: 'QD1', v: 127, w: 100, type: 'light', phase: 'B', breaker: 10, dr: 'Geral 30mA' }
    ];

    this.panels = [
      { id: 'QD1', name: 'QD1 - Quadro Geral de Distribuição', location: 'Circulação', mainBreaker: 40, phases: 'Trifásico (3F+N+T)' }
    ];

    this.viewport.panX = 70;
    this.viewport.panY = 40;
    this.viewport.zoom = 52;

    this.projectMeta = {
      title: 'PROJETO ELÉTRICO RESIDENCIAL - UNIFAMILIAR',
      owner: 'PROPRIETÁRIO EXEMPLO',
      address: 'RUA DAS PALMEIRAS, Nº 100, BAIRRO CENTRO',
      engineer: 'ENG. ELETRICISTA RESPONSÁVEL',
      crea: 'CREA-SP 5061234567/D',
      utilityCompany: 'Equatorial Energia',
      date: '05/11/2026',
      revision: '00'
    };

    // Configuração dos pavimentos do modelo demonstrativo
    const terreoWalls = JSON.parse(JSON.stringify(this.walls));
    const terreoRooms = JSON.parse(JSON.stringify(this.rooms));
    const terreoDoors = JSON.parse(JSON.stringify(this.doors));
    const terreoWindows = JSON.parse(JSON.stringify(this.windows));
    const terreoDimensions = JSON.parse(JSON.stringify(this.dimensions));
    const terreoNodes = JSON.parse(JSON.stringify(this.nodes));
    const terreoConduits = JSON.parse(JSON.stringify(this.conduits));

    // Pavimento Superior de exemplo (1º Pavimento)
    const supWalls = [
      { id: 'sw1', a: { x: 1.0, y: 1.0 }, b: { x: 10.0, y: 1.0 }, thickness: 0.15 },
      { id: 'sw2', a: { x: 10.0, y: 1.0 }, b: { x: 10.0, y: 11.0 }, thickness: 0.15 },
      { id: 'sw3', a: { x: 10.0, y: 11.0 }, b: { x: 1.0, y: 11.0 }, thickness: 0.15 },
      { id: 'sw4', a: { x: 1.0, y: 11.0 }, b: { x: 1.0, y: 1.0 }, thickness: 0.15 },
      { id: 'sw5', a: { x: 1.0, y: 5.5 }, b: { x: 10.0, y: 5.5 }, thickness: 0.15 },
      { id: 'sw6', a: { x: 5.5, y: 5.5 }, b: { x: 5.5, y: 11.0 }, thickness: 0.15 }
    ];
    const supRooms = [
      { id: 'sr1', name: 'SUÍTE MASTER', pos: { x: 5.5, y: 3.2 }, areaM2: 38.0 },
      { id: 'sr2', name: 'DORMITÓRIO 01', pos: { x: 3.2, y: 8.2 }, areaM2: 24.5 },
      { id: 'sr3', name: 'DORMITÓRIO 02', pos: { x: 7.8, y: 8.2 }, areaM2: 24.5 }
    ];
    const supDoors = [
      { id: 'sd1', pos: { x: 5.5, y: 5.5 }, radius: 0.8, startAngle: 0, endAngle: Math.PI / 2, rotation: 0, orientationIndex: 0 }
    ];
    const supWindows = [
      { id: 'swin1', pos: { x: 5.5, y: 1.0 }, width: 1.6, rotation: 0 },
      { id: 'swin2', pos: { x: 3.2, y: 11.0 }, width: 1.4, rotation: 0 }
    ];
    const supNodes = [
      { id: 'sn_qd2', type: 'distribution_board', position: { x: 1.15, y: 10.2 }, circuit: 6, powerWatts: 0 },
      { id: 'sn_l1', type: 'light_ceiling', position: { x: 5.5, y: 3.2 }, circuit: 7, command: 'd', powerWatts: 150 },
      { id: 'sn_l2', type: 'light_ceiling', position: { x: 3.2, y: 8.2 }, circuit: 7, command: 'e', powerWatts: 100 },
      { id: 'sn_l3', type: 'light_ceiling', position: { x: 7.8, y: 8.2 }, circuit: 7, command: 'f', powerWatts: 100 }
    ];
    const supConduits = [
      { id: 'sc1', nodeAId: 'sn_qd2', nodeBId: 'sn_l2', installationType: 'ceiling', curveDirection: 1 },
      { id: 'sc2', nodeAId: 'sn_l2', nodeBId: 'sn_l1', installationType: 'ceiling', curveDirection: -1 },
      { id: 'sc3', nodeAId: 'sn_l1', nodeBId: 'sn_l3', installationType: 'ceiling', curveDirection: 1 }
    ];

    this.levels = [
      {
        id: 'level_terreo',
        name: 'Pavimento Térreo',
        elevation: 0.0,
        height: 2.80,
        walls: terreoWalls,
        rooms: terreoRooms,
        doors: terreoDoors,
        windows: terreoWindows,
        dimensions: terreoDimensions,
        roomDividers: [],
        nodes: terreoNodes,
        conduits: terreoConduits
      },
      {
        id: 'level_primeiro',
        name: '1º Pavimento',
        elevation: 2.80,
        height: 2.80,
        walls: supWalls,
        rooms: supRooms,
        doors: supDoors,
        windows: supWindows,
        dimensions: [],
        roomDividers: [],
        nodes: supNodes,
        conduits: supConduits
      }
    ];

    this.activeLevelId = 'level_terreo';
    this.underlayLevelId = null;

    // Prumada vertical conectando Térreo e 1º Pavimento junto ao QDC
    this.risers = [
      {
        id: 'pr_01',
        name: 'PR-01',
        position: { x: 1.15, y: 10.2 },
        fromLevelId: 'level_terreo',
        toLevelId: 'level_primeiro',
        diameter: 32
      }
    ];

    this.selectedElement = null;
    this.selectedElements = [];
    this.selectedNodeId = null;
    this.undoStack = [];
    this.redoStack = [];
    this.saveSnapshot();
    this.recalculateWiring();
    this.notify();
  }

  // Agrupa vértices de paredes coincidentes para movimentação articulada mantendo quinas fechadas
  collectConnectedWallVertices(pt) {
    this.draggedWallVertices = [];
    if (!pt) return;
    for (let i = 0; i < this.walls.length; i++) {
      const w = this.walls[i];
      if (Math.hypot(w.a.x - pt.x, w.a.y - pt.y) < 0.18) {
        this.draggedWallVertices.push({ wallIndex: i, handle: 'a' });
      }
      if (Math.hypot(w.b.x - pt.x, w.b.y - pt.y) < 0.18) {
        this.draggedWallVertices.push({ wallIndex: i, handle: 'b' });
      }
    }
  }

  // Entrada Rápida de Comprimento: insere parede contínua com dimensão numérica exata
  applyTypedLength(valStr) {
    if (!this.wallStartPoint) return false;
    const val = typeof valStr === 'number' ? valStr : parseFloat(String(valStr).replace(',', '.'));
    if (isNaN(val) || val <= 0.05) return false;

    const S = this.wallStartPoint;
    const curWorld = this.mouseWorldPos || { x: S.x + 1, y: S.y };
    const dx = curWorld.x - S.x;
    const dy = curWorld.y - S.y;
    let rawAngle = Math.atan2(dy, dx);

    // Se Ortho estiver ativo, trava na orientação angular
    if (this.snapSettings.ortho45) {
      const step = Math.PI / 4; // Ângulos de 45°
      rawAngle = Math.round(rawAngle / step) * step;
    } else {
      const step = Math.PI / 2; // Ortogonal puro 90°
      rawAngle = Math.round(rawAngle / step) * step;
    }

    const dirX = Math.cos(rawAngle);
    const dirY = Math.sin(rawAngle);

    const endPoint = {
      x: Number((S.x + dirX * val).toFixed(3)),
      y: Number((S.y + dirY * val).toFixed(3))
    };

    this.saveSnapshot();
    const newWall = {
      id: `wall_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      a: { x: S.x, y: S.y },
      b: endPoint,
      thickness: this.currentWallThickness || 0.15
    };
    this.walls.push(newWall);

    // Encadeia desenho contínuo no novo ponto final
    this.wallStartPoint = { x: endPoint.x, y: endPoint.y };
    this.typedLength = '';
    this.notify();

    if (typeof window !== 'undefined' && window.__showToast) {
      window.__showToast(`Parede de ${val.toFixed(2)} m adicionada com sucesso!`);
    }
    return true;
  }

  // Identifica cotas vinculadas à parede selecionada (NBR 6492 / Cotas Vinculadas)
  getDrivingDimensionsForWall(wallIndex) {
    const wall = this.walls[wallIndex];
    if (!wall) return [];
    const results = [];
    const wLen = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
    if (wLen < 0.05) return [];
    const wDir = new Vector2D((wall.b.x - wall.a.x) / wLen, (wall.b.y - wall.a.y) / wLen);
    const wNorm = wDir.orthogonal();

    for (let i = 0; i < (this.dimensions || []).length; i++) {
      const dim = this.dimensions[i];
      if (!dim) continue;
      const ptA = dim.a || dim.ptA;
      const ptB = dim.b || dim.ptB;
      if (!ptA || !ptB) continue;

      const dLen = Math.hypot(ptB.x - ptA.x, ptB.y - ptA.y);
      if (dLen < 0.05) continue;
      const dDir = new Vector2D((ptB.x - ptA.x) / dLen, (ptB.y - ptA.y) / dLen);

      // 1. Cota Longitudinal: mede o comprimento da própria alvenaria
      const dotDir = Math.abs(dDir.x * wDir.x + dDir.y * wDir.y);
      if (dotDir > 0.88) {
        const distA = Vector2D.projectOnSegment(ptA, wall.a, wall.b).distance;
        const distB = Vector2D.projectOnSegment(ptB, wall.a, wall.b).distance;
        if (distA < 0.35 && distB < 0.35) {
          results.push({
            dimIndex: i,
            dim,
            type: 'length',
            label: `Comprimento da Parede (${dLen.toFixed(2)} m)`,
            currentDist: Number(dLen.toFixed(2))
          });
          continue;
        }
      }

      // 2. Cota Transversal / Vão Interno: mede distância entre esta parede e outra paralela
      const dotNorm = Math.abs(dDir.x * wNorm.x + dDir.y * wNorm.y);
      if (dotNorm > 0.85) {
        const projA = Vector2D.projectOnSegment(ptA, wall.a, wall.b);
        const projB = Vector2D.projectOnSegment(ptB, wall.a, wall.b);

        if (projA.distance < 0.35 || projB.distance < 0.35) {
          const isPtBOnWall = projB.distance < projA.distance;
          results.push({
            dimIndex: i,
            dim,
            type: 'offset',
            label: `Vão / Distância Interna (${dLen.toFixed(2)} m)`,
            currentDist: Number(dLen.toFixed(2)),
            wallNearB: isPtBOnWall
          });
        }
      }
    }
    return results;
  }

  // Identifica se o clique na tela atingiu o rótulo de uma cota vinculada à parede selecionada
  getDrivingDimensionAtScreen(screenPt) {
    if (!this.selectedElement || this.selectedElement.type !== 'wall' || typeof this.selectedElement.index !== 'number') {
      return null;
    }
    const wallIndex = this.selectedElement.index;
    const drivingDims = this.getDrivingDimensionsForWall(wallIndex);
    if (!drivingDims || drivingDims.length === 0) return null;

    for (const d of drivingDims) {
      const dim = d.dim;
      const ptA = dim.a || dim.ptA;
      const ptB = dim.b || dim.ptB;
      if (!ptA || !ptB) continue;
      const L = Math.hypot(ptB.x - ptA.x, ptB.y - ptA.y);
      if (L < 0.05) continue;
      const u = new Vector2D((ptB.x - ptA.x) / L, (ptB.y - ptA.y) / L);
      const n = u.orthogonal();
      const off = dim.offset || 0.35;
      const midDim = new Vector2D((ptA.x + ptB.x) / 2 + n.x * off, (ptA.y + ptB.y) / 2 + n.y * off);
      const sMid = this.viewport.worldToScreen(midDim);

      if (sMid.distanceTo(screenPt) < 28) {
        return {
          dimIndex: d.dimIndex,
          wallIndex,
          dim,
          label: d.label,
          type: d.type,
          currentDist: d.currentDist,
          screenPos: sMid
        };
      }
    }
    return null;
  }

  // Aplica valor paramétrico à cota, deslocando a parede e mantendo cantos fechados
  applyDrivingDimension(dimIndex, newDist, wallIndex) {
    const dim = this.dimensions[dimIndex];
    const wall = this.walls[wallIndex];
    if (!dim || !wall || isNaN(newDist) || newDist <= 0.10) return false;

    this.saveSnapshot();

    const ptA = dim.a || dim.ptA;
    const ptB = dim.b || dim.ptB;
    const curDist = Math.hypot(ptB.x - ptA.x, ptB.y - ptA.y);
    const delta = newDist - curDist;
    if (Math.abs(delta) < 0.001) return true;

    const dDir = new Vector2D((ptB.x - ptA.x) / curDist, (ptB.y - ptA.y) / curDist);
    const wLen = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
    const wDir = new Vector2D((wall.b.x - wall.a.x) / wLen, (wall.b.y - wall.a.y) / wLen);

    const dotDir = Math.abs(dDir.x * wDir.x + dDir.y * wDir.y);

    if (dotDir > 0.88) {
      // Cota longitudinal: estica a parede pelo ponto B
      const shiftX = wDir.x * delta;
      const shiftY = wDir.y * delta;
      const oldB = { x: wall.b.x, y: wall.b.y };

      wall.b.x += shiftX;
      wall.b.y += shiftY;

      // Mantém outras paredes conectadas unidas à quina B (tanto endpoint a quanto b)
      for (const other of this.walls) {
        if (other === wall) continue;
        if (Math.hypot(other.a.x - oldB.x, other.a.y - oldB.y) < 0.25) {
          other.a.x += shiftX; other.a.y += shiftY;
        }
        if (Math.hypot(other.b.x - oldB.x, other.b.y - oldB.y) < 0.25) {
          other.b.x += shiftX; other.b.y += shiftY;
        }
      }

      ptB.x += shiftX;
      ptB.y += shiftY;
      dim.dist = Number(newDist.toFixed(2));
    } else {
      // Cota transversal: translada a parede inteira
      const projA = Vector2D.projectOnSegment(ptA, wall.a, wall.b);
      const projB = Vector2D.projectOnSegment(ptB, wall.a, wall.b);
      const isWallAtB = projB.distance < projA.distance;

      const dispDir = isWallAtB ? dDir : new Vector2D(-dDir.x, -dDir.y);
      const shiftX = dispDir.x * delta;
      const shiftY = dispDir.y * delta;

      const oldA = { x: wall.a.x, y: wall.a.y };
      const oldB = { x: wall.b.x, y: wall.b.y };

      wall.a.x += shiftX; wall.a.y += shiftY;
      wall.b.x += shiftX; wall.b.y += shiftY;

      // Conexões de quina em ambas as extremidades e junções em T esticam juntas
      for (const other of this.walls) {
        if (other === wall) continue;

        // Vértice other.a conectado a oldA, oldB ou junção em T ao longo do corpo
        if (Math.hypot(other.a.x - oldA.x, other.a.y - oldA.y) < 0.25 || Math.hypot(other.a.x - oldB.x, other.a.y - oldB.y) < 0.25) {
          other.a.x += shiftX; other.a.y += shiftY;
        } else {
          const prA = Vector2D.projectOnSegment(other.a, oldA, oldB);
          if (prA.distance < 0.20 && prA.t > 0.01 && prA.t < 0.99) {
            other.a.x += shiftX; other.a.y += shiftY;
          }
        }

        // Vértice other.b conectado a oldA, oldB ou junção em T ao longo do corpo
        if (Math.hypot(other.b.x - oldA.x, other.b.y - oldA.y) < 0.25 || Math.hypot(other.b.x - oldB.x, other.b.y - oldB.y) < 0.25) {
          other.b.x += shiftX; other.b.y += shiftY;
        } else {
          const prB = Vector2D.projectOnSegment(other.b, oldA, oldB);
          if (prB.distance < 0.20 && prB.t > 0.01 && prB.t < 0.99) {
            other.b.x += shiftX; other.b.y += shiftY;
          }
        }
      }

      // Portas e janelas contidas na parede acompanham o deslocamento
      for (const d of (this.doors || [])) {
        if (d.wallId === wall.id || Vector2D.projectOnSegment(d.pos, oldA, oldB).distance < 0.22) {
          d.pos.x += shiftX; d.pos.y += shiftY;
        }
      }
      for (const w of (this.windows || [])) {
        if (w.wallId === wall.id || Vector2D.projectOnSegment(w.pos, oldA, oldB).distance < 0.22) {
          w.pos.x += shiftX; w.pos.y += shiftY;
        }
      }

      // Atualiza âncoras de outras cotas vinculadas aos vértices movidos
      for (let j = 0; j < (this.dimensions || []).length; j++) {
        if (j === dimIndex) continue;
        const otherDim = this.dimensions[j];
        if (!otherDim) continue;
        const pA = otherDim.a || otherDim.ptA;
        const pB = otherDim.b || otherDim.ptB;

        // Cota longitudinal da própria parede transladada
        const isDimAlongMovedWall = (Math.hypot(pA.x - oldA.x, pA.y - oldA.y) < 0.25 && Math.hypot(pB.x - oldB.x, pB.y - oldB.y) < 0.25) ||
                                    (Math.hypot(pA.x - oldB.x, pA.y - oldB.y) < 0.25 && Math.hypot(pB.x - oldA.x, pB.y - oldA.y) < 0.25);
        if (isDimAlongMovedWall) {
          pA.x += shiftX; pA.y += shiftY;
          pB.x += shiftX; pB.y += shiftY;
          continue;
        }

        // Cotas das paredes perpendiculares que esticaram
        if (Math.hypot(pA.x - oldA.x, pA.y - oldA.y) < 0.25 || Math.hypot(pA.x - oldB.x, pA.y - oldB.y) < 0.25) {
          pA.x += shiftX; pA.y += shiftY;
          otherDim.dist = Number(Math.hypot(pB.x - pA.x, pB.y - pA.y).toFixed(2));
        }
        if (Math.hypot(pB.x - oldA.x, pB.y - oldA.y) < 0.25 || Math.hypot(pB.x - oldB.x, pB.y - oldB.y) < 0.25) {
          pB.x += shiftX; pB.y += shiftY;
          otherDim.dist = Number(Math.hypot(pB.x - pA.x, pB.y - pA.y).toFixed(2));
        }
      }

      if (isWallAtB) {
        ptB.x += shiftX; ptB.y += shiftY;
      } else {
        ptA.x += shiftX; ptA.y += shiftY;
      }
      dim.dist = Number(newDist.toFixed(2));
    }

    this.recalculateWiring();
    this.notify();
    if (typeof window !== 'undefined' && window.__showToast) {
      window.__showToast(`Cota vinculada atualizada: ${newDist.toFixed(2)} m`);
    }
    return true;
  }

  // Inverte a orientação de uma cota existente (lado interno / externo)
  flipDimensionOffset(dimIndex) {
    const dim = this.dimensions[dimIndex];
    if (dim) {
      dim.offset = -(dim.offset || 0.35);
      this.saveSnapshot();
      this.notify();
    }
  }

  addNode(type, position, circuitId = 1, command = null) {
    let powerWatts = 0;
    let voltage = 127;
    let modules = null;

    if (type.startsWith('light')) {
      powerWatts = 100;
      voltage = 127;
    } else if (type === 'outlet_high') {
      powerWatts = 5500;
      voltage = 220;
    } else if (type.startsWith('outlet')) {
      powerWatts = 600;
      voltage = 127;
    } else if (type === 'combo_switch_outlet') {
      powerWatts = 600;
      voltage = 127;
      modules = [
        { type: 'switch_simple', circuitId: 1, command: command || 'a' },
        { type: 'outlet_medium', circuitId: 2, powerWatts: 600, voltage: 127 }
      ];
    } else if (type === 'combo_switch_switch') {
      powerWatts = 0;
      voltage = 127;
      modules = [
        { type: 'switch_simple', circuitId: circuitId || 1, command: command || 'a' },
        { type: 'switch_simple', circuitId: circuitId || 1, command: 'b' }
      ];
    }

    const node = {
      id: `node_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      type,
      position: { x: position.x, y: position.y },
      circuitId,
      command: type === 'combo_switch_switch' ? `${command || 'a'},b` : (command || (type === 'combo_switch_outlet' ? 'a' : null)),
      powerWatts,
      voltage,
      ...(modules ? { modules } : {})
    };
    this.nodes.push(node);
    this.saveSnapshot();
    this.recalculateWiring();
    this.notify();
    return node;
  }

  deleteConduit(conduitId) {
    this.saveSnapshot();
    this.conduits = this.conduits.filter(c => c.id !== conduitId);
    if (this.selectedElement && this.selectedElement.type === 'conduit' && this.selectedElement.id === conduitId) {
      this.selectedElement = null;
    }
    this.recalculateWiring();
    this.notify();
  }

  toggleConduitCurvature(conduitId) {
    const c = this.conduits.find(item => item.id === conduitId);
    if (c) {
      this.saveSnapshot();
      c.curveDirection = (c.curveDirection || 1) * -1;
      this.notify();
    }
  }

  addConduit(nodeAId, nodeBId, type = 'ceiling', curvature = 1) {
    const exists = this.conduits.some(c => 
      (c.nodeAId === nodeAId && c.nodeBId === nodeBId) ||
      (c.nodeAId === nodeBId && c.nodeBId === nodeAId)
    );
    if (exists || nodeAId === nodeBId) return null;

    const conduit = {
      id: `cond_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      nodeAId,
      nodeBId,
      type,
      diameterMm: 20,
      curvature
    };
    this.conduits.push(conduit);
    this.saveSnapshot();
    this.recalculateWiring();
    this.notify();
    return conduit;
  }

  toggleFlip() {
    this.doorOrientationIndex = (this.doorOrientationIndex + 1) % 4;
    if (this.selectedElement && this.selectedElement.type === 'door') {
      const d = this.doors[this.selectedElement.index];
      if (d) {
        d.orientationIndex = this.doorOrientationIndex;
        this.saveSnapshot();
      }
    }
    this.notify();
  }

  recalculateWiring() {
    const panel = this.nodes.find(n => n.type === 'distribution_board');
    if (!panel) {
      this.wireAllocations.clear();
      this.wiringWarnings = ['Aviso: Nenhum Quadro de Distribuição (QDC) inserido no projeto.'];
      return;
    }
    const graph = new ElectricalGraph(this.nodes, this.conduits);
    this.wireAllocations = graph.routeAllWires(panel.id, { 1: 1.5, 2: 2.5, 3: 4.0, 4: 2.5, 5: 2.5 });

    // Dimensionamento dos Eletrodutos & Verificação de Ocupação NBR 5410
    this.wiringWarnings = [];
    const conduitMap = new Map(this.conduits.map(c => [c.id, c]));

    for (const [conduitId, wires] of this.wireAllocations.entries()) {
      const c = conduitMap.get(conduitId);
      if (!c) continue;

      const numWires = wires.length;
      // Diâmetro nominal padrão calculado pela quantidade e bitola
      let dn = 20; // 1/2"
      if (numWires > 5) dn = 25; // 3/4"
      if (numWires > 8) dn = 32; // 1"
      if (numWires > 12) dn = 40; // 1.1/4"

      c.diameterMm = dn;

      if (numWires > 14) {
        this.wiringWarnings.push(`Alerta NBR 5410: Eletroduto ${c.id.substring(0, 10)} com ${numWires} condutores (taxa de ocupação excessiva > 40%). Recomenda-se desmembrar circuito.`);
      }
    }

    // Verificar nós elétricos isolados (sem eletroduto até o QDC)
    for (const node of this.nodes) {
      if (node.type === 'distribution_board') continue;
      const hasConduit = this.conduits.some(c => c.nodeAId === node.id || c.nodeBId === node.id);
      if (!hasConduit) {
        this.wiringWarnings.push(`Ponto elétrico isolado (${node.type} C${node.circuitId || 1}): conecte um eletroduto até a luminária ou QDC para permitir a passagem da fiação.`);
      }
    }
  }

  // Lançamento Automático de Pontos NBR 5410 nos Ambientes
  autoPlaceRoomPoints() {
    this.saveSnapshot();
    let nextCirc = 1;

    for (const room of this.rooms) {
      const area = room.areaM2 || 12.0;

      // 1. Potência de Iluminação Mínima NBR 5410
      let ilumWatts = 100;
      if (area > 6) {
        ilumWatts += Math.floor((area - 6) / 4) * 60;
      }

      // 2. Inserir Luminária de Teto no Centro do Cômodo
      const lightNode = this.addNode('light_ceiling', { x: room.pos.x, y: room.pos.y }, 1, String.fromCharCode(96 + nextCirc));
      lightNode.powerWatts = ilumWatts;

      // 3. Inserir Interruptor Simples próximo à porta ou parede
      const swNode = this.addNode('switch_simple', { x: room.pos.x - 1.4, y: room.pos.y }, 1, String.fromCharCode(96 + nextCirc));

      // 4. Inserir TUGs mínimas conforme perímetro (1 a cada 5m)
      const approxPerimeter = Math.sqrt(area) * 4;
      const minTugs = area <= 6 ? 1 : Math.ceil(approxPerimeter / 5);

      const offsetRadius = 1.6;
      for (let i = 0; i < Math.min(minTugs, 4); i++) {
        const ang = (i * Math.PI) / 2;
        const tugPos = {
          x: room.pos.x + Math.cos(ang) * offsetRadius,
          y: room.pos.y + Math.sin(ang) * offsetRadius
        };
        const tug = this.addNode('outlet_medium', tugPos, 2);
        tug.powerWatts = 600;
      }

      nextCirc++;
    }

    this.recalculateWiring();
    this.notify();
  }

  // Traçar Eletrodutos Automáticos ligando chaves, lâmpadas e tomadas ao QDC
  autoRouteConduits() {
    this.saveSnapshot();
    const panel = this.nodes.find(n => n.type === 'distribution_board');
    const lights = this.nodes.filter(n => n.type.startsWith('light'));
    const switches = this.nodes.filter(n => n.type.startsWith('switch'));
    const outlets = this.nodes.filter(n => n.type.startsWith('outlet'));

    // 1. Ligar cada interruptor à lâmpada de mesmo comando
    for (const sw of switches) {
      const matchLight = lights.find(l => l.command === sw.command) || lights[0];
      if (matchLight) {
        this.addConduit(matchLight.id, sw.id, 'wall', 1);
      }
    }

    // 2. Ligar cada tomada à lâmpada mais próxima
    for (const out of outlets) {
      let nearestLight = null;
      let minD = Infinity;
      for (const l of lights) {
        const d = Math.hypot(out.position.x - l.position.x, out.position.y - l.position.y);
        if (d < minD) {
          minD = d;
          nearestLight = l;
        }
      }
      if (nearestLight) {
        this.addConduit(nearestLight.id, out.id, 'ceiling', -1);
      }
    }

    // 3. Ligar as lâmpadas centrais entre si em cascata
    for (let i = 0; i < lights.length - 1; i++) {
      this.addConduit(lights[i].id, lights[i + 1].id, 'ceiling', 1);
    }

    // 4. Ligar a primeira lâmpada ao QDC
    if (panel && lights.length > 0) {
      this.addConduit(panel.id, lights[0].id, 'ceiling', -1);
    }

    this.recalculateWiring();
    this.notify();
  }

  findNearestWall(worldPt, maxDist = 0.8) {
    let closest = null;
    let minD = maxDist;

    for (const w of this.walls) {
      const proj = Vector2D.projectOnSegment(worldPt, w.a, w.b);
      if (proj.distance < minD) {
        minD = proj.distance;
        const angle = Math.atan2(w.b.y - w.a.y, w.b.x - w.a.x);
        closest = {
          wall: w,
          point: proj.point,
          t: proj.t,
          distance: proj.distance,
          angle
        };
      }
    }
    return closest;
  }

  getCornerThickness(wall, pt) {
    let thick = wall.thickness || 0.15;
    for (const ow of this.walls) {
      if (ow.id === wall.id) continue;
      const distA = Math.hypot(ow.a.x - pt.x, ow.a.y - pt.y);
      const distB = Math.hypot(ow.b.x - pt.x, ow.b.y - pt.y);
      if (distA < 0.08 || distB < 0.08) {
        if (ow.thickness) return ow.thickness;
      }
    }
    return thick;
  }

  findSnap(screenPt) {
    let closestDist = 26;
    const rawWorld = this.viewport.screenToWorld(screenPt);
    let best = { snapped: false, point: rawWorld, type: null };
    this.polarGuide = null;

    // 1. Snap a nós elétricos (Prioridade 1)
    if (this.layers.electric) {
      for (const node of this.nodes) {
        const sPos = this.viewport.worldToScreen(node.position);
        const d = sPos.distanceTo(screenPt);
        if (d < closestDist) {
          closestDist = d;
          best = { snapped: true, point: new Vector2D(node.position.x, node.position.y), targetNodeId: node.id, type: 'node' };
        }
      }
    }

    // 1.1 Snap a Prumadas Verticais
    if (this.layers.electric && this.risers) {
      for (const riser of this.risers) {
        const sPos = this.viewport.worldToScreen(riser.position);
        const d = sPos.distanceTo(screenPt);
        if (d < closestDist) {
          closestDist = d;
          best = { snapped: true, point: new Vector2D(riser.position.x, riser.position.y), type: 'riser', riserId: riser.id, label: `Prumada ${riser.name}` };
        }
      }
    }

    // 1.5 Snap a Aberturas Arquitetônicas (Portas e Janelas: Marcos/Batentes e Centro do Vão)
    if (this.layers.openings) {
      const openingTol = 25;

      // Portas: Batente A, Batente B e Centro
      for (const d of this.doors) {
        const rad = d.radius || 0.80;
        const hw = rad / 2;
        const rot = d.rotation || 0;
        const u = new Vector2D(Math.cos(rot), Math.sin(rot));
        const pts = [
          { pt: new Vector2D(d.pos.x - u.x * hw, d.pos.y - u.y * hw), type: 'door_jamb', label: 'Marco da Porta (Batente)' },
          { pt: new Vector2D(d.pos.x + u.x * hw, d.pos.y + u.y * hw), type: 'door_jamb', label: 'Marco da Porta (Batente)' },
          { pt: new Vector2D(d.pos.x, d.pos.y), type: 'door_center', label: 'Centro da Porta' }
        ];
        for (const item of pts) {
          const s = this.viewport.worldToScreen(item.pt);
          const dScreen = s.distanceTo(screenPt);
          if (dScreen < closestDist && dScreen < openingTol) {
            closestDist = dScreen;
            best = { snapped: true, point: item.pt, type: item.type, label: item.label };
          }
        }
      }

      // Janelas: Batente A, Batente B e Centro
      for (const w of this.windows) {
        const width = w.width || 1.20;
        const hw = width / 2;
        const rot = w.rotation || 0;
        const u = new Vector2D(Math.cos(rot), Math.sin(rot));
        const pts = [
          { pt: new Vector2D(w.pos.x - u.x * hw, w.pos.y - u.y * hw), type: 'window_jamb', label: 'Marco da Janela (Batente)' },
          { pt: new Vector2D(w.pos.x + u.x * hw, w.pos.y + u.y * hw), type: 'window_jamb', label: 'Marco da Janela (Batente)' },
          { pt: new Vector2D(w.pos.x, w.pos.y), type: 'window_center', label: 'Centro da Janela' }
        ];
        for (const item of pts) {
          const s = this.viewport.worldToScreen(item.pt);
          const dScreen = s.distanceTo(screenPt);
          if (dScreen < closestDist && dScreen < openingTol) {
            closestDist = dScreen;
            best = { snapped: true, point: item.pt, type: item.type, label: item.label };
          }
        }
      }
    }

    // 2. Snap da Boneca de 10 cm para Portas (Offset de 10cm da face acabada da alvenaria concorrente)
    if (this.activeTool === 'door' && this.layers.openings) {
      const near = this.findNearestWall(rawWorld, 0.7);
      if (near) {
        const w = near.wall;
        const wLen = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);
        const doorW = this.currentDoorWidth || 0.80;

        const tA = this.getCornerThickness(w, w.a);
        const tB = this.getCornerThickness(w, w.b);
        const bonecaDistA = (tA / 2) + 0.10 + (doorW / 2);
        const bonecaDistB = (tB / 2) + 0.10 + (doorW / 2);

        if (wLen > doorW + 0.20) {
          const u = new Vector2D((w.b.x - w.a.x) / wLen, (w.b.y - w.a.y) / wLen);
          const ptBonecaA = new Vector2D(w.a.x + u.x * bonecaDistA, w.a.y + u.y * bonecaDistA);
          const ptBonecaB = new Vector2D(w.b.x - u.x * bonecaDistB, w.b.y - u.y * bonecaDistB);

          const sBA = this.viewport.worldToScreen(ptBonecaA);
          const sBB = this.viewport.worldToScreen(ptBonecaB);

          if (sBA.distanceTo(screenPt) < 25) {
            return { snapped: true, point: ptBonecaA, wall: w, angle: near.angle, type: 'boneca', label: 'Boneca 10 cm (face)' };
          }
          if (sBB.distanceTo(screenPt) < 25) {
            return { snapped: true, point: ptBonecaB, wall: w, angle: near.angle, type: 'boneca', label: 'Boneca 10 cm (face)' };
          }
        }
      }
    }

    // 3. Snap Perpendicular Exato (⟂) ao desenhar parede contínua (mantém o Ortho ativo!)
    if (this.snapSettings.perpendicular && this.layers.walls && (this.activeTool === 'wall' || this.activeTool === 'room_divider') && this.wallStartPoint) {
      const S = this.wallStartPoint;

      for (const w of this.walls) {
        // Testar projeção horizontal a partir de S (raio ao longo de X)
        const yMin = Math.min(w.a.y, w.b.y);
        const yMax = Math.max(w.a.y, w.b.y);
        if (S.y >= yMin - 0.05 && S.y <= yMax + 0.05 && Math.abs(w.b.y - w.a.y) > 0.001) {
          const t = (S.y - w.a.y) / (w.b.y - w.a.y);
          if (t >= 0 && t <= 1) {
            const xPerp = w.a.x + t * (w.b.x - w.a.x);
            const ptPerp = new Vector2D(xPerp, S.y);
            const sPerp = this.viewport.worldToScreen(ptPerp);
            if (sPerp.distanceTo(screenPt) < 32) {
              const deg = xPerp >= S.x ? 0 : 180;
              this.polarGuide = { start: S, angleDeg: deg, dist: S.distanceTo(ptPerp) };
              return { snapped: true, point: ptPerp, wall: w, type: 'perpendicular', label: 'Perpendicular 90°' };
            }
          }
        }

        // Testar projeção vertical a partir de S (raio ao longo de Y)
        const xMin = Math.min(w.a.x, w.b.x);
        const xMax = Math.max(w.a.x, w.b.x);
        if (S.x >= xMin - 0.05 && S.x <= xMax + 0.05 && Math.abs(w.b.x - w.a.x) > 0.001) {
          const t = (S.x - w.a.x) / (w.b.x - w.a.x);
          if (t >= 0 && t <= 1) {
            const yPerp = w.a.y + t * (w.b.y - w.a.y);
            const ptPerp = new Vector2D(S.x, yPerp);
            const sPerp = this.viewport.worldToScreen(ptPerp);
            if (sPerp.distanceTo(screenPt) < 32) {
              const deg = yPerp >= S.y ? 90 : 270;
              this.polarGuide = { start: S, angleDeg: deg, dist: S.distanceTo(ptPerp) };
              return { snapped: true, point: ptPerp, wall: w, type: 'perpendicular', label: 'Perpendicular 90°' };
            }
          }
        }
      }
    }

    // 4. Snap às Faces e Quinas da Alvenaria (Faces Internas e Externas que delimitam ambientes)
    if (this.layers.walls && this.walls.length > 0) {
      const geoms = this.computeWallGeometries();
      const faceTol = (this.activeTool === 'dimension' && this.dimensionSnapMode === 'faces') ? 25 : 18;

      // 4.1 Quinas das faces internas e externas (a1, a2, b1, b2)
      if (this.snapSettings.endpoint && this.dimensionSnapMode !== 'axes') {
        for (const g of geoms) {
          const corners = [
            { pt: g.a1, label: 'Quina da Parede (Face)' },
            { pt: g.a2, label: 'Quina da Parede (Face)' },
            { pt: g.b1, label: 'Quina da Parede (Face)' },
            { pt: g.b2, label: 'Quina da Parede (Face)' }
          ];
          for (const c of corners) {
            const sPt = this.viewport.worldToScreen(c.pt);
            const d = sPt.distanceTo(screenPt);
            if (d < closestDist && d < faceTol) {
              closestDist = d;
              best = {
                snapped: true,
                point: new Vector2D(c.pt.x, c.pt.y),
                wall: g.wall,
                type: 'wall_face_corner',
                label: c.label
              };
            }
          }
        }
      }

      // 4.2 Arestas lineares das Faces Internas e Externas (linhas a1-b1 e a2-b2)
      if (this.snapSettings.nearest && this.dimensionSnapMode !== 'axes') {
        for (const g of geoms) {
          const faces = [
            { a: g.a1, b: g.b1, label: 'Face da Parede' },
            { a: g.a2, b: g.b2, label: 'Face da Parede' }
          ];
          for (const f of faces) {
            const proj = Vector2D.projectOnSegment(rawWorld, f.a, f.b);
            const sProj = this.viewport.worldToScreen(proj.point);
            const d = sProj.distanceTo(screenPt);
            if (d < closestDist && d < faceTol) {
              closestDist = d;
              best = {
                snapped: true,
                point: proj.point,
                wall: g.wall,
                type: 'wall_face',
                label: f.label
              };
            }
          }
        }
      }
    }

    // 5. Snap a Vértices do Eixo Central da Parede (Endpoint)
    if (this.snapSettings.endpoint && this.layers.walls && this.dimensionSnapMode !== 'faces' && (this.activeTool !== 'dimension' || this.dimensionSnapMode === 'axes' || !best.snapped)) {
      for (const wall of this.walls) {
        const sA = this.viewport.worldToScreen(wall.a);
        const sB = this.viewport.worldToScreen(wall.b);
        const dA = sA.distanceTo(screenPt);
        const dB = sB.distanceTo(screenPt);

        if (dA < closestDist) {
          closestDist = dA;
          best = { snapped: true, point: new Vector2D(wall.a.x, wall.a.y), wall, handle: 'a', type: 'endpoint', label: 'Eixo da Parede' };
        }
        if (dB < closestDist) {
          closestDist = dB;
          best = { snapped: true, point: new Vector2D(wall.b.x, wall.b.y), wall, handle: 'b', type: 'endpoint', label: 'Eixo da Parede' };
        }
      }
    }

    // 6. Snap a Ponto Médio de Parede (Midpoint)
    if (this.snapSettings.midpoint && this.layers.walls && !best.snapped) {
      for (const wall of this.walls) {
        const midWorld = new Vector2D((wall.a.x + wall.b.x) / 2, (wall.a.y + wall.b.y) / 2);
        const sMid = this.viewport.worldToScreen(midWorld);
        const dMid = sMid.distanceTo(screenPt);
        if (dMid < closestDist) {
          closestDist = dMid;
          best = { snapped: true, point: midWorld, wall, type: 'midpoint', label: 'Ponto Médio' };
        }
      }
    }

    // 7. Rastreamento Polar / Ortho (0°, 45°, 90°, etc.)
    if (this.snapSettings.ortho45 && (this.activeTool === 'wall' || this.activeTool === 'room_divider') && this.wallStartPoint && !best.snapped) {
      const curWorld = this.viewport.screenToWorld(screenPt);
      const dx = curWorld.x - this.wallStartPoint.x;
      const dy = curWorld.y - this.wallStartPoint.y;
      const rawDist = Math.hypot(dx, dy);

      if (rawDist > 0.25) {
        const rawAngle = Math.atan2(dy, dx);
        const step = Math.PI / 4;
        const snapIndex = Math.round(rawAngle / step);
        const snapAngle = snapIndex * step;
        const angleDiff = Math.abs(rawAngle - snapAngle);

        if (angleDiff < 0.16) {
          const snapPt = new Vector2D(
            this.wallStartPoint.x + Math.cos(snapAngle) * rawDist,
            this.wallStartPoint.y + Math.sin(snapAngle) * rawDist
          );
          let deg = Math.round((snapAngle * 180) / Math.PI);
          if (deg < 0) deg += 360;

          best = { snapped: true, point: snapPt, type: 'polar', angleDeg: deg };
          this.polarGuide = { start: this.wallStartPoint, angleDeg: deg, dist: rawDist };
        }
      }
    }

    // 8. Snap a Segmento do Eixo da Parede (Nearest on segment)
    if (this.snapSettings.nearest && this.layers.walls && !best.snapped && this.dimensionSnapMode !== 'faces') {
      const near = this.findNearestWall(rawWorld, 0.45);
      if (near) {
        const sNear = this.viewport.worldToScreen(near.point);
        if (sNear.distanceTo(screenPt) < closestDist) {
          best = { snapped: true, point: near.point, wall: near.wall, angle: near.angle, type: 'nearest', label: 'Eixo da Parede' };
        }
      }
    }

    // 9. Snap a Elementos do Pavimento Subjacente (Underlay / Alinhamento Vertical)
    if (!best.snapped && this.underlayLevelId) {
      const underlay = this.levels ? this.levels.find(l => l.id === this.underlayLevelId) : null;
      if (underlay && underlay.walls) {
        for (const w of underlay.walls) {
          const sA = this.viewport.worldToScreen(w.a);
          const sB = this.viewport.worldToScreen(w.b);
          const dA = sA.distanceTo(screenPt);
          const dB = sB.distanceTo(screenPt);
          if (dA < closestDist && dA < 20) {
            closestDist = dA;
            best = { snapped: true, point: new Vector2D(w.a.x, w.a.y), type: 'underlay_vertex', label: 'Canto do Pavimento Subjacente' };
          } else if (dB < closestDist && dB < 20) {
            closestDist = dB;
            best = { snapped: true, point: new Vector2D(w.b.x, w.b.y), type: 'underlay_vertex', label: 'Canto do Pavimento Subjacente' };
          }
        }
      }
    }

    return best;
  }

  onMouseDown(screenPt, button) {
    if (button === 1 || this.activeTool === 'pan') {
      this.isPanning = true;
      this.dragStartScreen = screenPt;
      return;
    }

    // Clique com botão direito cancela ferramenta ativa ou cadeia de paredes
    if (button === 2) {
      if (this.wallStartPoint) {
        this.wallStartPoint = null;
        this.polarGuide = null;
        this.notify();
      } else {
        this.activeTool = 'select';
        this.notify();
      }
      return;
    }

    if (button !== 0) return;

    const snap = this.findSnap(screenPt);
    const worldPos = snap.snapped ? snap.point : this.viewport.screenToWorld(screenPt);
    this.dragStartWorld = worldPos;

    // 0.5 Inserir Prumada Vertical (Eletroduto que sobe / desce entre pavimentos)
    if (this.activeTool === 'riser') {
      const curL = this.levels ? this.levels.find(l => l.id === this.activeLevelId) : null;
      const otherL = this.levels ? this.levels.find(l => l.id !== this.activeLevelId) : null;
      if (!otherL || !curL) {
        alert('Para inserir uma prumada vertical, crie antes um segundo pavimento no Gerenciador de Pavimentos.');
        return;
      }
      const fromId = curL.elevation < otherL.elevation ? curL.id : otherL.id;
      const toId = curL.elevation < otherL.elevation ? otherL.id : curL.id;
      this.addRiser(worldPos, fromId, toId);
      this.activeTool = 'select';
      this.notify();
      return;
    }

    // 1. Inserir Ponto Elétrico
    if (this.activeTool === 'add_node') {
      this.addNode(this.pendingNodeType, worldPos);
      return;
    }

    // 2. Conectar Eletroduto
    if (this.activeTool === 'conduit') {
      if (snap.snapped && snap.targetNodeId) {
        if (!this.conduitStartNodeId) {
          this.conduitStartNodeId = snap.targetNodeId;
        } else {
          this.addConduit(this.conduitStartNodeId, snap.targetNodeId);
          this.conduitStartNodeId = null;
        }
        this.notify();
      } else {
        this.conduitStartNodeId = null;
      }
      return;
    }

    // 3. Desenhar Parede Dupla
    if (this.activeTool === 'wall') {
      if (!this.wallStartPoint) {
        this.wallStartPoint = worldPos;
      } else {
        const dist = Math.hypot(worldPos.x - this.wallStartPoint.x, worldPos.y - this.wallStartPoint.y);
        if (dist > 0.15) {
          this.saveSnapshot();
          this.walls.push({
            id: `wall_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            a: { x: this.wallStartPoint.x, y: this.wallStartPoint.y },
            b: { x: worldPos.x, y: worldPos.y },
            thickness: this.currentWallThickness || 0.15
          });
          this.wallStartPoint = worldPos;
          this.notify();
        }
      }
      return;
    }

    // 4. Desenhar Delimitador de Ambiente (Linha virtual)
    if (this.activeTool === 'room_divider') {
      if (!this.wallStartPoint) {
        this.wallStartPoint = worldPos;
      } else {
        const dist = Math.hypot(worldPos.x - this.wallStartPoint.x, worldPos.y - this.wallStartPoint.y);
        if (dist > 0.15) {
          this.saveSnapshot();
          this.roomDividers.push({
            id: `div_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            a: { x: this.wallStartPoint.x, y: this.wallStartPoint.y },
            b: { x: worldPos.x, y: worldPos.y }
          });
          this.wallStartPoint = null;
          this.activeTool = 'select';
          this.notify();
        }
      }
      return;
    }

    // 5. Inserir Porta com Aderência ESTRITA à Parede (Bloqueia inserção flutuante)
    if (this.activeTool === 'door') {
      const near = this.findNearestWall(worldPos, 0.7);
      if (!near) {
        if (typeof window !== 'undefined' && window.__showToast) {
          window.__showToast('⚠️ Portas devem ser inseridas sobre uma alvenaria existente!', 'warning');
        }
        return;
      }
      const angle = near.angle;
      const basePos = snap.snapped && snap.type === 'boneca' ? snap.point : near.point;

      this.saveSnapshot();
      this.doors.push({
        id: `door_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        pos: { x: basePos.x, y: basePos.y },
        wallId: near.wall.id,
        radius: this.currentDoorWidth || 0.8,
        type: this.currentDoorType || 'abrir',
        orientationIndex: this.doorOrientationIndex || 0,
        rotation: angle
      });
      this.activeTool = 'select';
      this.notify();
      return;
    }

    // 6. Inserir Janela com Aderência ESTRITA à Parede
    if (this.activeTool === 'window') {
      const near = this.findNearestWall(worldPos, 0.7);
      if (!near) {
        if (typeof window !== 'undefined' && window.__showToast) {
          window.__showToast('⚠️ Janelas devem ser inseridas sobre uma alvenaria existente!', 'warning');
        }
        return;
      }
      const angle = near.angle;
      const basePos = near.point;

      this.saveSnapshot();
      this.windows.push({
        id: `win_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        pos: { x: basePos.x, y: basePos.y },
        wallId: near.wall.id,
        width: this.currentWindowWidth || 1.2,
        rotation: angle
      });
      this.activeTool = 'select';
      this.notify();
      return;
    }

    // 7. Inserir Ambiente / Cômodo (com prevenção de sobreposição)
    if (this.activeTool === 'room') {
      for (const r of this.rooms) {
        if (Math.hypot(r.pos.x - worldPos.x, r.pos.y - worldPos.y) < 1.6) {
          if (typeof window !== 'undefined' && window.__showToast) {
            window.__showToast('⚠️ Já existe um ambiente posicionado nesta área.', 'warning');
          }
          return;
        }
      }

      this.saveSnapshot();
      this.rooms.push({
        id: `room_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        name: this.currentRoomName || 'SALA DE ESTAR',
        pos: { x: worldPos.x, y: worldPos.y },
        areaM2: 14.5
      });
      this.activeTool = 'select';
      this.notify();
      return;
    }

    // 7.1 Inserir Cota Técnica Linear / Alinhada (NBR 6492 - Fluxo Profissional em 3 Passos)
    if (this.activeTool === 'dimension') {
      const snapPt = snap.snapped ? snap.point : worldPos;

      // PASSO 1: Fixar Ponto Origem (A)
      if (this.dimStage === 0 || !this.dimStartPoint) {
        this.dimStartPoint = { x: snapPt.x, y: snapPt.y };
        this.dimEndPoint = null;
        this.dimStage = 1;
        if (typeof window !== 'undefined' && window.__showToast) {
          window.__showToast('Origem da cota definida. Clique no segundo ponto (destino).');
        }
      }
      // PASSO 2: Fixar Ponto Destino (B) e passar para o ajuste de Offset
      else if (this.dimStage === 1) {
        const len = Math.hypot(snapPt.x - this.dimStartPoint.x, snapPt.y - this.dimStartPoint.y);
        if (len > 0.05) {
          this.dimEndPoint = { x: snapPt.x, y: snapPt.y };
          this.dimStage = 2;
          this.dimPendingOffset = 0.40;
          if (typeof window !== 'undefined' && window.__showToast) {
            window.__showToast('Mova o mouse para posicionar a linha de cota e clique para fixar (Esc para cancelar).');
          }
        }
      }
      // PASSO 3: Fixar Offset e Concluir Inserção
      else if (this.dimStage === 2) {
        const ptA = this.dimStartPoint;
        const ptB = this.dimEndPoint;
        const len = Math.hypot(ptB.x - ptA.x, ptB.y - ptA.y);
        if (len > 0.05) {
          this.saveSnapshot();
          this.dimensions.push({
            id: `dim_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            a: { x: ptA.x, y: ptA.y },
            b: { x: ptB.x, y: ptB.y },
            dist: Number(len.toFixed(2)),
            offset: Number(this.dimPendingOffset.toFixed(2))
          });
          const insertedDist = len.toFixed(2);
          this.dimStartPoint = null;
          this.dimEndPoint = null;
          this.dimStage = 0;
          this.notify();
          if (typeof window !== 'undefined' && window.__showToast) {
            window.__showToast(`Cota técnica NBR 6492 fixada: ${insertedDist} m!`);
          }
        }
      }
      return;
    }

    // 8. Ferramenta Selecionar (Com suporte à Alternância de Seleção por Tab)
    if (this.activeTool === 'select') {
      // 8.0 Se uma parede está selecionada, prioriza clique direto sobre o rótulo da cota vinculada
      if (this.selectedElement && this.selectedElement.type === 'wall' && typeof this.selectedElement.index === 'number') {
        const drivingHit = this.getDrivingDimensionAtScreen(screenPt);
        if (drivingHit) {
          if (this.onEditDrivingDimension) {
            this.onEditDrivingDimension(drivingHit);
          }
          return;
        }
      }
      // 8.1 Se temos um candidato ativo pela tecla Tab sob o cursor, seleciona-o diretamente!
      if (this.hoverCandidates && this.hoverCandidates.length > 0) {
        const cand = this.hoverCandidates[this.hoverCandidateIndex] || this.hoverCandidates[0];
        if (cand.type === 'door') {
          this.selectedElement = { type: 'door', index: cand.index };
          this.selectedNodeId = null;
          this.isDragging = true;
          this.notify();
          return;
        } else if (cand.type === 'window') {
          this.selectedElement = { type: 'window', index: cand.index };
          this.selectedNodeId = null;
          this.isDragging = true;
          this.notify();
          return;
        } else if (cand.type === 'node') {
          this.selectedNodeId = cand.id;
          this.selectedElement = { type: 'node', id: cand.id };
          this.isDragging = true;
          this.notify();
          return;
        } else if (cand.type === 'wall') {
          this.selectedElement = { type: 'wall', index: cand.index, handle: cand.handle };
          this.selectedNodeId = null;
          this.isDragging = true;
          if (cand.handle) {
            const w = this.walls[cand.index];
            if (w) this.collectConnectedWallVertices(cand.handle === 'a' ? w.a : w.b);
          }
          this.notify();
          return;
        } else if (cand.type === 'wall_segment') {
          this.selectedElement = { type: 'wall', index: cand.index };
          this.selectedNodeId = null;
          this.isDragging = false;
          this.notify();
          return;
        } else if (cand.type === 'room') {
          this.selectedElement = { type: 'room', index: cand.index };
          this.selectedNodeId = null;
          this.isDragging = true;
          this.notify();
          return;
        } else if (cand.type === 'dimension') {
          this.selectedElement = { type: 'dimension', index: cand.index };
          this.selectedNodeId = null;
          this.isDragging = true;
          this.notify();
          return;
        } else if (cand.type === 'conduit') {
          this.selectedElement = { type: 'conduit', id: cand.id, conduit: cand.conduit };
          this.selectedNodeId = null;
          this.isDragging = false;
          this.notify();
          return;
        } else if (cand.type === 'wire_tag') {
          this.selectedElement = { type: 'wire_tag', conduitId: cand.conduitId, conduit: cand.conduit };
          this.selectedNodeId = null;
          this.isDragging = true;
          this.notify();
          return;
        } else if (cand.type === 'node_label') {
          this.selectedElement = { type: 'node_label', id: cand.id, node: cand.node };
          this.selectedNodeId = cand.id;
          this.isDragging = true;
          this.notify();
          return;
        } else if (cand.type === 'unifilar') {
          this.selectedElement = { type: 'unifilar' };
          this.selectedNodeId = null;
          this.isDragging = true;
          this.notify();
          return;
        }
      }

      // 8.2 Fallback: Checar se clicou sobre o Diagrama Unifilar (QD1)
      const unifilarScreen = this.viewport.worldToScreen(this.sldPosition);
      const sc = this.viewport.zoom / 55;
      const uW = 340 * sc;
      const uH = 205 * sc;
      if (
        screenPt.x >= unifilarScreen.x - 12 * sc &&
        screenPt.x <= unifilarScreen.x + uW &&
        screenPt.y >= unifilarScreen.y - 32 * sc &&
        screenPt.y <= unifilarScreen.y + uH
      ) {
        this.selectedElement = { type: 'unifilar' };
        this.isDragging = true;
        this.notify();
        return;
      }

      // 8.3 Prioridade para Portas e Janelas (sempre selecionáveis)
      if (this.layers.openings) {
        for (let i = 0; i < this.doors.length; i++) {
          const d = this.doors[i];
          const sD = this.viewport.worldToScreen(d.pos);
          if (sD.distanceTo(screenPt) < 24) {
            this.selectedElement = { type: 'door', index: i };
            this.isDragging = true;
            this.notify();
            return;
          }
        }

        for (let i = 0; i < this.windows.length; i++) {
          const w = this.windows[i];
          const sW = this.viewport.worldToScreen(w.pos);
          if (sW.distanceTo(screenPt) < 24) {
            this.selectedElement = { type: 'window', index: i };
            this.isDragging = true;
            this.notify();
            return;
          }
        }

        if (this.layers.rooms) {
          for (let i = 0; i < this.rooms.length; i++) {
            const r = this.rooms[i];
            const sR = this.viewport.worldToScreen(r.pos);
            if (sR.distanceTo(screenPt) < 26) {
              this.selectedElement = { type: 'room', index: i };
              this.isDragging = true;
              this.notify();
              return;
            }
          }
        }
      }

      // 8.4 Nós Elétricos
      if (this.layers.electric && snap.snapped && snap.targetNodeId) {
        this.selectedNodeId = snap.targetNodeId;
        this.selectedElement = { type: 'node', id: snap.targetNodeId };
        this.isDragging = true;
        this.notify();
        return;
      }

      // 8.5 Cotas Técnicas (NBR 6492)
      if (this.layers.dimensions) {
        for (let i = 0; i < (this.dimensions || []).length; i++) {
          const dim = this.dimensions[i];
          const ptA = dim.a || dim.ptA;
          const ptB = dim.b || dim.ptB;
          if (!ptA || !ptB) continue;
          const off = dim.offset || 0.35;
          const L = Math.hypot(ptB.x - ptA.x, ptB.y - ptA.y);
          if (L > 0.05) {
            const u = new Vector2D((ptB.x - ptA.x) / L, (ptB.y - ptA.y) / L);
            const n = u.orthogonal();
            const midDim = new Vector2D((ptA.x + ptB.x) / 2 + n.x * off, (ptA.y + ptB.y) / 2 + n.y * off);
            const sMid = this.viewport.worldToScreen(midDim);
            if (sMid.distanceTo(screenPt) < 24) {
              this.selectedElement = { type: 'dimension', index: i };
              this.isDragging = true;
              this.notify();
              return;
            }
          }
        }
      }

      // 8.5.1 Fallback: Eletrodutos (NBR 5410)
      if (this.layers.conduits) {
        const nodeMap = new Map(this.nodes.map(n => [n.id, n]));
        for (const c of this.conduits) {
          const a = nodeMap.get(c.nodeAId);
          const b = nodeMap.get(c.nodeBId);
          if (!a || !b) continue;

          const sA = this.viewport.worldToScreen(a.position);
          const sB = this.viewport.worldToScreen(b.position);
          const mid = new Vector2D((sA.x + sB.x) / 2, (sA.y + sB.y) / 2);
          const dir = new Vector2D(sB.x - sA.x, sB.y - sA.y);
          const normal = dir.orthogonal().normalize();
          const curvatureAmount = Math.min(26, dir.length() * 0.16) * (c.curveDirection || 1);
          const ctrlPt = new Vector2D(mid.x + normal.x * curvatureAmount, mid.y + normal.y * curvatureAmount);

          let minDist = Infinity;
          for (let step = 0; step <= 10; step++) {
            const t = step / 10;
            const inv = 1 - t;
            const qx = inv * inv * sA.x + 2 * inv * t * ctrlPt.x + t * t * sB.x;
            const qy = inv * inv * sA.y + 2 * inv * t * ctrlPt.y + t * t * sB.y;
            const d = Math.hypot(screenPt.x - qx, screenPt.y - qy);
            if (d < minDist) minDist = d;
          }

          if (minDist < 14) {
            this.selectedElement = { type: 'conduit', id: c.id, conduit: c };
            this.selectedNodeId = null;
            this.isDragging = false;
            this.notify();
            return;
          }
        }
      }

      // 8.6 Vértices de Parede (Articulação Conjunta de Quinas)
      if (!this.isPlanLocked && this.layers.walls) {
        for (let i = 0; i < this.walls.length; i++) {
          const w = this.walls[i];
          const sA = this.viewport.worldToScreen(w.a);
          const sB = this.viewport.worldToScreen(w.b);
          if (sA.distanceTo(screenPt) < 14) {
            this.selectedElement = { type: 'wall', index: i, handle: 'a' };
            this.isDragging = true;
            this.collectConnectedWallVertices(w.a);
            this.notify();
            return;
          }
          if (sB.distanceTo(screenPt) < 14) {
            this.selectedElement = { type: 'wall', index: i, handle: 'b' };
            this.isDragging = true;
            this.collectConnectedWallVertices(w.b);
            this.notify();
            return;
          }
        }

        // 8.6.1 Segmento de Parede (Corpo da parede para Cotas Paramétricas)
        for (let i = 0; i < this.walls.length; i++) {
          const w = this.walls[i];
          const proj = Vector2D.projectOnSegment(worldPos, w.a, w.b);
          const sProj = this.viewport.worldToScreen(proj.point);
          if (sProj.distanceTo(screenPt) < 14) {
            this.selectedElement = { type: 'wall', index: i };
            this.isDragging = false;
            this.notify();
            return;
          }
        }
      }

      // 8.7 Iniciar Seleção em Massa por Retângulo (Janela e Cruzamento)
      this.selectedNodeId = null;
      this.selectedElement = null;
      this.selectedElements = [];
      this.isSelectingBox = true;
      this.selectionBoxStart = screenPt;
      this.selectionBoxCurrent = screenPt;
      this.notify();
    }
  }

  onMouseMove(screenPt) {
    if (this.isPanning) {
      this.viewport.panBy(screenPt.x - this.dragStartScreen.x, screenPt.y - this.dragStartScreen.y);
      this.dragStartScreen = screenPt;
      return;
    }

    if (this.isSelectingBox) {
      this.selectionBoxCurrent = screenPt;
      this.notify();
      return;
    }

    const curWorld = this.viewport.screenToWorld(screenPt);

    if (this.isDragging) {
      // 1. Arrastar Diagrama Unifilar
      if (this.selectedElement && this.selectedElement.type === 'unifilar') {
        const dx = curWorld.x - this.dragStartWorld.x;
        const dy = curWorld.y - this.dragStartWorld.y;
        this.sldPosition.x += dx;
        this.sldPosition.y += dy;
        this.dragStartWorld = curWorld;
        return;
      }

      // 2. Movimentação de Nó Elétrico
      if (this.selectedElement && this.selectedElement.type === 'node') {
        const node = this.nodes.find(n => n.id === this.selectedElement.id);
        if (node) {
          node.position.x = curWorld.x;
          node.position.y = curWorld.y;
          this.recalculateWiring();
        }
      }
      // 3. Vértice de Parede (Articulação Conjunta de Quinas)
      else if (!this.isPlanLocked && this.selectedElement && this.selectedElement.type === 'wall' && this.selectedElement.handle) {
        const snap = this.findSnap(screenPt);
        const targetPt = snap.snapped && snap.type === 'endpoint' ? snap.point : curWorld;
        if (this.draggedWallVertices && this.draggedWallVertices.length > 0) {
          for (const item of this.draggedWallVertices) {
            const w = this.walls[item.wallIndex];
            if (w) {
              w[item.handle].x = targetPt.x;
              w[item.handle].y = targetPt.y;
            }
          }
        } else {
          const wall = this.walls[this.selectedElement.index];
          if (wall) {
            wall[this.selectedElement.handle].x = targetPt.x;
            wall[this.selectedElement.handle].y = targetPt.y;
          }
        }
      }
      // 3.1 Mover Cota Técnica (Ajustar Offset Perpendicular para Dentro / Fora)
      else if (this.selectedElement && this.selectedElement.type === 'dimension') {
        const dim = this.dimensions[this.selectedElement.index];
        if (dim) {
          const ptA = dim.a || dim.ptA;
          const ptB = dim.b || dim.ptB;
          const L = Math.hypot(ptB.x - ptA.x, ptB.y - ptA.y);
          if (L > 0.05) {
            const u = new Vector2D((ptB.x - ptA.x) / L, (ptB.y - ptA.y) / L);
            const n = u.orthogonal();
            const rawOffset = (curWorld.x - ptA.x) * n.x + (curWorld.y - ptA.y) * n.y;
            let off = Math.round(rawOffset * 20) / 20; // Incrementos de 0.05m
            if (Math.abs(off) < 0.10) off = off >= 0 ? 0.20 : -0.20;
            dim.offset = Number(off.toFixed(2));
            this.notify();
          }
        }
      }
      // 4. Mover Porta (desliza presa à parede com atracamento a 10cm da quina — 100% robusto)
      else if (this.selectedElement && this.selectedElement.type === 'door') {
        const door = this.doors[this.selectedElement.index];
        if (door) {
          const near = this.findNearestWall(curWorld, 1.4);
          if (near) {
            const w = near.wall;
            const wLen = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);
            const doorW = door.radius || 0.80;
            const tA = this.getCornerThickness(w, w.a);
            const tB = this.getCornerThickness(w, w.b);
            const bonecaDistA = (tA / 2) + 0.10 + (doorW / 2);
            const bonecaDistB = (tB / 2) + 0.10 + (doorW / 2);
            let targetPoint = near.point;

            if (wLen > doorW + 0.20) {
              const u = new Vector2D((w.b.x - w.a.x) / wLen, (w.b.y - w.a.y) / wLen);
              const ptBonecaA = new Vector2D(w.a.x + u.x * bonecaDistA, w.a.y + u.y * bonecaDistA);
              const ptBonecaB = new Vector2D(w.b.x - u.x * bonecaDistB, w.b.y - u.y * bonecaDistB);
              if (curWorld.distanceTo(ptBonecaA) < 0.35) targetPoint = ptBonecaA;
              else if (curWorld.distanceTo(ptBonecaB) < 0.35) targetPoint = ptBonecaB;
            }

            door.pos.x = targetPoint.x;
            door.pos.y = targetPoint.y;
            door.rotation = near.angle;
            door.wallId = near.wall.id;
            this.notify();
          }
        }
      }
      // 5. Mover Janela (desliza presa à parede)
      else if (this.selectedElement && this.selectedElement.type === 'window') {
        const win = this.windows[this.selectedElement.index];
        if (win) {
          const near = this.findNearestWall(curWorld, 1.2);
          if (near) {
            win.pos.x = near.point.x;
            win.pos.y = near.point.y;
            win.rotation = near.angle;
            win.wallId = near.wall.id;
          }
        }
      }
      // 6. Mover Ambiente
      else if (!this.isPlanLocked && this.selectedElement && this.selectedElement.type === 'room') {
        const room = this.rooms[this.selectedElement.index];
        if (room) {
          room.pos.x = curWorld.x;
          room.pos.y = curWorld.y;
        }
      }
      // 7. Deslizar Indicador de Fiação no Eletroduto
      else if (this.selectedElement && this.selectedElement.type === 'wire_tag') {
        const c = this.conduits.find(item => item.id === this.selectedElement.conduitId);
        if (c) {
          const nodeMap = new Map(this.nodes.map(n => [n.id, n]));
          const a = nodeMap.get(c.nodeAId);
          const b = nodeMap.get(c.nodeBId);
          if (a && b) {
            const sA = this.viewport.worldToScreen(a.position);
            const sB = this.viewport.worldToScreen(b.position);
            const mid = new Vector2D((sA.x + sB.x) / 2, (sA.y + sB.y) / 2);
            const dir = new Vector2D(sB.x - sA.x, sB.y - sA.y);
            const normal = dir.orthogonal().normalize();
            const curvatureAmount = Math.min(26, dir.length() * 0.16) * (c.curveDirection || 1);
            const ctrlPt = new Vector2D(mid.x + normal.x * curvatureAmount, mid.y + normal.y * curvatureAmount);

            let bestT = 0.5;
            let minD = Infinity;
            for (let step = 10; step <= 90; step++) {
              const tCand = step / 100;
              const mt = 1 - tCand;
              const qx = mt * mt * sA.x + 2 * mt * tCand * ctrlPt.x + tCand * tCand * sB.x;
              const qy = mt * mt * sA.y + 2 * mt * tCand * ctrlPt.y + tCand * tCand * sB.y;
              const d = Math.hypot(screenPt.x - qx, screenPt.y - qy);
              if (d < minD) {
                minD = d;
                bestT = tCand;
              }
            }
            c.wireT = Math.round(bestT * 100) / 100;
            this.notify();
          }
        }
      }
      // 8. Mover Rótulo Deslocado de Nó Elétrico (Chamada de Detalhe)
      else if (this.selectedElement && this.selectedElement.type === 'node_label') {
        const node = this.nodes.find(n => n.id === this.selectedElement.id);
        if (node) {
          node.labelOffset = {
            x: Math.round((curWorld.x - node.position.x) * 20) / 20,
            y: Math.round((curWorld.y - node.position.y) * 20) / 20
          };
          this.notify();
        }
      }
    }

    this.mouseScreenPos = screenPt;
    this.mouseWorldPos = curWorld;
    this.currentSnap = this.findSnap(screenPt);

    // Inserção de Cota Técnica (Passo 2 -> 3): cálculo dinâmico de offset e alinhamento magnético
    if (this.activeTool === 'dimension' && this.dimStage === 2 && this.dimStartPoint && this.dimEndPoint) {
      const ptA = this.dimStartPoint;
      const ptB = this.dimEndPoint;
      const L = Math.hypot(ptB.x - ptA.x, ptB.y - ptA.y);
      if (L > 0.05) {
        const u = new Vector2D((ptB.x - ptA.x) / L, (ptB.y - ptA.y) / L);
        const n = u.orthogonal();
        const rawOffset = (curWorld.x - ptA.x) * n.x + (curWorld.y - ptA.y) * n.y;

        // 1. Snap magnético padrão em múltiplos de 0.10m
        let snappedOffset = Math.round(rawOffset * 10) / 10;

        // 2. Snap magnético de alinhamento com outras cotas existentes (paralelas)
        for (const existDim of (this.dimensions || [])) {
          const eA = existDim.a || existDim.ptA;
          const eB = existDim.b || existDim.ptB;
          if (!eA || !eB) continue;
          const eLen = Math.hypot(eB.x - eA.x, eB.y - eA.y);
          if (eLen < 0.05) continue;
          const eu = new Vector2D((eB.x - eA.x) / eLen, (eB.y - eA.y) / eLen);
          const dot = Math.abs(eu.x * u.x + eu.y * u.y);
          if (dot > 0.95) {
            const eOff = existDim.offset || 0.35;
            const en = eu.orthogonal();
            const eMid = new Vector2D((eA.x + eB.x) / 2 + en.x * eOff, (eA.y + eB.y) / 2 + en.y * eOff);
            const testOffset = (eMid.x - ptA.x) * n.x + (eMid.y - ptA.y) * n.y;
            if (Math.abs(rawOffset - testOffset) < 0.18) {
              snappedOffset = Number(testOffset.toFixed(2));
              break;
            }
          }
        }

        if (Math.abs(snappedOffset) < 0.10) {
          snappedOffset = snappedOffset >= 0 ? 0.25 : -0.25;
        }

        this.dimPendingOffset = snappedOffset;
      }
    }

    if (this.activeTool === 'select' && !this.isDragging) {
      if (this.selectedElement && this.selectedElement.type === 'wall' && typeof this.selectedElement.index === 'number') {
        this.hoverDrivingDimension = this.getDrivingDimensionAtScreen(screenPt);
      } else {
        this.hoverDrivingDimension = null;
      }
      this.updateHoverCandidates(screenPt);
    } else {
      this.hoverCandidates = [];
      this.hoverDrivingDimension = null;
    }
  }

  updateHoverCandidates(screenPt) {
    const candidates = [];
    const worldPt = this.viewport.screenToWorld(screenPt);

    // 1. Portas
    if (this.layers.openings) {
      for (let i = 0; i < this.doors.length; i++) {
        const d = this.doors[i];
        const sD = this.viewport.worldToScreen(d.pos);
        if (sD.distanceTo(screenPt) < 28) {
          candidates.push({
            type: 'door',
            index: i,
            label: `Porta (${(d.radius || 0.8).toFixed(2)}m)`,
            pos: d.pos
          });
        }
      }
    }

    // 2. Janelas
    if (this.layers.openings) {
      for (let i = 0; i < this.windows.length; i++) {
        const w = this.windows[i];
        const sW = this.viewport.worldToScreen(w.pos);
        if (sW.distanceTo(screenPt) < 28) {
          candidates.push({
            type: 'window',
            index: i,
            label: `Janela (${(w.width || 1.2).toFixed(2)}m)`,
            pos: w.pos
          });
        }
      }
    }

    // 3. Pontos Elétricos
    if (this.layers.electric) {
      for (const node of this.nodes) {
        const sN = this.viewport.worldToScreen(node.position);
        if (sN.distanceTo(screenPt) < 22) {
          const typeName = node.type === 'light_ceiling' ? 'Luz de Teto' 
            : node.type.startsWith('outlet') ? 'Tomada' 
            : node.type.startsWith('switch') ? 'Interruptor' 
            : node.type === 'combo_switch_outlet' ? 'Conjugado (Int. + Tomada)'
            : node.type === 'combo_switch_switch' ? 'Interruptor 2 Seções'
            : 'Quadro QD';
          candidates.push({
            type: 'node',
            id: node.id,
            label: `${typeName} (Circ. ${node.circuitId || 1})`,
            pos: node.position
          });
        }
      }

      // 3.1 Rótulo Deslocado de Ponto Elétrico (Chamada de Detalhe)
      for (const node of this.nodes) {
        if (node.labelOffset && (Math.abs(node.labelOffset.x) > 0.05 || Math.abs(node.labelOffset.y) > 0.05)) {
          const lblWorld = new Vector2D(node.position.x + node.labelOffset.x, node.position.y + node.labelOffset.y);
          const sLbl = this.viewport.worldToScreen(lblWorld);
          if (sLbl.distanceTo(screenPt) < 22) {
            candidates.push({
              type: 'node_label',
              id: node.id,
              node: node,
              label: `Rótulo C${node.circuitId || 1} (Arraste para mover)`,
              pos: lblWorld
            });
          }
        }
      }
    }

    // 4. Vértices de Parede
    if (!this.isPlanLocked && this.layers.walls) {
      for (let i = 0; i < this.walls.length; i++) {
        const w = this.walls[i];
        const sA = this.viewport.worldToScreen(w.a);
        const sB = this.viewport.worldToScreen(w.b);
        if (sA.distanceTo(screenPt) < 18) {
          candidates.push({
            type: 'wall',
            index: i,
            handle: 'a',
            label: `Vértice A da Parede W${i + 1}`,
            pos: w.a
          });
        }
        if (sB.distanceTo(screenPt) < 18) {
          candidates.push({
            type: 'wall',
            index: i,
            handle: 'b',
            label: `Vértice B da Parede W${i + 1}`,
            pos: w.b
          });
        }
      }
    }

    // 5. Segmentos de Parede (corpo da parede)
    if (!this.isPlanLocked && this.layers.walls) {
      const near = this.findNearestWall(worldPt, 0.45);
      if (near && near.wall) {
        const wIdx = this.walls.indexOf(near.wall);
        if (wIdx >= 0) {
          const hasVertex = candidates.some(c => c.type === 'wall' && c.index === wIdx);
          if (!hasVertex) {
            candidates.push({
              type: 'wall_segment',
              index: wIdx,
              label: `Parede de Alvenaria W${wIdx + 1} (${((near.wall.thickness || 0.15) * 100).toFixed(0)}cm)`,
              pos: near.point
            });
          }
        }
      }
    }

    // 6. Ambientes
    if (this.layers.rooms) {
      for (let i = 0; i < this.rooms.length; i++) {
        const r = this.rooms[i];
        const sR = this.viewport.worldToScreen(r.pos);
        if (sR.distanceTo(screenPt) < 32) {
          candidates.push({
            type: 'room',
            index: i,
            label: `Ambiente: ${r.name}`,
            pos: r.pos
          });
        }
      }
    }

    // 7. Diagrama Unifilar
    const unifilarScreen = this.viewport.worldToScreen(this.sldPosition);
    const sc = this.viewport.zoom / 55;
    const uW = 340 * sc;
    const uH = 205 * sc;
    if (
      screenPt.x >= unifilarScreen.x - 12 * sc &&
      screenPt.x <= unifilarScreen.x + uW &&
      screenPt.y >= unifilarScreen.y - 32 * sc &&
      screenPt.y <= unifilarScreen.y + uH
    ) {
      candidates.push({
        type: 'unifilar',
        label: 'Diagrama Unifilar Móvel (QD1)',
        pos: this.sldPosition
      });
    }

    // 8. Cotas Técnicas (NBR 6492)
    if (this.layers.dimensions) {
      for (let i = 0; i < (this.dimensions || []).length; i++) {
        const dim = this.dimensions[i];
        if (!dim) continue;
        const ptA = dim.a || dim.ptA;
        const ptB = dim.b || dim.ptB;
        if (!ptA || !ptB) continue;
        const off = dim.offset || 0.35;
        const L = Math.hypot(ptB.x - ptA.x, ptB.y - ptA.y);
        if (L > 0.05) {
          const u = new Vector2D((ptB.x - ptA.x) / L, (ptB.y - ptA.y) / L);
          const n = u.orthogonal();
          const midDim = new Vector2D((ptA.x + ptB.x) / 2 + n.x * off, (ptA.y + ptB.y) / 2 + n.y * off);
          const sMid = this.viewport.worldToScreen(midDim);
          if (sMid.distanceTo(screenPt) < 26) {
            candidates.push({
              type: 'dimension',
              index: i,
              label: `Cota NBR 6492: ${L.toFixed(2)}m`,
              pos: midDim
            });
          }
        }
      }
    }

    // 9. Eletrodutos (NBR 5410)
    if (this.layers.conduits) {
      const nodeMap = new Map(this.nodes.map(n => [n.id, n]));
      for (const c of this.conduits) {
        const a = nodeMap.get(c.nodeAId);
        const b = nodeMap.get(c.nodeBId);
        if (!a || !b) continue;

        const sA = this.viewport.worldToScreen(a.position);
        const sB = this.viewport.worldToScreen(b.position);

        const mid = new Vector2D((sA.x + sB.x) / 2, (sA.y + sB.y) / 2);
        const dir = new Vector2D(sB.x - sA.x, sB.y - sA.y);
        const normal = dir.orthogonal().normalize();
        const curvatureAmount = Math.min(26, dir.length() * 0.16) * (c.curveDirection || 1);
        const ctrlPt = new Vector2D(mid.x + normal.x * curvatureAmount, mid.y + normal.y * curvatureAmount);

        let minDist = Infinity;
        for (let step = 0; step <= 10; step++) {
          const t = step / 10;
          const inv = 1 - t;
          const qx = inv * inv * sA.x + 2 * inv * t * ctrlPt.x + t * t * sB.x;
          const qy = inv * inv * sA.y + 2 * inv * t * ctrlPt.y + t * t * sB.y;
          const d = Math.hypot(screenPt.x - qx, screenPt.y - qy);
          if (d < minDist) minDist = d;
        }

        if (minDist < 14) {
          const midWorld = this.viewport.screenToWorld(new Vector2D(
            0.25 * sA.x + 0.5 * ctrlPt.x + 0.25 * sB.x,
            0.25 * sA.y + 0.5 * ctrlPt.y + 0.25 * sB.y
          ));
          candidates.push({
            type: 'conduit',
            id: c.id,
            conduit: c,
            label: `Eletroduto ⌀${c.diameter || 20}mm (${c.installationType === 'floor' ? 'Piso' : 'Teto/Parede'})`,
            pos: midWorld
          });
        }
      }

      // 9.1 Indicadores de Fiação nos Eletrodutos (arrastáveis ao longo do tubo)
      if (this.layers.wiring) {
        for (const c of this.conduits) {
          const wires = this.wireAllocations.get(c.id);
          if (!wires || wires.length === 0) continue;
          const a = nodeMap.get(c.nodeAId);
          const b = nodeMap.get(c.nodeBId);
          if (!a || !b) continue;

          const sA = this.viewport.worldToScreen(a.position);
          const sB = this.viewport.worldToScreen(b.position);
          const mid = new Vector2D((sA.x + sB.x) / 2, (sA.y + sB.y) / 2);
          const dir = new Vector2D(sB.x - sA.x, sB.y - sA.y);
          const normal = dir.orthogonal().normalize();
          const curvatureAmount = Math.min(26, dir.length() * 0.16) * (c.curveDirection || 1);
          const ctrlPt = new Vector2D(mid.x + normal.x * curvatureAmount, mid.y + normal.y * curvatureAmount);

          const wireT = typeof c.wireT === 'number' ? c.wireT : 0.5;
          const mt = 1 - wireT;
          const px = mt * mt * sA.x + 2 * mt * wireT * ctrlPt.x + wireT * wireT * sB.x;
          const py = mt * mt * sA.y + 2 * mt * wireT * ctrlPt.y + wireT * wireT * sB.y;
          const sTag = new Vector2D(px, py);

          if (sTag.distanceTo(screenPt) < 22) {
            const circList = [...new Set(wires.map(w => w.circuitId).filter(Boolean))].join(', ');
            candidates.push({
              type: 'wire_tag',
              conduitId: c.id,
              conduit: c,
              label: `Fiação Circ. ${circList} (Arraste para deslizar no tubo)`,
              pos: this.viewport.screenToWorld(sTag)
            });
          }
        }
      }
    }

    this.hoverCandidates = candidates;
    if (this.hoverCandidateIndex >= candidates.length) {
      this.hoverCandidateIndex = 0;
    }
  }

  cycleHoverSelection() {
    if (this.hoverCandidates.length <= 1) return null;
    this.hoverCandidateIndex = (this.hoverCandidateIndex + 1) % this.hoverCandidates.length;
    this.notify();
    return this.hoverCandidates[this.hoverCandidateIndex];
  }

  onMouseUp() {
    if (this.isDragging) {
      // Fusão e Snap de Quinas ao soltar vértice de parede
      if (this.draggedWallVertices && this.draggedWallVertices.length > 0) {
        const first = this.draggedWallVertices[0];
        const w0 = this.walls[first.wallIndex];
        const curPt = w0 ? w0[first.handle] : null;
        if (curPt) {
          // Procurar se há algum outro vértice próximo (que não estava no grupo) para selar a quina
          for (let i = 0; i < this.walls.length; i++) {
            const other = this.walls[i];
            for (const h of ['a', 'b']) {
              const inGroup = this.draggedWallVertices.some(item => item.wallIndex === i && item.handle === h);
              if (!inGroup && Math.hypot(other[h].x - curPt.x, other[h].y - curPt.y) < 0.22) {
                // Selamento perfeito de quina: atrai todas as pontas do grupo
                for (const item of this.draggedWallVertices) {
                  this.walls[item.wallIndex][item.handle].x = other[h].x;
                  this.walls[item.wallIndex][item.handle].y = other[h].y;
                }
                break;
              }
            }
          }
        }
        this.draggedWallVertices = [];
      }
      this.saveSnapshot();
    }
    this.isPanning = false;
    this.isDragging = false;

    // Conclusão de Seleção em Massa por Retângulo (Janela e Cruzamento)
    if (this.isSelectingBox && this.selectionBoxStart && this.selectionBoxCurrent) {
      const p1 = this.selectionBoxStart;
      const p2 = this.selectionBoxCurrent;
      const dxScreen = p2.x - p1.x;
      const isWindowSelection = dxScreen >= 0; // Esquerda -> Direita = Window (Azul); Direita -> Esquerda = Crossing (Verde)

      const minX = Math.min(p1.x, p2.x);
      const maxX = Math.max(p1.x, p2.x);
      const minY = Math.min(p1.y, p2.y);
      const maxY = Math.max(p1.y, p2.y);
      const dragDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);

      this.isSelectingBox = false;
      this.selectionBoxStart = null;
      this.selectionBoxCurrent = null;

      if (dragDist < 6) {
        // Apenas um clique em área vazia: limpa seleção
        this.selectedElement = null;
        this.selectedNodeId = null;
        this.selectedElements = [];
        this.notify();
        return;
      }

      const selected = [];
      const ptInBox = (pt) => pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY;

      // 1. Nós Elétricos
      if (this.layers.electric) {
        for (const n of this.nodes) {
          const s = this.viewport.worldToScreen(n.position);
          if (ptInBox(s)) {
            selected.push({ type: 'node', id: n.id });
          }
        }
      }

      // 2. Portas
      if (this.layers.openings) {
        for (let i = 0; i < this.doors.length; i++) {
          const d = this.doors[i];
          const s = this.viewport.worldToScreen(d.pos);
          if (ptInBox(s)) {
            selected.push({ type: 'door', index: i });
          }
        }
      }

      // 3. Janelas
      if (this.layers.openings) {
        for (let i = 0; i < this.windows.length; i++) {
          const w = this.windows[i];
          const s = this.viewport.worldToScreen(w.pos);
          if (ptInBox(s)) {
            selected.push({ type: 'window', index: i });
          }
        }
      }

      // 4. Cotas
      if (this.layers.dimensions) {
        for (let i = 0; i < (this.dimensions || []).length; i++) {
          const dim = this.dimensions[i];
          if (!dim) continue;
          const ptA = dim.a || dim.ptA;
          const ptB = dim.b || dim.ptB;
          if (!ptA || !ptB) continue;
          const sA = this.viewport.worldToScreen(ptA);
          const sB = this.viewport.worldToScreen(ptB);
          const inA = ptInBox(sA);
          const inB = ptInBox(sB);
          if (isWindowSelection ? (inA && inB) : (inA || inB)) {
            selected.push({ type: 'dimension', index: i });
          }
        }
      }

      // 5. Paredes
      if (!this.isPlanLocked && this.layers.walls) {
        for (let i = 0; i < this.walls.length; i++) {
          const wall = this.walls[i];
          const sA = this.viewport.worldToScreen(wall.a);
          const sB = this.viewport.worldToScreen(wall.b);
          const inA = ptInBox(sA);
          const inB = ptInBox(sB);
          if (isWindowSelection ? (inA && inB) : (inA || inB)) {
            selected.push({ type: 'wall', index: i });
          }
        }
      }

      // 6. Ambientes
      if (this.layers.rooms) {
        for (let i = 0; i < this.rooms.length; i++) {
          const r = this.rooms[i];
          const s = this.viewport.worldToScreen(r.pos);
          if (ptInBox(s)) {
            selected.push({ type: 'room', index: i });
          }
        }
      }

      this.selectedElements = selected;
      if (selected.length === 1) {
        this.selectedElement = selected[0];
        if (selected[0].type === 'node') this.selectedNodeId = selected[0].id;
      } else if (selected.length > 1) {
        this.selectedElement = { type: 'multi', count: selected.length, items: selected };
        this.selectedNodeId = null;
      } else {
        this.selectedElement = null;
        this.selectedNodeId = null;
      }

      this.notify();
    }
  }

  // Renderizador de Cotas Lineares e Alinhadas Técnicas (NBR 6492)
  renderDimensions(ctx, isPaperSpace = false) {
    if (!this.layers.dimensions) return;
    const drivingDims = (!isPaperSpace && this.selectedElement && this.selectedElement.type === 'wall' && typeof this.selectedElement.index === 'number')
      ? this.getDrivingDimensionsForWall(this.selectedElement.index).map(d => d.dimIndex)
      : [];

    for (let i = 0; i < (this.dimensions || []).length; i++) {
      const dim = this.dimensions[i];
      if (!dim) continue;
      const ptA = dim.a || dim.ptA;
      const ptB = dim.b || dim.ptB;
      if (!ptA || !ptB) continue;
      const isSelected = !isPaperSpace && this.selectedElement && this.selectedElement.type === 'dimension' && this.selectedElement.index === i;
      const isDriving = !isPaperSpace && drivingDims.includes(i);
      const isHovered = isDriving && this.hoverDrivingDimension && this.hoverDrivingDimension.dimIndex === i;
      this.drawSingleDimension(ctx, ptA, ptB, dim.offset || 0.35, isSelected, false, isDriving, isHovered);
    }

    // Prévia dinâmica se estiver inserindo cota em 3 passos
    if (this.activeTool === 'dimension') {
      if (this.dimStage === 1 && this.dimStartPoint && this.mouseWorldPos) {
        // Passo 1 -> Passo 2: linha elástica pontilhada conectando P1 ao mouse
        ctx.save();
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        const sP1 = this.viewport.worldToScreen(this.dimStartPoint);
        const sCur = this.viewport.worldToScreen(this.mouseWorldPos);
        ctx.beginPath();
        ctx.moveTo(sP1.x, sP1.y);
        ctx.lineTo(sCur.x, sCur.y);
        ctx.stroke();
        ctx.restore();
      } else if (this.dimStage === 2 && this.dimStartPoint && this.dimEndPoint) {
        // Passo 2 -> Passo 3: cota completa com offset dinâmico definido pelo mouse
        this.drawSingleDimension(ctx, this.dimStartPoint, this.dimEndPoint, this.dimPendingOffset, false, true, false);
      }
    }
  }

  drawSingleDimension(ctx, ptA, ptB, offset = 0.35, isSelected = false, isPreview = false, isDriving = false, isHoveredDriving = false) {
    if (!ptA || !ptB || typeof ptA.x === 'undefined' || typeof ptB.x === 'undefined') return;
    const L = Math.hypot(ptB.x - ptA.x, ptB.y - ptA.y);
    if (L < 0.02) return;

    const sA = this.viewport.worldToScreen(ptA);
    const sB = this.viewport.worldToScreen(ptB);

    const dir = new Vector2D(ptB.x - ptA.x, ptB.y - ptA.y).normalize();
    const normal = dir.orthogonal();

    const offWorldA = new Vector2D(ptA.x + normal.x * offset, ptA.y + normal.y * offset);
    const offWorldB = new Vector2D(ptB.x + normal.x * offset, ptB.y + normal.y * offset);

    const sDimA = this.viewport.worldToScreen(offWorldA);
    const sDimB = this.viewport.worldToScreen(offWorldB);

    ctx.save();
    let mainColor = '#047857'; // Verde técnico padrão ABNT NBR 6492
    if (isSelected) mainColor = '#0284c7'; // Azul seleção
    else if (isPreview) mainColor = '#0284c7'; // Azul prévia
    else if (isDriving) mainColor = isHoveredDriving ? '#1d4ed8' : '#2563eb'; // Azul realçado Cota Vinculada

    ctx.strokeStyle = mainColor;
    ctx.fillStyle = mainColor;
    ctx.lineWidth = isSelected || isDriving ? (isHoveredDriving ? 2.6 : 2.2) : 1.2;

    if (isPreview) {
      ctx.setLineDash([3, 3]);
    }

    // 1. Linhas de extensão / chamada
    ctx.beginPath();
    const sExtA1 = this.viewport.worldToScreen(new Vector2D(ptA.x + normal.x * (offset > 0 ? 0.04 : -0.04), ptA.y + normal.y * (offset > 0 ? 0.04 : -0.04)));
    const sExtA2 = this.viewport.worldToScreen(new Vector2D(ptA.x + normal.x * (offset + (offset > 0 ? 0.08 : -0.08)), ptA.y + normal.y * (offset + (offset > 0 ? 0.08 : -0.08))));
    ctx.moveTo(sExtA1.x, sExtA1.y); ctx.lineTo(sExtA2.x, sExtA2.y);

    const sExtB1 = this.viewport.worldToScreen(new Vector2D(ptB.x + normal.x * (offset > 0 ? 0.04 : -0.04), ptB.y + normal.y * (offset > 0 ? 0.04 : -0.04)));
    const sExtB2 = this.viewport.worldToScreen(new Vector2D(ptB.x + normal.x * (offset + (offset > 0 ? 0.08 : -0.08)), ptB.y + normal.y * (offset + (offset > 0 ? 0.08 : -0.08))));
    ctx.moveTo(sExtB1.x, sExtB1.y); ctx.lineTo(sExtB2.x, sExtB2.y);
    ctx.stroke();

    // 2. Linha de cota principal
    ctx.beginPath();
    ctx.moveTo(sDimA.x, sDimA.y);
    ctx.lineTo(sDimB.x, sDimB.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // 3. Ticks arquitetônicos a 45°
    const tickLen = 6;
    const ang = Math.atan2(sDimB.y - sDimA.y, sDimB.x - sDimA.x);
    [sDimA, sDimB].forEach(pt => {
      ctx.lineWidth = isSelected || isDriving ? 2.2 : 1.8;
      ctx.beginPath();
      ctx.moveTo(pt.x - Math.cos(ang + Math.PI / 4) * tickLen, pt.y - Math.sin(ang + Math.PI / 4) * tickLen);
      ctx.lineTo(pt.x + Math.cos(ang + Math.PI / 4) * tickLen, pt.y - Math.sin(ang + Math.PI / 4) * tickLen);
      ctx.stroke();
    });

    // 4. Texto centralizado com máscara de fundo
    const midX = (sDimA.x + sDimB.x) / 2;
    const midY = (sDimA.y + sDimB.y) / 2;
    const txt = `${L.toFixed(2)} m`;

    ctx.save();
    ctx.translate(midX, midY);
    let rot = ang;
    if (rot > Math.PI / 2 || rot < -Math.PI / 2) rot += Math.PI;
    ctx.rotate(rot);

    ctx.font = isDriving ? 'bold 11px Arial, sans-serif' : 'bold 10px Arial, sans-serif';
    const m = ctx.measureText ? ctx.measureText(txt) : { width: 40 };
    const tw = m && typeof m.width === 'number' ? m.width : 40;

    ctx.fillStyle = isHoveredDriving ? '#dbeafe' : (isDriving ? '#eff6ff' : '#ffffff');
    ctx.fillRect(-tw / 2 - 6, -10, tw + 12, 20);
    if (isDriving) {
      ctx.strokeStyle = isHoveredDriving ? '#1d4ed8' : '#2563eb';
      ctx.lineWidth = isHoveredDriving ? 2.0 : 1.0;
      ctx.strokeRect(-tw / 2 - 6, -10, tw + 12, 20);
    }

    ctx.fillStyle = mainColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(txt, 0, 0);
    ctx.restore();

    ctx.restore();
  }

  onWheel(screenPt, deltaY) {
    this.viewport.zoomAt(screenPt, deltaY < 0 ? 1.15 : 0.85);
    this.notify();
  }

  // Renderizador Canônico e Normativo das 6 Tipologias de Portas Arquitetônicas (NBR 6492)
  drawDoorEntity(ctx, p, rotation, radius, type = 'abrir', orient = 0, isSelected = false, isGhost = false, wallTh = 0.16) {
    const r = radius * this.viewport.zoom;
    const hR = r / 2;
    const th = wallTh * this.viewport.zoom;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(rotation || 0);
    if (isGhost) ctx.globalAlpha = 0.75;

    // 1. Limpar vão na alvenaria
    ctx.fillStyle = isGhost ? 'rgba(2, 132, 199, 0.15)' : '#ffffff';
    ctx.fillRect(-hR - 2, -th / 2, r + 4, th);

    // 2. Batentes / Marcos de esquadria nas duas extremidades
    const jambColor = isSelected ? '#0284c7' : (isGhost ? '#0284c7' : '#0f172a');
    ctx.fillStyle = jambColor;
    ctx.fillRect(-hR - 3, -th / 2, 4, th);
    ctx.fillRect(hR - 1, -th / 2, 4, th);

    const mainStroke = isSelected ? '#0284c7' : (isGhost ? '#0284c7' : '#0f172a');
    const auxStroke = isSelected ? '#0284c7' : (isGhost ? '#0284c7' : '#94a3b8');

    // Lado e sentido baseados no orient (0..3)
    const isLeft = (orient === 0 || orient === 3);
    const isUp = (orient === 0 || orient === 1);
    const signY = isUp ? -1 : 1;

    switch (type) {
      case 'pivotante': {
        // Eixo de rotação recuado do batente em 20% do vão
        const pivOffset = 0.20 * r;
        const pivX = isLeft ? (-hR + pivOffset) : (hR - pivOffset);
        const longLen = 0.80 * r;
        const shortLen = 0.20 * r;

        const longTip = { x: pivX, y: signY * longLen };
        const shortTip = { x: pivX, y: -signY * shortLen };

        // Arcos de varredura tracejados
        ctx.strokeStyle = auxStroke;
        ctx.lineWidth = isSelected ? 1.6 : 1.2;
        ctx.setLineDash([3, 3]);

        // Arco principal (folha maior)
        ctx.beginPath();
        const startAngMain = isLeft ? 0 : Math.PI;
        const endAngMain = isUp ? -Math.PI / 2 : Math.PI / 2;
        ctx.arc(pivX, 0, longLen, startAngMain, endAngMain, (isLeft && isUp) || (!isLeft && !isUp));
        ctx.stroke();

        // Arco do rabicho
        ctx.beginPath();
        const startAngTail = isLeft ? Math.PI : 0;
        const endAngTail = isUp ? Math.PI / 2 : -Math.PI / 2;
        ctx.arc(pivX, 0, shortLen, startAngTail, endAngTail, !((isLeft && isUp) || (!isLeft && !isUp)));
        ctx.stroke();
        ctx.setLineDash([]);

        // Folha contínua pivotada
        ctx.strokeStyle = mainStroke;
        ctx.lineWidth = isSelected ? 3.4 : 2.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(shortTip.x, shortTip.y);
        ctx.lineTo(longTip.x, longTip.y);
        ctx.stroke();

        // Pivô circular
        ctx.fillStyle = '#0284c7';
        ctx.beginPath();
        ctx.arc(pivX, 0, isSelected ? 4 : 3, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'embutida': {
        // Porta embutida na alvenaria (Pocket Door): bolso de um lado e folha com seta
        const pocketSide = isLeft ? -1 : 1;
        const pocketStartX = pocketSide === -1 ? -hR : hR;
        const pocketEndX = pocketStartX + pocketSide * r;

        // Cavidade do bolso na alvenaria
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 2]);
        ctx.beginPath();
        ctx.moveTo(pocketStartX, -th / 2);
        ctx.lineTo(pocketEndX, -th / 2);
        ctx.moveTo(pocketStartX, th / 2);
        ctx.lineTo(pocketEndX, th / 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Folha semi-recolhida
        ctx.strokeStyle = mainStroke;
        ctx.lineWidth = isSelected ? 3.6 : 2.6;
        ctx.lineCap = 'round';
        const leafStartX = pocketStartX + pocketSide * (r * 0.25);
        const leafEndX = pocketStartX - pocketSide * (r * 0.75);
        ctx.beginPath();
        ctx.moveTo(leafStartX, 0);
        ctx.lineTo(leafEndX, 0);
        ctx.stroke();

        // Seta indicativa para o bolso
        ctx.strokeStyle = '#0284c7';
        ctx.fillStyle = '#0284c7';
        ctx.lineWidth = 1.6;
        const arrowY = signY * (th * 0.7);
        const arrowStart = 0;
        const arrowEnd = pocketSide * (r * 0.35);
        ctx.beginPath();
        ctx.moveTo(arrowStart, arrowY);
        ctx.lineTo(arrowEnd, arrowY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(arrowEnd, arrowY);
        ctx.lineTo(arrowEnd - pocketSide * 6, arrowY - 3);
        ctx.lineTo(arrowEnd - pocketSide * 6, arrowY + 3);
        ctx.closePath();
        ctx.fill();
        break;
      }

      case 'correr': {
        // Porta de Correr: 2 folhas paralelas rente à alvenaria com seta bidirecional
        const offsetLeafY = signY * (th / 2 + 3);
        ctx.strokeStyle = mainStroke;
        ctx.lineWidth = isSelected ? 3.0 : 2.2;
        ctx.lineCap = 'round';

        // Folha 1
        ctx.beginPath();
        ctx.moveTo(-hR - 2, offsetLeafY);
        ctx.lineTo(4, offsetLeafY);
        ctx.stroke();

        // Folha 2 (com leve transpasse)
        const offsetLeaf2Y = offsetLeafY + signY * 4;
        ctx.beginPath();
        ctx.moveTo(-4, offsetLeaf2Y);
        ctx.lineTo(hR + 2, offsetLeaf2Y);
        ctx.stroke();

        // Trilho no vão
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.0;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(-hR, 0); ctx.lineTo(hR, 0);
        ctx.stroke();
        ctx.setLineDash([]);

        // Seta de correr horizontal
        ctx.strokeStyle = '#0284c7';
        ctx.fillStyle = '#0284c7';
        ctx.lineWidth = 1.4;
        const arrowW = r * 0.25;
        ctx.beginPath();
        ctx.moveTo(-arrowW, 0); ctx.lineTo(arrowW, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-arrowW, 0); ctx.lineTo(-arrowW + 4, -2.5); ctx.lineTo(-arrowW + 4, 2.5); ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(arrowW, 0); ctx.lineTo(arrowW - 4, -2.5); ctx.lineTo(arrowW - 4, 2.5); ctx.closePath(); ctx.fill();
        break;
      }

      case 'articulada': {
        // Porta Camarão / Articulada (Bi-fold em V)
        const hingeX = isLeft ? -hR : hR;
        const apexX = hingeX + (isLeft ? 1 : -1) * (r * 0.30);
        const apexY = signY * (r * 0.38);
        const tipX = hingeX + (isLeft ? 1 : -1) * (r * 0.52);

        // Trilho central
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.0;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(-hR, 0); ctx.lineTo(hR, 0);
        ctx.stroke();
        ctx.setLineDash([]);

        // Duas folhas dobradas em V
        ctx.strokeStyle = mainStroke;
        ctx.lineWidth = isSelected ? 3.4 : 2.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(hingeX, 0);
        ctx.lineTo(apexX, apexY);
        ctx.lineTo(tipX, 0);
        ctx.stroke();

        // Pinos de articulação
        ctx.fillStyle = '#0284c7';
        [ {x: hingeX, y: 0}, {x: apexX, y: apexY}, {x: tipX, y: 0} ].forEach(pt => {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, isSelected ? 3.5 : 2.5, 0, Math.PI * 2);
          ctx.fill();
        });
        break;
      }

      case 'sanfonada': {
        // Porta Sanfonada (Accordion) com zig-zag
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.0;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(-hR, 0); ctx.lineTo(hR, 0);
        ctx.stroke();
        ctx.setLineDash([]);

        const folds = 6;
        const foldAmp = signY * (r * 0.16);
        ctx.strokeStyle = mainStroke;
        ctx.lineWidth = isSelected ? 2.6 : 1.8;
        ctx.lineJoin = 'miter';
        ctx.beginPath();
        ctx.moveTo(-hR, 0);
        for (let k = 1; k < folds; k++) {
          const fx = -hR + (k / folds) * r;
          const fy = (k % 2 === 1) ? foldAmp : -foldAmp * 0.4;
          ctx.lineTo(fx, fy);
        }
        ctx.lineTo(hR, 0);
        ctx.stroke();
        break;
      }

      case 'abrir':
      default: {
        // Porta de Giro Tradicional ABNT NBR 6492 (Arco 90° e folha aberta)
        let hinge = { x: -hR, y: 0 };
        let tip = { x: -hR, y: -r };
        let startAng = 0;
        let endAng = -Math.PI / 2;
        let antiClockwise = true;

        if (orient === 0) {
          hinge = { x: -hR, y: 0 }; tip = { x: -hR, y: -r }; startAng = 0; endAng = -Math.PI / 2; antiClockwise = true;
        } else if (orient === 1) {
          hinge = { x: hR, y: 0 }; tip = { x: hR, y: -r }; startAng = Math.PI; endAng = -Math.PI / 2; antiClockwise = false;
        } else if (orient === 2) {
          hinge = { x: hR, y: 0 }; tip = { x: hR, y: r }; startAng = Math.PI; endAng = Math.PI / 2; antiClockwise = true;
        } else if (orient === 3) {
          hinge = { x: -hR, y: 0 }; tip = { x: -hR, y: r }; startAng = 0; endAng = Math.PI / 2; antiClockwise = false;
        }

        // Arco de abertura tracejado
        ctx.strokeStyle = auxStroke;
        ctx.lineWidth = isSelected ? 1.6 : 1.2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(hinge.x, hinge.y, r, startAng, endAng, antiClockwise);
        ctx.stroke();
        ctx.setLineDash([]);

        // Folha aberta a 90°
        ctx.strokeStyle = mainStroke;
        ctx.lineWidth = isSelected ? 3.4 : 2.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(hinge.x, hinge.y);
        ctx.lineTo(tip.x, tip.y);
        ctx.stroke();

        // Pivô / Dobradiça
        ctx.fillStyle = '#0284c7';
        ctx.beginPath();
        ctx.arc(hinge.x, hinge.y, isSelected ? 3.5 : 2.5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }

    // Destaque envolvente quando selecionado
    if (isSelected) {
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(-hR - 8, -r - 8, r + 16, r * 2 + 16);
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  computeWallGeometries() {
    const geoms = this.walls.map(w => {
      const dx = w.b.x - w.a.x;
      const dy = w.b.y - w.a.y;
      const len = Math.hypot(dx, dy) || 1;
      const u = { x: dx / len, y: dy / len };
      const n = { x: -u.y, y: u.x };
      const h = (w.thickness || 0.15) / 2;
      return {
        wall: w, u, n, h,
        a1: { x: w.a.x + n.x * h, y: w.a.y + n.y * h },
        a2: { x: w.a.x - n.x * h, y: w.a.y - n.y * h },
        b1: { x: w.b.x + n.x * h, y: w.b.y + n.y * h },
        b2: { x: w.b.x - n.x * h, y: w.b.y - n.y * h },
        connectsA: false,
        connectsB: false
      };
    });

    // 1. Resolução de cantos em L e vértices coincidentes (miter joint exato)
    for (let i = 0; i < geoms.length; i++) {
      for (let j = i + 1; j < geoms.length; j++) {
        const g1 = geoms[i];
        const g2 = geoms[j];
        const w1 = g1.wall;
        const w2 = g2.wall;

        const pairs = [
          { pt1: w1.b, pt2: w2.a, end1: 'b', end2: 'a' },
          { pt1: w1.b, pt2: w2.b, end1: 'b', end2: 'b' },
          { pt1: w1.a, pt2: w2.a, end1: 'a', end2: 'a' },
          { pt1: w1.a, pt2: w2.b, end1: 'a', end2: 'b' }
        ];

        for (const pair of pairs) {
          if (Math.hypot(pair.pt1.x - pair.pt2.x, pair.pt1.y - pair.pt2.y) < 0.25) {
            if (pair.end1 === 'a') g1.connectsA = true; else g1.connectsB = true;
            if (pair.end2 === 'a') g2.connectsA = true; else g2.connectsB = true;

            const p1L = pair.end1 === 'a' ? g1.a1 : g1.b1;
            const p1R = pair.end1 === 'a' ? g1.a2 : g1.b2;
            const p2L = pair.end2 === 'a' ? g2.a1 : g2.b1;
            const p2R = pair.end2 === 'a' ? g2.a2 : g2.b2;

            // Vetores direcionais saindo do vértice de encontro
            const v1 = pair.end1 === 'a' ? g1.u : { x: -g1.u.x, y: -g1.u.y };
            const v2 = pair.end2 === 'a' ? g2.u : { x: -g2.u.x, y: -g2.u.y };
            const bisect = { x: v1.x + v2.x, y: v1.y + v2.y };
            const bisectLen = Math.hypot(bisect.x, bisect.y);

            // Se paredes não forem estritamente colineares opostas (formam canto)
            if (bisectLen > 0.05) {
              const P11 = lineIntersect(p1L, g1.u, p2L, g2.u);
              const P12 = lineIntersect(p1L, g1.u, p2R, g2.u);
              const P21 = lineIntersect(p1R, g1.u, p2L, g2.u);
              const P22 = lineIntersect(p1R, g1.u, p2R, g2.u);

              if (P11 && P22 && P12 && P21) {
                // Alinhamento exato da linha miter com o vetor bissetriz do canto
                const deltaA = { x: P11.x - P22.x, y: P11.y - P22.y };
                const deltaB = { x: P12.x - P21.x, y: P12.y - P21.y };
                const scoreA = Math.abs(deltaA.x * bisect.x + deltaA.y * bisect.y);
                const scoreB = Math.abs(deltaB.x * bisect.x + deltaB.y * bisect.y);

                if (scoreA >= scoreB) {
                  if (pair.end1 === 'a') { g1.a1 = P11; g1.a2 = P22; } else { g1.b1 = P11; g1.b2 = P22; }
                  if (pair.end2 === 'a') { g2.a1 = P11; g2.a2 = P22; } else { g2.b1 = P11; g2.b2 = P22; }
                } else {
                  if (pair.end1 === 'a') { g1.a1 = P12; g1.a2 = P21; } else { g1.b1 = P12; g1.b2 = P21; }
                  if (pair.end2 === 'a') { g2.a1 = P21; g2.a2 = P12; } else { g2.b1 = P21; g2.b2 = P12; }
                }
              }
            }
          }
        }
      }
    }

    // 2. Resolução de junções em T (topo de parede encontrando o corpo de outra)
    for (let i = 0; i < geoms.length; i++) {
      const g = geoms[i];
      for (let j = 0; j < geoms.length; j++) {
        if (i === j) continue;
        const other = geoms[j];
        const oA = other.wall.a;
        const oB = other.wall.b;
        const oDx = oB.x - oA.x;
        const oDy = oB.y - oA.y;
        const oLen = Math.hypot(oDx, oDy);

        for (const end of ['a', 'b']) {
          if (end === 'a' && g.connectsA) continue;
          if (end === 'b' && g.connectsB) continue;
          const pt = end === 'a' ? g.wall.a : g.wall.b;
          const t = ((pt.x - oA.x) * oDx + (pt.y - oA.y) * oDy) / (oLen * oLen);
          if (t > 0.02 && t < 0.98) {
            const projX = oA.x + t * oDx;
            const projY = oA.y + t * oDy;
            if (Math.hypot(pt.x - projX, pt.y - projY) < 0.20) {
              if (end === 'a') g.connectsA = true; else g.connectsB = true;
              const trimDist = other.h;
              const u = g.u;
              if (end === 'a') {
                g.a1 = { x: g.a1.x + u.x * trimDist, y: g.a1.y + u.y * trimDist };
                g.a2 = { x: g.a2.x + u.x * trimDist, y: g.a2.y + u.y * trimDist };
              } else {
                g.b1 = { x: g.b1.x - u.x * trimDist, y: g.b1.y - u.y * trimDist };
                g.b2 = { x: g.b2.x - u.x * trimDist, y: g.b2.y - u.y * trimDist };
              }
            }
          }
        }
      }
    }

    return geoms;
  }

  renderArchitecture(ctx) {
    ctx.save();

    // 1. Paredes com linhas duplas paralelas e cantos miterados exatos
    if (this.layers.walls && this.walls.length > 0) {
      const geoms = this.computeWallGeometries();

      for (let i = 0; i < geoms.length; i++) {
        const g = geoms[i];
        const isSelected = this.selectedElement && this.selectedElement.type === 'wall' && this.selectedElement.index === i;
        const sA1 = this.viewport.worldToScreen(g.a1);
        const sB1 = this.viewport.worldToScreen(g.b1);
        const sB2 = this.viewport.worldToScreen(g.b2);
        const sA2 = this.viewport.worldToScreen(g.a2);

        // Preenchimento sólido para isolar da grade
        ctx.fillStyle = isSelected ? 'rgba(2, 132, 199, 0.12)' : '#ffffff';
        ctx.beginPath();
        ctx.moveTo(sA1.x, sA1.y);
        ctx.lineTo(sB1.x, sB1.y);
        ctx.lineTo(sB2.x, sB2.y);
        ctx.lineTo(sA2.x, sA2.y);
        ctx.closePath();
        ctx.fill();

        // Linhas paralelas das alvenarias
        const isWallSelected = !this.isPaperSpace && isSelected;
        ctx.strokeStyle = isWallSelected ? '#0284c7' : '#0f172a';
        ctx.lineWidth = isWallSelected ? 3.5 : 2.0;

        ctx.beginPath();
        ctx.moveTo(sA1.x, sA1.y);
        ctx.lineTo(sB1.x, sB1.y);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(sA2.x, sA2.y);
        ctx.lineTo(sB2.x, sB2.y);
        ctx.stroke();

        // Fechamento de topo APENAS para pontas livres de parede (sem conexão em canto ou T)
        ctx.lineWidth = isWallSelected ? 2.5 : 1.6;
        if (!g.connectsA) {
          ctx.beginPath();
          ctx.moveTo(sA1.x, sA1.y);
          ctx.lineTo(sA2.x, sA2.y);
          ctx.stroke();
        }
        if (!g.connectsB) {
          ctx.beginPath();
          ctx.moveTo(sB1.x, sB1.y);
          ctx.lineTo(sB2.x, sB2.y);
          ctx.stroke();
        }
      }
    }

    // 2. Delimitadores Virtuais de Ambiente (Linha tracejada)
    if (this.layers.rooms) {
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([5, 5]);
      for (const div of this.roomDividers) {
        const sA = this.viewport.worldToScreen(div.a);
        const sB = this.viewport.worldToScreen(div.b);
        ctx.beginPath();
        ctx.moveTo(sA.x, sA.y);
        ctx.lineTo(sB.x, sB.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    // 3. Janelas Arquitetônicas (linhas de esquadria e peitoril duplo)
    if (this.layers.openings) {
      for (let i = 0; i < (this.windows || []).length; i++) {
        const win = this.windows[i];
        const isSelected = this.selectedElement && this.selectedElement.type === 'window' && this.selectedElement.index === i;
        const p = this.viewport.worldToScreen(win.pos);
        const w = (win.width || 1.2) * this.viewport.zoom;
        const th = 0.15 * this.viewport.zoom;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(win.rotation || 0);

        ctx.fillStyle = isSelected ? 'rgba(2, 132, 199, 0.15)' : '#ffffff';
        ctx.fillRect(-w / 2, -th / 2, w, th);

        ctx.strokeStyle = isSelected ? '#0284c7' : '#0f172a';
        ctx.lineWidth = isSelected ? 2.8 : 1.6;
        ctx.strokeRect(-w / 2, -th / 2, w, th);

        ctx.strokeStyle = isSelected ? '#0284c7' : '#0284c7';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(-w / 2, -th * 0.18);
        ctx.lineTo(w / 2, -th * 0.18);
        ctx.moveTo(-w / 2, th * 0.18);
        ctx.lineTo(w / 2, th * 0.18);
        ctx.stroke();

        if (isSelected) {
          ctx.strokeStyle = '#0284c7';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([3, 3]);
          ctx.strokeRect(-w / 2 - 4, -th / 2 - 4, w + 8, th + 8);
          ctx.setLineDash([]);
        }

        ctx.restore();
      }
    }

    // 4. Portas Arquitetônicas (Vão, Batentes e Tipologias NBR 6492)
    if (this.layers.openings) {
      for (let i = 0; i < this.doors.length; i++) {
        const d = this.doors[i];
        const isSelected = this.selectedElement && this.selectedElement.type === 'door' && this.selectedElement.index === i;
        const p = this.viewport.worldToScreen(d.pos);
        this.drawDoorEntity(ctx, p, d.rotation, d.radius || 0.8, d.type || 'abrir', d.orientationIndex || 0, isSelected, false, 0.16);
      }
    }

    // 5. Rótulos dos Cômodos com Área m²
    if (this.layers.rooms) {
      for (let i = 0; i < this.rooms.length; i++) {
        const room = this.rooms[i];
        const isSelected = !this.isPaperSpace && this.selectedElement && this.selectedElement.type === 'room' && this.selectedElement.index === i;
        const pos = this.viewport.worldToScreen(room.pos);

        if (isSelected) {
          ctx.fillStyle = 'rgba(2, 132, 199, 0.1)';
          ctx.strokeStyle = '#0284c7';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(pos.x - 70, pos.y - 20, 140, 40);
          ctx.fillRect(pos.x - 70, pos.y - 20, 140, 40);
          ctx.setLineDash([]);
        }

        ctx.fillStyle = isSelected ? '#0284c7' : '#1e293b';
        ctx.font = 'bold 11px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(room.name, pos.x, pos.y - 7);

        const area = room.areaM2 || 12.5;
        ctx.fillStyle = isSelected ? '#0369a1' : '#64748b';
        ctx.font = '9.5px Arial, sans-serif';
        ctx.fillText(`${area.toFixed(2)} m²`, pos.x, pos.y + 7);
      }
    }

    // 6. Grips de Edição (azuis) quando PLANTA DESTRAVADA (e NUNCA em PaperSpace)
    if (!this.isPlanLocked && !this.isPaperSpace && (this.activeTool === 'select' || this.activeTool === 'wall')) {
      ctx.fillStyle = '#0284c7';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;

      const drawnGrips = new Set();
      for (const wall of this.walls) {
        for (const pt of [wall.a, wall.b]) {
          const key = `${pt.x.toFixed(2)},${pt.y.toFixed(2)}`;
          if (!drawnGrips.has(key)) {
            drawnGrips.add(key);
            const sPt = this.viewport.worldToScreen(pt);
            ctx.beginPath();
            ctx.arc(sPt.x, sPt.y, 4, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();
          }
        }
      }
    }

    // 7. Pré-visualização elástica ao desenhar parede
    if ((this.activeTool === 'wall' || this.activeTool === 'room_divider') && this.wallStartPoint) {
      const sStart = this.viewport.worldToScreen(this.wallStartPoint);
      const sEnd = this.viewport.worldToScreen(this.currentSnap.point);
      const dist = Math.hypot(this.currentSnap.point.x - this.wallStartPoint.x, this.currentSnap.point.y - this.wallStartPoint.y);

      ctx.strokeStyle = this.activeTool === 'wall' ? '#0284c7' : '#94a3b8';
      ctx.lineWidth = 2.0;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(sStart.x, sStart.y);
      ctx.lineTo(sEnd.x, sEnd.y);
      ctx.stroke();
      ctx.setLineDash([]);

      const midX = (sStart.x + sEnd.x) / 2;
      const midY = (sStart.y + sEnd.y) / 2 - 14;
      const angleTxt = this.polarGuide ? ` [${this.polarGuide.angleDeg}°]` : '';

      ctx.save();
      if (this.typedLength) {
        const hudText = `Distância: [ ${this.typedLength} ] m  ↵ Enter`;
        ctx.font = 'bold 12px Arial, sans-serif';
        const tw = ctx.measureText(hudText).width;
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(midX - tw / 2 - 8, midY - 12, tw + 16, 24);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.8;
        ctx.strokeRect(midX - tw / 2 - 8, midY - 12, tw + 16, 24);
        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(hudText, midX, midY);
      } else {
        const hudText = `${dist.toFixed(2)} m${angleTxt}`;
        ctx.font = 'bold 11px Arial, sans-serif';
        const tw = ctx.measureText(hudText).width;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(midX - tw / 2 - 5, midY - 9, tw + 10, 18);
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 1.0;
        ctx.strokeRect(midX - tw / 2 - 5, midY - 9, tw + 10, 18);
        ctx.fillStyle = '#0284c7';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(hudText, midX, midY);
      }
      ctx.restore();
    }

    // 8. Linha Guia Polar de Snap (0°, 45°, 90°, etc.)
    if (this.polarGuide) {
      const sStart = this.viewport.worldToScreen(this.polarGuide.start);
      const rad = (this.polarGuide.angleDeg * Math.PI) / 180;
      const farWorld = new Vector2D(this.polarGuide.start.x + Math.cos(rad) * 15, this.polarGuide.start.y + Math.sin(rad) * 15);
      const sFar = this.viewport.worldToScreen(farWorld);

      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.0;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(sStart.x, sStart.y);
      ctx.lineTo(sFar.x, sFar.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  // Renderiza Pavimento Subjacente (Underlay / Plano Fantasma esmaecido)
  renderUnderlay(ctx, underlay) {
    if (!underlay || !underlay.walls) return;
    ctx.save();

    // Paredes subjacentes em traço fino e cinza claro translúcido
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
    ctx.fillStyle = 'rgba(241, 245, 249, 0.15)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 4]);

    for (const w of underlay.walls) {
      const dx = w.b.x - w.a.x;
      const dy = w.b.y - w.a.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -(dy / len) * ((w.thickness || 0.15) / 2);
      const ny = (dx / len) * ((w.thickness || 0.15) / 2);

      const a1 = this.viewport.worldToScreen({ x: w.a.x + nx, y: w.a.y + ny });
      const b1 = this.viewport.worldToScreen({ x: w.b.x + nx, y: w.b.y + ny });
      const b2 = this.viewport.worldToScreen({ x: w.b.x - nx, y: w.b.y - ny });
      const a2 = this.viewport.worldToScreen({ x: w.a.x - nx, y: w.a.y - ny });

      ctx.beginPath();
      ctx.moveTo(a1.x, a1.y);
      ctx.lineTo(b1.x, b1.y);
      ctx.lineTo(b2.x, b2.y);
      ctx.lineTo(a2.x, a2.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Cômodos do pavimento subjacente (marca d'água técnica)
    ctx.setLineDash([]);
    ctx.font = '500 11px Inter, sans-serif';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.40)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const r of (underlay.rooms || [])) {
      const s = this.viewport.worldToScreen(r.pos);
      ctx.fillText(`[${r.name}]`, s.x, s.y);
    }

    // Pontos elétricos do pavimento subjacente (ícones translúcidos vazados)
    for (const n of (underlay.nodes || [])) {
      const s = this.viewport.worldToScreen(n.position);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.40)';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  // Renderiza Prumadas Verticais conforme simbologia normativa NBR 5410 / NBR 6492
  renderRisers(ctx) {
    if (!this.risers || this.risers.length === 0) return;
    const curLevel = this.levels ? this.levels.find(l => l.id === this.activeLevelId) : null;
    if (!curLevel) return;

    for (const r of this.risers) {
      const fromL = this.levels.find(l => l.id === r.fromLevelId);
      const toL = this.levels.find(l => l.id === r.toLevelId);
      if (!fromL || !toL) continue;

      const minElev = Math.min(fromL.elevation, toL.elevation);
      const maxElev = Math.max(fromL.elevation, toL.elevation);
      const myElev = curLevel.elevation;

      let direction = null; // 'up' | 'down' | 'through'
      let targetName = '';

      if (Math.abs(myElev - minElev) < 0.05) {
        direction = 'up';
        targetName = `Sobe p/ ${toL.name}`;
      } else if (Math.abs(myElev - maxElev) < 0.05) {
        direction = 'down';
        targetName = `Desce p/ ${fromL.name}`;
      } else if (myElev > minElev && myElev < maxElev) {
        direction = 'through';
        targetName = `Passa (${fromL.name} ↔ ${toL.name})`;
      } else {
        continue;
      }

      const s = this.viewport.worldToScreen(r.position);
      const isSelected = this.selectedElement && this.selectedElement.type === 'riser' && this.selectedElement.id === r.id;

      ctx.save();
      const radius = 9;
      ctx.strokeStyle = isSelected ? '#0284c7' : '#0f172a';
      ctx.lineWidth = isSelected ? 2.5 : 1.6;
      ctx.fillStyle = '#ffffff';

      ctx.beginPath();
      ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isSelected ? '#0284c7' : '#0f172a';
      if (direction === 'up') {
        ctx.beginPath();
        ctx.moveTo(s.x, s.y - radius + 2);
        ctx.lineTo(s.x - 5, s.y + 4);
        ctx.lineTo(s.x + 5, s.y + 4);
        ctx.closePath();
        ctx.fill();
      } else if (direction === 'down') {
        ctx.beginPath();
        ctx.moveTo(s.x, s.y + radius - 2);
        ctx.lineTo(s.x - 5, s.y - 4);
        ctx.lineTo(s.x + 5, s.y - 4);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(s.x - 5, s.y - 5);
        ctx.lineTo(s.x + 5, s.y + 5);
        ctx.moveTo(s.x + 5, s.y - 5);
        ctx.lineTo(s.x - 5, s.y + 5);
        ctx.stroke();
      }

      ctx.font = '600 10px Inter, sans-serif';
      ctx.fillStyle = isSelected ? '#0284c7' : '#334155';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${r.name} (${targetName}) ⌀${r.diameter || 25}mm`, s.x + radius + 5, s.y);

      ctx.restore();
    }
  }

  renderUnifilarDiagram(ctx, worldX, worldY, isDirectScreen = false) {
    if (!this.layers.unifilar) return;

    ctx.save();
    if (isDirectScreen) {
      ctx.translate(worldX || 0, worldY || 0);
      const sc = 0.82;
      ctx.scale(sc, sc);
    } else {
      const s = this.viewport.worldToScreen({ x: worldX, y: worldY });
      ctx.translate(s.x, s.y);
      const sc = this.viewport.zoom / 55;
      ctx.scale(sc, sc);
    }

    const boxW = 340;
    const boxH = 205;

    // Fundo branco com borda técnica
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-12, -32, boxW, boxH);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(-12, -32, boxW, boxH);

    // Barra de cabeçalho do Quadro
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(-12, -32, boxW, 26);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-12, -6);
    ctx.lineTo(-12 + boxW, -6);
    ctx.stroke();

    // Título e Ícone de Mover
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 11px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('QD1 — QUADRO GERAL DE DISTRIBUIÇÃO (3F+N+T)', 4, -19);

    // Alça de arrasto no canto superior direito
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('✢ Arrastar', boxW - 18, -19);

    // Linha de Entrada Principal
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(0, 16);
    ctx.lineTo(36, 16);
    ctx.stroke();

    // Disjuntor Geral DIN
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(36, 6, 26, 20);
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 1.6;
    ctx.strokeRect(36, 6, 26, 20);
    ctx.fillStyle = '#0284c7';
    ctx.font = 'bold 9px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('40A', 49, 16);

    // Rótulo Alimentador
    ctx.fillStyle = '#64748b';
    ctx.font = '8px Arial, sans-serif';
    ctx.fillText('Alimentador', 49, 34);
    ctx.fillText('#10mm²', 49, 44);

    // Barramento Vertical de Cobre
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(62, 16);
    ctx.lineTo(84, 16);
    ctx.moveTo(84, 4);
    ctx.lineTo(84, 155);
    ctx.stroke();

    const sampleCircuits = [
      { id: 1, type: 'Iluminação Sala / Terraço', gauge: 1.5, breaker: 10, phase: 'A', watts: 200 },
      { id: 2, type: 'TUGs Sala Comercial', gauge: 2.5, breaker: 20, phase: 'B', watts: 1200 },
      { id: 3, type: 'TUE - Chuveiro Elétrico', gauge: 4.0, breaker: 25, phase: 'C', watts: 5500 },
      { id: 4, type: 'TUGs Cozinha / Área', gauge: 2.5, breaker: 20, phase: 'A', watts: 1800 },
      { id: 5, type: 'Iluminação Circulação', gauge: 1.5, breaker: 10, phase: 'B', watts: 100 }
    ];

    sampleCircuits.forEach((c, idx) => {
      const y = 16 + idx * 28;

      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(84, y);
      ctx.lineTo(110, y);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(110, y - 8, 20, 16);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(110, y - 8, 20, 16);

      ctx.beginPath();
      ctx.moveTo(130, y);
      ctx.lineTo(150, y);
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 8.5px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${c.breaker}A`, 120, y);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 9px Arial, sans-serif';
      ctx.fillText(`C${c.id} - ${c.type}`, 156, y - 4);

      ctx.fillStyle = '#475569';
      ctx.font = '8px Arial, sans-serif';
      ctx.fillText(`#${c.gauge}mm² | Fase ${c.phase} | ${c.watts}W`, 156, y + 7);
    });

    ctx.restore();
  }

  render(ctx, w, h) {
    ctx.clearRect(0, 0, w, h);

    // 1. Grade milimetrada de fundo
    if (this.layers.grid) {
      this.viewport.renderGrid(ctx, w, h);
    }

    // 1.5 Pavimento Subjacente (Underlay / Plano Fantasma esmaecido)
    if (this.underlayLevelId) {
      const underlay = this.levels ? this.levels.find(l => l.id === this.underlayLevelId) : null;
      if (underlay && underlay.id !== this.activeLevelId) {
        this.renderUnderlay(ctx, underlay);
      }
    }

    // 2. Alvenaria e Cômodos da Arquitetura
    this.renderArchitecture(ctx);

    // 2.1 Cotas e Dimensões Técnicas (NBR 6492)
    this.renderDimensions(ctx, this.isPaperSpace);

    const nodeMap = new Map(this.nodes.map(n => [n.id, n]));

    // 3. Eletrodutos Curvados em Arco Suave (Bézier)
    if (this.layers.conduits) {
      for (const c of this.conduits) {
        const a = nodeMap.get(c.nodeAId);
        const b = nodeMap.get(c.nodeBId);
        if (!a || !b) continue;

        const sA = this.viewport.worldToScreen(a.position);
        const sB = this.viewport.worldToScreen(b.position);

        const mid = new Vector2D((sA.x + sB.x) / 2, (sA.y + sB.y) / 2);
        const dir = new Vector2D(sB.x - sA.x, sB.y - sA.y);
        const normal = dir.orthogonal().normalize();
        const curvatureAmount = Math.min(26, dir.length() * 0.16) * (c.curveDirection || 1);
        const ctrlPt = new Vector2D(mid.x + normal.x * curvatureAmount, mid.y + normal.y * curvatureAmount);

        const isSelected = this.selectedElement && this.selectedElement.type === 'conduit' && this.selectedElement.id === c.id;

        ctx.save();
        if (isSelected) {
          ctx.strokeStyle = '#0284c7';
          ctx.lineWidth = 3.5;
          ctx.shadowColor = 'rgba(2, 132, 199, 0.45)';
          ctx.shadowBlur = 8;
        } else {
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 1.4;
        }

        if (c.installationType === 'floor') {
          ctx.setLineDash([5, 5]);
        } else {
          ctx.setLineDash([]);
        }

        ctx.beginPath();
        ctx.moveTo(sA.x, sA.y);
        ctx.quadraticCurveTo(ctrlPt.x, ctrlPt.y, sB.x, sB.y);
        ctx.stroke();
        ctx.restore();

        if (this.layers.wiring) {
          const wires = this.wireAllocations.get(c.id);
          if (wires && wires.length > 0) {
            const wireT = typeof c.wireT === 'number' ? c.wireT : 0.5;
            const wireSide = typeof c.wireSide === 'number' ? c.wireSide : 1;
            const isWireSelected = this.selectedElement && (
              (this.selectedElement.type === 'wire_tag' && this.selectedElement.conduitId === c.id) ||
              (this.selectedElement.type === 'conduit' && this.selectedElement.id === c.id)
            );
            WireRenderer.renderWiresOnConduit(ctx, sA, sB, ctrlPt, wires, wireT, wireSide, isWireSelected);
          }
        }
      }
    }

    // 4. Linha de Pré-visualização de conexão de eletroduto
    if (this.activeTool === 'conduit' && this.conduitStartNodeId) {
      const sNode = nodeMap.get(this.conduitStartNodeId);
      if (sNode) {
        const sStart = this.viewport.worldToScreen(sNode.position);
        const sEnd = this.viewport.worldToScreen(this.currentSnap.point);
        ctx.save();
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(sStart.x, sStart.y);
        ctx.lineTo(sEnd.x, sEnd.y);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 5. Pontos Elétricos (Simbologia ABNT)
    if (this.layers.electric) {
      for (const node of this.nodes) {
        SymbolRenderer.renderNode(ctx, node, this.viewport, node.id === this.selectedNodeId);
      }
      // 5.1 Prumadas Verticais de Eletroduto (NBR 5410 / NBR 6492)
      this.renderRisers(ctx);
    }

    // 6. Diagrama Unifilar no Canvas (Móvel)
    this.renderUnifilarDiagram(ctx, this.sldPosition.x, this.sldPosition.y);

    // 7. Miras Visuais de Snapping Magnético (Ocultas no Paper Space de impressão)
    if (!this.isPaperSpace && this.currentSnap.snapped) {
      const s = this.viewport.worldToScreen(this.currentSnap.point);
      ctx.save();
      ctx.lineWidth = 2;

      if (this.currentSnap.type === 'riser') {
        // Marcador de Prumada Vertical (Círculo azul com mira cruzada)
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 11, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#0284c7';
        ctx.font = 'bold 10px Arial, sans-serif';
        ctx.fillText(this.currentSnap.label || 'Prumada Vertical', s.x + 14, s.y - 8);
      } else if (this.currentSnap.type === 'underlay_vertex') {
        // Marcador de Vértice Subjacente (Quadrado cinza)
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1.6;
        ctx.strokeRect(s.x - 6, s.y - 6, 12, 12);
        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 10px Arial, sans-serif';
        ctx.fillText(this.currentSnap.label || 'Canto do Pavimento Subjacente', s.x + 12, s.y - 8);
      } else if (this.currentSnap.type === 'perpendicular') {
        // Símbolo clássico CAD de perpendicular (⟂)
        ctx.strokeStyle = '#0284c7';
        ctx.strokeRect(s.x - 6, s.y - 6, 12, 12);
        ctx.beginPath();
        ctx.moveTo(s.x, s.y - 6);
        ctx.lineTo(s.x, s.y + 6);
        ctx.moveTo(s.x - 6, s.y + 6);
        ctx.lineTo(s.x + 6, s.y + 6);
        ctx.stroke();

        ctx.fillStyle = '#0284c7';
        ctx.font = 'bold 10px Arial, sans-serif';
        ctx.fillText('⟂ Perpendicular 90°', s.x + 12, s.y - 8);
      } else if (this.currentSnap.type === 'door_jamb' || this.currentSnap.type === 'window_jamb') {
        // Marcador quadrado laranja/âmbar com cruz interna (Batente / Marco de Abertura)
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 2.0;
        ctx.strokeRect(s.x - 5, s.y - 5, 10, 10);
        ctx.beginPath();
        ctx.moveTo(s.x, s.y - 4); ctx.lineTo(s.x, s.y + 4);
        ctx.moveTo(s.x - 4, s.y); ctx.lineTo(s.x + 4, s.y);
        ctx.stroke();

        ctx.fillStyle = '#d97706';
        ctx.font = 'bold 10px Arial, sans-serif';
        ctx.fillText(this.currentSnap.label || 'Marco de Abertura', s.x + 10, s.y - 8);
      } else if (this.currentSnap.type === 'door_center' || this.currentSnap.type === 'window_center') {
        // Círculo com ponto central (Eixo de Abertura)
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.arc(s.x, s.y, 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = 'bold 10px Arial, sans-serif';
        ctx.fillText(this.currentSnap.label || 'Centro da Abertura', s.x + 10, s.y - 8);
      } else if (this.currentSnap.type === 'boneca') {
        // Marcador de Boneca 10 cm da porta
        ctx.strokeStyle = '#10b981';
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(s.x, s.y, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = 'bold 10px Arial, sans-serif';
        ctx.fillText('Boneca 10 cm', s.x + 10, s.y - 8);
      } else if (this.currentSnap.type === 'wall_face_corner') {
        // Losango verde esmeralda (Quina da face da parede: interna ou externa)
        ctx.strokeStyle = '#059669';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y - 6);
        ctx.lineTo(s.x + 6, s.y);
        ctx.lineTo(s.x, s.y + 6);
        ctx.lineTo(s.x - 6, s.y);
        ctx.closePath();
        ctx.stroke();

        ctx.fillStyle = '#059669';
        ctx.font = 'bold 10px Arial, sans-serif';
        ctx.fillText('Quina da Parede (Face)', s.x + 10, s.y - 8);
      } else if (this.currentSnap.type === 'wall_face') {
        // Marcador circular nítido com mira (Face da parede: interna ou externa)
        ctx.strokeStyle = '#059669';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 5, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#059669';
        ctx.font = 'bold 10px Arial, sans-serif';
        ctx.fillText('Face da Parede', s.x + 10, s.y - 8);
      } else if (this.currentSnap.type === 'endpoint') {
        // Quadrado verde (Eixo da parede ou nó)
        ctx.strokeStyle = '#10b981';
        ctx.strokeRect(s.x - 5, s.y - 5, 10, 10);
        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 10px Arial, sans-serif';
        ctx.fillText('Eixo da Parede', s.x + 10, s.y - 8);
      } else if (this.currentSnap.type === 'midpoint') {
        // Triângulo ciano (Ponto Médio)
        ctx.strokeStyle = '#06b6d4';
        ctx.beginPath();
        ctx.moveTo(s.x, s.y - 6);
        ctx.lineTo(s.x + 6, s.y + 5);
        ctx.lineTo(s.x - 6, s.y + 5);
        ctx.closePath();
        ctx.stroke();
      } else if (this.currentSnap.type === 'nearest') {
        // Ampulheta amarela (Sobre o segmento central)
        ctx.strokeStyle = '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(s.x - 5, s.y - 5);
        ctx.lineTo(s.x + 5, s.y + 5);
        ctx.moveTo(s.x + 5, s.y - 5);
        ctx.lineTo(s.x - 5, s.y + 5);
        ctx.stroke();
      } else {
        // Círculo verde (Ponto elétrico ou polar)
        ctx.strokeStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(s.x, s.y, 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }

    // 8. Prévia Dinâmica no Cursor (Ghost Cursor Preview — Oculto no Paper Space)
    if (!this.isPaperSpace && (this.activeTool === 'door' || this.activeTool === 'window')) {
      const near = this.findNearestWall(this.mouseWorldPos, 0.75);
      ctx.save();

      if (near) {
        const snapPt = (this.currentSnap && this.currentSnap.snapped && this.currentSnap.type === 'boneca')
          ? this.currentSnap.point
          : near.point;
        const p = this.viewport.worldToScreen(snapPt);
        const rot = near.angle;

        if (this.activeTool === 'door') {
          this.drawDoorEntity(ctx, p, rot, this.currentDoorWidth || 0.8, this.currentDoorType || 'abrir', this.doorOrientationIndex || 0, false, true, 0.16);
        } else {
          ctx.translate(p.x, p.y);
          ctx.rotate(rot);
          ctx.globalAlpha = 0.75;
          // Janela
          const w = (this.currentWindowWidth || 1.2) * this.viewport.zoom;
          const th = 0.15 * this.viewport.zoom;
          ctx.fillStyle = 'rgba(2, 132, 199, 0.2)';
          ctx.fillRect(-w / 2, -th / 2, w, th);
          ctx.strokeStyle = '#0284c7';
          ctx.lineWidth = 2.0;
          ctx.strokeRect(-w / 2, -th / 2, w, th);
          ctx.beginPath();
          ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2, 0);
          ctx.stroke();
        }

        ctx.restore();

        // Helper Pill junto ao cursor
        ctx.save();
        ctx.fillStyle = '#0284c7';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        const msg = this.activeTool === 'door' ? 'Porta [Espaço: Girar | Clique: Fixar]' : 'Janela [Clique: Fixar]';
        ctx.font = 'bold 10px Arial, sans-serif';
        const txtW = ctx.measureText(msg).width;
        ctx.fillRect(this.mouseScreenPos.x + 14, this.mouseScreenPos.y - 24, txtW + 16, 20);
        ctx.strokeRect(this.mouseScreenPos.x + 14, this.mouseScreenPos.y - 24, txtW + 16, 20);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(msg, this.mouseScreenPos.x + 22, this.mouseScreenPos.y - 14);
        ctx.restore();
      } else {
        // Sem parede sob o cursor: Indicador visual de Proibido / Host Necessário
        ctx.save();
        ctx.translate(this.mouseScreenPos.x, this.mouseScreenPos.y);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.moveTo(-7, -7); ctx.lineTo(7, 7);
        ctx.stroke();

        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 9.5px Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('Aproxime de uma parede', 16, 0);
        ctx.restore();
      }
    }

    // 9. Destaque de Elemento Focado via [Tab] Cycling (Aro sutil sem texto redundante no cursor)
    if (!this.isPaperSpace && this.activeTool === 'select' && this.hoverCandidates && this.hoverCandidates.length > 0 && !this.isDragging && !this.isSelectingBox) {
      const cand = this.hoverCandidates[this.hoverCandidateIndex];
      if (cand) {
        ctx.save();
        const candScreen = this.viewport.worldToScreen(cand.pos);

        // Halo/Ring pontilhado em azul CAD
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 2.0;
        ctx.setLineDash([4, 4]);

        if (cand.type === 'node') {
          ctx.beginPath();
          ctx.arc(candScreen.x, candScreen.y, 18, 0, Math.PI * 2);
          ctx.stroke();
        } else if (cand.type === 'door' || cand.type === 'window') {
          ctx.strokeRect(candScreen.x - 22, candScreen.y - 22, 44, 44);
        } else if (cand.type === 'wall' || cand.type === 'wall_segment') {
          ctx.beginPath();
          ctx.arc(candScreen.x, candScreen.y, 14, 0, Math.PI * 2);
          ctx.stroke();
        } else if (cand.type === 'room') {
          ctx.strokeRect(candScreen.x - 55, candScreen.y - 20, 110, 40);
        } else if (cand.type === 'dimension' && this.dimensions[cand.index]) {
          const d = this.dimensions[cand.index];
          const ptA = d.a || d.ptA;
          const ptB = d.b || d.ptB;
          if (ptA && ptB) {
            const sA = this.viewport.worldToScreen(ptA);
            const sB = this.viewport.worldToScreen(ptB);
            ctx.beginPath();
            ctx.moveTo(sA.x, sA.y); ctx.lineTo(sB.x, sB.y);
            ctx.stroke();
          }
        }
        ctx.setLineDash([]);
        ctx.restore();
      }
    }

    // 10. Caixa de Seleção Dinâmica em Massa (Janela e Cruzamento Retangular)
    if (!this.isPaperSpace && this.isSelectingBox && this.selectionBoxStart && this.selectionBoxCurrent) {
      const p1 = this.selectionBoxStart;
      const p2 = this.selectionBoxCurrent;
      const x = Math.min(p1.x, p2.x);
      const y = Math.min(p1.y, p2.y);
      const boxW = Math.abs(p2.x - p1.x);
      const boxH = Math.abs(p2.y - p1.y);
      const isWindow = (p2.x - p1.x) >= 0;

      ctx.save();
      if (isWindow) {
        // Window Selection (Esquerda p/ Direita = Azul Translúcido)
        ctx.fillStyle = 'rgba(2, 132, 199, 0.15)';
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([]);
      } else {
        // Crossing Selection (Direita p/ Esquerda = Verde Translúcido)
        ctx.fillStyle = 'rgba(34, 197, 94, 0.18)';
        ctx.strokeStyle = '#16a34a';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
      }
      ctx.fillRect(x, y, boxW, boxH);
      ctx.strokeRect(x, y, boxW, boxH);
      ctx.restore();
    }

    // 11. Destaque Visual para Itens Selecionados em Massa
    if (!this.isPaperSpace && this.selectedElement && this.selectedElement.type === 'multi' && this.selectedElements) {
      ctx.save();
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 2.0;
      ctx.setLineDash([4, 3]);

      for (const item of this.selectedElements) {
        if (item.type === 'node') {
          const n = this.nodes.find(x => x.id === item.id);
          if (n) {
            const s = this.viewport.worldToScreen(n.position);
            ctx.beginPath();
            ctx.arc(s.x, s.y, 16, 0, Math.PI * 2);
            ctx.stroke();
          }
        } else if (item.type === 'door' && this.doors[item.index]) {
          const s = this.viewport.worldToScreen(this.doors[item.index].pos);
          ctx.strokeRect(s.x - 20, s.y - 20, 40, 40);
        } else if (item.type === 'window' && this.windows[item.index]) {
          const s = this.viewport.worldToScreen(this.windows[item.index].pos);
          ctx.strokeRect(s.x - 25, s.y - 15, 50, 30);
        } else if (item.type === 'dimension' && this.dimensions[item.index]) {
          const d = this.dimensions[item.index];
          const ptA = d.a || d.ptA;
          const ptB = d.b || d.ptB;
          if (ptA && ptB) {
            const sA = this.viewport.worldToScreen(ptA);
            const sB = this.viewport.worldToScreen(ptB);
            ctx.beginPath();
            ctx.moveTo(sA.x, sA.y); ctx.lineTo(sB.x, sB.y);
            ctx.stroke();
          }
        } else if (item.type === 'wall' && this.walls[item.index]) {
          const w = this.walls[item.index];
          const sA = this.viewport.worldToScreen(w.a);
          const sB = this.viewport.worldToScreen(w.b);
          ctx.beginPath();
          ctx.moveTo(sA.x, sA.y); ctx.lineTo(sB.x, sB.y);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }
}
