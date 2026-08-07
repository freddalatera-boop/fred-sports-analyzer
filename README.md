# Fred Sports Analyzer

Aplicativo instalado para Windows, em português do Brasil, voltado à consulta de jogos atuais, odds recebidas por API, montagem de bilhetes e controle de banca.

> Probabilidades não garantem resultados. Uso exclusivo para maiores de 18 anos.

## Versão 0.2.0 — fonte real

A versão 0.2.0 não apresenta jogos de exemplo como se fossem atuais. Sem uma fonte conectada, a tela fica vazia e informa claramente que a API precisa ser configurada.

Para conectar:

1. Crie uma conta gratuita em https://dashboard.api-football.com/register
2. No painel da API-Sports, copie sua API Key.
3. Abra **Configurações** no Fred Sports Analyzer.
4. Cole a chave em **Chave API-Sports**.
5. Clique em **Salvar e conectar**.

A chave é criptografada no próprio Windows e não é gravada neste repositório.

O plano gratuito da API-Sports oferece 100 consultas por dia. O aplicativo consulta jogos e odds de hoje e amanhã. Quando uma odd não estiver disponível, ele mostra **Odds não disponíveis** em vez de criar um número fictício.

## Recursos

- Jogos atuais e próximos por data real.
- Odds disponíveis pela fonte conectada.
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
