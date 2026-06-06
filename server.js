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

// نظام التتبع النظيف
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] 🚀 طلب مستلم: ${req.method} ${req.url}`);
    next();
});

// مفتاح جوجل الوحيد الذي نحتاجه
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
// 🎨 2. ممر الصور (Google Imagen الرسمي)
// ==========================================
app.post('/api/generate-image', async (req, res) => {
    try {
        if (!GEMINI_API_KEY) throw new Error("مفتاح GEMINI_API_KEY مفقود في خوادم Render.");

        const { prompt } = req.body;
        if (!prompt) return res.status(400).json({ error: "يرجى إرسال الفكرة التسويقية." });

        console.log(`🎨 جاري تحضير طلب الرسم من Google Imagen للموجه: "${prompt}"`);

        // استخدام الـ API الرسمي والمباشر لموديلات توليد الصور من جوجل
        // ملاحظة: استخدمنا imagen-3.0 لأنه المستقر حالياً في API Studio، ويمكنك تغييره لـ 4.0 إذا كان مفعل بحسابك
        const model = "imagen-3.0-generate-001"; 
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${GEMINI_API_KEY}`;

        const payload = {
            instances: [ { prompt: prompt } ],
            parameters: { sampleCount: 1 }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("❌ [Imagen Error Details]:", data);
            // معالجة خطأ الفوترة بوضوح
            if (data.error && data.error.message && data.error.message.includes("billing")) {
                 throw new Error("موديل الصور من جوجل يطلب تفعيل الفوترة (Paid Tier) في حسابك.");
            }
            throw new Error(data.error?.message || "فشل توليد الصورة من خوادم جوجل.");
        }

        // استخراج الـ Base64 النظيف من رد جوجل
        const base64Image = data.predictions?.[0]?.bytesBase64Encoded;
        
        if (!base64Image) {
            throw new Error("جوجل أرجعت استجابة فارغة، لم يتم توليد صورة.");
        }

        console.log("✅ تم رسم الصورة بنجاح وتجهيزها بصيغة Base64 الآمنة.");
        
        // إرسال الصورة كـ Base64 للمتصفح لتجاوز كل قيود الأمان
        res.json({
            success: true,
            imageUrl: `data:image/jpeg;base64,${base64Image}`
        });

    } catch (error) {
        console.error("❌ [Image API Error]:", error.message);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`✅ [SERVER LIVE] السيرفر النظيف والرسمي يعمل الآن على منفذ ${PORT}`);
});
