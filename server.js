const express = require('express');
const cors = require('cors');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = process.env.PORT || 3000;

// تفعيل سياسة الـ CORS لضمان اتصال تطبيقك بالسيرفر بدون أي قيود
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'OPTIONS'],
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
    let { prompt, contents, model, systemInstruction } = req.body;

    // استخراج النص بذكاء سواء تم إرساله كـ prompt مباشر أو داخل مصفوفة contents
    let promptText = prompt;
    if (!promptText && contents && Array.isArray(contents)) {
        try {
            promptText = contents[0].parts[0].text;
        } catch (e) {
            console.error("خطأ في تحليل مصفوفة contents:", e);
        }
    }

    if (!promptText && !contents) {
        return res.status(400).json({ error: "الرجاء إدخال النص المطلوب (Prompt)" });
    }

    if (!ai) {
        return res.status(500).json({ error: "مفتاح الـ API غير مهيأ في السيرفر السحابي رندر. يرجى إضافته في إعدادات البيئة لـ Render باسم GEMINI_API_KEY." });
    }

    // مصفوفة الموديلات البديلة بالترتيب في حال حدوث ضغط عالي أو مشاكل مؤقتة
    const fallbackModels = [
        model || 'gemini-2.5-flash',
        'gemini-1.5-flash'
    ];

    const uniqueModels = [...new Set(fallbackModels)];
    let lastError = null;
    let success = false;
    let generatedResponseText = "";

    // استخراج وتأمين نظام التعليمات البرمجية الموجهة (System Instruction)
    let systemInstructionText = "";
    if (systemInstruction) {
        if (typeof systemInstruction === 'string') {
            systemInstructionText = systemInstruction;
        } else if (systemInstruction.parts && Array.isArray(systemInstruction.parts)) {
            systemInstructionText = systemInstruction.parts[0]?.text || "";
        } else if (systemInstruction.text) {
            systemInstructionText = systemInstruction.text;
        }
    }

    for (const targetModel of uniqueModels) {
        try {
            console.log(`📡 جاري محاولة الاتصال بموديل: ${targetModel}`);
            
            const response = await ai.models.generateContent({
                model: targetModel,
                contents: contents || promptText,
                config: {
                    systemInstruction: systemInstructionText || undefined
                }
            });

            console.log(`✅ تم التوليد بنجاح باستخدام الموديل: ${targetModel}`);
            generatedResponseText = response.text;
            success = true;
            break; // الخروج من التكرار عند نجاح الطلب

        } catch (error) {
            console.warn(`⚠️ فشل الموديل ${targetModel}. التفاصيل:`, error.message || error);
            lastError = error;
            
            // تحقق ما إذا كان الخطأ هو ضغط عالي لتجربة البديل
            const errorStr = JSON.stringify(error) || "";
            const isTemporary = errorStr.includes("503") || 
                                errorStr.includes("UNAVAILABLE") || 
                                errorStr.includes("429") || 
                                errorStr.includes("quota") || 
                                errorStr.includes("Resource has been exhausted");

            if (isTemporary) {
                console.log("🔄 خطأ مؤقت أو متعلق بالحصص، جاري محاولة الانتقال للموديل المستقر التالي...");
                continue;
            } else {
                // خطأ أمني أو برمجي حقيقي، توقف فوراً وأظهره للمستخدم لحله
                break;
            }
        }
    }

    if (success) {
        return res.json({ text: generatedResponseText });
    }

    // في حال الفشل النهائي، نقوم بإرجاع الخطأ الحقيقي الوارد من غوغل دون تعتيم
    console.error("❌ فشلت كافة الموديلات في تلبية الطلب. الخطأ الفعلي:", lastError);
    
    let detailedErrorMessage = lastError?.message || lastError?.toString() || "فشل الاتصال بخدمات Google AI Studio.";
    
    // توضيح للمستخدم في حال كانت المشكلة متعلقة بحدود الاستخدام أو الدفع
    if (detailedErrorMessage.includes("API key not valid") || detailedErrorMessage.includes("API_KEY_INVALID")) {
        detailedErrorMessage = "مفتاح الـ API السحابي غير صالح أو تم إيقافه من شركة Google. يرجى تفعيل مفتاح جديد.";
    } else if (detailedErrorMessage.includes("Resource has been exhausted") || detailedErrorMessage.includes("Quota exceeded")) {
        detailedErrorMessage = "تم تجاوز حد الاستخدام المجاني المسموح به لليوم. يرجى تفعيل الفوترة لرفع الحظر أو المحاولة لاحقاً.";
    }

    res.status(500).json({ error: detailedErrorMessage });
});

// 2. منفذ الوسيط الآمن (Secure Proxy) لتوليد الصور والمميزات المتقدمة
app.post('/api/secure-proxy', async (req, res) => {
    const { endpoint, payload, method = 'POST' } = req.body;

    if (!endpoint) {
        return res.status(400).json({ error: "الرجاء تحديد رابط الوصول النهائي (Endpoint)" });
    }

    if (!apiKey) {
        return res.status(500).json({ error: "مفتاح الـ API الخاص بالسيرفر غير مفعّل. يرجى تهيئته في Render." });
    }

    try {
        console.log(`🔗 جاري إعادة توجيه الطلب الآمن إلى: ${endpoint}`);
        
        // إلحاق المفتاح السحابي بشكل مخفي تماماً عن واجهة المستخدم
        const targetUrl = `${endpoint}?key=${apiKey}`;

        const response = await fetch(targetUrl, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: payload ? JSON.stringify(payload) : undefined
        });

        // قراءة آمنة للاستجابة لتجنب الانهيار البرمجي
        const contentType = response.headers.get("content-type");
        let data;
        if (contentType && contentType.includes("application/json")) {
            data = await response.json();
        } else {
            const text = await response.text();
            data = { error: text || "استجابة غير معرّفة أو فارغة من الخادم الخارجي." };
        }
        
        if (!response.ok) {
            let errorMsg = "خطأ أثناء الاتصال بالخادم الخارجي للصور.";
            if (data && data.error) {
                if (typeof data.error === 'string') {
                    errorMsg = data.error;
                } else if (data.error.message) {
                    errorMsg = data.error.message;
                }
            }
            return res.status(response.status).json({ error: errorMsg });
        }

        res.json(data);
    } catch (error) {
        console.error("❌ خطأ في منفذ الوسيط الآمن:", error);
        res.status(500).json({ error: `فشل توجيه ومعالجة الطلب الآمن. التفاصيل: ${error.message}` });
    }
});

// تشغيل السيرفر والاستماع للطلبات الواردة
app.listen(PORT, () => {
    console.log(`🚀 السيرفر يعمل بنجاح وكفاءة على المنفذ: ${PORT}`);
});
