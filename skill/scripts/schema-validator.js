"use strict";

function typeMatches(value, type) {
  if (type === "null") return value === null;
  if (type === "array") return Array.isArray(value);
  if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  if (type === "integer") return Number.isInteger(value);
  return typeof value === type;
}

function validate(value, schema, location = "$") {
  const errors = [];
  if (schema.const !== undefined && value !== schema.const) errors.push(`${location}: debe ser ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${location}: valor no permitido`);
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some(type => typeMatches(value, type))) {
      errors.push(`${location}: tipo esperado ${types.join("|")}`);
      return errors;
    }
  }
  if (typeof value === "string") {
    if (schema.minLength && value.length < schema.minLength) errors.push(`${location}: longitud mínima ${schema.minLength}`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${location}: formato inválido`);
  }
  if (Array.isArray(value) && schema.items) {
    value.forEach((item, index) => errors.push(...validate(item, schema.items, `${location}[${index}]`)));
  }
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const required of schema.required || []) {
      if (!(required in value)) errors.push(`${location}.${required}: campo obligatorio`);
    }
    if (schema.additionalProperties === false && schema.properties) {
      for (const key of Object.keys(value)) {
        if (!(key in schema.properties)) errors.push(`${location}.${key}: propiedad no permitida`);
      }
    }
    for (const [key, child] of Object.entries(schema.properties || {})) {
      if (key in value) errors.push(...validate(value[key], child, `${location}.${key}`));
    }
  }
  if (schema.oneOf) {
    const matches = schema.oneOf.filter(option => validate(value, option, location).length === 0).length;
    if (matches !== 1) errors.push(`${location}: debe cumplir exactamente una alternativa`);
  }
  return errors;
}

module.exports = { validate };
