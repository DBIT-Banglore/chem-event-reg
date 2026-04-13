# 🔒 Security Checklist for Chem Event Reg

This checklist helps verify that all security measures are properly configured and working.

## ✅ CORS Configuration

### Production Environment
- [ ] Only `https://chem-event.netlify.app` is allowed in production
- [ ] Development origins (`localhost`) are blocked in production
- [ ] Custom `ALLOWED_ORIGINS` environment variable is set correctly (if needed)

### Testing CORS
```bash
# Test allowed origin (should succeed)
npm run test:cors

# Test blocked origin (should return 403)
npm run test:cors:evil

# Test development origin (should work in dev mode)
npm run test:cors:dev
```

### Expected Results
- ✅ Allowed origins receive `200 OK` with proper CORS headers
- ❌ Blocked origins receive `403 Forbidden`
- 📋 CORS headers include `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, etc.

---

## ✅ Security Headers

### Required Headers (check via `curl -I https://chem-event.netlify.app/`)
- [ ] `X-Frame-Options: DENY`
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- [ ] `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- [ ] `Content-Security-Policy: default-src 'self'; ...`

### Testing Headers
```bash
# Check all security headers
curl -I https://chem-event.netlify.app/ | grep -i "x-\|content-\|strict-\|referrer-\|permissions-"
```

---

## ✅ Rate Limiting

### API Rate Limits
- [ ] Global API: 200 requests per hour per IP
- [ ] OTP sending: 5 requests per 15 minutes per IP
- [ ] USN lookup: 5 requests per minute, 30 per hour per IP

### Testing Rate Limiting
```bash
# Test OTP rate limiting (should be blocked after 5 attempts)
for i in {1..10}; do
  curl -X POST https://chem-event.netlify.app/api/auth/send-otp \
    -H "Content-Type: application/json" \
    -d '{"email":"test@dbit.in","usn":"1DB25CS001"}'
  echo "Request $i completed"
done
```

### Expected Results
- ✅ First 5 requests succeed
- ❌ Requests 6-10 receive `429 Too Many Requests`

---

## ✅ Input Validation

### USN Validation
- [ ] USN format: alphanumeric, 6-12 characters
- [ ] Invalid USNs return `400 Bad Request`
- [ ] SQL injection attempts are blocked

### Email Validation
- [ ] Email format is validated
- [ ] Email length is restricted (max 254 characters)
- [ ] Email injection attempts are blocked

### Testing Input Validation
```bash
# Test SQL injection
curl -X POST https://chem-event.netlify.app/api/auth/lookup-usn \
  -H "Content-Type: application/json" \
  -d '{"usn":"1'"'"' OR '"'"'1'"'"'='"'"'1"}'

# Test XSS
curl -X POST https://chem-event.netlify.app/api/auth/lookup-usn \
  -H "Content-Type: application/json" \
  -d '{"usn":"<script>alert(1)</script>"}'
```

---

## ✅ Authentication & Authorization

### JWT Session Management
- [ ] JWT_SECRET is set and is at least 32 characters
- [ ] Session cookies are HTTP-only
- [ ] Dashboard routes redirect to `/register` if not authenticated
- [ ] JWT tokens expire properly

### Admin Access Control
- [ ] ADMIN_EMAILS environment variable is set
- [ ] Only specified emails can access `/admin`
- [ ] Firebase Auth is properly configured for admin panel

### Testing Authentication
```bash
# Test protected route without auth (should redirect to /register)
curl -I https://chem-event.netlify.app/dashboard

# Test API without auth (should return 401 or 403)
curl -I https://chem-event.netlify.app/api/admin/events
```

---

## ✅ Firebase Security

### Firestore Rules
- [ ] Read/write access is properly restricted
- [ ] Admin operations require authentication
- [ ] Client operations are limited to necessary data
- [ ] Sensitive fields (email, phone) are not exposed to clients

### Firebase Configuration
- [ ] Service account has minimal required permissions
- [ ] Firebase project is not in test mode
- [ ] Appropriate billing limits are set

---

## ✅ Environment Variables

### Required Variables (all must be set)
- [ ] `FIREBASE_PROJECT_ID`
- [ ] `FIREBASE_CLIENT_EMAIL`
- [ ] `FIREBASE_PRIVATE_KEY`
- [ ] `JWT_SECRET` (min 32 characters)
- [ ] `BREVO_API_KEY`
- [ ] `BREVO_SENDER_EMAIL`
- [ ] `RAZORPAY_KEY_ID`
- [ ] `RAZORPAY_KEY_SECRET`
- [ ] `ADMIN_EMAILS`

### Security Checks
- [ ] No secrets are committed to git
- [ ] `.env.local` is in `.gitignore`
- [ ] Production secrets are different from development secrets
- [ ] JWT_SECRET is strong and random

---

## ✅ Netlify Configuration

### Build & Deployment
- [ ] Node version is set to 20+ in `netlify.toml`
- [ ] Next.js plugin is configured
- [ ] Build command is `npm run build`
- [ ] Publish directory is `.next`

### Headers & Redirects
- [ ] Security headers are configured in `netlify.toml`
- [ ] CORS headers are set for `/api/*`
- [ ] Cache headers are appropriate for static assets

---

## 🚨 Common Security Issues to Watch

### 1. CORS Misconfiguration
**Symptom:** API returns 403 for legitimate requests
**Solution:** Check `ALLOWED_ORIGINS` and `NODE_ENV` settings

### 2. Missing Security Headers
**Symptom:** Missing `X-Frame-Options` or other headers
**Solution:** Check both `next.config.ts` and `netlify.toml`

### 3. Rate Limiting Not Working
**Symptom:** Able to make unlimited requests
**Solution:** Check Redis/memcached for rate limit storage

### 4. JWT Secret Leaked
**Symptom:** Unauthorized users can create valid tokens
**Solution:** Rotate `JWT_SECRET` immediately and check git history

### 5. Firebase Rules Too Permissive
**Symptom:** Users can access other users' data
**Solution:** Review and tighten Firestore security rules

---

## 📋 Pre-Deployment Checklist

Before deploying to production:

- [ ] All environment variables are set for production
- [ ] `NODE_ENV=production` is set
- [ ] CORS is locked to `https://chem-event.netlify.app`
- [ ] Security headers are verified
- [ ] Rate limiting is tested
- [ ] Firebase rules are reviewed
- [ ] Admin emails are confirmed
- [ ] Payment gateway is configured
- [ ] Email service is working
- [ ] SSL/HTTPS is enforced
- [ ] Monitoring and logging are enabled

---

## 🔧 Troubleshooting

### CORS Issues
```bash
# Check current CORS headers
curl -I -H "Origin: https://chem-event.netlify.app" \
  https://chem-event.netlify.app/api/events

# Check middleware logs
npm run dev
# Look for CORS-related error messages
```

### Rate Limiting Issues
```bash
# Check rate limit storage (if using Redis)
redis-cli FLUSHDB  # Clear rate limits (dev only)

# Check middleware implementation
# Review src/middleware.ts rate limiting logic
```

### Authentication Issues
```bash
# Verify JWT_SECRET is set
echo $JWT_SECRET

# Test JWT generation
node -e "const jwt = require('jsonwebtoken'); console.log(jwt.sign({test: 'data'}, process.env.JWT_SECRET));"
```

---

## 📞 Security Incident Response

If a security incident is suspected:

1. **Immediate Actions**
   - Check logs for unusual activity
   - Rotate all secrets (JWT_SECRET, API keys)
   - Review admin access logs

2. **Investigation**
   - Identify affected data and users
   - Determine attack vector
   - Check for unauthorized access

3. **Remediation**
   - Patch identified vulnerabilities
   - Notify affected users if data was exposed
   - Implement additional monitoring

4. **Prevention**
   - Update security checklist
   - Conduct security audit
   - Implement additional safeguards

---

**Last Updated:** 2026-04-13
**Version:** 1.0.0
**Maintained By:** DBIT CSE Section B