const express = require('express');
const cors = require('cors');
const https = require('https');
const dns = require('dns');
require('dotenv').config();

// 1. فرض استخدام خوادم DNS العامة لحل مشكلة ENOTFOUND في منصة Render
try {
    if (typeof dns.setServers === 'function') {
        dns.setServers(['8.8.8.8', '1.1.1.1']);
        console.log("📡 [DNS Custom Config] Forced DNS lookup to use Google (8.8.8.8) and Cloudflare (1.1.1.1) successfully.");
    }
} catch (err) {
    console.warn("⚠️ [DNS Warning] Custom DNS override failed, using default system DNS:", err.message);
}

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));

// نظام مراقبة وتتبع الطلبات اللحظي
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] 🚀 طلب مستلم: ${req.method} ${req.url}`);
    next();
});

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const HUGGINGFACE_TOKEN = process.env.HUGGINGFACE_TOKEN || process.env.HF_TOKEN;

// طباعة آمنة للتوكن للتحقق من قراءته في السجلات كما طلب الكابتن سالم
if (HUGGINGFACE_TOKEN) {
    const safeToken = HUGGINGFACE_TOKEN.trim().substring(0, 8) + "..." + HUGGINGFACE_TOKEN.trim().substring(HUGGINGFACE_TOKEN.trim().length - 4);
    console.log(`✅ [Env Verification] HUGGINGFACE_TOKEN is loaded correctly (Value: ${safeToken})`);
} else {
    console.error("❌ [Env Warning] HUGGINGFACE_TOKEN is missing from your Render Environment Variables!");
}

app.get('/', (req, res) => {
    res.status(200).send('✅ سيرفر سالم ميديا نشط ويعمل مع نظام DNS المطور ومعالج Hugging Face SDK!');
});

// 📐 ممر تحويل الصور إلى فيكتور عالي الدقة (High Fidelity) عبر Vectorizer.ai API
app.post('/api/vectorize', async (req, res) => {
    try {
        const { image, apiKey } = req.body;
        const finalApiKey = apiKey || process.env.VECTORIZER_AI_API_KEY;

        if (!finalApiKey) {
            return res.status(401).json({ error: "مفتاح Vectorizer.ai API مفقود. يرجى إضافته في إعدادات التطبيق أو بيئة السيرفر السحابية." });
        }

        if (!image) {
            return res.status(400).json({ error: "يرجى تقديم أو رفع الصورة المطلوب تحويلها." });
        }

        console.log("📐 [Vectorizer API] Sending request to Vectorizer.ai...");
        
        // تحويل الـ base64 إلى Buffer نقي لمعالجته سحابياً
        const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, 'base64');

        // إنشاء FormData سحابي متوافق مع Node 18+
        const formData = new FormData();
        const blob = new Blob([buffer], { type: 'image/png' });
        formData.append('image', blob, 'image.png');

        // ترميز الـ API Key لتمريره في الـ Basic Auth
        const authHeader = 'Basic ' + Buffer.from(':' + finalApiKey).toString('base64');

        const response = await fetch('https://vectorizer.ai/api/v1/vectorize', {
            method: 'POST',
            headers: {
                'Authorization': authHeader
            },
            body: formData
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Vectorizer.ai API Error: ${response.status} - ${errText}`);
        }

        const svgString = await response.text();
        res.setHeader('Content-Type', 'image/svg+xml');
        res.send(svgString);

    } catch (error) {
        console.error("❌ [Vectorizer API Error]:", error.message);
        res.status(500).json({ error: `فشل التحويل السحابي: ${error.message}` });
    }
});

// دالة وكيل الاتصال (Custom DNS Agent) كخط دفاع نهائي ضد الـ ENOTFOUND
const customDnsAgent = new https.Agent({
    lookup: (hostname, options, callback) => {
        const resolver = new dns.Resolver();
        resolver.setServers(['8.8.8.8', '1.1.1.1']);
        resolver.resolve4(hostname, (err, addresses) => {
            if (err || !addresses || addresses.length === 0) {
                return dns.lookup(hostname, options, callback);
            }
            callback(null, addresses[0], 4);
        });
    },
    keepAlive: true
});

// دالة الإرسال لـ Hugging Face مع Retry Logic
async function fetchImageFromHuggingFaceWithRetry(prompt, retries = 3, delay = 1000) {
    const MODEL_ID = "black-forest-labs/FLUX.1-schnell";
    const url = `https://api-inference.huggingface.co/models/${MODEL_ID}`;

    for (let i = 1; i <= retries; i++) {
        try {
            console.log(`🎨 [Attempt ${i}/${retries}] Requesting image for: "${prompt}"`);
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${HUGGINGFACE_TOKEN.trim()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ inputs: prompt }),
                agent: customDnsAgent // استخدام عميل الاتصال المؤمن بالـ DNS
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`HF_API_ERROR: ${response.status} - ${errText}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            return Buffer.from(arrayBuffer);

        } catch (error) {
            console.warn(`⚠️ [Attempt ${i} Failed]: ${error.message}`);
            if (i === retries) throw error;
            // تأخير تصاعدي (Exponential Backoff)
            await new Promise(resolve => setTimeout(resolve, delay * i));
        }
    }
}

app.post('/api/generate-image', async (req, res) => {
    try {
        if (!HUGGINGFACE_TOKEN) {
            return res.status(401).json({ error: "توكن HUGGINGFACE_TOKEN غير مضاف أو مفقود في Render." });
        }

        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: "يرجى كتابة فكرة أو موجه التصميم الإعلاني." });
        }

        // استدعاء دالة الرسم المؤمنة بالـ DNS والـ Retry
        const buffer = await fetchImageFromHuggingFaceWithRetry(prompt);
        const base64Image = buffer.toString('base64');

        console.log("✅ تم رسم الصورة وتأمينها بنجاح وتحويلها لـ Base64 لفك تشفيرها على جوال العميل.");
        res.json({
            success: true,
            imageUrl: `data:image/jpeg;base64,${base64Image}`
        });

    } catch (error) {
        console.error("❌ [Fatal Image Gen Error]:", error.message);
        res.status(500).json({ error: `فشل توليد الصورة السحابية: ${error.message}` });
    }
});

app.listen(PORT, () => {
    console.log(`✅ [SERVER STARTED] السيرفر الإمبراطوري يعمل بثبات وأمان سحابي على منفذ ${PORT}`);
});
