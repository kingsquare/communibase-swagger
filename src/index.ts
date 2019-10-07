import { Connector } from "communibase-connector-js";
import { Schema, Spec } from "swagger-schema-official";

interface ICbEntity {
  type: "object";
  title: string;
  description?: string;
  attributes: ICbAttribute[];
  isResource: boolean;
}

interface ICbAttributeAllowableValues {
  // TODO all types
  valueType: "List" | "RegExp" | "Range";
  match?: string;
  values: any[];
  min: number;
  max: number;
}

interface ICbAttribute {
  allowableValues?: ICbAttributeAllowableValues;
  defaultValue?: any;
  type: string;
  items?: string;
  minLength?: number;
  maxLength?: number;
  title: string;
  renderHint?: string;
  description?: string;
  isRequired?: boolean;
  isCore?: boolean;
}

function getSwaggerProperty(attribute: ICbAttribute): Schema {
  switch (attribute.type) {
    case "ObjectId":
      return {
        $ref: "#/definitions/ObjectId"
      };

    case "Array":
      return {
        type: "array",
        description: attribute.description,
        items: getSwaggerProperty({
          type: attribute.items as string,
          title: ""
        })
      };

    case "Date":
      // CB datetime or date are always date-time
      return {
        type: "string",
        description: attribute.description,
        format: "date-time",
        default:
          attribute.defaultValue || attribute.defaultValue === 0
            ? attribute.defaultValue
            : undefined
      };

    case "int":
    case "float":
      return {
        type: attribute.type === "int" ? "integer" : "number",
        description: attribute.description,
        minimum:
          attribute.allowableValues &&
          attribute.allowableValues.valueType === "Range"
            ? attribute.allowableValues.min
            : undefined,
        maximum:
          attribute.allowableValues &&
          attribute.allowableValues.valueType === "Range"
            ? attribute.allowableValues.max
            : undefined,
        default:
          attribute.defaultValue || attribute.defaultValue === 0
            ? attribute.defaultValue
            : undefined
      };

    case "array":
    case "boolean":
    case "integer":
    // case "null": // this type breaks the spec
    case "number":
    case "object":
    case "string":
      return {
        type: attribute.type,
        description: attribute.description,
        enum:
          attribute.allowableValues &&
          attribute.allowableValues.valueType &&
          attribute.allowableValues.valueType === "List" &&
          attribute.allowableValues.values &&
          attribute.allowableValues.values.length
            ? (attribute.allowableValues.values as any)
            : undefined,
        pattern:
          attribute.allowableValues &&
          attribute.allowableValues.valueType === "RegExp" &&
          attribute.allowableValues.match
            ? attribute.allowableValues.match.replace(
                /^\/(.*?)\/([gism]+)?$/,
                "$1"
              )
            : undefined,
        default:
          attribute.defaultValue || attribute.defaultValue === 0
            ? attribute.defaultValue
            : undefined
      };

    case "Mixed":
      // TODO should be oneOf ?
      return {
        type: "object",
        title: attribute.title,
        description: attribute.description,
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
    const definition: Schema = {
      type: "object",
      description: entityType.description,
      properties: {
        _id: {
          $ref: "#/definitions/ObjectId"
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
        $ref: "#/definitions/ObjectId"
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
      version: "1.0.0",
      title: "Communibase API for X",
      description: "A RESTful API for Communibase administration X"
    },
    host: "api.communibase.nl",
    basePath: "/v1",
    tags: [],
    schemes: ["https"],
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
