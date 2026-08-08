# Fred Sports Analyzer

Aplicativo instalado para Windows, em português do Brasil, voltado à consulta de jogos atuais, odds recebidas por API, montagem de bilhetes e controle de banca.

> Probabilidades não garantem resultados. Uso exclusivo para maiores de 18 anos.

## Versão 0.2.6 — correção das odds da fonte alternativa

A versão 0.2.6 adiciona a Odds-API.io como fonte preferencial de jogos e odds. Ela reconhece variações dos nomes de mercados, aceita diferentes formatos de resposta e consulta partidas mesmo quando a fonte não informa previamente o número de casas. Se a nova fonte falhar, o aplicativo tenta automaticamente a chave antiga da API-Sports. Os dados locais, a banca e o histórico das versões anteriores são preservados na atualização.

Para conectar a nova fonte:

1. Crie uma conta gratuita em https://odds-api.io/
2. No painel, escolha duas casas de apostas e copie sua API Key.
3. Abra **Configurações** no Fred Sports Analyzer.
4. Cole a chave em **Chave Odds-API.io**.
5. Clique em **Salvar e conectar**.

As duas chaves são criptografadas no próprio Windows e não são gravadas neste repositório.

O aplicativo consulta somente partidas futuras, agrupa até dez jogos por requisição de odds e preserva os últimos dados carregados quando as fontes falham. Quando uma odd não estiver disponível, ele mostra **Odds não disponíveis** em vez de criar um número fictício.

## Recursos

- Jogos atuais e próximos por data real.
- Odds disponíveis pela Odds-API.io ou API-Sports.
- Troca automática entre as duas fontes.
- Busca e filtro por competição.
- Explicação da probabilidade implícita de mercado.
- Montagem automática para odds-alvo.
- Controle de banca, depósitos, apostas e resultados.
- Limite por aposta e limite diário de perda.
- Histórico, exportação e importação de backup.
- Dados financeiros salvos no próprio computador.
- Instalador do Windows com atalho na área de trabalho.

## Download

Abra a página de versões:

https://github.com/freddalatera-boop/fred-sports-analyzer/releases

Em **Assets/Ativos**, baixe o instalador mais recente.

O instalador ainda não possui assinatura digital comercial. O Windows pode exibir um aviso do SmartScreen; confira que o arquivo veio deste repositório.

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
