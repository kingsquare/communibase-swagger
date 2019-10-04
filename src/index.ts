import { Connector } from "communibase-connector-js";
import { Schema, Spec } from "swagger-schema-official";

interface ICbEntity {
  title: string;
  type: "object";
  attributes: ICbAttribute[];
  isResource: boolean;
}

interface ICbAttribute {
  allowableValues?: string[];
  type: string;
  items?: string;
  minLength?: number;
  maxLength?: number;
  title: string;
  isRequired?: boolean;
}

function getSwaggerProperty(attribute: ICbAttribute): Schema {
  switch (attribute.type) {
    case "Array":
      return {
        type: "array",
        items: getSwaggerProperty({
          type: attribute.items as string,
          title: ""
        })
      };

    case "Date":
      return {
        type: "string",
        format: "date-time"
      };

    case "ObjectId":
      return {
        type: "string",
        minLength: 24,
        maxLength: 24
      };

    case "int":
      return {
        type: "integer"
      };

    case "float":
      return {
        type: "number"
      };

    case "array":
    case "boolean":
    case "integer":
    // case "null":
    case "number":
    case "object":
    case "string":
      return {
        type: attribute.type,
        enum:
          attribute.allowableValues &&
          attribute.allowableValues.values &&
          attribute.allowableValues.values.length
            ? (attribute.allowableValues.values as any)
            : undefined
      };

    case "Mixed":
      return {
        type: "object",
        // @ts-ignore
        additionalProperties: true
      };

    default:
      return {
        $ref: `#/definitions/${attribute.type}`
      };
  }
}

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

  const definitions: { [title: string]: Schema } = {};

  entityTypes.forEach(entityType => {
    const definition: Schema = {
      type: "object",
      properties: {
        _id: {
          type: "string",
          minLength: 24,
          maxLength: 24
        }
      },
      required: []
    };
    definition.properties = definition.properties || {};

    if (entityType.isResource) {
      definition.properties.updatedAt = {
        type: "string",
        format: "date-time"
      };
      definition.properties.updatedBy = {
        type: "string"
      };
    }

    definitions[entityType.title] = definition;
    entityType.attributes.map(attribute => {
      definition.properties = definition.properties || {};
      definition.properties[attribute.title] = getSwaggerProperty(attribute);
      if (attribute.isRequired && definition.required) {
        definition.required.push(attribute.title);
      }
    });
    if (definition.required && !definition.required.length) {
      definition.required = undefined;
    }
  });

  return {
    swagger: "2.0",
    info: {
      version: "0.0.1",
      title: "CB API",
      description: "A RESTful API for Communibase"
    },
    host: "api.communibase.nl",
    basePath: "/v1",
    tags: [],
    schemes: ["https"],
    produces: ["application/json"],
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
