/* L-09 — lead-magnet / newsletter opt-in handler.
   Attaches to every <form class="lm-form"> on the page (index + blog). Posts the
   e-mail as JSON to /api/subscribe (the Cloudflare Worker), which registers the
   contact in Resend and sends the "Modelos de rotina" PDF. No dependencies. */
(function () {
  "use strict";
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function track(name) {
    try { if (window.umami && typeof window.umami.track === "function") window.umami.track(name); }
    catch (e) { /* analytics is best-effort */ }
  }

  function setStatus(el, kind, msg) {
    if (!el) return;
    el.textContent = msg;
    el.className = "lm-status is-shown is-" + kind;
  }

  function attach(form) {
    var input = form.querySelector('input[type="email"]');
    var hp = form.querySelector('.lm-hp input');
    var btn = form.querySelector('.lm-btn');
    var status = form.querySelector('.lm-status');
    if (!input || !btn) return;
    var btnLabel = btn.textContent;

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var email = (input.value || "").trim();
      if (!EMAIL_RE.test(email)) {
        setStatus(status, "err", "Digite um e-mail válido para receber os modelos.");
        input.focus();
        return;
      }

      btn.disabled = true;
      btn.textContent = "Enviando…";
      setStatus(status, "ok", "");
      if (status) status.className = "lm-status";

      fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email, empresa: hp ? hp.value : "" })
      })
        .then(function (res) { return res.json().catch(function () { return { ok: res.ok }; }); })
        .then(function (data) {
          if (data && data.ok) {
            track("lead-magnet-subscribe");
            form.classList.add("is-done");
            setStatus(
              status,
              "ok",
              "Pronto! Enviamos os modelos para " + email + ". Confira sua caixa de entrada (e o spam, por via das dúvidas)."
            );
          } else {
            var msg = data && data.error === "invalid_email"
              ? "Esse e-mail não parece válido. Confira e tente de novo."
              : "Não consegui enviar agora. Tente novamente em instantes.";
            setStatus(status, "err", msg);
            btn.disabled = false;
            btn.textContent = btnLabel;
          }
        })
        .catch(function () {
          setStatus(status, "err", "Falha de conexão. Verifique a internet e tente novamente.");
          btn.disabled = false;
          btn.textContent = btnLabel;
        });
    });
  }

  function init() {
    var forms = document.querySelectorAll("form.lm-form");
    for (var i = 0; i < forms.length; i++) attach(forms[i]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
