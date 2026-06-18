(function () {
  let prompts = { translate: "", refine: "" };

  function loadPrompts() {
    const url = chrome.runtime.getURL("assets/config/prompt.yml");
    return fetch(url)
      .then((r) => r.text())
      .then((text) => {
        text.split("\n").forEach((line) => {
          const match = line.match(/^(\w+):\s*"(.+)"$/);
          if (match) {
            prompts[match[1]] = match[2];
          }
        });
      });
  }

  function sendToChatGPT(text) {
    const textarea = document.querySelector("#prompt-textarea");
    if (!textarea) return;

    textarea.focus();

    const paragraph = textarea.querySelector("p");
    if (paragraph) {
      paragraph.textContent = text;
    } else {
      textarea.textContent = text;
    }

    textarea.dispatchEvent(new Event("input", { bubbles: true }));

    setTimeout(() => {
      const sendBtn =
        document.querySelector('button[data-testid="send-button"]') ||
        document.querySelector('button[aria-label="Send prompt"]');
      if (sendBtn && !sendBtn.disabled) {
        sendBtn.click();
      }
    }, 100);
  }

  function updateSidebarWidth() {
    const sidebar = document.querySelector("nav");
    const width = sidebar ? sidebar.offsetWidth : 0;
    document.documentElement.style.setProperty(
      "--lindel-sidebar-width",
      width + "px"
    );
  }

  function createUI() {
    if (document.getElementById("lindel-chatgpt-helper")) return;

    updateSidebarWidth();
    window.addEventListener("resize", updateSidebarWidth);

    const container = document.createElement("div");
    container.id = "lindel-chatgpt-helper";

    const cnGroup = document.createElement("div");
    cnGroup.className = "lindel-input-group";
    cnGroup.innerHTML =
      "<label>Translate</label>" +
      '<textarea placeholder="CN→EN / EN→CN"></textarea>' +
      "<button>Send</button>";

    const enGroup = document.createElement("div");
    enGroup.className = "lindel-input-group";
    enGroup.innerHTML =
      "<label>Wording Refinement</label>" +
      '<textarea placeholder="CN→EN→Refined EN"></textarea>' +
      "<button>Send</button>";

    container.appendChild(cnGroup);
    container.appendChild(enGroup);

    cnGroup.querySelector("button").addEventListener("click", () => {
      const text = cnGroup.querySelector("textarea").value.trim();
      if (!text) return;
      sendToChatGPT(prompts.translate + "\n" + text);
      cnGroup.querySelector("textarea").value = "";
    });

    enGroup.querySelector("button").addEventListener("click", () => {
      const text = enGroup.querySelector("textarea").value.trim();
      if (!text) return;
      sendToChatGPT(prompts.refine + "\n" + text);
      enGroup.querySelector("textarea").value = "";
    });

    document.body.appendChild(container);
  }

  function init() {
    loadPrompts().then(() => {
      if (document.querySelector("#prompt-textarea")) {
        createUI();
      } else {
        const observer = new MutationObserver(() => {
          if (document.querySelector("#prompt-textarea")) {
            observer.disconnect();
            createUI();
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
