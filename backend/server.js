// ==========================================
// 1. IMPORTS & INITIALIZATION
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
require('dotenv').config();

const User = require('./models/User');
const app = express();

// ==========================================
// 2. GLOBAL APPLICABLE MIDDLEWARE
app.use(cors({
    origin: 'http://localhost:3000', 
    credentials: true, // Allows cookies to be sent back and forth
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

// Middleware to catch validation results and reject bad inputs
const validateInputs = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        // Return the very first error message encountered to keep it clean for the user
        return res.status(400).json({ message: errors.array()[0].msg });
    }
    next();
};

// DEFINE THE AUTHENTICATION RATE LIMITER RULE
const authLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes timeframe (in milliseconds)
    max: 5,                   // Limit each IP to 5 requests per windowMs
    message: { 
        message: "Too many attempts from this device. Please try again after 5 minutes." 
    },
    standardHeaders: true,    // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false,     // Disable the X-RateLimit-* headers
});
app.use(express.json());
app.use(cookieParser());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("Connected to MongoDB successfully"))
    .catch(err => console.error("Database connection failed:", err));

// ==========================================
// 3. PUBLIC ROUTES
// POST: http://localhost:8000/api/auth/register
//      1. SECURED REGISTER ROUTE
app.post('/api/auth/register', 
    authLimiter, 
    [
        body('email')
            .isEmail().withMessage('Please enter a valid email address.')
            .normalizeEmail(), // Sanitizer: Converts email to lowercase and trims spaces
        body('password')
            .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long.')
            .matches(/\d/).withMessage('Password must contain at least one number.')
            .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter.')
    ], 
    validateInputs, // Processes the rules above
    async (req, res) => {
        try {
            const { email, password } = req.body;
            
            let userExists = await User.findOne({ email });
            if (userExists) return res.status(400).json({ message: "User already exists" });

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            const newUser = new User({ email, password: hashedPassword });
            await newUser.save();

            res.status(201).json({ message: "User registered successfully!" });
        } catch (error) {
            res.status(500).json({ message: "Server error during registration" });
        }
    }
);

// POST: http://localhost:8000/api/auth/login
//      2. SECURED LOGIN ROUTE
app.post('/api/auth/login', 
    authLimiter, 
    [
        body('email').isEmail().withMessage('Please enter a valid email format.'),
        body('password').notEmpty().withMessage('Password field cannot be empty.')
    ], 
    validateInputs, 
    async (req, res) => {
        try {
            const { email, password } = req.body;

            const user = await User.findOne({ email });
            if (!user) return res.status(400).json({ message: "Invalid email or password" });

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) return res.status(400).json({ message: "Invalid email or password" });

            const token = jwt.sign(
                { id: user._id, role: user.role }, // Payload contents
                process.env.JWT_SECRET, 
                { expiresIn: '1h' }
            );

            res.cookie('token', token, {
                httpOnly: true,
                secure: true, 
                sameSite: 'none',
                maxAge: 3600000 
            });

            res.status(200).json({ message: "Login successful!" });
        } catch (error) {
            res.status(500).json({ message: "Server error during login" });
        }
    }
);

// ==========================================
// 4. PRIVATE / PROTECTED PATH CONFIGURATIONS

// Token verification definition
const verifyToken = (req, res, next) => {
    // Look for the token inside the parsed cookies object
    const token = req.cookies.token; 
    
    if (!token) return res.status(401).json({ message: "Access denied. Token missing from session." });

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.user = verified;
        next(); 
    } catch (error) {
        res.status(403).json({ message: "Invalid or expired token session" });
    }
};

// Flexible authorization gateway middleware
const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        // 1. Double check that verifyToken successfully extracted the user payload
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized. Session verification required." });
        }

        // 2. Evaluate if the user's role is included in the endpoint's allowed roles array
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ message: `Access denied. ${req.user.role} tier cannot open this asset.` });
        }

        next(); // Authorization approved! Proceed to core path controller logic
    };
};

// backend/server.js - Rectified Deletion Endpoint

app.delete('/api/protected/delete-user/:id', verifyToken, async (req, res) => {
    try {
        const targetUserId = req.params.id;      
        const requestingUserId = req.user.id;    
        const requestingUserRole = req.user.role; 

        // 1. Fetch the target account to check its role status
        const targetUser = await User.findById(targetUserId);
        if (!targetUser) {
            return res.status(404).json({ message: "Target account record not found." });
        }

        // ==========================================================================
        // RECTIFIED SAFETY CHECK: DYNAMIC ROLE-SPECIFIC COUNT TRACKING
        // ==========================================================================
        if (targetUserId === requestingUserId) {
            if (requestingUserRole === 'admin') {
                const totalAdmins = await User.countDocuments({ role: 'admin' });
                if (totalAdmins <= 1) {
                    return res.status(400).json({ 
                        message: "Action Denied: You are the last remaining Admin node. Self-deletion is blocked unless another user is promoted to Admin first." 
                    });
                }
            } 
            else if (requestingUserRole === 'superadmin') {
                const totalSuperAdmins = await User.countDocuments({ role: 'superadmin' });
                if (totalSuperAdmins <= 1) {
                    return res.status(400).json({ 
                        message: "Action Denied: You are the last remaining Superadmin. Self-deletion is blocked to prevent an irreversible root lockout." 
                    });
                }
            }
        }

        // ==========================================================================
        // ROLE CHECK 1: SUPERADMIN OPERATIONAL RULES
        // ==========================================================================
        if (requestingUserRole === 'superadmin') {
            // Superadmins can delete users, admins, and other superadmins (if safety checks pass)
        }

        // ==========================================================================
        // ROLE CHECK 2: ADMIN OPERATIONAL RULES
        // ==========================================================================
        else if (requestingUserRole === 'admin') {
            if (targetUserId !== requestingUserId) {
                // If targeting someone else, it MUST be a standard 'user'
                if (targetUser.role === 'admin' || targetUser.role === 'superadmin') {
                    return res.status(403).json({ 
                        message: "Action Denied: Standard Administrators cannot delete other Admin or Superadmin entries." 
                    });
                }
            }
        }

        // ==========================================================================
        // ROLE CHECK 3: REGULAR USER OPERATIONAL RULES
        // ==========================================================================
        else if (requestingUserRole === 'user') {
            if (targetUserId !== requestingUserId) {
                return res.status(403).json({ 
                    message: "Action Denied: Standard users are unauthorized to remove foreign account records." 
                });
            }
        }

        // ==========================================================================
        // EXECUTION LAYER: Run database purge
        // ==========================================================================
        await User.findByIdAndDelete(targetUserId);

        if (targetUserId === requestingUserId) {
            res.clearCookie('token');
            return res.status(200).json({ 
                selfDeleted: true, 
                message: "Your profile record has been successfully purged from the infrastructure." 
            });
        }

        res.status(200).json({ 
            selfDeleted: false, 
            message: `Account node (${targetUser.email}) removed from system cluster.` 
        });

    } catch (error) {
        res.status(500).json({ message: "Internal server error executing deletion sequencing." });
    }
});

app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: "Logged out successfully" });
});

// GET: http://localhost:8000/api/protected/dashboard
app.get('/api/protected/dashboard', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json({ message: "Authorized entry successful", user });
    } catch (error) {
        res.status(500).json({ message: "Server error accessing route" });
    }
});

// GET: http://localhost:8000/api/auth/me
// Checks the HTTP-Only cookie via verifyToken and returns user details if valid
app.get('/api/auth/me', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.status(200).json({ isAuthenticated: true, user });
    } catch (error) {
        res.status(500).json({ message: "Server error checking session" });
    }
});

// EXCLUSIVE ADMIN PORTAL: Locked down to 'admin' and 'superadmin' roles only
app.get('/api/protected/admin-panel', verifyToken, authorizeRoles('admin', 'superadmin'), async (req, res) => {
    try {
        // Fetch all system users to display on the management panel
        const totalUsers = await User.find().select('-password');
        res.json({ message: "Secure Admin Gateway Accessed successfully.", totalUsers });
    } catch (error) {
        res.status(500).json({ message: "Server error reading portal data" });
    }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Backend running securely on port ${PORT}`));