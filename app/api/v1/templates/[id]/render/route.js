import { NextResponse } from 'next/server';
import { authenticate } from '../../../_lib/auth.js';
import supabase from '../../../_lib/db.js';
import { renderTemplate } from '../../../_lib/template-render.js';
import { unauthorized, badRequest, notFound } from '../../../_lib/errors.js';

export async function POST(req, { params }) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  const { id } = await params;

  let body;
  try {
    body = await req.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  // Fetch template
  const { data: template, error: templateError } = await supabase
    .from('email_templates')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .single();

  if (templateError || !template) return notFound('Template');

  // Resolve contact data — either from contact_id or inline object
  let contact;
  if (body.contact_id) {
    const { data: contactData, error: contactError } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', body.contact_id)
      .eq('tenant_id', auth.tenant_id)
      .single();

    if (contactError || !contactData) return notFound('Contact');
    contact = contactData;
  } else if (body.contact) {
    contact = body.contact;
  } else {
    return badRequest('contact_id or contact object is required');
  }

  const subject = renderTemplate(template.subject_template, contact);
  const body_html = renderTemplate(template.body_template, contact);

  // Increment usage_count
  await supabase
    .from('email_templates')
    .update({ usage_count: template.usage_count + 1 })
    .eq('id', id);

  return NextResponse.json({
    data: {
      template_id: id,
      subject,
      body: body_html,
    },
  });
}
