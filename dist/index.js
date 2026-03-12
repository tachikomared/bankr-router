import { startServer } from "./server.js";
export const name = "Bankr Router";
export default function activate(ctx) {
    const g = globalThis;
    const config = ctx?.config ?? {};
    if (!g.__bankrRouterServer) {
        g.__bankrRouterServer = startServer({
            host: config.host ?? "127.0.0.1",
            port: config.port ?? 8787,
            openclawConfigPath: config.openclawConfigPath ?? "/home/tachiboss/.openclaw/openclaw.json",
            bankrProviderId: config.bankrProviderId ?? "bankr",
            routerProviderId: config.routerProviderId ?? "bankr-router",
        });
    }
    return {
        name,
        dispose: () => {
            return new Promise((resolve, reject) => {
                const server = g.__bankrRouterServer;
                if (!server) {
                    resolve();
                    return;
                }
                server.close((err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    g.__bankrRouterServer = undefined;
                    resolve();
                });
            });
        },
    };
}
