// تثبيت المكتبات الأساسية
const express = require('express');
const cors = require('cors');
require('dotenv').config();

// استخدام مكتبة غوغل الرسمية للذكاء الاصطناعي
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = process.env.PORT || 3000;

// تفعيل بروتوكول الـ CORS للسماح بتطبيق الويب بالتواصل مع السيرفر
app.use(cors());
app.use(express.json());

// قراءة مفتاح الـ API من ملف البيئة الآمن .env
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("❌ خطأ جوهري: لم يتم العثور على مفتاح GEMINI_API_KEY في ملف الـ .env!");
    process.exit(1);
}

// تهيئة مكتبة غوغل للذكاء الاصطناعي بالمفتاح الآمن
const ai = new GoogleGenAI({ apiKey: apiKey });

// 🛣️ المسار الأساسي لاستقبال طلبات الذكاء الاصطناعي النصية
app.post('/api/generate', async (req, res) => {
    try {
        const { contents, systemInstruction } = req.body;

        if (!contents || !contents[0] || !contents[0].parts || !contents[0].parts[0].text) {
            return res.status(400).json({ error: "الطلب غير مكتمل أو النص فارغ!" });
        }

        const promptText = contents[0].parts[0].text;
        const systemPrompt = systemInstruction?.parts?.[0]?.text || "أنت خبير تسويق رقمي وصناعة محتوى محترف لوكالة سالم ميديا.";

        // استدعاء موديل gemini-1.5-flash رسمياً وبثبات
        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: promptText,
            config: {
                systemInstruction: systemPrompt
            }
        });

        // إرجاع النتيجة لتطبيق الويب بنفس البنية المتوقعة
        res.json({
            candidates: [
                {
                    content: {
                        parts: [
                            { text: response.text }
                        ]
                    }
                }
            ]
        });

    } catch (error) {
        console.error("💥 حدث خطأ في السيرفر أثناء توليد المحتوى:", error);
        res.status(500).json({ error: "فشل السيرفر في معالجة طلب الذكاء الاصطناعي" });
    }
});

// تشغيل السيرفر على المنفذ المحدد
app.listen(PORT, () => {
    console.log(`🚀 السيرفر الآمن يعمل بنجاح على المنفذ ${PORT}`);
});