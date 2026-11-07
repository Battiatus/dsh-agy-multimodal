// Écran Réglages › Antigravity : connexion Google, comptes et quotas, fonctions, modèles affichés.
// DSH charge ce fichier tel quel dans le navigateur (script classique concaténé) : ni import/export ni JSX,
// tout vit dans la fabrique enregistrée auprès de __ModuleLoader__, dont l'id doit égaler le nom du paquet.
window.__ModuleLoader__.load({
  id: 'gemini-dsh',
  factory: (require) => {
    const React = require('react');
    const { Switch } = require('@deepseek-ai/dsh-client-ui-primitives');
    const { useEffect, useState } = React;
    const h = (type, props, ...children) => React.createElement(type, props ?? null, ...children);

    // Mêmes jetons que les pages de réglages de DSH (Modèles), pour un rendu natif en clair comme en sombre
    const CSS = `
.agymm{display:flex;flex-direction:column;gap:24px;color:var(--dsw-alias-label-primary);font-size:14px;line-height:22px}
.agymm section{display:flex;flex-direction:column;gap:10px}
.agymm h3{margin:0;font-size:16px;font-weight:500;line-height:24px}
.agymm p{margin:0}
.agymm-intro,.agymm-muted{color:var(--dsw-alias-label-tertiary)}
.agymm-small{font-size:12px;line-height:18px}
.agymm-error{color:var(--dsw-alias-state-error-primary)}
.agymm-card{border:.5px solid var(--dsw-alias-settings-card-stroke);background:var(--dsw-alias-settings-card-fill);border-radius:var(--dsw-radius-xl);padding:12px 14px;display:flex;flex-direction:column;gap:12px}
.agymm-panel{border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-bg-module-platform);padding:14px 16px;display:flex;flex-direction:column;gap:14px}
.agymm-row{display:flex;align-items:center;gap:10px;min-width:0}
.agymm-grow{flex:1 1 0;min-width:0}
.agymm-ellipsis{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.agymm-dot{width:8px;height:8px;border-radius:50%;flex:0 0 auto;background:var(--dsw-alias-border-l3)}
.agymm-dot.on{background:var(--dsw-alias-state-success-primary)}
.agymm-tag{font-size:12px;line-height:18px;padding:0 6px;border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary)}
.agymm-btn{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:6px;height:36px;padding:0 14px;border-radius:var(--dsw-radius-md);border:.5px solid var(--dsw-alias-border-l3);background:none;color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer;text-decoration:none;white-space:nowrap}
.agymm-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.agymm-btn.primary{border:none;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground)}
.agymm-btn.primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}
.agymm-btn.add{width:100%;height:44px;border:1px dashed var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-lg)}
.agymm-btn.link{height:28px;padding:0 10px;border:none;border-radius:var(--dsw-radius-sm);font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}
.agymm-btn.link:hover:not(:disabled){color:var(--dsw-alias-label-secondary)}
.agymm-btn.danger{color:var(--dsw-alias-state-error-primary)}
.agymm-btn:disabled{opacity:.4;cursor:default}
.agymm-btn:focus-visible,.agymm-input:focus-visible{box-shadow:0 0 0 2px var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline:none}
.agymm-input{box-sizing:border-box;flex:1 1 0;min-width:0;height:36px;padding:0 10px;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit}
.agymm-input::placeholder{color:var(--dsw-alias-label-dimmed)}
.agymm-step{display:flex;gap:10px}
.agymm-num{flex:0 0 auto;width:22px;height:22px;border-radius:50%;background:var(--dsw-alias-bg-layer-1);font-size:12px;line-height:22px;text-align:center;color:var(--dsw-alias-label-secondary)}
.agymm-track{height:4px;border-radius:2px;overflow:hidden;background:var(--dsw-alias-border-l2)}
.agymm-track>i{display:block;height:100%}
.agymm-quota{display:grid;grid-template-columns:minmax(0,1fr) 120px auto;align-items:center;gap:4px 12px;font-size:12px;line-height:18px}
.agymm-setting{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:16px 0;border-bottom:.5px solid var(--dsw-alias-border-l2)}
.agymm-setting:last-child{border-bottom:none}
.agymm-setting-title{font-size:14px;line-height:20px}
.agymm-setting-desc{margin-top:4px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.agymm-settings{display:flex;flex-direction:column}
.agymm-notice{position:fixed;right:20px;bottom:20px;z-index:2000;box-sizing:border-box;width:min(420px,calc(100vw - 40px));max-height:60vh;overflow:auto;padding:14px 16px;border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-bg-layer-2,#fff);box-shadow:var(--dsw-elevation-prominent,0 8px 30px rgba(0,0,0,.18));border:.5px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px;white-space:pre-wrap;word-break:break-word}
.agymm-notice.error{border-color:var(--dsw-alias-state-error-primary)}
.agymm-notice a{color:var(--dsw-alias-state-business-primary)}
.agymm-notice-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;font-weight:500}
.agymm-notice-head button{border:none;background:none;cursor:pointer;color:var(--dsw-alias-label-tertiary);font-size:18px;line-height:1;padding:0 2px}
.agymm-divider{height:.5px;background:var(--dsw-alias-settings-card-stroke);margin:0 -14px}`;

    /**
     * Résultat de /agy en carte flottante : DSH ne montre le résultat d'une commande que dans une session
     * qui a déjà des messages, et le lien de connexion doit rester cliquable.
     */
    let notice;
    function showNotice({ kind, text }) {
      notice?.remove();
      notice = document.createElement('div');
      notice.className = `agymm-notice ${kind === 'error' ? 'error' : ''}`;
      notice.setAttribute('role', kind === 'error' ? 'alert' : 'status');
      const head = document.createElement('div');
      head.className = 'agymm-notice-head';
      const title = document.createElement('span');
      title.textContent = kind === 'error' ? '/agy failed' : '/agy';
      const close = document.createElement('button');
      close.type = 'button';
      close.textContent = '×';
      close.setAttribute('aria-label', 'Close');
      const own = notice;
      close.onclick = () => own.remove();
      head.append(title, close);
      notice.append(head);
      for (const piece of String(text).split(/(https?:\/\/\S+)/)) { // liens cliquables, le reste en texte brut
        if (/^https?:\/\//.test(piece)) {
          const a = document.createElement('a');
          a.href = piece;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.textContent = piece.includes('accounts.google.com') ? 'Open Google sign-in' : piece;
          notice.append(a);
        } else notice.append(document.createTextNode(piece));
      }
      document.body.append(notice);
    }

    function installStyles() {
      const style = document.createElement('style');
      style.id = 'agy-multimodal-styles';
      style.textContent = CSS;
      document.head.append(style);
      return () => style.remove();
    }

    const pct = (f) => Math.round(Math.max(0, Math.min(1, f ?? 0)) * 100);
    const tone = (f) => (f > 0.5 ? 'var(--dsw-alias-state-success-primary)'
      : f > 0.2 ? 'var(--dsw-alias-state-warning-primary)' : 'var(--dsw-alias-state-error-primary)');
    function untilReset(iso) {
      const min = Math.round((Date.parse(iso) - Date.now()) / 60_000);
      if (!(min >= 0)) return '';
      if (min >= 1440) return `resets in ${Math.floor(min / 1440)} d ${Math.floor((min % 1440) / 60)} h`; // fenêtre hebdomadaire
      return min < 60 ? `resets in ${min} min` : `resets in ${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
    }
    /** Ligne de réglage au format DSH : titre, description, interrupteur à droite (le Switch n'affiche pas son label). */
    const setting = ({ key, title, desc, checked, onChange, disabled }) => h('div', { key: key ?? title, className: 'agymm-setting' },
      h('div', { className: 'agymm-grow' }, h('div', { className: 'agymm-setting-title' }, title), desc && h('div', { className: 'agymm-setting-desc' }, desc)),
      h(Switch, { label: title, 'aria-label': title, checked, onChange, disabled }));
    const btn = (props, label) => h('button', { type: 'button', ...props, className: `agymm-btn ${props.kind ?? ''}` }, label);

    /** Quotas d'un compte : une barre par modèle du sélecteur, repliés par défaut derrière le plus bas. */
    function Quota({ call, email, refresh }) {
      const [state, setState] = useState({});
      const [open, setOpen] = useState(false);
      useEffect(() => {
        let live = true;
        call('quota', { email, force: refresh > 0 })
          .then((quota) => live && setState({ quota }), (error) => live && setState({ error: error.message }));
        return () => { live = false; };
      }, [call, email, refresh]);
      if (state.error) return h('p', { className: 'agymm-small agymm-error' }, `Quota unavailable: ${state.error}`);
      if (!state.quota) return h('p', { className: 'agymm-small agymm-muted' }, 'Checking quota…');
      const pools = state.quota.pools ?? [];
      if (pools.length > 0) {
        // les groupes et fenêtres de Google (Gemini, Claude et GPT, Argon ; 5 h et semaine), comme dans Antigravity
        const WINDOW = { '5h': '5-hour limit', weekly: 'Weekly limit' };
        return h('div', { className: 'agymm-quota' }, ...pools.flatMap((pool) => pool.windows.flatMap((w, i) => [
          h('span', { key: `${pool.name}-${w.window}-n`, className: 'agymm-ellipsis', title: pool.description },
            i === 0 ? h('strong', { style: { fontWeight: 500 } }, pool.name) : '', i === 0 ? ' · ' : '', WINDOW[w.window] ?? w.window),
          h('div', { key: `${pool.name}-${w.window}-t`, className: 'agymm-track' }, h('i', { style: { width: `${pct(w.remainingFraction)}%`, background: tone(w.remainingFraction) } })),
          h('span', { key: `${pool.name}-${w.window}-v`, className: 'agymm-muted' }, `${pct(w.remainingFraction)}%${w.resetTime && w.remainingFraction < 1 ? ` · ${untilReset(w.resetTime)}` : ''}`),
        ])));
      }
      const rows = state.quota.models ?? [];
      if (rows.length === 0) return null;
      const low = rows.reduce((a, b) => (b.remainingFraction < a.remainingFraction ? b : a));
      const line = (m) => [
        h('span', { key: `${m.modelId}-n`, className: 'agymm-ellipsis' }, m.displayName ?? m.modelId),
        h('div', { key: `${m.modelId}-t`, className: 'agymm-track' }, h('i', { style: { width: `${pct(m.remainingFraction)}%`, background: tone(m.remainingFraction) } })),
        h('span', { key: `${m.modelId}-v`, className: 'agymm-muted' }, `${pct(m.remainingFraction)}%${m.resetTime && m.remainingFraction < 1 ? ` · ${untilReset(m.resetTime)}` : ''}`),
      ];
      return h('div', null,
        h('div', { className: 'agymm-quota' }, ...(open ? rows : [low]).flatMap(line)),
        rows.length > 1 && btn({ kind: 'link', onClick: () => setOpen(!open), style: { marginLeft: -10 } },
          open ? 'Show less' : `Lowest of ${rows.length} models · show all`));
    }

    /** Étapes d'une connexion en cours : ouvrir Google, puis (autre appareil) coller l'adresse d'arrivée. */
    function SignIn({ url, call, reload, error }) {
      const [address, setAddress] = useState('');
      const [busy, setBusy] = useState(false);
      const [copied, setCopied] = useState(false);
      const [failure, setFailure] = useState(null);
      const finish = () => {
        setBusy(true);
        setFailure(null);
        call('login.finish', { address }).then(reload, (e) => setFailure(e.message)).finally(() => setBusy(false));
      };
      const copy = () => navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
      return h('div', { className: 'agymm-panel' },
        h('div', { className: 'agymm-step' }, h('span', { className: 'agymm-num' }, '1'),
          h('div', { className: 'agymm-grow', style: { display: 'flex', flexDirection: 'column', gap: 8 } },
            h('p', null, 'Choose your Google account and approve access in the Google page.'),
            h('div', { className: 'agymm-row' },
              h('a', { className: 'agymm-btn primary', href: url, target: '_blank', rel: 'noopener noreferrer' }, 'Open Google sign-in'),
              btn({ onClick: copy }, copied ? 'Link copied' : 'Copy link')))),
        h('div', { className: 'agymm-step' }, h('span', { className: 'agymm-num' }, '2'),
          h('div', { className: 'agymm-grow', style: { display: 'flex', flexDirection: 'column', gap: 8 } },
            h('p', null, 'On this computer, that\'s it: this page updates by itself.'),
            h('p', { className: 'agymm-muted' }, 'On another device, Google then shows a page at localhost:51121 that does not load. Copy its full address from the address bar and paste it here.'),
            h('div', { className: 'agymm-row' },
              h('input', { className: 'agymm-input', placeholder: 'http://localhost:51121/oauth-callback?…', value: address, onChange: (e) => setAddress(e.target.value), onKeyDown: (e) => e.key === 'Enter' && address.trim() && finish() }),
              btn({ onClick: finish, disabled: busy || !address.trim() }, busy ? 'Signing in…' : 'Finish')))),
        (failure ?? error) && h('p', { className: 'agymm-error' }, failure ?? error),
        h('div', null, btn({ kind: 'link', onClick: () => call('login.cancel').then(reload), style: { marginLeft: -10 } }, 'Cancel sign-in')));
    }

    function Section({ call }) {
      const [status, setStatus] = useState(null);
      const [error, setError] = useState(null);
      const [refresh, setRefresh] = useState(0);
      const load = () => call('status').then((s) => { setStatus(s); }, (e) => setError(e.message));
      const act = (method, payload) => {
        setError(null);
        return call(method, payload).then(load, (e) => setError(e.message));
      };
      useEffect(() => { load(); }, []);
      const pending = status?.login.pending;
      useEffect(() => { // pendant une connexion, la page suit le retour de Google
        if (!pending) return undefined;
        const timer = setInterval(load, 1500);
        return () => clearInterval(timer);
      }, [pending]);

      if (!status) return h('p', { className: error ? 'agymm-error' : 'agymm-muted' }, error ?? 'Loading…');
      const { accounts, login, settings, models, modelsError } = status;
      const set = (patch) => act('settings', patch);
      const signIn = () => {
        // navigateur web : onglet ouvert pendant le clic (sinon bloqué). App de bureau : elle refuse about:blank
        // mais envoie un lien http(s) au navigateur du système, sans bloqueur de fenêtres
        const tab = window.open('', '_blank');
        call('login').then(({ url }) => {
          if (tab) tab.location.href = url;
          else window.open(url, '_blank', 'noopener,noreferrer');
          load();
        }, (e) => { tab?.close(); setError(e.message); });
      };

      return h('div', { className: 'agymm' },
        h('section', { style: { gap: 4 } },
          h('h2', { style: { margin: 0, fontSize: 16, fontWeight: 500, lineHeight: '24px' } }, 'Antigravity'),
          h('p', { className: 'agymm-intro' }, 'Use the models of your Google Antigravity plan (Gemini, and Claude or GPT-OSS when your plan has them) in DeepSeek Harness. You sign in with Google: no API key.'),
          error && h('p', { className: 'agymm-error' }, error)),

        h('section', null,
          h('div', { className: 'agymm-row' },
            h('h3', { className: 'agymm-grow' }, 'Google accounts'),
            accounts.length > 0 && btn({ kind: 'link', onClick: () => setRefresh((n) => n + 1) }, 'Refresh quota')),
          accounts.length > 0 && h('div', { className: 'agymm-card' }, ...accounts.flatMap((a, i) => [
            i > 0 && h('div', { key: `${a.email}-d`, className: 'agymm-divider' }),
            h('div', { key: a.email, style: { display: 'flex', flexDirection: 'column', gap: 8 } },
              h('div', { className: 'agymm-row' },
                h('span', { className: `agymm-dot ${a.active ? 'on' : ''}` }),
                h('span', { className: 'agymm-ellipsis' }, a.email),
                a.active && h('span', { className: 'agymm-tag' }, 'In use'),
                h('span', { className: 'agymm-grow' }),
                !a.active && btn({ kind: 'link', onClick: () => act('account.use', { email: a.email }) }, 'Use this account'),
                btn({ kind: 'link danger', onClick: () => act('account.remove', { email: a.email }) }, 'Sign out')),
              h(Quota, { call, email: a.email, refresh })),
          ].filter(Boolean))),
          login.pending
            ? h(SignIn, { url: login.url, call, reload: load, error: login.error })
            : h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
              accounts.length === 0
                ? btn({ kind: 'primary', onClick: signIn, style: { alignSelf: 'flex-start' } }, 'Sign in with Google')
                : btn({ kind: 'add', onClick: signIn }, '+ Add another Google account'),
              login.error && h('p', { className: 'agymm-error' }, login.error))),

        modelsError && accounts.length > 0 && h('section', null,
          h('p', { className: 'agymm-error' }, `Google's model list is unavailable, so no Antigravity model shows in the picker: ${modelsError}`)),

        h('section', null,
          h('h3', null, 'Features'),
          h('div', { className: 'agymm-settings' },
            setting({ title: 'Antigravity models', desc: 'Show the models of your plan in the model picker.', checked: settings.gemini, onChange: (v) => set({ gemini: v }) }),
            setting({ title: 'Google web search', desc: 'Agents can search the web with sources (agy_web_search tool).', checked: settings.web, onChange: (v) => set({ web: v }) }),
            setting({ title: 'Image generation', desc: 'Agents can create and edit images with Google\'s image model (agy_image tool).', checked: settings.images, onChange: (v) => set({ images: v }) }),
            setting({ title: 'Media analysis', desc: 'Agents can read images, audio, video and PDF files from the workspace (agy_media tool).', checked: settings.media, onChange: (v) => set({ media: v }) }))),

        models.length > 0 && settings.gemini && h('section', null,
          h('h3', null, 'Models in the picker'),
          h('p', { className: 'agymm-muted' }, 'Google decides this list for the account in use. Turn off the models you don\'t want to see.'),
          h('div', { className: 'agymm-settings' }, ...models.map((m) => setting({
            key: m.id, title: m.name,
            checked: !settings.hiddenModels.includes(m.id),
            onChange: (v) => set({ hiddenModels: v ? settings.hiddenModels.filter((x) => x !== m.id) : [...settings.hiddenModels, m.id] }),
          })))),

        h('p', { className: 'agymm-small agymm-muted' }, 'Unofficial: this uses the same sign-in as Google Antigravity, and Google has suspended accounts connected this way in third-party tools. Tokens stay on the machine running DSH.'));
    }

    return {
      inject: ['slots', 'connection'],
      apply(ctx) {
        const connection = ctx.get('connection');
        if (!connection) return;
        const call = async (method, payload = {}) => {
          const result = await connection.rpc.call('/api', 'agy-multimodal', { method, payload });
          if (result?.ok === true) return result.value;
          throw new Error(result?.error?.message ?? `${method}: invalid response`);
        };
        ctx.effect(() => installStyles(), 'agy-multimodal: styles');
        ctx.effect(() => () => notice?.remove(), 'agy-multimodal: /agy notice');
        ctx.on('command/executed', (_sessionId, name, result) => {
          if (name === 'agy' && result?.text) showNotice(result);
        });
        ctx.effect(() => ctx.slots.inject('settings.section', () => ctx.slots.register(
          { name: 'settings.section', id: 'agy-multimodal', order: 35, label: 'Antigravity' },
          () => h(Section, { call }))), 'agy-multimodal: settings section');
      },
    };
  },
});
