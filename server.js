const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

// إعدادات الـ CORS والـ Body Parser لتمرير واستقبال الصور الكبيرة بـ Base64
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));

// جلب مفتاح الـ API الخاص بك من بيئة Render
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// صفحة تأكيدية لفحص السيرفر
app.get('/', (req, res) => {
    res.status(200).send('🚀 سيرفر سالم ميديا السحابي المطور يعمل بكفاءة واستقرار تام، ومرتبط مباشرة بـ Google Imagen 4.0!');
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

// 2. ممر توليد الصور الفوري والمباشر والحصري عبر Google Imagen 4.0
app.post('/api/generate-image', async (req, res) => {
    try {
        const apiKey = GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: "مفتاح الـ API (GEMINI_API_KEY) غير معرف في لوحة تحكم Render الخاصة بك." });
        }

        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: "يرجى كتابة فكرة أو موجه إعلاني للرسم." });
        }

        // المسار الدقيق والرسمي لاستدعاء Imagen 4.0 في بيئة Google AI Studio
        const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`;

        // صياغة البيانات المطلوبة وفقاً لهيكل معالجة الصور الرسمي لجوجل
        const payload = {
            instances: {
                prompt: prompt
            },
            parameters: {
                sampleCount: 1
            }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        // إدارة الأخطاء ومعالجتها بذكاء لتفادي تعليق المنصة
        if (response.status === 429) {
            return res.status(429).json({ error: "لقد وصلت للحد الأقصى المسموح به من الطلبات المجانية اليومية (Rate Limit) لموديل Imagen، يرجى المحاولة لاحقاً أو ترقية الباقة." });
        }

        const data = await response.json();

        if (!response.ok) {
            console.error("[Imagen API Error Response]:", data);
            const errMsg = data.error?.message || "فشلت عملية توليد الصور من خوادم جوجل.";
            
            if (errMsg.includes("billing") || errMsg.includes("paid plans") || errMsg.includes("quota")) {
                return res.status(403).json({ error: "توليد الصور بـ Imagen 4 يتطلب تفعيل الفوترة (Paid Tier) في مشروعك على Google Cloud. يرجى تفعيل الدفع أو استخدام مفتاح API مفعّل به خيار الفوترة." });
            }
            return res.status(response.status).json({ error: errMsg });
        }

        // استخراج الصورة الخام المشفرة بـ Base64 النظيفة والكاملة من رد السيرفر
        const base64Image = data.predictions?.[0]?.bytesBase64Encoded;
        if (!base64Image) {
            return res.status(500).json({ error: "استجابة Imagen لا تحتوي على بيانات تصميم صالحة." });
        }

        // إرجاع الصورة بترميز Base64 آمن وصالح للعرض والتحميل الفوري
        res.json({ 
            success: true,
            imageBase64: base64Image,
            imageUrl: `data:image/png;base64,${base64Image}`
        });

    } catch (error) {
        console.error("[Imagen Endpoint Server Error]:", error);
        res.status(500).json({ error: `خطأ اتصال داخلي بالسيرفر السحابي: ${error.message}` });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Sercure Proxy Server is actively running on port ${PORT}`);
});
