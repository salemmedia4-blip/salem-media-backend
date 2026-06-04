const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

// إعدادات الـ CORS والـ Parser لدعم الاتصال من أي جهاز واستقبال البيانات الكبيرة
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));

// جلب مفتاح الـ API الخاص بك من بيئة Render السحابية
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// صفحة ترحيبية للتأكد من عمل السيرفر
app.get('/', (req, res) => {
    res.status(200).send('🚀 سيرفر سالم ميديا السحابي المطور يعمل بكفاءة واستقرار تام لعام 2026!');
});

// 1. ممر التوليد النصي (Gemini 2.5 Flash للأدوات التسويقية والعصف الذهني)
app.post('/api/generate', async (req, res) => {
    try {
        const apiKey = GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: "مفتاح الـ API غير معرّف في لوحة تحكم رندر (GEMINI_API_KEY)." });
        }

        const model = "gemini-2.5-flash-preview-09-2025";
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

// 2. ممر توليد الصور الفوري (متوافق بالكامل وحصري لموديل Imagen 4.0 عبر predict)
app.post('/api/generate-image', async (req, res) => {
    try {
        const apiKey = GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: "مفتاح الـ API غير معرّف في رندر." });
        }

        const { prompt, aspectRatio } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: "الموجه الإعلاني (prompt) مطلوب للتوليد." });
        }

        // استخدام الـ Endpoint الصحيح والمخصص لـ Imagen 4.0 الحصري
        const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`;

        // صياغة الـ Payload الرسمية والمتوافقة لطلب توليد الصور من غوغل
        const payload = {
            instances: [
                { prompt: prompt }
            ],
            parameters: {
                sampleCount: 1,
                aspectRatio: aspectRatio || "1:1"
            }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!response.ok) {
            console.error("[Imagen API Error Response]:", data);
            return res.status(response.status).json({ error: data.error?.message || "فشلت عملية التوليد من جوجل." });
        }

        // استخراج كود الصورة الـ Base64 من توقعات الموديل الرسمية
        const base64Image = data.predictions?.[0]?.bytesBase64Encoded;
        if (!base64Image) {
            return res.status(500).json({ error: "استجابة Imagen لا تحتوي على بيانات صورة صالحة." });
        }

        // نرسل الصورة كبيانات كاملة جاهزة للعرض الفوري في تطبيقك
        res.json({ 
            success: true,
            imageUrl: `data:image/png;base64,${base64Image}`
        });

    } catch (error) {
        console.error("[Imagen Endpoint Error]:", error);
        res.status(500).json({ error: error.message });
    }
});

// تشغيل واستماع السيرفر للطلبات السحابية
app.listen(PORT, () => {
    console.log(`🚀 Secure Proxy Server is actively running on port ${PORT}`);
});
