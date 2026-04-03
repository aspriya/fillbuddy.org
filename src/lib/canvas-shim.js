// Empty shim to replace Node.js 'canvas' module in browser builds.
// pdfjs-dist has a require('canvas') in its Node.js canvas factory
// that is never executed in the browser but still needs to resolve.
module.exports = {};
