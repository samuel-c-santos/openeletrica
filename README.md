# OpenElétrica: Sistema CAD para Projetos de Instalações Elétricas Prediais (ABNT NBR 5410)

O OpenElétrica é uma plataforma em software livre e de código aberto para elaboração, cálculo e documentação de projetos de instalações elétricas prediais em baixa tensão, em conformidade com as normas ABNT NBR 5410 e ABNT NBR 6492.

A aplicação opera inteiramente no cliente via navegador web (arquitetura offline-first), sem necessidade de instalação local, plugins proprietários ou dependência de infraestrutura externa de servidores.

---

## 1. Escopo Funcional

### 1.1 Modelagem Arquitetônica e Espacial
* Importação de arquivos DXF e imagens raster de planta baixa com calibração métrica;
* Desenho de paredes com espessura configurável (padrão de 0,15 m) e resolução automática de quinas em L e junções em T por concordância geométrica;
* Entrada direta de distâncias no teclado ao desenhar alvenarias (método direct distance entry);
* Inserção e edição das seis tipologias de portas padronizadas pela NBR 6492 (abrir, pivotante, embutida, correr, articulada e sanfonada);
* Delimitação de ambientes com cálculo de área, perímetro e determinação automática da carga mínima de iluminação e quantidade de pontos de tomada (TUGs).

### 1.2 Cotagem Técnica e Parametria
* Inserção de cotas em três etapas: ponto de origem, ponto de destino e ajuste dinâmico da linha de cota;
* Alinhamento magnético com cotas paralelas existentes e controle de afastamento;
* Seleção e reposicionamento de cotas diretamente no espaço do modelo;
* Cotas paramétricas vinculadas: a edição do valor de uma cota interna desloca as alvenarias associadas mantendo as quinas fechadas.

### 1.3 Lançamento Elétrico e Roteamento
* Posicionamento de pontos elétricos: quadros de distribuição, caixas de iluminação no teto e arandelas, interruptores (simples, paralelos e intermediários) e tomadas de uso geral ou específico;
* Conexão por eletrodutos em teto, parede e piso com determinação de comprimentos tridimensionais;
* Roteamento automático de condutores com identificação de fase, neutro, proteção e retornos;
* Disposição geométrica anti-colisão dos condutores ao longo da tubulação.

### 1.4 Dimensionamento Normativo (NBR 5410)
* Determinação da corrente de projeto conforme número de fases e fator de potência;
* Dimensionamento por capacidade de condução de corrente (ampacidade) com aplicação de fatores de correção de temperatura (FCT) e agrupamento (FCA);
* Verificação da queda de tensão admissível em regime permanente;
* Dimensionamento de diâmetros nominais de eletrodutos por taxa de ocupação máxima (53%, 31% e 40%);
* Balanceamento de fases no quadro geral de distribuição.

### 1.5 Documentação Técnica e Saídas
* Geração procedural de Diagrama Unifilar;
* Quadro de Cargas com memorial descritivo dos circuitos;
* Lista quantitativa de materiais;
* Módulo de prancha de desenho (espaço do papel) nos formatos A0, A1, A2, A3 e A4 com carimbo técnico em conformidade com as normas ABNT NBR 10068 e NBR 16752;
* Exportação vetorial em formato DXF para intercâmbio com sistemas CAD e SIG.

---

## 2. Arquitetura Técnica

* Linguagem: TypeScript (configuração estrita, padrão ESM).
* Interface de Usuário: HTML5 Canvas com interface de controle em Tailwind CSS e biblioteca Lucide.
* Indexação Espacial: R-Tree em memória para detecção e atracamento de entidades.
* Grafos e Topologia: Grafo direcionado ponderado com algoritmo de Dijkstra para resolução de caminhos mínimos de fiação.
* Ambiente de Execução: Navegador web padrão com suporte a ECMAScript 2022.

---

## 3. Estrutura do Repositório

```text
.
├── AGENTS.md                  Diretrizes operacionais e padrões de engenharia
├── README.md                  Visão geral e documentação de entrada
├── package.json               Metadados do pacote e dependências
├── tsconfig.json              Configuração de compilação TypeScript
├── vite.config.ts             Configuração do empacotador Vite
├── docs/                      Documentação técnica complementar
│   ├── architecture.md        Arquitetura de software e fluxo de dados
│   ├── nbr5410-engine.md      Critérios e equacionamento normativo da NBR 5410
│   ├── wiring-routing-graph.md Algoritmos de roteamento e resolução topológica
│   ├── cad-and-dxf.md         Motor de renderização 2D e especificação DXF
│   └── backlog-and-roadmap.md Registro de etapas concluídas e planejamento técnico
└── src/                       Código-fonte do sistema
```

---

## 4. Procedimento de Instalação e Execução

### Pré-requisitos
* Node.js versão 18 ou superior.
* Gerenciador de pacotes npm.

### Comandos de Operação
```bash
# Instalação das dependências do projeto
npm install

# Inicialização do servidor local de desenvolvimento
npm run dev

# Execução da suíte de testes unitários
npm test

# Compilação e empacotamento para produção
npm run build
```

---

## 5. Licença

O projeto está disponível sob a licença MIT. Maiores detalhes constam no arquivo LICENSE na raiz do repositório.
