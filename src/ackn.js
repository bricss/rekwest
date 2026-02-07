import { connect } from 'node:tls';

export const ackn = (options) => new Promise((resolve, reject) => {
  const { url } = options;
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
    socket.off('error', reject);
    socket.off('timeout', reject);

    const { alpnProtocol } = socket;

    resolve({
      ...options,
      alpnProtocol,
      createConnection() {
        return socket;
      },
      h2: /h2c?/i.test(alpnProtocol),
      protocol: url.protocol,
    });
  });

  socket.on('error', reject);
  socket.on('timeout', reject);
});
