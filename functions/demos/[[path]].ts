/** 演示小程序：/demos/<app>/... → KV 中的 demo/<app>/...（保留相对路径引用）。 */
interface Env { KV: KVNamespace }

export const onRequest: PagesFunction<Env> = async ({ env, params }) => {
  const segments = Array.isArray(params.path) ? params.path : [params.path ?? ""];
  let path = segments.filter(Boolean).map((segment: string) => decodeURIComponent(segment)).join("/");
  if (path.endsWith("/")) path += "index.html";
  if (!path) path = "index.html";
  const { value, metadata } = await env.KV.getWithMetadata<{ contentType?: string }>(`demo/${path}`, { type: "arrayBuffer" });
  if (value === null) {
    return new Response(JSON.stringify({ error: `demo asset not found: ${path}` }), { status: 404, headers: { "content-type": "application/json" } });
  }
  return new Response(value as ArrayBuffer, {
    headers: {
      "content-type": metadata?.contentType ?? "application/octet-stream",
      "cache-control": "public, max-age=3600",
      "x-content-type-options": "nosniff",
    },
  });
};
