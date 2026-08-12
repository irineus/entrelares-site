// Cloudflare Worker for the landing site.
//
// The site is 99% static assets (served by the `ASSETS` binding). This Worker
// adds ONE dynamic endpoint — POST /api/subscribe — for the L-09 materials /
// newsletter opt-in: it registers the e-mail in a Resend segment (the launch /
// premium-announcement list) and sends the "Modelos de rotina" PDF by e-mail.
//
// Everything that is not /api/subscribe is delegated to the static assets, so
// the existing 404-page handling and asset routing are preserved unchanged.
//
// Config (wrangler.jsonc `vars`, non-secret):
//   RESEND_SEGMENT_ID  — the Resend segment the contact is added to.
//   FROM_EMAIL         — verified-domain sender: "Entrelares <materiais@entrelares.app>"
//                        (flipped at the F-54 promotion-A cutover, 12/08/2026 — the Resend
//                        Free plan verifies ONE domain, so the old one was deleted first).
//   REPLY_TO           — reply-to address shown to the reader.
// Secret (via `wrangler secret put RESEND_API_KEY` or the Cloudflare dashboard):
//   RESEND_API_KEY     — Resend full-access key. When ABSENT the endpoint runs in
//                        dry-run mode (returns ok without side effects) — this is
//                        how the preview environment behaves unless the key is set.
// KV binding:
//   OPTIN_LOG          — S-15/C-6: the opt-in evidence log (date, time, IP). The
//                        legal review accepted plain opt-in for the newsletter
//                        ONLY on condition that this log is kept, so it is written
//                        even in dry-run: the consent happened when the form was
//                        submitted, regardless of whether the e-mail went out.

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

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

// ── Pure request-shape helpers (exported for unit tests) ────────────────────

/** Honeypot: real users never fill the hidden "empresa" field; bots do. */
export function isHoneypot(data) {
  return !!(data && typeof data.empresa === "string" && data.empresa.trim() !== "");
}

/** The submitted e-mail, trimmed + lower-cased; "" when absent or not a string. */
export function normalizeEmail(data) {
  return data && typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
}

/** A normalized e-mail is acceptable when non-empty, ≤254 chars, and matches the shape. */
export function isValidEmail(email) {
  return !!email && email.length <= 254 && EMAIL_RE.test(email);
}

/**
 * S-15/C-6 — record the opt-in as evidence (date, time, IP), as the legal review
 * required in exchange for accepting simple opt-in as the consent mechanism.
 *
 * One key per submission (`optin:<email>:<iso>`), never one per e-mail: a person
 * who subscribes, unsubscribes and subscribes again performed TWO acts of consent,
 * and overwriting would destroy the evidence for the first. No expiration — proof
 * of consent has to outlive the contact it justifies.
 *
 * Best-effort by design. If KV is unavailable we log and continue: refusing the
 * material because the audit write failed would punish the user for our outage.
 * It runs BEFORE the Resend calls, so a send failure still leaves the record.
 */
export async function logOptIn(env, email, request) {
  if (!env.OPTIN_LOG) {
    console.warn("subscribe: OPTIN_LOG binding missing — opt-in not recorded for", email);
    return false;
  }
  const ts = new Date().toISOString();
  try {
    await env.OPTIN_LOG.put(`optin:${email}:${ts}`, JSON.stringify({
      email,
      ts,
      // CF-Connecting-IP is set by the edge and cannot be spoofed by the client.
      ip: request.headers.get("CF-Connecting-IP") ?? null,
      userAgent: request.headers.get("User-Agent") ?? null,
      origin: new URL(request.url).origin,
      source: "materiais",
    }));
    return true;
  } catch (err) {
    console.error("subscribe: opt-in log write failed", err);
    return false;
  }
}

export async function handleSubscribe(request, env, ctx) {
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

  // Honeypot: pretend success so the bot gets no signal, but do nothing.
  if (isHoneypot(data)) {
    return json({ ok: true });
  }

  const email = normalizeEmail(data);
  if (!isValidEmail(email)) {
    return json({ ok: false, error: "invalid_email" }, 422);
  }

  // S-15/C-6: the consent happened HERE, at a valid submission. Recorded before
  // any provider call so the evidence survives a Resend failure — and recorded in
  // dry-run too, where the act is just as real even though no e-mail is sent.
  await logOptIn(env, email, request);

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

  // 2) Send the welcome e-mail with the PDF link. Link to the same origin
  //    the request came from (prod → prod, preview → preview).
  const origin = new URL(request.url).origin;
  const pdfUrl = `${origin}/downloads/modelos-rotina-guarda-compartilhada.pdf`;
  const from = env.FROM_EMAIL || "Entrelares <materiais@entrelares.app>";
  const replyTo = env.REPLY_TO || "contato@entrelares.app";
  const unsubscribe = "privacidade@entrelares.app";

  try {
    const res = await fetch(`${RESEND_API}/emails`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        from,
        to: [email],
        reply_to: replyTo,
        subject: "Seu guia de rotinas de guarda compartilhada 🎉",
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
    "Que bom ter você por aqui :)",
    "",
    "Organizar a convivência dos filhos depois da separação é um dos maiores",
    "desafios do dia a dia. Preparamos um guia para ajudar você e o outro",
    "responsável a começar essa conversa a partir de exemplos claros.",
    "",
    "Baixe o guia (PDF): " + pdfUrl,
    "",
    "O que você vai encontrar:",
    "  - 5 modelos de rotina prontos, das semanas alternadas às opções para",
    "    crianças pequenas;",
    "  - um calendário visual de duas semanas para cada modelo;",
    "  - os prós e contras de cada rotina, em linguagem simples;",
    "  - um roteiro para combinar férias, feriados e datas especiais.",
    "",
    "E quando vocês escolherem a rotina, é só colocá-la no app Guarda",
    "Compartilhada — grátis. Ele mantém o calendário num lugar só, igual para",
    "os dois responsáveis:",
    "  - de quem é o dia, sempre à vista;",
    "  - trocas de dia com a aprovação dos dois;",
    "  - histórico com data e hora, que não pode ser editado nem apagado.",
    "",
    "Conheça o app: https://entrelares.app/",
    "",
    "Um abraço,",
    "Irineu — Entrelares",
    "",
    "—",
    "Você recebeu este e-mail porque se inscreveu em entrelares.app.",
    "Para sair da lista, é só responder a este e-mail ou escrever para " + unsubscribe + ".",
  ].join("\n");
}

function emailHtml(pdfUrl, unsubscribe) {
  const brand = "#03173d", indigo = "#4f46e5", indigoDeep = "#3730a3";
  const ink = "#1e293b", muted = "#475569", line = "#e6e8ef";
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const li = (emoji, text) =>
    `<tr>
       <td valign="top" style="padding:6px 10px 6px 0;font-size:18px;line-height:1.5;">${emoji}</td>
       <td valign="top" style="padding:6px 0;font-size:15px;line-height:1.5;color:${muted};">${text}</td>
     </tr>`;
  const button = (href, label, bg) =>
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
       <td bgcolor="${bg}" style="border-radius:10px;">
         <a href="${href}" style="display:inline-block;padding:14px 26px;font-family:${font};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${label}</a>
       </td>
     </tr></table>`;

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Seu guia de rotinas de guarda compartilhada</title></head>
<body style="margin:0;padding:0;background:#eef2ff;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Seu guia com 5 modelos de rotina — e como dar mais previsibilidade para os filhos.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef2ff;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${line};font-family:${font};">

        <!-- header -->
        <tr><td align="center" bgcolor="${brand}" style="background:${brand};padding:26px 24px;">
          <div style="font-family:${font};font-size:17px;font-weight:700;color:#ffffff;letter-spacing:.01em;">📅 Entrelares</div>
        </td></tr>

        <!-- hero -->
        <tr><td style="padding:32px 32px 8px;">
          <h1 style="margin:0 0 12px;font-family:${font};font-size:23px;line-height:1.3;color:${ink};">Prontinho — aqui está o seu guia 🎉</h1>
          <p style="margin:0 0 20px;font-family:${font};font-size:15px;line-height:1.65;color:${muted};">Que bom ter você por aqui. Organizar a convivência dos filhos depois da separação é um dos maiores desafios do dia a dia — e este guia é um bom ponto de partida para vocês combinarem a rotina a partir de exemplos claros.</p>
        </td></tr>

        <!-- download card -->
        <tr><td style="padding:0 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f7ff;border:1px solid #e0e7ff;border-radius:12px;">
            <tr><td style="padding:22px 22px 24px;">
              <div style="font-family:${font};font-size:16px;font-weight:700;color:${ink};margin-bottom:6px;">📘 Modelos de rotina de guarda compartilhada</div>
              <p style="margin:0 0 18px;font-family:${font};font-size:14px;line-height:1.6;color:${muted};">Um guia visual com as formas mais comuns de dividir os dias — e um roteiro para férias e feriados.</p>
              ${button(pdfUrl, "Baixar o guia (PDF)", indigo)}
            </td></tr>
          </table>
        </td></tr>

        <!-- what's inside -->
        <tr><td style="padding:26px 32px 6px;">
          <div style="font-family:${font};font-size:15px;font-weight:700;color:${ink};margin-bottom:6px;">O que você vai encontrar</div>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            ${li("🗓️", "<strong style=\"color:" + ink + "\">5 modelos prontos</strong> — das semanas alternadas às opções para crianças pequenas")}
            ${li("👀", "Um <strong style=\"color:" + ink + "\">calendário visual de duas semanas</strong> para cada modelo")}
            ${li("⚖️", "Os <strong style=\"color:" + ink + "\">prós e contras</strong> de cada rotina, em linguagem simples")}
            ${li("🏖️", "Um roteiro para combinar <strong style=\"color:" + ink + "\">férias, feriados e datas especiais</strong>")}
          </table>
        </td></tr>

        <!-- app intro -->
        <tr><td style="padding:14px 20px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border-top:1px solid ${line};border-radius:0 0 4px 4px;">
            <tr><td style="padding:26px 12px 4px;">
              <h2 style="margin:0 0 8px;font-family:${font};font-size:18px;line-height:1.35;color:${ink};">E quando vocês escolherem a rotina?</h2>
              <p style="margin:0 0 14px;font-family:${font};font-size:14.5px;line-height:1.6;color:${muted};">Coloque-a no app Entrelares — grátis. Ele mantém o calendário num lugar só, igual para os dois responsáveis:</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                ${li("📅", "De quem é o dia, <strong style=\"color:" + ink + "\">sempre à vista</strong>")}
                ${li("🤝", "Trocas de dia só valem com a <strong style=\"color:" + ink + "\">aprovação dos dois</strong>")}
                ${li("📜", "Histórico com data e hora, que <strong style=\"color:" + ink + "\">não pode ser editado nem apagado</strong>")}
              </table>
              <div style="padding:18px 0 4px;">${button("https://entrelares.app/", "Conhecer o app", indigoDeep)}</div>
            </td></tr>
          </table>
        </td></tr>

        <!-- signature -->
        <tr><td style="padding:22px 32px 4px;">
          <p style="margin:0;font-family:${font};font-size:15px;line-height:1.6;color:${muted};">Um abraço,<br><strong style="color:${ink};">Irineu</strong> — fundador do Entrelares</p>
        </td></tr>

        <!-- footer -->
        <tr><td style="padding:20px 32px 30px;">
          <div style="border-top:1px solid ${line};padding-top:16px;">
            <p style="margin:0;font-family:${font};font-size:12px;line-height:1.55;color:#94a3b8;">Você recebeu este e-mail porque se inscreveu em entrelares.app. Para sair da lista, é só responder a este e-mail ou escrever para <a href="mailto:${unsubscribe}?subject=descadastro" style="color:#94a3b8;">${unsubscribe}</a>.</p>
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;
}
