(() => {
  'use strict';

  const VERSION = '5.3.0';
  const TOKEN_KEY = 'senecompare.v53.admin.token';
  const OWNER_EMAIL = 'idrissaminata@gmail.com';
  const login = document.getElementById('adminLogin');
  const app = document.getElementById('adminApp');
  const loginForm = document.getElementById('adminLoginForm');
  const loginStatus = document.getElementById('adminLoginStatus');
  const toastNode = document.getElementById('adminToast');
  const range = document.getElementById('adminRange');
  let token = '';
  let overview = null;
  let toastTimer = 0;

  function readToken() { try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } }
  function saveToken(value) { try { if (value) sessionStorage.setItem(TOKEN_KEY, value); else sessionStorage.removeItem(TOKEN_KEY); } catch { /* unavailable */ } }
  function number(value) { return new Intl.NumberFormat('fr-FR').format(Number(value || 0)); }
  function percent(value) { return Number(value || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 }); }
  function escapeText(value) { return String(value ?? ''); }
  function formatDate(value, withTime = false) {
    const date = new Date(value); if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Dakar', day: '2-digit', month: 'short', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) }).format(date);
  }
  function toast(message, error = false) {
    clearTimeout(toastTimer); toastNode.textContent = message; toastNode.classList.toggle('error', error); toastNode.classList.add('show');
    toastTimer = setTimeout(() => toastNode.classList.remove('show'), 3600);
  }
  function setLoginStatus(message, state = '') { loginStatus.textContent = message; loginStatus.dataset.state = state; }

  async function api(path, options = {}) {
    const headers = { Accept: 'application/json', 'X-Client-Version': `senecompare-admin-${VERSION}`, ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch(path, { method: options.method || 'GET', headers, body: options.body === undefined ? undefined : JSON.stringify(options.body), credentials: 'same-origin' });
    if (response.status === 401 || response.status === 403) { logout(false); throw new Error('SESSION_EXPIRED'); }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) throw new Error(payload.code || `HTTP_${response.status}`);
    return payload;
  }

  function consumeAuthCallback() {
    const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
    const accessToken = hash.get('access_token');
    const error = hash.get('error_description') || hash.get('error');
    if (accessToken) {
      saveToken(accessToken); token = accessToken;
      history.replaceState({}, document.title, '/admin');
      return true;
    }
    if (error) { setLoginStatus(decodeURIComponent(error), 'error'); history.replaceState({}, document.title, '/admin'); }
    return false;
  }

  function showLogin() { app.hidden = true; login.hidden = false; }
  function showApp() { login.hidden = true; app.hidden = false; }
  function logout(showMessage = true) {
    token = ''; saveToken(''); overview = null; showLogin();
    if (showMessage) setLoginStatus('Session fermée.', 'success');
  }

  function fillMetrics(data) {
    const summary = data.summary || {};
    document.querySelectorAll('[data-metric]').forEach((node) => {
      const key = node.dataset.metric;
      node.textContent = key === 'ctr' ? percent(summary[key]) : number(summary[key]);
    });
    document.getElementById('todayVisitors').textContent = `Aujourd’hui : ${number(data.today?.visitors)} visiteur${Number(data.today?.visitors) > 1 ? 's' : ''}`;
    document.getElementById('adminUpdated').textContent = `Dernière mise à jour : ${formatDate(data.generated_at, true)} · période de ${data.days || 30} jours`;
  }

  function renderChart(items) {
    const chart = document.getElementById('dailyChart'); chart.textContent = '';
    const max = Math.max(1, ...items.map((item) => Number(item.visitors || 0)));
    items.forEach((item) => {
      const bar = document.createElement('div'); bar.className = 'sc-chart-bar';
      const column = document.createElement('i'); column.style.height = `${Math.max(2, (Number(item.visitors || 0) / max) * 100)}%`; column.dataset.value = `${number(item.visitors)} visiteurs · ${number(item.searches)} recherches`; column.tabIndex = 0;
      const label = document.createElement('span'); label.textContent = formatDate(item.date);
      bar.append(column, label); chart.append(bar);
    });
    if (!items.length) chart.innerHTML = '<p class="sc-empty">Aucune donnée pour cette période.</p>';
  }

  function renderDevices(items) {
    const root = document.getElementById('deviceBars'); root.textContent = '';
    const total = Math.max(1, items.reduce((sum, item) => sum + Number(item.visits || 0), 0));
    const names = { mobile: 'Téléphone', tablet: 'Tablette', desktop: 'Ordinateur', other: 'Autre' };
    items.forEach((item) => {
      const share = Math.round((Number(item.visits || 0) / total) * 100);
      const row = document.createElement('div'); row.className = 'sc-device-row';
      const label = document.createElement('b'); label.textContent = names[item.device] || item.device;
      const track = document.createElement('span'); track.className = 'sc-device-track'; const fill = document.createElement('i'); fill.style.width = `${share}%`; track.append(fill);
      const value = document.createElement('strong'); value.textContent = `${share}%`;
      row.append(label, track, value); root.append(row);
    });
    if (!items.length) root.innerHTML = '<p class="sc-empty">Les données commenceront à apparaître après les premières visites.</p>';
  }

  function renderList(rootId, items, labelKey, valueKey, detailKey = '') {
    const root = document.getElementById(rootId); root.textContent = '';
    items.forEach((item) => {
      const row = document.createElement('div'); row.className = 'sc-list-row';
      const copy = document.createElement('div'); const title = document.createElement('b'); title.textContent = escapeText(item[labelKey] || '—'); copy.append(title);
      if (detailKey && item[detailKey] !== undefined) { const detail = document.createElement('small'); detail.textContent = `${number(item[detailKey])} visiteurs uniques`; copy.append(detail); }
      const value = document.createElement('span'); value.className = 'sc-list-value'; value.textContent = number(item[valueKey]);
      row.append(copy, value); root.append(row);
    });
    if (!items.length) root.innerHTML = '<p class="sc-empty">Aucune donnée pour le moment.</p>';
  }

  async function patchCampaign(slug, changes, control) {
    if (control) control.disabled = true;
    try { await api('/api/admin/campaigns', { method: 'PATCH', body: { slug, ...changes } }); toast('Campagne mise à jour.'); }
    catch (error) { toast(error.message === 'SESSION_EXPIRED' ? 'Session expirée.' : 'La campagne n’a pas pu être mise à jour.', true); await loadDashboard().catch(() => null); }
    finally { if (control) control.disabled = false; }
  }

  function renderCampaigns(items) {
    const body = document.getElementById('campaignRows'); body.textContent = '';
    items.forEach((item) => {
      const row = document.createElement('tr');
      const brand = document.createElement('td'); brand.innerHTML = `<span class="sc-campaign-brand"></span><small></small>`; brand.querySelector('span').textContent = item.brand; brand.querySelector('small').textContent = item.title;
      const status = document.createElement('td'); const toggle = document.createElement('label'); toggle.className = 'sc-toggle'; const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = Boolean(item.active); checkbox.setAttribute('aria-label', `Activer ${item.brand}`); const slider = document.createElement('span'); toggle.append(checkbox, slider); status.append(toggle);
      checkbox.addEventListener('change', () => patchCampaign(item.slug, { active: checkbox.checked }, checkbox));
      const impressions = document.createElement('td'); impressions.textContent = number(item.impressions);
      const clicks = document.createElement('td'); clicks.textContent = number(item.clicks);
      const ctr = document.createElement('td'); ctr.textContent = `${percent(item.ctr)}%`;
      const priorityCell = document.createElement('td'); const priority = document.createElement('input'); priority.className = 'sc-priority'; priority.type = 'number'; priority.min = '0'; priority.max = '1000'; priority.value = String(item.priority || 0); priority.setAttribute('aria-label', `Priorité ${item.brand}`); priority.addEventListener('change', () => patchCampaign(item.slug, { priority: Number(priority.value) }, priority)); priorityCell.append(priority);
      const destination = document.createElement('td'); const link = document.createElement('a'); link.href = item.destination_url; link.target = '_blank'; link.rel = 'noopener'; link.textContent = 'Ouvrir ↗'; destination.append(link);
      row.append(brand, status, impressions, clicks, ctr, priorityCell, destination); body.append(row);
    });
    if (!items.length) body.innerHTML = '<tr><td colspan="7" class="sc-empty">Aucune campagne configurée.</td></tr>';
  }

  async function patchLead(id, status, control) {
    control.disabled = true;
    try { await api('/api/admin/leads', { method: 'PATCH', body: { id, status } }); toast('Statut du professionnel mis à jour.'); }
    catch { toast('Impossible de modifier ce statut.', true); }
    finally { control.disabled = false; }
  }

  function renderLeads(items) {
    const body = document.getElementById('leadRows'); body.textContent = '';
    const statuses = [['new','Nouveau'],['contacted','Contacté'],['qualified','Qualifié'],['won','Partenaire'],['closed','Fermé']];
    items.forEach((item) => {
      const row = document.createElement('tr');
      const date = document.createElement('td'); date.textContent = formatDate(item.created_at, true);
      const business = document.createElement('td'); business.innerHTML = '<span class="sc-campaign-brand"></span><small></small>'; business.querySelector('span').textContent = item.business_name; business.querySelector('small').textContent = item.contact_name;
      const contact = document.createElement('td'); contact.className = 'sc-lead-contact'; const mail = document.createElement('a'); mail.href = `mailto:${encodeURIComponent(item.email)}`; mail.textContent = item.email; contact.append(mail); if (item.phone) { const phone = document.createElement('a'); phone.href = `tel:${item.phone}`; phone.textContent = item.phone; contact.append(phone); }
      const placement = document.createElement('td'); placement.textContent = item.placement;
      const message = document.createElement('td'); message.className = 'sc-lead-message'; message.textContent = item.message || '—';
      const statusCell = document.createElement('td'); const select = document.createElement('select'); select.className = 'sc-lead-status'; statuses.forEach(([value,label]) => { const option = document.createElement('option'); option.value = value; option.textContent = label; option.selected = item.status === value; select.append(option); }); select.addEventListener('change', () => patchLead(item.id, select.value, select)); statusCell.append(select);
      row.append(date, business, contact, placement, message, statusCell); body.append(row);
    });
    if (!items.length) body.innerHTML = '<tr><td colspan="6" class="sc-empty">Aucune demande professionnelle reçue.</td></tr>';
  }

  function renderDashboard(data) {
    overview = data; fillMetrics(data); renderChart(data.daily || []); renderDevices(data.devices || []);
    renderList('topPages', data.top_pages || [], 'path', 'views', 'visitors');
    renderList('topReferrers', data.top_referrers || [], 'referrer_host', 'visits');
    renderList('topQueries', data.top_queries || [], 'query', 'searches');
    renderList('topCategories', data.top_categories || [], 'category', 'searches');
    renderCampaigns(data.campaigns || []); renderLeads(data.leads || []);
  }

  async function loadDashboard() {
    document.getElementById('adminRefresh').disabled = true;
    try {
      const payload = await api(`/api/admin/overview?days=${encodeURIComponent(range.value)}`);
      document.getElementById('adminIdentity').textContent = `${payload.admin.email} · ${payload.admin.role === 'owner' ? 'propriétaire' : payload.admin.role}`;
      renderDashboard(payload.overview || {}); showApp();
    } catch (error) {
      if (error.message !== 'SESSION_EXPIRED') { showLogin(); setLoginStatus('La session n’est plus valide. Demandez un nouveau lien.', 'error'); }
      throw error;
    } finally { document.getElementById('adminRefresh').disabled = false; }
  }

  async function downloadLeads() {
    try {
      const response = await fetch('/api/admin/export', { headers: { Authorization: `Bearer ${token}`, 'X-Client-Version': `senecompare-admin-${VERSION}` } });
      if (response.status === 401 || response.status === 403) { logout(false); throw new Error('SESSION_EXPIRED'); }
      if (!response.ok) throw new Error('EXPORT_FAILED');
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `senecompare-partenaires-${new Date().toISOString().slice(0,10)}.csv`; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast('Export CSV préparé.');
    } catch { toast('Export indisponible.', true); }
  }

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault(); const button = loginForm.querySelector('button'); button.disabled = true; setLoginStatus('Envoi du lien sécurisé…');
    try {
      const payload = await api('/api/admin/auth/request', { method: 'POST', body: { email: OWNER_EMAIL } }); setLoginStatus(payload.message || 'Lien envoyé.', 'success');
    } catch { setLoginStatus('Le lien n’a pas pu être envoyé. Réessayez dans une minute.', 'error'); }
    finally { button.disabled = false; }
  });
  document.getElementById('adminLogout').addEventListener('click', () => logout());
  document.getElementById('adminRefresh').addEventListener('click', () => loadDashboard().then(() => toast('Données actualisées.')).catch(() => null));
  document.getElementById('adminExport').addEventListener('click', downloadLeads);
  document.getElementById('adminExportLeads').addEventListener('click', downloadLeads);
  range.addEventListener('change', () => loadDashboard().catch(() => null));
  document.getElementById('adminMenu').addEventListener('click', () => app.classList.toggle('menu-open'));
  document.querySelectorAll('.sc-admin-nav a').forEach((link) => link.addEventListener('click', () => { app.classList.remove('menu-open'); document.querySelectorAll('.sc-admin-nav a').forEach((item) => item.removeAttribute('aria-current')); link.setAttribute('aria-current', 'page'); }));

  async function init() {
    consumeAuthCallback(); token = token || readToken();
    if (!token) { showLogin(); return; }
    try { await loadDashboard(); }
    catch { /* UI handled */ }
    window.__SENECOMPARE_ADMIN__ = Object.freeze({ version: VERSION, owner: OWNER_EMAIL });
  }
  init();
})();
