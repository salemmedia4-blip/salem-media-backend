const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

// إعدادات الـ CORS والـ Body Parser
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));

// نظام التتبع النظيف لطلبات سالم ميديا
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] 🚀 طلب مستلم: ${req.method} ${req.url}`);
    next();
});

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.get('/', (req, res) => {
    res.status(200).send('✅ سيرفر سالم ميديا شغال بنسخته النظيفة والرسمية (Google Native Integration).');
});

// ==========================================
// 📝 1. ممر النصوص (Gemini Flash)
// ==========================================
app.post('/api/generate', async (req, res) => {
    try {
        if (!GEMINI_API_KEY) throw new Error("مفتاح GEMINI_API_KEY مفقود في خوادم Render.");

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
            throw new Error(data.error?.message || "خطأ من سيرفرات جوجل للنصوص.");
        }

        console.log("✅ تم توليد النصوص بنجاح.");
        res.json(data);
    } catch (error) {
        console.error("❌ [Text API Error]:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 🎨 2. ممر الصور (Hugging Face Inference API)
// ==========================================
app.post('/api/generate-image', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "يرجى إرسال الفكرة التسويقية." });

    // قراءة توكن Hugging Face من متغيرات البيئة في Render (دعم الاسمين لضمان الاستقرار التام)
    const HF_TOKEN = process.env.HUGGINGFACE_TOKEN || process.env.HF_TOKEN;
    if (!HF_TOKEN) {
        return res.status(500).json({ error: "مفتاح HUGGINGFACE_TOKEN مفقود في خوادم Render. يرجى إضافته من لوحة التحكم." });
    }

    try {
        console.log(`🎨 [Hugging Face] جاري تحضير طلب الرسم للموجه: "${prompt}"`);

        // استخدام الموديل الأسرع والأقوى FLUX.1-schnell
        const model = "black-forest-labs/FLUX.1-schnell";
        const hfUrl = `https://api-inference.huggingface.co/models/${model}`;

        const response = await fetch(hfUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HF_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ inputs: prompt })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("❌ [Hugging Face API Error]:", errText);
            throw new Error("Hugging Face استجابت بخطأ: " + (errText || response.statusText));
        }

        const arrayBuffer = await response.arrayBuffer();
        const base64Image = Buffer.from(arrayBuffer).toString('base64');

        console.log("✅ تم رسم الصورة بنجاح وتحويلها لـ Base64 لضمان الحفظ المباشر.");
        res.json({
            success: true,
            imageUrl: `data:image/jpeg;base64,${base64Image}`
        });

    } catch (error) {
        console.error("❌ [Hugging Face Image Error]:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 📡 3. فحص حالة الاتصال بـ Hugging Face
// ==========================================
app.get('/api/hf-status', async (req, res) => {
    const HF_TOKEN = process.env.HUGGINGFACE_TOKEN || process.env.HF_TOKEN;
    if (!HF_TOKEN) {
        return res.json({ status: "Error", message: "مفتاح HUGGINGFACE_TOKEN مفقود ❌" });
    }
    try {
        const response = await fetch("https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell", {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HF_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ inputs: "connection check" })
        });
        if (response.status === 401) {
            return res.json({ status: "Error", message: "توكن غير صالح ❌" });
        }
        res.json({ status: "Connected", message: "متصل وجاهز ✅" });
    } catch (e) {
        res.json({ status: "Error", message: "مشكلة بالاتصال بالخادم ❌" });
    }
});

app.listen(PORT, () => {
    console.log(`✅ [SERVER LIVE] السيرفر النظيف والرسمي يعمل الآن على منفذ ${PORT}`);
});
