# Motor de Engenharia e Dimensionamento: ABNT NBR 5410

Este documento apresenta a fundamentação matemática e os critérios normativos adotados no motor de dimensionamento elétrico do OpenElétrica, em estrita conformidade com a ABNT NBR 5410 (Instalações elétricas de baixa tensão).

---

## 1. Cálculo da Corrente de Projeto ($I_B$)

A corrente de projeto ($I_B$) de cada circuito terminal ou de distribuição é determinada pelas seguintes formulações:

### 1.1 Circuito Monofásico (Fase e Neutro)
$$I_B = \frac{P}{V \cdot \cos\phi}$$

Onde:
* $P$: Potência ativa total do circuito em Watts (W);
* $V$: Tensão nominal de fase (127 V ou 220 V);
* $\cos\phi$: Fator de potência da carga (adotado 1,0 para iluminação incandescente e cargas resistivas, ou 0,92 a 0,95 para cargas gerais).

### 1.2 Circuito Bifásico (Fase e Fase)
$$I_B = \frac{P}{V_{FF} \cdot \cos\phi}$$

### 1.3 Circuito Trifásico Equilibrado
$$I_B = \frac{P}{\sqrt{3} \cdot V_{FF} \cdot \cos\phi}$$

---

## 2. Critério da Capacidade de Condução de Corrente (Ampacidade)

A seção nominal dos condutores vivos deve satisfazer a condição fundamental de proteção:

$$I_B \le I_n \le I_z'$$

Onde:
* $I_B$: Corrente de projeto calculada;
* $I_n$: Corrente nominal do dispositivo de proteção contra sobrecorrentes (disjuntor termomagnético);
* $I_z'$: Capacidade de condução de corrente corrigida do condutor:
  $$I_z' = I_z \cdot FCT \cdot FCA$$
  * $I_z$: Capacidade nominal de corrente contínua em regime permanente (Tabelas 36 a 39 da NBR 5410);
  * $FCT$: Fator de correção de temperatura ambiente (Tabela 40 da NBR 5410);
  * $FCA$: Fator de correção por agrupamento de circuitos (Tabela 42 da NBR 5410).

### 2.1 Método de Instalação de Referência: B1
Condutores isolados ou cabos unipolares em eletroduto de seção circular embutido em alvenaria.

Valores nominais de capacidade de condução de corrente ($I_z$) para condutores de cobre com isolação em PVC 70 ºC à temperatura ambiente de 30 ºC:

| Seção Nominal (mm²) | 2 Condutores Carregados (A) | 3 Condutores Carregados (A) |
| :---: | :---: | :---: |
| 1,5 | 17,5 | 15,5 |
| 2,5 | 24,0 | 21,0 |
| 4,0 | 32,0 | 28,0 |
| 6,0 | 41,0 | 36,0 |
| 10,0 | 57,0 | 50,0 |
| 16,0 | 76,0 | 68,0 |
| 25,0 | 101,0 | 89,0 |
| 35,0 | 125,0 | 110,0 |

### 2.2 Seções Mínimas dos Condutores (Item 6.2.6.1.1 da NBR 5410)
* Circuitos de iluminação: seção mínima de 1,5 mm² (condutores de cobre);
* Circuitos de tomadas de uso geral (TUG), tomadas de uso específico (TUE) e força: seção mínima de 2,5 mm² (condutores de cobre);
* O condutor neutro deve possuir circuito próprio, sendo vedado o compartilhamento entre circuitos distintos;
* O condutor de proteção (terra) deve acompanhar todos os circuitos terminais.

### 2.3 Fator de Correção por Agrupamento (FCA: Tabela 42)
Para circuitos agrupados no mesmo conduto fechado:

| Número de Circuitos | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 ou mais |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Fator FCA | 1,00 | 0,80 | 0,70 | 0,65 | 0,60 | 0,57 | 0,54 | 0,52 | 0,50 |

---

## 3. Critério de Queda de Tensão Admissível ($\Delta V$)

A queda de tensão em regime contínuo, medida a partir dos terminais de origem até o ponto de utilização terminal, não deve superar:
* 4% para instalações alimentadas por rede pública de distribuição em baixa tensão;
* 2% em alimentadores intermediários, preservando a margem para os circuitos terminais.

### 3.1 Equacionamento da Queda de Tensão
$$\Delta V\% = \frac{k \cdot L \cdot I_B \cdot (r \cdot \cos\phi + x \cdot \operatorname{sen}\phi)}{V} \cdot 100$$

Onde:
* $k = 2$ para sistemas monofásicos ou bifásicos a dois fios;
* $k = \sqrt{3}$ para sistemas trifásicos simétricos;
* $L$: Comprimento do trajeto percorrido pelo circuito em quilômetros (somando distâncias horizontais e deslocamentos verticais);
* $r$: Resistência ôhmica linear do condutor à temperatura de serviço (75 ºC), em $\Omega/\text{km}$;
* $x$: Reatância indutiva linear dos condutores em $\Omega/\text{km}$ (adotado $0,08\,\Omega/\text{km}$ para circuitos em baixa tensão).

---

## 4. Ocupação e Dimensionamento de Eletrodutos

Conforme o item 6.2.11 da ABNT NBR 5410, a área da seção reta ocupada pelos cabos (considerando o diâmetro externo total com isolação) não deve exceder:
* 53% no caso de 1 condutor instalado;
* 31% no caso de 2 condutores instalados;
* 40% no caso de 3 ou mais condutores instalados.

$$\sum A_{\text{cabos}} \le \text{Taxa} \cdot A_{\text{interna}}$$

Diâmetros nominais comerciais padronizados: DN 20 (1/2 polegada), DN 25 (3/4 polegada), DN 32 (1 polegada), DN 40 (1 1/4 polegada) e DN 50 (1 1/2 polegada).
