# AGENTS.md — Diretrizes para Agentes de IA & Engenharia

Bem-vindo ao projeto **OpenElétrica** (alternativa moderna, aberta e 100% web para CAD de instalações elétricas prediais em conformidade com a ABNT NBR 5410).

Este documento é a **bíblia operacional** para qualquer Agente de IA, desenvolvedor ou colaborador humano que atuar neste repositório. Toda decisão de código, arquitetura ou implementação matemática deve respeitar rigorosamente as diretrizes aqui contidas.

---

## 1. Visão Geral & Filosofia do Projeto

* **Propósito:** Oferecer um software de projeto elétrico predial gratuito, de código aberto, intuitivo e executado diretamente no navegador (*browser-based/offline-first*), capaz de competir com soluções proprietárias e comerciais de CAD/BIM de mercado.
* **Engenharia Limpa (*Clean-Room Implementation*):**
  * O diretório `.reference-legacy/` (ignorado pelo Git) contém ativos desofuscados exclusivamente para benchmark conceitual de requisitos funcionais e tabelas normativas.
  * **Regra de Ouro:** NUNCA copie código legado diretamente para a nova base `src/`. Todo o novo código deve ser reescrito do zero em **TypeScript moderno (ESM)**, com tipagem estrita, arquitetura de componentes desacoplada, alta cobertura de testes unitários e padrões modernos de código limpo.
* **Offline-First / Zero Backend Obrigatório:**
  * O motor de dimensionamento da NBR 5410, o roteamento da fiação, o Diagrama Unifilar e a exportação DXF devem rodar **100% no cliente (WebAssembly / TypeScript no navegador)**. O backend é opcional (apenas para sincronização de contas ou colaboração em tempo real).

---

## 2. Estrutura do Repositório

```text
H:\Meu Drive\DEV\eletrica\
├── AGENTS.md                      # Este arquivo: diretrizes mestras
├── README.md                      # Apresentação do projeto e quickstart
├── package.json                   # Configurações do ecossistema Node/TS/Vite
├── tsconfig.json                  # TypeScript estrito (ES2022 / Bundler)
├── vite.config.ts                 # Configuração do Vite + plugins
│
├── docs/                          # Documentação Técnica e de Engenharia
│   ├── architecture.md            # Arquitetura do sistema, Pipeline de renderização e estado
│   ├── nbr5410-engine.md          # Fórmulas, tabelas, critérios de dimensionamento e esquemas
│   ├── wiring-routing-graph.md    # Algoritmo de roteamento espacial e layout anti-colisão
│   ├── cad-and-dxf.md             # Renderização 2D/Canvas, Snapping e exportação DXF
│   └── backlog-and-roadmap.md     # Backlog priorizado, bugs mapeados e diretrizes da próxima etapa
│
├── src/                           # Código-fonte novo (TypeScript puro / React)
│   ├── core/                      # Camada de Domínio / Regras de Negócio (Independente de UI)
│   │   ├── math/                  # Vetores 2D, Matrizes, Interseções, Polígonos, Bounding Boxes
│   │   ├── nbr5410/               # Motor de dimensionamento elétrico, tabelas e regras normativas
│   │   ├── graph/                 # Topologia de rede (Nós, Eletrodutos, Grafo, Dijkstra, Fiação)
│   │   ├── cad/                   # Engine 2D, Nós gráficos, Snapping magnético, Layers, Escala
│   │   ├── sld/                   # Gerador procedural do Diagrama Unifilar (SVG / DXF)
│   │   └── export/                # Exportadores DXF R12/2000, relatórios e quantitativos
│   │
│   ├── ui/                        # Interface de Usuário (React + Tailwind + Lucide Icons)
│   │   ├── components/            # Toolbar, Inspector, Layers Panel, Modais
│   │   ├── canvas/                # Viewport interativo, eventos de mouse/toque, atracamento
│   │   └── modals/                # Quadro de Cargas, Lista de Materiais, Configuração de Tensão
│   │
│   └── types/                     # Definições globais de tipos do sistema
│
└── .reference-legacy/             # [IGNORADO / LOCAL] Benchmarks conceituais e requisitos
```

---

## 3. Padrões de Código e Diretrizes Técnicas

### 3.1 Linguagem & Tipagem
* **TypeScript Estrito:** `strict: true`, sem uso de `any` injustificado. Defina interfaces claras para todos os dados que trafegam pelo sistema.
* **Imutabilidade e Funções Puras:** Sempre que possível, o motor matemático e o motor de cálculo da NBR 5410 devem ser modelados como funções puras testáveis sem efeitos colaterais.

### 3.2 O Modelo de Dados do Projeto (`ProjectData`)
O arquivo salvo pelo usuário é um único documento JSON contendo:
1. `version`: Versão do esquema do arquivo (inicia em `1.0.0`).
2. `meta`: Título do projeto, autor, data, concessionária selecionada (ex: `cemig`, `enel_sp`, `neoenergia`).
3. `architecture`:
   * `floorPlan`: Imagem de fundo ou primitivas DXF da planta baixa de arquitetura.
   * `scale`: Fator de conversão pixels $\leftrightarrow$ metros.
4. `electricNodes`: Array de pontos elétricos (`id`, `type`, `position: { x, y, z }`, `rotation`, `circuitId`, `commandId`, `powerWatts`, `powerVA`, `voltage`).
5. `conduits`: Array de trechos de tubulação interligando nós (`id`, `nodeA`, `nodeB`, `type: 'ceiling' | 'wall' | 'floor'`, `diameterMm`).
6. `circuits`: Configurações de circuitos no QDC (`id`, `name`, `voltage`, `phases: 'A' | 'B' | 'C' | 'AB' | 'ABC'`, `drId`, `breakerType`).
7. `panels`: Lista de quadros (`QGBT`, `QD`, etc.) e barramentos de alimentação.

### 3.3 Motor da NBR 5410 (`src/core/nbr5410/`)
Todo o cálculo deve seguir à risca a norma:
* **Corrente de Projeto ($I_B$):**
  * Monofásico: $I_B = \frac{P}{V \cdot \cos\phi}$
  * Bifásico: $I_B = \frac{P}{V_{FF} \cdot \cos\phi}$
  * Trifásico: $I_B = \frac{P}{\sqrt{3} \cdot V_{FF} \cdot \cos\phi}$
* **Critério de Ampacidade:**
  * Determinação do método de instalação (padrão predial: B1 - condutores isolados ou cabos unipolares em eletroduto embutido em alvenaria).
  * Fatores de Correção: $FCT$ (Temperatura ambiente) e $FCA$ (Agrupamento de circuitos no mesmo eletroduto, Tabela 42 da NBR 5410).
  * $I_z' = I_z \cdot FCT \cdot FCA \ge I_n \ge I_B$.
* **Critério da Queda de Tensão:**
  * Limitar a $\le 4\%$ da origem até os pontos terminais (ou $\le 2\%$ para alimentadores parciais).
* **Taxa de Ocupação de Eletrodutos:**
  * 1 condutor: máx 53%;
  * 2 condutores: máx 31%;
  * 3 ou mais condutores: máx 40% da área interna do eletroduto.

### 3.4 Motor Gráfico & Algoritmo Anti-Colisão (`src/core/cad/` e `src/core/graph/`)
* **Simbologia ABNT:**
  * Tomadas baixas (0,30m = vazia), médias (1,20m = metade preenchida), altas (2,00m a 2,20m = totalmente preenchida).
  * Interruptores simples ($S_1$, $S_2$, $S_3$), paralelos (three-way, metade preenchido), intermediários (four-way, em "X").
  * Pontos de iluminação em teto (círculo com quatro divisões: número do circuito, potência em W/VA, letra do comando).
* **Fiação Procedural:**
  * Empregar o algoritmo anti-colisão (`organize_wires_layout`): testar candidatos ortogonais ao longo do eletroduto e avaliar penalidades com bounding boxes para encontrar o ponto com menor sobreposição.

---

## 4. Comandos e Ferramentas

* **Build & Dev:**
  * `npm run dev`: Inicia o servidor Vite local na porta 5173.
  * `npm run build`: Executa typecheck com `tsc` e gera os bundles otimizados de produção.
  * `npm test`: Roda a suíte de testes com Vitest para o motor matemático e normativo.

---

## 5. Instruções Específicas para Subagentes e IAs

1. **Nunca misture responsabilidades:** Mantenha a camada de cálculo elétrico (`core/nbr5410`) 100% isolada do DOM e da renderização em Canvas. Ela deve ser executável em qualquer ambiente Node, Bun ou WebWorker.
2. **Documente novas fórmulas:** Ao implementar tabelas normativas ou critérios de dimensionamento, mencione expressamente o número da tabela e o item da ABNT NBR 5410 no docstring da função.
3. **Mantenha os links de documentação atualizados:** Conecte novas implementações aos documentos em `docs/`.
