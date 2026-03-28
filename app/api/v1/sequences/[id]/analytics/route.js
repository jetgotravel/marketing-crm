import { NextResponse } from 'next/server';
import { authenticate } from '../../../_lib/auth.js';
import supabase from '../../../_lib/db.js';
import { unauthorized, notFound } from '../../../_lib/errors.js';

export async function GET(req, { params }) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  const { id } = await params;

  // Verify sequence ownership
  const { data: sequence } = await supabase
    .from('sequences')
    .select('id, name, status, created_at, send_window_start, send_window_end, skip_weekends, daily_send_limit, cooldown_days')
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .single();

  if (!sequence) return notFound('Sequence');

  // Get steps
  const { data: steps } = await supabase
    .from('sequence_steps')
    .select('id, step_order, step_type, subject, body_template, variant_key, split_ratio')
    .eq('sequence_id', id)
    .order('step_order', { ascending: true })
    .order('variant_key', { ascending: true });

  // Get enrollments
  const { data: enrollments } = await supabase
    .from('sequence_enrollments')
    .select('id, contact_id, status, current_step_order, assigned_variant, enrolled_at, updated_at, sender_user_id')
    .eq('sequence_id', id);

  // Get sent emails for this sequence
  const { data: emails } = await supabase
    .from('emails')
    .select('id, contact_id, step_id, direction, gmail_thread_id, created_at')
    .eq('sequence_id', id);

  // Get bounce activities for this sequence
  const { data: bounceActivities } = await supabase
    .from('activities')
    .select('contact_id, created_at')
    .eq('tenant_id', auth.tenant_id)
    .eq('activity_type', 'email_bounced')
    .filter('metadata->>sequence_id', 'eq', id);

  const sentEmails = (emails || []).filter(e => e.direction === 'sent');
  const receivedEmails = (emails || []).filter(e => e.direction === 'received');
  const bounces = bounceActivities || [];

  // Overall stats
  const total = enrollments.length;
  const active = enrollments.filter(e => e.status === 'active').length;
  const paused = enrollments.filter(e => e.status === 'paused').length;
  const completed = enrollments.filter(e => e.status === 'completed').length;
  const replied = enrollments.filter(e => e.status === 'replied').length;
  const totalSent = sentEmails.length;
  const totalReplies = receivedEmails.length;
  const totalBounces = bounces.length;
  const replyRate = totalSent > 0 ? (totalReplies / totalSent * 100).toFixed(1) : 0;
  const bounceRate = totalSent > 0 ? (totalBounces / totalSent * 100).toFixed(1) : 0;
  const completionRate = total > 0 ? (completed / total * 100).toFixed(1) : 0;

  // Average time to reply
  let avgReplyTimeHours = null;
  if (receivedEmails.length > 0) {
    const replyTimes = [];
    for (const reply of receivedEmails) {
      // Find the most recent sent email in the same thread before this reply
      const sentInThread = sentEmails
        .filter(s => s.gmail_thread_id === reply.gmail_thread_id && new Date(s.created_at) < new Date(reply.created_at))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      if (sentInThread.length > 0) {
        const hours = (new Date(reply.created_at) - new Date(sentInThread[0].created_at)) / (1000 * 60 * 60);
        replyTimes.push(hours);
      }
    }
    if (replyTimes.length > 0) {
      avgReplyTimeHours = (replyTimes.reduce((a, b) => a + b, 0) / replyTimes.length).toFixed(1);
    }
  }

  // Per-step funnel
  const stepStats = (steps || []).map(step => {
    const stepSent = sentEmails.filter(e => e.step_id === step.id);
    const stepReplies = receivedEmails.filter(e => {
      // Match replies to this step via thread
      const sentThreadIds = new Set(stepSent.map(s => s.gmail_thread_id));
      return sentThreadIds.has(e.gmail_thread_id);
    });

    return {
      step_order: step.step_order,
      step_type: step.step_type,
      subject: step.subject,
      variant_key: step.variant_key,
      split_ratio: step.split_ratio,
      sent: stepSent.length,
      replies: stepReplies.length,
      reply_rate: stepSent.length > 0 ? (stepReplies.length / stepSent.length * 100).toFixed(1) : 0,
    };
  });

  return NextResponse.json({
    data: {
      sequence_id: id,
      sequence_name: sequence.name,
      sequence_status: sequence.status,
      settings: {
        send_window_start: sequence.send_window_start,
        send_window_end: sequence.send_window_end,
        skip_weekends: sequence.skip_weekends,
        daily_send_limit: sequence.daily_send_limit,
        cooldown_days: sequence.cooldown_days,
      },
      overall: {
        total_enrolled: total,
        active,
        paused,
        completed,
        replied,
        total_sent: totalSent,
        total_replies: totalReplies,
        total_bounces: totalBounces,
        reply_rate: parseFloat(replyRate),
        bounce_rate: parseFloat(bounceRate),
        completion_rate: parseFloat(completionRate),
        avg_reply_time_hours: avgReplyTimeHours ? parseFloat(avgReplyTimeHours) : null,
      },
      steps: stepStats,
    },
  });
}
