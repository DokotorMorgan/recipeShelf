import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { networkInterfaces } from "node:os";

const root = path.resolve("public");
const port = Number(process.env.PORT || 5174);
const host = process.env.HOST || "0.0.0.0";

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};

function localAddresses() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((item) => item && item.family === "IPv4" && !item.internal)
    .map((item) => item.address);
}

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const requestPath = decoded === "/" ? "/index.html" : decoded;
  const fullPath = path.resolve(root, `.${requestPath}`);
  if (!fullPath.startsWith(root)) return null;
  return fullPath;
}

const server = createServer(async (req, res) => {
  const filePath = safePath(req.url || "/");
  if (!filePath) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error("Not a file");
    res.writeHead(200, {
      "content-type": types[path.extname(filePath)] || "application/octet-stream",
      "cache-control": "no-store"
    });
    createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use.`);
    console.error(`Stop the existing server or run with another port, for example:`);
    console.error(`PORT=5175 npm start`);
    process.exit(1);
  }

  throw error;
});

server.listen(port, host, () => {
  console.log(`Recipe Shelf listening on ${host}:${port}`);
  console.log(`Local URL: http://127.0.0.1:${port}`);
  for (const address of localAddresses()) {
    console.log(`WSL URL: http://${address}:${port}`);
  }
  console.log("For phone access from WSL, use the Windows LAN IP and allow/forward this port if needed.");
});
