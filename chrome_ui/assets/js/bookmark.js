function renderBookmarks(nodes, container) {
  const ul = document.createElement("ul");

  for (const node of nodes) {
    const li = document.createElement("li");

    if (node.url) {
      // 书签
      const a = document.createElement("a");
      a.href = node.url;
      a.textContent = node.title || node.url;
      a.target = "_blank";
      li.appendChild(a);
    } else {
      // 文件夹
      li.textContent = node.title || "📂 Folder";
      if (node.children) {
        li.appendChild(renderBookmarks(node.children, li));
      }
    }

    ul.appendChild(li);
  }

  return ul;
}

document.addEventListener("DOMContentLoaded", () => {
  chrome.bookmarks.getTree((bookmarkTreeNodes) => {
    const container = document.getElementById("bookmarks");
    container.appendChild(renderBookmarks(bookmarkTreeNodes, container));
  });
});
