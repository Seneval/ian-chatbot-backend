const { createTransport } = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    this.fromEmail = process.env.EMAIL_FROM || 'noreply@inteligenciaartificialparanegocios.com';
    this.frontendUrl = process.env.FRONTEND_URL || 'https://ian-chatbot-backend-h6zr.vercel.app';
    
    this.initialize();
  }

  initialize() {
    // Check if email configuration exists
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log('📧 Email service not configured. Email verification will be disabled.');
      return;
    }

    try {
      // Create transporter
      this.transporter = createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

      // Verify connection
      this.transporter.verify((error, success) => {
        if (error) {
          console.error('❌ Email service connection failed:', error.message);
          this.isConfigured = false;
        } else {
          console.log('✅ Email service ready to send emails');
          this.isConfigured = true;
        }
      });
    } catch (error) {
      console.error('❌ Failed to initialize email service:', error);
      this.isConfigured = false;
    }
  }

  async sendVerificationEmail(email, name, token) {
    if (!this.isConfigured) {
      console.log('📧 Email service not configured, skipping verification email');
      return { success: false, error: 'Email service not configured' };
    }

    const verificationUrl = `${this.frontendUrl}/api/tenant/verify-email/${token}`;
    
    const mailOptions = {
      from: `iAN Chatbot <${this.fromEmail}>`,
      to: email,
      subject: 'Verifica tu cuenta de iAN Chatbot',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4A90E2; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 5px 5px; }
            .button { display: inline-block; padding: 12px 30px; background-color: #4A90E2; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🤖 Bienvenido a iAN Chatbot</h1>
            </div>
            <div class="content">
              <h2>Hola ${name},</h2>
              <p>Gracias por registrarte en iAN Chatbot. Para completar tu registro y activar tu cuenta, por favor verifica tu dirección de correo electrónico.</p>
              <p style="text-align: center;">
                <a href="${verificationUrl}" class="button">Verificar mi email</a>
              </p>
              <p>O copia y pega este enlace en tu navegador:</p>
              <p style="word-break: break-all; background-color: #eee; padding: 10px; border-radius: 3px;">
                ${verificationUrl}
              </p>
              <p><strong>Este enlace expirará en 24 horas.</strong></p>
              <p>Si no creaste esta cuenta, puedes ignorar este mensaje.</p>
            </div>
            <div class="footer">
              <p>© 2025 iAN Chatbot - Inteligencia Artificial para Negocios</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Hola ${name},
        
        Gracias por registrarte en iAN Chatbot. Para completar tu registro, verifica tu email visitando:
        
        ${verificationUrl}
        
        Este enlace expirará en 24 horas.
        
        Si no creaste esta cuenta, puedes ignorar este mensaje.
        
        Saludos,
        El equipo de iAN Chatbot
      `
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Verification email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Failed to send verification email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendPasswordResetEmail(email, name, token) {
    if (!this.isConfigured) {
      console.log('📧 Email service not configured, skipping password reset email');
      return { success: false, error: 'Email service not configured' };
    }

    const resetUrl = `${this.frontendUrl}/reset-password?token=${token}`;
    
    const mailOptions = {
      from: `iAN Chatbot <${this.fromEmail}>`,
      to: email,
      subject: 'Restablecer contraseña - iAN Chatbot',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #E74C3C; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 5px 5px; }
            .button { display: inline-block; padding: 12px 30px; background-color: #E74C3C; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Restablecer Contraseña</h1>
            </div>
            <div class="content">
              <h2>Hola ${name},</h2>
              <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta.</p>
              <p style="text-align: center;">
                <a href="${resetUrl}" class="button">Restablecer contraseña</a>
              </p>
              <p>O copia y pega este enlace en tu navegador:</p>
              <p style="word-break: break-all; background-color: #eee; padding: 10px; border-radius: 3px;">
                ${resetUrl}
              </p>
              <p><strong>Este enlace expirará en 1 hora.</strong></p>
              <p>Si no solicitaste restablecer tu contraseña, puedes ignorar este mensaje y tu contraseña permanecerá sin cambios.</p>
            </div>
            <div class="footer">
              <p>© 2025 iAN Chatbot - Inteligencia Artificial para Negocios</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Hola ${name},
        
        Recibimos una solicitud para restablecer tu contraseña. Visita el siguiente enlace:
        
        ${resetUrl}
        
        Este enlace expirará en 1 hora.
        
        Si no solicitaste este cambio, puedes ignorar este mensaje.
        
        Saludos,
        El equipo de iAN Chatbot
      `
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Password reset email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Failed to send password reset email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendWelcomeEmail(email, name) {
    if (!this.isConfigured) {
      return { success: false, error: 'Email service not configured' };
    }

    const dashboardUrl = `${this.frontendUrl}/admin/dashboard.html`;
    
    const mailOptions = {
      from: `iAN Chatbot <${this.fromEmail}>`,
      to: email,
      subject: '¡Bienvenido a iAN Chatbot! 🎉',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #27AE60; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 5px 5px; }
            .button { display: inline-block; padding: 12px 30px; background-color: #27AE60; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .feature { margin: 15px 0; padding-left: 25px; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>¡Bienvenido a iAN Chatbot! 🤖</h1>
            </div>
            <div class="content">
              <h2>Hola ${name},</h2>
              <p>¡Tu cuenta ha sido verificada exitosamente! Estamos emocionados de tenerte con nosotros.</p>
              
              <h3>🚀 Próximos pasos:</h3>
              <div class="feature">✅ Crea tu primer chatbot con IA</div>
              <div class="feature">✅ Personaliza las respuestas para tu negocio</div>
              <div class="feature">✅ Integra el widget en tu sitio web</div>
              <div class="feature">✅ Monitorea las conversaciones en tiempo real</div>
              
              <p style="text-align: center;">
                <a href="${dashboardUrl}" class="button">Ir al Dashboard</a>
              </p>
              
              <h3>💡 ¿Necesitas ayuda?</h3>
              <p>Visita nuestra documentación o contáctanos en soporte@inteligenciaartificialparanegocios.com</p>
            </div>
            <div class="footer">
              <p>© 2025 iAN Chatbot - Inteligencia Artificial para Negocios</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Welcome email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Failed to send welcome email:', error);
      return { success: false, error: error.message };
    }
  }
}

// Create singleton instance
const emailService = new EmailService();

module.exports = emailService;