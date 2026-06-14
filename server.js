const express = require('express');
const cors = require('cors');
const dns = require('dns');
const Jimp = require('jimp');
const potrace = require('potrace');
require('dotenv').config();

// فرض استخدام خوادم DNS العامة لضمان استقرار الاتصالات
try {
    if (typeof dns.setServers === 'function') {
        dns.setServers(['8.8.8.8', '1.1.1.1']);
        console.log("📡 [DNS Config] Forced DNS to Google & Cloudflare successfully.");
    }
} catch (err) {
    console.warn("⚠️ [DNS Warning] Custom DNS override failed:", err.message);
}

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));

// خوارزمية K-Means سريعة ومطورة لتجميع واستخلاص عينات الألوان بدقة عالية
function runKMeans(pixels, k, maxIterations = 12) {
    // اختيار مراكز عشوائية أولية من بكسلات الصورة المتاحة
    let centroids = [];
    for (let i = 0; i < k; i++) {
        centroids.push(pixels[Math.floor(Math.random() * pixels.length)]);
    }

    for (let iter = 0; iter < maxIterations; iter++) {
        let clusters = Array.from({ length: k }, () => []);
        
        // تعيين كل بكسل للمركز اللوني الأقرب رياضياً
        for (let p of pixels) {
            let minDist = Infinity;
            let closestCentroid = 0;
            for (let c = 0; c < k; c++) {
                let dist = Math.sqrt(
                    Math.pow(p.r - centroids[c].r, 2) +
                    Math.pow(p.g - centroids[c].g, 2) +
                    Math.pow(p.b - centroids[c].b, 2)
                );
                if (dist < minDist) {
                    minDist = dist;
                    closestCentroid = c;
                }
            }
            clusters[closestCentroid].push(p);
        }

        // إعادة حساب متوسط مراكز الألوان للخطوة التالية
        let newCentroids = [];
        for (let c = 0; c < k; c++) {
            if (clusters[c].length === 0) {
                newCentroids.push(centroids[c]);
                continue;
            }
            let sumR = 0, sumG = 0, sumB = 0;
            for (let p of clusters[c]) {
                sumR += p.r;
                sumG += p.g;
                sumB += p.b;
            }
            newCentroids.push({
                r: Math.round(sumR / clusters[c].length),
                g: Math.round(sumG / clusters[c].length),
                b: Math.round(sumB / clusters[c].length)
            });
        }
        centroids = newCentroids;
    }
    
    // تحويل المخرجات إلى صيغة Hex المعتمدة في التصميم
    return centroids.map(c => {
        const rHex = c.r.toString(16).padStart(2, '0');
        const gHex = c.g.toString(16).padStart(2, '0');
        const bHex = c.b.toString(16).padStart(2, '0');
        return `#${rHex}${gHex}${bHex}`.toUpperCase();
    });
}

app.post('/api/extract-palette', async (req, res) => {
    try {
        const { image, maxColors } = req.body;
        if (!image) {
            return res.status(400).json({ error: "يرجى توفير أو رفع ملف الصورة." });
        }

        console.log("🎨 [K-Means Palette] Extracting optimal color palette...");
        const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, 'base64');
        
        // قراءة الصورة وتقليص حجمها مؤقتاً لتسريع حسابات التجميع البكسلي اللحظي
        const jimpImage = await Jimp.read(buffer);
        jimpImage.scaleToFit(140, 140);

        const pixels = [];
        jimpImage.scan(0, 0, jimpImage.bitmap.width, jimpImage.bitmap.height, function(x, y, idx) {
            const r = this.bitmap.data[idx + 0];
            const g = this.bitmap.data[idx + 1];
            const b = this.bitmap.data[idx + 2];
            const a = this.bitmap.data[idx + 3];
            // تصفية وحذف الخلفيات الشفافة بالكامل من عملية الحساب اللوني
            if (a > 30) {
                pixels.push({ r, g, b });
            }
        });

        if (pixels.length === 0) {
            return res.status(400).json({ error: "الصورة فارغة أو شفافة بالكامل." });
        }

        const kValue = Math.min(maxColors || 12, pixels.length);
        const palette = runKMeans(pixels, kValue);

        res.json({ palette });

    } catch (err) {
        console.error("❌ [Palette Error]:", err.message);
        res.status(500).json({ error: `فشل استخراج الألوان: ${err.message}` });
    }
});

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
}

app.post('/api/vectorize-local-pipeline', async (req, res) => {
    try {
        const { image, palette, options } = req.body;
        if (!image || !palette || palette.length === 0) {
            return res.status(400).json({ error: "البيانات المدخلة أو باليتة الألوان المخصصة غير كاملة." });
        }

        console.log(`📐 [Vectorizer Pipeline] Running color layered Potrace with ${palette.length} channels...`);
        const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
        const imgBuffer = Buffer.from(base64Data, 'base64');

        const originalImage = await Jimp.read(imgBuffer);
        
        // خيار تنظيف ومعالجة الصورة لإزالة الضجيج البكسلي (Noise Reduction)
        if (options && options.noiseReduction > 0) {
            const blurRadius = Math.ceil(options.noiseReduction / 10);
            originalImage.blur(blurRadius);
        }

        const width = originalImage.bitmap.width;
        const height = originalImage.bitmap.height;

        // مصفوفة لتخزين المسارات المولدة لكل طبقة لونية
        const svgLayerPaths = [];
        const rgbPalette = palette.map(hex => ({ hex, rgb: hexToRgb(hex), count: 0 }));

        // 1. فرز وتصنيف كافة بكسلات الصورة وتوزيعها على الطبقات اللونية الأقرب لها
        const quantizedBuffer = new Uint8Array(width * height);
        
        originalImage.scan(0, 0, width, height, function(x, y, idx) {
            const r = this.bitmap.data[idx + 0];
            const g = this.bitmap.data[idx + 1];
            const b = this.bitmap.data[idx + 2];
            const a = this.bitmap.data[idx + 3];

            if (a < 30) {
                quantizedBuffer[y * width + x] = 255; // شفافة
                return;
            }

            let minDist = Infinity;
            let closestColorIdx = 0;

            for (let i = 0; i < rgbPalette.length; i++) {
                const dist = Math.sqrt(
                    Math.pow(r - rgbPalette[i].rgb.r, 2) +
                    Math.pow(g - rgbPalette[i].rgb.g, 2) +
                    Math.pow(b - rgbPalette[i].rgb.b, 2)
                );
                if (dist < minDist) {
                    minDist = dist;
                    closestColorIdx = i;
                }
            }
            quantizedBuffer[y * width + x] = closestColorIdx;
            rgbPalette[closestColorIdx].count++; // عد البكسلات لترتيب الطبقات لاحقاً
        });

        // ترتيب الطبقات تنازلياً حسب المساحة (الأكبر حجماً في الأسفل والخطوط الرفيعة والتفاصيل في الأعلى لضمان تماسك الرسم)
        const sortedPalette = [...rgbPalette].sort((a, b) => b.count - a.count);

        // 2. معالجة وتوليد مسارات Potrace لكل طبقة على حدة بشكل منفصل وموازي
        const tracingPromises = sortedPalette.map((layer, index) => {
            if (layer.count === 0) return Promise.resolve(null);

            return new Promise(async (resolve) => {
                // إنشاء صورة مونوكروم أحادية (أبيض وأسود) للطبقة الحالية
                const monoImage = new Jimp(width, height, 0xFFFFFFFF);

                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        const pixelIdx = quantizedBuffer[y * width + x];
                        if (pixelIdx !== 255 && rgbPalette[pixelIdx].hex === layer.hex) {
                            monoImage.setPixelColor(0x000000FF, x, y); // بكسل نشط للرسم
                        }
                    }
                }

                const monoBuffer = await monoImage.getBufferAsync(Jimp.MIME_PNG);

                // ضبط إعدادات الـ Potrace الدقيقة لمنع حذف التفاصيل والمنحنيات الرفيعة
                const potraceOptions = {
                    turdSize: options ? parseInt(options.turdSize) : 2,
                    alphaMax: options ? parseFloat(options.alphaMax) : 1.0,
                    turnPolicy: options ? options.turnPolicy : potrace.TurnPolicy.MINORITY,
                    color: layer.hex
                };

                potrace.trace(monoBuffer, potraceOptions, function(err, svgString) {
                    if (err || !svgString) {
                        resolve(null);
                        return;
                    }
                    
                    // استخراج كود الـ Path النظيف من ملف الـ SVG الأحادي المولد
                    const pathMatches = svgString.match(/<path[^>]*>/g);
                    if (pathMatches) {
                        resolve({
                            hex: layer.hex,
                            paths: pathMatches.join('\n')
                        });
                    } else {
                        resolve(null);
                    }
                });
            });
        });

        const tracedLayers = await Promise.all(tracingPromises);

        // 3. دمج الطبقات اللونية بالترتيب الهندسي الصحيح في مستند SVG واحد نقي تماماً ومبسط
        let finalPaths = '';
        tracedLayers.forEach(layer => {
            if (layer) {
                finalPaths += `<!-- Layer Color: ${layer.hex} -->\n${layer.paths}\n`;
            }
        });

        const cleanSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%">
  <g id="sadu-vector-pipeline" shape-rendering="geometricPrecision">
    ${finalPaths}
  </g>
</svg>`;

        console.log("✅ [Vectorizer Pipeline] High-Fidelity multi-layer SVG compiled successfully.");
        res.setHeader('Content-Type', 'image/svg+xml');
        res.send(cleanSvg);

    } catch (err) {
        console.error("❌ [Pipeline Error]:", err.message);
        res.status(500).json({ error: `فشل تتبع وتحويل الطبقات: ${err.message}` });
    }
});

// ممر الرسام الإمبراطوري القديم والمعدل
app.post('/api/generate-image', async (req, res) => {
    try {
        const { prompt } = req.body;
        const key = process.env.GEMINI_API_KEY;
        if (!key) return res.status(401).json({ error: "API Key مفقود في السيرفر." });

        const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${key}`;
        const payload = {
            instances: [{ prompt }],
            parameters: { sampleCount: 1, outputMimeType: "image/jpeg", aspectRatio: "1:1", imageSize: "1K" }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        const base64Image = result.predictions?.[0]?.bytesBase64Encoded;
        if (!base64Image) throw new Error("لم ترجع خوادم قوقل أي صورة.");

        res.json({ success: true, imageUrl: `data:image/jpeg;base64,${base64Image}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 [SERVER STARTED] Secure Vector Pipeline is active on port ${PORT}`);
});
