const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

// تفعيل إعدادات CORS الشاملة لمنع أي حظر من المتصفحات أو المحاكيات
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));

// نظام التتبع والمراقبة اللحظية للطلبات
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] 🚀 طلب مستلم: ${req.method} ${req.url}`);
    next();
});

// جلب المفاتيح من بيئة Render بأي تسمية كتبتها (مرونة كاملة لمنع الأخطاء)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const HUGGINGFACE_TOKEN = process.env.HUGGINGFACE_TOKEN || process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN || process.env.HF_API_KEY;

// الصفحة الرئيسية للتأكد من عمل السيرفر
app.get('/', (req, res) => {
    res.status(200).send('✅ سيرفر سالم ميديا نشط وجاهز للعمل مع كامل الأدوات!');
});

// ========================================================
// 📡 ممر فحص حالة ربط توكن Hugging Face للوحة التحكم
// ========================================================
app.get('/api/hf-status', (req, res) => {
    if (HUGGINGFACE_TOKEN && HUGGINGFACE_TOKEN.trim().startsWith('hf_')) {
        console.log("✅ [Status Check] Hugging Face Token is valid and detected.");
        res.json({ status: "Connected", message: "متصل ومفعل ✅" });
    } else {
        console.warn("⚠️ [Status Check] Hugging Face Token is missing or invalid.");
        res.json({ status: "Disconnected", message: "توكن مفقود أو غير صالح ❌" });
    }
});

// ========================================================
// 📝 1. ممر معالجة النصوص وعصف الأفكار (Gemini 2.5 Flash)
// ========================================================
app.post('/api/generate', async (req, res) => {
    try {
        if (!GEMINI_API_KEY) {
            return res.status(401).json({ error: "مفتاح GEMINI_API_KEY مفقود في إعدادات Render السحابية." });
        }

        const model = "gemini-2.5-flash";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error("❌ [Gemini Error]:", data);
            return res.status(response.status).json({ error: data.error?.message || "فشلت عملية التوليد من جوجل." });
        }

        console.log("✅ تم توليد النص وإرساله للواجهة بنجاح.");
        res.json(data);

    } catch (error) {
        console.error("❌ [Text Gen Error]:", error);
        res.status(500).json({ error: `خطأ داخلي في السيرفر: ${error.message}` });
    }
});

// ========================================================
// 🎨 2. ممر توليد الصور الاحترافي (Hugging Face - FLUX)
// ========================================================
app.post('/api/generate-image', async (req, res) => {
    try {
        if (!HUGGINGFACE_TOKEN) {
            return res.status(401).json({ error: "مفتاح HUGGINGFACE_TOKEN مفقود في إعدادات Render." });
        }

        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: "يرجى كتابة فكرة التصميم." });
        }

        console.log(`🎨 جاري الرسم للموجه: "${prompt}" باستخدام FLUX.1-schnell...`);

        const MODEL_ID = "black-forest-labs/FLUX.1-schnell";
        const url = `https://api-inference.huggingface.co/models/${MODEL_ID}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HUGGINGFACE_TOKEN.trim()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ inputs: prompt })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("❌ [Hugging Face Error]:", errText);
            return res.status(response.status).json({ error: `فشل التوليد: ${errText}` });
        }

        const arrayBuffer = await response.arrayBuffer();
        const base64Image = Buffer.from(arrayBuffer).toString('base64');
        const contentType = response.headers.get('content-type') || 'image/jpeg';

        console.log("✅ تم رسم الصورة بنجاح وتحويلها لـ Base64.");
        res.json({
            success: true,
            imageUrl: `data:${contentType};base64,${base64Image}`
        });

    } catch (error) {
        console.error("❌ [Image Gen Error]:", error);
        res.status(500).json({ error: `فشل السيرفر في توليد الصورة: ${error.message}` });
    }
});

app.listen(PORT, () => {
    console.log(`✅ [SERVER STARTED] السيرفر شغال بالكامل ومستعد لخدمة سالم ميديا على منفذ ${PORT}`);
});
