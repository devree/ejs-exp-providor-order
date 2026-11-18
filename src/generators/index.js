'use strict';
const shopee = require('./shopee');
const tiktok = require('./tiktok');
const lazada = require('./lazada');

const generators = { shopee, tiktok, lazada };
const PROVIDERS = ['shopee', 'tiktok', 'lazada'];

function getGenerator(provider) {
  if (typeof provider !== 'string' || !Object.hasOwn(generators, provider)) {
    throw new Error(`Unknown provider: ${String(provider)}. Supported: ${PROVIDERS.join(', ')}`);
  }
  return generators[provider];
}

module.exports = { generators, PROVIDERS, getGenerator };
