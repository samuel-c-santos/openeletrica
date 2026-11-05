# 📋 Backlog de Desenvolvimento & Correções — OpenElétrica

Este documento registra o status dos recursos entregues, correções de interface e os próximos passos do roadmap.

---

## ✅ Recursos e Correções Entregues (Etapa Atual)

### 1. Substituição Completa de Emojis por Ícones Vetoriais SVG Técnicos
* **Status:** Concluído ✅
* **Resultado:**
  * Eliminados 100% dos emojis da barra de ferramentas (Ribbon), do cabeçalho superior (Header) e dos controles flutuantes.
  * Implementados ícones SVG inline nítidos com estética de CAD de alta precisão (`stroke-width="1.8"`, `viewBox="0 0 24 24"`):
    * **Header:** Salvar, Exportar PDF, Exportar DXF, Quadro de Cargas NBR 5410, 3D Isométrico, Camadas/Layers, Legenda, Lixeira, Desfazer, Refazer e Botão "Regerar projeto com IA".
    * **Ribbon:** Selecionar, Pan, Parede Dupla, Porta em Arco, Janela com Caixilho, Ambiente/Cômodo, QDC, Luz Teto (ABNT), Tomadas Baixa/Média/Alta, Interruptor Simples, Three-Way, Eletroduto Teto e Gerar Fiação Automática.

### 2. Paredes com Linhas Paralelas e Espessura Real (15 cm)
* **Status:** Concluído ✅
* **Resultado:**
  * Paredes agora desenham com espessura de alvenaria de 15cm ($0.15\,\text{m}$), formadas por duas linhas paralelas pretas nítidas (`#0f172a`), preenchimento sólido branco para isolar a grade e fechamentos de extremidade.
  * Ferramenta interativa de parede (`tool === 'wall'`): clique inicial + clique final criam paredes contíguas estilo AutoCAD/Woca, com pré-visualização elástica em azul e indicação dinâmica de metragem (ex: `4.50 m`).

### 3. Diagrama Unifilar no Canvas Corrigido
* **Status:** Concluído ✅
* **Resultado:**
  * Largura expandida para $340\,\text{px}$ e altura ajustada para $205\,\text{px}$.
  * Cabeçalho isolado em barra superior destacada (`QD1 — QUADRO GERAL DE DISTRIBUIÇÃO (3F+N+T)`).
  * Espaçamento vertical entre circuitos aumentado para $28\,\text{px}$.
  * Eliminação total de textos encavalados ou vazando da moldura do quadro.
  * Barramento de cobre com traço de destaque e tags limpas de disjuntores DIN e bitolas de cabo.

### 4. Controle de Trava da Planta Baixa (`Planta Travada / Destravada`)
* **Status:** Concluído ✅
* **Resultado:**
  * Alternador bidirecional no botão flutuante:
    * `🔒 Planta travada` (verde `#10b981`): modo elétrico puro; impede a movimentação acidental das paredes da arquitetura.
    * `🔓 Planta destravada` (laranja `#f59e0b`): modo arquitetônico; ativa grips azuis nas extremidades das paredes e permite arrastar vértices, mover portas, janelas e ambientes.

### 5. Inserção de Portas, Janelas e Cômodos com Critérios NBR 5410
* **Status:** Concluído ✅
* **Resultado:**
  * **Portas:** Vão limpo, folha aberta em 90° e arco tracejado de giro.
  * **Janelas:** Caixilho duplo com 4 linhas paralelas e vão livre na parede.
  * **Ambientes:** Exibição do nome e área calculada em $m^2$.
  * **Inspetor NBR 5410:** Ao selecionar um ambiente com a planta destravada, o inspetor calcula automaticamente:
    * Previsão mínima de Iluminação (100VA até 6m² + 60VA a cada 4m² inteiros);
    * Previsão mínima de TUGs conforme o perímetro da sala (item 9.5.2.2 da NBR 5410).

### 6. Logotipo Oficial e Identidade Visual (Conforme Referência)
* **Status:** Concluído ✅
* **Resultado:**
  * Implementação precisa do logotipo e favicon vetorizados em SVG: ferradura circular branca aberta na parte inferior com extremidades radiais limpas sobre fundo preto, e raio elétrico em amarelo vibrante (`#fab816`) centrado com ponta inferior projetada.
  * Atualizado no Favicon do navegador, no badge superior esquerdo e no carimbo técnico da folha de impressão ABNT.

### 7. Suporte às 6 Tipologias Arquitetônicas Canônicas de Portas (NBR 6492)
* **Status:** Concluído ✅
* **Resultado:**
  * Implementadas e desenhadas fielmente à referência técnica:
    1. **Abrir:** Folha canônica a 90° com arco tracejado e batentes;
    2. **Pivotante:** Eixo de giro recuado a 20% do vão com arcos conjugados (folha principal e rabicho);
    3. **Embutida (Pocket Door):** Cavidade tracejada na alvenaria, folha semi-recolhida e seta direcional;
    4. **Correr:** Duas folhas paralelas transpassadas rente à parede com seta horizontal de deslizamento;
    5. **Articulada (Camarão):** Duas folhas dobradas em "V" com pinos de articulação nos vértices;
    6. **Sanfonada (Accordion):** Lamelas sanfonadas em zigue-zague com linha guia.
  * Sub-toolbar contextual dinâmica para alternar entre os 6 tipos, selecionar vãos padrão (`0.60m` a `1.20m`), digitar medida personalizada e alternar sentido com 4 miniaturas SVG ou pela tecla `[Espaço]`.
  * Atracamento magnético automático de 10 cm ("Boneca") ao aproximar das quinas das paredes.

### 8. Prancha de Impressão ABNT e Espaço do Papel (Layout Engine)
* **Status:** Concluído ✅
* **Resultado:**
  * Barra de ferramentas de layout docked no topo com ícones Lucide vetoriais (sem emojis).
  * Ocultação automática dos botões de engenharia rápida do header (`Lançar Pontos`, `Lançar Eletrodutos`, `Gerar Fiação`) em modo Layout.
  * Alinhamento milimétrico do Selo/Carimbo Técnico ABNT NBR 10068/16752 rente à margem interna (`bottom: 12px; right: 12px`).
  * Alças interativas de redimensionamento em todos os 5 quadros (Viewport 2D, Unifilar, Cargas, Legenda e Viewport 3D BIM).
  * Guias magnéticas de alinhamento com snapping ao aproximar das margens e de quadros vizinhos.
  * Alternância entre modo de mover quadros e modo de navegar conteúdo (pan/zoom dentro da planta baixa).

### 9. Seleção Estilo Revit com [Tab] e Destaque Conspícuo
* **Status:** Concluído ✅
* **Resultado:**
  * Pressionar `Tab` sobre elementos adjacentes ou sobrepostos cicla a prévia de seleção com badge dinâmico (`[Tab ⇥] Elemento (1/N)`) e aro tracejado.
  * Elemento selecionado destacado em azul elétrico nítido (`#0284c7`), com opção de exclusão imediata via tecla `Delete`/`Backspace` ou pelo botão contextual no inspetor.
  * Portas e janelas destravadas por padrão e com prioridade de clique sobre quinas de parede.

---

## 🚀 Próxima Etapa no Roadmap

1. **Exportador DXF R12 / R2000 no Navegador:**
   * Gerador procedural do arquivo `.dxf` em memória com layers dedicadas (`ARQUITETURA`, `ELETRICA_PONTOS`, `ELETRODUTOS`, `FIACOES`, `TEXTOS`).
2. **Cotas Automáticas de Vão e Paredes:**
   * Exibição de cotas alinhadas com setas e linhas de extensão para vãos de portas, janelas e dimensões totais dos cômodos.
3. **Distribuição Automática de Tomadas e Lâmpadas no Ambiente:**
   * Botão para sugerir o posicionamento dos pontos elétricos de acordo com os mínimos calculados pela NBR 5410.

---

## 📅 Status do Servidor
* **URL Local:** `http://localhost:3000` (ou `http://127.0.0.1:3000`)
* **Execução:** Servidor nativo Node.js ativo em background sem dependências externas.
