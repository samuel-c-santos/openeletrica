# AGENTS.md: Diretrizes Técnicas para Agentes de IA e Engenharia

Este documento estabelece as diretrizes normativas, arquiteturais e operacionais para agentes de inteligência artificial e desenvolvedores humanos atuantes no repositório OpenElétrica. Toda intervenção na base de código deve observar os requisitos aqui documentados.

---

## 1. Princípios de Engenharia e Escopo

### 1.1 Objetivo do Projeto
Desenvolver um sistema CAD de projetos elétricos prediais de código aberto, executado diretamente no navegador web, em conformidade com as normas ABNT NBR 5410 e ABNT NBR 6492.

### 1.2 Implementação em Sala Limpa (Clean-Room Implementation)
O diretório `.reference-legacy/` (ignorado pelo controle de versão) contém exclusivamente referências conceituais para análise de requisitos. É expressamente vedada a cópia direta de trechos desse diretório para o diretório `src/`. Todo o código novo deve ser implementado a partir de especificações formais, utilizando TypeScript moderno em conformidade com o padrão ECMAScript 2022.

### 1.3 Arquitetura Offline-First
O motor de dimensionamento elétrico, a topologia de fiação, o gerador de diagramas unifilares e a exportação em formato DXF devem executar integralmente no cliente (navegador web). A presença de serviços de retaguarda (backend) é opcional e restrita a rotinas de sincronização ou armazenamento de arquivos.

---

## 2. Padrões de Projeto e Diretrizes de Implementação

### 2.1 Tipagem Estrita e Funções Puras
* A compilação do TypeScript opera com a diretiva `strict: true`. O uso do tipo `any` não é aceito quando for possível especificar tipos ou interfaces concretas.
* Os motores de cálculo matemático e de dimensionamento elétrico devem ser estruturados como funções puras, desprovidas de estado interno e independentes de interfaces de usuário ou referências ao Document Object Model (DOM).

### 2.2 Estrutura do Modelo de Dados (ProjectData)
O esquema do documento do projeto é estruturado em formato JSON com as seguintes seções principais:
1. `version`: Versão do esquema de dados.
2. `meta`: Identificação da obra, autor, data de revisão e concessionária de energia selecionada.
3. `architecture`:
   * `floorPlan`: Vetores ou mapa de bits da planta de arquitetura;
   * `scale`: Fator de conversão métrica (pixels por metro).
4. `electricNodes`: Coleção de pontos elétricos com identificador, tipo funcional, coordenadas tridimensionais (X, Y, Z), circuito associado, comando de acionamento, tensão e potências ativa e aparente.
5. `conduits`: Coleção de trechos de tubulação interligando nós com especificação de diâmetro interno e tipo de instalação (teto, parede ou piso).
6. `circuits`: Cadastro de circuitos contendo tensão nominal, fases alimentadoras, dispositivos diferenciais residuais e disjuntores de proteção.
7. `panels`: Quadros de distribuição e barramentos da instalação.

### 2.3 Regras de Dimensionamento Conforme a ABNT NBR 5410
O dimensionamento deve implementar rigorosamente as rotinas normativas:
* Cálculo da corrente de projeto ($I_B$) para circuitos monofásicos, bifásicos e trifásicos considerando o fator de potência ($\cos\phi$);
* Critério de ampacidade adotando o método de instalação B1 (condutores isolados em eletroduto embutido em alvenaria) como referência predial básica, aplicando os fatores de correção de temperatura (FCT, Tabela 40) e agrupamento de circuitos (FCA, Tabela 42);
* Coordenação e proteção dos condutores segundo a relação $I_B \le I_n \le I_z'$;
* Critério de queda de tensão com limitação em 4% para instalações com medição em baixa tensão;
* Taxa máxima de ocupação de eletrodutos: 53% para um condutor, 31% para dois condutores e 40% para três ou mais condutores.

### 2.4 Representação Gráfica e Cotagem (ABNT NBR 6492)
* Simbologia de tomadas: baixa (cota 0,30 m), média (cota 1,20 m) e alta (cota 2,00 m a 2,20 m);
* Simbologia de comando: interruptor simples, paralelo (three-way) e intermediário (four-way);
* Cotagem técnica: processo de três etapas contemplando origem, destino e afastamento da linha de cota com alinhamento magnético;
* Parâmetros dinâmicos: capacidade de redimensionamento de ambientes por meio da edição de cotas vinculadas, preservando a concordância de cantos das alvenarias.

---

## 3. Comandos de Trabalho

* `npm run dev`: Inicializa o servidor local de desenvolvimento.
* `npm test`: Executa a suíte de testes de validação matemática e de dimensionamento.
* `npm run build`: Efetua a verificação de tipos e compila os pacotes para produção.

---

## 4. Instruções para Agentes de Código

1. O módulo de cálculo elétrico situado em `src/core/nbr5410/` não deve importar classes de canvas, eventos de janela ou referências visuais da interface.
2. Cada função de dimensionamento deve conter documentação citando o número do item e da tabela correspondente na ABNT NBR 5410.
3. Todos os arquivos de documentação técnica devem manter tom documental, formal e objetivo, sem emojis e sem caracteres de travessão.
