class App {
  #sessionId = null;
  clipboardPermissionState = null;
  lastCopyPasteType = null;

  constructor() {}

  run() {
    this.#UpdateSessionId();

    this.#UpdateClipboardPermissionState();

    this.#registerEventListeners();

    this.#logMessage("App is running");
  }

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

  #registerEventListeners() {
    this.#registerCopyEventListeners();
  }

  #registerCopyEventListeners() {
    document.addEventListener(
      "keydown",
      (e) => {
        console.log("Keydown event detected!");

        if (e.key === "c" && e.ctrlKey) {
          console.log("Ctrl + C key combination detected!");

          this.#logMessage("*** Copy operation initiated (CTRL + C) ***");

          this.#performCopyOperation(true);
        }
      },
      { capture: true }
    );

    const copyBtnElm = document.getElementById("copy-btn");
    copyBtnElm.addEventListener("click", (e) => {
      e.preventDefault();

      this.#logMessage(
        "*** Copy operation initiated (copy button is clicked) ***"
      );

      this.#performCopyOperation(false);
    });
  }

  #performCopyOperation(isKeyboardEvent) {
    const dataFormats = {
      ["text/plain"]: "Retrieving data from server. Please wait...",
    };

    this.#writeToClipboard(isKeyboardEvent, dataFormats);
  }

  #registerOnDemandCopyEventListener(writeDataToClipboard) {
    const copyEventListener = (e) => {
      e.preventDefault();
      e.stopPropagation();
      document.removeEventListener("copy", copyEventListener);

      this.#logMessage("Copy event detected");

      writeDataToClipboard(e);
    };

    document.addEventListener("copy", copyEventListener);
  }

  async #writeToClipboard(isKeyboardEvent, dataFormats) {
    if (isKeyboardEvent) {
      this.#registerOnDemandCopyEventListener((e) => {
        this.#writeToClipboardFactory(e, dataFormats);
      });
    } else {
      if (this.clipboardApi === this.#dataTransferApi) {
        this.#registerOnDemandCopyEventListener((e) => {
          this.#writeToClipboardFactory(e, dataFormats);
        });
        const execCommandResult = document.execCommand("copy");
        this.#logMessage(`execCommand('copy') result: '${execCommandResult}'`);
      } else if (this.clipboardApi === this.#asyncClipboardApi) {
        await this.#writeToClipboardAsyncApi(dataFormats);
      }
    }
  }

  #writeToClipboardFactory(e, dataFormats) {
    if (this.clipboardApi === this.#dataTransferApi) {
      this.#writeToClipboardDataTransferApi(e, dataFormats);
    } else if (this.clipboardApi === this.#asyncClipboardApi) {
      this.#writeToClipboardAsyncApi(dataFormats);
    }
  }

  #writeToClipboardDataTransferApi(e, dataFormats) {
    for (const [mimeType, copyPayload] of Object.entries(dataFormats)) {
      try {
        e.clipboardData.setData(mimeType, copyPayload);
      } catch (err) {
        this.#logMessage(
          `Failed to write data of type: '${mimeType}' in clipboard`
        );
      }
    }
  }

  async #writeToClipboardAsyncApi(dataFormats) {
    if (!navigator.clipboard) {
      this.#logMessage("Clipboard API is not supported");
      return;
    }

    try {
      const clipboardItem = new ClipboardItem(dataFormats);
      await navigator.clipboard.write([clipboardItem]);
    } catch (err) {
      this.#logMessage("Failed to write data in clipboard using Async API");
    }
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

  get addDelayToCopy() {
    const addDelayToCopyElm = document.getElementById("add-delay-chkbox");
    return addDelayToCopyElm.checked;
  }

  get pasteOption() {
    const pasteOptionElm = document.getElementById("paste-option");
    return pasteOptionElm.value;
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

  get #pastePasteOptionHTML() {
    return "pasteHtml";
  }

  get #pastePasteOptionImage() {
    return "pasteImage";
  }

  get #pastePasteOptionWebCustomFormat() {
    return "pasteWCF";
  }
}

const app = new App();
app.run();
