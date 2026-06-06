// 🛠️ الحل السحري والنهائي لمشكلة (ENOTFOUND) وتجاوز خطأ الـ SSL Handshake Alert 40!
const express = require('express');
const cors = require('cors');
const https = require('https');
const dns = require('dns');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

// إعدادات الـ CORS والـ Body Parser لتأمين الاتصالات بسلاسة
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));

// نظام التتبع لطباعة الطلبات النصية الواردة في الـ Logs لمراقبة الجودة
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] 🚀 طلب مستلم: ${req.method} ${req.url}`);
    next();
});

// جلب مفاتيح الـ API من بيئة Render
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

// دالة حل العنوان عبر DNS-over-HTTPS (DoH) لحل مشكلة ENOTFOUND دون كسر الـ SSL
function resolveHuggingFaceIP() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: '1.1.1.1',
            port: 443,
            path: '/dns-query?name=api-inference.huggingface.co&type=A',
            method: 'GET',
            headers: {
                'accept': 'application/dns-json',
                'host': 'cloudflare-dns.com'
            },
            servername: 'cloudflare-dns.com',
            timeout: 5000
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const ipRecord = json.Answer?.find(r => r.type === 1);
                    if (ipRecord && ipRecord.data) {
                        resolve(ipRecord.data);
                    } else {
                        reject(new Error("No valid record in Cloudflare DoH"));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

app.get('/', (req, res) => {
    res.status(200).send('✅ سيرفر سالم ميديا النصي والصوري يعمل بكفاءة قصوى ومحصن ضد أخطاء التشفير والـ DNS!');
});

// ========================================================
// 📝 1. أدوات النصوص والذكاء الاصطناعي (Gemini 2.5 Flash المستقر)
// ========================================================
app.post('/api/generate', async (req, res) => {
    try {
        if (!GEMINI_API_KEY) {
            console.error("❌ مفتاح GEMINI_API_KEY غير موجود في إعدادات رندر!");
            return res.status(401).json({ error: "مفتاح جمناي غير معرّف في بيئة Render السحابية." });
        }

        const model = "gemini-2.5-flash";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error("❌ خطأ من سيرفرات جوجل جمناي:", data);
            return res.status(response.status).json({ error: data.error?.message || "فشلت عملية التوليد من جوجل." });
        }

        console.log("✅ تم توليد النص بنجاح وإرساله للواجهة.");
        res.json(data);

    } catch (error) {
        console.error("❌ [Text Gen Error]:", error);
        res.status(500).json({ error: `خطأ داخلي في السيرفر: ${error.message}` });
    }
});

// ========================================================
// 🎨 2. ممر توليد الصور الاحتياطي الفولاذي (Render Failover Proxy)
// ========================================================
app.post('/api/generate-image', async (req, res) => {
    try {
        if (!HUGGINGFACE_API_KEY) {
            console.error("❌ مفتاح HUGGINGFACE_API_KEY غير موجود في إعدادات رندر!");
            return res.status(401).json({ error: "مفتاح Hugging Face غير معرف بالسيرفر." });
        }

        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: "يرجى كتابة موجه للرسم." });
        }

        console.log(`🎨 [Proxy] جاري معالجة طلب رسم للموجه: "${prompt}"...`);

        const MODEL_ID = "black-forest-labs/FLUX.1-schnell";
        const payloadData = JSON.stringify({ inputs: prompt });

        // 🛠️ حقن الـ DNS Resolver المطور وتجنب خطأ المصافحة SSL Alert 40
        const options = {
            hostname: 'api-inference.huggingface.co', // اسم الخادم الأصلي (لضمان نجاح الـ SSL Handshake!)
            port: 443,
            path: `/models/${MODEL_ID}`,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payloadData)
            },
            lookup: (hostname, opts, callback) => {
                // حل العنوان بالآي بي وتوجيه التوصيل الشبكي فقط خلف الكواليس دون تخريب الـ SSL
                resolveHuggingFaceIP()
                    .then(ip => {
                        console.log(`[DNS Bypass] Resolved ${hostname} directly to IP ${ip}`);
                        callback(null, ip, 4);
                    })
                    .catch((err) => {
                        console.warn(`[DNS Bypass Fallback] Using standard dns lookup: ${err.message}`);
                        dns.lookup(hostname, opts, callback);
                    });
            },
            timeout: 60000
        };

        const hfRequest = https.request(options, (hfResponse) => {
            const chunks = [];
            hfResponse.on('data', (chunk) => chunks.push(chunk));
            hfResponse.on('end', () => {
                const buffer = Buffer.concat(chunks);
                const contentType = hfResponse.headers['content-type'] || 'image/jpeg';

                if (hfResponse.statusCode !== 200) {
                    const errorMsg = buffer.toString('utf8');
                    console.error("❌ خطأ من خوادم Hugging Face:", errorMsg);
                    return res.status(hfResponse.statusCode).json({ error: `فشل التوليد: ${errorMsg}` });
                }

                const base64Image = buffer.toString('base64');
                console.log("✅ تم رسم الصورة بنجاح وتجاوز جدار حماية رندر والـ SSL Handshake!");
                res.json({
                    success: true,
                    imageUrl: `data:${contentType};base64,${base64Image}`
                });
            });
        });

        hfRequest.on('error', (err) => {
            console.error("❌ [Proxy request error]:", err);
            res.status(500).json({ error: `خطأ اتصال بمحرك الرسم السحابي: ${err.message}` });
        });

        hfRequest.write(payloadData);
        hfRequest.end();

    } catch (error) {
        console.error("❌ [Image Gen Error]:", error);
        res.status(500).json({ error: `فشل الاتصال بخادم الرسم السحابي: ${error.message}` });
    }
});

app.listen(PORT, () => {
    console.log(`✅ [SERVER STARTED] السيرفر شغال بالوضع الآمن والمقاوم لظروف الـ DNS/SSL على منفذ ${PORT}`);
});
