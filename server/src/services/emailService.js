const nodemailer = require('nodemailer');
const env = require('../config/env');
const logger = require('../utils/logger');

// When EMAIL_ENABLED=false (the default for local dev), emails are just
// logged to the console instead of actually being sent — so auth flows
// like "forgot password" still work end-to-end without needing real SMTP
// credentials. Phase 10 adds the rest of the email templates (leave
// approved/rejected, employee created, payroll generated) on top of this
// same `sendMail` function.
let transporter = null;

function getTransporter() {
  if (!env.email.enabled) return null;
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: env.email.host,
    port: env.email.port,
    secure: env.email.port === 465,
    auth: { user: env.email.user, pass: env.email.pass },
  });
  return transporter;
}

async function sendMail({ to, subject, html, text }) {
  if (!env.email.enabled) {
    // Dev convenience: temporary passwords / reset links are visible in
    // the console when SMTP is off. Never enabled in production.
    if (!env.isProduction) logger.debug(`[email:disabled] Would send "${subject}" to ${to}\n${text || html}`);
    else logger.warn('Email disabled: message not sent', { subject, to });
    return { skipped: true };
  }

  const t = getTransporter();
  return t.sendMail({ from: env.email.from, to, subject, html, text });
}

async function sendPasswordResetEmail(email, resetUrl) {
  return sendMail({
    to: email,
    subject: 'Reset your Enterprise HRMS password',
    text: `We received a request to reset your password. Use the link below (valid for 1 hour):\n${resetUrl}\n\nIf you did not request this, you can safely ignore this email.`,
    html: `<p>We received a request to reset your password.</p><p><a href="${resetUrl}">Reset your password</a> (valid for 1 hour)</p><p>If you did not request this, you can safely ignore this email.</p>`,
  });
}

async function sendEmployeeWelcomeEmail(email, tempPassword) {
  return sendMail({
    to: email,
    subject: 'Welcome to Enterprise HRMS — your account is ready',
    text: `Your Enterprise HRMS account has been created.\n\nEmail: ${email}\nTemporary password: ${tempPassword}\n\nPlease log in and change your password from your profile page.`,
    html: `<p>Your Enterprise HRMS account has been created.</p><p><b>Email:</b> ${email}<br/><b>Temporary password:</b> ${tempPassword}</p><p>Please log in and change your password from your profile page.</p>`,
  });
}

async function sendLeaveSubmittedEmail(approverEmail, employeeName, leaveType, startDate, endDate) {
  return sendMail({
    to: approverEmail,
    subject: `Leave request from ${employeeName} awaiting your approval`,
    text: `${employeeName} has requested ${leaveType} leave from ${startDate} to ${endDate}. Please review it in the HRMS.`,
    html: `<p><b>${employeeName}</b> has requested <b>${leaveType}</b> leave from ${startDate} to ${endDate}.</p><p>Please review it in the HRMS.</p>`,
  });
}

async function sendLeaveStatusEmail(employeeEmail, status, leaveType, startDate, endDate, comment) {
  const verb = status === 'Approved' ? 'approved' : 'rejected';
  return sendMail({
    to: employeeEmail,
    subject: `Your ${leaveType} leave request has been ${verb}`,
    text: `Your ${leaveType} leave request from ${startDate} to ${endDate} has been ${verb}.${comment ? `\n\nComment: ${comment}` : ''}`,
    html: `<p>Your <b>${leaveType}</b> leave request from ${startDate} to ${endDate} has been <b>${verb}</b>.</p>${comment ? `<p>Comment: ${comment}</p>` : ''}`,
  });
}

async function sendPayrollGeneratedEmail(employeeEmail, month, netSalary) {
  return sendMail({
    to: employeeEmail,
    subject: `Your payslip for ${month} is ready`,
    text: `Your payroll for ${month} has been generated. Net salary: ${netSalary}. Log in to the HRMS to view the full breakdown.`,
    html: `<p>Your payroll for <b>${month}</b> has been generated.</p><p>Net salary: <b>${netSalary}</b></p><p>Log in to the HRMS to view the full breakdown.</p>`,
  });
}

module.exports = {
  sendMail,
  sendPasswordResetEmail,
  sendEmployeeWelcomeEmail,
  sendLeaveSubmittedEmail,
  sendLeaveStatusEmail,
  sendPayrollGeneratedEmail,
};
