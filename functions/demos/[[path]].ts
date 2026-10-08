/** 演示小程序：/demos/<app>/... → R2 的 demo/<app>/...（保留相对路径引用）。 */
interface Env { BUCKET: R2Bucket }

export const onRequest: PagesFunction<Env> = async ({ env, params }) => {
  const segments = Array.isArray(params.path) ? params.path : [params.path ?? ""];
  let path = segments.filter(Boolean).map((segment: string) => decodeURIComponent(segment)).join("/");
  if (path.endsWith("/")) path += "index.html";
  if (!path) path = "index.html";
  const object = await env.BUCKET.get(`demo/${path}`);
  if (!object) return new Response(JSON.stringify({ error: `demo asset not found: ${path}` }), { status: 404, headers: { "content-type": "application/json" } });
  return new Response(object.body, {
    headers: {
      "content-type": object.httpMetadata?.contentType ?? "application/octet-stream",
      "cache-control": "public, max-age=3600",
      "x-content-type-options": "nosniff",
    },
  });
};
