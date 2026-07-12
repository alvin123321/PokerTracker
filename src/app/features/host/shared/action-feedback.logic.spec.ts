import {
  messageFromSupabaseFunctionError,
  messageFromUnknownError
} from './action-feedback.logic';

describe('action feedback messages', () => {
  it('uses plain Supabase error object messages before the generic fallback', () => {
    expect(messageFromUnknownError({ message: 'Session player not found.' })).toBe(
      'Session player not found.'
    );
  });

  it('falls back when an error object has no readable message', () => {
    expect(messageFromUnknownError({ code: 'PGRST000' }, 'Unable to save changes.')).toBe(
      'Unable to save changes.'
    );
  });

  it('reads structured Edge Function error bodies', async () => {
    const error = {
      name: 'FunctionsHttpError',
      message: 'Edge Function returned a non-2xx status code',
      context: new Response(JSON.stringify({ error: 'Host privileges required.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    };

    await expectAsync(
      messageFromSupabaseFunctionError(error, 'Unable to delete registered player.')
    ).toBeResolvedTo('Host privileges required.');
  });

  it('keeps the original function error message when the body is unreadable', async () => {
    const error = {
      name: 'FunctionsHttpError',
      message: 'Edge Function returned a non-2xx status code',
      context: new Response('not-json', { status: 500 })
    };

    await expectAsync(
      messageFromSupabaseFunctionError(error, 'Unable to delete registered player.')
    ).toBeResolvedTo('Edge Function returned a non-2xx status code');
  });
});
