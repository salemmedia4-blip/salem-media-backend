const express = require('express');
const cors = require('cors');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = process.env.PORT || 3000;

// تفعيل سياسة الـ CORS لضمان اتصال تطبيقك بالسيرفر بدون أي قيود
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// دعم قراءة ملفات JSON الكبيرة لرفع الصور والملفات بسهولة
app.use(express.json({ limit: '50mb' }));

// قراءة مفتاح الـ API الخاص بـ Gemini من بيئة العمل السحابية في Render
const apiKey = process.env.GEMINI_API_KEY || "";
let ai = null;

if (apiKey) {
    ai = new GoogleGenAI({ apiKey: apiKey });
    console.log("✅ تم ربط السيرفر بنجاح بمفتاح Gemini السحابي.");
} else {
    console.warn("⚠️ تنبيه: لم يتم العثور على المفتاح GEMINI_API_KEY في إعدادات Render.");
}

// 1. منفذ توليد النصوص الأساسي (Gemini Text Generation)
app.post('/api/generate', async (req, res) => {
    let { prompt, contents, model } = req.body;

    // استخراج النص بذكاء سواء تم إرساله كـ prompt مباشر أو داخل مصفوفة contents
    let promptText = prompt;
    if (!promptText && contents && Array.isArray(contents)) {
        try {
            promptText = contents[0].parts[0].text;
        } catch (e) {
            console.error("خطأ في تحليل مصفوفة contents:", e);
        }
    }

    if (!promptText) {
        return res.status(400).json({ error: "الرجاء إدخال النص المطلوب (Prompt)" });
    }

    if (!ai) {
        return res.status(500).json({ error: "مفتاح الـ API غير مهيأ في السيرفر السحابي رندر." });
    }

    // مصفوفة الموديلات البديلة بالترتيب في حال حدوث ضغط عالي (خطأ 503)
    const fallbackModels = [
        model || 'gemini-2.5-flash',
        'gemini-2.5-flash-preview-09-2025',
        'gemini-1.5-flash'
    ];

    // إزالة التكرار لضمان كفاءة الفحص
    const uniqueModels = [...new Set(fallbackModels)];
    let lastError = null;

    // محاولة إرسال الطلب للموديلات المتوفرة بالتدريج عند الفشل
    for (const targetModel of uniqueModels) {
        try {
            console.log(`📡 جاري محاولة الاتصال بموديل: ${targetModel}`);
            const response = await ai.models.generateContent({
                model: targetModel,
                contents: promptText,
            });

            // إذا نجح الطلب، نقوم بإرجاعه فوراً وإيقاف المحاولات الأخرى
            console.log(`✅ تم التوليد بنجاح باستخدام الموديل: ${targetModel}`);
            return res.json({ text: response.text });

        } catch (error) {
            console.warn(`⚠️ الموديل ${targetModel} غير متوفر حالياً بسبب الضغط العالي. جاري الانتقال للبديل...`);
            lastError = error;
            
            // التحقق من طبيعة الخطأ (هل هو 503 أو ضغط عالي؟) للمتابعة
            const errorStr = JSON.stringify(error);
            const isTemporaryError = errorStr.includes("503") || 
                                     errorStr.includes("UNAVAILABLE") || 
                                     errorStr.includes("temporary") || 
                                     errorStr.includes("429") ||
                                     errorStr.includes("high demand");

            if (isTemporaryError) {
                continue; // الانتقال للموديل التالي في المصفوفة فوراً
            } else {
                break; // إذا كان خطأ برمجي آخر، أوقف المحاولات واعرضه للمستخدم
            }
        }
    }

    // إذا فشلت كافة الموديلات البديلة
    console.error("❌ فشلت كافة الموديلات البديلة في تلبية الطلب:", lastError);
    res.status(503).json({ 
        error: "جميع موديلات الخدمة تشهد ضغطاً عالياً مؤقتاً في خوادم Google. يرجى إعادة المحاولة بعد ثوانٍ قليلة." 
    });
});

// 2. منفذ الوسيط الآمن (Secure Proxy) لتوليد الصور والمميزات المتقدمة
app.post('/api/secure-proxy', async (req, res) => {
    const { endpoint, payload, method = 'POST' } = req.body;

    if (!endpoint) {
        return res.status(400).json({ error: "الرجاء تحديد رابط الوصول النهائي (Endpoint)" });
    }

    if (!apiKey) {
        return res.status(500).json({ error: "مفتاح الـ API الخاص بالسيرفر غير مفعّل." });
    }

    try {
        console.log(`🔗 جاري إعادة توجيه الطلب الآمن إلى: ${endpoint}`);
        const targetUrl = `${endpoint}?key=${apiKey}`;

        const response = await fetch(targetUrl, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: payload ? JSON.stringify(payload) : undefined
        });

        const data = await response.json();
        
        if (!response.ok) {
            return res.status(response.status).json({ error: data.error || "خطأ أثناء الاتصال بالخادم الخارجي." });
        }

        res.json(data);
    } catch (error) {
        console.error("❌ خطأ في منفذ الوسيط الآمن:", error);
        res.status(500).json({ error: "فشل توجيه ومعالجة الطلب الآمن." });
    }
});

// تشغيل السيرفر والاستماع للطلبات الواردة
app.listen(PORT, () => {
    console.log(`🚀 السيرفر المحدث والآمن يعمل بكفاءة على المنفذ: ${PORT}`);
});
