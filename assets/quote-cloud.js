/* ITEM Quote cloud persistence layer.
 * The quotation renderer and calculations live in index.html. This file adds
 * server-backed create/save/update/clone/list/share behavior without changing
 * the quote's print layout.
 */
(() => {
  'use strict';

  function normalizeApiBase(value) {
    if (!value) return '';
    const candidate = String(value).trim().replace(/\/+$/, '');
    if (!candidate) return '';
    if (/^https?:\/\//i.test(candidate)) return candidate;
    return '';
  }

  const API_BASE = normalizeApiBase(
    window.ITEM_QUOTE_API_URL
    || localStorage.getItem('itemQuoteApiUrl')
    || new URLSearchParams(location.search).get('api')
    || (document.querySelector('meta[name="item-quote-api"]') || {}).content
  );
  const API_URL = `${API_BASE || ''}/api/quotes`;
  const ADMIN_SESSION_KEY = 'itemQuoteAdminKey';
  const CLOUD_I18N = {
    en: {
      new: 'New', quotes: 'Quotes', save: 'Save', clone: 'Clone', share: 'Share', close: 'Close', search: 'Search', refresh: 'Refresh',
      statusNew: 'New draft', statusSaved: 'Saved', statusDirty: 'Unsaved changes', statusSaving: 'Saving…', statusLoading: 'Loading…', statusError: 'Server error', statusReadOnly: 'Read-only share',
      managerTitle: 'Saved Quotes', searchPlaceholder: 'Search quote number or client', quoteNumber: 'Quote Number', client: 'Client', status: 'Status', updated: 'Updated', actions: 'Actions', open: 'Open', copyLink: 'Copy link', delete: 'Delete', noQuotes: 'No saved quotes found.',
      adminPrompt: 'Enter the ITEM Quote administrator key. It is stored only for this browser tab.', adminRequired: 'Administrator key is required.',
      saveSuccess: 'Quote saved successfully.', cloneSuccess: 'Quote cloned with a new unique Quote Number.', linkCopied: 'Read-only share link copied.', deleteSuccess: 'Quote deleted.',
      saveFirst: 'Save this quote before creating a share link.', confirmNew: 'This quote has unsaved changes. Start a new quote and discard them?', confirmDelete: 'Delete this quote permanently?', confirmReload: 'This quote was changed elsewhere. Reload the current server version?',
      autoNumber: 'AUTO ON SAVE', readonlyBanner: 'Read-only shared quotation. Pricing and selection fields cannot be changed.',
      serverUnavailable: 'The server is unavailable or the database is not configured.', fileMode: 'Open this application through its web server; database features do not work from a local file preview.',
      localDraft: 'Local draft', signedOut: 'Admin key cleared', clearKey: 'Clear key', editLink: 'Edit link', copiedFallback: 'Copy this link:',
    },
    zh: {
      new: '新建', quotes: '报价列表', save: '保存', clone: '复制', share: '分享', close: '关闭', search: '搜索', refresh: '刷新',
      statusNew: '新报价草稿', statusSaved: '已保存', statusDirty: '有未保存修改', statusSaving: '正在保存…', statusLoading: '正在加载…', statusError: '服务器错误', statusReadOnly: '只读分享',
      managerTitle: '已保存报价', searchPlaceholder: '搜索报价编号或客户', quoteNumber: '报价编号', client: '客户', status: '状态', updated: '更新时间', actions: '操作', open: '打开', copyLink: '复制链接', delete: '删除', noQuotes: '没有找到已保存的报价。',
      adminPrompt: '请输入 ITEM Quote 管理员密钥。密钥只保存在当前浏览器标签页。', adminRequired: '需要管理员密钥。',
      saveSuccess: '报价已保存。', cloneSuccess: '报价已复制，并生成新的唯一报价编号。', linkCopied: '只读分享链接已复制。', deleteSuccess: '报价已删除。',
      saveFirst: '请先保存报价，再创建分享链接。', confirmNew: '当前报价有未保存修改。是否放弃修改并新建报价？', confirmDelete: '是否永久删除这张报价？', confirmReload: '这张报价已在其他位置更新。是否加载服务器上的最新版本？',
      autoNumber: '保存时自动生成', readonlyBanner: '这是只读分享报价，价格和选择内容不能修改。',
      serverUnavailable: '服务器不可用，或数据库尚未配置。', fileMode: '请通过 Web 服务器打开此应用；本地文件预览无法使用数据库功能。',
      localDraft: '本地草稿', signedOut: '管理员密钥已清除', clearKey: '清除密钥', editLink: '编辑链接', copiedFallback: '请复制此链接：',
    },
    ja: {
      new: '新規', quotes: '見積一覧', save: '保存', clone: '複製', share: '共有', close: '閉じる', search: '検索', refresh: '更新',
      statusNew: '新規ドラフト', statusSaved: '保存済み', statusDirty: '未保存の変更', statusSaving: '保存中…', statusLoading: '読み込み中…', statusError: 'サーバーエラー', statusReadOnly: '読み取り専用',
      managerTitle: '保存済み見積', searchPlaceholder: '見積番号または顧客を検索', quoteNumber: '見積番号', client: '顧客', status: 'ステータス', updated: '更新日時', actions: '操作', open: '開く', copyLink: 'リンクをコピー', delete: '削除', noQuotes: '保存済み見積がありません。',
      adminPrompt: 'ITEM Quote 管理者キーを入力してください。このタブ内だけに保存されます。', adminRequired: '管理者キーが必要です。',
      saveSuccess: '見積を保存しました。', cloneSuccess: '新しい一意の見積番号で複製しました。', linkCopied: '読み取り専用リンクをコピーしました。', deleteSuccess: '見積を削除しました。',
      saveFirst: '共有リンクを作成する前に見積を保存してください。', confirmNew: '未保存の変更があります。破棄して新規作成しますか？', confirmDelete: 'この見積を完全に削除しますか？', confirmReload: '別の場所で更新されています。サーバーの最新版を読み込みますか？',
      autoNumber: '保存時に自動生成', readonlyBanner: '読み取り専用の共有見積です。価格や選択内容は変更できません。',
      serverUnavailable: 'サーバーに接続できないか、データベースが未設定です。', fileMode: 'データベース機能を使うには Web サーバー経由で開いてください。',
      localDraft: 'ローカルドラフト', signedOut: '管理者キーを消去しました', clearKey: 'キー消去', editLink: '編集リンク', copiedFallback: 'このリンクをコピーしてください：',
    },
    es: {
      new: 'Nuevo', quotes: 'Cotizaciones', save: 'Guardar', clone: 'Clonar', share: 'Compartir', close: 'Cerrar', search: 'Buscar', refresh: 'Actualizar',
      statusNew: 'Nuevo borrador', statusSaved: 'Guardado', statusDirty: 'Cambios sin guardar', statusSaving: 'Guardando…', statusLoading: 'Cargando…', statusError: 'Error del servidor', statusReadOnly: 'Solo lectura',
      managerTitle: 'Cotizaciones guardadas', searchPlaceholder: 'Buscar número o cliente', quoteNumber: 'Número', client: 'Cliente', status: 'Estado', updated: 'Actualizado', actions: 'Acciones', open: 'Abrir', copyLink: 'Copiar enlace', delete: 'Eliminar', noQuotes: 'No se encontraron cotizaciones.',
      adminPrompt: 'Ingrese la clave de administrador de ITEM Quote. Solo se guarda en esta pestaña.', adminRequired: 'Se requiere la clave de administrador.',
      saveSuccess: 'Cotización guardada.', cloneSuccess: 'Cotización clonada con un número único nuevo.', linkCopied: 'Enlace de solo lectura copiado.', deleteSuccess: 'Cotización eliminada.',
      saveFirst: 'Guarde la cotización antes de crear un enlace.', confirmNew: 'Hay cambios sin guardar. ¿Desea descartarlos y crear una cotización nueva?', confirmDelete: '¿Eliminar esta cotización permanentemente?', confirmReload: 'La cotización fue actualizada en otro lugar. ¿Cargar la versión del servidor?',
      autoNumber: 'AUTO AL GUARDAR', readonlyBanner: 'Cotización compartida de solo lectura. No se pueden modificar precios ni selecciones.',
      serverUnavailable: 'El servidor no está disponible o la base de datos no está configurada.', fileMode: 'Abra la aplicación mediante el servidor web; la vista previa local no admite base de datos.',
      localDraft: 'Borrador local', signedOut: 'Clave eliminada', clearKey: 'Borrar clave', editLink: 'Enlace de edición', copiedFallback: 'Copie este enlace:',
    },
  };

  const cloud = {
    id: null,
    version: null,
    shareToken: null,
    status: 'draft',
    dirty: false,
    readOnly: false,
    loading: false,
  };

  const q = (selector, root = document) => root.querySelector(selector);
  const qa = (selector, root = document) => [...root.querySelectorAll(selector)];
  const lang = () => (typeof state !== 'undefined' && CLOUD_I18N[state.lang] ? state.lang : 'en');
  const c = (key) => CLOUD_I18N[lang()]?.[key] || CLOUD_I18N.en[key] || key;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[char]));
  }

  function injectUi() {
    const toolbar = q('.toolbar-main');
    const anchor = q('#selectAll');
    if (!toolbar || !anchor) return;

    const fragment = document.createDocumentFragment();
    const buttons = [
      ['cloudNew', 'new'],
      ['cloudQuotes', 'quotes'],
      ['cloudSave', 'save'],
      ['cloudClone', 'clone'],
      ['cloudShare', 'share'],
    ];
    buttons.forEach(([id, key]) => {
      const button = document.createElement('button');
      button.id = id;
      button.type = 'button';
      button.className = `btn cloud-btn ${['cloudNew', 'cloudSave', 'cloudClone'].includes(id) ? 'cloud-write-control' : ''}`;
      button.dataset.cloudI18n = key;
      fragment.appendChild(button);
    });
    const divider = document.createElement('span');
    divider.className = 'cloud-divider';
    fragment.appendChild(divider);
    toolbar.insertBefore(fragment, anchor);

    const status = document.createElement('span');
    status.id = 'cloudStatus';
    status.className = 'cloud-status';
    status.dataset.state = 'dirty';
    status.innerHTML = '<span class="cloud-status-dot"></span><span id="cloudStatusText"></span>';
    toolbar.insertBefore(status, q('#printBtn'));

    const clearKey = document.createElement('button');
    clearKey.id = 'cloudClearKey';
    clearKey.type = 'button';
    clearKey.className = 'btn cloud-write-control';
    clearKey.dataset.cloudI18n = 'clearKey';
    toolbar.insertBefore(clearKey, q('#printBtn'));

    const banner = document.createElement('div');
    banner.id = 'cloudReadonlyBanner';
    banner.className = 'cloud-readonly-banner no-print';
    banner.dataset.cloudI18n = 'readonlyBanner';
    q('.toolbar').insertAdjacentElement('afterend', banner);

    const modal = document.createElement('div');
    modal.id = 'cloudModal';
    modal.className = 'cloud-modal no-print';
    modal.innerHTML = `
      <section class="cloud-panel" role="dialog" aria-modal="true" aria-labelledby="cloudManagerTitle">
        <div class="cloud-panel-head">
          <h2 id="cloudManagerTitle" data-cloud-i18n="managerTitle"></h2>
          <button id="cloudRefresh" type="button" class="btn" data-cloud-i18n="refresh"></button>
          <button id="cloudModalClose" type="button" class="btn" data-cloud-i18n="close"></button>
        </div>
        <div class="cloud-panel-body">
          <div class="cloud-search-row">
            <input id="cloudSearch" type="search" autocomplete="off" data-cloud-placeholder="searchPlaceholder">
            <button id="cloudSearchBtn" type="button" class="btn primary" data-cloud-i18n="search"></button>
          </div>
          <div id="cloudList"><div class="cloud-loader">Loading…</div></div>
        </div>
      </section>`;
    document.body.appendChild(modal);

    const toasts = document.createElement('div');
    toasts.id = 'cloudToasts';
    toasts.className = 'cloud-toast-stack no-print';
    document.body.appendChild(toasts);
  }

  function localizeCloud() {
    qa('[data-cloud-i18n]').forEach((element) => { element.textContent = c(element.dataset.cloudI18n); });
    qa('[data-cloud-placeholder]').forEach((element) => { element.placeholder = c(element.dataset.cloudPlaceholder); });
    const numberField = q('[data-field="quoteNumber"]');
    if (numberField) {
      numberField.readOnly = true;
      numberField.setAttribute('aria-readonly', 'true');
      numberField.title = c('autoNumber');
      if (!cloud.id && !cloud.readOnly) {
        state.fields.quoteNumber = c('autoNumber');
        numberField.value = state.fields.quoteNumber;
      }
    }
    renderStatus();
  }

  function renderStatus(kind, text) {
    const status = q('#cloudStatus');
    const label = q('#cloudStatusText');
    if (!status || !label) return;
    const effective = kind || (cloud.readOnly ? 'readonly' : cloud.loading ? 'saving' : cloud.dirty ? 'dirty' : cloud.id ? 'saved' : 'dirty');
    const defaults = {
      saved: 'statusSaved', dirty: cloud.id ? 'statusDirty' : 'statusNew', saving: 'statusSaving', loading: 'statusLoading', error: 'statusError', readonly: 'statusReadOnly',
    };
    status.dataset.state = effective;
    label.textContent = text || c(defaults[effective] || 'localDraft');
  }

  function toast(message, type = '') {
    const stack = q('#cloudToasts');
    if (!stack) return;
    const item = document.createElement('div');
    item.className = `cloud-toast ${type}`.trim();
    item.textContent = message;
    stack.appendChild(item);
    setTimeout(() => item.remove(), 4500);
  }

  function adminKey({ force = false } = {}) {
    if (location.hostname === '127.0.0.1' || location.hostname === 'localhost') {
      return sessionStorage.getItem(ADMIN_SESSION_KEY) || 'local-dev-key';
    }
    if (!force) {
      const existing = sessionStorage.getItem(ADMIN_SESSION_KEY);
      if (existing) return existing;
    }
    const entered = window.prompt(c('adminPrompt'));
    if (!entered) throw new Error(c('adminRequired'));
    sessionStorage.setItem(ADMIN_SESSION_KEY, entered.trim());
    return entered.trim();
  }

  async function api(path = '', options = {}, needsAdmin = true, retried = false) {
    if (location.protocol === 'file:') throw new Error(c('fileMode'));
    const headers = new Headers(options.headers || {});
    if (API_BASE && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      localStorage.setItem('itemQuoteApiUrl', API_BASE);
    }
    if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    if (needsAdmin) headers.set('X-Admin-Key', adminKey());
    let response;
    try {
      response = await fetch(`${API_URL}${path}`, { ...options, headers, cache: 'no-store' });
    } catch {
      throw new Error(c('serverUnavailable'));
    }
    let data = {};
    try { data = await response.json(); } catch { /* non-JSON failure */ }
    if (!response.ok) {
      if (response.status === 401 && needsAdmin && !retried) {
        sessionStorage.removeItem(ADMIN_SESSION_KEY);
        headers.set('X-Admin-Key', adminKey({ force: true }));
        return api(path, { ...options, headers }, needsAdmin, true);
      }
      const error = new Error(data.error?.message || `${response.status} ${response.statusText}`);
      error.code = data.error?.code;
      error.status = response.status;
      error.details = data.error?.details;
      throw error;
    }
    return data;
  }

  function serverState() {
    if (typeof recalculate === 'function') recalculate();
    state.selected = [...selected];
    const content = JSON.parse(JSON.stringify(state));
    if (!cloud.id && content.fields?.quoteNumber === c('autoNumber')) content.fields.quoteNumber = '';
    return content;
  }

  function mutateState(content, quoteNumber) {
    const fresh = defaultState();
    const incoming = content && typeof content === 'object' ? content : {};
    const next = {
      ...fresh,
      ...incoming,
      fields: { ...fresh.fields, ...(incoming.fields || {}), quoteNumber },
      overrides: { ...fresh.overrides, ...(incoming.overrides || {}) },
      selected: Array.isArray(incoming.selected) ? incoming.selected : fresh.selected,
    };
    Object.keys(state).forEach((key) => delete state[key]);
    Object.assign(state, next);
    selected.clear();
    next.selected.map(Number).filter((id) => ALL_IDS.includes(id)).forEach((id) => selected.add(id));
  }

  function setQuery(mode, value) {
    const url = new URL(location.href);
    url.search = '';
    if (mode && value) url.searchParams.set(mode, value);
    history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }

  function appendApiToUrl(url) {
    if (API_BASE) url.searchParams.set('api', API_BASE);
  }

  function applyServerQuote(quote, { readOnly = false } = {}) {
    cloud.loading = true;
    mutateState(quote.content, quote.quoteNumber);
    cloud.id = quote.id;
    cloud.version = quote.version;
    cloud.shareToken = quote.shareToken || (readOnly ? new URL(location.href).searchParams.get('share') : null);
    cloud.status = quote.status || 'draft';
    cloud.dirty = false;
    cloud.readOnly = readOnly;
    document.body.classList.toggle('cloud-readonly', readOnly);
    if (typeof applyTranslations === 'function') applyTranslations();
    localizeCloud();
    if (readOnly) setQuery('share', cloud.shareToken);
    else setQuery('quote', cloud.id);
    cloud.loading = false;
    renderStatus(readOnly ? 'readonly' : 'saved');
    enforceReadOnly();
  }

  function enforceReadOnly() {
    qa('.scope-checkbox, [data-field]').forEach((element) => {
      if (cloud.readOnly) {
        element.dataset.cloudWasDisabled = element.disabled ? '1' : '0';
        element.disabled = true;
      } else if (element.dataset.cloudWasDisabled === '0') {
        element.disabled = false;
        delete element.dataset.cloudWasDisabled;
      }
    });
  }

  function markDirty() {
    if (cloud.loading || cloud.readOnly) return;
    cloud.dirty = true;
    renderStatus('dirty');
  }

  async function saveCurrent() {
    if (cloud.readOnly) return;
    cloud.loading = true;
    renderStatus('saving');
    try {
      const content = serverState();
      let data;
      if (cloud.id) {
        data = await api('', {
          method: 'PATCH',
          body: JSON.stringify({ id: cloud.id, version: cloud.version, status: cloud.status, content }),
        });
      } else {
        data = await api('', { method: 'POST', body: JSON.stringify({ content }) });
      }
      applyServerQuote(data.quote);
      toast(c('saveSuccess'), 'success');
      return data.quote;
    } catch (error) {
      cloud.loading = false;
      if (error.code === 'version_conflict' && error.details?.current && confirm(c('confirmReload'))) {
        applyServerQuote(error.details.current);
        return null;
      }
      renderStatus('error', error.message);
      toast(error.message, 'error');
      throw error;
    }
  }

  function freshState() {
    const next = defaultState();
    next.fields.quoteNumber = c('autoNumber');
    Object.keys(state).forEach((key) => delete state[key]);
    Object.assign(state, next);
    selected.clear();
    next.selected.forEach((id) => selected.add(Number(id)));
    cloud.id = null;
    cloud.version = null;
    cloud.shareToken = null;
    cloud.status = 'draft';
    cloud.readOnly = false;
    cloud.dirty = true;
    document.body.classList.remove('cloud-readonly');
    setQuery(null, null);
    if (typeof applyTranslations === 'function') applyTranslations();
    localizeCloud();
    renderStatus('dirty', c('statusNew'));
  }

  function newQuote() {
    if (cloud.dirty && !confirm(c('confirmNew'))) return;
    freshState();
  }

  async function cloneCurrent(id = cloud.id) {
    if (!id) {
      await saveCurrent();
      id = cloud.id;
    }
    cloud.loading = true;
    renderStatus('saving');
    try {
      const data = await api('', {
        method: 'POST',
        body: JSON.stringify({ action: 'clone', id }),
      });
      applyServerQuote(data.quote);
      closeManager();
      toast(c('cloneSuccess'), 'success');
    } catch (error) {
      cloud.loading = false;
      renderStatus('error', error.message);
      toast(error.message, 'error');
    }
  }

  function readOnlyLink(token = cloud.shareToken) {
    const url = new URL(location.href);
    url.search = '';
    url.searchParams.set('share', token);
    appendApiToUrl(url);
    return url.toString();
  }

  function editLink(id = cloud.id) {
    const url = new URL(location.href);
    url.search = '';
    url.searchParams.set('quote', id);
    appendApiToUrl(url);
    return url.toString();
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt(c('copiedFallback'), text);
    }
  }

  async function shareCurrent() {
    if (!cloud.id || !cloud.shareToken) {
      toast(c('saveFirst'), 'error');
      try { await saveCurrent(); } catch { return; }
    }
    await copyText(readOnlyLink());
    toast(c('linkCopied'), 'success');
  }

  function openManager() {
    q('#cloudModal').classList.add('open');
    q('#cloudSearch').focus();
    loadQuoteList();
  }

  function closeManager() {
    q('#cloudModal').classList.remove('open');
  }

  function formatDate(value) {
    if (!value) return '';
    try {
      return new Intl.DateTimeFormat(state.lang === 'zh' ? 'zh-CN' : state.lang === 'ja' ? 'ja-JP' : state.lang === 'es' ? 'es-ES' : 'en-US', {
        dateStyle: 'medium', timeStyle: 'short',
      }).format(new Date(value));
    } catch { return value; }
  }

  function renderQuoteList(quotes) {
    const root = q('#cloudList');
    if (!quotes.length) {
      root.innerHTML = `<div class="cloud-empty">${escapeHtml(c('noQuotes'))}</div>`;
      return;
    }
    root.innerHTML = `
      <div class="table-wrap"><table class="cloud-table">
        <thead><tr><th>${escapeHtml(c('quoteNumber'))}</th><th>${escapeHtml(c('client'))}</th><th>${escapeHtml(c('status'))}</th><th>${escapeHtml(c('updated'))}</th><th>${escapeHtml(c('actions'))}</th></tr></thead>
        <tbody>${quotes.map((quote) => `<tr>
          <td><strong>${escapeHtml(quote.quoteNumber)}</strong><div class="cloud-meta-line">${escapeHtml(quote.id)}</div></td>
          <td>${escapeHtml(quote.clientCompany || '—')}</td>
          <td>${escapeHtml(quote.status || 'draft')}</td>
          <td>${escapeHtml(formatDate(quote.updatedAt))}</td>
          <td><div class="cloud-actions">
            <button class="cloud-mini" data-cloud-open="${escapeHtml(quote.id)}">${escapeHtml(c('open'))}</button>
            <button class="cloud-mini" data-cloud-clone="${escapeHtml(quote.id)}">${escapeHtml(c('clone'))}</button>
            <button class="cloud-mini" data-cloud-copy="${escapeHtml(quote.shareToken)}">${escapeHtml(c('copyLink'))}</button>
            <button class="cloud-mini danger" data-cloud-delete="${escapeHtml(quote.id)}">${escapeHtml(c('delete'))}</button>
          </div></td>
        </tr>`).join('')}</tbody>
      </table></div>`;
  }

  async function loadQuoteList() {
    const root = q('#cloudList');
    root.innerHTML = '<div class="cloud-loader">Loading…</div>';
    try {
      const search = q('#cloudSearch').value.trim();
      const data = await api(`?search=${encodeURIComponent(search)}&limit=200`);
      renderQuoteList(data.quotes || []);
    } catch (error) {
      root.innerHTML = `<div class="cloud-empty">${escapeHtml(error.message)}</div>`;
    }
  }

  async function openQuote(id) {
    cloud.loading = true;
    renderStatus('loading');
    try {
      const data = await api(`?id=${encodeURIComponent(id)}`);
      applyServerQuote(data.quote);
      closeManager();
    } catch (error) {
      cloud.loading = false;
      renderStatus('error', error.message);
      toast(error.message, 'error');
    }
  }

  async function deleteSavedQuote(id) {
    if (!confirm(c('confirmDelete'))) return;
    try {
      await api('', { method: 'DELETE', body: JSON.stringify({ id }) });
      if (cloud.id === id) freshState();
      await loadQuoteList();
      toast(c('deleteSuccess'), 'success');
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  async function loadInitial() {
    if (new URLSearchParams(location.search).get('api')) {
      localStorage.setItem('itemQuoteApiUrl', API_BASE);
    }

    if (location.hostname.includes('github.io') && !API_BASE) {
      renderStatus('error', c('serverUnavailable'));
      toast(c('serverUnavailable'), 'error');
      return;
    }

    if (location.protocol === 'file:') {
      state.fields.quoteNumber = c('autoNumber');
      const input = q('[data-field="quoteNumber"]');
      if (input) input.value = state.fields.quoteNumber;
      renderStatus('error', c('fileMode'));
      toast(c('fileMode'), 'error');
      return;
    }
    const params = new URL(location.href).searchParams;
    const share = params.get('share');
    const id = params.get('quote');
    if (!share && !id) {
      state.fields.quoteNumber = c('autoNumber');
      const input = q('[data-field="quoteNumber"]');
      if (input) input.value = state.fields.quoteNumber;
      cloud.dirty = true;
      renderStatus('dirty', c('statusNew'));
      return;
    }
    cloud.loading = true;
    renderStatus('loading');
    try {
      const data = share
        ? await api(`?share=${encodeURIComponent(share)}`, {}, false)
        : await api(`?id=${encodeURIComponent(id)}`);
      applyServerQuote(data.quote, { readOnly: Boolean(share) });
    } catch (error) {
      cloud.loading = false;
      renderStatus('error', error.message);
      toast(error.message, 'error');
    }
  }

  function bindEvents() {
    q('#cloudNew').addEventListener('click', newQuote);
    q('#cloudQuotes').addEventListener('click', openManager);
    q('#cloudSave').addEventListener('click', () => saveCurrent().catch(() => {}));
    q('#cloudClone').addEventListener('click', () => cloneCurrent());
    q('#cloudShare').addEventListener('click', shareCurrent);
    q('#cloudClearKey').addEventListener('click', () => {
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      toast(c('signedOut'));
    });
    q('#cloudModalClose').addEventListener('click', closeManager);
    q('#cloudRefresh').addEventListener('click', loadQuoteList);
    q('#cloudSearchBtn').addEventListener('click', loadQuoteList);
    q('#cloudSearch').addEventListener('keydown', (event) => { if (event.key === 'Enter') loadQuoteList(); });
    q('#cloudModal').addEventListener('click', (event) => { if (event.target.id === 'cloudModal') closeManager(); });

    q('#cloudList').addEventListener('click', async (event) => {
      const open = event.target.closest('[data-cloud-open]');
      if (open) { await openQuote(open.dataset.cloudOpen); return; }
      const clone = event.target.closest('[data-cloud-clone]');
      if (clone) { await cloneCurrent(clone.dataset.cloudClone); return; }
      const copy = event.target.closest('[data-cloud-copy]');
      if (copy) { await copyText(readOnlyLink(copy.dataset.cloudCopy)); toast(c('linkCopied'), 'success'); return; }
      const remove = event.target.closest('[data-cloud-delete]');
      if (remove) await deleteSavedQuote(remove.dataset.cloudDelete);
    });

    document.addEventListener('input', (event) => {
      if (event.target.matches('[data-field], .scope-checkbox')) setTimeout(markDirty, 0);
    }, true);
    document.addEventListener('change', (event) => {
      if (event.target.matches('[data-field], .scope-checkbox')) setTimeout(markDirty, 0);
    }, true);
    q('#resetQuote')?.addEventListener('click', () => { const before = JSON.stringify(state); setTimeout(() => { if (JSON.stringify(state) !== before) markDirty(); }, 0); });
    qa('.lang-btn').forEach((button) => button.addEventListener('click', () => setTimeout(() => {
      localizeCloud();
      if (q('#cloudModal').classList.contains('open')) loadQuoteList();
    }, 0)));

    document.addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveCurrent().catch(() => {});
      }
      if (event.key === 'Escape') closeManager();
    });
    window.addEventListener('beforeunload', (event) => {
      if (!cloud.readOnly && cloud.dirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    });
  }

  injectUi();
  bindEvents();
  localizeCloud();
  loadInitial();
})();
