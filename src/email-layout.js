// Shared chrome for every message this site sends (L-09 welcome + the L-20
// sequence). Extracted when the second and third messages arrived: three copies
// of a 600px table layout is how one of them silently stops matching the brand,
// which is exactly the defect the welcome e-mail's plain-text body carried for a
// month ("app Guarda Compartilhada" after the F-54/L-22 rebrand).
//
// Plain tables and inline styles on purpose — no <style> block, no flexbox, no
// external CSS. Outlook and Gmail strip or ignore all three.

export const BRAND = "#03173d";
export const INDIGO = "#4f46e5";
export const INDIGO_DEEP = "#3730a3";
export const INK = "#1e293b";
export const MUTED = "#475569";
export const LINE = "#e6e8ef";
export const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** One emoji + text row. */
export function li(emoji, text) {
  return `<tr>
       <td valign="top" style="padding:6px 10px 6px 0;font-size:18px;line-height:1.5;">${emoji}</td>
       <td valign="top" style="padding:6px 0;font-size:15px;line-height:1.5;color:${MUTED};">${text}</td>
     </tr>`;
}

/** A bulletproof-ish button: a table cell with a background, not a styled <a>. */
export function button(href, label, bg = INDIGO) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
       <td bgcolor="${bg}" style="border-radius:10px;">
         <a href="${href}" style="display:inline-block;padding:14px 26px;font-family:${FONT};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${label}</a>
       </td>
     </tr></table>`;
}

/** Strong text in the body ink, which `li()` rows otherwise render muted. */
export function strong(text) {
  return `<strong style="color:${INK}">${text}</strong>`;
}

/**
 * The footer's way out. `unsubUrl` is null only when KV was unreachable at
 * subscribe time, and then we fall back to the mailto that every message carried
 * before L-20 — never to no way out at all.
 */
export function footerHtml(unsubscribeMailto, unsubUrl) {
  const out = unsubUrl
    ? `<a href="${unsubUrl}" style="color:#94a3b8;text-decoration:underline;">Sair da lista</a>.`
    : `Para sair da lista, é só responder a este e-mail ou escrever para <a href="mailto:${unsubscribeMailto}?subject=descadastro" style="color:#94a3b8;">${unsubscribeMailto}</a>.`;
  return `<p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.55;color:#94a3b8;">Você recebeu este e-mail porque se inscreveu em entrelares.app. ${out}</p>`;
}

/** The same sign-off on every message — one person writes them. */
export const SIGNATURE_HTML = `<p style="margin:0;font-family:${FONT};font-size:15px;line-height:1.6;color:${MUTED};">Um abraço,<br><strong style="color:${INK};">Irineu</strong> — fundador do Entrelares</p>`;

export const SIGNATURE_TEXT = ["Um abraço,", "Irineu — Entrelares"];

/**
 * Wrap message content in the shared shell.
 *
 * @param {string} title      the <title>, which some clients show while loading
 * @param {string} preheader  the grey line the inbox previews beside the subject
 * @param {string} content    one or more <tr> rows, already styled
 * @param {string} footer     the way out, from `footerHtml`
 */
export function shell(title, preheader, content, footer) {
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#eef2ff;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef2ff;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${LINE};font-family:${FONT};">

        <!-- header -->
        <tr><td align="center" bgcolor="${BRAND}" style="background:${BRAND};padding:26px 24px;">
          <div style="font-family:${FONT};font-size:17px;font-weight:700;color:#ffffff;letter-spacing:.01em;">📅 Entrelares</div>
        </td></tr>

${content}

        <!-- signature -->
        <tr><td style="padding:22px 32px 4px;">
          ${SIGNATURE_HTML}
        </td></tr>

        <!-- footer -->
        <tr><td style="padding:20px 32px 30px;">
          <div style="border-top:1px solid ${LINE};padding-top:16px;">
            ${footer}
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;
}

/** The plain-text footer, same two shapes as `footerHtml`. */
export function footerText(unsubscribeMailto, unsubUrl) {
  return [
    "—",
    "Você recebeu este e-mail porque se inscreveu em entrelares.app.",
    unsubUrl
      ? "Para sair da lista, é só abrir: " + unsubUrl
      : "Para sair da lista, é só responder a este e-mail ou escrever para " + unsubscribeMailto + ".",
  ];
}
