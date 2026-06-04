const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

// 1. إعدادات الـ CORS والـ Parser لدعم الاتصال من أي مكان واستقبال الملفات الكبيرة
app.use(cors({
    origin: '*', // يسمح لجوالك ولأي متصفح بالاتصال بالسيرفر مباشرة
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' })); // لدعم البيانات والصور الكبيرة

// جلب مفتاح الـ API الخاص بك المخزن بشكل آمن في بيئة Render
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// 2. صفحة ترحيبية للتأكد من عمل السيرفر عند الدخول عليه بالمتصفح
app.get('/', (req, res) => {
    res.status(200).send('🚀 سيرفر سالم ميديا السحابي يعمل بكفاءة واستقرار تام لعام 2026!');
});

// 3. ممر التوليد النصي الآمن لـ Gemini (لأدوات التسويق والعصف الذهني)
app.post('/api/generate', async (req, res) => {
    try {
        const apiKey = GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: "مفتاح الـ API غير معرّف في لوحة تحكم رندر (GEMINI_API_KEY)." });
        }

        const model = req.query.model || "gemini-2.5-flash-preview-09-2025";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });

        const data = await response.json();
        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        res.json(data);
    } catch (error) {
        console.error("[Text Gen Error]:", error);
        res.status(500).json({ error: error.message });
    }
});

// 4. ممر توليد الصور المباشر والآمن لـ Imagen 3.0 (يستقبل فكرتك ويرجع لك كود الصورة Base64 مباشرة)
app.post('/api/generate-image', async (req, res) => {
    try {
        const apiKey = GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: "مفتاح الـ API غير معرّف في لوحة تحكم رندر (GEMINI_API_KEY)." });
        }

        const { prompt, model } = req.body;
        const activeModel = model || "imagen-3.0-generate-001";
        
        // المسار الرسمي والآمن لطلب الصورة
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:predict?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                instances: [
                    { prompt: prompt }
                ],
                parameters: {
                    sampleCount: 1
                }
            })
        });

        const data = await response.json();
        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        // استخراج كود الصورة الـ Base64 من استجابة جوجل الرسمية
        const base64Image = data.predictions?.[0]?.bytesBase64Encoded;
        if (!base64Image) {
            return res.status(500).json({ error: "رد خوادم غوغل لا يحتوي على بيانات صورة صالحة." });
        }

        // إرجاع الصورة للواجهة الأمامية لتعرضها فوراً
        res.json({ imageBase64: base64Image });

    } catch (error) {
        console.error("[Image Gen Error]:", error);
        res.status(500).json({ error: error.message });
    }
});

// تشغيل السيرفر والاستماع للمنفذ المحدد من رندر
app.listen(PORT, () => {
    console.log(`🚀 Secure Proxy Server is actively running on port ${PORT}`);
});
