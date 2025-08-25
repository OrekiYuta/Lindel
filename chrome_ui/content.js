(function () {
  function injectButton() {
    if (document.getElementById("lindel-float-btn")) return;

    const btn = document.createElement("button");
    btn.id = "lindel-float-btn";
    btn.innerText = "Metric";

    btn.style.position = "fixed";
    btn.style.right = "20px";
    btn.style.bottom = "20px";
    btn.style.zIndex = "2147483647";
    btn.style.padding = "18px 28px";
    btn.style.background = "#ff5722";
    btn.style.color = "white";
    btn.style.border = "none";
    btn.style.borderRadius = "50px";
    btn.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
    btn.style.cursor = "pointer";
    btn.style.fontSize = "18px";
    btn.style.fontWeight = "bold";

    let panel = document.getElementById("lindel-side-panel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "lindel-side-panel";
      panel.style.position = "fixed";
      panel.style.top = "0";
      panel.style.right = "0";
      panel.style.width = "35%";
      panel.style.height = "100%";
      panel.style.background = "#ffffff";
      panel.style.boxShadow = "-4px 0 12px rgba(0,0,0,0.3)";
      panel.style.zIndex = "2147483646";
      panel.style.display = "none";
      panel.style.padding = "0";
      panel.style.borderLeft = "1px solid #ddd";

      const iframe = document.createElement("iframe");
      iframe.src = chrome.runtime.getURL("panel.html");
      iframe.style.width = "100%";
      iframe.style.height = "100%";
      iframe.style.border = "none";

      panel.appendChild(iframe);
      document.body.appendChild(panel);
    }

    btn.addEventListener("click", () => {
      if (panel.style.display === "none") {
        panel.style.display = "block";
      } else {
        panel.style.display = "none";
      }
    });

    document.body.appendChild(btn);
  }

  injectButton();

  const observer = new MutationObserver(() => {
    injectButton();
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
