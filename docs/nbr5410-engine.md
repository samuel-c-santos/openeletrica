# Motor de Engenharia e Dimensionamento — ABNT NBR 5410

Este documento especifica formalmente a implementação matemática e normativa do motor de cálculo da **ABNT NBR 5410** (Instalações elétricas de baixa tensão).

---

## 1. Cálculo da Corrente de Projeto ($I_B$)

A corrente de projeto de cada circuito terminal ou de alimentação é obtida pelas fórmulas fundamentais:

### 1.1 Circuito Monofásico (Fase-Neutro ou Fase-Fase)
$$I_B = \frac{P}{V \cdot \cos\phi}$$
* Onde:
  * $P$: Potência ativa total do circuito em Watts ($W$);
  * $V$: Tensão nominal (ex: 127V ou 220V);
  * $\cos\phi$: Fator de potência (padrão 1,0 para iluminação incandescente/resistiva e tomadas residenciais comuns, ou 0,92 / especificado para cargas reativas/motores).

### 1.2 Circuito Bifásico
$$I_B = \frac{P}{V_{FF} \cdot \cos\phi}$$

### 1.3 Circuito Trifásico Equilibrado
$$I_B = \frac{P}{\sqrt{3} \cdot V_{FF} \cdot \cos\phi}$$

---

## 2. Critério da Capacidade de Condução de Corrente (Ampacidade)

Para garantir a integridade dos condutores contra aquecimento excessivo, a seção do cabo deve satisfazer:

$$I_B \le I_n \le I_z'$$

Onde:
* $I_B$: Corrente de projeto calculada;
* $I_n$: Corrente nominal do dispositivo de proteção (disjuntor termomagnético);
* $I_z'$: Capacidade de condução de corrente corrigida do condutor nas condições reais de instalação:
  $$I_z' = I_z \cdot FCT \cdot FCA$$
  * $I_z$: Capacidade nominal de condução de corrente tabelada na NBR 5410 (Tabelas 36 a 39);
  * $FCT$: Fator de Correção de Temperatura (Tabela 40);
  * $FCA$: Fator de Correção de Agrupamento (Tabela 42).

### 2.1 Método de Instalação Predial Padrão: Método B1
Condutores isolados ou cabos unipolares em eletroduto de seção circular embutido em alvenaria.

#### Tabela de Capacidade de Corrente ($I_z$) — Condutores de Cobre, Isolação PVC 70ºC, 30ºC Ambiente:
| Seção Nominal (mm²) | 2 Condutores Carregados (A) | 3 Condutores Carregados (A) |
| :---: | :---: | :---: |
| **1,5** | 17,5 | 15,5 |
| **2,5** | 24,0 | 21,0 |
| **4,0** | 32,0 | 28,0 |
| **6,0** | 41,0 | 36,0 |
| **10,0** | 57,0 | 50,0 |
| **16,0** | 76,0 | 68,0 |
| **25,0** | 101,0 | 89,0 |
| **35,0** | 125,0 | 110,0 |

### 2.2 Seções Mínimas Regulamentares (Item 6.2.6.1.1 da NBR 5410)
* **Circuitos de Iluminação:** Mínimo de **1,5 mm²** (cobre).
* **Circuitos de Tomadas (TUG/TUE) e Força:** Mínimo de **2,5 mm²** (cobre).
* **Condutor Neutro:** Não pode ser comum a circuitos diferentes.
* **Condutor de Proteção (Terra):** Deve acompanhar todos os circuitos.

### 2.3 Fator de Correção de Agrupamento ($FCA$ - Tabela 42)
Quando múltiplos circuitos passam pelo mesmo eletroduto:
| Nº de Circuitos Agrupados | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | $\ge 9$ |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Fator $FCA$** | 1,00 | 0,80 | 0,70 | 0,65 | 0,60 | 0,57 | 0,54 | 0,52 | 0,50 |

---

## 3. Critério da Queda de Tensão ($\Delta V$)

A queda de tensão em regime permanente entre a origem da instalação (padrão de entrada/QGBT) e o ponto de utilização mais distante não deve exceder:
* **4%** para instalações alimentadas diretamente por rede pública de baixa tensão;
* **2%** para os circuitos terminais quando o alimentador já consome parte da margem.

### 3.1 Fórmula do Momento Elétrico Unitário
$$\Delta V\% = \frac{k \cdot L \cdot I_B \cdot (r \cdot \cos\phi + x \cdot \operatorname{sen}\phi)}{V} \cdot 100$$
Onde:
* $k = 2$ para sistemas monofásicos e bifásicos a dois fios;
* $k = \sqrt{3}$ para sistemas trifásicos equilibrados;
* $L$: Comprimento total do circuito em km (incluindo subidas/descidas verticais);
* $r$: Resistência elétrica do condutor a 75ºC em $\Omega/\text{km}$;
* $x$: Reatância indutiva dos condutores em $\Omega/\text{km}$ (padrão $0,08\,\Omega/\text{km}$ em baixa tensão).

---

## 4. Dimensionamento de Eletrodutos (Taxa de Ocupação Máxima)

Conforme o item 6.2.11 da NBR 5410, a área da seção transversal ocupada pelos cabos (incluindo o isolamento externo) não deve exceder:
* **53%** no caso de 1 condutor;
* **31%** no caso de 2 condutores;
* **40%** no caso de 3 ou mais condutores.

$$\sum A_{\text{cabos}} \le \text{Taxa} \cdot A_{\text{interna\_eletroduto}}$$

Diâmetros comerciais nominais adotados: DN 20 (1/2"), DN 25 (3/4"), DN 32 (1"), DN 40 (1 1/4"), DN 50 (1 1/2").

---

## 5. Balanceamento Automático de Cargas no QDC

Para evitar sobrecarga no neutro e perdas desnecessárias em alimentadores trifásicos, o algoritmo distribui as correntes de forma equilibrada entre as fases $A$, $B$ e $C$:

$$\text{Desequilíbrio} = \frac{\max(I_A, I_B, I_C) - \min(I_A, I_B, I_C)}{\text{Média}(I_A, I_B, I_C)} \cdot 100 \le 10\%$$

O algoritmo modela o problema como uma variação do *Multiprocessor Scheduling / Bin Packing*, ordenando os circuitos por potência decrescente e alocando cada novo circuito monofásico na fase de menor carga acumulada atual.
