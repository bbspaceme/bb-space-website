import type { IncomingMessage, ServerResponse } from "node:http";
// @ts-expect-error - dist/server/server.js is generated at build time
import serverEntry from "../dist/server/server.js";

function getRequestUrl(req: IncomingMessage) {
  const host = req.headers.host ?? "localhost";
  const protocol = req.headers["x-forwarded-proto"] === "http" ? "http" : "https";
  return `${protocol}://${host}${req.url ?? "/"}`;
}

function setResponseHeaders(res: ServerResponse, response: Response) {
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      const existing = res.getHeader("Set-Cookie");
      if (!existing) {
        res.setHeader("Set-Cookie", value);
      } else {
        res.setHeader("Set-Cookie", ([] as string[]).concat(existing as string[]).concat(value));
      }
    } else {
      res.setHeader(key, value);
    }
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    // Buffer the request body for non-GET/HEAD requests
    let body: BodyInit | undefined = undefined;
    if (req.method !== "GET" && req.method !== "HEAD") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      body = Buffer.concat(chunks);
    }

    const request = new Request(getRequestUrl(req), {
      method: req.method,
      headers: req.headers as HeadersInit,
      body: body,
    });

    const response = await serverEntry.fetch(request, undefined, undefined);
    setResponseHeaders(res, response);
    res.statusCode = response.status;

    const buffer = Buffer.from(await response.arrayBuffer());
    res.end(buffer);
  } catch (error) {
    console.error(error);
    res.statusCode = 500;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end("Internal Server Error");
  }
}
