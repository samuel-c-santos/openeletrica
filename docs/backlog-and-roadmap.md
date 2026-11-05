# Registro de Engenharia, Entregas e Planejamento: OpenElétrica

Este documento registra o histórico de implementações concluídas, a resolução de inconformidades técnicas e o planejamento das próximas etapas de desenvolvimento do sistema OpenElétrica.

---

## 1. Módulos e Recursos Implementados

### 1.1 Padronização de Interface e Eliminação de Caracteres Especiais
* Substituição integral de símbolos pictóricos informais por ícones vetoriais SVG técnicos nas barras de comandos e controles do sistema.
* Aplicação de estilos sóbrios de engenharia com traçado uniforme (largura de 1,8 pixels) nas ferramentas de modelagem e navegação.

### 1.2 Modelagem de Alvenarias e Fechamento de Quinas
* Implementação de paredes com espessura nominal configurável (padrão de 0,15 m), com linhas paralelas contínuas e preenchimento sólido de isolamento.
* Resolução geométrica automática de cantos em L por meio do cálculo exato de concordância em 45 graus (miter joints), com tolerância de atração ajustada para 0,25 m.
* Resolução automática de junções em T com ajuste de faces e concordância com paredes transversais.
* Movimentação articulada de quinas: a translação de um vértice de alvenaria desloca conjuntamente os vértices coincidentes de todas as paredes conectadas àquele nó.

### 1.3 Entrada Direta de Distâncias (Direct Distance Entry)
* Implementação do método de entrada numérica de distâncias ao desenhar paredes contínuas.
* O usuário define a orientação angular através do cursor e digita a metragem desejada no teclado numérico, confirmando o lançamento com a tecla Enter.
* O sistema mantém o encadeamento contínuo da alvenaria a partir da coordenada final calculada.

### 1.4 Cotagem Técnica e Cotas Paramétricas Vinculadas (NBR 6492)
* Inserção de cotas técnicas em três etapas sequenciais: definição da coordenada de origem, definição da coordenada de destino e ajuste do afastamento da linha de cota.
* Alinhamento magnético automático para alinhamento em cadeia com cotas paralelas vizinhas.
* Seleção e manipulação de cotas no espaço do modelo, permitindo reposicionamento da linha e inversão do lado de afastamento.
* Implementação de cotas paramétricas vinculadas: ao selecionar uma alvenaria e editar o valor numérico de uma cota interna ou longitudinal associada, a parede é transladada para satisfazer a nova medida, reajustando automaticamente as alvenarias conectadas para manter os compartimentos fechados.

### 1.5 Tipologias de Portas Conforme a ABNT NBR 6492
* Implementação das seis tipologias canônicas de portas:
  1. Abrir: folha a 90 graus com batente e arco tracejado de varredura;
  2. Pivotante: eixo de rotação a 20% do vão com arcos conjugados de folha e contrapeso;
  3. Embutida (Pocket Door): cavidade tracejada na alvenaria com folha recolhível e seta indicativa;
  4. Correr: folhas transpassadas paralelas à face da parede com indicação de translação;
  5. Articulada (Camarão): folhas em ângulo com pontos de rotação;
  6. Sanfonada: lamelas em zigue-zague com linha guia central.
* Aderência estrita à alvenaria hospedeira com atracamento automático de 10 cm ("boneca") em relação às quinas internas.
* Alternância rápida de orientação e sentido de abertura pela tecla de espaço ou seletores de painel.

### 1.6 Módulo de Prancha e Espaço do Papel (Layout Engine)
* Compositor de pranchas nos formatos A0, A1, A2, A3 e A4 em orientação paisagem.
* Inserção e posicionamento de janelas de exibição (viewports) bidimensionais e tridimensionais com escalas normatizadas (1:50, 1:75, 1:100, 1:20, 1:25).
* Selo e carimbo técnico em estrita conformidade com as normas ABNT NBR 10068 e ABNT NBR 16752 posicionado no canto inferior direito da folha.
* Guias magnéticas de alinhamento com atracamento entre janelas e margens úteis.
* Alternância de controle entre manipulação da moldura e navegação de conteúdo interno da viewport.

### 1.7 Diagrama Unifilar e Quadro de Cargas
* Geração do Diagrama Unifilar em elemento flutuante posicionável ao lado da planta baixa.
* Quadro de Cargas balanceado com especificação de corrente nominal, queda de tensão, condutores e dispositivos de proteção por circuito.

---

## 2. Planejamento das Próximas Etapas

1. Exportação Completa em Formato DXF:
   Serialização das entidades de arquitetura, alvenarias, cotas, simbologias elétricas e fiação em camadas padronizadas para leitura em softwares CAD convencionais.
2. Lançamento Automático de Pontos por Ambiente:
   Cálculo e distribuição automática dos pontos mínimos de iluminação e tomadas em conformidade com o item 9.5.2 da ABNT NBR 5410.
3. Dimensionamento de Circuitos Alimentadores:
   Cálculo de condutores de entrada a partir do padrão da concessionária e coordenação de seletividade entre disjuntores gerais e parciais.
