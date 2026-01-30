const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendOTPEmail = async (email, fullName, otp) => {
  const mailOptions = {
    from: `"pupapers.com" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `Your Verification Code for pupapers.com`,
    html: `
      <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #f0f0f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
        <div style="background: #111111; padding: 30px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">pu<span style="color: #FF6B00;">papers</span>.com</h1>
        </div>
        <div style="padding: 40px; color: #333333; line-height: 1.6;">
          <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 20px;">Verification Code</h2>
          <p>Hi ${fullName.split(' ')[0]},</p>
          <p>Welcome to <strong>pupapers.com</strong>! Please use the following 6-digit code to verify your email address and complete your signup.</p>
          
          <div style="background: #f8f9fa; border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0;">
            <span style="font-size: 36px; font-weight: 800; letter-spacing: 12px; color: #FF6B00;">${otp}</span>
          </div>
          
          <p style="font-size: 14px; color: #888888;">This code will expire in 10 minutes. If you didn't request this, please ignore this email.</p>
          
          <hr style="border: 0; border-top: 1px solid #eeeeee; margin: 30px 0;" />
          
          <p style="font-size: 12px; color: #999999; text-align: center;">
            Empowering students to achieve their dreams at Panjab University Chandigarh.<br/>
            &copy; ${new Date().getFullYear()} pupapers.com. All rights reserved.
          </p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (err) {
    console.error('Email send failed:', err);
    return false;
  }
};

};

const sendContactEmail = async (name, email, subject, message) => {
  const mailOptions = {
    from: `"Contact Form" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_USER, // Send to support email
    replyTo: email, // Allow replying to the user
    subject: `Contact Form: ${subject}`,
    html: `
      <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #f0f0f0; border-radius: 16px; overflow: hidden;">
        <div style="background: #111111; padding: 20px; text-align: center;">
          <h2 style="color: #ffffff; margin: 0;">New Message</h2>
        </div>
        <div style="padding: 30px; color: #333333;">
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Subject:</strong> ${subject}</p>
          <hr style="border: 0; border-top: 1px solid #eeeeee; margin: 20px 0;" />
          <p><strong>Message:</strong></p>
          <p style="background: #f8f9fa; padding: 15px; border-radius: 8px;">${message.replace(/\n/g, '<br>')}</p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (err) {
    console.error('Contact email send failed:', err);
    return false;
  }
};

module.exports = { sendOTPEmail, sendContactEmail };
