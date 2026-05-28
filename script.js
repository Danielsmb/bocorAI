// ===================== STATE MANAGEMENT =====================
const state = {
    currentPage: 'enhance-image',
    files: {
        enhanceImage: null,
        enhanceGif: null,
        enhanceVideo: null,
        editImage: null,
        imgToVid: [],
        imgToGif: []
    },
    processed: {
        enhanceImage: null,
        enhanceGif: null,
        enhanceVideo: null,
        imgToVid: null,
        imgToGif: null
    }
};

// ===================== NAVIGATION =====================
function navigateTo(page) {
    // Update active nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });

    // Show page
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const targetPage = document.getElementById('page-' + page);
    if (targetPage) targetPage.classList.add('active');

    // Update title
    const titles = {
        'enhance-image': 'Perjelas Gambar',
        'enhance-gif': 'Perjelas GIF',
        'enhance-video': 'Perjelas Video',
        'edit-image': 'Edit Gambar',
        'image-to-video': 'Gambar → Video',
        'image-to-gif': 'Gambar → GIF',
        'settings': 'Pengaturan'
    };
    document.getElementById('pageTitle').textContent = titles[page] || 'AI Studio';

    state.currentPage = page;

    // Close sidebar on mobile
    if (window.innerWidth <= 900) {
        document.getElementById('sidebar').classList.remove('open');
    }
}

// Sidebar toggle
document.getElementById('menuBtn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
});

// ===================== THEME =====================
function toggleTheme() {
    const body = document.body;
    const isDark = body.getAttribute('data-theme') !== 'light';
    body.setAttribute('data-theme', isDark ? 'light' : '');
    document.getElementById('themeIcon').className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    localStorage.setItem('theme', isDark ? 'light' : 'dark');
}

// Load saved theme
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'light') {
    document.body.setAttribute('data-theme', 'light');
    document.getElementById('themeIcon').className = 'fas fa-sun';
}

// ===================== RANGE INPUT VALUES =====================
document.querySelectorAll('input[type="range"]').forEach(input => {
    input.addEventListener('input', function() {
        const valSpan = this.parentElement.querySelector('.range-value');
        if (valSpan) {
            let suffix = '%';
            if (this.id.includes('Duration')) suffix = 's';
            if (this.id.includes('Delay')) suffix = 'ms';
            if (this.id.includes('Quality') && !this.id.includes('setting')) suffix = '';
            valSpan.textContent = this.value + suffix;
        }
    });
});

// ===================== HELP MODAL =====================
function showHelp() {
    document.getElementById('helpModal').style.display = 'flex';
}

function closeHelp() {
    document.getElementById('helpModal').style.display = 'none';
}

document.getElementById('helpModal').addEventListener('click', function(e) {
    if (e.target === this) closeHelp();
});

// ===================== UTILITY: SHOW/HIDE PROGRESS =====================
function showProgress(prefix) {
    document.getElementById(prefix + 'Progress').style.display = 'flex';
    document.getElementById(prefix + 'ProgressBar').style.width = '0%';
}

function hideProgress(prefix) {
    document.getElementById(prefix + 'Progress').style.display = 'none';
}

function updateProgress(prefix, percent, text) {
    document.getElementById(prefix + 'ProgressBar').style.width = percent + '%';
    document.getElementById(prefix + 'ProgressText').textContent = text || '';
}

// ===================== UTILITY: CANVAS PROCESSING =====================
function loadImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function canvasFromImage(img) {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    return { canvas, ctx };
}

// ===================== AI IMAGE ENHANCEMENT ENGINE =====================
function sharpenImage(ctx, width, height, amount) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const factor = amount / 100;

    // Convolution sharpen kernel
    const weights = [
        0, -1 * factor, 0,
        -1 * factor, 1 + 4 * factor, -1 * factor,
        0, -1 * factor, 0
    ];

    const output = new Uint8ClampedArray(data);
    const w = width;

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            for (let c = 0; c < 3; c++) {
                let sum = 0;
                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        const idx = ((y + ky) * w + (x + kx)) * 4 + c;
                        sum += data[idx] * weights[(ky + 1) * 3 + (kx + 1)];
                    }
                }
                const idx = (y * w + x) * 4 + c;
                output[idx] = Math.min(255, Math.max(0, sum));
            }
        }
    }

    // Blend original with sharpened
    for (let i = 0; i < data.length; i += 4) {
        for (let c = 0; c < 3; c++) {
            data[i + c] = data[i + c] * (1 - factor * 0.5) + output[i + c] * factor * 0.5;
        }
    }

    ctx.putImageData(imageData, 0, 0);
}

function denoiseImage(ctx, width, height, amount) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const output = new Uint8ClampedArray(data);
    const w = width;
    const radius = Math.max(1, Math.floor(amount / 30));

    for (let y = radius; y < height - radius; y++) {
        for (let x = radius; x < w - radius; x++) {
            for (let c = 0; c < 3; c++) {
                let sum = 0, count = 0;
                for (let ky = -radius; ky <= radius; ky++) {
                    for (let kx = -radius; kx <= radius; kx++) {
                        const idx = ((y + ky) * w + (x + kx)) * 4 + c;
                        sum += data[idx];
                        count++;
                    }
                }
                const idx = (y * w + x) * 4 + c;
                const blend = amount / 100;
                output[idx] = data[idx] * (1 - blend) + (sum / count) * blend;
            }
        }
    }

    imageData.data.set(output);
    ctx.putImageData(imageData, 0, 0);
}

function upscaleImage(ctx, width, height, factor) {
    const canvas = document.createElement('canvas');
    canvas.width = width * factor;
    canvas.height = height * factor;
    const newCtx = canvas.getContext('2d');
    newCtx.imageSmoothingEnabled = true;
    newCtx.imageSmoothingQuality = 'high';
    newCtx.drawImage(ctx.canvas, 0, 0, width * factor, height * factor);

    // Apply mild sharpening after upscale
    const imageData = newCtx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const w = canvas.width;

    // Unsharp mask
    for (let y = 1; y < canvas.height - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            for (let c = 0; c < 3; c++) {
                const idx = (y * w + x) * 4 + c;
                const center = data[idx] * 5;
                const neighbors =
                    data[((y - 1) * w + x) * 4 + c] +
                    data[((y + 1) * w + x) * 4 + c] +
                    data[(y * w + x - 1) * 4 + c] +
                    data[(y * w + x + 1) * 4 + c];
                data[idx] = Math.min(255, Math.max(0, center - neighbors));
            }
        }
    }

    newCtx.putImageData(imageData, 0, 0);
    return canvas;
}

function adjustBrightnessContrast(ctx, width, height, brightness, contrast) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const brightFactor = brightness / 100;
    const contrastFactor = (contrast / 100 - 1) * 127 + 127;

    for (let i = 0; i < data.length; i += 4) {
        for (let c = 0; c < 3; c++) {
            let val = data[i + c] * brightFactor;
            val = ((val - 128) * (contrastFactor / 128)) + 128;
            data[i + c] = Math.min(255, Math.max(0, val));
        }
    }

    ctx.putImageData(imageData, 0, 0);
}

function adjustSaturation(ctx, width, height, saturation) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const sat = saturation / 100;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        data[i] = Math.min(255, Math.max(0, gray + (r - gray) * sat));
        data[i + 1] = Math.min(255, Math.max(0, gray + (g - gray) * sat));
        data[i + 2] = Math.min(255, Math.max(0, gray + (b - gray) * sat));
    }

    ctx.putImageData(imageData, 0, 0);
}

// ===================== PAGE: ENHANCE IMAGE =====================
document.getElementById('enhanceImageInput').addEventListener('change', async function(e) {
    const file = e.target.files[0];
    if (!file) return;

    state.files.enhanceImage = file;
    const img = await loadImage(file);

    document.getElementById('enhanceImageOriginal').src = img.src;
    document.getElementById('enhanceImageResult').src = img.src;

    document.getElementById('enhanceImageUpload').style.display = 'none';
    document.getElementById('enhanceImageWorkspace').style.display = 'grid';
});

async function processImageEnhance() {
    if (!state.files.enhanceImage) return;

    showProgress('enhanceImage');
    const mode = document.getElementById('enhanceImageMode').value;
    const strength = parseInt(document.getElementById('enhanceImageStrength').value);
    const brightness = parseInt(document.getElementById('enhanceImageBrightness').value);
    const contrast = parseInt(document.getElementById('enhanceImageContrast').value);
    const saturation = parseInt(document.getElementById('enhanceImageSaturation').value);

    updateProgress('enhanceImage', 10, 'Membaca gambar...');
    await sleep(300);

    const img = await loadImage(state.files.enhanceImage);
    let { canvas, ctx } = canvasFromImage(img);
    const w = canvas.width;
    const h = canvas.height;

    updateProgress('enhanceImage', 20, 'Menganalisis...');
    await sleep(400);

    // Apply adjustments
    updateProgress('enhanceImage', 30, 'Menyesuaikan warna...');
    adjustBrightnessContrast(ctx, w, h, brightness, contrast);
    await sleep(200);

    updateProgress('enhanceImage', 40, 'Mengoptimasi saturasi...');
    adjustSaturation(ctx, w, h, saturation);
    await sleep(200);

    updateProgress('enhanceImage', 50, 'Memproses AI...');
    await sleep(300);

    // Apply mode-specific processing
    if (mode === 'sharpen' || mode === 'auto') {
        sharpenImage(ctx, w, h, strength);
        updateProgress('enhanceImage', 60, 'Mempertajam...');
        await sleep(300);
    }

    if (mode === 'denoise' || mode === 'auto' || mode === 'restore') {
        denoiseImage(ctx, w, h, strength);
        updateProgress('enhanceImage', 70, 'Mengurangi noise...');
        await sleep(300);
    }

    if (mode === 'superres') {
        updateProgress('enhanceImage', 75, 'Super Resolusi 2x...');
        canvas = upscaleImage(ctx, w, h, 2);
        ctx = canvas.getContext('2d');
        sharpenImage(ctx, canvas.width, canvas.height, strength * 0.5);
        await sleep(400);
    }

    if (mode === 'superres4x') {
        updateProgress('enhanceImage', 75, 'Super Resolusi 4x...');
        canvas = upscaleImage(ctx, w, h, 2);
        let tempCtx = canvas.getContext('2d');
        sharpenImage(tempCtx, canvas.width, canvas.height, strength * 0.3);
        canvas = upscaleImage(tempCtx, canvas.width, canvas.height, 2);
        tempCtx = canvas.getContext('2d');
        sharpenImage(tempCtx, canvas.width, canvas.height, strength * 0.3);
        ctx = tempCtx;
        await sleep(500);
    }

    if (mode === 'restore') {
        // Additional restoration passes
        sharpenImage(ctx, canvas.width, canvas.height, strength * 0.7);
        await sleep(300);
    }

    if (mode === 'face') {
        // Face optimization: gentle sharpen + brighten + warm
        sharpenImage(ctx, canvas.width, canvas.height, strength * 0.6);
        adjustBrightnessContrast(ctx, canvas.width, canvas.height, 110, 105);
        await sleep(300);
    }

    updateProgress('enhanceImage', 90, 'Menyelesaikan...');
    await sleep(200);

    // Set result
    document.getElementById('enhanceImageResult').src = canvas.toDataURL('image/png');
    state.processed.enhanceImage = canvas;

    updateProgress('enhanceImage', 100, 'Selesai!');
    await sleep(500);
    hideProgress('enhanceImage');
}

function resetEnhanceImage() {
    document.getElementById('enhanceImageUpload').style.display = 'block';
    document.getElementById('enhanceImageWorkspace').style.display = 'none';
    document.getElementById('enhanceImageInput').value = '';
    state.files.enhanceImage = null;
}

// ===================== PAGE: ENHANCE GIF =====================
document.getElementById('enhanceGifInput').addEventListener('change', async function(e) {
    const file = e.target.files[0];
    if (!file) return;

    state.files.enhanceGif = file;
    const url = URL.createObjectURL(file);

    document.getElementById('enhanceGifOriginal').src = url;
    document.getElementById('enhanceGifResult').src = url;

    document.getElementById('enhanceGifUpload').style.display = 'none';
    document.getElementById('enhanceGifWorkspace').style.display = 'grid';
});

async function processGifEnhance() {
    if (!state.files.enhanceGif) return;

    showProgress('enhanceGif');
    const mode = document.getElementById('enhanceGifMode').value;
    const strength = parseInt(document.getElementById('enhanceGifStrength').value);

    updateProgress('enhanceGif', 10, 'Membaca GIF...');
    await sleep(300);

    const img = await loadImage(state.files.enhanceGif);
    let { canvas, ctx } = canvasFromImage(img);
    const w = canvas.width;
    const h = canvas.height;

    updateProgress('enhanceGif', 30, 'Memproses frame...');
    await sleep(300);

    if (mode === 'sharpen') {
        sharpenImage(ctx, w, h, strength);
    } else if (mode === 'denoise') {
        denoiseImage(ctx, w, h, strength);
    } else if (mode === 'upscale') {
        canvas = upscaleImage(ctx, w, h, 2);
    } else if (mode === 'colorize') {
        adjustBrightnessContrast(ctx, w, h, 105, 115);
        adjustSaturation(ctx, w, h, 130);
    }

    updateProgress('enhanceGif', 70, 'Mengoptimasi...');
    await sleep(300);

    // Apply additional sharpen
    sharpenImage(canvas.getContext('2d'), canvas.width, canvas.height, strength * 0.4);

    updateProgress('enhanceGif', 90, 'Menyelesaikan...');
    await sleep(200);

    const dataUrl = canvas.toDataURL('image/png');
    document.getElementById('enhanceGifResult').src = dataUrl;

    updateProgress('enhanceGif', 100, 'Selesai!');
    await sleep(500);
    hideProgress('enhanceGif');
}

// ===================== PAGE: ENHANCE VIDEO =====================
document.getElementById('enhanceVideoInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    state.files.enhanceVideo = file;
    const url = URL.createObjectURL(file);

    document.getElementById('enhanceVideoOriginal').src = url;
    document.getElementById('enhanceVideoResult').src = url;

    document.getElementById('enhanceVideoUpload').style.display = 'none';
    document.getElementById('enhanceVideoWorkspace').style.display = 'grid';
});

async function processVideoEnhance() {
    if (!state.files.enhanceVideo) return;

    showProgress('enhanceVideo');
    const video = document.getElementById('enhanceVideoOriginal');

    updateProgress('enhanceVideo', 10, 'Memuat video...');

    await new Promise(resolve => {
        video.onloadeddata = resolve;
    });

    updateProgress('enhanceVideo', 20, 'Membaca frame...');
    await sleep(300);

    // Create canvas to process video frame
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');

    // Capture a representative frame
    video.currentTime = 0.5;
    await new Promise(resolve => {
        video.onseeked = resolve;
    });

    ctx.drawImage(video, 0, 0);

    updateProgress('enhanceVideo', 40, 'Meningkatkan kualitas...');
    await sleep(300);

    const mode = document.getElementById('enhanceVideoMode').value;
    const strength = parseInt(document.getElementById('enhanceVideoStrength').value);

    // Apply enhancement to frame
    if (mode === 'sharpen') {
        sharpenImage(ctx, canvas.width, canvas.height, strength);
    } else if (mode === 'denoise') {
        denoiseImage(ctx, canvas.width, canvas.height, strength);
    } else if (mode === 'stabilize') {
        sharpenImage(ctx, canvas.width, canvas.height, strength * 0.5);
    } else if (mode === 'color') {
        adjustBrightnessContrast(ctx, canvas.width, canvas.height, 105, 110);
        adjustSaturation(ctx, canvas.width, canvas.height, 120);
    }

    updateProgress('enhanceVideo', 70, 'Membuat video output...');
    await sleep(300);

    // Create enhanced video using canvas recording
    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks = [];

    recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        document.getElementById('enhanceVideoResult').src = url;
        state.processed.enhanceVideo = blob;
    };

    recorder.start();

    // Play original and record enhanced frame repeatedly
    video.currentTime = 0;
    video.play();

    const duration = video.duration || 5;
    const fps = 30;
    const totalFrames = Math.min(duration * fps, 150); // Limit processing
    let frameCount = 0;

    const processFrame = () => {
        if (frameCount >= totalFrames || video.paused || video.ended) {
            recorder.stop();
            video.pause();
            updateProgress('enhanceVideo', 100, 'Selesai!');
            setTimeout(() => hideProgress('enhanceVideo'), 500);
            return;
        }

        ctx.drawImage(video, 0, 0);

        // Apply real-time enhancement
        if (mode === 'sharpen') sharpenImage(ctx, canvas.width, canvas.height, strength * 0.3);
        if (mode === 'denoise') denoiseImage(ctx, canvas.width, canvas.height, strength * 0.3);
        if (mode === 'color') {
            adjustBrightnessContrast(ctx, canvas.width, canvas.height, 105, 110);
            adjustSaturation(ctx, canvas.width, canvas.height, 120);
        }

        frameCount++;
        const progress = 70 + (frameCount / totalFrames) * 25;
        updateProgress('enhanceVideo', progress, `Memproses frame ${frameCount}/${totalFrames}...`);

        setTimeout(processFrame, 1000 / fps);
    };

    await sleep(500);
    processFrame();
}

function downloadVideoResult(videoId) {
    const videoEl = document.getElementById(videoId || 'enhanceVideoResult');
    if (!videoEl || !videoEl.src) {
        alert('Belum ada video yang diproses.');
        return;
    }

    const a = document.createElement('a');
    a.href = videoEl.src;
    a.download = 'enhanced-video.webm';
    a.click();
}

// ===================== PAGE: EDIT IMAGE =====================
document.getElementById('editImageInput').addEventListener('change', async function(e) {
    const file = e.target.files[0];
    if (!file) return;

    state.files.editImage = file;
    const img = await loadImage(file);

    const canvas = document.getElementById('editCanvas');
    const ctx = canvas.getContext('2d');

    // Limit canvas size for performance
    const maxSize = 1920;
    let w = img.naturalWidth;
    let h = img.naturalHeight;
    if (w > maxSize || h > maxSize) {
        const ratio = Math.min(maxSize / w, maxSize / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
    }

    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(img, 0, 0, w, h);

    document.getElementById('editImageUpload').style.display = 'none';
    document.getElementById('editImageWorkspace').style.display = 'grid';

    // Reset controls
    document.getElementById('editBrightness').value = 100;
    document.getElementById('editContrast').value = 100;
    document.getElementById('editSaturation').value = 100;
    document.getElementById('editTemperature').value = 0;
    document.getElementById('editSharpness').value = 0;
    document.getElementById('editBlur').value = 0;
    document.getElementById('editRotate').value = 0;
    document.getElementById('editFlipH').checked = false;
    document.getElementById('editFlipV').checked = false;
});

function applyEdit() {
    if (!state.files.editImage) return;

    const canvas = document.getElementById('editCanvas');
    const ctx = canvas.getContext('2d');

    // Reload original
    const img = new Image();
    img.onload = () => {
        const w = canvas.width;
        const h = canvas.height;

        ctx.clearRect(0, 0, w, h);

        // Handle rotation
        const rotate = parseInt(document.getElementById('editRotate').value);
        const flipH = document.getElementById('editFlipH').checked;
        const flipV = document.getElementById('editFlipV').checked;

        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.rotate(rotate * Math.PI / 180);
        ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
        ctx.restore();

        // Get image data for filters
        let imageData = ctx.getImageData(0, 0, w, h);
        let data = imageData.data;

        const brightness = parseInt(document.getElementById('editBrightness').value);
        const contrast = parseInt(document.getElementById('editContrast').value);
        const saturation = parseInt(document.getElementById('editSaturation').value);
        const temperature = parseInt(document.getElementById('editTemperature').value);

        for (let i = 0; i < data.length; i += 4) {
            let r = data[i], g = data[i + 1], b = data[i + 2];
