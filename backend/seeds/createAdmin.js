/**
 * ResQAI — First Admin Bootstrap Script
 * ─────────────────────────────────────────────────────────────────────────────
 * Usage:
 *   node backend/seeds/createAdmin.js
 *
 * Or override defaults via environment variables:
 *   ADMIN_NAME="John Doe" ADMIN_EMAIL="john@example.com" ADMIN_PASSWORD="MyPass@123" \
 *     node backend/seeds/createAdmin.js
 *
 * Requirements: .env must be present in backend/ with a valid MONGO_URI
 * ─────────────────────────────────────────────────────────────────────────────
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import readline from 'readline';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// ── Load .env from backend/ ────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

if (!process.env.MONGO_URI) {
  console.error('\n❌  MONGO_URI not found in backend/.env\n');
  process.exit(1);
}

// ── Inline User schema (no circular import issues) ────────────────────────────
const userSchema = new mongoose.Schema(
  {
    name:            { type: String,  required: true, trim: true },
    email:           { type: String,  required: true, unique: true, lowercase: true },
    password:        { type: String },
    role:            { type: String,  enum: ['citizen', 'responder', 'shelter_manager', 'admin'], default: 'citizen' },
    isEmailVerified: { type: Boolean, default: false },
    isActive:        { type: Boolean, default: true },
    avatar:          { type: String,  default: '' },
    phone:           { type: String,  default: '' },
    skills:          { type: [String], default: [] },
    isAvailable:     { type: Boolean, default: true },
    isSafe:          { type: Boolean, default: true },
  },
  { timestamps: true }
);

const User = mongoose.models.User || mongoose.model('User', userSchema);

// ── Prompt helper ─────────────────────────────────────────────────────────────
const prompt = (rl, question, hidden = false) =>
  new Promise((resolve) => {
    if (hidden && process.stdout.isTTY) {
      process.stdout.write(question);
      process.stdin.setRawMode(true);
      let input = '';
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', function handler(ch) {
        ch = ch.toString();
        if (ch === '\n' || ch === '\r' || ch === '\u0004') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener('data', handler);
          process.stdout.write('\n');
          resolve(input);
        } else if (ch === '\u0003') {
          process.exit();
        } else if (ch === '\b' || ch === '\u007F') {
          if (input.length > 0) { input = input.slice(0, -1); process.stdout.write('\b \b'); }
        } else {
          input += ch;
          process.stdout.write('*');
        }
      });
    } else {
      rl.question(question, resolve);
    }
  });

// ── Validate password ──────────────────────────────────────────────────────────
const validatePassword = (pw) => {
  if (pw.length < 8)            return '❌  Must be at least 8 characters';
  if (!/[A-Z]/.test(pw))        return '❌  Must contain at least one uppercase letter';
  if (!/[a-z]/.test(pw))        return '❌  Must contain at least one lowercase letter';
  if (!/\d/.test(pw))           return '❌  Must contain at least one number';
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(pw))
                                 return '❌  Must contain at least one special character';
  return null;
};

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║      ResQAI — Admin Bootstrap Script     ║');
  console.log('╚══════════════════════════════════════════╝\n');

  // Pull values from env if provided (useful for CI/automated setup)
  let name     = process.env.ADMIN_NAME;
  let email    = process.env.ADMIN_EMAIL;
  let password = process.env.ADMIN_PASSWORD;

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  if (!name)  name  = await prompt(rl, '  Admin Name     : ');
  if (!email) email = await prompt(rl, '  Admin Email    : ');

  if (!password) {
    while (true) {
      password = await prompt(rl, '  Admin Password : ', true);
      const err = validatePassword(password);
      if (!err) break;
      console.log('  ' + err);
    }
  }

  rl.close();

  name  = name.trim();
  email = email.trim().toLowerCase();

  if (!name || !email) {
    console.error('\n❌  Name and email are required.\n');
    process.exit(1);
  }

  // ── Connect to MongoDB ───────────────────────────────────────────────────────
  console.log('\n  Connecting to MongoDB Atlas…');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('  ✓ Connected\n');

  // ── Check if admin already exists ─────────────────────────────────────────────
  const existing = await User.findOne({ email });

  if (existing) {
    if (existing.role === 'admin') {
      console.log(`  ℹ  Admin already exists: ${existing.name} <${existing.email}>`);
      console.log('     No changes made.\n');
    } else {
      // Upgrade existing user to admin
      existing.role            = 'admin';
      existing.isEmailVerified = true;
      existing.isActive        = true;
      const salt               = await bcrypt.genSalt(12);
      existing.password        = await bcrypt.hash(password, salt);
      await existing.save();
      console.log(`  ✓ Existing user upgraded to admin: ${existing.name} <${existing.email}>\n`);
    }
  } else {
    // Create new admin user
    const salt         = await bcrypt.genSalt(12);
    const hashedPwd    = await bcrypt.hash(password, salt);

    const admin = await User.create({
      name,
      email,
      password:        hashedPwd,
      role:            'admin',
      isEmailVerified: true,
      isActive:        true,
    });

    console.log('  ✅  Admin created successfully!\n');
    console.log(`     Name  : ${admin.name}`);
    console.log(`     Email : ${admin.email}`);
    console.log(`     Role  : ${admin.role}`);
    console.log(`     ID    : ${admin._id}\n`);
  }

  console.log('  You can now log in to ResQAI with these credentials.\n');
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌  Error:', err.message, '\n');
  process.exit(1);
});
