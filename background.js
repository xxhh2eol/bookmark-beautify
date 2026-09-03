// 收藏夹美化页面的入口地址
const PAGE_URL = chrome.runtime.getURL('newtab-external.html');

async function openOrFocusPage() {
  // 查找已打开的收藏夹美化页面
  const tabs = await chrome.tabs.query({ url: PAGE_URL });
  const existing = tabs && tabs.length ? tabs[0] : null;

  if (existing) {
    // 已打开：跳转到(聚焦)之前打开的页面，不再新建
    try {
      await chrome.windows.update(existing.windowId, { focused: true });
    } catch (err) {
      // 窗口可能已不存在，忽略并继续激活标签页
    }
    await chrome.tabs.update(existing.id, { active: true });
    return;
  }

  // 未打开：新建页面
  await chrome.tabs.create({ url: PAGE_URL });
}

chrome.action.onClicked.addListener(() => {
  openOrFocusPage().catch((err) => console.error(err));
});
