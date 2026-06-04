import { connect } from 'node:tls';
import { RequestError } from './errors.js';

export const ackn = (options = {}) => new Promise((resolve, reject) => {
  const url = new URL(options.url);
  const socket = connect({
    ...options,
    ALPNProtocols: [
      'h2',
      'http/1.1',
    ],
    host: url.hostname,
    port: parseInt(url.port, 10) || 443,
    servername: url.hostname,
  }, () => {
    const cert = socket.getPeerCertificate();

    if (options.certPins?.length) {
      const fp = cert.fingerprint256;

      if (!options.certPins.includes(fp) && !socket.isSessionReused()) {
        socket.destroy();

        return reject(new RequestError(`Certificate pins mismatch for ${ url.hostname }`));
      }
    }

    socket.off('error', reject);
    socket.off('timeout', reject);

    const { alpnProtocol } = socket;

    resolve({
      ...options,
      alpnProtocol,
      createConnection() {
        return socket;
      },
      h2: /\bh2\b/i.test(alpnProtocol),
      protocol: url.protocol,
    });
  });

  socket.once('error', reject);
  socket.once('timeout', reject);
});
