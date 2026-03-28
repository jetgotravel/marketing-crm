import { NextResponse } from 'next/server';
import { authenticate } from '../../../_lib/auth.js';
import supabase from '../../../_lib/db.js';
import { unauthorized, notFound } from '../../../_lib/errors.js';

export async function GET(req, { params }) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  const { id } = await params;

  // Verify template ownership
  const { data: template } = await supabase
    .from('email_templates')
    .select('id, name, subject_template, category, usage_count')
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .single();

  if (!template) return notFound('Template');

  // Find steps that use this template's subject (approximate match)
  // Templates are used by being copied into step subject/body_template,
  // so we track via the emails sent from steps
  const { data: steps } = await supabase
    .from('sequence_steps')
    .select('id, sequence_id, step_order, subject, variant_key')
    .eq('subject', template.subject_template);

  const stepIds = (steps || []).map(s => s.id);

  if (stepIds.length === 0) {
    return NextResponse.json({
      data: {
        template_id: id,
        template_name: template.name,
        category: template.category,
        usage_count: template.usage_count,
        total_sent: 0,
        total_replies: 0,
        reply_rate: 0,
        sequences_used_in: 0,
      },
    });
  }

  // Get emails sent from these steps
  const { data: emails } = await supabase
    .from('emails')
    .select('step_id, direction, gmail_thread_id')
    .in('step_id', stepIds);

  const sent = (emails || []).filter(e => e.direction === 'sent');
  const sentThreadIds = new Set(sent.map(s => s.gmail_thread_id));
  const replies = (emails || []).filter(e => e.direction === 'received' && sentThreadIds.has(e.gmail_thread_id));

  const uniqueSequences = new Set((steps || []).map(s => s.sequence_id));

  return NextResponse.json({
    data: {
      template_id: id,
      template_name: template.name,
      category: template.category,
      usage_count: template.usage_count,
      total_sent: sent.length,
      total_replies: replies.length,
      reply_rate: sent.length > 0 ? parseFloat((replies.length / sent.length * 100).toFixed(1)) : 0,
      sequences_used_in: uniqueSequences.size,
    },
  });
}
