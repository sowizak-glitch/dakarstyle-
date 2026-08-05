import http from 'node:http';

const originalWriteHead = http.ServerResponse.prototype.writeHead;
http.ServerResponse.prototype.writeHead = function patchedWriteHead(statusCode, statusMessage, headers) {
  let message = statusMessage;
  let values = headers;
  if (statusMessage && typeof statusMessage === 'object') {
    values = statusMessage;
    message = undefined;
  }
  if (values && typeof values === 'object' && !Array.isArray(values)) {
    values = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined && value !== null));
  }
  return message === undefined
    ? originalWriteHead.call(this, statusCode, values)
    : originalWriteHead.call(this, statusCode, message, values);
};

await import('./senecompare-v5-browser-live.mjs');
