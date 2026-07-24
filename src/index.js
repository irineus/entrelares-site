// Cloudflare Worker for the landing site.
//
// The site is 99% static assets (served by the `ASSETS` binding). This Worker
// adds ONE dynamic endpoint — POST /api/subscribe — for the L-09 lead-magnet /
// newsletter opt-in: it registers the e-mail in a Resend segment (the launch /
// premium-announcement list) and sends the "Modelos de rotina" PDF by e-mail.
//
// Everything that is not /api/subscribe is delegated to the static assets, so
// the existing 404-page handling and asset routing are preserved unchanged.
//
// Config (wrangler.jsonc `vars`, non-secret):
//   RESEND_SEGMENT_ID  — the Resend segment the contact is added to.
//   FROM_EMAIL         — verified-domain sender, e.g. "Guarda Compartilhada <materiais@guardacompartilhada.com>".
//   REPLY_TO           — reply-to address shown to the reader.
// Secret (via `wrangler secret put RESEND_API_KEY` or the Cloudflare dashboard):
//   RESEND_API_KEY     — Resend full-access key. When ABSENT the endpoint runs in
//                        dry-run mode (returns ok without side effects) — this is
//                        how the preview environment behaves unless the key is set.

const RESEND_API = "https://api.resend.com";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/subscribe") {
      return handleSubscribe(request, env, ctx);
    }
    // Not our endpoint → let the static assets answer (keeps 404-page handling).
    return env.ASSETS.fetch(request);
  },
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

async function handleSubscribe(request, env, ctx) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  // Parse a small JSON body defensively.
  let data;
  try {
    const raw = await request.text();
    if (raw.length > 2000) return json({ ok: false, error: "payload_too_large" }, 413);
    data = JSON.parse(raw || "{}");
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  // Honeypot: real users never fill the hidden "empresa" field. Bots do.
  // Pretend success so the bot gets no signal, but do nothing.
  if (data && typeof data.empresa === "string" && data.empresa.trim() !== "") {
    return json({ ok: true });
  }

  const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return json({ ok: false, error: "invalid_email" }, 422);
  }

  // Dry-run when no key is configured (e.g. the preview worker without the secret).
  if (!env.RESEND_API_KEY) {
    console.warn("subscribe: RESEND_API_KEY not set — dry run for", email);
    return json({ ok: true, dryRun: true });
  }

  const authHeaders = {
    Authorization: `Bearer ${env.RESEND_API_KEY}`,
    "Content-Type": "application/json",
  };

  // 1) Add to the Resend segment (the mailing list). A duplicate is fine.
  try {
    const body = { email, unsubscribed: false };
    if (env.RESEND_SEGMENT_ID) body.segment_ids = [env.RESEND_SEGMENT_ID];
    const res = await fetch(`${RESEND_API}/contacts`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(body),
    });
    if (!res.ok && res.status !== 409) {
      const detail = await res.text();
      console.error("subscribe: contact create failed", res.status, detail);
      // Non-fatal for the user if the delivery e-mail still goes out, but a
      // failed list write is the core deliverable — surface it.
      if (res.status >= 500) {
        return json({ ok: false, error: "provider_unavailable" }, 502);
      }
    }
  } catch (err) {
    console.error("subscribe: contact create threw", err);
    return json({ ok: false, error: "provider_unavailable" }, 502);
  }

  // 2) Send the lead-magnet e-mail with the PDF link. Link to the same origin
  //    the request came from (prod → prod, preview → preview).
  const origin = new URL(request.url).origin;
  const pdfUrl = `${origin}/downloads/modelos-rotina-guarda-compartilhada.pdf`;
  const from = env.FROM_EMAIL || "Guarda Compartilhada <materiais@guardacompartilhada.com>";
  const replyTo = env.REPLY_TO || "contato@guardacompartilhada.com";
  const unsubscribe = "privacidade@guardacompartilhada.com";

  try {
    const res = await fetch(`${RESEND_API}/emails`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        from,
        to: [email],
        reply_to: replyTo,
        subject: "Seus modelos de rotina de guarda compartilhada 📅",
        headers: {
          "List-Unsubscribe": `<mailto:${unsubscribe}?subject=descadastro>`,
        },
        text: emailText(pdfUrl, unsubscribe),
        html: emailHtml(pdfUrl, unsubscribe),
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error("subscribe: email send failed", res.status, detail);
      // The contact was already saved; report a partial success so the UI can
      // still thank the user (they are on the list; the e-mail can be retried).
      return json({ ok: true, emailQueued: false });
    }
  } catch (err) {
    console.error("subscribe: email send threw", err);
    return json({ ok: true, emailQueued: false });
  }

  return json({ ok: true, emailQueued: true });
}

function emailText(pdfUrl, unsubscribe) {
  return [
    "Olá!",
    "",
    "Obrigado por se inscrever. Aqui está o material que você pediu:",
    "",
    "Modelos de rotina de guarda compartilhada (PDF):",
    pdfUrl,
    "",
    "São 5 modelos comuns (semana sim/semana não, quinzenal, 2-2-3, 2-2-5-5 e",
    "fins de semana alternados), com um guia visual de duas semanas para cada um,",
    "além de um roteiro para férias e feriados.",
    "",
    "Quando escolher a rotina de vocês, você pode montá-la no app — grátis — em",
    "https://guardacompartilhada.com. Cada troca de dia passa a ter a aprovação",
    "dos dois responsáveis, registrada com data e hora.",
    "",
    "Um abraço,",
    "Equipe Guarda Compartilhada",
    "",
    "—",
    `Você recebeu este e-mail porque se inscreveu em guardacompartilhada.com. Para sair da lista, escreva para ${unsubscribe}.`,
  ].join("\n");
}

function emailHtml(pdfUrl, unsubscribe) {
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#1e293b;">
  <div style="max-width:560px;margin:0 auto;padding:28px 20px;">
    <div style="font-weight:700;font-size:16px;color:#3730a3;margin-bottom:20px;">Guarda Compartilhada</div>
    <h1 style="font-size:22px;line-height:1.25;margin:0 0 14px;color:#1e293b;">Seus modelos de rotina chegaram 📅</h1>
    <p style="font-size:15px;line-height:1.6;color:#475569;margin:0 0 18px;">Obrigado por se inscrever! Preparamos um guia com <strong>5 modelos comuns de rotina</strong> — semana sim/semana não, quinzenal, 2-2-3, 2-2-5-5 e fins de semana alternados — cada um com um calendário visual de duas semanas, além de um roteiro para férias e feriados.</p>
    <p style="margin:0 0 26px;">
      <a href="${pdfUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 22px;border-radius:10px;">Baixar o PDF dos modelos →</a>
    </p>
    <p style="font-size:15px;line-height:1.6;color:#475569;margin:0 0 18px;">Quando vocês escolherem a rotina, é só colocá-la no app — grátis. Cada troca de dia passa a ter a aprovação dos dois responsáveis, registrada com data e hora: menos discussão, mais previsibilidade para os filhos.</p>
    <p style="margin:0 0 28px;">
      <a href="https://guardacompartilhada.com/" style="color:#4f46e5;font-weight:600;font-size:15px;text-decoration:none;">Conhecer o app &rarr;</a>
    </p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
    <p style="font-size:12px;line-height:1.5;color:#94a3b8;margin:0;">Você recebeu este e-mail porque se inscreveu em guardacompartilhada.com. Para sair da lista, escreva para <a href="mailto:${unsubscribe}?subject=descadastro" style="color:#94a3b8;">${unsubscribe}</a>.</p>
  </div>
</body></html>`;
}
