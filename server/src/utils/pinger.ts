import net from 'node:net';

/**
 * Measures TCP latency to a target host/port.
 * Returns latency in ms, or -1 if unreachable/timeout.
 */
export function measureTcpLatency(host: string, port: number = 443, timeout: number = 2000): Promise<number> {
    return new Promise((resolve) => {
        const start = Date.now();
        const socket = new net.Socket();

        // Timeout handling
        socket.setTimeout(timeout);

        socket.on('connect', () => {
            const latency = Date.now() - start;
            socket.destroy();
            resolve(latency);
        });

        socket.on('timeout', () => {
            socket.destroy();
            resolve(-1);
        });

        socket.on('error', (err) => {
            socket.destroy();
            resolve(-1);
        });

        socket.connect(port, host);
    });
}
