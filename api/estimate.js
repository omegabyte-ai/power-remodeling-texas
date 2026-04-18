// api/estimate.js — Power Remodeling Texas lead intake
// Vercel Serverless Function — CommonJS (no package.json type:module)
// POST /api/estimate → Pipedrive lead + Resend emails

const PIPEDRIVE_TOKEN = process.env.PIPEDRIVE_TOKEN;
const PIPEDRIVE_BASE  = 'https://omegabyte.pipedrive.com/api/v1';
const RESEND_KEY      = process.env.RESEND_API_KEY;
const FROM_EMAIL      = process.env.FROM_EMAIL      || 'no-reply@claude4seniors.com';
const NOTIFY_EMAIL_1  = process.env.NOTIFY_EMAIL_1  || 'noe@powerremodelingtexas.com';
const NOTIFY_EMAIL_2  = process.env.NOTIFY_EMAIL_2  || 'shawn@shawnp.com';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function createPipedrivePerson(data) {
  const res = await fetch(`${PIPEDRIVE_BASE}/persons?api_token=${PIPEDRIVE_TOKEN}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name:  `${data.first_name} ${data.last_name}`,
      phone: [{ value: data.phone, primary: true, label: 'mobile' }],
      email: [{ value: data.email, primary: true, label: 'work'   }],
    }),
  });
  const json = await res.json();
  return json.success ? json.data.id : null;
}

async function createPipedriveLead(data, personId) {
  const serviceList = Array.isArray(data.services) ? data.services.join(', ') : (data.services || '—');
  const title = `${data.first_name} ${data.last_name} — ${serviceList} — ${data.project_address || 'TX'}`;

  const res = await fetch(`${PIPEDRIVE_BASE}/leads?api_token=${PIPEDRIVE_TOKEN}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, person_id: personId || undefined }),
  });
  const json = await res.json();
  const leadId = json.success ? json.data.id : null;

  // Attach full project details as a pinned note
  if (leadId) {
    const note = [
      `Services: ${serviceList}`,
      `Property: ${data.property_type || '—'} / ${data.home_size || '—'}`,
      `Budget: ${data.budget || '—'}`,
      `Timeline: ${data.timeline || '—'}`,
      `Contact pref: ${data.contact_pref || '—'} / Best time: ${data.best_time || '—'}`,
      `Address: ${data.project_address || '—'}`,
      `\nProject description:\n${data.project_desc || '—'}`,
    ].join('\n');

    await fetch(`${PIPEDRIVE_BASE}/notes?api_token=${PIPEDRIVE_TOKEN}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: note, lead_id: leadId, pinned_to_lead_flag: 1 }),
    });
  }

  return leadId;
}

async function sendResendEmail(to, subject, html) {
  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${RESEND_KEY}`,
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: Array.isArray(to) ? to : [to], subject, html }),
  });
  return res.ok;
}

// ── Email Templates ───────────────────────────────────────────────────────────

function confirmationEmail(data) {
  const serviceList = Array.isArray(data.services) ? data.services.join(', ') : (data.services || '—');
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:40px 20px;background:#0D0D0D;font-family:Helvetica Neue,Arial,sans-serif;color:#E8E4DC">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto">
<tr><td style="background:#0A1628;padding:28px 36px;border-radius:4px 4px 0 0;border-bottom:3px solid #CC1F1F">
  <p style="margin:0 0 10px;font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:#CC1F1F">Power Remodeling Texas</p>
  <h1 style="margin:0;font-size:24px;font-weight:700;color:#fff">We've got your estimate request</h1>
</td></tr>
<tr><td style="background:#111;padding:32px 36px">
  <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#C8C4BC">Hi ${data.first_name},</p>
  <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#C8C4BC">
    Thank you for reaching out. We received your request for <strong style="color:#fff">${serviceList}</strong>.
    A member of our team will contact you within <strong style="color:#fff">24 hours</strong> to discuss your project
    and schedule a free in-home consultation.
  </p>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border:1px solid rgba(255,255,255,.08);border-radius:4px;margin:24px 0">
    <tr><td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,.06)">
      <p style="margin:0 0 4px;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#9A9590">Services</p>
      <p style="margin:0;font-size:14px;color:#fff;font-weight:600">${serviceList}</p>
    </td></tr>
    ${data.budget ? `<tr><td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,.06)">
      <p style="margin:0 0 4px;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#9A9590">Budget Range</p>
      <p style="margin:0;font-size:14px;color:#fff">${data.budget}</p>
    </td></tr>` : ''}
    ${data.timeline ? `<tr><td style="padding:16px 20px">
      <p style="margin:0 0 4px;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#9A9590">Timeline</p>
      <p style="margin:0;font-size:14px;color:#fff">${data.timeline}</p>
    </td></tr>` : ''}
  </table>
  <p style="margin:0;font-size:14px;color:#9A9590;line-height:1.7">
    Questions? Call or text us at <a href="tel:8322312334" style="color:#CC1F1F;text-decoration:none;font-weight:600">(832) 231-2334</a>.
  </p>
</td></tr>
<tr><td style="background:#111;padding:0 36px 32px;text-align:center">
  <a href="https://powerremodelingtexas.com" style="display:inline-block;background:#CC1F1F;color:#fff;padding:13px 28px;border-radius:4px;font-size:12px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;text-decoration:none">View Our Work</a>
</td></tr>
<tr><td style="background:#0A1628;padding:20px 36px;border-radius:0 0 4px 4px;text-align:center">
  <p style="margin:0;font-size:11px;color:#9A9590;line-height:1.7">
    Power Remodeling Texas &nbsp;·&nbsp; 19815 Treemont Fair Drive, Richmond, TX 77407<br>
    <a href="tel:8322312334" style="color:#9A9590;text-decoration:none">(832) 231-2334</a>
  </p>
</td></tr>
</table>
</body></html>`;
}

function notificationEmail(data, leadId) {
  const serviceList = Array.isArray(data.services) ? data.services.join(', ') : (data.services || '—');
  const rows = [
    ['Name',         `${data.first_name} ${data.last_name}`],
    ['Phone',        data.phone || '—'],
    ['Email',        data.email || '—'],
    ['Services',     serviceList],
    ['Address',      data.project_address || '—'],
    ['Property',     `${data.property_type || '—'} / ${data.home_size || '—'}`],
    ['Budget',       data.budget || '—'],
    ['Timeline',     data.timeline || '—'],
    ['Contact',      `${data.contact_pref || '—'} / ${data.best_time || '—'}`],
  ].map(([k, v]) => `<tr>
    <td style="padding:10px 16px;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#9A9590;border-bottom:1px solid rgba(255,255,255,.06);white-space:nowrap">${k}</td>
    <td style="padding:10px 16px;font-size:14px;color:#E8E4DC;border-bottom:1px solid rgba(255,255,255,.06)">${v}</td>
  </tr>`).join('');

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:40px 20px;background:#0D0D0D;font-family:Helvetica Neue,Arial,sans-serif;color:#E8E4DC">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto">
<tr><td style="background:#CC1F1F;padding:14px 24px;border-radius:4px 4px 0 0">
  <h2 style="margin:0;font-size:15px;color:#fff;font-weight:700">🔔 New Estimate Request — Power Remodeling TX</h2>
</td></tr>
<tr><td style="background:#111;border-radius:0 0 4px 4px">
  <table width="100%" cellpadding="0" cellspacing="0">${rows}</table>
  ${data.project_desc ? `<div style="padding:16px;border-top:1px solid rgba(255,255,255,.06)">
    <p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#9A9590">Project Description</p>
    <p style="margin:0;font-size:14px;color:#C8C4BC;line-height:1.7">${data.project_desc.replace(/\n/g,'<br>')}</p>
  </div>` : ''}
  <div style="padding:14px 16px;border-top:1px solid rgba(255,255,255,.06)">
    <a href="https://omegabyte.pipedrive.com/leads/list" style="color:#CC1F1F;font-size:13px;text-decoration:none;margin-right:24px">→ View in Pipedrive</a>
    <a href="tel:${(data.phone||'').replace(/\D/g,'')}" style="color:#9A9590;font-size:13px;text-decoration:none">📞 ${data.phone || ''}</a>
  </div>
</td></tr>
</table>
</body></html>`;
}

// ── Main Handler ──────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ ok: false, error: 'Method not allowed' });

  let data;
  try {
    data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!data) throw new Error('Empty body');
  } catch (e) {
    return res.status(400).json({ ok: false, error: 'Invalid JSON' });
  }

  const errors = [];

  // 1. Pipedrive
  let leadId = null;
  try {
    if (PIPEDRIVE_TOKEN) {
      const personId = await createPipedrivePerson(data);
      leadId = await createPipedriveLead(data, personId);
    }
  } catch (err) {
    errors.push('Pipedrive: ' + err.message);
  }

  // 2. Confirmation email to homeowner
  try {
    if (RESEND_KEY && data.email) {
      await sendResendEmail(
        data.email,
        'Your Power Remodeling Texas estimate request',
        confirmationEmail(data)
      );
    }
  } catch (err) {
    errors.push('Resend confirmation: ' + err.message);
  }

  // 3. Notification email to team
  try {
    if (RESEND_KEY) {
      await sendResendEmail(
        [NOTIFY_EMAIL_1, NOTIFY_EMAIL_2].filter(Boolean),
        `New lead: ${data.first_name} ${data.last_name} — ${Array.isArray(data.services) ? data.services.join(', ') : data.services}`,
        notificationEmail(data, leadId)
      );
    }
  } catch (err) {
    errors.push('Resend notification: ' + err.message);
  }

  // Always redirect to thank-you — don't punish homeowner for backend issues
  return res.status(200).json({
    ok:     true,
    leadId: leadId || null,
    errors: errors.length ? errors : undefined,
  });
};
