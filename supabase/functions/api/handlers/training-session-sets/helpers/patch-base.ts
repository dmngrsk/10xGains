import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData } from '../../../utils/api-helpers.ts';
import type { SessionSetDto } from '../../../models/api-types.ts';
import type { AppContext } from '../../../context.ts';

export async function patch(
  c: Context<AppContext>,
  sessionId: string,
  setId: string,
  getUpdateSetData: (set: SessionSetDto) => Partial<SessionSetDto>
): Promise<Response> {
  const supabaseClient = c.get('supabase');
  const user = c.get('user');

  const { data: sessionData, error: sessionError } = await supabaseClient
    .from('training_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single();

  if (sessionError || !sessionData) {
    const errorData = createErrorDataWithLogging(404, 'Training session not found.', undefined, undefined, sessionError);
    return c.json(errorData, 404);
  }
  if (sessionData.status === 'COMPLETED') {
    const errorData = createErrorDataWithLogging(400, `Training session ${sessionId} is completed. Cannot update set.`);
    return c.json(errorData, 400);
  }

  const { data: currentSet, error: fetchError } = await supabaseClient
    .from('session_sets')
    .select(`*`)
    .eq('id', setId)
    .eq('training_session_id', sessionId)
    .single();

  if (fetchError || !currentSet) {
    const errorData = createErrorDataWithLogging(404, 'Training session set not found.', undefined, undefined, fetchError);
    return c.json(errorData, 404);
  }

  if (sessionData.status === 'PENDING') {
    const { error: updateError } = await supabaseClient
      .from('training_sessions')
      .update({ status: 'IN_PROGRESS', session_date: new Date().toISOString() })
      .eq('id', sessionId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating session status for PATCH:', updateError);
      const errorData = createErrorDataWithLogging(500, 'Failed to update session status.', { details: updateError.message });
      return c.json(errorData, 500);
    }
  }

  const updateData = getUpdateSetData(currentSet as SessionSetDto);

  const { data: updatedSet, error: updateError } = await supabaseClient
    .from('session_sets')
    .update(updateData as SessionSetDto)
    .eq('id', setId)
    .eq('training_session_id', sessionId)
    .select(`*`)
    .single();

  if (updateError) {
    console.error('Error updating training session set:', updateError);
    const errorData = createErrorDataWithLogging(500, 'Failed to update training session set.', { details: updateError.message }, undefined, updateError);
    return c.json(errorData, 500);
  }

  const successData = createSuccessData(updatedSet as SessionSetDto, { message: 'Training session set updated successfully.' });
  return c.json(successData, 200);
}
