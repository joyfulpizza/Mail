const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// 🔐 Environment variables (set these in Render)
const EMAIL = process.env.EMAIL;
const PASS = process.env.PASS;

// ⏱ cooldown (per IP)
const cooldowns = new Map();
const COOLDOWN_MS = 10 * 1000; // 10 seconds

function getIP(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: EMAIL,
    pass: PASS,
  },
});

app.get("/", (req, res) => {
  res.send("Email server running");
});

app.post("/send", async (req, res) => {
  const ip = getIP(req);
  const now = Date.now();

  // cooldown check
  if (cooldowns.has(ip) && now - cooldowns.get(ip) < COOLDOWN_MS) {
    const wait = Math.ceil((COOLDOWN_MS - (now - cooldowns.get(ip))) / 1000);
    return res.status(429).json({
      success: false,
      message: `잠시만 기다려주세요 (${wait}초 남음)`,
    });
  }

  const { name, title, message } = req.body || {};

  // basic validation
  if (!name || !title || !message) {
    return res.status(400).json({
      success: false,
      message: "모든 입력을 채워주세요",
    });
  }

  try {
    await transporter.sendMail({
      from: `"${name}" <${EMAIL}>`,
      to: EMAIL, // 🔁 change if needed
      subject: title,
      text: message,
    });

    cooldowns.set(ip, now);

    return res.json({
      success: true,
      message: "메일 전송 완료!",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "서버 오류",
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server started on ${PORT}`));
