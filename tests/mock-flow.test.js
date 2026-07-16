import test from "node:test";
import assert from "node:assert/strict";

async function client() {
  globalThis.window = {
    location: { hostname: "10.113.2.46", port: "5192" },
    parent: {},
    top: {},
  };
  return import(`../src/lib/dataverse.js?mock=${Date.now()}-${Math.random()}`);
}

async function remoteClient({
  direct = false,
  metadataAvailable = true,
  oneDriveFlowUrl = "",
} = {}) {
  const previousWindow = globalThis.window;
  const previousFetch = globalThis.fetch;
  const requests = [];
  const entityNames = {
    cr40f_funcionarios: "cr40f_funcionarioses",
    cr40f_terceirofavorecido: "cr40f_terceirofavorecidos",
    cr40f_vinculomotoristafavorecido:
      "cr40f_vinculomotoristafavorecidos",
    cr40f_composicaodeprecos: "cr40f_composicaodeprecoses",
    cr40f_reservadeveculos: "cr40f_reservadeveculoses",
    cr40f_pagamentoaterceiro: "cr40f_pagamentoaterceiros",
    cr40f_itempagamentoaterceiro: "cr40f_itempagamentoaterceiros",
    cr40f_eventopagamentoaterceiro: "cr40f_eventopagamentoaterceiros",
  };
  const schemaNames = {
    cr40f_motorista: "cr40f_Motorista",
    cr40f_motoristareferencia: "cr40f_MotoristaReferencia",
    cr40f_terceirofavorecido: "cr40f_TerceiroFavorecido",
    cr40f_pagamentoaterceiro: "cr40f_PagamentoATerceiro",
    cr40f_composicao: "cr40f_Composicao",
    cr40f_reserva: "cr40f_Reserva",
  };
  const response = (body, status = 200) => ({
    status,
    ok: status >= 200 && status < 300,
    statusText: status === 404 ? "Not Found" : "OK",
    text: async () => JSON.stringify(body),
  });
  const payment = {
    cr40f_pagamentoaterceiroid: "lot-remote-001",
    cr40f_statuslote: 100000000,
    cr40f_statuspagamento: 100000001,
    cr40f_statusdocumento: 100000002,
    cr40f_versaoenvio: 1,
    cr40f_anoreferencia: 2026,
    cr40f_identificadorlote: "PT-2026-REMOTE",
    cr40f_quantidadeservicos: 1,
    cr40f_totalcobradocliente: 1000,
    cr40f_totalrepasse: 600,
    cr40f_margemtotal: 400,
    cr40f_snapshotfavorecido: JSON.stringify({
      id: "fav-remote-001",
      nome: "Favorecido remoto",
      email: "favorecido@example.com",
    }),
    "@odata.etag": 'W/"7"',
  };
  const parentXrm = {
    Utility: {
      getGlobalContext: () => ({
        getClientUrl: () => "https://app.crm.dynamics.com",
      }),
    },
  };
  globalThis.window = {
    location: {
      origin: "https://app.crm.dynamics.com",
      hostname: "app.crm.dynamics.com",
      pathname: direct ? "/WebResources/cr40f_TelaPagamentoFornecedores.html" : "/main.aspx",
      port: "",
    },
    Xrm: direct
      ? undefined
      : {
          Utility: {
            getGlobalContext: () => ({
              getClientUrl: () => "https://window.crm.dynamics.com",
            }),
          },
        },
    parent: direct ? {} : { Xrm: parentXrm },
    top: {},
  };
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url, options });
    if (url.includes("environmentvariabledefinitions"))
      return response({
        value: [
          {
            environmentvariabledefinitionid: "flow-definition-001",
            defaultvalue: oneDriveFlowUrl,
          },
        ],
      });
    if (url.includes("environmentvariablevalues"))
      return response({ value: [] });
    if (url === oneDriveFlowUrl && options.method === "POST")
      return response({ url: "https://onedrive.example/documento.pdf" });
    if (options.method === "POST") return response({});
    if (url.endsWith("/WhoAmI"))
      return response({
        UserId: "usr-remote-001",
        OrganizationId: "org-remote-001",
        BusinessUnitId: "bu-remote-001",
      });
    const metadata = decodeURIComponent(url).match(
      /EntityDefinitions\(LogicalName='([^']+)'\)/,
    );
    if (metadata) {
      const logicalName = metadata[1];
      const attribute = decodeURIComponent(url).match(
        /Attributes\(LogicalName='([^']+)'\)/,
      );
      if (
        logicalName === "cr40f_composicaodeprecos" &&
        url.includes("LookupAttributeMetadata")
      )
        return response({
          value: [
            {
              LogicalName: "cr40f_reserva",
              Targets: ["cr40f_reservadeveculos"],
            },
          ],
        });
      if (
        logicalName === "cr40f_reservadeveculos" &&
        url.includes("/Attributes?$select=LogicalName,DisplayName,AttributeType")
      ) {
        if (!metadataAvailable)
          return response({ error: { message: "Metadata indisponível" } }, 500);
        return response({
          value: [
            {
              LogicalName: "cr40f_dataehorriodesada",
              DisplayName: { UserLocalizedLabel: { Label: "Data e horário de saída" } },
              AttributeType: "DateTime",
            },
            {
              LogicalName: "cr40f_trajeto",
              DisplayName: { UserLocalizedLabel: { Label: "Trajeto" } },
              AttributeType: "String",
            },
            {
              LogicalName: "cr40f_cliente",
              DisplayName: { UserLocalizedLabel: { Label: "Cliente" } },
              AttributeType: "Lookup",
            },
            {
              LogicalName: "cr40f_motorista",
              DisplayName: { UserLocalizedLabel: { Label: "Motorista" } },
              AttributeType: "Lookup",
            },
            {
              LogicalName: "new_datadefinalizacao",
              DisplayName: { UserLocalizedLabel: { Label: "Data de Finalização" } },
              AttributeType: "DateTime",
            },
            {
              LogicalName: "cr40f_obsdeoperao",
              DisplayName: { UserLocalizedLabel: { Label: "Obs de Operação" } },
              AttributeType: "Memo",
            },
            {
              LogicalName: "new_observacaofinal",
              DisplayName: { UserLocalizedLabel: { Label: "Observação Final" } },
              AttributeType: "Memo",
            },
          ],
        });
      }
      if (
        logicalName === "cr40f_reservadeveculos" &&
        url.includes("PicklistAttributeMetadata")
      )
        return response({
          OptionSet: {
            Options: [
              {
                Value: 100000000,
                Color: "#4F6BED",
                Label: { UserLocalizedLabel: { Label: "Programado" } },
              },
              {
                Value: 100000001,
                Color: "#107C10",
                Label: { UserLocalizedLabel: { Label: "Concluído" } },
              },
              {
                Value: 100000002,
                Color: "#D83B01",
                Label: {
                  UserLocalizedLabel: { Label: "Cancelado com ressalvas" },
                },
              },
            ],
          },
        });
      if (
        attribute &&
        logicalName === "cr40f_itempagamentoaterceiro" &&
        attribute[1] === "cr40f_motorista"
      )
        return response({
          LogicalName: attribute[1],
          SchemaName: schemaNames[attribute[1]],
          AttributeType: "String",
        });
      if (attribute)
        return schemaNames[attribute[1]]
          ? response({
              LogicalName: attribute[1],
              SchemaName: schemaNames[attribute[1]],
              AttributeType: "Lookup",
            })
          : response({}, 404);
      return response({
        EntitySetName: entityNames[logicalName] || `${logicalName}es`,
        PrimaryIdAttribute: `${logicalName}id`,
        PrimaryNameAttribute: `${logicalName}_name`,
      });
    }
    if (url.includes("cr40f_vinculomotoristafavorecidos"))
      return response({
        value: [
          {
            cr40f_vinculomotoristafavorecidoid: "link-remote-001",
            _cr40f_motorista_value: "drv-remote-001",
            _cr40f_terceirofavorecido_value: "fav-remote-001",
            cr40f_status: 100000000,
          },
        ],
      });
    if (url.includes("cr40f_composicaodeprecos"))
      return response({
        value: [
          {
            cr40f_composicaodeprecosid: "cmp-remote-001",
            cr40f_id: "CMP-REMOTE-001",
            _cr40f_reserva_value: "res-remote-001",
            new_valortotal: 1000,
            new_status: 100000001,
            "new_status@OData.Community.Display.V1.FormattedValue": "Concluído",
            cr40f_valorrepasseterceiro: 600,
            _cr40f_terceirofavorecido_value: "",
            _cr40f_pagamentoaterceiro_value: "",
          },
          {
            cr40f_composicaodeprecosid: "cmp-without-service",
            cr40f_id: "CMP-WITHOUT-SERVICE",
            new_status: 100000001,
          },
        ],
      });
    if (url.includes("cr40f_reservadeveculoses"))
      return response({
        value: [
          {
            cr40f_reservadeveculosid: "res-remote-001",
            cr40f_id: "RES-REMOTE-001",
            cr40f_status: 100000002,
            new_categoriadoitem: 100000000,
            "cr40f_status@OData.Community.Display.V1.FormattedValue":
              "Cancelado com ressalvas",
            cr40f_dataehorriodesada: "2026-07-15T12:00:00Z",
            "cr40f_dataehorriodesada@OData.Community.Display.V1.FormattedValue":
              "15/07/2026 09:00",
            new_datadefinalizacao: "2026-07-15T14:00:00Z",
            "new_datadefinalizacao@OData.Community.Display.V1.FormattedValue":
              "15/07/2026 11:00",
            cr40f_trajeto: "GRU - Centro",
            cr40f_obsdeoperao: "Receber passageiro no desembarque.",
            new_observacaofinal: "Serviço concluído.",
            cr40f_destino: "Centro",
            _cr40f_motorista_value: "drv-remote-001",
            "_cr40f_motorista_value@OData.Community.Display.V1.FormattedValue":
              "Motorista remoto",
            _cr40f_cliente_value: "cli-remote-001",
            "_cr40f_cliente_value@OData.Community.Display.V1.FormattedValue":
              "Cliente remoto",
          },
        ],
      });
    if (url.includes("cr40f_pagamentoaterceiros"))
      return response({ value: [payment] });
    if (url.includes("cr40f_itempagamentoaterceiros"))
      return response({
        value: [
          {
            cr40f_itempagamentoaterceiroid: "item-remote-001",
            _cr40f_composicao_value: "cmp-remote-001",
            _cr40f_pagamentoaterceiro_value: "lot-remote-001",
            _cr40f_reserva_value: "res-remote-001",
            _cr40f_motoristareferencia_value: "drv-remote-001",
            cr40f_dataservico: "2026-07-15T12:00:00Z",
            cr40f_trajeto: "GRU - Centro",
            cr40f_valorcobrado: 1000,
            cr40f_valorrepasse: 600,
            cr40f_margem: 400,
            cr40f_snapshotfinanceiro: "{}",
          },
        ],
      });
    if (url.includes("cr40f_eventopagamentoaterceiros"))
      return response({
        value: [
          {
            cr40f_eventopagamentoaterceiroid: "evt-remote-001",
            _cr40f_pagamentoaterceiro_value: "lot-remote-001",
            cr40f_dataevento: "2026-07-15T12:01:00Z",
            cr40f_name: "paid",
            cr40f_operacao: 100000003,
            cr40f_resultado: "success",
            cr40f_estadonovo: "Pago",
            cr40f_mensagem: "Pagamento registrado.",
            cr40f_versao: 1,
          },
        ],
      });
    return response({ value: [] });
  };
  const imported = await import(`../src/lib/dataverse.js?remote=${Date.now()}-${Math.random()}`);
  return {
    ...imported,
    requests,
    restore() {
      globalThis.window = previousWindow;
      globalThis.fetch = previousFetch;
    },
  };
}

test("lista de lançamento traz contexto operacional para precificar", async () => {
  const { dataverse } = await client();
  dataverse.resetMock();
  const service = (await dataverse.listFinanceServices()).find(
    (row) => row.status === "concluido",
  );
  assert.ok(service.dataServico);
  assert.ok(service.dataFinalizacao);
  assert.ok(service.trajeto);
  assert.ok(service.motorista);
  assert.ok(service.tipoVeiculo);
  assert.ok(service.observacaoOperacao);
});

test("lista retorna somente reservas da categoria Serviço", async () => {
  const { dataverse, CHOICES } = await client();
  dataverse.resetMock();
  const services = await dataverse.listFinanceServices();
  assert.ok(services.length > 0);
  assert.ok(services.length < 96);
  assert.equal(
    services.every(
      (service) => service.itemCategory === CHOICES.serviceItemCategory,
    ),
    true,
  );
});

test("link do serviço abre a reserva no formulário geral", async () => {
  const { dataverse } = await client();
  const url = new URL(
    dataverse.reservationWebresourceUrl("da5c0f99-c570-f111-ab0e-70a8a5a9630e"),
    "https://app.local",
  );
  const data = JSON.parse(url.searchParams.get("data"));
  assert.equal(url.searchParams.get("pagetype"), "webresource");
  assert.equal(url.searchParams.get("webresourceName"), "new_formulario_geral.html");
  assert.equal(data.entityName, "cr40f_reservadeveculos");
  assert.equal(data.id, "da5c0f99-c570-f111-ab0e-70a8a5a9630e");
  assert.equal(data.recordId, data.id);
  assert.equal(data.entityId, data.id);
});

test("bloqueia repasse com versão desatualizada", async () => {
  const { dataverse } = await client();
  dataverse.resetMock();
  const service = (await dataverse.listFinanceServices()).find(
    (row) => row.status === "concluido",
  );
  await dataverse.saveServiceRepasse(service.id, 800, service.etag);
  await assert.rejects(
    () => dataverse.saveServiceRepasse(service.id, 900, service.etag),
    /alterado por outro usuário/i,
  );
});

test("fluxo local: repasse, vínculo, rascunho, pagamento, documento e auditoria", async () => {
  const { dataverse } = await client();
  dataverse.resetMock();
  const [favorecido] = await dataverse.listFavorecidos();
  const services = await dataverse.listFinanceServices();
  const target = services.find(
    (row) => row.status === "concluido" && row.valorRepasse === 0,
  );
  await dataverse.saveServiceRepasse(target.id, 800, target.etag);
  await dataverse.setPreferredFavorecido(target.id, favorecido.id);
  const refreshed = (await dataverse.listFinanceServices()).find(
    (row) => row.id === target.id,
  );
  const lot = await dataverse.createDraftLot({
    favorecido,
    services: [refreshed],
    year: 2026,
  });
  assert.equal(lot.paymentStatus, "open");
  assert.equal(
    (await dataverse.listFinanceServices()).find((row) => row.id === target.id)
      .pagamentoId,
    lot.id,
  );
  const paid = await dataverse.markPaid(lot.id);
  assert.equal(paid.paymentStatus, "paid");
  const upload = await dataverse.saveDocumentToOneDrive(paid, {
    name: "teste.pdf",
    base64: "AA==",
  });
  await dataverse.registerDocumentResult(lot.id, {
    ok: true,
    url: upload.url,
    name: "teste.pdf",
  });
  const detail = await dataverse.getLotDetail(lot.id);
  assert.equal(detail.documentStatus, "sent");
  assert.equal(detail.emailId, "");
  assert.equal(typeof dataverse.sendEmailWithPdf, "undefined");
  assert.ok(detail.events.length >= 3);
  assert.equal(detail.items[0].valorCobrado > 0, true);
});

test("cancelamento exige motivo e libera serviços", async () => {
  const { dataverse } = await client();
  dataverse.resetMock();
  const [favorecido] = await dataverse.listFavorecidos();
  const service = (await dataverse.listFinanceServices()).find(
    (row) =>
      row.status === "concluido" &&
      row.valorRepasse > 0 &&
      !row.pagamentoId &&
      row.favorecidoId === favorecido.id,
  );
  const lot = await dataverse.createDraftLot({
    favorecido,
    services: [service],
    year: 2026,
  });
  await assert.rejects(() => dataverse.cancelLot(lot.id, ""));
  await dataverse.cancelLot(lot.id, "Serviço duplicado");
  assert.equal(
    (await dataverse.listFinanceServices()).find((row) => row.id === service.id)
      .pagamentoId,
    "",
  );
});

test("falha documental mantém pagamento e reversão exige motivo", async () => {
  const { dataverse } = await client();
  dataverse.resetMock();
  const [favorecido] = await dataverse.listFavorecidos();
  const service = (await dataverse.listFinanceServices()).find(
    (row) =>
      row.status === "concluido" &&
      row.valorRepasse > 0 &&
      !row.pagamentoId &&
      row.favorecidoId === favorecido.id,
  );
  const lot = await dataverse.createDraftLot({
    favorecido,
    services: [service],
    year: 2026,
  });
  await dataverse.markPaid(lot.id);
  dataverse.setMockFailure("onedrive");
  await assert.rejects(() =>
    dataverse.saveDocumentToOneDrive(lot, { name: "x.pdf", base64: "AA==" }),
  );
  await dataverse.registerDocumentResult(lot.id, { ok: false, error: "falha" });
  assert.equal((await dataverse.getLotDetail(lot.id)).paymentStatus, "paid");
  await assert.rejects(() => dataverse.revertPaid(lot.id, ""));
  const reverted = await dataverse.revertPaid(lot.id, "PIX devolvido");
  assert.equal(reverted.paymentStatus, "open");
  assert.equal(reverted.documentStatus, "resend_required");
});

test("preenche favorecido vazio do mesmo motorista sem sobrescrever os já definidos", async () => {
  const { dataverse } = await client();
  dataverse.resetMock();
  const [favorecido] = await dataverse.listFavorecidos();
  const services = await dataverse.listFinanceServices();
  const target = services.find((row) => !row.favorecidoId);
  const emptySiblingIds = services
    .filter(
      (row) => row.motoristaId === target.motoristaId && !row.favorecidoId,
    )
    .map((row) => row.id);
  await dataverse.setPreferredFavorecido(
    target.id,
    favorecido.id,
    target.motoristaId,
  );
  await dataverse.assignFavorecidoToServices(
    emptySiblingIds.filter((id) => id !== target.id),
    favorecido.id,
  );
  const refreshed = await dataverse.listFinanceServices();
  assert.equal(
    refreshed
      .filter((row) => emptySiblingIds.includes(row.id))
      .every((row) => row.favorecidoId === favorecido.id),
    true,
  );
});

test("inativar vínculo limpa todas as linhas do motorista e reativar preenche novamente", async () => {
  const { dataverse } = await client();
  dataverse.resetMock();
  const activeLink = (await dataverse.listLinks()).find(
    (link) => link.status === "ativo",
  );
  const linkedServiceIds = (await dataverse.listFinanceServices())
    .filter(
      (service) =>
        service.motoristaId === activeLink.motoristaId &&
        service.favorecidoId === activeLink.favorecidoId,
    )
    .map((service) => service.id);

  await dataverse.clearFavorecidoFromServices(
    linkedServiceIds,
    activeLink.favorecidoId,
  );
  await dataverse.setLinkStatus(activeLink.id, "inativo");

  let refreshed = await dataverse.listFinanceServices();
  assert.equal(
    refreshed
      .filter((service) => linkedServiceIds.includes(service.id))
      .every((service) => !service.favorecidoId),
    true,
  );

  await dataverse.upsertLink(
    activeLink.motoristaId,
    activeLink.favorecidoId,
  );
  await dataverse.assignFavorecidoToServices(
    linkedServiceIds,
    activeLink.favorecidoId,
  );

  refreshed = await dataverse.listFinanceServices();
  assert.equal(
    refreshed
      .filter((service) => linkedServiceIds.includes(service.id))
      .every((service) => service.favorecidoId === activeLink.favorecidoId),
    true,
  );
});

test("comprovante de pagamento pode ser enviado para o OneDrive no mock", async () => {
  const { dataverse } = await client();
  dataverse.resetMock();
  const lot = (await dataverse.listLots()).find((item) => item.paymentStatus === "paid");
  const upload = await dataverse.uploadPaymentProof(lot, {
    name: "comprovante bancario.xlsx",
    size: 1024,
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  assert.equal(upload.name, "comprovante_bancario.xlsx");
  assert.match(upload.url, /onedrive\.local/);
});

test("contrato remoto usa navigation properties da metadata e normaliza lote", async () => {
  const remote = await remoteClient();
  try {
    assert.equal(remote.dataverse.contextSource, "xrm");
    assert.equal(remote.dataverse.clientUrl, "https://app.crm.dynamics.com");
    await remote.dataverse.upsertLink("drv-remote-002", "fav-remote-001");
    const createRequest = remote.requests.find(
      (request) => request.options.method === "POST",
    );
    const payload = JSON.parse(createRequest.options.body);
    assert.equal(
      payload["cr40f_Motorista@odata.bind"],
      "/cr40f_funcionarioses(drv-remote-002)",
    );
    assert.equal(
      payload["cr40f_TerceiroFavorecido@odata.bind"],
      "/cr40f_terceirofavorecidos(fav-remote-001)",
    );
    const remoteLinks = await remote.dataverse.listLinks();
    const remoteServices = await remote.dataverse.listFinanceServices();
    const reservationStatuses = await remote.dataverse.listReservationStatuses();
    assert.equal(remoteServices.length, 1);
    assert.equal(remoteLinks[0].motoristaId, "drv-remote-001");
    assert.equal(remoteServices[0].identificador, "RES-REMOTE-001");
    assert.equal(remoteServices[0].itemCategory, 100000000);
    assert.equal(remoteServices[0].status, "concluido");
    assert.equal(remoteServices[0].reservationStatus, "100000002");
    assert.equal(
      remoteServices[0].reservationStatusLabel,
      "Cancelado com ressalvas",
    );
    assert.deepEqual(
      reservationStatuses.map((option) => option.label),
      ["Programado", "Concluído", "Cancelado com ressalvas"],
    );
    assert.equal(remoteServices[0].motoristaId, "drv-remote-001");
    assert.equal(remoteServices[0].reservationId, "res-remote-001");
    assert.equal(remoteServices[0].motorista, "Motorista remoto");
    assert.equal(remoteServices[0].cliente, "Cliente remoto");
    assert.equal(remoteServices[0].trajeto, "GRU - Centro");
    assert.equal(remoteServices[0].dataServico, "2026-07-15T12:00:00Z");
    assert.equal(remoteServices[0].dataFinalizacao, "2026-07-15T14:00:00Z");
    assert.equal(
      remoteServices[0].observacaoOperacao,
      "Receber passageiro no desembarque.",
    );
    assert.equal(remoteServices[0].observacaoFinal, "Serviço concluído.");
    assert(
      remote.requests.some((request) =>
        request.url.includes("_cr40f_reserva_value"),
      ),
    );
    assert(
      remote.requests.some((request) =>
        request.url.includes("new_categoriadoitem eq 100000000"),
      ),
    );
    assert(
      remote.requests.some((request) =>
        request.url.includes("new_datadefinalizacao"),
      ),
    );
    assert(
      remote.requests.some((request) =>
        request.url.includes("cr40f_obsdeoperao"),
      ),
    );
    const preferred = await remote.dataverse.setPreferredFavorecido(
      "cmp-remote-001",
      "fav-remote-001",
      "drv-remote-001",
    );
    assert.equal(preferred.favorecidoId, "fav-remote-001");
    const created = await remote.dataverse.createDraftLot({
      year: 2026,
      favorecido: {
        id: "fav-remote-001",
        nome: "Favorecido remoto",
        email: "favorecido@example.com",
      },
      services: [{ id: "cmp-remote-001" }],
    });
    assert.equal(created.id, "lot-remote-001");
    const itemRequest = remote.requests.find(
      (request) =>
        request.options.method === "POST" &&
        request.url.includes("cr40f_itempagamentoaterceiros"),
    );
    const itemPayload = JSON.parse(itemRequest.options.body);
    assert.equal(
      itemPayload["cr40f_Composicao@odata.bind"],
      "/cr40f_composicaodeprecoses(cmp-remote-001)",
    );
    assert.equal(
      itemPayload["cr40f_MotoristaReferencia@odata.bind"],
      "/cr40f_funcionarioses(drv-remote-001)",
    );
    assert.equal(itemPayload.cr40f_valorrepasse, 600);
    const eventRequest = remote.requests.find(
      (request) =>
        request.options.method === "POST" &&
        request.url.includes("cr40f_eventopagamentoaterceiros"),
    );
    const eventPayload = JSON.parse(eventRequest.options.body);
    assert.equal(eventPayload.cr40f_name, "draft_created");
    assert.equal(eventPayload.cr40f_operacao, 100000000);
    assert.equal(typeof eventPayload.cr40f_operacao, "number");
    const lots = await remote.dataverse.listLots();
    assert.equal(lots[0].paymentStatus, "paid");
    assert.equal(lots[0].documentStatus, "sent");
    const detail = await remote.dataverse.getLotDetail("lot-remote-001");
    assert.equal(detail.items[0].itemStatus, "paid");
    assert.equal(detail.items[0].motoristaId, "drv-remote-001");
    assert.equal(detail.events[0].operation, "paid");
    assert.equal(detail.favorecido.email, "favorecido@example.com");
  } finally {
    remote.restore();
  }
});

test("mantém campos operacionais quando metadata da reserva falha", async () => {
  const remote = await remoteClient({ metadataAvailable: false });
  try {
    const [service] = await remote.dataverse.listFinanceServices();
    assert.equal(service.dataServico, "2026-07-15T12:00:00Z");
    assert.equal(service.dataFinalizacao, "2026-07-15T14:00:00Z");
    assert.equal(service.observacaoOperacao, "Receber passageiro no desembarque.");
    assert(
      remote.requests.some((request) =>
        request.url.includes("cr40f_dataehorriodesada"),
      ),
    );
  } finally {
    remote.restore();
  }
});

test("URL do Flow de OneDrive vem da variável de ambiente Dataverse", async () => {
  const flowUrl = "https://flow.example/salvar-arquivo";
  const remote = await remoteClient({ oneDriveFlowUrl: flowUrl });
  try {
    const upload = await remote.dataverse.saveDocumentToOneDrive(
      { id: "lot-remote-001", identifier: "PT-2026-REMOTE", year: 2026, version: 1 },
      { name: "pagamento.pdf", base64: "cGRm" },
    );
    assert.equal(upload.url, "https://onedrive.example/documento.pdf");
    assert(
      remote.requests.some(
        (request) => request.url.includes("environmentvariabledefinitions"),
      ),
    );
    assert(
      remote.requests.some((request) => request.url === flowUrl),
    );
  } finally {
    remote.restore();
  }
});

test("webresource direto usa a sessao autenticada da propria organizacao", async () => {
  const remote = await remoteClient({ direct: true });
  try {
    const identity = await remote.dataverse.loadDirectIdentity();
    assert.equal(remote.dataverse.contextSource, "direct");
    assert.equal(remote.dataverse.clientUrl, "https://app.crm.dynamics.com");
    assert.deepEqual(identity, {
      userId: "usr-remote-001",
      organizationId: "org-remote-001",
      businessUnitId: "bu-remote-001",
    });
    assert(
      remote.requests.some((request) =>
        request.url.endsWith("/api/data/v9.2/WhoAmI"),
      ),
    );
    assert(
      remote.requests.every(
        (request) => request.options.credentials === "same-origin",
      ),
    );
    await remote.dataverse.listDrivers();
    assert(
      remote.requests.some((request) =>
        request.url.includes("/api/data/v9.2/cr40f_funcionarioses"),
      ),
    );
  } finally {
    remote.restore();
  }
});
