const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// --- CLOUD CONFIGURATION ---
// Connection string updated with provided credentials
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://radona_admin:PVaDnglya3jKPibT@cluster0.radona.mongodb.net/radona_gallery?retryWrites=true&w=majority';
const EMAIL_USER = 'radona.gallery@gmail.com';
const EMAIL_PASS = 'cnwm jdho bvge dpez';
const REPORT_EMAIL = 'onyxsharmin@gmail.com';


// MongoDB Connection
mongoose.connect(MONGODB_URI)
    .then(() => console.log('Connected to Radona Cloud Database'))
    .catch(err => console.error('Database connection error:', err));

// User Schema (Replaces the Obsidian .md structure)
const userSchema = new mongoose.Schema({
    firstName: String,
    lastName: String,
    email: { type: String, unique: true, required: true },
    password: String,
    dob: String,
    joined: { type: Date, default: Date.now },
    status: { type: String, default: 'pending' },
    verificationCode: String,
    cart: { type: Array, default: [] }
});

const User = mongoose.model('User', userSchema);

// Email Configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: EMAIL_USER, pass: EMAIL_PASS }
});

app.use(cors());
app.use(bodyParser.json());

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// --- API ENDPOINTS ---

app.post('/signup', async (req, res) => {
    const { firstName, lastName, email, password, dob } = req.body;
    if (!firstName || !lastName || !email || !password || !dob) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const otp = generateOTP();
    try {
        const user = new User({
            firstName, lastName, email, password, dob,
            verificationCode: otp,
            status: 'pending'
        });
        await user.save();

        const mailOptions = {
            from: `"Radona Gallery" <${EMAIL_USER}>`,
            to: email,
            subject: 'Welcome to Radona Gallery',
            text: `Welcome to the circle, ${firstName}. Your verification code is: ${otp}`,
            html: `<div style="font-family: serif; text-align: center; padding: 20px; border: 1px solid #eee;">
                     <h1 style="color: #3e0703;">Radona Gallery</h1>
                     <p>Welcome to the circle, <strong>${firstName}</strong>.</p>
                     <p style="font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #8c1007;">${otp}</p>
                     <p>Please enter this code on our website to verify your identity.</p>
                   </div>`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) console.error('Email Error:', error);
        });

        res.json({ success: true, message: 'Account created! Please check your email for the verification code.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'User already exists or server error' });
    }
});

app.post('/verify', async (req, res) => {
    const { email, code } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        if (user.verificationCode === code) {
            user.status = 'active';
            user.verificationCode = undefined;
            await user.save();
            res.json({ success: true, message: 'Email verified successfully! You can now login.' });
        } else {
            res.status(401).json({ success: false, message: 'Invalid verification code' });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email, password });
        if (!user) return res.status(401).json({ success: false, message: 'Invalid email or password' });

        if (user.status !== 'active') {
            return res.status(403).json({ success: false, message: 'This account is not verified.' });
        }

        res.json({
            success: true,
            message: `Welcome back, ${user.firstName}!`,
            user: { firstName: user.firstName, email: user.email }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.get('/cart', async (req, res) => {
    const { email } = req.query;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        res.json({ success: true, cart: user.cart });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/cart', async (req, res) => {
    const { email, cart } = req.body;
    try {
        await User.findOneAndUpdate({ email }, { cart });
        res.json({ success: true, message: 'Cart saved successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/report-problem', async (req, res) => {
    const { email, message } = req.body;
    if (!email || !message || message.trim().length < 5) {
        return res.status(400).json({ success: false, message: 'Valid email and detailed message required' });
    }

    const mailOptions = {
        from: `"Radona Gallery Support" <${EMAIL_USER}>`,
        to: REPORT_EMAIL,
        subject: '⚠️ New Problem Report - Radona Gallery',
        text: `User Email: ${email}\n\nIssue Description:\n${message}`,
        html: `<div style="font-family: sans-serif; padding: 20px; border: 2px solid #8c1007; border-radius: 10px;">
                 <h2 style="color: #3e0703;">New Problem Reported</h2>
                 <p><strong>User:</strong> ${email}</p>
                 <hr style="border: 0; border-top: 1px solid #eee; margin: 15px 0;">
                 <p style="font-style: italic; color: #333;">"${message}"</p>
               </div>`
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) console.error('Report Email Error:', error);
    });

    res.json({ success: true, message: 'Your report has been sent to our curators.' });
});

app.listen(PORT, () => {
    console.log(`Radona Professional Server running on port ${PORT}`);
});
