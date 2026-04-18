// api/estimate.js — Power Remodeling Texas lead intake
// Vercel Serverless Function (Node 18+)
// POST /api/estimate → Pipedrive lead + Resend emails

export const config = { runtime: 'nodejs' };

const PIPEDRIVE_TOKEN = process.env.PIPEDRIVE_TOKEN;
const PIPEDRIVE_BASE  = 'https://omegabyte.pipedrive.com/api/v1';
const RESEND_KEY      = process.env.RESEND_API_KEY;
const FROM_EMAIL      = process.env.FROM_EMAIL      || 'no-reply@powerremodelingtexas.com';
const NOTIFY_EMAIL_1  = process.env.NOTIFY_EMAIL_1  || 'noe@powerremodelingtexas.com'; // Noe
const NOTIFY_EMAIL_2  = process.env.NOTIFY_EMAIL_2  || 'shawn@shawnp.com';             // Coach

// ── Helpers ──────────────────────────────────────────────────────────────────

async function createPipedrivePerson(data) {
  const body = {
    name:  `${data.first_name} ${data.last_name}`,
    phone: [{ value: data.phone, primary: true, label: 'mobile' }],
    email: [{ value: data.email, primary: true, label: 'work'   }],
  };
  const res = await fetch(`${PIPEDRIVE_BASE}/persons?api_token=${PIPEDRIVE_TOKEN}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  const json = await res.json();
  return json.success ? json.data.id : null;
}

async function createPipedriveLead(data, personId) {
  const serviceList = Array.isArray(data.services) ? data.services.join(', ') : data.services;
  const title = `${data.first_name} ${data.last_name} — ${serviceList} — ${data.project_address || 'Texas'}`;
  const note  = [
    `Services: ${serviceList}`,
    `Property: ${data.property_type || '—'} / ${data.home_size || '—'}`,
    `Budget: ${data.budget || '—'}`,
    `Timeline: ${data.timeline || '—'}`,
    `Contact pref: ${data.contact_pref || '—'} / Best time: ${data.best_time || '—'}`,
    `Address: ${data.project_address || '—'}`,
    `\nProject description:\n${data.project_desc || '—'}`,
  ].join('\n');

  const body = {
    title,
    person_id: personId || undefined,
    label_ids: [], // attach labels if desired
  };

  const res = await fetch(`${PIPEDRIVE_BASE}/leads?api_token=${PIPEDRIVE_TOKEN}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  const json = await res.json();
  const leadId = json.success ? json.data.id : null;

  // Attach a note to the lead for full project details
  if (leadId) {
    await fetch(`${PIPEDRIVE_BASE}/notes?api_token=${PIPEDRIVE_TOKEN}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        content:   note,
        lead_id:   leadId,
        pinned_to_lead_flag: 1,
      }),
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
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  return res.ok;
}

// ── Email Templates ───────────────────────────────────────────────────────────

function confirmationEmail(data) {
  const serviceList = Array.isArray(data.services) ? data.services.join(', ') : data.services;
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0D0D0D;font-family:'Helvetica Neue',Arial,sans-serif;color:#E8E4DC">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0D0D0D;padding:40px 20px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

        <!-- Header -->
        <tr><td style="background:#0A1628;padding:32px 40px;border-radius:4px 4px 0 0;border-bottom:3px solid #CC1F1F">
          <p style="margin:0;font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:#CC1F1F;margin-bottom:12px">Power Remodeling Texas</p>
          <h1 style="margin:0;font-size:28px;font-weight:700;color:#fff;line-height:1.2">We've got your estimate request</h1>
        </td></tr>

        <!-- Body -->
        <tr><td style="background:#111;padding:36px 40px">
          <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#C8C4BC">Hi ${data.first_name},</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#C8C4BC">
            Thank you for reaching out. We received your request for <strong style="color:#fff">${serviceList}</strong> and we'll be in touch within <strong style="color:#fff">24 hours</strong> to discuss your project and schedule a free in-home consultation.
          </p>

          <!-- Summary box -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border:1px solid rgba(255,255,255,.08);border-radius:4px;margin:28px 0">
            <tr><td style="padding:20px 24px;border-bottom:1px solid rgba(255,255,255,.06)">
              <p style="margin:0;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#9A9590;margin-bottom:6px">Services Requested</p>
              <p style="margin:0;font-size:14px;color:#fff;font-weight:600">${serviceList}</p>
            </td></tr>
            ${data.budget ? `<tr><td style="padding:20px 24px;border-bottom:1px solid rgba(255,255,255,.06)">
              <p style="margin:0;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#9A9590;margin-bottom:6px">Budget Range</p>
              <p style="margin:0;font-size:14px;color:#fff">${data.budget}</p>
            </td></tr>` : ''}
            ${data.timeline ? `<tr><td style="padding:20px 24px">
              <p style="margin:0;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#9A9590;margin-bottom:6px">Project Timeline</p>
              <p style="margin:0;font-size:14px;color:#fff">${data.timeline}</p>
            </td></tr>` : ''}
          </table>

          <p style="margin:0 0 8px;font-size:14px;color:#9A9590;line-height:1.7">
            Our team typically schedules consultations within the same week. We serve Houston, Katy, Sugar Land, The Woodlands, and surrounding areas — including Austin communities in NW Hills, Steiner Ranch, and Riverplace.
          </p>

          <p style="margin:24px 0 0;font-size:15px;line-height:1.7;color:#C8C4BC">
            Questions in the meantime? Call or text us at <a href="tel:8322312334" style="color:#CC1F1F;text-decoration:none;font-weight:600">(832) 231-2334</a>.
          </p>
        </td></tr>

        <!-- CTA -->
        <tr><td style="background:#111;padding:0 40px 36px;text-align:center">
          <a href="https://powerremodelingtexas.com" style="display:inline-block;background:#CC1F1F;color:#fff;padding:14px 32px;border-radius:4px;font-size:13px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;text-decoration:none">View Our Work</a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#0A1628;padding:24px 40px;border-radius:0 0 4px 4px;text-align:center">
          <p style="margin:0;font-size:11px;color:#9A9590;line-height:1.7">
            Power Remodeling Texas &nbsp;·&nbsp; 19815 Treemont Fair Drive, Richmond, TX 77407<br>
            <a href="tel:8322312334" style="color:#9A9590;text-decoration:none">(832) 231-2334</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function notificationEmail(data, leadId) {
  const serviceList = Array.isArray(data.services) ? data.services.join(', ') : data.services;
  const rows = [
    ['Name',         `${data.first_name} ${data.last_name}`],
    ['Phone',        data.phone],
    ['Email',        data.email],
    ['Services',     serviceList],
    ['Address',      data.project_address || '—'],
    ['Property',     `${data.property_type || '—'} / ${data.home_size || '—'}`],
    ['Budget',       data.budget || '—'],
    ['Timeline',     data.timeline || '—'],
    ['Contact Pref', `${data.contact_pref || '—'} / Best time: ${data.best_time || '—'}`],
  ].map(([k, v]) => `
    <tr>
      <td style="padding:12px 16px;font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:#9A9590;white-space:nowrap;border-bottom:1px solid rgba(255,255,255,.06)">${k}</td>
      <td style="padding:12px 16px;font-size:14px;color:#E8E4DC;border-bottom:1px solid rgba(255,255,255,.06)">${v}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:40px 20px;background:#0D0D0D;font-family:'Helvetica Neue',Arial,sans-serif;color:#E8E4DC">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto">
    <tr><td style="background:#CC1F1F;padding:16px 28px;border-radius:4px 4px 0 0">
      <h2 style="margin:0;font-size:16px;color:#fff;font-weight:700">🔔 New Estimate Request — Power Remodeling TX</h2>
    </td></tr>
    <tr><td style="background:#111;padding:0;border-radius:0 0 4px 4px">
      <table width="100%" cellpadding="0" cellspacing="0">${rows}</table>
      ${data.project_desc ? `
      <div style="padding:20px 16px;border-top:1px solid rgba(255,255,255,.06)">
        <p style="margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#9A9590">Project Description</p>
        <p style="margin:0;font-size:14px;color:#C8C4BC;line-height:1.7">${data.project_desc.replace(/\n/g,'<br>')}</p>
      </div>` : ''}
      ${leadId ? `
      <div style="padding:16px;border-top:1px solid rgba(255,255,255,.06)">
        <a href="https://omegabyte.pipedrive.com/leads/list" style="color:#CC1F1F;font-size:13px;text-decoration:none">→ View in Pipedrive</a>
      </div>` : ''}
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ ok: false, error: 'Method not allowed' });

  let data;
  try {
    data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ ok: false, error: 'Invalid JSON' });
  }

  const errors = [];

  // 1. Pipedrive — create person + lead
  let leadId = null;
  try {
    const personId = PIPEDRIVE_TOKEN ? await createPipedrivePerson(data) : null;
    leadId = PIPEDRIVE_TOKEN ? await createPipedriveLead(data, personId) : null;
  } catch (err) {
    errors.push(`Pipedrive: ${err.message}`);
  }

  // 2. Resend — confirmation to customer
  try {
    if (RESEND_KEY && data.email) {
      await sendResendEmail(
        [data.email],
        'Your Power Remodeling Texas estimate request',
        confirmationEmail(data)
      );
    }
  } catch (err) {
    errors.push(`Resend confirmation: ${err.message}`);
  }

  // 3. Resend — notification to team
  try {
    if (RESEND_KEY) {
      await sendResendEmail(
        [NOTIFY_EMAIL_1, NOTIFY_EMAIL_2],
        `New estimate request: ${data.first_name} ${data.last_name} — ${Array.isArray(data.services) ? data.services.join(', ') : data.services}`,
        notificationEmail(data, leadId)
      );
    }
  } catch (err) {
    errors.push(`Resend notification: ${err.message}`);
  }

  // Always return ok:true so the form redirects to thank-you
  // (don't punish the homeowner for a backend issue)
  return res.status(200).json({
    ok:     true,
    leadId: leadId || null,
    errors: errors.length ? errors : undefined,
  });
}
