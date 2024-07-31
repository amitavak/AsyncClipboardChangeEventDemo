class App {
  #sessionId = null;
  clipboardPermissionState = null;
  pasteOption = this.#pastePasteOptionDefault;
  lastCopyPasteType = this.#notAvailable;

  constructor() {}

  run() {
    this.#UpdateSessionId();

    this.#initializeAppSettings();

    this.#UpdateClipboardPermissionState();

    this.#logMessage("App is running");
  }

  #initializeAppSettings() {}

  #UpdateSessionId() {
    const sessionIdElm = document.getElementById("session-id");
    sessionIdElm.innerHTML = this.sessionId;
  }

  async #UpdateClipboardPermissionState() {
    this.clipboardPermissionState = await this.#getClipboardPermissionState();

    const clipboardPermissionElm = document.getElementById(
      "clipboard-permission-state"
    );
    clipboardPermissionElm.innerHTML = JSON.stringify(
      this.clipboardPermissionState
    );
  }

  async #getClipboardPermissionState() {
    const clipboardPermissionState = {
      "clipboard-read": "Not Supported",
      "clipboard-write": "Not Supported",
    };
    if (!navigator?.permissions) {
      return clipboardPermissionState;
    }

    try {
      const clipboardReadPermission = await navigator.permissions.query({
        name: "clipboard-read",
      });

      clipboardPermissionState["clipboard-read"] =
        clipboardReadPermission.state;
    } catch (err) {
      clipboardPermissionState["clipboard-read"] = "ERR";
    }

    try {
      const clipboardWritePermission = await navigator.permissions.query({
        name: "clipboard-write",
      });

      clipboardPermissionState["clipboard-write"] =
        clipboardWritePermission.state;
    } catch (err) {
      clipboardPermissionState["clipboard-write"] = "ERR";
    }

    return clipboardPermissionState;
  }

  #generateUUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );
  }

  #logMessage(message) {
    const logOutputElm = document.getElementById("log-output");

    logOutputElm.value += `${message}\n---------\n`;
    logOutputElm.scrollTop = logOutputElm.scrollHeight;
  }

  get sessionId() {
    if (!this.#sessionId) {
      this.#sessionId = this.#generateUUID();
    }

    return this.#sessionId;
  }

  get clipboardApi() {
    const clipboardApiElm = document.getElementById("clipboard-api");
    return clipboardApiElm.value;
  }

  get dataStorage() {
    const dataStorageElm = document.getElementById("data-storage");
    return dataStorageElm.value;
  }

  get copyPayloads() {
    const copyPayloadTextElm = document.getElementById("text-payload-chkbox");
    const copyPayloadHtmlElm = document.getElementById("html-payload-chkbox");
    const copyPayloadImgElm = document.getElementById("img-payload-chkbox");
    const copyPayloadWebCustomFormatElm =
      document.getElementById("wcf-payload-chkbox");

    const copyPayloads = [];

    if (copyPayloadTextElm.checked) {
      copyPayloads.push(this.#copyPayloadText);
    }

    if (copyPayloadHtmlElm.checked) {
      copyPayloads.push(this.#copyPayloadHtml);
    }

    if (copyPayloadImgElm.checked) {
      copyPayloads.push(this.#copyPayloadImg);
    }

    if (copyPayloadWebCustomFormatElm.checked) {
      copyPayloads.push(this.#copyPayloadWebCustomFormat);
    }

    return copyPayloads;
  }

  get #notAvailable() {
    return "NA";
  }

  get #dataTransferApi() {
    return "dataTransfer";
  }

  get #asyncClipboardApi() {
    return "asyncClipboard";
  }

  get #localStorageAndClipboardStorage() {
    return "localstorageAndClipboard";
  }

  get #clipboardStorage() {
    return "clipboard";
  }

  get #copyPayloadText() {
    return "text";
  }

  get #copyPayloadHtml() {
    return "html";
  }

  get #copyPayloadImg() {
    return "img";
  }

  get #copyPayloadWebCustomFormat() {
    return "wcf";
  }

  get #pastePasteOptionDefault() {
    return "default";
  }
}

const app = new App();
app.run();
