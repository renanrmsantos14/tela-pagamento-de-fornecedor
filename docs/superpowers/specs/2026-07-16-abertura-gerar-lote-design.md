# Abertura responsiva do fluxo Gerar lote

## Objetivo

Dar retorno visual imediato ao clique em **Gerar lote** e abrir a revisão sem deixar o usuário em dúvida sobre o processamento.

## Diagnóstico

O clique atual atualiza `preselected` e `drawer` no componente raiz. Essa atualização também renderiza novamente a tabela extensa de repasses antes que o drawer fique visível, criando atraso percebido sem qualquer feedback no botão.

## Desenho aprovado

- Isolar o botão de geração em componente pequeno com estado próprio de preparação.
- Ao clicar, trocar imediatamente ícone e texto para `Preparando lote...`, desabilitar novo clique e expor `aria-busy`.
- Adiar a atualização pesada do componente raiz até o próximo frame de pintura.
- Manter o drawer e o fluxo de criação existentes; não alterar regras de elegibilidade, seleção ou payload Dataverse.
- Limpar o estado de preparação quando o drawer de lote estiver aberto ou quando a abertura não ocorrer.
- Usar somente `transform` e `opacity` no feedback visual, com suporte a `prefers-reduced-motion`.

## Tratamento de erro

Se não houver serviços selecionados, nenhuma abertura será iniciada. Exceções síncronas ao solicitar abertura restauram o botão.

## Validação

- Teste unitário da função que agenda a abertura após oportunidade de pintura.
- Suíte existente `npm test`.
- Build do webresource com `npm run build`.
- Revisão do diff para garantir que mudanças externas de versão não entrem no commit.
