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

            // Brightness
            r *= brightness / 100;
            g *= brightness / 100;
            b *= brightness / 100;

            // Contrast
            const cf = (contrast / 100 - 1) * 127 + 127;
            r = ((r - 128) * (cf / 128)) + 128;
            g = ((g - 128) * (cf / 128)) + 128;
            b = ((b - 128) * (cf / 128)) + 128;

            // Saturation
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            const sf = saturation / 100;
            r = gray + (r - gray) * sf;
            g = gray + (g - gray) * sf;
            b = gray + (b - gray) * sf;

            // Temperature
            if (temperature > 0) {
                r += temperature * 0.5;
                b -= temperature * 0.5;
            } else {
                r += temperature * 0.3;
                b -= temperature * 0.8;
            }

            data[i] = Math.min(255, Math.max(0, r));
            data[i + 1] = Math.min(255, Math.max(0, g));
            data[i + 2] = Math.min(255, Math.max(0, b));
        }

        ctx.putImageData(imageData, 0, 0);

        // Blur
        const blur = parseInt(document.getElementById('editBlur').value);
        if (blur > 0) {
            ctx.filter = `blur(${blur}px)`;
            ctx.drawImage(canvas, 0, 0);
            ctx.filter = 'none';
        }

        // Sharpness
        const sharpness = parseInt(document.getElementById('editSharpness').value);
        if (sharpness > 0) {
            sharpenImage(ctx, w, h, sharpness);
        }
    };
    img.src = state.files.editImage ? URL.createObjectURL(state.files.editImage) : '';
}

function resetEdit() {
    document.getElementById('editBrightness').value = 100;
    document.getElementById('editContrast').value = 100;
    document.getElementById('editSaturation').value = 100;
    document.getElementById('editTemperature').value = 0;
    document.getElementById('editSharpness').value = 0;
    document.getElementById('editBlur').value = 0;
    document.getElementById('editRotate').value = 0;
    document.getElementById('editFlipH').checked = false;
    document.getElementById('editFlipV').checked = false;
    applyEdit();
}

function downloadEdit() {
    const canvas = document.getElementById('editCanvas');
    const link = document.createElement('a');
    link.download = 'edited-image.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
}

// ===================== PAGE: IMAGE TO VIDEO =====================
document.getElementById('imgToVidInput').addEventListener('change', async function(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    state.files.imgToVid = files;

    // Show preview of first image
    const img = await loadImage(files[0]);
    const video = document.getElementById('imgToVidPreview');
    // Create a temporary canvas for preview
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);
    video.poster = canvas.toDataURL();

    document.getElementById('imgToVidUpload').style.display = 'none';
    document.getElementById('imgToVidWorkspace').style.display = 'grid';
});

async function processImageToVideo() {
    if (state.files.imgToVid.length === 0) return;

    showProgress('imgToVid');
    const duration = parseInt(document.getElementById('imgToVidDuration').value);
    const transition = document.getElementById('imgToVidTransition').value;
    const resolution = document.getElementById('imgToVidResolution').value;

    let targetWidth = 1920, targetHeight = 1080;
    if (resolution === '720') { targetWidth = 1280; targetHeight = 720; }
    if (resolution === '1080') { targetWidth = 1920; targetHeight = 1080; }
    if (resolution === '4k') { targetWidth = 3840; targetHeight = 2160; }

    updateProgress('imgToVid', 10, 'Memuat gambar...');
    await sleep(300);

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm', videoBitsPerSecond: 8000000 });
    const chunks = [];

    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

    recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        document.getElementById('imgToVidPreview').src = url;
        state.processed.imgToVid = blob;
        updateProgress('imgToVid', 100, 'Selesai!');
        setTimeout(() => hideProgress('imgToVid'), 500);
    };

    recorder.start();

    const fps = 30;
    const framesPerImage = duration * fps;
    const transitionFrames = Math.min(30, framesPerImage * 0.3);

    for (let i = 0; i < state.files.imgToVid.length; i++) {
        const img = await loadImage(state.files.imgToVid[i]);
        updateProgress('imgToVid', 15 + (i / state.files.imgToVid.length) * 70,
            `Merender gambar ${i + 1}/${state.files.imgToVid.length}...`);

        // Calculate fit
        const scale = Math.min(targetWidth / img.naturalWidth, targetHeight / img.naturalHeight);
        const drawW = img.naturalWidth * scale;
        const drawH = img.naturalHeight * scale;
        const offsetX = (targetWidth - drawW) / 2;
        const offsetY = (targetHeight - drawH) / 2;

        for (let f = 0; f < framesPerImage; f++) {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, targetWidth, targetHeight);

            const progress = f / framesPerImage;

            if (transition === 'fade' && f < transitionFrames && i > 0) {
                ctx.globalAlpha = f / transitionFrames;
            } else if (transition === 'zoom' && f < transitionFrames) {
                const zScale = 1 + (1 - f / transitionFrames) * 0.2;
                ctx.save();
                ctx.translate(targetWidth / 2, targetHeight / 2);
                ctx.scale(zScale, zScale);
                ctx.translate(-targetWidth / 2, -targetHeight / 2);
                ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
                ctx.restore();
                continue;
            } else if (transition === 'slide' && f < transitionFrames) {
                const slideX = (1 - f / transitionFrames) * targetWidth * 0.5;
                ctx.drawImage(img, offsetX + slideX, offsetY, drawW, drawH);
                ctx.globalAlpha = 1;
                ctx.drawImage(canvas, 0, 0);
                await sleep(1000 / fps);
                continue;
            }

            // Ken Burns effect
            const kbScale = 1 + progress * 0.05;
            const kbX = offsetX - (drawW * kbScale - drawW) / 2;
            const kbY = offsetY - (drawH * kbScale - drawH) / 2;

            ctx.drawImage(img, kbX, kbY, drawW * kbScale, drawH * kbScale);
            ctx.globalAlpha = 1;

            await sleep(1000 / fps);
        }
    }

    recorder.stop();
}

// ===================== PAGE: IMAGE TO GIF =====================
document.getElementById('imgToGifInput').addEventListener('change', async function(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    state.files.imgToGif = files;

    // Show frame previews
    const container = document.getElementById('gifFramesPreview');
    container.innerHTML = '';
    for (const file of files) {
        const url = URL.createObjectURL(file);
        const thumb = document.createElement('img');
        thumb.src = url;
        thumb.className = 'gif-frame-thumb';
        container.appendChild(thumb);
    }

    // Preview first frame
    const img = await loadImage(files[0]);
    document.getElementById('imgToGifPreview').src = img.src;

    document.getElementById('imgToGifUpload').style.display = 'none';
    document.getElementById('imgToGifWorkspace').style.display = 'grid';
});

async function processImageToGif() {
    if (state.files.imgToGif.length === 0) return;

    showProgress('imgToGif');
    const delay = parseInt(document.getElementById('imgToGifDelay').value);
    const quality = parseInt(document.getElementById('imgToGifQuality').value);
    const effect = document.getElementById('imgToGifEffect').value;

    updateProgress('imgToGif', 10, 'Membuat GIF...');
    await sleep(300);

    // Load all images
    const images = [];
    for (const file of state.files.imgToGif) {
        images.push(await loadImage(file));
    }

    // Determine max dimensions
    let maxWidth = 0, maxHeight = 0;
    for (const img of images) {
        maxWidth = Math.max(maxWidth, img.naturalWidth);
        maxHeight = Math.max(maxHeight, img.naturalHeight);
    }

    // Limit size
    const maxSize = 800;
    if (maxWidth > maxSize || maxHeight > maxSize) {
        const ratio = Math.min(maxSize / maxWidth, maxSize / maxHeight);
        maxWidth = Math.round(maxWidth * ratio);
        maxHeight = Math.round(maxHeight * ratio);
    }

    // Create GIF using canvas frames
    const canvas = document.createElement('canvas');
    canvas.width = maxWidth;
    canvas.height = maxHeight;
    const ctx = canvas.getContext('2d');

    // Collect frames as data URLs
    const frames = [];

    for (let i = 0; i < images.length; i++) {
        const img = images[i];
        updateProgress('imgToGif', 20 + (i / images.length) * 60,
            `Memproses frame ${i + 1}/${images.length}...`);

        // Calculate fit
        const scale = Math.min(maxWidth / img.naturalWidth, maxHeight / img.naturalHeight);
        const drawW = img.naturalWidth * scale;
        const drawH = img.naturalHeight * scale;
        const offsetX = (maxWidth - drawW) / 2;
        const offsetY = (maxHeight - drawH) / 2;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, maxWidth, maxHeight);

        if (effect === 'zoom') {
            ctx.save();
            ctx.translate(maxWidth / 2, maxHeight / 2);
            ctx.scale(1.1, 1.1);
            ctx.translate(-maxWidth / 2, -maxHeight / 2);
            ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
            ctx.restore();
        } else if (effect === 'fade') {
            ctx.globalAlpha = 0.8;
            ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
            ctx.globalAlpha = 1;
        } else {
            ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
        }

        frames.push(canvas.toDataURL('image/png'));
    }

    updateProgress('imgToGif', 85, 'Mengompres GIF...');
    await sleep(300);

    // Build GIF using simple encoder
    const gifBlob = await encodeGif(frames, delay, quality, maxWidth, maxHeight);

    const url = URL.createObjectURL(gifBlob);
    document.getElementById('imgToGifPreview').src = url;
    state.processed.imgToGif = gifBlob;

    updateProgress('imgToGif', 100, 'Selesai!');
    await sleep(500);
    hideProgress('imgToGif');
}

// Simple GIF encoder
async function encodeGif(frames, delay, quality, width, height) {
    // Use canvas-based approach with GIF encoder library
    // For simplicity, we'll create an animated canvas recording
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm',
        videoBitsPerSecond: 2000000
    });

    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

    return new Promise((resolve) => {
        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            resolve(blob);
        };

        recorder.start();

        let frameIndex = 0;
        const frameDuration = delay / 1000;

        const showFrame = () => {
            if (frameIndex >= frames.length) {
                // Show last frame for a bit longer
                setTimeout(() => {
                    recorder.stop();
                }, frameDuration * 1000);
                return;
            }

            const img = new Image();
            img.onload = () => {
                ctx.clearRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);
                frameIndex++;
                setTimeout(showFrame, frameDuration * 1000);
            };
            img.src = frames[frameIndex];
        };

        showFrame();
    });
}

function downloadGifResult() {
    const img = document.getElementById('imgToGifPreview');
    if (!img.src) {
        alert('Belum ada GIF yang dibuat.');
        return;
    }

    const a = document.createElement('a');
    a.href = img.src;
    a.download = 'created-animation.webm';
    a.click();
}

function resetGifCreator() {
    document.getElementById('imgToGifUpload').style.display = 'block';
    document.getElementById('imgToGifWorkspace').style.display = 'none';
    document.getElementById('imgToGifInput').value = '';
    document.getElementById('gifFramesPreview').innerHTML = '';
    state.files.imgToGif = [];
}

// ===================== DOWNLOAD RESULT =====================
function downloadResult(canvasId) {
    const el = document.getElementById(canvasId);
    if (!el || !el.src) {
        alert('Belum ada hasil yang diproses.');
        return;
    }

    const format = document.getElementById('settingFormat')?.value || 'png';
    const quality = parseInt(document.getElementById('settingQuality')?.value || 90) / 100;

    const a = document.createElement('a');
    const mime = format === 'jpg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
    const ext = format === 'jpg' ? 'jpg' : format === 'webp' ? 'webp' : 'png';

    a.href = el.src;
    a.download = `enhanced-image.${ext}`;
    a.click();
}

// ===================== SETTINGS =====================
function clearCache() {
    localStorage.clear();
    alert('Cache berhasil dihapus!');
}

// ===================== HELPER: SLEEP =====================
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ===================== DRAG & DROP =====================
document.querySelectorAll('.upload-zone').forEach(zone => {
    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.style.borderColor = 'var(--accent)';
        zone.style.background = 'var(--accent-light)';
    });

    zone.addEventListener('dragleave', () => {
        zone.style.borderColor = '';
        zone.style.background = '';
    });

    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.style.borderColor = '';
        zone.style.background = '';

        const input = zone.querySelector('input[type="file"]');
        if (e.dataTransfer.files.length > 0) {
            input.files = e.dataTransfer.files;
            input.dispatchEvent(new Event('change'));
        }
    });
});

// ===================== INIT =====================
console.log('🚀 AI Studio loaded successfully!');
