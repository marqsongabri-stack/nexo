// Nexo — servidor de avisos
// Roda a cada minuto (agendado pelo pg_cron) e manda notificação push
// dos afazeres cujo horário de aviso chegou, para todos os aparelhos do usuário.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

Deno.serve(async (req) => {
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) return json({ error: "não autorizado" }, 401);

  // Chave de administrador: formato novo (SUPABASE_SECRET_KEYS) ou antigo (SERVICE_ROLE)
  let adminKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    adminKey = keys["default"] ?? Object.values(keys)[0] ?? adminKey;
  } catch (_) { /* usa a antiga */ }
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, adminKey as string, {
    auth: { persistSession: false },
  });
  webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT") ?? "https://github.com/marqsongabri-stack/nexo",
    Deno.env.get("VAPID_PUBLIC_KEY")!,
    Deno.env.get("VAPID_PRIVATE_KEY")!,
  );

  const now = new Date();
  const since = new Date(now.getTime() - 6 * 3600e3); // não manda avisos com mais de 6h de atraso
  const { data: tasks, error } = await sb
    .from("tasks")
    .select("user_id,id,title,time,notes")
    .eq("done", false)
    .eq("notified", false)
    .lte("notify_at", now.toISOString())
    .gte("notify_at", since.toISOString())
    .limit(200);
  if (error) return json({ error: error.message }, 500);

  let sent = 0;
  const subsCache = new Map<string, { endpoint: string; p256dh: string; auth: string }[]>();
  for (const t of tasks ?? []) {
    if (!subsCache.has(t.user_id)) {
      const { data } = await sb.from("push_subscriptions").select("endpoint,p256dh,auth").eq("user_id", t.user_id);
      subsCache.set(t.user_id, data ?? []);
    }
    const payload = JSON.stringify({
      title: "⏰ " + t.title,
      body: (t.time ? "Marcado para " + t.time : "Para hoje") + (t.notes ? " · " + t.notes : ""),
      tag: t.id,
      url: "./#afazeres",
    });
    for (const s of subsCache.get(t.user_id)!) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600 });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await sb.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      }
    }
    await sb.from("tasks").update({ notified: true }).eq("user_id", t.user_id).eq("id", t.id);
  }

  // Avisos que passaram de 6h sem serem enviados: marca como resolvidos
  await sb.from("tasks").update({ notified: true }).eq("notified", false).lt("notify_at", since.toISOString());

  return json({ tasks: tasks?.length ?? 0, sent });
});
