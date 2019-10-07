import { Connector } from "communibase-connector-js";
import { Schema, Spec } from "swagger-schema-official";
import { parse } from "url";
import { ICbEntity, parseEntityType } from "./parser";

export interface ICBSwaggerGeneratorOptions {
  apiKey: string;
  serviceUrl?: string;
}

export default async ({
  apiKey,
  serviceUrl
}: ICBSwaggerGeneratorOptions): Promise<Spec> => {
  if (!apiKey) {
    throw new Error("Missing Communibase API key");
  }
  const cbc = new Connector(apiKey);
  if (serviceUrl) {
    cbc.setServiceUrl(serviceUrl);
  }
  const entityTypes = await cbc.getAll<ICbEntity>("EntityType");

  const definitions: { [title: string]: Schema } = {
    ObjectId: {
      type: "string",
      minLength: 24,
      maxLength: 24
    },
    // TODO full EntityType definition
    EntityType: {
      type: "object",
      properties: {
        _id: {
          $ref: "#/definitions/ObjectId"
        }
      }
    }
  };

  entityTypes.forEach(entityType => {
    definitions[entityType.title] = parseEntityType(entityType);
  });

  // TODO get from Connector.getServiceUrl ? (though needs to be exposed)
  const url = parse(serviceUrl || "https://api.communibase.nl/0.1/");

  return {
    swagger: "2.0",
    info: {
      version: (url.pathname as string).replace(/\//g, ""),
      title: "Communibase API for X",
      description: "A RESTful API for Communibase administration X"
    },
    host: url.host,
    basePath: url.pathname,
    tags: [],
    schemes: [(url.protocol as string).replace(":", "")],
    produces: ["application/json"],

    // TODO full Paths definition
    paths: {
      "/EntityType.json/crud": {
        get: {
          description: "Get all Entity types",
          parameters: [
            {
              name: "token",
              in: "query",
              type: "string",
              description: "A token as retrieved via /auth/login",
              required: true
            }
          ],
          responses: {
            "200": {
              description: "OK",
              schema: {
                $ref: "#/definitions/EntityType"
              }
            }
          }
        }
      }
    },
    definitions
  };
};
