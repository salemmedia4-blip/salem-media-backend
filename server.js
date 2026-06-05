// 🛠️ الحل السحري والنهائي لمشكلة (ENOTFOUND) في خوادم Render!
// هذا السطر يجبر السيرفر يستخدم شبكة IPv4 المستقرة للاتصال بـ HuggingFace
require('dns').setDefaultResultOrder('ipv4first');

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

// إعدادات الـ CORS لضمان استقبال الطلبات من تطبيقك
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));

// نظام التتبع لطباعة الطلبات في الـ Logs
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] 🚀 طلب مستلم: ${req.method} ${req.url}`);
    next();
});

// المفاتيح
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

app.get('/', (req, res) => {
    res.status(200).send('✅ سيرفر سالم ميديا يعمل بامتياز. تم حل مشكلة الـ DNS وتحديث Gemini!');
});

// ==========================================
// 📝 1. أدوات النصوص (Gemini 1.5 Flash)
// ==========================================
app.post('/api/generate', async (req, res) => {
    try {
        if (!GEMINI_API_KEY) {
            throw new Error("مفتاح GEMINI مفقود في إعدادات Render.");
        }

        // تم تحديث الموديل للنسخة المستقرة والرسمية
        const model = "gemini-1.5-flash";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error("❌ [Gemini API Error]:", data);
            throw new Error(data.error?.message || "حدث خطأ من سيرفرات جوجل.");
        }

        console.log("✅ تم توليد النص بنجاح!");
        res.json(data);
    } catch (error) {
        console.error("❌ [Text Gen Error]:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 🎨 2. أداة توليد الصور (Hugging Face FLUX)
// ==========================================
app.post('/api/generate-image', async (req, res) => {
    try {
        if (!HUGGINGFACE_API_KEY) {
            throw new Error("مفتاح HUGGINGFACE مفقود في إعدادات Render.");
        }

        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: "يرجى كتابة موجه إعلاني." });
        }

        console.log(`🎨 جاري رسم: "${prompt}"...`);

        const MODEL_ID = "black-forest-labs/FLUX.1-schnell";
        const url = `https://api-inference.huggingface.co/models/${MODEL_ID}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ inputs: prompt })
        });

        if (!response.ok) {
            if (response.status === 503) {
                throw new Error("محرك الرسم قيد التحميل الآن للتشغيل المجاني، يرجى المحاولة بعد 20 ثانية.");
            }
            const errText = await response.text();
            throw new Error(`خطأ من HuggingFace: ${errText}`);
        }

        // تحويل الصورة المستلمة إلى Base64
        const arrayBuffer = await response.arrayBuffer();
        const base64Image = Buffer.from(arrayBuffer).toString('base64');
        
        console.log("✅ تم رسم الصورة بنجاح عبر FLUX!");
        
        res.json({ 
            success: true,
            imageUrl: `data:image/jpeg;base64,${base64Image}`
        });

    } catch (error) {
        console.error("❌ [Image Gen Error]:", error.message);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`✅ [SERVER LIVE] السيرفر شغال وجاهز على منفذ ${PORT}`);
});
