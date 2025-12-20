import { WatermarkEngine } from '../js/core/watermarkEngine.js';
import BG_48_PATH from '../assets/bg_48.png';
import BG_96_PATH from '../assets/bg_96.png';

// ============ DOM UTILITIES ============
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

function findGeminiImages() {
  return [...document.querySelectorAll('img[src*="googleusercontent.com"]')].filter(isValidGeminiImage);
}

function isValidGeminiImage(img) {
  if (/=s\d+\-rj/.test(img.src)) return true;
  return img.naturalWidth >= 256 && img.naturalHeight >= 256;
}

// ============ IMAGE PROCESSING ============
let engine = null;
const processingQueue = new Set();

async function processImage(imgElement) {
  if (!engine || processingQueue.has(imgElement)) return;

  try {
    imgElement.dataset.watermarkProcessed = 'processing';
    processingQueue.add(imgElement);

    if (!isValidGeminiImage(imgElement)) {
      imgElement.dataset.watermarkProcessed = 'skipped';
      return;
    }

    const src = imgElement.src;
    imgElement.src = '';
    imgElement.dataset.src = src;

    const blob = await new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url: src.replace(/=s\d+.+$/, '=s0'),
        responseType: 'blob',
        onload: (response) => resolve(response.response),
        onerror: reject
      });
    });

    const blobUrl = URL.createObjectURL(blob);
    const tempImg = new Image();
    await new Promise((resolve, reject) => {
      tempImg.onload = resolve;
      tempImg.onerror = reject;
      tempImg.src = blobUrl;
    });

    const resultCanvas = await engine.removeWatermarkFromImage(tempImg);
    const processedBlob = await new Promise((resolve) => {
      resultCanvas.toBlob(resolve, 'image/png');
    });

    URL.revokeObjectURL(blobUrl);
    imgElement.src = URL.createObjectURL(processedBlob);
    imgElement.dataset.watermarkProcessed = 'true';

    console.log('[Gemini Watermark Remover] Processed image');
  } catch (error) {
    console.warn('[Gemini Watermark Remover] Failed to process image:', error);
    imgElement.dataset.watermarkProcessed = 'failed';
  } finally {
    processingQueue.delete(imgElement);
  }
}

async function processAllImages() {
  const images = findGeminiImages();
  console.log(`[Gemini Watermark Remover] Found ${images.length} images to process`);

  for (const img of images) {
    processImage(img);
  }
}

// ============ MUTATION OBSERVER ============
function setupMutationObserver() {
  const observer = new MutationObserver(debounce(() => {
    processAllImages();
  }, 100));

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  console.log('[Gemini Watermark Remover] MutationObserver active');
}

// ============ FETCH INTERCEPTION ============

async function processImageBlob(blob) {
  const blobUrl = URL.createObjectURL(blob);
  const img = new Image();

  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = blobUrl;
  });

  const resultCanvas = await engine.removeWatermarkFromImage(img);
  URL.revokeObjectURL(blobUrl);

  return new Promise((resolve) => {
    resultCanvas.toBlob(resolve, 'image/png');
  });
}

async function getImage(base64) {
  const img = new Image();
  img.src = base64;
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });
  return img;
}

const { fetch: origFetch } = unsafeWindow;
unsafeWindow.fetch = async (...args) => {
  const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;

  if (/^https:\/\/lh3\.googleusercontent\.com\/rd-gg(-dl)?\//.test(url)) {
    console.log('[Gemini Watermark Remover] Intercepting:', url);

    const origUrl = url.replace(/=s\d+.+$/, '=s0');
    if (typeof args[0] === 'string') {
      args[0] = origUrl;
    } else if (args[0]?.url) {
      args[0].url = origUrl;
    }

    const response = await origFetch(...args);

    if (!engine || !response.ok) {
      return response;
    }

    try {
      const blob = await response.blob();
      const processedBlob = await processImageBlob(blob);

      return new Response(processedBlob, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    } catch (error) {
      console.warn('[Gemini Watermark Remover] Processing failed:', error);
      return response;
    }
  }

  return origFetch(...args);
};

// ============ INITIALIZATION ============
async function init() {
  try {
    console.log('[Gemini Watermark Remover] Initializing...');
    engine = new WatermarkEngine({
      bg48: await getImage(BG_48_PATH),
      bg96: await getImage(BG_96_PATH)
    });

    await processAllImages();
    setupMutationObserver();

    console.log('[Gemini Watermark Remover] Ready');
  } catch (error) {
    console.error('[Gemini Watermark Remover] Initialization failed:', error);
  }
}

init();