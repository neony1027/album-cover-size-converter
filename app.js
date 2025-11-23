const TARGET_SIZE = 4000;
const JPEG_QUALITY = 0.92;

let fileQueue = [];

const elements = {
    dropzone: document.getElementById("dropzone"),
    fileInput: document.getElementById("fileInput"),
    selectBtn: document.getElementById("selectBtn"),
    filesList: document.getElementById("filesList"),
    fileCount: document.getElementById("fileCount"),
    convertBtn: document.getElementById("convertBtn"),
    clearBtn: document.getElementById("clearBtn"),
    overlay: document.getElementById("overlay"),
    overlayTitle: document.getElementById("overlayTitle"),
    overlayMessage: document.getElementById("overlayMessage"),
    progressBar: document.getElementById("progressBar"),
    progressFill: document.getElementById("progressFill"),
};

function isSupportedImage(file) {
    if (file.type && file.type.startsWith("image/")) return true;
    return /\.(jpg|jpeg|png|gif|bmp|webp|tiff?|heic)$/i.test(file.name);
}

function formatFileSize(bytes) {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const units = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${units[i]}`;
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function createQueueItem(file) {
    return {
        id: `${Date.now().toString(36)}${Math.random()
            .toString(36)
            .slice(2, 8)}`,
        file,
        status: "idle",
        progress: 0,
        outputUrl: null,
        outputName: null,
        previewUrl: URL.createObjectURL(file),
    };
}

function getStatusLabel(status) {
    switch (status) {
        case "processing":
            return "Processing…";
        case "completed":
            return "Done!";
        case "error":
            return "Fuckin Error!";
        default:
            return "Idle…";
    }
}

function renderQueueItem(item) {
    const row = document.createElement("div");
    row.className = "file-item";
    row.id = `file-${item.id}`;
    row.innerHTML = `
        <div class="file-icon thumb">
            <img src="${item.previewUrl}" alt="Preview" />
        </div>
        <div class="file-info">
            <div class="file-name" title="${escapeHtml(item.file.name)}">
                ${escapeHtml(item.file.name)}
            </div>
            <div class="file-details">
                <span>${formatFileSize(item.file.size)}</span>
                <span>${item.file.type || "image/*"}</span>
            </div>
            <div class="progress-bar-container">
                <div class="progress-bar-fill" style="width:${
                    item.progress
                }%"></div>
            </div>
        </div>
        <div class="file-status ${item.status}">${getStatusLabel(
        item.status
    )}</div>
        <div class="file-actions">
            <button class="btn-small btn-download" style="display:${
                item.status === "completed" ? "block" : "none"
            }" onclick="downloadFile('${item.id}')">Download</button>
            <button class="btn-small btn-remove" onclick="removeFile('${
                item.id
            }')">Delete</button>
        </div>
    `;
    elements.filesList.querySelector(".empty-state")?.remove();
    elements.filesList.appendChild(row);
}

function updateStatus(item, status, progress = item.progress) {
    item.status = status;
    item.progress = progress;
    const el = document.getElementById(`file-${item.id}`);
    if (!el) return;
    const statusEl = el.querySelector(".file-status");
    const progressEl = el.querySelector(".progress-bar-fill");
    if (statusEl) {
        statusEl.textContent = getStatusLabel(status);
        statusEl.className = `file-status ${status}`;
    }
    if (progressEl) {
        progressEl.style.width = `${progress}%`;
    }
    if (status === "completed") {
        const downloadBtn = el.querySelector(".btn-download");
        if (downloadBtn) downloadBtn.style.display = "block";
    }
}

function showOverlay(title, message) {
    if (!elements.overlay) return;
    elements.overlayTitle.textContent = title;
    elements.overlayMessage.textContent = message;
    elements.progressBar.style.display = "block";
    elements.progressFill.style.width = "0%";
    elements.overlay.style.display = "flex";
}

function updateGlobalProgress(percent) {
    if (!elements.progressFill) return;
    elements.progressFill.style.width = `${percent}%`;
}

function hideOverlay() {
    if (elements.overlay) {
        elements.overlay.style.display = "none";
    }
}

function addFiles(files) {
    let added = 0;
    files.forEach((file) => {
        if (!isSupportedImage(file)) {
            alert(`${file.name} is a fuckin unsupported image format!`);
            return;
        }
        const item = createQueueItem(file);
        fileQueue.push(item);
        renderQueueItem(item);
        added += 1;
    });
    if (added > 0) {
        elements.fileCount.textContent = fileQueue.length;
    }
}

function loadImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () =>
                reject(new Error("Couldn’t load this fuckin image."));
            img.src = reader.result;
        };
        reader.onerror = () =>
            reject(new Error("Shit happened while reading the file."));
        reader.readAsDataURL(file);
    });
}

async function convertItem(item) {
    updateStatus(item, "processing", 5);
    try {
        const image = await loadImage(item.file);
        updateStatus(item, "processing", 25);

        const canvas = document.createElement("canvas");
        canvas.width = TARGET_SIZE;
        canvas.height = TARGET_SIZE;
        const ctx = canvas.getContext("2d");

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, TARGET_SIZE, TARGET_SIZE);

        const scale = Math.min(
            TARGET_SIZE / image.width,
            TARGET_SIZE / image.height
        );
        const drawWidth = Math.round(image.width * scale);
        const drawHeight = Math.round(image.height * scale);
        const offsetX = Math.round((TARGET_SIZE - drawWidth) / 2);
        const offsetY = Math.round((TARGET_SIZE - drawHeight) / 2);

        ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
        updateStatus(item, "processing", 70);

        const blob = await new Promise((resolve, reject) => {
            canvas.toBlob(
                (result) => {
                    if (result) resolve(result);
                    else
                        reject(
                            new Error("Failed to convert this fuckin image.")
                        );
                },
                "image/jpeg",
                JPEG_QUALITY
            );
        });

        if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
        if (item.previewUrl) {
            URL.revokeObjectURL(item.previewUrl);
            item.previewUrl = URL.createObjectURL(blob);
            const thumb = document
                .getElementById(`file-${item.id}`)
                ?.querySelector(".file-icon img");
            if (thumb) thumb.src = item.previewUrl;
        }
        item.outputUrl = URL.createObjectURL(blob);
        item.outputName = `${item.file.name.replace(/\.[^/.]+$/, "")}_4000.jpg`;
        updateStatus(item, "completed", 100);
    } catch (error) {
        console.error(error);
        updateStatus(item, "error", 0);
        throw error;
    }
}

async function convertAll() {
    if (!fileQueue.length) {
        alert("Upload some fuckin images first, bro!");
        return;
    }

    showOverlay(
        "Converting images… hold the fuck on",
        "This fuckin shitty site is working its magic."
    );
    elements.convertBtn.disabled = true;

    let processed = 0;
    let failed = 0;

    for (const item of fileQueue) {
        if (item.status === "completed") {
            processed += 1;
            updateGlobalProgress(
                Math.round((processed / fileQueue.length) * 100)
            );
            continue;
        }

        try {
            await convertItem(item);
        } catch {
            failed += 1;
        } finally {
            processed += 1;
            updateGlobalProgress(
                Math.round((processed / fileQueue.length) * 100)
            );
        }
    }

    elements.convertBtn.disabled = false;
    hideOverlay();

    const messages = [];
    const successCount = fileQueue.filter(
        (item) => item.status === "completed"
    ).length;
    if (successCount)
        messages.push(`${successCount} fuckin images converted successfully!`);
    if (failed) messages.push(`${failed} images totally failed, fuck.`);
    if (messages.length) alert(messages.join("\n"));
}

window.downloadFile = function (id) {
    const item = fileQueue.find((entry) => entry.id === id);
    if (!item?.outputUrl) return;
    const link = document.createElement("a");
    link.href = item.outputUrl;
    link.download = item.outputName || "converted.jpg";
    document.body.appendChild(link);
    link.click();
    link.remove();
};

window.removeFile = function (id) {
    const item = fileQueue.find((entry) => entry.id === id);
    if (item?.outputUrl) URL.revokeObjectURL(item.outputUrl);
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
    fileQueue = fileQueue.filter((entry) => entry.id !== id);
    document.getElementById(`file-${id}`)?.remove();
    if (!fileQueue.length) {
        elements.filesList.innerHTML =
            '<div class="empty-state"><p>No fuckin images uploaded yet.</p></div>';
    }
    elements.fileCount.textContent = fileQueue.length;
};

elements.dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    elements.dropzone.classList.add("dragover");
});

elements.dropzone.addEventListener("dragleave", () => {
    elements.dropzone.classList.remove("dragover");
});

elements.dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    elements.dropzone.classList.remove("dragover");
    addFiles(Array.from(event.dataTransfer.files || []));
});

elements.dropzone.addEventListener("click", () => {
    elements.fileInput.click();
});

elements.selectBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    elements.fileInput.click();
});

elements.fileInput.addEventListener("change", (event) => {
    addFiles(Array.from(event.target.files || []));
    elements.fileInput.value = "";
});

elements.convertBtn.addEventListener("click", () => {
    convertAll();
});

elements.clearBtn.addEventListener("click", () => {
    if (!fileQueue.length) return;
    if (!confirm("Clear all these fuckin files?")) return;
    fileQueue.forEach((item) => {
        if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
    });
    fileQueue = [];
    elements.filesList.innerHTML =
        '<div class="empty-state"><p>No fuckin images uploaded yet.</p></div>';
    elements.fileCount.textContent = 0;
});
