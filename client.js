// Écran Réglages › Antigravity : comptes Google, quotas, accès.
// DSH charge ce fichier tel quel dans le navigateur (script classique concaténé) : ni import/export ni JSX,
// tout vit dans la fabrique enregistrée auprès de __ModuleLoader__, dont l'id doit égaler le nom du paquet.
window.__ModuleLoader__.load({
  id: 'gemini-dsh',
  factory: (require) => {
    const React = require('react');
    const { Button, StateDot, Switch, Tag } = require('@deepseek-ai/dsh-client-ui-primitives');
    const { useEffect, useState } = React;
    const h = (type, props, ...children) => React.createElement(type, props ?? null, ...children);

    const CSS = `
.agymm{display:flex;flex-direction:column;gap:10px;font:var(--dsw-font-xs-13,13px/1.4 sans-serif);color:var(--dsw-alias-label-primary,inherit)}
.agymm h3{margin:14px 0 2px;font:var(--dsw-font-base-strong-16,600 16px/1.4 sans-serif)}
.agymm-row{display:flex;align-items:center;justify-content:space-between;gap:8px}
.agymm-row>span{display:inline-flex;align-items:center;gap:6px}
.agymm-muted{color:var(--dsw-alias-label-secondary,#86909c);margin:0}
.agymm-error{color:var(--dsw-alias-state-error-primary,#e5484d);margin:0}
.agymm-account{padding:8px 0;border-bottom:0.5px solid var(--dsw-alias-border-l2,#e5e6eb)}
.agymm-track{height:6px;border-radius:3px;overflow:hidden;background:var(--dsw-alias-border-l2,#e5e6eb);margin-top:4px}
.agymm-track>i{display:block;height:100%}
.agymm-quota{margin:6px 0 0 14px}`;

    function installStyles() {
      const style = document.createElement('style');
      style.id = 'agy-multimodal-styles';
      style.textContent = CSS;
      document.head.append(style);
      return () => style.remove();
    }

    const pct = (f) => Math.round(Math.max(0, Math.min(1, f)) * 100);
    const color = (f) => (f > 0.5 ? 'var(--dsw-alias-state-success-primary,#2fa36b)'
      : f > 0.2 ? 'var(--dsw-alias-state-warning-primary,#e5a00d)' : 'var(--dsw-alias-state-error-primary,#e5484d)');
    function untilReset(iso) {
      const min = Math.round((Date.parse(iso) - Date.now()) / 60_000);
      if (!(min >= 0)) return '';
      return min < 60 ? `resets in ${min} min` : `resets in ${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
    }

    function Bar({ label, fraction, reset }) {
      return h('div', { className: 'agymm-quota' },
        h('div', { className: 'agymm-row' },
          h('span', null, label),
          h('span', { className: 'agymm-muted' }, `${pct(fraction)}% left${reset ? ` · ${untilReset(reset)}` : ''}`)),
        h('div', { className: 'agymm-track' }, h('i', { style: { width: `${pct(fraction)}%`, background: color(fraction) } })));
    }

    function Quota({ call, email, refresh }) {
      const [state, setState] = useState({});
      useEffect(() => {
        let live = true;
        call('quota', { email, force: refresh > 0 })
          .then((quota) => live && setState({ quota }), (error) => live && setState({ error: error.message }));
        return () => { live = false; };
      }, [call, email, refresh]);
      if (state.error) return h('p', { className: 'agymm-error agymm-quota' }, `Quotas unavailable: ${state.error}`);
      if (!state.quota) return h('p', { className: 'agymm-muted agymm-quota' }, 'Loading quotas…');
      const { gemini, models } = state.quota;
      return h('div', null,
        gemini && h(Bar, { label: 'Gemini, all models', fraction: gemini.remainingFraction, reset: gemini.resetTime }),
        h('div', null, ...models.map((m) => h(Bar, { key: m.modelId, label: m.displayName, fraction: m.remainingFraction, reset: m.resetTime }))));
    }

    function Section({ call }) {
      const [status, setStatus] = useState(null);
      const [error, setError] = useState(null);
      const [refresh, setRefresh] = useState(0);
      const load = () => call('status').then((s) => { setStatus(s); setError(null); }, (e) => setError(e.message));
      useEffect(() => { load(); }, []);
      // pendant une connexion Google, on suit son avancement
      const pending = status?.login.pending;
      useEffect(() => {
        if (!pending) return undefined;
        const timer = setInterval(load, 2000);
        return () => clearInterval(timer);
      }, [pending]);
      const act = (method, payload) => call(method, payload).then(load, (e) => setError(e.message));

      if (!status) return h('p', { className: error ? 'agymm-error' : 'agymm-muted' }, error ?? 'Loading…');
      const { accounts, login, settings, models } = status;
      const set = (patch) => act('settings', patch);
      const hide = (id, visible) => set({ hiddenModels: visible ? settings.hiddenModels.filter((x) => x !== id) : [...settings.hiddenModels, id] });

      return h('div', { className: 'agymm' },
        h('p', { className: 'agymm-muted' }, 'Google OAuth sign-in to your Antigravity subscription. Unofficial channel: Google has already suspended accounts connected this way.'),
        error && h('p', { className: 'agymm-error' }, error),

        h('h3', null, 'Google accounts'),
        accounts.length === 0 && h('p', { className: 'agymm-muted' }, 'No account connected.'),
        // chaque liste dans son propre conteneur : deux frères de même clé (l'adresse) font dupliquer les lignes par React
        h('div', null, ...accounts.map((a) => h('div', { key: a.email, className: 'agymm-row agymm-account' },
          h('span', null, h(StateDot, { state: a.active ? 'done' : 'warning', size: 8 }), a.email, a.active && h(Tag, { tone: 'success' }, 'active')),
          h('span', null,
            !a.active && h(Button, { variant: 'outline', size: 'sm', onClick: () => act('account.use', { email: a.email }) }, 'Use'),
            h(Button, { variant: 'ghost', size: 'sm', onClick: () => act('account.remove', { email: a.email }) }, 'Remove'))))),
        login.pending
          ? h('div', { className: 'agymm-row' },
            h('span', { className: 'agymm-muted' }, 'Approve the Google sign-in in your browser…'),
            h(Button, { variant: 'ghost', size: 'sm', onClick: () => act('login.cancel') }, 'Cancel'))
          : h('div', null, h(Button, { variant: 'outline', size: 'sm', onClick: () => act('login') },
            accounts.length ? 'Add a Google account' : 'Sign in with Google')),
        login.error && h('p', { className: 'agymm-error' }, login.error),

        h('div', { className: 'agymm-row' },
          h('h3', null, 'Quotas'),
          accounts.length > 0 && h(Button, { variant: 'ghost', size: 'sm', onClick: () => setRefresh((n) => n + 1) }, 'Refresh')),
        accounts.length === 0 && h('p', { className: 'agymm-muted' }, 'Connect an account to see its quotas.'),
        h('div', null, ...accounts.map((a) => h('div', { key: a.email },
          h('strong', null, a.email),
          h(Quota, { call, email: a.email, refresh })))),

        h('h3', null, 'Access'),
        h(Switch, { label: 'Antigravity models in the DSH model picker', checked: settings.gemini, onChange: (v) => set({ gemini: v }) }),
        h(Switch, { label: 'Web search (agy_web_search tool)', checked: settings.web, onChange: (v) => set({ web: v }) }),
        h(Switch, { label: 'Image, audio, video and PDF analysis (agy_media tool)', checked: settings.media, onChange: (v) => set({ media: v }) }),
        h('p', { className: 'agymm-muted' }, 'Models shown in the picker'),
        h('div', null, ...models.map((m) => h(Switch, {
          key: m.id, label: m.name, disabled: !settings.gemini,
          checked: !settings.hiddenModels.includes(m.id), onChange: (v) => hide(m.id, v),
        }))));
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
        ctx.effect(() => ctx.slots.inject('settings.section', () => ctx.slots.register(
          { name: 'settings.section', id: 'agy-multimodal', order: 35, label: 'Antigravity' },
          () => h(Section, { call }))), 'agy-multimodal: settings section');
      },
    };
  },
});
