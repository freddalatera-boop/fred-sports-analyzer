# Fred Sports Analyzer

Aplicativo instalado para Windows, em português do Brasil, voltado à análise esportiva explicável, montagem de bilhetes e controle de banca.

> Probabilidades não garantem resultados. Uso exclusivo para maiores de 18 anos.

## O que já funciona

- Painel com partidas e análises demonstrativas.
- Busca e filtro por competição.
- Fatores favoráveis e pontos de atenção.
- Montagem automática para odds-alvo 2, 3, 5, 10 e 20.
- Bilhete com odd combinada, confiança estimada e nível de risco.
- Controle de banca, depósitos, apostas e resultados.
- Limite por aposta e limite diário de perda.
- Histórico, exportação e importação de backup.
- Dados salvos no próprio computador.
- Instalador do Windows com atalho na área de trabalho.

## Como baixar o instalador

1. Abra a aba **Actions** deste repositório.
2. Entre na execução mais recente chamada **Gerar instalador Windows**.
3. Aguarde aparecer o sinal verde.
4. Em **Artifacts**, baixe **Fred-Sports-Analyzer-Windows**.
5. Extraia o arquivo ZIP e execute o instalador `.exe`.

O instalador ainda não possui assinatura digital comercial. O Windows pode exibir um aviso do SmartScreen; confira que o arquivo veio deste repositório.

## Próxima etapa: dados reais

A versão 0.1.0 usa dados fictícios claramente identificados para permitir testes sem inventar informações atuais. A integração real será adicionada por uma camada protegida, usando uma API de estatísticas e uma API licenciada de odds. Chaves privadas nunca devem ser gravadas neste repositório público.

## Desenvolvimento

```bash
npm install
npm start
```

## Testes e instalador

```bash
npm test
npm run dist
```
