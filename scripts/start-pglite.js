const { PGlite } = require('@electric-sql/pglite');
const { PGLiteSocketServer } = require('@electric-sql/pglite-socket');

function isConnectionReset(error) {
    return error && (error.code === 'ECONNRESET' || error.syscall === 'read');
}

process.on('uncaughtException', (error) => {
    if (isConnectionReset(error)) {
        console.warn('Ignoring transient socket reset from local PGlite client');
        return;
    }

    console.error('Unhandled exception from local PGlite server:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    if (isConnectionReset(reason)) {
        console.warn('Ignoring transient socket reset from local PGlite client');
        return;
    }

    console.error('Unhandled rejection from local PGlite server:', reason);
    process.exit(1);
});

async function main() {
    const db = new PGlite('./.local_pg');
    const server = new PGLiteSocketServer({ db, port: 5432, host: '127.0.0.1' });

    server.addEventListener('error', (event) => {
        console.error('Socket server error:', event.detail);
    });

    await server.start();
    console.log('PGLite server listening on port 5432');
}
main().catch((error) => {
    console.error('Failed to start local PGLite server:', error);
    process.exit(1);
});