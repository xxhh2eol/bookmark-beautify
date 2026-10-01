// ===== 状态 =====
const state = {
  filterType: 'all',
  filterKey: 'all',
  search: '',
  sort: 'default'
};

let allBookmarks = [];
let folderTree = [];
let domains = [];
const settings = { hideDomainIcons: false, hideContentIcons: false };
let hiddenFolderIds = new Set();
let rootFolderIds = new Set();
let barFolderId = null;
const folderExpansion = new Map();
let dragExpandTimer = null;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const DEFAULT_FOLDER_NAMES = new Set(['收藏夹栏', '书签栏', 'Bookmarks bar', '其他书签', 'Other bookmarks', '移动设备书签', 'Mobile bookmarks', '零散']);
let draggedBookmarkId = null;
let draggedFolderId = null;

// ===== 简单 eTLD+1 聚合 =====
const suffixSet = new Set([
  'com.cn','net.cn','org.cn','gov.cn','com.hk','co.uk','com.tw','co.jp',
  'com.au','co.kr','com.br','com.mx','co.in','org.uk','net.uk','ac.cn'
]);

function isLocalOrPrivateHost(host) {
  const h = String(host || '').toLowerCase().replace(/^www\./i, '').replace(/^\[|\]$/g, '');
  if (!h) return false;
  if (h === 'localhost' || h.endsWith('.localhost') || h === 'localhost.localdomain' || h.endsWith('.local')) return true;
  if (h.includes(':')) {
    return h === '::' || h === '::1' || h.startsWith('fe80:') || h.startsWith('fd') || h.startsWith('fc');
  }
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return false;
  const p = h.split('.').map(Number);
  return p[0] === 127 || p[0] === 10
    || (p[0] === 172 && p[1] >= 16 && p[1] <= 31)
    || (p[0] === 192 && p[1] === 168)
    || (p[0] === 169 && p[1] === 254);
}

function aggregateDomain(host) {
  if (isLocalOrPrivateHost(host)) return 'localhost';
  let h = String(host || '').replace(/^www\./i, '').replace(/^\[|\]$/g, '');
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(':')) return h;
  const parts = h.split('.').filter(Boolean);
  if (parts.length <= 2) return h;
  const last2 = parts.slice(-2).join('.');
  if (suffixSet.has(last2)) return parts.slice(-3).join('.');
  return last2;
}

function hueOf(text) {
  let hash = 0;
  const s = String(text || '').toLowerCase();
  for (let i = 0; i < s.length; i++) hash = ((hash << 5) - hash) + s.charCodeAt(i);
  return Math.abs(hash) % 360;
}

function colorFor(text) {
  return `hsl(${hueOf(text)}, 65%, 54%)`;
}

const COMPOUND_TLDS = ['com.cn','net.cn','org.cn','gov.cn','com.hk','co.uk','com.tw','co.jp','com.au','co.kr','com.br','com.mx','co.in','org.uk','net.uk','ac.cn'];

function splitDomain(domain) {
  const s = String(domain || '');
  for (const sfx of COMPOUND_TLDS) {
    if (s.length > sfx.length + 1 && s.endsWith('.' + sfx)) {
      return { base: s.slice(0, s.length - sfx.length - 1), tld: '.' + sfx };
    }
  }
  const idx = s.lastIndexOf('.');
  if (idx > 0) return { base: s.slice(0, idx), tld: s.slice(idx) };
  return { base: s, tld: '' };
}

function softBadge(hue) {
  if (isDarkTheme()) return { bg: `hsl(${hue}, 40%, 26%)`, text: `hsl(${hue}, 70%, 80%)` };
  return { bg: `hsl(${hue}, 55%, 92%)`, text: `hsl(${hue}, 50%, 38%)` };
}

function folderFill(hue) {
  return isDarkTheme() ? `hsl(${hue}, 45%, 58%)` : `hsl(${hue}, 50%, 48%)`;
}

const FOLDER_GLYPH = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none"><path d="M3 6a2 2 0 0 1 2-2h4a2 2 0 0 1 1.41.59L12 6h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z" fill="#fff"/></svg>';

function folderIcon(fc, cls) {
  const bg = fc ? folderFill(fc.hue) : (isDarkTheme() ? '#323b4d' : '#94a3b8');
  return `<span class="${cls}" style="background:${bg}">${FOLDER_GLYPH}</span>`;
}

function countFolders(folders) {
  return folders.reduce((n, f) => n + 1 + countFolders(f.children), 0);
}

function isDarkTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

function folderColor(name) {
  let hash = 0;
  const s = String(name || '');
  for (let i = 0; i < s.length; i++) hash = ((hash << 5) - hash) + s.charCodeAt(i);
  const hue = Math.abs(hash) % 360;
  if (isDarkTheme()) {
    return {
      hue,
      bg: `hsl(${hue}, 30%, 17%)`,
      border: `hsl(${hue}, 34%, 32%)`,
      text: `hsl(${hue}, 62%, 72%)`,
      hover: `hsl(${hue}, 30%, 24%)`
    };
  }
  return {
    hue,
    bg: `hsl(${hue}, 45%, 96%)`,
    border: `hsl(${hue}, 40%, 80%)`,
    text: `hsl(${hue}, 40%, 45%)`,
    hover: `hsl(${hue}, 45%, 93%)`
  };
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function faviconUrl(url) {
  try {
    new URL(url);
    if (!window.chrome?.runtime?.getURL) return '';
    return chrome.runtime.getURL('/_favicon/?pageUrl=' + encodeURIComponent(url) + '&size=32');
  } catch {
    return '';
  }
}

function bindFaviconFallback(container) {
  container.querySelectorAll('img.favicon-img').forEach(img => {
    img.addEventListener('error', () => {
      const letter = img.dataset.letter || '?';
      const color = img.dataset.color || '#64748b';
      const span = document.createElement('span');
      span.className = 'domain-icon';
      span.style.background = color;
      span.textContent = letter;
      img.replaceWith(span);
    });
  });
}

// ===== 从 chrome.bookmarks 构建数据 =====
function collectBookmarks(nodes, parentPath) {
  const items = [];
  const folders = [];

  function walk(list, path) {
    for (const node of list) {
      if (node.url) {
        let host = '';
        try {
          host = new URL(node.url).hostname || '';
        } catch {
          host = '';
        }
        if (!host) {
          try { host = new URL(node.url).protocol.replace(':', '') || '其他'; }
          catch { host = '其他'; }
        }
        items.push({
          id: node.id,
          title: node.title || host,
          url: node.url,
          host,
          domain: aggregateDomain(host),
          folderId: node.parentId || '',
          folderPath: path,
          dateAdded: node.dateAdded || 0
        });
      } else if (node.children && node.children.length) {
        folders.push({
          id: node.id,
          title: node.title || '未命名',
          parentId: node.parentId || '',
          children: node.children
        });
        walk(node.children, path ? `${path} / ${node.title}` : (node.title || ''));
      }
    }
  }

  walk(nodes, parentPath);
  return { items, folders };
}

// ===== 域名显示名称（人工改名） =====
let customDomainNames = {};

function customNameFor(domain) {
  return customDomainNames[domain] || '';
}

async function saveCustomDomainNames() {
  if (chrome.storage && chrome.storage.local) {
    await new Promise(resolve => chrome.storage.local.set({ customDomainNames }, resolve));
  }
}

function renameDomain(domain) {
  const cur = customDomainNames[domain] || '';
  showInputModal('修改显示名称（留空清除）', cur, (name) => {
    const trimmed = (name || '').trim();
    if (trimmed) customDomainNames[domain] = trimmed;
    else delete customDomainNames[domain];
    saveCustomDomainNames();
    renderDomains();
  });
}

function clearDomainName(domain) {
  delete customDomainNames[domain];
  saveCustomDomainNames();
  renderDomains();
}

function computeDomainGroups(bookmarks) {
  const map = new Map();
  for (const b of bookmarks) {
    if (!map.has(b.domain)) {
      map.set(b.domain, { domain: b.domain, count: 0, color: colorFor(b.domain) });
    }
    const g = map.get(b.domain);
    g.count++;
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.domain.localeCompare(b.domain));
}

function buildFolderTree(nodes) {
  return nodes
    .filter(n => !n.url)
    .map(n => {
      const children = buildFolderTree(n.children || []);
      return {
        id: n.id,
        title: n.title || '未命名',
        children
      };
    });
}

function findBookmarkBar(roots) {
  return roots.find(n => n.folderType === 'bookmarks-bar') || roots.find(n => n.id === '1') || roots.find(n => n.title === '收藏夹栏' || n.title === '书签栏' || n.title === 'Bookmarks bar');
}

function buildDisplayFolderTree(roots) {
  const bar = findBookmarkBar(roots);
  const others = roots.filter(n => !n.url && n !== bar);
  const loose = { id: '__loose__', title: '零散', emoji: '📄', children: [] };
  const barChildren = bar ? buildFolderTree(bar.children || []) : [];
  const otherNodes = others.map(n => ({
    id: n.id,
    title: n.title || '未命名',
    children: buildFolderTree(n.children || [])
  }));
  return [loose, ...barChildren, ...otherNodes];
}

async function loadChromeBookmarks() {
  await loadSettings();
  if (!window.chrome || !chrome.bookmarks || typeof chrome.bookmarks.getTree !== 'function') {
    document.body.innerHTML = '<div class="empty-state"><span class="domain-name" style="font-size:14px">请作为 Chrome 扩展加载本页</span></div>';
    return;
  }

  const tree = await bookmarksCall('getTree');
  const roots = tree && tree[0] && tree[0].children ? tree[0].children : [];
  const { items } = collectBookmarks(roots, '');
  allBookmarks = items;
  rootFolderIds = new Set(roots.filter(n => !n.url).map(n => n.id));
  barFolderId = findBookmarkBar(roots)?.id || null;
  folderTree = buildDisplayFolderTree(roots);
  domains = computeDomainGroups(allBookmarks);
  renderDomains();
  renderFolders();
  renderContent();
}

async function loadSettings() {
  if (!window.chrome?.storage?.local) return;
  const data = await new Promise(resolve => chrome.storage.local.get(['hideDomainIcons', 'hideContentIcons', 'hiddenFolders', 'darkMode', 'customDomainNames'], resolve));
  settings.hideDomainIcons = !!data.hideDomainIcons;
  settings.hideContentIcons = !!data.hideContentIcons;
  $('#hideDomainIcons').checked = settings.hideDomainIcons;
  $('#hideContentIcons').checked = settings.hideContentIcons;
  document.documentElement.classList.toggle('hide-domain-icons', settings.hideDomainIcons);
  document.documentElement.classList.toggle('hide-content-icons', settings.hideContentIcons);
  document.documentElement.dataset.theme = data.darkMode ? 'dark' : 'light';
  $('#darkMode').checked = !!data.darkMode;
  hiddenFolderIds = new Set(data.hiddenFolders || []);
  customDomainNames = data.customDomainNames || {};
}


let contextMenuReturnFocus = null;

function hideContextMenu(restoreFocus = false) {
  const menu = $('#contextMenu');
  const wasOpen = menu && !menu.hidden;
  if (menu) menu.hidden = true;
  if (restoreFocus === true && wasOpen && contextMenuReturnFocus?.isConnected) contextMenuReturnFocus.focus();
}

function openContextMenu(x, y, items) {
  const menu = $('#contextMenu');
  contextMenuReturnFocus = document.activeElement;
  menu.innerHTML = '';
  items.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'context-item' + (item.danger ? ' danger' : '');
    btn.textContent = item.label;
    btn.addEventListener('click', () => {
      menu.hidden = true;
      Promise.resolve().then(() => item.run()).catch(reportActionError);
    });
    menu.appendChild(btn);
  });
  menu.hidden = false;
  menu.style.left = Math.max(8, Math.min(x, window.innerWidth - menu.offsetWidth - 8)) + 'px';
  menu.style.top = Math.max(8, Math.min(y, window.innerHeight - menu.offsetHeight - 8)) + 'px';
  menu.querySelector('button')?.focus();
}

document.addEventListener('click', hideContextMenu);
$('#contextMenu').addEventListener('keydown', e => {
  if (!['ArrowDown', 'ArrowUp'].includes(e.key)) return;
  e.preventDefault();
  const buttons = [...$('#contextMenu').querySelectorAll('button')];
  const index = buttons.indexOf(document.activeElement);
  buttons[(index + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
});
document.addEventListener('contextmenu', (e) => {
  if (!e.target.closest('#contextMenu')) hideContextMenu();
});

let modalOnOk = null;
let undoStack = [];
let undoToastTimer = null;

function showInputModal(title, value, onOk) {
  modalOnOk = onOk;
  $('#appModalTitle').textContent = title;
  const input = $('#appModalInput');
  input.hidden = false;
  input.value = value || '';
  $('#appModal').hidden = false;
  input.focus();
  input.select();
}

function showConfirmModal(title, message, onOk) {
  modalOnOk = onOk;
  $('#appModalTitle').textContent = title + '\n' + message;
  const input = $('#appModalInput');
  input.hidden = true;
  input.value = '';
  $('#appModal').hidden = false;
}

function hideModal() {
  $('#appModal').hidden = true;
  modalOnOk = null;
}

function showUndoToast(text) {
  clearTimeout(undoToastTimer);
  $('#undoText').textContent = text;
  $('#undoToast').hidden = false;
  undoToastTimer = setTimeout(() => { $('#undoToast').hidden = true; }, 6000);
}

function pushUndo(item) {
  undoStack.push(item);
  showUndoToast('已删除，可撤销');
}

async function createTreeFromSnapshot(snapshot, parentId, index, mapping = new Map()) {
  if (!snapshot) return;
  if (snapshot.url) {
    await bookmarksCall('create', {
      parentId, index, title: snapshot.title || '', url: snapshot.url
    });
    return;
  }
  const created = await bookmarksCall('create', {
    parentId, index, title: snapshot.title || '未命名'
  });
  mapping.set(snapshot.id, created.id);
  let childIndex = 0;
  for (const child of (snapshot.children || [])) {
    await createTreeFromSnapshot(child, created.id, childIndex++, mapping);
  }
}

async function restoreWantedFolder(snapshot, parentId, index, mapping) {
  if (!snapshot) return;
  if (snapshot.url) {
    await bookmarksCall('move', snapshot.id, { parentId, index });
    return;
  }
  const created = await bookmarksCall('create', {
    parentId, index, title: snapshot.title || '未命名'
  });
  mapping.set(snapshot.id, created.id);
  let childIndex = 0;
  for (const child of (snapshot.children || [])) {
    await restoreWantedFolder(child, created.id, childIndex++, mapping);
  }
}

async function saveHiddenFolders() {
  if (chrome.storage && chrome.storage.local) {
    await new Promise(resolve => chrome.storage.local.set({ hiddenFolders: [...hiddenFolderIds] }, resolve));
  }
}

async function renameBookmark(id, currentTitle) {
  const title = prompt('请输入新的收藏标题：', currentTitle);
  if (!title || !title.trim()) return;
  await bookmarksCall('update', id, { title: title.trim() });
  await loadChromeBookmarks();
}

async function renameFolder(id, currentTitle) {
  const title = prompt('请输入新的文件夹名称：', currentTitle);
  if (!title || !title.trim()) return;
  await bookmarksCall('update', id, { title: title.trim() });
  await loadChromeBookmarks();
}

async function deleteBookmark(id) {
  if (!confirm('确定删除这个收藏网址吗？')) return;
  await bookmarksCall('remove', id);
  await loadChromeBookmarks();
}

async function getFolderParentId(id) {
  if (!chrome.bookmarks || !chrome.bookmarks.get) return '';
  const nodes = await bookmarksCall('get', id);
  return nodes && nodes[0] ? nodes[0].parentId : '';
}

async function deleteFolderRelease(id) {
  const parentId = await getFolderParentId(id);
  const ids = collectFolderIds(id);
  const toMove = allBookmarks.filter(b => ids.includes(b.folderId));
  for (const b of toMove) {
    if (parentId) {
      await bookmarksCall('move', b.id, { parentId });
    }
  }
  await bookmarksCall('removeTree', id);
    ids.forEach(x => hiddenFolderIds.delete(x));
    await saveHiddenFolders();
  await loadChromeBookmarks();
}

async function deleteFolderWithContent(id) {
  if (!confirm('确定连同内部所有网址一起删除这个文件夹吗？')) return;
    const ids = collectFolderIds(id);
  await bookmarksCall('removeTree', id);
    ids.forEach(x => hiddenFolderIds.delete(x));
    await saveHiddenFolders();
  await loadChromeBookmarks();
}

async function toggleFolderHidden(id) {
  if (hiddenFolderIds.has(id)) hiddenFolderIds.delete(id);
  else hiddenFolderIds.add(id);
  await saveHiddenFolders();
  renderFolders();
  renderContent();
}

// 新版弹窗版改名 / 删除
function renameBookmarkModal(id, currentTitle) {
  showInputModal('修改网址标题', currentTitle, async (title) => {
    if (!title || !title.trim()) return;
    await bookmarksCall('update', id, { title: title.trim() });
    await loadChromeBookmarks();
  });
}

async function pinBookmark(id) {
    const nodes = await bookmarksCall('get', id);
    const node = nodes && nodes[0];
    if (!node) return;
    await bookmarksCall('move', id, { parentId: node.parentId, index: 0 });
    await loadChromeBookmarks();
  }

  function renameFolderModal(id, currentTitle) {
  showInputModal('修改文件夹名称', currentTitle, async (title) => {
    if (!title || !title.trim()) return;
    await bookmarksCall('update', id, { title: title.trim() });
    await loadChromeBookmarks();
  });
}

async function addFolder() {
  if (!barFolderId) return;
  const created = await bookmarksCall('create', { parentId: barFolderId, title: '新建文件夹' });
  await loadChromeBookmarks();
  renameFolderModal(created.id, '新建文件夹');
}

function deleteBookmarkModal(id) {
  showConfirmModal('删除网址', '确定删除这个收藏网址吗？', async () => {
    const nodes = await bookmarksCall('get', id);
    const node = nodes && nodes[0];
    await bookmarksCall('remove', id);
    if (node) pushUndo({ kind: 'url', node });
    await loadChromeBookmarks();
  });
}

function deleteFolderReleaseModal(id) {
  showConfirmModal('删除文件夹', '释放内部网址并删除文件夹？', async () => {
    const subtree = await bookmarksCall('getSubTree', id);
    const snapshot = subtree && subtree[0];
    const parentId = await getFolderParentId(id);
    const ids = collectFolderIds(id);
    const hiddenIds = ids.filter(folderId => hiddenFolderIds.has(folderId));
    const toMove = allBookmarks.filter(b => ids.includes(b.folderId));
    for (const b of toMove) {
      if (parentId) {
        await bookmarksCall('move', b.id, { parentId });
      }
    }
    await bookmarksCall('removeTree', id);
    ids.forEach(x => hiddenFolderIds.delete(x));
    await saveHiddenFolders();
    if (snapshot) pushUndo({ kind: 'release', snapshot, hiddenIds });
    await loadChromeBookmarks();
  });
}

function deleteFolderWithContentModal(id) {
  showConfirmModal('删除文件夹', '确定连同内部所有网址一起删除这个文件夹吗？', async () => {
    const subtree = await bookmarksCall('getSubTree', id);
    const snapshot = subtree && subtree[0];
    const ids = collectFolderIds(id);
    const hiddenIds = ids.filter(folderId => hiddenFolderIds.has(folderId));
    await bookmarksCall('removeTree', id);
    ids.forEach(x => hiddenFolderIds.delete(x));
    await saveHiddenFolders();
    if (snapshot) pushUndo({ kind: 'folder', snapshot, hiddenIds });
    await loadChromeBookmarks();
  });
}

async function performUndo() {
  const item = undoStack.pop();
  if (!item) return;
  try {
    const mapping = new Map();
    if (item.kind === 'url' && item.node) {
      await bookmarksCall('create', {
        parentId: item.node.parentId,
        index: item.node.index,
        title: item.node.title || '',
        url: item.node.url
      });
    } else if (item.kind === 'folder' && item.snapshot) {
      await createTreeFromSnapshot(item.snapshot, item.snapshot.parentId || '0', item.snapshot.index || 0, mapping);
    } else if (item.kind === 'release' && item.snapshot) {
      await restoreWantedFolder(item.snapshot, item.snapshot.parentId || '0', item.snapshot.index || 0, mapping);
    }
    (item.hiddenIds || []).forEach(id => {
      if (mapping.has(id)) hiddenFolderIds.add(mapping.get(id));
    });
    await saveHiddenFolders();
    await loadChromeBookmarks();
    $('#undoToast').hidden = true;
  } catch (err) {
    reportActionError(err);
  }
}
// ===== 渲染 =====
function folderById(id) {
  let found = null;
  (function walk(list) {
    for (const f of list) {
      if (f.id === id) { found = f; return; }
      if (f.children.length) walk(f.children);
    }
  })(folderTree);
  return found;
}

function collectFolderIds(folderId) {
  const ids = [];
  const walk = (f) => {
    ids.push(f.id);
    f.children.forEach(walk);
  };
  const root = folderById(folderId);
  if (root) walk(root);
  return ids;
}

// 零散是直属浏览器系统根目录、未放入用户文件夹的书签。
function isLooseBookmark(b) {
  return rootFolderIds.has(b.folderId);
}

function isMatch(b, filter) {
  const q = state.search.trim().toLowerCase();
  if (filter.type === 'domain' && b.domain !== filter.key) return false;
  if (filter.type === 'folder') {
    if (filter.key === '__loose__') {
        if (!isLooseBookmark(b)) return false;
      } else {
        const ids = collectFolderIds(filter.key);
    if (!ids.includes(b.folderId)) return false;
      }
  }
  if (q) {
    const hay = [b.title, b.url, b.host, b.domain, b.folderPath].join(' ').toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

function sorted(list) {
  const arr = [...list];
  switch (state.sort) {
    case 'name': arr.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN')); break;
    case 'name-desc': arr.sort((a, b) => b.title.localeCompare(a.title, 'zh-CN')); break;
    case 'recent': arr.sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0)); break;
  }
  return arr;
}

function updateBookmarkColumns(container) {
  const list = container || $('#bookmarkList');
  if (!list) return;
  const minColWidth = 180;
  const gap = 8;
  const width = list.clientWidth || 600;
  let cols = Math.floor((width + gap) / (minColWidth + gap));
  cols = Math.max(1, Math.min(5, cols));
  list.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
}

function updateAllColumns() {
  const grids = $$('#bookmarkList .bookmark-grid');
  if (grids.length) {
    grids.forEach(grid => updateBookmarkColumns(grid));
  } else {
    updateBookmarkColumns($('#bookmarkList'));
  }
}

function bindBookmarkDrag(list) {
  list.querySelectorAll('.bookmark-item').forEach(item => {
    item.addEventListener('dragstart', (e) => {
      clearDragState();
      draggedBookmarkId = item.dataset.id;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', draggedBookmarkId);
    });
    item.addEventListener('dragend', clearDragState);
    item.addEventListener('dragover', (e) => {
      if (!draggedBookmarkId || draggedBookmarkId === item.dataset.id || state.sort !== 'default') return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      clearDragMarks();
      const rect = item.getBoundingClientRect();
      item.classList.add(e.clientX < rect.left + rect.width / 2 ? 'drag-before' : 'drag-after');
    });
    item.addEventListener('dragleave', () => clearDragMarks());
    item.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const sourceId = draggedBookmarkId;
      const targetId = item.dataset.id;
      const rect = item.getBoundingClientRect();
      const before = e.clientX < rect.left + rect.width / 2;
      clearDragState();
      if (!sourceId || sourceId === targetId || state.sort !== 'default') return;
      try {
        await moveRelative(sourceId, targetId, before);
        await loadChromeBookmarks();
      } catch (error) {
        reportMoveError(error);
      }
    });
  });
}

function renderDomains() {
  const list = $('#domainList');
  if (!$('#domainTotal')) return;
  $('#domainTotal').textContent = domains.length;
  if (!domains.length) {
    list.innerHTML = '<div class="empty-state">暂无收藏网址</div>';
    return;
  }
  list.innerHTML = domains.map(g => {
    const active = state.filterType === 'domain' && state.filterKey === g.domain;
    const isLocal = g.domain === 'localhost';
    const sp = splitDomain(g.domain);
    const icon = isLocal
      ? '<span class="domain-icon" style="background:#64748b">L</span>'
      : `<img class="domain-icon favicon-img" src="${faviconUrl('https://' + g.domain + '/')}" alt="" draggable="false" data-letter="${g.domain[0].toUpperCase()}" data-color="${g.color}">`;
    const name = customNameFor(g.domain);
    const titleSnippet = name ? `<span class="domain-title" title="右键可改名">${escapeHtml(name)}</span>` : '';
    return `<div class="domain-item ${active ? 'active' : ''}" data-domain="${g.domain}" role="button" tabindex="0" aria-pressed="${active}" title="${escapeHtml(name ? name + ' · ' + g.domain : g.domain)}">
      ${icon}
      <span class="domain-info">
        <span class="domain-name">${titleSnippet}<span class="domain-host">${sp.base}<span class="domain-tld">${sp.tld}</span></span></span>
      </span>
      <span class="domain-count">${g.count}</span>
    </div>`;
  }).join('');
    bindFaviconFallback(list);

  $$('#domainList .domain-item').forEach(el => {
    el.addEventListener('keydown', activateRowWithKeyboard);
    el.addEventListener('click', () => {
      const key = el.dataset.domain;
      if (state.filterType === 'domain' && state.filterKey === key) {
        state.filterType = 'all';
        state.filterKey = 'all';
      } else {
        state.filterType = 'domain';
        state.filterKey = key;
      }
      renderDomains();
      renderFolders();
      renderContent();
    });
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = el.dataset.domain;
      openContextMenu(e.clientX, e.clientY, [
        { label: '改名', run: () => renameDomain(id) },
        ...(customDomainNames[id] ? [{ label: '清除名称', danger: true, run: () => clearDomainName(id) }] : [])
      ]);
    });
  });
}

function renderFolders() {
  const counts = new Map();
  allBookmarks.forEach(b => counts.set(b.folderId, (counts.get(b.folderId) || 0) + 1));
  if ($('#folderTotal')) $('#folderTotal').textContent = countFolders(folderTree);

  const renderTree = (items, deep) => items.map(f => {
    const direct = counts.get(f.id) || 0;
    const allInFolder = f.id === '__loose__'
        ? allBookmarks.filter(b => isLooseBookmark(b)).length
        : direct + f.children.reduce((sum, c) => sum + allCountOf(c, counts), 0);
    const expanded = folderExpansion.get(f.id) ?? (deep < 1);
    const active = state.filterType === 'folder' && state.filterKey === f.id;
    const fc = DEFAULT_FOLDER_NAMES.has(f.title) ? null : folderColor(f.title);
    return `<li class="tree-item">
      <div class="tree-row ${active ? 'active' : ''} ${expanded ? 'expanded' : ''} ${hiddenFolderIds.has(f.id) ? 'hidden-folder' : ''}" data-folder="${f.id}" role="button" tabindex="0" aria-pressed="${active}" draggable="${f.id === '__loose__' || rootFolderIds.has(f.id) ? 'false' : 'true'}" style="${deep ? '' : 'font-weight:600'}">
        ${f.children.length ? `<button type="button" class="tree-arrow" aria-label="展开或折叠 ${escapeHtml(f.title)}" aria-expanded="${expanded}">›</button>` : '<span class="tree-arrow"></span>'}
        ${folderIcon(fc, 'tree-icon')}
        <span class="tree-label">${escapeHtml(f.title)}</span>
        <span class="tree-count">${allInFolder}</span>
        ${f.id === '__loose__' || rootFolderIds.has(f.id) ? '' : `<button class="row-menu" type="button" aria-label="管理文件夹 ${escapeHtml(f.title)}" title="管理文件夹" draggable="false">⋯</button>`}
      </div>
      ${f.children.length ? `<ul class="tree-children ${expanded ? 'open' : ''}">${renderTree(f.children, deep + 1)}</ul>` : ''}
    </li>`;
  }).join('');

  $('#folderTree').innerHTML = renderTree(folderTree, 0);

  $$('#folderTree .tree-row').forEach(row => {
    row.addEventListener('keydown', activateRowWithKeyboard);
    bindRowMenu(row, () => folderMenuItems(row.dataset.folder));
    row.addEventListener('click', (e) => {
      e.stopPropagation();
      if (e.target.closest('.row-menu')) return;
      const id = row.dataset.folder;
      if (e.target.closest('.tree-arrow') && row.nextElementSibling) {
        row.classList.toggle('expanded');
        const children = row.nextElementSibling;
        if (children) children.classList.toggle('open');
        folderExpansion.set(id, row.classList.contains('expanded'));
        row.querySelector('.tree-arrow').setAttribute('aria-expanded', row.classList.contains('expanded'));
        return;
      }
      if (state.filterType === 'folder' && state.filterKey === id) {
        state.filterType = 'all';
        state.filterKey = 'all';
      } else {
        state.filterType = 'folder';
        state.filterKey = id;
      }
      renderDomains();
      renderFolders();
      renderContent();
    });
      row.title = row.dataset.folder === '__loose__'
        ? '未放入文件夹的书签；拖入书签可移出文件夹，拖入文件夹可移回顶层'
        : '拖到上/下边缘排序，拖到中间移入文件夹；悬停展开子级';
      row.addEventListener('dragstart', (e) => {
        if (row.draggable === false) { e.preventDefault(); return; }
        clearDragState();
        draggedFolderId = row.dataset.folder;
        row.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggedFolderId);
      });
      row.addEventListener('dragend', clearDragState);
      row.addEventListener('dragover', (e) => {
        const sourceId = draggedFolderId || draggedBookmarkId;
        const position = folderDropPosition(e, row);
        if (!canDropOnFolder(sourceId, row.dataset.folder, position)) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        clearDragMarks(row);
        row.classList.remove('drop-target', 'drag-before', 'drag-after');
        row.classList.add(position === 'inside' ? 'drop-target' : 'drag-' + position);
        if (position === 'inside' && row.nextElementSibling && !row.classList.contains('expanded')) {
          if (!dragExpandTimer) dragExpandTimer = setTimeout(() => {
            row.classList.add('expanded');
            row.nextElementSibling.classList.add('open');
            folderExpansion.set(row.dataset.folder, true);
            dragExpandTimer = null;
          }, 650);
        } else {
          clearTimeout(dragExpandTimer);
          dragExpandTimer = null;
        }
      });
      row.addEventListener('dragleave', (e) => {
        if (row.contains(e.relatedTarget)) return;
        clearDragMarks();
        clearTimeout(dragExpandTimer);
        dragExpandTimer = null;
      });
      row.addEventListener('drop', (e) => handleFolderDrop(e, row));
      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const items = folderMenuItems(row.dataset.folder);
        if (items.length) openContextMenu(e.clientX, e.clientY, items);
      });
  });
}

function allCountOf(f, counts) {
  return (counts.get(f.id) || 0) + f.children.reduce((sum, c) => sum + allCountOf(c, counts), 0);
}

// 找到一个文件夹所属的“根目录”（直接挂在书签树根下的那一层的 id）
async function getRootAncestorId(folderId) {
  let id = folderId;
  let guard = 0;
  while (id && guard++ < 64) {
    const nodes = await bookmarksCall('get', id);
    const node = nodes && nodes[0];
    if (!node) break;
    if (rootFolderIds.has(node.id)) return node.id;
    id = node.parentId;
  }
  return null;
}

// 回调 API 必须在回调内读取 lastError，否则拖拽失败会被误报为成功。
function bookmarksCall(method, ...args) {
  return new Promise((resolve, reject) => {
    chrome.bookmarks[method](...args, result => {
      const error = chrome.runtime?.lastError;
      if (error) reject(new Error(error.message));
      else resolve(result);
    });
  });
}

function clearDragMarks(except) {
  $$('.tree-row, .bookmark-item').forEach(el => {
    if (el !== except) el.classList.remove('drop-target', 'drag-over', 'drag-before', 'drag-after');
  });
}

function clearDragState() {
  draggedFolderId = null;
  draggedBookmarkId = null;
  clearTimeout(dragExpandTimer);
  dragExpandTimer = null;
  clearDragMarks();
  $$('.tree-row.dragging, .bookmark-item.dragging').forEach(el => el.classList.remove('dragging'));
}

function folderDropPosition(e, row) {
  if (row.dataset.folder === '__loose__' || rootFolderIds.has(row.dataset.folder)) return 'inside';
  const rect = row.getBoundingClientRect();
  const ratio = (e.clientY - rect.top) / rect.height;
  return ratio < 0.25 ? 'before' : ratio > 0.75 ? 'after' : 'inside';
}

function canDropOnFolder(sourceId, targetId, position) {
  if (!sourceId || sourceId === targetId || rootFolderIds.has(sourceId)) return false;
  if (sourceId === '__loose__') return false;
  if (targetId === '__loose__') return true;
  if (!folderById(targetId)) return false;
  if (rootFolderIds.has(targetId) && position !== 'inside') return false;
  return !collectFolderIds(sourceId).includes(targetId);
}

async function moveRelative(sourceId, targetId, before) {
  const [target] = await bookmarksCall('get', targetId);
  if (!target?.parentId) throw new Error('目标已不存在，请刷新后重试');
  const siblings = await bookmarksCall('getChildren', target.parentId);
  const index = siblings.findIndex(node => node.id === targetId);
  if (index < 0) throw new Error('目标已不存在，请刷新后重试');
  // Chrome 的 index 使用移动前的完整子项顺序（包括文件夹）。
  await bookmarksCall('move', sourceId, { parentId: target.parentId, index: index + (before ? 0 : 1) });
}

function reportActionError(error, title = '操作失败') {
  console.error(error);
  showConfirmModal(title, error.message || '操作未完成，请刷新后重试', null);
}

function reportMoveError(error) {
  reportActionError(error, '移动失败');
}

async function handleFolderDrop(e, targetRow) {
  e.preventDefault();
  e.stopPropagation();
  const sourceId = draggedFolderId || draggedBookmarkId;
  const targetId = targetRow.dataset.folder;
  const position = folderDropPosition(e, targetRow);
  const allowed = canDropOnFolder(sourceId, targetId, position);
  clearDragState();
  if (!allowed) return;
  try {
    if (targetId === '__loose__') {
      const [source] = await bookmarksCall('get', sourceId);
      const rootId = await getRootAncestorId(source.parentId);
      if (!rootId) throw new Error('找不到所属的收藏夹根目录');
      await bookmarksCall('move', sourceId, { parentId: rootId });
    } else if (position === 'inside') {
      await bookmarksCall('move', sourceId, { parentId: targetId });
      folderExpansion.set(targetId, true);
    } else {
      await moveRelative(sourceId, targetId, position === 'before');
    }
    await loadChromeBookmarks();
  } catch (error) {
    reportMoveError(error);
  }
}

function activateRowWithKeyboard(e) {
  if (e.target !== e.currentTarget || !['Enter', ' '].includes(e.key)) return;
  e.preventDefault();
  const row = e.currentTarget;
  const selector = row.dataset.folder ? `[data-folder="${CSS.escape(row.dataset.folder)}"]` : `[data-domain="${CSS.escape(row.dataset.domain)}"]`;
  row.click();
  document.querySelector(selector)?.focus();
}

function folderMenuItems(id) {
  const folder = folderById(id);
  if (!folder || id === '__loose__' || rootFolderIds.has(id)) return [];
  return [
    { label: '改名', run: () => renameFolderModal(id, folder.title) },
    { label: hiddenFolderIds.has(id) ? '取消隐藏内容' : '隐藏内容', run: () => toggleFolderHidden(id) },
    { label: '删除文件夹：释放内部网址', danger: true, run: () => deleteFolderReleaseModal(id) },
    { label: '删除文件夹：连同内容删除', danger: true, run: () => deleteFolderWithContentModal(id) }
  ];
}

function bookmarkMenuItems(b) {
  return [
    { label: '置顶', run: () => pinBookmark(b.id) },
    { label: '改名', run: () => renameBookmarkModal(b.id, b.title) },
    { label: '删除', danger: true, run: () => deleteBookmarkModal(b.id) }
  ];
}

function bindRowMenu(row, getItems) {
  const button = row.querySelector('.row-menu');
  if (!button) return;
  button.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    hideBookmarkTooltip();
    const rect = button.getBoundingClientRect();
    openContextMenu(rect.right, rect.bottom + 4, getItems());
  });
  button.addEventListener('mousedown', e => e.stopPropagation());
}

let bookmarkTooltipTimer;
function hideBookmarkTooltip() {
  clearTimeout(bookmarkTooltipTimer);
  const tooltip = $('#bookmarkTooltip');
  if (tooltip) tooltip.hidden = true;
}

function showBookmarkTooltip(link, b) {
  const tooltip = $('#bookmarkTooltip');
  if (!tooltip) return;
  tooltip.textContent = [b.title || b.url, b.url, b.folderPath || '零散'].join('\n');
  tooltip.hidden = false;
  const rect = link.getBoundingClientRect();
  tooltip.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - tooltip.offsetWidth - 8)) + 'px';
  const top = rect.bottom + 6;
  tooltip.style.top = (top + tooltip.offsetHeight < window.innerHeight - 8 ? top : Math.max(8, rect.top - tooltip.offsetHeight - 6)) + 'px';
}

function renderBookmarkItem(b) {
  const color = colorFor(b.domain);
  const title = b.title || b.url;
  return `<div class="domain-item bookmark-item" draggable="true" data-id="${b.id}">
    <a class="bookmark-link" href="${escapeHtml(b.url)}" target="_blank" rel="noopener" aria-label="${escapeHtml(title + ' · ' + (b.host || b.domain || ''))}" aria-describedby="bookmarkTooltip" draggable="false">
      <img class="domain-icon favicon-img" src="${faviconUrl(b.url)}" alt="" draggable="false" data-letter="${escapeHtml((title || b.host || '?')[0].toUpperCase())}" data-color="${color}">
      <span class="domain-info"><span class="domain-name">${escapeHtml(title)}</span></span>
    </a>
    <button class="row-menu" type="button" aria-label="管理书签 ${escapeHtml(title)}" title="管理书签" draggable="false">⋯</button>
  </div>`;
}

function bindInnerList(list) {
  bindFaviconFallback(list);
  bindBookmarkDrag(list);
  list.querySelectorAll('.bookmark-item').forEach(item => {
    const b = allBookmarks.find(x => x.id === item.dataset.id);
    if (!b) return;
    bindRowMenu(item, () => bookmarkMenuItems(b));
    item.addEventListener('contextmenu', e => {
      e.preventDefault();
      e.stopPropagation();
      hideBookmarkTooltip();
      openContextMenu(e.clientX, e.clientY, bookmarkMenuItems(b));
    });
    const link = item.querySelector('.bookmark-link');
    link.addEventListener('mouseenter', () => {
      hideBookmarkTooltip();
      bookmarkTooltipTimer = setTimeout(() => showBookmarkTooltip(link, b), 450);
    });
    link.addEventListener('mouseleave', hideBookmarkTooltip);
    link.addEventListener('focus', () => { hideBookmarkTooltip(); showBookmarkTooltip(link, b); });
    link.addEventListener('blur', hideBookmarkTooltip);
    link.addEventListener('click', hideBookmarkTooltip);
    item.addEventListener('dragstart', hideBookmarkTooltip);
  });
}

function renderViewStatus(count) {
  let label = '全部书签';
  if (state.filterType === 'domain') label = customNameFor(state.filterKey) || state.filterKey;
  if (state.filterType === 'folder') label = folderById(state.filterKey)?.title || '收藏夹';
  const labelEl = $('#filterLabel');
  if (labelEl) { labelEl.textContent = label; labelEl.title = label; }
  const countEl = $('#resultCount');
  if (countEl) countEl.textContent = `${count} ${state.search.trim() ? '个匹配' : '个书签'}`;
  const clearFilter = $('#clearFilterBtn');
  if (clearFilter) clearFilter.hidden = state.filterType === 'all';
  const clearSearch = $('#clearSearchBtn');
  if (clearSearch) clearSearch.hidden = !state.search;
  const allBtn = $('#allBtn');
  if (allBtn) {
    const active = state.filterType === 'all' && !state.search;
    allBtn.classList.toggle('active', active);
    allBtn.setAttribute('aria-pressed', active);
  }
}

function clearFilters(clearSearch = false) {
  state.filterType = 'all';
  state.filterKey = 'all';
  if (clearSearch) { state.search = ''; $('#searchInput').value = ''; }
  renderDomains();
  renderFolders();
  renderContent();
}

function groupByFolder(bookmarks) {
  const map = new Map();
  const loose = { id: '__loose__', items: [] };
  for (const b of bookmarks) {
    if (isLooseBookmark(b)) {
      loose.items.push(b);
      continue;
    }
    if (!map.has(b.folderId)) map.set(b.folderId, { id: b.folderId, items: [] });
    map.get(b.folderId).items.push(b);
  }
  return [...(loose.items.length ? [loose] : []), ...map.values()];
}

function renderContent() {
  hideBookmarkTooltip();
  const filter = { type: state.filterType, key: state.filterKey };
  let base = allBookmarks.filter(b => isMatch(b, filter));
  if (state.filterType === 'all') {
    const hiddenSet = new Set();
    hiddenFolderIds.forEach(id => collectFolderIds(id).forEach(x => hiddenSet.add(x)));
    base = base.filter(b => !hiddenSet.has(b.folderId));
  }
  const list = $('#bookmarkList');
  renderViewStatus(base.length);

  if (!base.length) {
    list.className = 'bookmark-list';
    list.innerHTML = '<div class="empty-state" style="grid-column:1 / -1">暂无匹配网址</div>';
    return;
  }

  if (state.filterType === 'all') {
    const groups = groupByFolder(base);
    list.className = 'bookmark-list grouped';
    list.innerHTML = groups.map(g => {
      const items = sorted(g.items);
      const path = g.id === '__loose__' ? '零散' : (g.items[0].folderPath || '');
      const leaf = path ? path.split(' / ').pop() : '';
      const fc = leaf && !DEFAULT_FOLDER_NAMES.has(leaf) ? folderColor(leaf) : null;
      return `<section class="folder-group ${fc ? '' : 'neutral'}" style="--group-color:${fc ? fc.border : 'var(--border-strong)'};">
        <header class="folder-group-head">
          ${folderIcon(fc, 'fg-icon')}
          <span class="fg-title">${escapeHtml(path || leaf || '未分类')}</span>
          <span class="fg-count">${items.length}</span>
        </header>
        <div class="bookmark-grid">${items.map(b => renderBookmarkItem(b)).join('')}</div>
      </section>`;
    }).join('');
    updateAllColumns();
    bindInnerList(list);
  } else {
    if (state.filterType === 'folder' && state.filterKey === '__loose__') {
      renderLooseView(list, base);
    } else {
      const items = sorted(base);
      list.className = 'bookmark-list';
      list.innerHTML = items.map(b => renderBookmarkItem(b)).join('');
      updateAllColumns();
      bindInnerList(list);
    }
  }
}

// 零散与其他筛选使用相同的搜索、排序与书签交互。
function renderLooseView(list, base) {
  list.className = 'bookmark-list';
  list.innerHTML = sorted(base).map(b => renderBookmarkItem(b)).join('');
  updateAllColumns();
  bindInnerList(list);
}

// ===== 顶栏事件 =====
$('#searchInput').addEventListener('input', (e) => {
  state.search = e.target.value;
  renderContent();
});

$('#sortSelect').addEventListener('change', (e) => {
  state.sort = e.target.value;
  renderContent();
});

  $('#homeBtn').addEventListener('click', () => {
    state.filterType = 'all';
    state.filterKey = 'all';
    state.search = '';
    state.sort = 'default';
    $('#searchInput').value = '';
    $('#sortSelect').value = 'default';
    renderDomains();
    renderFolders();
    renderContent();
  });

  $('#allBtn').addEventListener('click', () => clearFilters(true));
  $('#clearFilterBtn').addEventListener('click', () => clearFilters());
  $('#clearSearchBtn').addEventListener('click', () => {
    state.search = '';
    $('#searchInput').value = '';
    renderContent();
    $('#searchInput').focus();
  });
  $('#addFolderBtn').addEventListener('click', () => addFolder());
  document.addEventListener('keydown', e => {
    const editing = e.target.matches('input, textarea, select, [contenteditable="true"]');
    if ((e.key === '/' && !editing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
      e.preventDefault();
      $('#searchInput').focus();
    }
    if (e.key === 'Escape') {
      hideContextMenu(true);
      hideBookmarkTooltip();
      $('#settingsPanel').hidden = true;
      $('#settingsBtn').setAttribute('aria-expanded', 'false');
    }
  });
  $('#bookmarkList').addEventListener('scroll', hideBookmarkTooltip);

  $('#refreshBtn').addEventListener('click', () => {
    loadChromeBookmarks().catch(reportActionError);
  });

  $('#appModalOk').addEventListener('click', () => {
    const cb = modalOnOk;
    const value = $('#appModalInput').value;
    hideModal();
    if (cb) Promise.resolve().then(() => cb(value)).catch(reportActionError);
  });

  $('#appModalCancel').addEventListener('click', hideModal);

  $('#appModalInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#appModalOk').click();
    if (e.key === 'Escape') hideModal();
  });

  $('#undoBtn').addEventListener('click', () => {
    performUndo();
  });

  const folderPanelEl = $('#folderTree').closest('.panel');
  if (folderPanelEl) {
    folderPanelEl.addEventListener('contextmenu', (e) => {
      if (e.target.closest('.tree-row')) return;
      e.preventDefault();
      e.stopPropagation();
      openContextMenu(e.clientX, e.clientY, [
        { label: '添加文件夹', run: () => addFolder() }
      ]);
    });
  }
  $('#settingsBtn').addEventListener('click', () => {
    const panel = $('#settingsPanel');
    panel.hidden = !panel.hidden;
    $('#settingsBtn').setAttribute('aria-expanded', !panel.hidden);
  });

  $('#hideDomainIcons').addEventListener('change', async (e) => {
    settings.hideDomainIcons = e.target.checked;
    document.documentElement.classList.toggle('hide-domain-icons', settings.hideDomainIcons);
    if (chrome.storage && chrome.storage.local) {
      await new Promise(resolve => chrome.storage.local.set({ hideDomainIcons: settings.hideDomainIcons }, resolve));
    }
  });

  $('#hideContentIcons').addEventListener('change', async (e) => {
    settings.hideContentIcons = e.target.checked;
    document.documentElement.classList.toggle('hide-content-icons', settings.hideContentIcons);
    if (chrome.storage && chrome.storage.local) {
      await new Promise(resolve => chrome.storage.local.set({ hideContentIcons: settings.hideContentIcons }, resolve));
    }
  });

  const darkModeEl = $('#darkMode');
  if (darkModeEl) {
    darkModeEl.addEventListener('change', async (e) => {
      document.documentElement.dataset.theme = e.target.checked ? 'dark' : 'light';
      if (chrome.storage && chrome.storage.local) {
        await new Promise(resolve => chrome.storage.local.set({ darkMode: e.target.checked }, resolve));
      }
      renderDomains();
      renderFolders();
      renderContent();
    });
  }

document.addEventListener('click', e => {
  if (!e.target.closest('#settingsPanel, #settingsBtn')) {
    $('#settingsPanel').hidden = true;
    $('#settingsBtn').setAttribute('aria-expanded', 'false');
  }
});
window.addEventListener('resize', () => { hideBookmarkTooltip(); updateAllColumns(); });

// ===== 拖动调整宽度 =====
function enableResize(panel, resizer) {
  let startX = 0;
  let startPct = 0.2;
  let workspaceWidth = 1;

  resizer.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const workspace = document.querySelector('.workspace');
    workspaceWidth = workspace.clientWidth;
    startPct = panel.getBoundingClientRect().width / workspaceWidth;
    startX = e.clientX;
    resizer.classList.add('dragging');
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp, { once: true });
  });

  function onMove(e) {
    let pct = startPct + (e.clientX - startX) / workspaceWidth;
    pct = Math.max(0.125, Math.min(0.25, pct));
    panel.style.width = (pct * 100).toFixed(2) + '%';
      updateAllColumns();
  }

  function onUp() {
    document.removeEventListener('mousemove', onMove);
    resizer.classList.remove('dragging');
  }
}

enableResize(
  document.querySelector('.workspace aside.panel:nth-of-type(1)'),
  document.getElementById('resizeLeft')
);
enableResize(
  document.querySelector('.workspace aside.panel:nth-of-type(2)'),
  document.getElementById('resizeMid')
);

// ===== 初始化 =====
loadChromeBookmarks().catch(reportActionError);
