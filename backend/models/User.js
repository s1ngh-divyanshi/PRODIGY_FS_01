// backend/models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    email: { 
        type: String, 
        required: true, 
        unique: true, 
        lowercase: true,
        trim: true 
    },
    password: { 
        type: String, 
        required: true 
    },

    // ==========================================
    // ROLE-BASED SYSTEM ENFORCEMENT
    // ==========================================
    role: {
        type: String,
        enum: ['user', 'admin', 'superadmin'], // Restricts input to these options
        default: 'user' // Every new signup automatically starts as a regular user
    }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);