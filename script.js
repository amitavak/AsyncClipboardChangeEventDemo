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
    this.#registerPasteEventListeners();
  }

  #registerCopyEventListeners() {
    document.addEventListener(
      "keydown",
      (e) => {
        //console.log("Keydown event detected!");

        if (e.key === "c" && e.ctrlKey) {
          //console.log("Ctrl + C key combination detected!");

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
        "*** Copy operation initiated (copy button clicked) ***"
      );

      this.#performCopyOperation(false);
    });
  }

  #registerPasteEventListeners() {
    document.addEventListener(
      "keydown",
      (e) => {
        //console.log("Keydown event detected!");

        if (e.key === "v" && e.ctrlKey) {
          //console.log("Ctrl + V key combination detected!");

          this.#logMessage("*** Paste operation initiated (CTRL + V) ***");

          this.#performPasteOperation(true);
        }
      },
      { capture: true }
    );

    const pasteBtnElm = document.getElementById("paste-btn");
    pasteBtnElm.addEventListener("click", (e) => {
      e.preventDefault();

      this.#logMessage(
        "*** Paste operation initiated (paste button clicked) ***"
      );

      this.#performPasteOperation(false);
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
        const newCopyMetadata = JSON.parse(e.newValue);
        this.#logMessage(
          `Local storage change detected. NewValue: '${e.newValue}', OldValue: '${e.oldValue}'`
        );
        this.#updateCopyMetadata(newCopyMetadata);
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

    const updatedCopyMetadata = {
      ...this.copyMetadata,
      copyStatus: this.#copyStatusCompleted,
    };

    try {
      await this.#writeToClipboard(false, {
        ...dataFormats,
        ["web data/copy-metadata"]: JSON.stringify(updatedCopyMetadata),
      });
    } catch (err) {
      this.#logMessage("Failed to write copy payloads to clipboard");
    }

    if (this.dataStorage === this.#localStorageAndClipboardStorage) {
      try {
        await this.#writeDataToLocalStorage(dataFormats);
      } catch (err) {
        this.#logMessage("Failed to write copy payloads to local storage");
      }

      if (this.dataStorage === this.#localStorageAndClipboardStorage) {
        try {
          await this.#writeMetadataToLocalStorage(updatedCopyMetadata);

          this.#updateCopyMetadata(updatedCopyMetadata);
        } catch (err) {
          this.#logMessage("Failed to write metadata to local storage");
        }
      }
    }

    // Hide loading indicator
    this.#hideLoadingIndicator();
  }

  async #performPasteOperation(isKeyboardEvent) {
    this.#showLoadingIndicator();

    let clipboardDataFormats = null;
    let localStorageDataFormats = null;

    try {
      clipboardDataFormats = await this.#readFromClipboard(isKeyboardEvent);
    } catch (err) {
      this.#logMessage("Failed to read data from clipboard");
    }

    if (!clipboardDataFormats) {
      this.#logMessage("No data found in clipboard");
      this.#hideLoadingIndicator();
      return;
    }

    const clipboardCopyMetadata =
      clipboardDataFormats["web data/copy-metadata"];

    if (clipboardCopyMetadata) {
      this.#updateCopyMetadata(JSON.parse(clipboardCopyMetadata));
    }

    if (this.dataStorage === this.#localStorageAndClipboardStorage) {
      localStorageDataFormats = this.#readDataFromLocalStorage();
    }

    if (!localStorageDataFormats) {
      if (!!clipboardCopyMetadata) {
        if (this.copyMetadata.sessionId === this.sessionId) {
          this.#pasteSameSession(clipboardDataFormats);
        } else {
          this.#pasteCrossSession(clipboardDataFormats);
        }
      } else {
        this.#pasteExternal(clipboardDataFormats);
      }

      this.#updateCopyPasteType();
      this.#hideLoadingIndicator();
      return;
    }

    const { copyPasteType, dataFormats } = this.#getCopyPasteTypeAndDataFormats(
      clipboardDataFormats,
      localStorageDataFormats
    );

    if (copyPasteType === this.#copyPasteTypeExternal) {
      this.#pasteExternal(dataFormats);
    } else if (copyPasteType === this.#copyPasteTypeSameSession) {
      this.#pasteSameSession(dataFormats);
    } else if (copyPasteType === this.#copyPasteTypeCrossSession) {
      this.#pasteCrossSession(dataFormats);
    }

    this.#updateCopyPasteType();
    this.#hideLoadingIndicator();
  }

  #getCopyPasteTypeAndDataFormats(
    clipboardDataFormats,
    localStorageDataFormats
  ) {
    const clipboardHTMLPayload = clipboardDataFormats["text/html"];

    if (!clipboardHTMLPayload) {
      if (clipboardDataFormats["web data/copy-metadata"]) {
        if (this.copyMetadata.sessionId === this.sessionId) {
          return {
            copyPasteType: this.#copyPasteTypeSameSession,
            dataFormats: clipboardDataFormats,
          };
        } else {
          return {
            copyPasteType: this.#copyPasteTypeCrossSession,
            dataFormats: clipboardDataFormats,
          };
        }
      }

      return {
        copyPasteType: this.#copyPasteTypeExternal,
        dataFormats: clipboardDataFormats,
      };
    }

    const localStorageHTMLPayload = localStorageDataFormats["text/html"];

    if (!localStorageHTMLPayload) {
      if (clipboardDataFormats["web data/copy-metadata"]) {
        if (this.copyMetadata.sessionId === this.sessionId) {
          return {
            copyPasteType: this.#copyPasteTypeSameSession,
            dataFormats: clipboardDataFormats,
          };
        } else {
          return {
            copyPasteType: this.#copyPasteTypeCrossSession,
            dataFormats: clipboardDataFormats,
          };
        }
      }

      return {
        copyPasteType: this.#copyPasteTypeExternal,
        dataFormats: clipboardDataFormats,
      };
    }

    const clipboardTimeStamp = new Date(
      this.#getTimeStampFromHTMLPayload(clipboardHTMLPayload)
    );
    const localStorageTimeStamp = new Date(
      this.#getTimeStampFromHTMLPayload(localStorageHTMLPayload)
    );

    if (clipboardTimeStamp === null || localStorageTimeStamp === null) {
      if (clipboardDataFormats["web data/copy-metadata"]) {
        if (this.copyMetadata.sessionId === this.sessionId) {
          return {
            copyPasteType: this.#copyPasteTypeSameSession,
            dataFormats: clipboardDataFormats,
          };
        } else {
          return {
            copyPasteType: this.#copyPasteTypeCrossSession,
            dataFormats: clipboardDataFormats,
          };
        }
      }

      return {
        copyPasteType: this.#copyPasteTypeExternal,
        dataFormats: clipboardDataFormats,
      };
    }

    if (clipboardTimeStamp > localStorageTimeStamp) {
      if (clipboardDataFormats["web data/copy-metadata"]) {
        if (this.copyMetadata.sessionId === this.sessionId) {
          return {
            copyPasteType: this.#copyPasteTypeSameSession,
            dataFormats: clipboardDataFormats,
          };
        } else {
          return {
            copyPasteType: this.#copyPasteTypeCrossSession,
            dataFormats: clipboardDataFormats,
          };
        }
      }

      return {
        copyPasteType: this.#copyPasteTypeExternal,
        dataFormats: clipboardDataFormats,
      };
    } else {
      if (this.copyMetadata.sessionId === this.sessionId) {
        return {
          copyPasteType: this.#copyPasteTypeSameSession,
          dataFormats: localStorageDataFormats,
        };
      } else {
        return {
          copyPasteType: this.#copyPasteTypeCrossSession,
          dataFormats: localStorageDataFormats,
        };
      }
    }
  }

  #getTimeStampFromHTMLPayload(htmlPayload) {
    if (!htmlPayload) {
      return null;
    }

    const domParser = new DOMParser();

    const htmlDoc = domParser.parseFromString(htmlPayload, "text/html");

    // Find a div element with data-timestamp attribute
    const divElm = htmlDoc.querySelector("div[data-timestamp]");

    if (!divElm) {
      return null;
    }

    return divElm.getAttribute("data-timestamp");
  }

  #pasteExternal(clipboardDataFormats) {
    this.#logMessage("External paste");
    this.copyMetadata = null;
    this.lastCopyPasteType = this.#copyPasteTypeExternal;

    let [mimeType, payload] = this.#getPasteOption(clipboardDataFormats);

    this.#updatePasteContent([mimeType, payload]);
  }

  #pasteSameSession(dataFormats) {
    this.#logMessage("Same session paste");
    this.lastCopyPasteType = this.#copyPasteTypeSameSession;

    let [mimeType, payload] = this.#getPasteOption(dataFormats);

    this.#updatePasteContent([mimeType, payload]);
  }

  #pasteCrossSession(dataFormats) {
    this.#logMessage("Cross session paste");
    this.lastCopyPasteType = this.#copyPasteTypeCrossSession;

    let [mimeType, payload] = this.#getPasteOption(dataFormats);

    this.#updatePasteContent([mimeType, payload]);
  }

  #updatePasteContent([mimeType, payload]) {
    const pastedContentElm = document.getElementById("pasted-content");
    pastedContentElm.innerHTML = "";
    const textAreaElm = document.createElement("textarea");
    textAreaElm.disabled = true;
    textAreaElm.style.width = "100%";
    textAreaElm.style.height = "200px";
    textAreaElm.value = payload;

    pastedContentElm.appendChild(textAreaElm);
  }

  #getPasteOption(dataFormats) {
    let selectedPasteOption = [];

    if (this.pasteOption === this.#pasteOptionDefault) {
      for (const pasteOption of this.#pasteOptionPriorities) {
        if (dataFormats[pasteOption]) {
          selectedPasteOption = [pasteOption, dataFormats[pasteOption]];
          break;
        }
      }
    } else {
      selectedPasteOption = [this.pasteOption, dataFormats[this.pasteOption]];
    }

    return selectedPasteOption;
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
        // glitch link: https://cdn.glitch.global/fe1ba503-299a-4c1f-866d-8baa9a39e802/img-payload.png?v=1722753834160
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

    return copyEventListener;
  }

  async #writeToClipboard(isKeyboardEvent, dataFormats) {
    if (isKeyboardEvent) {
      this.#registerOnDemandCopyEventListener((e) => {
        this.#writeToClipboardFactory(e, dataFormats);
      });
    } else {
      if (this.clipboardApi === this.#dataTransferApi) {
        const onDemandCopyEventListener =
          this.#registerOnDemandCopyEventListener((e) => {
            this.#writeToClipboardDataTransferApi(e, dataFormats);
          });
        const execCommandResult = document.execCommand("copy");
        this.#logMessage(`execCommand('copy') result: '${execCommandResult}'`);

        if (!execCommandResult) {
          document.removeEventListener("copy", onDemandCopyEventListener);
        }
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

    this.#logMessage("Metadata written to local storage");
  }

  #readDataFromLocalStorage() {
    const dataFormats = localStorage.getItem(this.#localstorageCopyPayloadKey);

    if (!dataFormats) {
      this.#logMessage("No data found in local storage");
      return {};
    }

    return JSON.parse(dataFormats);
  }

  #registerOnDemandPasteEventListener(readDataFromClipboard) {
    const pasteEventListener = (e) => {
      e.preventDefault();
      e.stopPropagation();
      document.removeEventListener("paste", pasteEventListener);

      this.#logMessage("Paste event detected");

      readDataFromClipboard(e);
    };

    document.addEventListener("paste", pasteEventListener);

    return pasteEventListener;
  }

  async #readFromClipboard(isKeyboardEvent) {
    let resolveClipboardDataFormats = null;
    let rejectClipboardDataFormats = null;

    const clipboardDataFormatsPromise = new Promise((resolve, reject) => {
      resolveClipboardDataFormats = resolve;
      rejectClipboardDataFormats = reject;
    });

    try {
      if (isKeyboardEvent) {
        this.#registerOnDemandPasteEventListener(async (e) => {
          const tempDataFormats = await this.#readFromClipboardFactory(e);
          resolveClipboardDataFormats(tempDataFormats);
        });
      } else {
        if (this.clipboardApi === this.#dataTransferApi) {
          const onDemandPasteEventListener =
            this.#registerOnDemandPasteEventListener((e) => {
              const tempDataFormats = this.#readFromClipboardDataTransferApi(e);
              resolveClipboardDataFormats(tempDataFormats);
            });

          const execCommandResult = document.execCommand("paste");

          this.#logMessage(
            `execCommand('paste') result: '${execCommandResult}'`
          );

          if (!execCommandResult) {
            document.removeEventListener("paste", onDemandPasteEventListener);
          }
        } else if (this.clipboardApi === this.#asyncClipboardApi) {
          const tempDataFormats = await this.#readFromClipboardAsyncApi();
          resolveClipboardDataFormats(tempDataFormats);
        } else {
          rejectClipboardDataFormats("Invalid clipboard API");
        }
      }
    } catch (err) {
      rejectClipboardDataFormats(err);
    }

    return clipboardDataFormatsPromise;
  }

  #readFromClipboardDataTransferApi(e) {
    const supportedDataFormats = ["text/plain", "text/html", "image/png"];

    const dataFormats = {};

    for (const mimeType of supportedDataFormats) {
      try {
        const copyPayload = e.clipboardData.getData(mimeType);

        if (!copyPayload) {
          continue;
        }

        dataFormats[mimeType] = copyPayload;
      } catch (err) {
        this.#logMessage(
          `Failed to read data of type: '${mimeType}' from clipboard using DataTransfer API`
        );
      }
    }

    return dataFormats;
  }

  async #readFromClipboardFactory(e) {
    if (this.clipboardApi === this.#dataTransferApi) {
      return this.#readFromClipboardDataTransferApi(e);
    } else if (this.clipboardApi === this.#asyncClipboardApi) {
      const tempDataFormats = await this.#readFromClipboardAsyncApi();
      return tempDataFormats;
    }
  }

  async #readFromClipboardAsyncApi() {
    if (!navigator.clipboard) {
      this.#logMessage("Clipboard API is not supported");
      return;
    }

    try {
      const clipboardItems = await navigator.clipboard.read();
      const dataFormats = {};

      for (const clipboardItem of clipboardItems) {
        for (const mimeType of clipboardItem.types) {
          try {
            const blob = await clipboardItem.getType(mimeType);
            const blobContent =
              mimeType === "image/png"
                ? await this.#readBlobAsDataUrl(blob)
                : await blob.text();
            dataFormats[mimeType] = blobContent;
          } catch (err) {
            this.#logMessage(
              `Failed to read data of type: '${mimeType}' from clipboard using Async API`
            );
          }
        }
      }

      return dataFormats;
    } catch (err) {
      this.#logMessage("Failed to read data from clipboard using Async API");
    }
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
      pasteOptionWebCustomFormatElm.disabled = false;
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
    const messageWithTimeStamp = `[${new Date().toISOString()}] ${message}`;
    console.log(messageWithTimeStamp);

    const logOutputElm = document.getElementById("log-output");

    logOutputElm.value += `${messageWithTimeStamp}\n---------\n`;
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

  #updateCopyPasteType() {
    const copyPasteTypeElm = document.getElementById("copy-paste-type");

    if (this.lastCopyPasteType === this.#copyPasteTypeSameSession) {
      copyPasteTypeElm.innerHTML = "Same Session";
    } else if (this.lastCopyPasteType === this.#copyPasteTypeCrossSession) {
      copyPasteTypeElm.innerHTML = "Cross Session";
    } else if (this.lastCopyPasteType === this.#copyPasteTypeExternal) {
      copyPasteTypeElm.innerHTML = "External";
    }
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

  get #pasteOptionPriorities() {
    return [
      this.#pasteOptionWebCustomFormat,
      this.#pasteOptionHTML,
      this.#pasteOptionText,
      this.#pasteOptionImage,
    ];
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

  get #pasteOptionDefault() {
    return "default";
  }

  get #pasteOptionText() {
    return "text/plain";
  }

  get #pasteOptionHTML() {
    return "text/html";
  }

  get #pasteOptionImage() {
    return "image/png";
  }

  get #pasteOptionWebCustomFormat() {
    return "web data/custom-format";
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
