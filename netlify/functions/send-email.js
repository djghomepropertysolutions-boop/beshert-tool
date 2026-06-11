// netlify/functions/send-email.js
// Sends branded estimate/invoice emails via Resend API
// Requires: RESEND_API_KEY environment variable in Netlify

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const {
      to, contractNumber, clientName, jobType,
      total, date, docType, paymentLines
    } = JSON.parse(event.body);

    if (!to || !contractNumber) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing required fields" }) };
    }

    const typeLabel = docType === "invoice" ? "Invoice" : "Estimate";

    const fmtAmt = (n) => {
      const num = parseFloat(String(n).replace(/[^0-9.]/g, "")) || 0;
      return "$" + num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const payHTML = (paymentLines || []).map(p =>
      `<tr>
        <td style="padding:9px 16px;border-bottom:1px solid #ece9f4;font-size:13px;">${p.label}</td>
        <td style="padding:9px 16px;text-align:right;font-weight:700;border-bottom:1px solid #ece9f4;font-size:13px;">${fmtAmt(p.amt)}</td>
      </tr>`
    ).join("");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Beshert Roofing — ${typeLabel} ${contractNumber}</title>
</head>
<body style="margin:0;padding:20px;background:#f2f4f7;font-family:Georgia,serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1a2744 0%,#5a4f7a 100%);padding:24px 28px;">
      <div style="font-weight:700;font-size:20px;color:#C9A84C;letter-spacing:1px;margin-bottom:4px;">
        BESHERT ROOFING REDEVELOPMENT GROUP
      </div>
      <div style="font-size:11px;color:rgba(255,255,255,0.55);letter-spacing:1.5px;text-transform:uppercase;">
        A Trusted Choice Since 2005 &nbsp;·&nbsp; Affiliated with Magnanimous Life 501(c)(3)
      </div>
    </div>

    <!-- Gold rule -->
    <div style="height:3px;background:linear-gradient(90deg,#C9A84C,#e8d080,transparent);"></div>

    <!-- Body -->
    <div style="padding:28px;">
      <p style="font-size:15px;color:#1a2744;margin:0 0 6px 0;font-weight:700;">
        Dear ${clientName || "Valued Client"},
      </p>
      <p style="font-size:13px;color:#555;line-height:1.7;margin:0 0 22px 0;">
        Thank you for choosing Beshert Roofing Redevelopment Group.
        Please find your ${typeLabel.toLowerCase()} details below for your records.
      </p>

      <!-- Details card -->
      <div style="background:#ece9f4;border-radius:8px;padding:18px 20px;margin-bottom:22px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding-bottom:12px;vertical-align:top;width:50%;">
              <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">${typeLabel} Number</div>
              <div style="font-size:16px;font-weight:700;color:#1a2744;letter-spacing:2px;">${contractNumber}</div>
            </td>
            <td style="padding-bottom:12px;vertical-align:top;">
              <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">Date</div>
              <div style="font-size:14px;font-weight:700;color:#1a2744;">${date}</div>
            </td>
          </tr>
          <tr>
            <td style="vertical-align:top;">
              <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">Service</div>
              <div style="font-size:14px;font-weight:700;color:#1a2744;">${jobType}</div>
            </td>
            <td style="vertical-align:top;">
              <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">Total</div>
              <div style="font-size:18px;font-weight:700;color:#1a2744;">${total}</div>
            </td>
          </tr>
        </table>
      </div>

      <!-- Payment schedule -->
      ${payHTML ? `
      <div style="margin-bottom:22px;">
        <div style="font-size:11px;font-weight:700;color:#5a4f7a;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Payment Schedule</div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #ece9f4;border-radius:6px;overflow:hidden;">
          ${payHTML}
        </table>
      </div>` : ""}

      <p style="font-size:13px;color:#555;line-height:1.7;margin:0 0 22px 0;">
        If you have any questions about this ${typeLabel.toLowerCase()}, please contact us at any time using the information below.
        We look forward to completing your project.
      </p>

      <p style="font-size:13px;color:#555;line-height:1.7;margin:0;">
        Sincerely,<br>
        <strong style="color:#1a2744;">Carlito · Beshert Roofing Redevelopment Group</strong>
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#1a2744;padding:16px 28px;text-align:center;">
      <div style="font-size:12px;color:rgba(255,255,255,0.65);margin-bottom:4px;">
        📞 216-326-7663 &nbsp;·&nbsp; 📱 440-554-5332 &nbsp;·&nbsp; beshert@thebeshertgroup.com
      </div>
      <div style="font-size:11px;color:rgba(255,255,255,0.35);">www.thebeshertgroup.com</div>
    </div>

  </div>
</body>
</html>`;

    // Send via Resend API
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        // "from" must match your verified sender in Resend
        // "reply_to" routes homeowner replies directly to Carlito's Gmail
        from: "Beshert Roofing <beshert@thebeshertgroup.com>",
        reply_to: "cbrown7745@gmail.com",
        to: [to],
        subject: `Your ${typeLabel} from Beshert Roofing — ${contractNumber}`,
        html
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Resend error:", errText);
      return { statusCode: 500, body: JSON.stringify({ error: errText }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };

  } catch (err) {
    console.error("Function error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
