// src/variableResolution.js

let variableStore = {};

export function setVariable(name, value) {
  variableStore[name] = value;
}

export function getVariable(name) {
  return variableStore[name];
}

export async function resolveVariables(value) {
  if (typeof value !== 'string') return value;

  const regex = /\$\{([^}]+)\}/g;
  const promises = [];
  let match;
  
  while ((match = regex.exec(value)) !== null) {
    const [fullMatch, varName] = match;
    promises.push(getVariable(varName).then(resolvedValue => ({fullMatch, resolvedValue})));
  }

  const resolvedValues = await Promise.all(promises);
  
  return resolvedValues.reduce((acc, {fullMatch, resolvedValue}) => {
    return acc.replace(fullMatch, resolvedValue || fullMatch);
  }, value);
}