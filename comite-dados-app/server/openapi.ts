/**
 * OpenAPI 3.0 specification for Lucid Data Governance REST API v1
 * Served at: GET /api/v1/openapi.json
 * Swagger UI: GET /api/v1/docs
 */

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Lucid Data Governance — API REST v1",
    version: "1.0.0",
    description:
      "API pública do Portal de Governança de Dados. Autenticação via API Key (Bearer token). " +
      "Gere sua chave em Configurações → Integrações & API.",
    contact: {
      name: "Time de Governança de Dados",
    },
  },
  servers: [
    {
      url: "/api/v1",
      description: "Servidor atual",
    },
  ],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "API Key",
        description: "Informe sua API Key no header: `Authorization: Bearer <chave>`",
      },
    },
    schemas: {
      Pagination: {
        type: "object",
        properties: {
          total: { type: "integer", description: "Total de registros" },
          limit: { type: "integer", description: "Máximo por página" },
          offset: { type: "integer", description: "Posição inicial" },
        },
      },
      Error: {
        type: "object",
        properties: {
          error: { type: "string", description: "Mensagem de erro" },
        },
        required: ["error"],
      },
      DataAsset: {
        type: "object",
        properties: {
          id: { type: "integer" },
          name: { type: "string" },
          type: { type: "string", enum: ["table", "view", "api", "file", "stream", "dashboard", "other"] },
          domainId: { type: "integer", nullable: true },
          description: { type: "string", nullable: true },
          sensitivity: { type: "string", enum: ["public", "internal", "confidential", "restricted"], nullable: true },
          criticality: { type: "string", enum: ["low", "medium", "high", "critical"], nullable: true },
          sourceSystem: { type: "string", nullable: true },
          owner: { type: "string", nullable: true },
          steward: { type: "string", nullable: true },
          qualityScore: { type: "number", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      GlossaryTerm: {
        type: "object",
        properties: {
          id: { type: "integer" },
          term: { type: "string" },
          definition: { type: "string" },
          category: { type: "string", nullable: true },
          status: { type: "string", enum: ["draft", "approved", "deprecated"] },
          owner: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      MaturityScore: {
        type: "object",
        properties: {
          overall: { type: "number", description: "Score geral de maturidade (0-100)" },
          catalog: { type: "number" },
          quality: { type: "number" },
          governance: { type: "number" },
          lineage: { type: "number" },
          compliance: { type: "number" },
        },
      },
      AccessRequest: {
        type: "object",
        properties: {
          id: { type: "integer" },
          assetId: { type: "integer" },
          assetName: { type: "string", nullable: true },
          requestedBy: { type: "string" },
          justification: { type: "string", nullable: true },
          status: { type: "string", enum: ["pending", "approved", "rejected"] },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      QualityTrend: {
        type: "object",
        properties: {
          recordedAt: { type: "string", format: "date-time" },
          score: { type: "number" },
        },
      },
    },
  },
  security: [{ ApiKeyAuth: [] }],
  paths: {
    "/assets": {
      get: {
        summary: "Listar ativos de dados",
        description: "Retorna a lista de ativos do catálogo de dados com suporte a filtros e paginação.",
        operationId: "listAssets",
        tags: ["Ativos"],
        parameters: [
          { name: "search", in: "query", schema: { type: "string" }, description: "Texto de busca por nome ou descrição" },
          { name: "domainId", in: "query", schema: { type: "integer" }, description: "Filtrar por ID do domínio" },
          { name: "sensitivity", in: "query", schema: { type: "string", enum: ["public", "internal", "confidential", "restricted"] } },
          { name: "criticality", in: "query", schema: { type: "string", enum: ["low", "medium", "high", "critical"] } },
          { name: "type", in: "query", schema: { type: "string", enum: ["table", "view", "api", "file", "stream", "dashboard", "other"] } },
          { name: "limit", in: "query", schema: { type: "integer", default: 50, maximum: 200 } },
          { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
        ],
        responses: {
          "200": {
            description: "Lista de ativos",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/Pagination" },
                    {
                      type: "object",
                      properties: {
                        data: { type: "array", items: { $ref: "#/components/schemas/DataAsset" } },
                      },
                    },
                  ],
                },
              },
            },
          },
          "401": { description: "Não autorizado", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "403": { description: "Permissão insuficiente (scope: assets:read)", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/assets/{id}": {
      get: {
        summary: "Detalhe de ativo",
        operationId: "getAsset",
        tags: ["Ativos"],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" }, description: "ID do ativo" },
        ],
        responses: {
          "200": {
            description: "Ativo encontrado",
            content: { "application/json": { schema: { type: "object", properties: { data: { $ref: "#/components/schemas/DataAsset" } } } } },
          },
          "404": { description: "Ativo não encontrado", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/assets/{id}/quality-history": {
      get: {
        summary: "Histórico de qualidade do ativo",
        description: "Retorna a tendência histórica dos scores de qualidade gravados para este ativo.",
        operationId: "getAssetQualityHistory",
        tags: ["Ativos"],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
          { name: "days", in: "query", schema: { type: "integer", default: 30 } },
        ],
        responses: {
          "200": {
            description: "Histórico de qualidade",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "array", items: { $ref: "#/components/schemas/QualityTrend" } },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/glossary": {
      get: {
        summary: "Listar termos do glossário",
        operationId: "listGlossary",
        tags: ["Glossário"],
        parameters: [
          { name: "search", in: "query", schema: { type: "string" } },
          { name: "status", in: "query", schema: { type: "string", enum: ["draft", "approved", "deprecated"] } },
          { name: "category", in: "query", schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer", default: 50, maximum: 200 } },
          { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
        ],
        responses: {
          "200": {
            description: "Lista de termos",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/Pagination" },
                    { type: "object", properties: { data: { type: "array", items: { $ref: "#/components/schemas/GlossaryTerm" } } } },
                  ],
                },
              },
            },
          },
        },
      },
    },
    "/metrics": {
      get: {
        summary: "Métricas de governança / maturidade",
        operationId: "getMetrics",
        tags: ["Métricas"],
        responses: {
          "200": {
            description: "Score de maturidade",
            content: { "application/json": { schema: { type: "object", properties: { data: { $ref: "#/components/schemas/MaturityScore" } } } } },
          },
        },
      },
    },
    "/lgpd/assets": {
      get: {
        summary: "Ativos com dados pessoais (LGPD)",
        operationId: "getLgpdAssets",
        tags: ["LGPD"],
        responses: {
          "200": {
            description: "Lista de ativos com dados pessoais",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "array", items: { $ref: "#/components/schemas/DataAsset" } },
                    total: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/access-requests": {
      get: {
        summary: "Listar requisições de acesso",
        operationId: "listAccessRequests",
        tags: ["Acesso"],
        parameters: [
          { name: "status", in: "query", schema: { type: "string", enum: ["pending", "approved", "rejected"] } },
        ],
        responses: {
          "200": {
            description: "Lista de requisições",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "array", items: { $ref: "#/components/schemas/AccessRequest" } },
                    total: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  tags: [
    { name: "Ativos", description: "Catálogo de ativos de dados" },
    { name: "Glossário", description: "Glossário de negócios" },
    { name: "Métricas", description: "Maturidade e governança" },
    { name: "LGPD", description: "Conformidade com LGPD" },
    { name: "Acesso", description: "Requisições de acesso a dados" },
  ],
};

export const swaggerUiHtml = (specUrl: string) => `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Lucid Data Governance — API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    body { margin: 0; background: #fafafa; }
    .topbar { display: none !important; }
    .swagger-ui .info hgroup.main a { pointer-events: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: "${specUrl}",
      dom_id: "#swagger-ui",
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: "BaseLayout",
      deepLinking: true,
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
    });
  </script>
</body>
</html>`;
