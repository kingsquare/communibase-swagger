import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { Connector } from 'communibase-connector-js';

if (!process.argv[2]) {
    console.log('Missing Communibase key');
    process.exit(1);
}

if (!process.argv[3]) {
    console.log('Missing output file name');
    process.exit(1);
}

const cbc = new Connector(process.argv[2]);

function getSwaggerProperty(attribute) {
    switch (attribute.type) {
        case 'Array':
            return {
                type: 'array',
                items: {
                    "$ref": `#/definitions/${attribute.items}`
                }
            };

        case 'Date':
            return {
                type: 'string',
                format: 'date-time'
            };

        case 'ObjectId':
            return {
                type: 'string',
                minLength: 24
            };

        case 'int':
            return {
                type: 'integer'
            };

        case 'float':
            return {
                type: 'number'
            };

        case 'array':
        case 'boolean':
        case 'integer':
        case 'null':
        case 'number':
        case 'object':
        case 'string':
            return {
                type: attribute.type,
                enum: ((attribute.allowableValues && attribute.allowableValues.values
                        && attribute.allowableValues.values.length)
                    ? attribute.allowableValues.values
                    : null)
            };

        default:
            return {
                "$ref": `#/definitions/${attribute.type}`
            }

    }
}

cbc.getAll('EntityType').then(entityTypes => {
    const definitions = {};
    entityTypes.forEach(entityType => {
        definitions[entityType.title] = {
            type: 'object',
            properties: {},
            required: []
        };
        entityType.attributes.map(attribute => {
            definitions[entityType.title].properties[attribute.title] = getSwaggerProperty(attribute);
            if (attribute.isRequired) {
                definitions[entityType.title].required.push(attribute.title)
            }
        });
        if (!definitions[entityType.title].required.length) {
            definitions[entityType.title].required = undefined;
        }
    });

    const swagger = {
        'swagger': '2.0',
        'info': {
            'version': '0.0.1',
            'title': 'CB API',
            'description': 'A RESTful API for Communibase'
        },
        'host': 'api.communibase.nl',
        'basePath': '/v1',
        'tags': [],
        'schemes': [
            'https'
        ],
        'produces': [
            'application/json'
        ],
        'paths': {
            "/EntityType.json/crud": {
                "get": {
                    "description": "Get all Entity types",
                    "parameters": [
                        {
                            "name": "token",
                            "in": "query",
                            "type": "string",
                            "description": "A token as retrieved via /auth/login",
                            "required": true
                        }
                    ],
                    "responses": {
                        "200": {
                            "description": "OK",
                            "schema": {
                                "$ref": "#/definitions/EntityType"
                            }
                        }
                    }
                }
            }
        },
        definitions
    };

    const path = resolve(process.argv[3]);
    writeFileSync(path, JSON.stringify(swagger, null, '\t'),{encoding:'utf8', flag:'w'});
    console.log(`Created ${path}`);
}).catch(err => {
    console.log(err);
    process.exit(1);
});
