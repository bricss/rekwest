import { connect } from 'tls';

export const ackn = (opts) => new Promise((resolve, reject) => {
  const { url } = opts;
  const socket = connect({
    ...opts,
    ALPNProtocols: [
      'h2',
      'http/1.1',
    ],
    host: url.hostname,
    port: parseInt(url.port) || 443,
    servername: url.hostname,
  }, () => {
    socket.off('error', reject);
    socket.off('timeout', reject);

    const { alpnProtocol } = socket;

    resolve({
      ...opts,
      alpnProtocol,
      createConnection() {
        return socket;
      },
      h2: /h2c?/.test(alpnProtocol),
      protocol: url.protocol,
    });
  });

  socket.on('error', reject);
  socket.on('timeout', reject);
});
