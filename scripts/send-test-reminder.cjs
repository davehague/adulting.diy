// scripts/send-test-reminder.js
//
// One-off: render a task_reminder email (matching EmailProvider.ts) for a given
// task and send it via the running dev server's /api/sendEmail endpoint.
//
// Usage:
//   node scripts/send-test-reminder.js <taskId> <toEmail> [baseUrl]

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const taskId = process.argv[2];
const toEmail = process.argv[3];
const baseUrl = process.argv[4] || 'https://localhost:3000';

if (!taskId || !toEmail) {
  console.error('Usage: node scripts/send-test-reminder.js <taskId> <toEmail> [baseUrl]');
  process.exit(1);
}

const formatDate = (d) =>
  new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

const renderReminderHtml = ({ userName, taskName, dueDate, heading, headingColor, bgColor, buttonColor, dueSummary, occurrenceUrl, taskUrl }) => `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: ${headingColor};">${heading}</h2>
          <p>Hi ${userName},</p>
          <p>${dueSummary}</p>
          <div style="background: ${bgColor}; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <h3 style="margin-top: 0;">${taskName}</h3>
            <p><strong>Due Date:</strong> ${dueDate}</p>
          </div>
          <p>
            <a href="${occurrenceUrl}" style="background: ${buttonColor}; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; display: inline-block; margin-right: 8px;">Complete Task</a>
            <a href="${taskUrl}" style="background: white; color: ${buttonColor}; border: 1px solid ${buttonColor}; padding: 7px 16px; text-decoration: none; border-radius: 4px; display: inline-block;">View Task</a>
          </p>
          <p>Best regards,<br>Adulting.DIY</p>
        </div>
      `;

async function main() {
  const task = await prisma.taskDefinition.findUnique({ where: { id: taskId } });
  if (!task) throw new Error(`Task ${taskId} not found`);

  const occurrence = await prisma.taskOccurrence.findFirst({
    where: { taskId, status: { in: ['created', 'assigned'] } },
    orderBy: { dueDate: 'asc' },
  });
  if (!occurrence) throw new Error(`No open occurrence for task ${taskId}`);

  const recipient = await prisma.user.findFirst({ where: { email: toEmail } });
  const userName = recipient?.name || toEmail;

  const now = new Date();
  const due = new Date(occurrence.dueDate);
  const daysOverdue = Math.max(0, Math.ceil((now.getTime() - due.getTime()) / 86400000));
  const isOverdue = due < now;

  const vars = isOverdue
    ? {
        heading: 'Task Overdue',
        headingColor: '#dc2626',
        bgColor: '#fef2f2',
        buttonColor: '#dc2626',
        dueSummary: `Your task is ${daysOverdue} day${daysOverdue === 1 ? '' : 's'} overdue:`,
        subjectLine: `Overdue: ${task.name} (${daysOverdue} day${daysOverdue === 1 ? '' : 's'} overdue)`,
      }
    : {
        heading: 'Task Reminder',
        headingColor: '#d97706',
        bgColor: '#fffbeb',
        buttonColor: '#d97706',
        dueSummary: 'Your task is due soon:',
        subjectLine: `Reminder: ${task.name}`,
      };

  const html = renderReminderHtml({
    userName,
    taskName: task.name,
    dueDate: formatDate(occurrence.dueDate),
    heading: vars.heading,
    headingColor: vars.headingColor,
    bgColor: vars.bgColor,
    buttonColor: vars.buttonColor,
    dueSummary: vars.dueSummary,
    occurrenceUrl: `${baseUrl}/occurrences/${occurrence.id}`,
    taskUrl: `${baseUrl}/tasks/${task.id}`,
  });

  const subject = `Adulting.diy - ${vars.subjectLine}`;

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) throw new Error('CRON_SECRET not set in env');

  const res = await fetch(`${baseUrl}/api/sendEmail`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cronSecret}`,
    },
    body: JSON.stringify({ to: toEmail, subject, html }),
  });

  const result = await res.json();
  console.log('Status:', res.status);
  console.log('Result:', result);
  console.log('\nLinks in email:');
  console.log('  Complete Task ->', `${baseUrl}/occurrences/${occurrence.id}`);
  console.log('  View Task     ->', `${baseUrl}/tasks/${task.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
