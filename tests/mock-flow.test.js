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

async function remoteClient() {
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
  globalThis.window = {
    location: { hostname: "app.crm.dynamics.com", port: "" },
    Xrm: {
      Utility: {
        getGlobalContext: () => ({
          getClientUrl: () => "https://app.crm.dynamics.com",
        }),
      },
    },
    parent: {},
    top: {},
  };
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url, options });
    if (options.method === "POST") return response({});
    const metadata = decodeURIComponent(url).match(
      /EntityDefinitions\(LogicalName='([^']+)'\)/,
    );
    if (metadata) {
      const logicalName = metadata[1];
      const attribute = decodeURIComponent(url).match(
        /Attributes\(LogicalName='([^']+)'\)/,
      );
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
            _cr40f_servicorelacionadogeral_value: "res-remote-001",
            new_valortotal: 1000,
            new_status: 100000001,
            cr40f_valorrepasseterceiro: 600,
            _cr40f_terceirofavorecido_value: "",
            _cr40f_pagamentoaterceiro_value: "",
          },
        ],
      });
    if (url.includes("cr40f_reservadeveculoses"))
      return response({
        value: [
          {
            cr40f_reservadeveculosid: "res-remote-001",
            cr40f_id: "RES-REMOTE-001",
            cr40f_dataehorriodesada: "2026-07-15T12:00:00Z",
            cr40f_trajeto: "GRU - Centro",
            cr40f_destino: "Centro",
            _cr40f_motorista_value: "drv-remote-001",
            _cr40f_cliente_value: "cli-remote-001",
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
            _cr40f_motorista_value: "drv-remote-001",
            cr40f_dataservico: "2026-07-15T12:00:00Z",
            cr40f_trajeto: "GRU - Centro",
            cr40f_valorcobrado: 1000,
            cr40f_valorrepass: 600,
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
            cr40f_operacao: "paid",
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
  const email = await dataverse.sendEmailWithPdf(paid, {
    name: "teste.pdf",
    base64: "AA==",
  });
  await dataverse.registerDocumentResult(lot.id, {
    ok: true,
    url: upload.url,
    name: "teste.pdf",
    emailId: email.id,
  });
  const detail = await dataverse.getLotDetail(lot.id);
  assert.equal(detail.documentStatus, "sent");
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

test("contrato remoto usa navigation properties da metadata e normaliza lote", async () => {
  const remote = await remoteClient();
  try {
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
    assert.equal(remoteLinks[0].motoristaId, "drv-remote-001");
    assert.equal(remoteServices[0].motoristaId, "drv-remote-001");
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
    assert(
      remote.requests.some(
        (request) =>
          request.options.method === "POST" &&
          request.url.includes("cr40f_eventopagamentoaterceiros"),
      ),
    );
    const lots = await remote.dataverse.listLots();
    assert.equal(lots[0].paymentStatus, "paid");
    assert.equal(lots[0].documentStatus, "sent");
    const detail = await remote.dataverse.getLotDetail("lot-remote-001");
    assert.equal(detail.items[0].itemStatus, "paid");
    assert.equal(detail.events[0].operation, "paid");
    assert.equal(detail.favorecido.email, "favorecido@example.com");
  } finally {
    remote.restore();
  }
});
