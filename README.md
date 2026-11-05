# ⚡ OpenElétrica — CAD Elétrico Predial Open Source (NBR 5410)

O **OpenElétrica** é uma plataforma aberta, moderna e 100% web para elaboração automatizada de projetos de instalações elétricas prediais e residenciais em conformidade com a norma **ABNT NBR 5410**.

Focado na agilidade das ferramentas web modernas e na precisão técnica de softwares profissionais de engenharia, o projeto roda **direto no navegador (offline-first)**, sem necessidade de instalação, plugins proprietários ou assinaturas pagas.

---

## ✨ Principais Funcionalidades

* 📐 **Importação de Planta Baixa:** Suporte a arquivos DXF da arquitetura e imagens de planta baixa com ferramenta de calibração métrica rápida.
* 🔌 **Lançamento de Pontos com Snapping:** Inserção ágil de tomadas (baixas, médias, altas, TUG e TUE), lâmpadas de teto, arandelas, interruptores (simples, paralelos/three-way e intermediários/four-way) com atracamento magnético às paredes.
* 🌐 **Conexão Topológica de Eletrodutos:** Tubulações desenhadas entre caixas que calculam automaticamente a distância 2D e as subidas/descidas verticais em 3D.
* ⚡ **Fiação Automática Inteligente:** O sistema calcula a menor rota entre o Quadro de Distribuição (QDC) e as cargas, determinando a quantidade de condutores (fase, neutro, terra, retornos) e aplicando algoritmo anti-colisão de layout.
* 📊 **Dimensionamento Conforme NBR 5410:**
  * Capacidade de condução de corrente (critério de ampacidade com fatores de agrupamento $FCA$ e temperatura $FCT$);
  * Verificação rigorosa de queda de tensão admissível ($\le 4\%$);
  * Dimensionamento automático de bitolas de cabos e disjuntores DIN;
  * Taxa de ocupação máxima em eletrodutos (53%, 31%, 40%);
  * Balanceamento automático de cargas entre fases no QDC.
* 📑 **Entregáveis Imediatos:**
  * Diagrama Unifilar procedural gerado em tempo real;
  * Tabela / Quadro de Cargas completo para aprovação em concessionárias (Enel, Cemig, CPFL, Equatorial, Neoenergia, etc.);
  * Relação e lista de materiais quantitativa (metragem de condutores por cor, tubulações e caixas);
  * Exportação vetorial direta para arquivo `.dxf` (compatível com AutoCAD, QGIS e LibreCAD).

---

## 🛠️ Stack Tecnológica

* **Linguagem:** TypeScript (ESM, tipagem estrita).
* **Interface:** React 18+ com Tailwind CSS e Lucide Icons.
* **Motor Gráfico:** HTML5 Canvas / SVG de alta performance com índice espacial R-Tree (`rbush`).
* **Grafo e Roteamento:** Implementação customizada de grafos com algoritmo de Dijkstra para cálculo de menor caminho de fiação.
* **Build Tool:** Vite + Vitest para suíte de testes unitários.

---

## 📂 Estrutura do Repositório

* `AGENTS.md`: Diretrizes mestras para desenvolvimento e colaboração de agentes de IA.
* `docs/`: Especificações técnicas e normas:
  * [`architecture.md`](docs/architecture.md): Arquitetura do sistema e fluxo de dados.
  * [`nbr5410-engine.md`](docs/nbr5410-engine.md): Fórmulas e tabelas normativas da NBR 5410.
  * [`wiring-routing-graph.md`](docs/wiring-routing-graph.md): Algoritmo de roteamento e fiação anti-colisão.
  * [`cad-and-dxf.md`](docs/cad-and-dxf.md): Motor CAD 2D, coordenadas e exportação DXF.
* `src/`: Código-fonte da aplicação moderna.
* `.reference-legacy/`: Benchmarks e referências de engenharia (isolado e ignorado pelo Git).

---

## 🚀 Como Executar Localmente

### Pré-requisitos
* Node.js 18+ instalado.

### Instalação e Execução
```bash
# Instalar as dependências
npm install

# Iniciar o servidor de desenvolvimento
npm run dev

# Executar a suíte de testes de engenharia
npm test

# Gerar o build de produção
npm run build
```

---

## 📜 Licença

Distribuído sob a licença **MIT**. Veja `LICENSE` para mais detalhes.
