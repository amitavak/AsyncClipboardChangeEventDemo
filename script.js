class App {
  #appSettings = {
    clipboardApi: this.#dataTransferApi,
    dataStorage: this.#localStorageAndClipboardStorage,
    copyPayloads: [
      this.#copyPayloadText,
      this.#copyPayloadHtml,
      this.#copyPayloadImg,
    ],
  };

  clipboardPermissionState = "NA";
  lastCopyPasteType = "NA";
  sessionId = "NA";

  constructor() {}

  run() {
    this.#assignSessionId();

    console.log("App is running");
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

  get #copyPayloadShadowWorkbook() {
    return "sw";
  }

  #assignSessionId() {
    this.sessionId = this.#generateUUID();

    const sessionIdElm = document.getElementById("session-id");
    sessionIdElm.innerHTML = this.sessionId;
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
}

const app = new App();
app.run();
