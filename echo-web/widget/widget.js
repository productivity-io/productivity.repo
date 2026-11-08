(() => {
  "use strict";
  const script = document.currentScript;
  if (script?.dataset.cancelled === "true") return;
  const site = script?.dataset.site;
  if (!site || !/^[a-z][a-z0-9-]{1,62}$/.test(site)) return;
  const api = new URL(script.dataset.api || ".", script.src).href.replace(/\/$/, "");
  if (!/^https?:$/.test(new URL(api).protocol)) return;
  const endpoint = `${api}/v1/sites/${encodeURIComponent(site)}`;
  const host = document.createElement("echo-chat-widget");
  host.dataset.site = site;
  host.dataset.instance = script.dataset.instance || "";
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  if (script.nonce) style.nonce = script.nonce;
  style.textContent = `
    :host{all:initial;--accent:#167089;font:15px/1.5 system-ui,sans-serif;color:#172832}
    *{box-sizing:border-box}button,textarea{font:inherit}button{cursor:pointer}button:disabled{cursor:wait;opacity:.55}
    button:focus-visible,textarea:focus-visible{outline:3px solid #f1ae32;outline-offset:3px}
    .launcher{position:fixed;right:22px;bottom:22px;z-index:2147483000;border:0;border-radius:28px;padding:15px 23px;background:var(--accent);color:white;box-shadow:0 6px 24px #12283233}
    .panel{position:fixed;right:22px;bottom:90px;width:380px;height:min(570px,75dvh);z-index:2147483000;background:#fff;border:1px solid #ccd9df;border-radius:18px;box-shadow:0 12px 48px #12283233;display:flex;flex-direction:column;overflow:hidden}
    [hidden]{display:none!important}header{display:flex;align-items:center;gap:10px;padding:15px 17px;background:#f0f6f8;border-bottom:1px solid #dce7eb}h2{font-size:16px;margin:0;flex:1}
    .plain{border:0;background:transparent;color:#294652;padding:7px;border-radius:6px}.messages{flex:1;overflow:auto;padding:16px;min-height:80px;overscroll-behavior:contain}
    .bubble{white-space:pre-wrap;overflow-wrap:anywhere;margin:0 0 12px;padding:10px 13px;border-radius:12px;background:#eef4f6}.user{background:#e3f0f2;margin-left:30px}.assistant{margin-right:15px}
    .references{display:block;font-size:12px;color:#465f6b;margin-top:9px}.status{min-height:24px;font-size:12px;color:#475f6c;padding:0 16px 6px}
    .suggestions{display:flex;flex-wrap:wrap;gap:4px;padding:0 12px 8px;max-height:100px;overflow:auto}.suggestions button,.copy{font-size:12px;border:1px solid #ccd9df;background:#fff;color:#294652;border-radius:6px;padding:4px 7px}.copy{display:block;margin-top:8px}.stop{border:1px solid #a7bec9;border-radius:8px;background:white;color:#294652;padding:10px}
    form{display:flex;align-items:end;gap:8px;padding:12px;border-top:1px solid #dce7eb}textarea{resize:none;flex:1;min-width:0;border:1px solid #a7bec9;border-radius:8px;padding:9px;color:#172832;background:#fff}
    .send{border:0;border-radius:8px;background:var(--accent);color:white;padding:10px 14px}.footer{font-size:11px;color:#566b75;padding:0 14px 9px}
    .voice{font-size:15px;line-height:1}.voice[aria-pressed="true"]{background:#dceff2;color:#0f5b70}
    .voice-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:4px 14px 2px;font-size:11px;color:#566b75}
    .voice-row select{font:inherit;border:1px solid #ccd9df;border-radius:6px;background:#fff;color:#294652;padding:2px 4px}
    .voice-note{color:#8a4b00;text-align:right;flex:1}.voice-note:empty{display:none}
    @media(max-width:440px){.panel{right:10px;left:10px;bottom:82px;width:auto;height:70dvh}.launcher{right:12px;bottom:14px}}
    @media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
  `;
  shadow.append(style);
  const surface = document.createElement("div");
  surface.innerHTML = `
    <button class="launcher" type="button" aria-expanded="false" aria-controls="echo-panel">Chat</button>
    <section class="panel" id="echo-panel" role="dialog" aria-label="Website assistant" hidden>
      <header><h2>Website assistant</h2><button class="plain voice" type="button" aria-pressed="false" aria-label="Spoken replies off" title="Spoken replies">🔇</button><button class="plain reset" type="button">New chat</button><button class="plain close" type="button" aria-label="Close chat">✕</button></header>
      <div class="messages" role="log" aria-live="polite" aria-relevant="additions text"></div>
      <div class="suggestions" role="group" aria-label="Page suggestions"></div>
      <div class="status" role="status"></div>
      <form><textarea aria-label="Your message" placeholder="Ask a question…" maxlength="4000" rows="2" required></textarea><button class="stop" type="button" hidden>Stop</button><button class="send" type="submit">Send</button></form>
      <div class="voice-row"><label>Voice speed <select class="rate" aria-label="Speech speed"><option value="0.8">0.8×</option><option value="1" selected>1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option></select></label><span class="voice-note" role="status"></span></div>
      <div class="footer">AI answers can be mistaken. Confirm important details with the business.</div>
    </section>`;
  shadow.append(surface);
  document.body.append(host);
  const launcher = shadow.querySelector(".launcher");
  const panel = shadow.querySelector(".panel");
  const heading = shadow.querySelector("h2");
  const log = shadow.querySelector(".messages");
  const status = shadow.querySelector(".status");
  const input = shadow.querySelector("textarea");
  const send = shadow.querySelector(".send");
  const reset = shadow.querySelector(".reset");
  const stop = shadow.querySelector(".stop");
  const suggestions = shadow.querySelector(".suggestions");
  let token = null;
  let busy = false;
  let config = null;
  let controller = null;
  let destroyed = false;
  const bootController = new AbortController();
  const onPageHide = () => controller?.abort();

  // ---------- Optional spoken replies ----------
  // Free default: the browser's built-in speech engine. Audio is generated on the device,
  // needs no API key, and text chat keeps working if speech is unavailable. A host page may
  // replace it: window.EchoWidgetSpeechProviders[<id>] = () => ({ id, speak(text,{rate}), cancel() })
  // and set data-speech-provider="<id>" on this script.
  const speechProviders = new Map();
  speechProviders.set("browser", () => {
    const synth = window.speechSynthesis;
    const Utterance = window.SpeechSynthesisUtterance;
    if (!synth || typeof synth.speak !== "function" || typeof Utterance !== "function") return null;
    let current = null;
    return {
      id: "browser",
      speak(text, options) {
        return new Promise((resolve, reject) => {
          const utterance = new Utterance(text);
          utterance.rate = options.rate;
          utterance.pitch = 1;
          utterance.volume = 1;
          try {
            const voices = typeof synth.getVoices === "function" ? synth.getVoices() : [];
            const preferred = [/Google UK English Female/i, /Google US English/i, /Microsoft Aria/i, /Microsoft Jenny/i, /Samantha/i, /Serena/i];
            const voice = preferred.map(pattern => voices.find(item => pattern.test(item.name || ""))).find(Boolean)
              || voices.find(item => /^en(-|_)/i.test(item.lang || "")) || null;
            if (voice) { utterance.voice = voice; utterance.lang = voice.lang; }
          } catch {}
          utterance.onend = () => { if (current === utterance) current = null; resolve(); };
          utterance.onerror = event => {
            if (current === utterance) current = null;
            if (event?.error === "canceled" || event?.error === "interrupted") resolve();
            else reject(new Error("Speech could not be played."));
          };
          current = utterance;
          try { synth.speak(utterance); } catch (error) { current = null; reject(error); }
        });
      },
      cancel() {
        current = null;
        try { synth.cancel(); } catch {}
      },
    };
  });
  if (window.EchoWidgetSpeechProviders && typeof window.EchoWidgetSpeechProviders === "object") {
    for (const [id, factory] of Object.entries(window.EchoWidgetSpeechProviders)) {
      if (/^[a-z][a-z0-9-]{1,40}$/.test(id) && typeof factory === "function") speechProviders.set(id, factory);
    }
  }
  const SPEECH_KEY = "echo-widget-speech-v1";
  const validRate = value => [0.8, 1, 1.25, 1.5].includes(Number(value)) ? Number(value) : 1;
  function readSpeechSettings() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(SPEECH_KEY) || "{}");
      return { enabled: saved.enabled === true, rate: validRate(saved.rate) };
    } catch { return { enabled: false, rate: 1 }; }
  }
  const initialSpeech = readSpeechSettings();
  const voiceButton = shadow.querySelector(".voice");
  const voiceNote = shadow.querySelector(".voice-note");
  const rateSelect = shadow.querySelector(".rate");
  rateSelect.value = String(initialSpeech.rate);

  const speech = (() => {
    let provider = null;
    let providerChecked = false;
    let unavailable = false;
    let enabled = initialSpeech.enabled;
    let rate = initialSpeech.rate;
    let queue = [];
    let buffer = "";
    let speaking = false;
    let generation = 0;
    let tornDown = false;

    function ensureProvider() {
      if (providerChecked) return provider;
      providerChecked = true;
      const wanted = script?.dataset.speechProvider || "browser";
      const factory = speechProviders.get(wanted) || speechProviders.get("browser");
      try {
        const candidate = factory && factory();
        if (candidate && typeof candidate.speak === "function" && typeof candidate.cancel === "function") provider = candidate;
      } catch {}
      if (!provider) { unavailable = true; enabled = false; queue = []; }
      return provider;
    }

    function notify() {
      voiceButton.setAttribute("aria-pressed", enabled ? "true" : "false");
      voiceButton.setAttribute("aria-label", enabled ? "Spoken replies on" : "Spoken replies off");
      voiceButton.textContent = enabled ? "🔊" : "🔇";
      voiceButton.disabled = unavailable || tornDown;
      rateSelect.disabled = unavailable || tornDown;
      if (unavailable) voiceNote.textContent = "Voice isn't available here. Text chat still works.";
      else if (speaking) voiceNote.textContent = "Speaking…";
      else if (voiceNote.textContent === "Speaking…") voiceNote.textContent = "";
      if (typeof updateStop === "function") updateStop();
    }

    async function pump() {
      if (speaking || !enabled || tornDown) return;
      const chunk = queue.shift();
      if (!chunk) { notify(); return; }
      const active = ensureProvider();
      if (!active) { notify(); return; }
      speaking = true;
      notify();
      const token = generation;
      try {
        await active.speak(chunk, { rate });
      } catch {
        if (token === generation) { unavailable = true; enabled = false; queue = []; buffer = ""; }
      }
      if (token !== generation || tornDown) return;
      speaking = false;
      notify();
      pump();
    }

    function feed(text, final = false) {
      if (!enabled || tornDown) return;
      if (!ensureProvider()) { notify(); return; }
      if (typeof text === "string") buffer += text;
      if (!buffer) return;
      const pieces = [];
      let rest = buffer;
      for (;;) {
        const match = rest.match(/[.!?](?=\s|$)|\n/);
        if (!match) break;
        const end = match.index + 1;
        const head = rest.slice(0, end).trim();
        rest = rest.slice(end).trimStart();
        if (head && /[a-z0-9]/i.test(head)) pieces.push(head);
      }
      while (rest.length > 220) {
        let cut = Math.max(rest.lastIndexOf(", ", 220), rest.lastIndexOf("; ", 220), rest.lastIndexOf(" ", 220));
        if (cut < 80) cut = 220;
        const head = rest.slice(0, cut).trim();
        if (head) pieces.push(head);
        rest = rest.slice(cut).trimStart();
      }
      buffer = rest;
      if (final && buffer.trim()) { pieces.push(buffer.trim()); buffer = ""; }
      if (!pieces.length) return;
      queue.push(...pieces);
      pump();
    }

    function cancel() {
      generation++;
      queue = [];
      buffer = "";
      speaking = false;
      if (provider) provider.cancel();
      notify();
    }

    function setEnabled(value) {
      if (value && !ensureProvider()) { enabled = false; notify(); return false; }
      enabled = Boolean(value);
      if (!enabled) cancel();
      saveSpeechSettings();
      notify();
      return enabled;
    }

    function setRate(value) {
      rate = validRate(value);
      if (speaking) cancel();
      saveSpeechSettings();
      notify();
    }

    function say(text) {
      if (!enabled || tornDown) return;
      cancel();
      if (!ensureProvider()) { notify(); return; }
      queue.push(text);
      pump();
    }

    function teardown() {
      tornDown = true;
      enabled = false;
      generation++;
      queue = [];
      buffer = "";
      speaking = false;
      if (provider) provider.cancel();
      voiceNote.textContent = "";
    }

    return {
      get enabled() { return enabled; },
      get rate() { return rate; },
      get speaking() { return speaking; },
      feed,
      flush: () => feed("", true),
      cancel,
      say,
      setEnabled,
      setRate,
      refresh: notify,
      teardown,
    };
  })();
  function saveSpeechSettings() {
    try { sessionStorage.setItem(SPEECH_KEY, JSON.stringify({ enabled: speech.enabled, rate: speech.rate })); } catch {}
  }
  speech.refresh();

  host.addEventListener("echo-widget:destroy", () => {
    destroyed = true;
    bootController.abort();
    controller?.abort();
    speech.teardown();
    token = null;
    window.removeEventListener("pagehide", onPageHide);
    host.remove();
  }, { once: true });

  function bubble(role, text) {
    const element = document.createElement("div");
    element.className = `bubble ${role}`;
    element.textContent = text;
    log.append(element);
    if (role === "assistant" && text) addCopy(element);
    log.scrollTop = log.scrollHeight;
    return element;
  }
  function addCopy(element) {
    const text = element.textContent;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "copy";
    button.textContent = "Copy";
    button.setAttribute("aria-label", "Copy message");
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(text);
        if (!destroyed) status.textContent = "Message copied.";
      } catch { if (!destroyed) status.textContent = "Clipboard unavailable. Select the message text to copy it."; }
    });
    element.append(button);
  }
  function refreshContext() {
    if (destroyed) return;
    const detail = {};
    host.dispatchEvent(new CustomEvent("echo-widget:context", { bubbles: true, detail }));
    suggestions.replaceChildren();
    for (const text of (detail.context?.suggestions || []).slice(0, 4)) {
      if (typeof text !== "string" || text.length > 200) continue;
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = text;
      button.disabled = busy || !config;
      button.addEventListener("click", () => {
        if (busy || !config) return;
        input.value = text;
        shadow.querySelector("form").requestSubmit();
      });
      suggestions.append(button);
    }
  }
  host.addEventListener("echo-widget:refresh-context", refreshContext);
  function updateStop() {
    stop.hidden = !(busy || speech.speaking);
  }
  function setBusy(value) {
    if (destroyed) return;
    busy = value;
    send.disabled = value || !config;
    input.disabled = value || !config;
    reset.disabled = value || !config;
    updateStop();
    suggestions.querySelectorAll("button").forEach(button => { button.disabled = value || !config; });
  }
  stop.addEventListener("click", () => {
    // Text and audio stop together. A remote service may commit a turn before the browser
    // sees its final event, so discard its token to keep it out of later context.
    speech.cancel();
    if (!busy) return;
    token = null;
    controller?.abort();
  });
  voiceButton.addEventListener("click", () => {
    const next = speech.setEnabled(!speech.enabled);
    if (next) {
      speech.say("Voice replies are on. I'll read my answers aloud.");
      status.textContent = "Voice replies on.";
    } else {
      status.textContent = voiceButton.disabled ? "Voice isn't available here. Text chat still works." : "Voice replies off.";
    }
  });
  rateSelect.addEventListener("change", () => {
    speech.setRate(rateSelect.value);
    status.textContent = `Speech speed ${rateSelect.value}×.`;
  });
  function close() {
    speech.cancel();
    panel.hidden = true;
    launcher.setAttribute("aria-expanded", "false");
    launcher.focus();
  }
  launcher.addEventListener("click", () => {
    if (!panel.hidden) return close();
    panel.hidden = false;
    launcher.setAttribute("aria-expanded", "true");
    refreshContext();
    if (config) input.focus();
  });
  shadow.querySelector(".close").addEventListener("click", close);
  panel.addEventListener("keydown", event => { if (event.key === "Escape") close(); });
  input.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      if (!busy) shadow.querySelector("form").requestSubmit();
    }
  });

  async function request(path, options = {}) {
    // Same-origin built-in ECHO uses the portal's HttpOnly session cookie. Cross-origin
    // external ECHO origins never receive portal credentials.
    const response = await fetch(endpoint + path, { mode: "cors", credentials: "same-origin", ...options });
    if (!response.ok) {
      if (response.status === 401) token = null;
      const body = await response.json().catch(() => ({}));
      throw Object.assign(new Error(body.error || `Chat request failed (${response.status}).`), { status: response.status });
    }
    return response;
  }

  reset.addEventListener("click", async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (token) {
        try {
          await request("/sessions/current", { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
        } catch (error) {
          if (error.status !== 401) throw error;
        }
      }
      speech.cancel();
      token = null;
      host.dispatchEvent(new CustomEvent("echo-widget:reset", { bubbles: true }));
      log.replaceChildren();
      bubble("assistant", config.branding.greeting);
      status.textContent = "New conversation.";
    } catch (error) { status.textContent = error.message; }
    finally { setBusy(false); input.focus(); }
  });

  shadow.querySelector("form").addEventListener("submit", async event => {
    event.preventDefault();
    const message = input.value.trim();
    if (busy || !config || !message) return;
    speech.cancel();
    setBusy(true);
    bubble("user", message);
    input.value = "";
    // Only trusted host-page code may handle a read-only website command.
    // Model replies remain plain text and never enter this hook.
    const command = { message };
    status.textContent = "Checking portal command…";
    try {
      host.dispatchEvent(new CustomEvent("echo-widget:command", { bubbles: true, detail: command }));
      const reply = command.replyPromise ? await command.replyPromise : command.reply;
      if (destroyed) return;
      if (typeof reply === "string" && reply.length <= 4000) {
        bubble("assistant", reply);
        speech.feed(reply, true);
        status.textContent = "Ready.";
        setBusy(false);
        refreshContext();
        input.focus();
        return;
      }
    } catch {
      if (!destroyed) { status.textContent = "The portal action could not be completed."; setBusy(false); }
      return;
    }
    const answer = bubble("assistant", "");
    status.textContent = "Thinking…";
    controller = new AbortController();
    setBusy(true);
    const timeout = setTimeout(() => controller?.abort(), 45000);
    let reader = null;
    try {
      if (!token) {
        const response = await request("/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", signal: controller.signal });
        const session = await response.json();
        controller.signal.throwIfAborted();
        token = session.session_token;
      }
      const response = await request("/messages", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message, page: location.pathname }), signal: controller.signal
      });
      if (!response.headers.get("Content-Type")?.includes("text/event-stream") || !response.body) throw new Error("The server returned an invalid chat response.");
      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let complete = false;
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        let boundary;
        while ((boundary = buffer.indexOf("\n\n")) >= 0) {
          const block = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const kind = block.split("\n").find(line => line.startsWith("event: "))?.slice(7);
          const line = block.split("\n").find(item => item.startsWith("data: "));
          if (!line) continue;
          const data = JSON.parse(line.slice(6));
          if (kind === "delta") { answer.textContent += data.text; speech.feed(data.text); status.textContent = "Replying…"; }
          if (kind === "error") throw new Error(data.message);
          if (kind === "done") {
            complete = true;
            speech.flush();
            if (data.references?.length) {
              const references = document.createElement("span");
              references.className = "references";
              references.textContent = "References: " + data.references.map(item => item.title).join(", ");
              answer.append(references);
            }
          }
          log.scrollTop = log.scrollHeight;
        }
      }
      if (!complete) throw new Error("Connection ended before the reply was complete.");
      addCopy(answer);
      status.textContent = "Ready.";
    } catch (error) {
      speech.cancel();
      if (error.name === "AbortError") token = null;
      status.textContent = error.name === "AbortError" ? "Reply stopped. The next message starts a fresh conversation." : error.message;
      if (!answer.textContent) answer.textContent = "This reply could not be completed. Please try again.";
    } finally {
      clearTimeout(timeout);
      if (reader) { await reader.cancel().catch(() => {}); reader.releaseLock(); }
      controller = null;
      setBusy(false);
      if (!panel.hidden) input.focus();
    }
  });
  window.addEventListener("pagehide", onPageHide);
  setBusy(false);
  request("/config", { signal: bootController.signal }).then(response => response.json()).then(value => {
    if (destroyed) return;
    if (!value.enabled_capabilities.includes("chat")) throw new Error("Chat is currently disabled.");
    config = value;
    heading.textContent = value.branding.name;
    panel.setAttribute("aria-label", `${value.branding.name} assistant`);
    launcher.textContent = `Chat with ${value.branding.name}`;
    if (/^#[0-9a-f]{6}$/i.test(value.branding.accent)) host.style.setProperty("--accent", value.branding.accent);
    bubble("assistant", value.branding.greeting);
    setBusy(false);
    refreshContext();
  }).catch(error => { if (!destroyed) status.textContent = error.message; });
})();
