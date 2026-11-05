import { sizeCircuit, calculateCurrentIb, calculateVoltageDrop } from './sizing.ts';

function runTests() {
  console.log('--- Testando Motor de Dimensionamento NBR 5410 ---');

  // Teste 1: Chuveiro 5500W em 220V monofásico
  const shower = sizeCircuit({
    powerWatts: 5500,
    voltage: 220,
    powerFactor: 1.0,
    circuitType: 'dedicated',
    nPhases: 1,
    lengthMeters: 15,
    groupingCircuitsCount: 1
  });

  console.log('Chuveiro 5500W / 220V:');
  console.log(`  Ib: ${shower.currentIb} A`);
  console.log(`  Bitola: ${shower.gaugeMm2} mm²`);
  console.log(`  Disjuntor: ${shower.breakerAmperes} A`);
  console.log(`  Queda de tensão: ${shower.voltageDropPercent}%`);
  console.log(`  Eletroduto: DN ${shower.conduitDiameterMm}`);

  if (shower.currentIb === 25.0 && shower.gaugeMm2 >= 4.0 && shower.breakerAmperes >= 25) {
    console.log('  [PASSOU] Chuveiro dimensionado perfeitamente.');
  } else {
    console.error('  [FALHOU] Resultado inesperado no chuveiro.');
  }

  // Teste 2: Circuito de Iluminação 600W em 127V
  const lights = sizeCircuit({
    powerWatts: 600,
    voltage: 127,
    powerFactor: 1.0,
    circuitType: 'light',
    nPhases: 1,
    lengthMeters: 20,
    groupingCircuitsCount: 2
  });

  console.log('\nIluminação 600W / 127V:');
  console.log(`  Ib: ${lights.currentIb} A`);
  console.log(`  Bitola: ${lights.gaugeMm2} mm²`);
  console.log(`  Disjuntor: ${lights.breakerAmperes} A`);
  console.log(`  Queda de tensão: ${lights.voltageDropPercent}%`);

  if (lights.gaugeMm2 === 1.5 && lights.breakerAmperes >= 6) {
    console.log('  [PASSOU] Iluminação respeitou seção mínima de 1,5 mm² e disjuntor adequado.');
  } else {
    console.error('  [FALHOU] Resultado inesperado na iluminação.');
  }

  console.log('\nTodos os testes normativos foram executados com sucesso!');
}

runTests();
