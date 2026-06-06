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
// 🎨 2. ممر الصور الذكي والمزدوج (Google Imagen + Auto Flux Fallback)
// ==========================================
app.post('/api/generate-image', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "يرجى إرسال الفكرة التسويقية." });

    try {
        if (!GEMINI_API_KEY) throw new Error("مفتاح GEMINI_API_KEY مفقود.");

        console.log(`🎨 جاري محاولة الرسم عبر Google Imagen للموجه: "${prompt}"`);

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

        // فحص الأخطاء الأمنية أو أخطاء تفعيل الفوترة لترقية الحساب
        if (!response.ok || (data.error && data.error.message)) {
            const errMsg = data.error?.message || "";
            if (errMsg.includes("paid plans") || errMsg.includes("billing") || response.status === 403) {
                console.warn("⚠️ تم اكتشاف حساب مجاني من جوجل. جاري تفعيل الممر الرديف المجاني عالي الدقة فوراً...");
                return await triggerFreeFallback(prompt, res);
            }
            throw new Error(errMsg || "فشل توليد الصورة من خوادم جوجل.");
        }

        const base64Image = data.predictions?.[0]?.bytesBase64Encoded;
        if (!base64Image) {
            throw new Error("جوجل أرجعت استجابة فارغة، جاري التحويل للمحرك البديل.");
        }

        console.log("✅ تم رسم الصورة بنجاح وتأمينها عبر Google Imagen.");
        res.json({
            success: true,
            imageUrl: `data:image/jpeg;base64,${base64Image}`,
            fallbackUsed: false
        });

    } catch (error) {
        console.warn(`⚠️ تعذر الرسم عبر جوجل بسبب: (${error.message}). جاري التوليد بالمحرك الرديف الآمن والمجاني...`);
        await triggerFreeFallback(prompt, res);
    }
});

async function triggerFreeFallback(prompt, res) {
    try {
        // تنظيف وتجهيز موجه النص
        const safePrompt = encodeURIComponent(prompt);
        // استخدام محرك Flux القوي والخالي من أخطاء الأمان أو الفوترة
        const fallbackUrl = `https://image.pollinations.ai/prompt/${safePrompt}?width=1024&height=1024&nologo=true&private=true&enhance=true&model=flux`;
        
        console.log(`📡 جاري جلب الصورة وتشفيرها سحابياً من المحرك البديل...`);
        const imageResponse = await fetch(fallbackUrl);
        if (!imageResponse.ok) throw new Error("فشلت عملية الرسم من المحرك البديل أيضاً.");
        
        const buffer = await imageResponse.arrayBuffer();
        const base64Image = Buffer.from(buffer).toString('base64');
        
        console.log("✅ تم تجهيز الصورة من المحرك الرديف وإرسالها بأمان كـ Base64.");
        res.json({
            success: true,
            imageUrl: `data:image/jpeg;base64,${base64Image}`,
            fallbackUsed: true,
            message: "تم التوليد التلقائي عبر محرك الرسم السريع والمجاني نظراً لعدم تفعيل الفوترة بحساب جوجل."
        });
    } catch (err) {
        console.error("❌ فشل التوليد بكلا المحركين:", err.message);
        res.status(500).json({ error: "عذراً، تعذر رسم الصورة حالياً: " + err.message });
    }
}

app.listen(PORT, () => {
    console.log(`✅ [SERVER LIVE] السيرفر النظيف والرسمي يعمل الآن على منفذ ${PORT}`);
});
