/*
 * Provisiona o contrato Dataverse de Pagamentos a Terceiros.
 *
 * Como usar:
 * 1. Abra o Model-driven no ambiente DEV correto.
 * 2. Abra F12 > Console.
 * 3. Cole este arquivo inteiro e confirme a pergunta.
 *
 * O script cria apenas componentes ausentes. Nunca remove nem altera tipos
 * existentes. Se encontrar tipo incompatível, interrompe com erro explícito.
 */
(() => {
  "use strict";

  const CONFIG = Object.freeze({
    apiVersion: "v9.2",
    solutionUniqueName: "appbetinhos",
    languageCode: 1046,
    waitAfterCreateMs: 900,
    maxWaitAttempts: 12,
  });

  const TYPE_NAMES = Object.freeze({
    String: "String",
    Memo: "Memo",
    Money: "Money",
    Integer: "Integer",
    DateTime: "DateTime",
    Picklist: "Picklist",
    Lookup: "Lookup",
  });

  const activeInactive = [
    { value: 100000000, label: "Ativo" },
    { value: 100000001, label: "Inativo" },
  ];

  const tables = [
    {
      logicalName: "cr40f_terceirofavorecido",
      schemaName: "cr40f_TerceiroFavorecido",
      displayName: "Terceiro Favorecido",
      collectionName: "Terceiros Favorecidos",
    },
    {
      logicalName: "cr40f_vinculomotoristafavorecido",
      schemaName: "cr40f_VinculoMotoristaFavorecido",
      displayName: "Vínculo Motorista Favorecido",
      collectionName: "Vínculos Motorista Favorecido",
    },
    {
      logicalName: "cr40f_pagamentoaterceiro",
      schemaName: "cr40f_PagamentoATerceiro",
      displayName: "Pagamento a Terceiro",
      collectionName: "Pagamentos a Terceiros",
    },
    {
      logicalName: "cr40f_itempagamentoaterceiro",
      schemaName: "cr40f_ItemPagamentoATerceiro",
      displayName: "Item de Pagamento a Terceiro",
      collectionName: "Itens de Pagamento a Terceiros",
    },
    {
      logicalName: "cr40f_eventopagamentoaterceiro",
      schemaName: "cr40f_EventoPagamentoATerceiro",
      displayName: "Evento de Pagamento a Terceiro",
      collectionName: "Eventos de Pagamento a Terceiros",
    },
  ];

  const baseTables = [
    "cr40f_funcionarios",
    "cr40f_composicaodeprecos",
    "cr40f_reservadeveculos",
  ];

  const label = (text) => ({
    "@odata.type": "Microsoft.Dynamics.CRM.Label",
    LocalizedLabels: [
      {
        "@odata.type": "Microsoft.Dynamics.CRM.LocalizedLabel",
        Label: text,
        LanguageCode: CONFIG.languageCode,
        IsManaged: false,
      },
    ],
    UserLocalizedLabel: {
      "@odata.type": "Microsoft.Dynamics.CRM.LocalizedLabel",
      Label: text,
      LanguageCode: CONFIG.languageCode,
      IsManaged: false,
    },
  });

  const stringColumn = (schemaName, displayName, maxLength = 400) => ({
    "@odata.type": "Microsoft.Dynamics.CRM.StringAttributeMetadata",
    AttributeType: "String",
    AttributeTypeName: { Value: "StringType" },
    SchemaName: schemaName,
    DisplayName: label(displayName),
    Description: label(displayName),
    MaxLength: maxLength,
    FormatName: { Value: "Text" },
    RequiredLevel: { Value: "None" },
  });

  const memoColumn = (schemaName, displayName, maxLength = 1048576) => ({
    "@odata.type": "Microsoft.Dynamics.CRM.MemoAttributeMetadata",
    AttributeType: "Memo",
    AttributeTypeName: { Value: "MemoType" },
    SchemaName: schemaName,
    DisplayName: label(displayName),
    Description: label(displayName),
    MaxLength: maxLength,
    Format: "TextArea",
    ImeMode: "Disabled",
    RequiredLevel: { Value: "None" },
  });

  const integerColumn = (schemaName, displayName) => ({
    "@odata.type": "Microsoft.Dynamics.CRM.IntegerAttributeMetadata",
    AttributeType: "Integer",
    AttributeTypeName: { Value: "IntegerType" },
    SchemaName: schemaName,
    DisplayName: label(displayName),
    Description: label(displayName),
    MinValue: -2147483648,
    MaxValue: 2147483647,
    Format: "None",
    RequiredLevel: { Value: "None" },
  });

  const moneyColumn = (schemaName, displayName) => ({
    "@odata.type": "Microsoft.Dynamics.CRM.MoneyAttributeMetadata",
    AttributeType: "Money",
    AttributeTypeName: { Value: "MoneyType" },
    SchemaName: schemaName,
    DisplayName: label(displayName),
    Description: label(displayName),
    MinValue: -100000000000,
    MaxValue: 100000000000,
    Precision: 2,
    PrecisionSource: 1,
    ImeMode: "Disabled",
    RequiredLevel: { Value: "None" },
  });

  const dateTimeColumn = (schemaName, displayName) => ({
    "@odata.type": "Microsoft.Dynamics.CRM.DateTimeAttributeMetadata",
    AttributeType: "DateTime",
    AttributeTypeName: { Value: "DateTimeType" },
    SchemaName: schemaName,
    DisplayName: label(displayName),
    Description: label(displayName),
    Format: "DateAndTime",
    DateTimeBehavior: { Value: "UserLocal" },
    RequiredLevel: { Value: "None" },
  });

  const picklistColumn = (schemaName, displayName, options) => ({
    "@odata.type": "Microsoft.Dynamics.CRM.PicklistAttributeMetadata",
    AttributeType: "Picklist",
    AttributeTypeName: { Value: "PicklistType" },
    SchemaName: schemaName,
    DisplayName: label(displayName),
    Description: label(displayName),
    RequiredLevel: { Value: "None" },
    SourceTypeMask: 0,
    OptionSet: {
      "@odata.type": "Microsoft.Dynamics.CRM.OptionSetMetadata",
      Options: options.map((option) => ({
        Value: option.value,
        Label: label(option.label),
      })),
    },
  });

  const primaryName = (displayName) => ({
    ...stringColumn("cr40f_Nome", displayName, 200),
    IsPrimaryName: true,
    RequiredLevel: { Value: "ApplicationRequired" },
  });

  const tableColumns = {
    cr40f_terceirofavorecido: [
      stringColumn("cr40f_NomeRazaoSocial", "Nome/Razão Social", 200),
      picklistColumn("cr40f_TipoPessoa", "Tipo de Pessoa", [
        { value: 100000000, label: "Pessoa Física" },
        { value: 100000001, label: "Pessoa Jurídica" },
      ]),
      stringColumn("cr40f_CpfCnpj", "CPF/CNPJ", 50),
      picklistColumn("cr40f_TipoChavePix", "Tipo de Chave PIX", [
        { value: 100000000, label: "CPF/CNPJ" },
        { value: 100000001, label: "E-mail" },
        { value: 100000002, label: "Telefone" },
        { value: 100000003, label: "Aleatória" },
      ]),
      stringColumn("cr40f_ChavePix", "Chave PIX", 200),
      stringColumn("cr40f_Email", "E-mail", 320),
      stringColumn("cr40f_Telefone", "Telefone", 50),
      picklistColumn("cr40f_Status", "Status", activeInactive),
    ],
    cr40f_vinculomotoristafavorecido: [
      picklistColumn("cr40f_Status", "Status", activeInactive),
    ],
    cr40f_pagamentoaterceiro: [
      picklistColumn("cr40f_StatusLote", "Status do Lote", [
        { value: 100000000, label: "Aberto" },
        { value: 100000001, label: "Cancelado" },
      ]),
      picklistColumn("cr40f_StatusPagamento", "Status do Pagamento", [
        { value: 100000000, label: "Aberto" },
        { value: 100000001, label: "Pago" },
      ]),
      picklistColumn("cr40f_StatusDocumento", "Status do Documento", [
        { value: 100000000, label: "Não gerado" },
        { value: 100000001, label: "Enviando" },
        { value: 100000002, label: "Enviado" },
        { value: 100000003, label: "Falhou" },
        { value: 100000004, label: "Reenvio necessário" },
      ]),
      integerColumn("cr40f_VersaoEnvio", "Versão do Envio"),
      integerColumn("cr40f_DocumentoVersao", "Versão do Documento"),
      integerColumn("cr40f_AnoReferencia", "Ano de Referência"),
      integerColumn("cr40f_QuantidadeServicos", "Quantidade de Serviços"),
      stringColumn("cr40f_IdentificadorLote", "Identificador do Lote", 100),
      stringColumn("cr40f_ComprovanteUrl", "URL do Comprovante", 2000),
      stringColumn("cr40f_DocumentoUrl", "URL do Documento", 2000),
      stringColumn("cr40f_DocumentoNome", "Nome do Documento", 260),
      stringColumn("cr40f_DocumentoEmailId", "ID do E-mail do Documento", 200),
      stringColumn("cr40f_EmailFavorecidoEnvio", "E-mail do Favorecido", 320),
      memoColumn("cr40f_MotivoCancelamento", "Motivo do Cancelamento", 4000),
      memoColumn(
        "cr40f_MotivoReversaoPagamento",
        "Motivo da Reversão do Pagamento",
        4000,
      ),
      memoColumn("cr40f_ErroDocumento", "Erro do Documento", 4000),
      memoColumn("cr40f_SnapshotFavorecido", "Snapshot do Favorecido"),
      dateTimeColumn("cr40f_PagoEm", "Pago em"),
      dateTimeColumn("cr40f_CanceladoEm", "Cancelado em"),
      dateTimeColumn("cr40f_PagamentoRevertidoEm", "Pagamento Revertido em"),
      moneyColumn("cr40f_TotalCobradoCliente", "Total Cobrado do Cliente"),
      moneyColumn("cr40f_TotalRepasse", "Total do Repasse"),
      moneyColumn("cr40f_MargemTotal", "Margem Total"),
    ],
    cr40f_itempagamentoaterceiro: [
      dateTimeColumn("cr40f_DataServico", "Data do Serviço"),
      stringColumn("cr40f_Trajeto", "Trajeto", 500),
      moneyColumn("cr40f_ValorCobrado", "Valor Cobrado"),
      moneyColumn("cr40f_ValorRepasse", "Valor do Repasse"),
      moneyColumn("cr40f_Margem", "Margem"),
      memoColumn("cr40f_SnapshotFinanceiro", "Snapshot Financeiro"),
    ],
    cr40f_eventopagamentoaterceiro: [
      dateTimeColumn("cr40f_DataEvento", "Data do Evento"),
      stringColumn("cr40f_Operacao", "Operação", 100),
      stringColumn("cr40f_Resultado", "Resultado", 100),
      stringColumn("cr40f_EstadoAnterior", "Estado Anterior", 100),
      stringColumn("cr40f_EstadoNovo", "Estado Novo", 100),
      memoColumn("cr40f_Motivo", "Motivo", 4000),
      memoColumn("cr40f_Mensagem", "Mensagem", 4000),
      memoColumn("cr40f_DetalheTecnico", "Detalhe Técnico"),
      integerColumn("cr40f_Versao", "Versão"),
      stringColumn("cr40f_Url", "URL", 2000),
      stringColumn("cr40f_EmailId", "ID do E-mail", 200),
    ],
  };

  const lookups = [
    {
      source: "cr40f_vinculomotoristafavorecido",
      attributeSchemaName: "cr40f_Motorista",
      displayName: "Motorista",
      target: "cr40f_funcionarios",
      relationshipSchemaName:
        "cr40f_VinculoMotoristaFavorecido_Motorista",
    },
    {
      source: "cr40f_vinculomotoristafavorecido",
      attributeSchemaName: "cr40f_TerceiroFavorecido",
      displayName: "Terceiro Favorecido",
      target: "cr40f_terceirofavorecido",
      relationshipSchemaName:
        "cr40f_VinculoMotoristaFavorecido_TerceiroFavorecido",
    },
    {
      source: "cr40f_composicaodeprecos",
      attributeSchemaName: "cr40f_TerceiroFavorecido",
      displayName: "Terceiro Favorecido",
      target: "cr40f_terceirofavorecido",
      relationshipSchemaName: "cr40f_Composicao_TerceiroFavorecido",
    },
    {
      source: "cr40f_composicaodeprecos",
      attributeSchemaName: "cr40f_PagamentoATerceiro",
      displayName: "Pagamento a Terceiro",
      target: "cr40f_pagamentoaterceiro",
      relationshipSchemaName: "cr40f_Composicao_PagamentoATerceiro",
    },
    {
      source: "cr40f_pagamentoaterceiro",
      attributeSchemaName: "cr40f_Pagopor",
      displayName: "Pago por",
      target: "systemuser",
      relationshipSchemaName: "cr40f_PagamentoATerceiro_Pagador",
    },
    {
      source: "cr40f_itempagamentoaterceiro",
      attributeSchemaName: "cr40f_Composicao",
      displayName: "Composição",
      target: "cr40f_composicaodeprecos",
      relationshipSchemaName: "cr40f_ItemPagamento_Composicao",
    },
    {
      source: "cr40f_itempagamentoaterceiro",
      attributeSchemaName: "cr40f_PagamentoATerceiro",
      displayName: "Pagamento a Terceiro",
      target: "cr40f_pagamentoaterceiro",
      relationshipSchemaName: "cr40f_ItemPagamento_Pagamento",
    },
    {
      source: "cr40f_itempagamentoaterceiro",
      attributeSchemaName: "cr40f_Reserva",
      displayName: "Reserva",
      target: "cr40f_reservadeveculos",
      relationshipSchemaName: "cr40f_ItemPagamento_Reserva",
    },
    {
      source: "cr40f_itempagamentoaterceiro",
      attributeSchemaName: "cr40f_Motorista",
      displayName: "Motorista",
      target: "cr40f_funcionarios",
      relationshipSchemaName: "cr40f_ItemPagamento_Motorista",
    },
    {
      source: "cr40f_eventopagamentoaterceiro",
      attributeSchemaName: "cr40f_PagamentoATerceiro",
      displayName: "Pagamento a Terceiro",
      target: "cr40f_pagamentoaterceiro",
      relationshipSchemaName: "cr40f_EventoPagamento_Pagamento",
    },
  ];

  const extraColumns = [
    {
      table: "cr40f_composicaodeprecos",
      column: moneyColumn(
        "cr40f_Valorrepasseterceiro",
        "Valor de Repasse a Terceiro",
      ),
    },
  ];

  const apiRoot = (() => {
    const context = window.Xrm?.Utility?.getGlobalContext?.();
    if (!context) {
      throw new Error("Abra o script dentro do Model-driven app com Xrm disponível.");
    }
    const clientUrl = context.getClientUrl();
    return `${clientUrl}/api/data/${CONFIG.apiVersion}`;
  })();

  const escapeOData = (value) => String(value).replace(/'/g, "''");
  const metadataPath = (logicalName) =>
    `/EntityDefinitions(LogicalName='${escapeOData(logicalName)}')`;
  const metadataAttributePath = (entity, attribute) =>
    `${metadataPath(entity)}/Attributes(LogicalName='${escapeOData(attribute)}')`;

  const request = async (method, path, body) => {
    const response = await fetch(`${apiRoot}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json; charset=utf-8",
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0",
        Consistency: "Strong",
        "MSCRM.SolutionUniqueName": CONFIG.solutionUniqueName,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!response.ok) {
      const message =
        data?.error?.message ||
        data?.Message ||
        text ||
        `${response.status} ${response.statusText}`;
      const error = new Error(`${method} ${path}: ${message}`);
      error.status = response.status;
      throw error;
    }
    return data;
  };

  const getOrNull = async (path) => {
    try {
      return await request("GET", path);
    } catch (error) {
      if (error.status === 404) return null;
      throw error;
    }
  };

  const waitFor = async (fn, description) => {
    for (let attempt = 1; attempt <= CONFIG.maxWaitAttempts; attempt += 1) {
      const value = await fn();
      if (value) return value;
      await new Promise((resolve) => setTimeout(resolve, CONFIG.waitAfterCreateMs));
    }
    throw new Error(`Timeout aguardando ${description}.`);
  };

  const getTable = (logicalName) =>
    getOrNull(
      `${metadataPath(logicalName)}?$select=LogicalName,EntitySetName,PrimaryIdAttribute,PrimaryNameAttribute,MetadataId`,
    );

  const getAttribute = (entity, logicalName) =>
    getOrNull(
      `${metadataAttributePath(entity, logicalName)}?$select=LogicalName,SchemaName,AttributeType,AttributeTypeName,MetadataId`,
    );

  const getAttributeWithType = (entity, logicalName, typeName) =>
    getOrNull(
      `${metadataAttributePath(entity, logicalName)}/Microsoft.Dynamics.CRM.${typeName}AttributeMetadata?$select=LogicalName,SchemaName,AttributeType,AttributeTypeName,MetadataId,Targets,OptionSet`,
    );

  const log = (message, detail = "") =>
    console.log(`[provision] ${message}${detail ? `: ${detail}` : ""}`);

  const assertType = (attribute, expectedType, entity, logicalName) => {
    if (!attribute) return;
    if (attribute.AttributeType !== expectedType) {
      throw new Error(
        `${entity}.${logicalName} já existe como ${attribute.AttributeType}; esperado ${expectedType}.`,
      );
    }
  };

  const ensureTable = async (definition) => {
    let table = await getTable(definition.logicalName);
    if (table) {
      log("tabela existente", definition.logicalName);
      return table;
    }

    await request("POST", "/EntityDefinitions", {
      "@odata.type": "Microsoft.Dynamics.CRM.EntityMetadata",
      SchemaName: definition.schemaName,
      DisplayName: label(definition.displayName),
      DisplayCollectionName: label(definition.collectionName),
      Description: label(`Tabela de ${definition.collectionName.toLowerCase()}`),
      OwnershipType: "UserOwned",
      IsActivity: false,
      HasActivities: false,
      HasNotes: false,
      PrimaryNameAttribute: "cr40f_nome",
      Attributes: [primaryName(definition.displayName)],
    });

    table = await waitFor(
      () => getTable(definition.logicalName),
      `a tabela ${definition.logicalName}`,
    );
    log("tabela criada", definition.logicalName);
    return table;
  };

  const ensureColumn = async (entity, column) => {
    const logicalName = column.SchemaName.toLowerCase();
    const existing = await getAttribute(entity, logicalName);
    if (existing) {
      assertType(existing, column.AttributeType, entity, logicalName);
      log("coluna existente", `${entity}.${logicalName}`);
      return existing;
    }
    await request("POST", `${metadataPath(entity)}/Attributes`, column);
    const created = await waitFor(
      () => getAttribute(entity, logicalName),
      `a coluna ${entity}.${logicalName}`,
    );
    log("coluna criada", `${entity}.${logicalName}`);
    return created;
  };

  const ensureChoiceOptions = async (entity, column, options) => {
    const attribute = await getAttributeWithType(entity, column, "Picklist");
    if (!attribute) throw new Error(`Não foi possível ler a Choice ${entity}.${column}.`);
    const existingOptions = new Map(
      (attribute.OptionSet?.Options || []).map((option) => [option.Value, option]),
    );
    for (const option of options) {
      if (existingOptions.has(option.value)) {
        log("opção existente", `${entity}.${column}=${option.value}`);
        continue;
      }
      await request("POST", "/InsertOptionValue", {
        EntityLogicalName: entity,
        AttributeLogicalName: column,
        Value: option.value,
        Label: label(option.label),
        SolutionUniqueName: CONFIG.solutionUniqueName,
      });
      log("opção criada", `${entity}.${column}=${option.value} (${option.label})`);
    }
  };

  const ensurePicklist = async (entity, column) => {
    const logicalName = column.SchemaName.toLowerCase();
    const existing = await getAttribute(entity, logicalName);
    if (!existing) {
      await ensureColumn(entity, column);
    } else {
      assertType(existing, TYPE_NAMES.Picklist, entity, logicalName);
      log("Choice existente", `${entity}.${logicalName}`);
    }
    await ensureChoiceOptions(entity, logicalName, column.OptionSet.Options.map((option) => ({
      value: option.Value,
      label: option.Label.UserLocalizedLabel?.Label || option.Label.LocalizedLabels[0].Label,
    })));
  };

  const ensureLookup = async (definition) => {
    const logicalName = definition.attributeSchemaName.toLowerCase();
    const existing = await getAttribute(definition.source, logicalName);
    if (existing) {
      assertType(existing, TYPE_NAMES.Lookup, definition.source, logicalName);
      const lookup = await getAttributeWithType(
        definition.source,
        logicalName,
        "Lookup",
      );
      if (!lookup?.Targets?.includes(definition.target)) {
        throw new Error(
          `${definition.source}.${logicalName} existe, mas não aponta para ${definition.target}.`,
        );
      }
      log("lookup existente", `${definition.source}.${logicalName} -> ${definition.target}`);
      return existing;
    }

    const targetTable = await getTable(definition.target);
    if (!targetTable) {
      throw new Error(`Tabela alvo inexistente para lookup: ${definition.target}.`);
    }

    await request("POST", "/RelationshipDefinitions", {
      "@odata.type": "Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata",
      SchemaName: definition.relationshipSchemaName,
      ReferencedEntity: definition.target,
      ReferencedAttribute: targetTable.PrimaryIdAttribute,
      ReferencingEntity: definition.source,
      ReferencingEntityNavigationPropertyName: definition.attributeSchemaName,
      Lookup: {
        "@odata.type": "Microsoft.Dynamics.CRM.LookupAttributeMetadata",
        SchemaName: definition.attributeSchemaName,
        DisplayName: label(definition.displayName),
        Description: label(definition.displayName),
        RequiredLevel: { Value: "None" },
        IsValidForAdvancedFind: true,
      },
    });
    await waitFor(
      () => getAttribute(definition.source, logicalName),
      `o lookup ${definition.source}.${logicalName}`,
    );
    log("lookup criada", `${definition.source}.${logicalName} -> ${definition.target}`);
  };

  const provision = async () => {
    console.group("Provisionamento Dataverse");
    log("ambiente", apiRoot.replace(`/api/data/${CONFIG.apiVersion}`, ""));
    log("solução", CONFIG.solutionUniqueName);

    for (const logicalName of baseTables) {
      if (!(await getTable(logicalName))) {
        throw new Error(`Tabela base obrigatória não encontrada: ${logicalName}.`);
      }
      log("tabela base confirmada", logicalName);
    }

    for (const definition of tables) {
      await ensureTable(definition);
    }

    for (const definition of tables) {
      for (const column of tableColumns[definition.logicalName] || []) {
        if (column.AttributeType === TYPE_NAMES.Picklist) {
          await ensurePicklist(definition.logicalName, column);
        } else {
          await ensureColumn(definition.logicalName, column);
        }
      }
    }

    for (const definition of extraColumns) {
      await ensureColumn(definition.table, definition.column);
    }

    for (const definition of lookups) {
      await ensureLookup(definition);
    }

    await request("POST", "/PublishAllXml");
    log("customizações publicadas");
    console.groupEnd();
    console.log("Provisionamento concluído. Agora rode npm run build e npm run push.");
  };

  const environment = apiRoot.replace(`/api/data/${CONFIG.apiVersion}`, "");
  const confirmed = window.confirm(
    `Provisionar metadata no ambiente:\n${environment}\n\nSolução: ${CONFIG.solutionUniqueName}\n\nNada será apagado. Continuar?`,
  );
  if (!confirmed) {
    console.warn("Provisionamento cancelado pelo usuário.");
    return;
  }
  provision().catch((error) => {
    console.error("Provisionamento interrompido:", error);
    console.error("Nenhuma etapa posterior foi executada.");
  });
})();
