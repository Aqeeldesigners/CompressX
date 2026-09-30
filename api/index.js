// Vercel Serverless Function entry point
const app = require('../server');

module.exports = (req, res) => {
  // Normalize URL prefix if stripped by serverless router
  if (req.url && !req.url.startsWith('/api')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }
  return app(req, res);
};
