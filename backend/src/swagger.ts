import type { OpenAPIV3 } from "openapi-types";

const exampleIds = Array.from({ length: 3 }).map((_, i) => `user_${i + 1}`);

export const openApiSpec: OpenAPIV3.Document = {
  openapi: "3.0.3",
  info: {
    title: "APINode - PDF Batch API",
    version: "0.1.0",
    description:
      "API de génération de PDFs en batch (Producer/Consumer via BullMQ, stockage via MongoDB/GridFS, génération via Piscina)."
  },
  servers: [{ url: "http://localhost:3000" }],
  tags: [
    { name: "Batch" },
    { name: "Documents" },
    { name: "Ops" }
  ],
  paths: {
    "/api/documents/batch": {
      post: {
        tags: ["Batch"],
        summary: "Créer un batch d'IDs",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "array",
                minItems: 1,
                maxItems: 5000,
                items: { type: "string" }
              },
              examples: {
                sample: {
                  summary: "Exemple (tronqué)",
                  value: exampleIds
                }
              }
            }
          }
        },
        responses: {
          "202": {
            description: "Batch accepté",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["batchId", "message"],
                  properties: {
                    batchId: { type: "string" },
                    message: { type: "string" }
                  }
                },
                examples: {
                  ok: {
                    value: {
                      batchId: "65f000000000000000000001",
                      message: "Batch created and processing has started"
                    }
                  }
                }
              }
            }
          },
          "400": {
            description: "Requête invalide",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["error"],
                  properties: {
                    error: { type: "string" },
                    details: { type: "string" }
                  }
                },
                examples: {
                  badCount: { value: { error: "IDs array must contain between 1 and 5000 items" } },
                  badType: { value: { error: "All IDs must be non-empty strings" } }
                }
              }
            }
          },
          "429": {
            description: "Rate limit",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["error"],
                  properties: {
                    error: { type: "string" },
                    retryAfter: { type: "number" }
                  }
                },
                examples: {
                  limited: { value: { error: "Too many requests", retryAfter: 60 } }
                }
              }
            }
          },
          "500": {
            description: "Erreur serveur",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["error"],
                  properties: { error: { type: "string" } }
                },
                examples: {
                  err: { value: { error: "Failed to process batch" } }
                }
              }
            }
          }
        }
      }
    },
    "/api/documents/batch/{batchId}": {
      get: {
        tags: ["Batch"],
        summary: "Statut d'un batch",
        parameters: [
          {
            name: "batchId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": {
            description: "Batch trouvé",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["batchId", "status", "documents"],
                  properties: {
                    batchId: { type: "string" },
                    status: { type: "string", enum: ["pending", "processing", "completed", "failed"] },
                    documents: {
                      type: "array",
                      items: {
                        type: "object",
                        required: ["documentId", "status"],
                        properties: {
                          documentId: { type: "string" },
                          status: { type: "string", enum: ["pending", "processing", "completed", "failed"] },
                          generationTimeMs: { type: "number", nullable: true }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          "400": {
            description: "batchId invalide",
            content: {
              "application/json": {
                schema: { type: "object", required: ["error"], properties: { error: { type: "string" } } },
                examples: { bad: { value: { error: "Invalid batchId" } } }
              }
            }
          },
          "404": {
            description: "Batch non trouvé",
            content: {
              "application/json": {
                schema: { type: "object", required: ["error"], properties: { error: { type: "string" } } },
                examples: { nf: { value: { error: "Batch not found" } } }
              }
            }
          },
          "500": {
            description: "Erreur serveur",
            content: {
              "application/json": {
                schema: { type: "object", required: ["error"], properties: { error: { type: "string" } } }
              }
            }
          }
        }
      }
    },
    "/api/documents/{documentId}": {
      get: {
        tags: ["Documents"],
        summary: "Télécharger un PDF (GridFS)",
        parameters: [
          {
            name: "documentId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": {
            description: "PDF binaire",
            content: {
              "application/pdf": {
                schema: { type: "string", format: "binary" }
              }
            }
          },
          "404": {
            description: "Document ou fichier non trouvé",
            content: {
              "application/json": {
                schema: { type: "object", required: ["error"], properties: { error: { type: "string" } } }
              }
            }
          },
          "500": {
            description: "Erreur serveur",
            content: {
              "application/json": {
                schema: { type: "object", required: ["error"], properties: { error: { type: "string" } } }
              }
            }
          }
        }
      }
    },
    "/health": {
      get: {
        tags: ["Ops"],
        summary: "Health check (MongoDB + Redis)",
        responses: {
          "200": {
            description: "OK",
            content: { "application/json": { schema: { type: "object" } } }
          },
          "503": {
            description: "Degraded",
            content: { "application/json": { schema: { type: "object" } } }
          }
        }
      }
    },
    "/metrics": {
      get: {
        tags: ["Ops"],
        summary: "Prometheus metrics",
        responses: {
          "200": {
            description: "Text format",
            content: { "text/plain": { schema: { type: "string" } } }
          }
        }
      }
    }
  }
};
