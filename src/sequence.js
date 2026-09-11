// L-20 — the e-mail sequence that follows the L-09 material.
//
// WHAT THE MEASUREMENT SAID, because it changed the item (11/09/2026):
//
//   · The audience is ZERO. The Resend account holds two contacts, both the
//     owner's own addresses, both created 24/07/2026 — the day the segment was
//     made. Nobody has opted in since. So this code sends nothing today, and
//     that is fine: it is the machinery waiting for the traffic T-59 brings.
//   · The quota is NOT what blocks. 30 days to 11/09: 154 sends, median ~3/day,
//     peak 59. The free plan allows 100/day. What the card feared — a 429 on a
//     sign-up confirmation because marketing ate the allowance — is real but
//     lives in T-67, and it arrives with the users, not with this file.
//   · The consent purpose was ALREADY announced. Every opt-in form says
//     "Enviamos o material e novidades ocasionais do app", policy §3 declares
//     the address is processed for "materiais ... ou novidades do Serviço" and
//     §4 gives the legal basis for exactly that. The card feared this would
//     cost a PolicyVersions bump; checking the copy against the code said no.
//
// So the two things this file must never get wrong are the two SAFETY
// properties, both enforceable here rather than at the provider:
//
//   1. the STOP — nobody who asked to leave gets another message;
//   2. the CAP  — the sequence can never eat the transactional allowance that a
//      real person's sign-up confirmation or password reset depends on.

import {
  button,
  footerHtml,
  footerText,
  INDIGO_DEEP,
  INK,
  LINE,
  li,
  MUTED,
  FONT,
  shell,
  SIGNATURE_TEXT,
  strong,
} from "./email-layout.js";

/**
 * The most sequence e-mails that may leave in one UTC day, across everybody.
 *
 * Deliberately far below the 100/day account allowance, because the allowance
 * is SHARED: this Worker, both Supabase projects' Edge Functions, both
 * projects' GoTrue SMTP — and, since 02/09/2026, a second product entirely
 * (gestaoim360.com is verified on the same account). A drip that runs out of a
 * shared bucket must leave the bucket mostly full for the messages a person is
 * waiting on with a form open in front of them.
 *
 * Nothing is lost when the cap bites: a step that does not go today is still
 * due tomorrow, because the state records WHICH steps were sent, never when the
 * cron last ran.
 */
export const DAILY_CAP = 20;

/**
 * Day 1 is the welcome e-mail, sent synchronously by `handleSubscribe` — it is
 * the thing the person actually asked for and must not wait for a cron.
 * Steps 2 and 3 are these.
 */
export const SEQUENCE = [
  {
    step: 2,
    afterDays: 2, // day 3, counting the opt-in as day 1
    subject: "Férias e feriados: a parte que a rotina não resolve sozinha",
  },
  {
    step: 3,
    afterDays: 4, // day 5
    subject: "Onde a rotina combinada deixa de ser um papel",
  },
];

export const LAST_STEP = SEQUENCE[SEQUENCE.length - 1].step;

/** Whole days elapsed between two instants. */
export function daysBetween(fromIso, now) {
  const from = Date.parse(fromIso);
  if (Number.isNaN(from)) return NaN;
  return Math.floor((now.getTime() - from) / 86400000);
}

/**
 * Which step, if any, is due for this subscriber right now.
 *
 * Pure, so the scheduling rule is testable without a clock, a network or a KV.
 * Returns null when nothing is due — including for state we cannot read, which
 * is the fail-closed reading: a corrupt record sends nothing rather than
 * sending everything.
 */
export function dueStep(state, now) {
  if (!state || typeof state.startedAt !== "string") return null;
  const lastSent = Number.isInteger(state.lastStep) ? state.lastStep : 1;
  if (lastSent >= LAST_STEP) return null;

  const age = daysBetween(state.startedAt, now);
  if (Number.isNaN(age) || age < 0) return null;

  // Strictly the next one: somebody whose day 5 arrives while day 3 was never
  // sent (the cap bit, or the Worker was down) gets step 2 today and step 3
  // tomorrow. Two messages in one morning reads as a malfunction.
  const next = SEQUENCE.find((s) => s.step === lastSent + 1);
  if (!next) return null;
  return age >= next.afterDays ? next : null;
}

/** True once the subscriber has received everything the sequence has. */
export function isFinished(state) {
  return Number.isInteger(state?.lastStep) && state.lastStep >= LAST_STEP;
}

// ── the messages ────────────────────────────────────────────────────────────

/**
 * Step 2 — the tip. Content, not a pitch: it earns the third message.
 *
 * Every factual claim here is about the PDF the person already has, or about
 * the app's own behaviour (`handoff_time` on a transition day, the two-party
 * approval), never about a screen I have not checked.
 */
function step2(ctx) {
  const content = `
        <tr><td style="padding:32px 32px 8px;">
          <h1 style="margin:0 0 12px;font-family:${FONT};font-size:23px;line-height:1.3;color:${INK};">A rotina resolve as semanas. E dezembro?</h1>
          <p style="margin:0 0 18px;font-family:${FONT};font-size:15px;line-height:1.65;color:${MUTED};">Quase todo acordo de convivência funciona bem até a primeira data que não cabe no padrão — as férias escolares, o Natal, o aniversário da criança. É ali que a rotina combinada costuma virar discussão.</p>
          <p style="margin:0 0 6px;font-family:${FONT};font-size:15px;line-height:1.65;color:${MUTED};">Três combinados que evitam a maior parte dos atritos:</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            ${li("🎄", `${strong("Alterne os anos, não os dias")} — quem fica com o Natal neste ano fica com o Ano-Novo, e no ano seguinte troca. É mais fácil de lembrar do que dividir a mesma data.`)}
            ${li("🗓️", `${strong("Decida as férias com meses de antecedência")} — e por escrito. A conversa em janeiro é sobre logística; em dezembro, é sobre quem cedeu da última vez.`)}
            ${li("⏰", `${strong("Combine o horário da troca, não só o dia")} — "domingo" vira três horários diferentes na cabeça de duas pessoas. O guia traz um roteiro pronto para isso.`)}
          </table>
        </td></tr>

        <tr><td style="padding:22px 32px 0;">
          <p style="margin:0;font-family:${FONT};font-size:15px;line-height:1.65;color:${MUTED};">No app, o horário de troca fica registrado no próprio dia da virada — então não depende de ninguém lembrar o que foi combinado por mensagem.</p>
        </td></tr>`;

  const text = [
    "A rotina resolve as semanas. E dezembro?",
    "",
    "Quase todo acordo de convivência funciona bem até a primeira data que",
    "não cabe no padrão — as férias escolares, o Natal, o aniversário da",
    "criança. É ali que a rotina combinada costuma virar discussão.",
    "",
    "Três combinados que evitam a maior parte dos atritos:",
    "",
    "  - Alterne os anos, não os dias: quem fica com o Natal neste ano fica",
    "    com o Ano-Novo, e no ano seguinte troca.",
    "  - Decida as férias com meses de antecedência, e por escrito. A conversa",
    "    em janeiro é sobre logística; em dezembro, é sobre quem cedeu da",
    "    última vez.",
    '  - Combine o horário da troca, não só o dia: "domingo" vira três',
    "    horários diferentes na cabeça de duas pessoas.",
    "",
    "No app, o horário de troca fica registrado no próprio dia da virada —",
    "então não depende de ninguém lembrar o que foi combinado por mensagem.",
    "",
    ...SIGNATURE_TEXT,
    "",
    ...footerText(ctx.unsubscribeMailto, ctx.unsubUrl),
  ].join("\n");

  return {
    html: shell(
      "Férias e feriados",
      "Três combinados que evitam a maior parte dos atritos de fim de ano.",
      content,
      footerHtml(ctx.unsubscribeMailto, ctx.unsubUrl),
    ),
    text,
  };
}

/**
 * Step 3 — the invitation.
 *
 * Written for BOTH readers on purpose (owner's call, 11/09/2026): the landing
 * cannot know whether this person already created an account, and finding out
 * would mean handing the marketing site a credential to the product's database
 * — a privilege it does not have and should not get. So the copy is true and
 * useful either way instead of pretending to know.
 */
function step3(ctx) {
  const content = `
        <tr><td style="padding:32px 32px 8px;">
          <h1 style="margin:0 0 12px;font-family:${FONT};font-size:23px;line-height:1.3;color:${INK};">Do papel para um lugar que os dois enxergam</h1>
          <p style="margin:0 0 18px;font-family:${FONT};font-size:15px;line-height:1.65;color:${MUTED};">Um acordo de convivência só funciona enquanto as duas pessoas lembram dele do mesmo jeito. É por isso que o Entrelares existe: o calendário fica num lugar só, igual para os dois responsáveis.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            ${li("📅", `De quem é o dia, ${strong("sempre à vista")} — sem conferir conversa antiga`)}
            ${li("🤝", `Trocas de dia só valem com a ${strong("aprovação dos dois")}`)}
            ${li("📜", `Histórico com data e hora, que ${strong("não pode ser editado nem apagado")}`)}
          </table>
          <div style="padding:24px 0 28px;">${button(ctx.appUrl, "Abrir o Entrelares", INDIGO_DEEP)}</div>
        </td></tr>

        <!-- the other reader: somebody who already signed up -->
        <tr><td style="padding:0 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border:1px solid ${LINE};border-radius:12px;">
            <tr><td style="padding:18px 20px;">
              <p style="margin:0;font-family:${FONT};font-size:14px;line-height:1.6;color:${MUTED};"><strong style="color:${INK};">Já criou a sua conta?</strong> Então este é o atalho: o próximo passo é convidar o outro responsável — é com as duas contas que a aprovação mútua das trocas passa a valer.</p>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:22px 32px 0;">
          <p style="margin:0;font-family:${FONT};font-size:13.5px;line-height:1.6;color:#94a3b8;">Este é o último e-mail desta série. Se quiser continuar recebendo os materiais, não precisa fazer nada.</p>
        </td></tr>`;

  const text = [
    "Do papel para um lugar que os dois enxergam",
    "",
    "Um acordo de convivência só funciona enquanto as duas pessoas lembram",
    "dele do mesmo jeito. É por isso que o Entrelares existe: o calendário",
    "fica num lugar só, igual para os dois responsáveis.",
    "",
    "  - De quem é o dia, sempre à vista — sem conferir conversa antiga;",
    "  - trocas de dia só valem com a aprovação dos dois;",
    "  - histórico com data e hora, que não pode ser editado nem apagado.",
    "",
    "Abrir o Entrelares: " + ctx.appUrl,
    "",
    "Já criou a sua conta? Então este é o atalho: o próximo passo é convidar",
    "o outro responsável — é com as duas contas que a aprovação mútua das",
    "trocas passa a valer.",
    "",
    "Este é o último e-mail desta série. Se quiser continuar recebendo os",
    "materiais, não precisa fazer nada.",
    "",
    ...SIGNATURE_TEXT,
    "",
    ...footerText(ctx.unsubscribeMailto, ctx.unsubUrl),
  ].join("\n");

  return {
    html: shell(
      "Do papel para um lugar que os dois enxergam",
      "O calendário num lugar só, igual para os dois responsáveis.",
      content,
      footerHtml(ctx.unsubscribeMailto, ctx.unsubUrl),
    ),
    text,
  };
}

const BUILDERS = { 2: step2, 3: step3 };

/** Render one step. Throws for an unknown step rather than sending an empty e-mail. */
export function renderStep(step, ctx) {
  const build = BUILDERS[step];
  if (!build) throw new Error(`sequence: no message for step ${step}`);
  const { html, text } = build(ctx);
  const meta = SEQUENCE.find((s) => s.step === step);
  return { subject: meta.subject, html, text };
}
