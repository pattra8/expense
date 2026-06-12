module.exports = {
  extends: ['google'],
  env: {
    node: true,
    es2022: true,
  },
  parserOptions: {
    ecmaVersion: 2022,
  },
  rules: {
    'max-len': ['error', {code: 100, ignoreUrls: true}],
  },
};
