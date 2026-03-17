import { startServer } from "./server.js";
import { resolveOpenclawConfigPath, OpenclawConfigNotFoundError } from "./config-path.js";
export const name = "Bankr Router";
function buildConfigErrorResponse(attemptedPaths) {
    return {
        error: "router_error",
        message: "Could not locate OpenClaw config",
        details: {
            attemptedPaths,
            hint: "Set plugins.entries.bankr-router.config.openclawConfigPath or OPENCLAW_CONFIG_PATH",
        },
    };
}
export default function activate(ctx) {
    const g = globalThis;
    const config = ctx?.config ?? {};
    const explicitPath = config.openclawConfigPath ?? null;
    let resolved;
    try {
        resolved = resolveOpenclawConfigPath({ explicitPath });
    }
    catch {
        resolved = { selectedPath: null, attemptedPaths: [] };
    }
    if (!resolved.selectedPath) {
        console.error("[bankr-router] Failed to locate OpenClaw config");
        return {
            name,
            dispose: () => Promise.resolve(),
            __diagnostics: buildConfigErrorResponse(resolved.attemptedPaths),
        };
    }
    if (!g.__bankrRouterServer) {
        try {
            g.__bankrRouterServer = startServer({
                host: config.host ?? "127.0.0.1",
                port: config.port ?? 8787,
                openclawConfigPath: resolved.selectedPath,
                bankrProviderId: config.bankrProviderId ?? "bankr",
                routerProviderId: config.routerProviderId ?? "bankr-router",
            });
        }
        catch (err) {
            if (err instanceof OpenclawConfigNotFoundError) {
                console.error("[bankr-router] Config not found:", err.attemptedPaths);
                return {
                    name,
                    dispose: () => Promise.resolve(),
                    __diagnostics: buildConfigErrorResponse(err.attemptedPaths),
                };
            }
            throw err;
        }
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
