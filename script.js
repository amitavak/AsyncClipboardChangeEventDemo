class App {
  #sessionId = null;
  clipboardPermissionState = null;
  lastCopyPasteType = null;
  copyMetadata = null;

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
    this.#registerLocalstorageChangeEventListener();
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

  #updateCopyMetadata(updatedCopyMetadata) {
    this.copyMetadata = updatedCopyMetadata;
    this.#onCopyMetadataChange();
  }

  #registerLocalstorageChangeEventListener() {
    window.addEventListener("storage", (e) => {
      if (
        e.storageArea === localStorage &&
        e.key === this.#localstorageCopyMetadataKey
      ) {
        this.#updateCopyMetadata(JSON.parse(e.newValue));
      }
    });
  }

  #onCopyMetadataChange() {
    this.#logMessage("Copy metadata changed");

    this.#enableDisablePasteOptions();
  }

  async #performCopyOperation(isKeyboardEvent) {
    if (this.copyPayloads.length === 0) {
      this.#logMessage("Select at least one payload to copy");

      try {
        this.#writeToClipboard(isKeyboardEvent, null);
        this.#writeDataToLocalStorage(null);
        this.#writeMetadataToLocalStorage(null);
      } catch (err) {}

      return;
    }

    // Show loading indicator
    this.#showLoadingIndicator();

    this.#updateCopyMetadata({
      sessionId: this.sessionId,
      copyStatus: this.#copyStatusStarted,
    });
    let dataFormats = {
      ["text/plain"]: "Retrieving data from server. Please wait...",
      ["web data/copy-metadata"]: JSON.stringify(this.copyMetadata),
    };

    // Start: Write Initial payload ("Retrieving data") to clipboard and metadata to local storage

    try {
      await this.#writeToClipboard(isKeyboardEvent, dataFormats);
    } catch (err) {
      this.#logMessage("Failed to write 'Retrieving data' to clipboard");
    }

    if (this.dataStorage === this.#localStorageAndClipboardStorage) {
      try {
        await this.#writeMetadataToLocalStorage(this.copyMetadata);
      } catch (err) {
        this.#logMessage("Failed to write metadata to local storage");
      }
    }

    // End: Write Initial payload ("Retrieving data") to clipboard and metadata to local storage

    dataFormats = await this.#getDataFormatsBySelectedCopyPayloads();

    try {
      await this.#writeToClipboard(false, dataFormats);
    } catch (err) {
      this.#logMessage("Failed to write copy payloads to clipboard");
    }

    if (this.dataStorage === this.#localStorageAndClipboardStorage) {
      try {
        await this.#writeDataToLocalStorage(dataFormats);
      } catch (err) {
        this.#logMessage("Failed to write copy payloads to local storage");
      }

      try {
        const updatedCopyMetadata = {
          ...this.copyMetadata,
          copyStatus: this.#copyStatusCompleted,
        };
        await this.#writeMetadataToLocalStorage(updatedCopyMetadata);

        this.#updateCopyMetadata(updatedCopyMetadata);
      } catch (err) {
        this.#logMessage("Failed to write metadata to local storage");
      }
    }

    // Hide loading indicator
    this.#hideLoadingIndicator();
  }

  async #getDataFormatsBySelectedCopyPayloads() {
    if (this.copyPayloads.length === 0) {
      return;
    }

    const dataFormats = {};

    try {
      if (this.copyPayloads.includes(this.#copyPayloadText)) {
        const response = await fetch("text-payload.txt");
        const textPayload = await response.text();
        dataFormats["text/plain"] = textPayload;
      }

      if (this.copyPayloads.includes(this.#copyPayloadHtml)) {
        const response = await fetch("html-payload.html");
        const htmlPayload = await response.text();
        dataFormats["text/html"] = htmlPayload;
      } else {
        dataFormats["text/html"] = this.#createDummyHTMLPayload();
      }

      if (this.copyPayloads.includes(this.#copyPayloadImg)) {
        const response = await fetch("img-payload.png");
        const imgPayload = await response.blob();

        if (this.clipboardApi === this.#dataTransferApi) {
          const imgBase64 = await this.#readBlobAsDataUrl(imgPayload);
          dataFormats["image/png"] = imgBase64;
        } else {
          dataFormats["image/png"] = imgPayload;
        }
      }

      if (this.copyPayloads.includes(this.#copyPayloadWebCustomFormat)) {
        const response = await fetch("web-custom-format-payload.json");
        const wcfPayload = await response.text();
        dataFormats["web data/custom-format"] = wcfPayload;
      }

      if (this.addDelayToCopy) {
        await new Promise((resolve) => setTimeout(resolve, 4000));
      }
    } catch (err) {
      this.#logMessage("Failed to retrieve data from server");
    }

    return dataFormats;
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
          this.#writeToClipboardDataTransferApi(e, dataFormats);
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
    let isSuccess = false;
    const supportedDataFormats = ["text/plain", "text/html", "image/png"];

    if (!dataFormats || Object.keys(dataFormats).length === 0) {
      this.#logMessage(
        "No data to write in clipboard using DataTransfer API. Clearing the clipboard"
      );

      // Clear the clipboard
      e.clipboardData.setData("text/plain", "");

      return;
    }

    for (const [mimeType, copyPayload] of Object.entries(dataFormats)) {
      if (!supportedDataFormats.includes(mimeType)) {
        this.#logMessage(
          `Data format '${mimeType}' is not supported in DataTransfer API`
        );
        continue;
      }

      try {
        e.clipboardData.setData(mimeType, copyPayload);
        isSuccess = true;
      } catch (err) {
        this.#logMessage(
          `Failed to write data of type: '${mimeType}' in clipboard using DataTransfer API`
        );
      }
    }

    if (isSuccess) {
      this.#logMessage(
        "Successfully wrote data in clipboard using DataTransfer"
      );
    }
  }

  async #writeToClipboardAsyncApi(dataFormats) {
    if (!navigator.clipboard) {
      this.#logMessage("Clipboard API is not supported");
      return;
    }

    if (!dataFormats || Object.keys(dataFormats).length === 0) {
      this.#logMessage(
        "Async API - No data to write in clipboard. Clearing the clipboard"
      );
      try {
        await navigator.clipboard.writeText("");
      } catch (err) {
        this.#logMessage("Failed to clear the clipboard using Async API");
      }
      return;
    }

    const sanitizedDataFormats = {};

    for (const [mimeType, copyPayload] of Object.entries(dataFormats)) {
      if (!copyPayload) {
        continue;
      }

      let blobPayload = copyPayload;

      // Check if the copyPayload is not of Blob type. Then convert it to Blob
      if (!(copyPayload instanceof Blob)) {
        blobPayload = new Blob([copyPayload], {
          type: mimeType,
        });
      }

      sanitizedDataFormats[mimeType] = blobPayload;
    }

    try {
      const clipboardItem = new ClipboardItem(sanitizedDataFormats);
      await navigator.clipboard.write([clipboardItem]);

      this.#logMessage("Successfully wrote data in clipboard using Async API");
    } catch (err) {
      this.#logMessage("Failed to write data in clipboard using Async API");
    }
  }

  async #writeDataToLocalStorage(dataFormats) {
    if (!dataFormats || Object.keys(dataFormats).length === 0) {
      this.#logMessage(
        "Local storage - No data to write in clipboard. Clearing the local storage"
      );

      localStorage.removeItem(this.#localstorageCopyPayloadKey);

      return;
    }

    const sanitizedDataFormats = await this.#convertPayloadsToString(
      dataFormats
    );

    localStorage.setItem(
      this.#localstorageCopyPayloadKey,
      JSON.stringify(sanitizedDataFormats)
    );
  }

  async #writeMetadataToLocalStorage(copyMetadata) {
    if (!copyMetadata || Object.keys(copyMetadata).length === 0) {
      this.#logMessage(
        "Local storage - No metadata to write in localstorage. Clearing the localstorage"
      );

      localStorage.removeItem(this.#localstorageCopyMetadataKey);
    }

    localStorage.setItem(
      this.#localstorageCopyMetadataKey,
      JSON.stringify(copyMetadata)
    );
  }

  #enableDisablePasteOptions() {
    const pasteOptionTextElm = document.getElementById("text-paste-option");
    const pasteOptionHtmlElm = document.getElementById("html-paste-option");
    const pasteOptionImgElm = document.getElementById("img-paste-option");
    const pasteOptionWebCustomFormatElm =
      document.getElementById("wcf-paste-option");

    if (!this.copyMetadata) {
      pasteOptionTextElm.disabled = false;
      pasteOptionHtmlElm.disabled = true;
      pasteOptionImgElm.disabled = true;
      pasteOptionWebCustomFormatElm.disabled = false;

      return;
    }

    const copyPasteType =
      this.copyMetadata.sessionId === this.sessionId
        ? this.#copyPasteTypeSameSession
        : this.#copyPasteTypeCrossSession;

    if (copyPasteType === this.#copyPasteTypeSameSession) {
      pasteOptionTextElm.disabled = false;
      pasteOptionHtmlElm.disabled = false;
      pasteOptionImgElm.disabled = false;
      pasteOptionWebCustomFormatElm.disabled = false;
    } else if (copyPasteType === this.#copyPasteTypeCrossSession) {
      pasteOptionTextElm.disabled = false;
      pasteOptionHtmlElm.disabled = false;
      pasteOptionImgElm.disabled = true;
      pasteOptionWebCustomFormatElm.disabled = true;
    }
  }

  #createDummyHTMLPayload() {
    const dummyHTMLPayload =
      this.#wrapHTMLPayloadWithTimestamp("<p>No content</p>");

    return dummyHTMLPayload;
  }

  #wrapHTMLPayloadWithTimestamp(htmlPayload) {
    const divElm = document.createElement("div");
    divElm.innerHTML = htmlPayload;

    const timestamp = new Date().toISOString();

    //Add timestamp to divElm as attribute
    divElm.setAttribute("data-timestamp", timestamp);

    return divElm.outerHTML;
  }

  async #convertPayloadsToString(dataFormats) {
    if (!dataFormats || Object.keys(dataFormats).length === 0) {
      return dataFormats;
    }

    const sanitizedDataFormats = {};

    for (const [mimeType, copyPayload] of Object.entries(dataFormats)) {
      if (!copyPayload) {
        continue;
      }

      let strPayload = copyPayload;

      // Check if the copyPayload is of Blob type. then read read text from it
      if (copyPayload instanceof Blob) {
        if (mimeType === "image/png") {
          strPayload = await this.#readBlobAsDataUrl(copyPayload);
        } else {
          strPayload = await copyPayload.text();
        }
      }

      sanitizedDataFormats[mimeType] = strPayload;
    }

    return sanitizedDataFormats;
  }

  async #readBlobAsDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
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

  #showLoadingIndicator() {
    const loadingIndicatorElm = document.getElementById("progress-bar");
    loadingIndicatorElm.style.visibility = "visible";
  }

  #hideLoadingIndicator() {
    const loadingIndicatorElm = document.getElementById("progress-bar");
    loadingIndicatorElm.style.visibility = "hidden";
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

  get #copyStatusStarted() {
    return "started";
  }

  get #copyStatusCompleted() {
    return "completed";
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

  get #localstorageCopyPayloadKey() {
    return "CopyPayloads";
  }

  get #localstorageCopyMetadataKey() {
    return "CopyMetadata";
  }

  get #copyPasteTypeSameSession() {
    return "same-session";
  }

  get #copyPasteTypeCrossSession() {
    return "cross-session";
  }

  get #copyPasteTypeExternal() {
    return "external";
  }
}

const app = new App();
app.run();
