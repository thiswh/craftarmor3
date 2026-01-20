import { Request, Response } from 'express';

const DADATA_SUGGEST_URL =
  'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address';

const getToken = () =>
  process.env.DADATA_API_TOKEN ||
  process.env.DADATA_TOKEN ||
  process.env.DADATA_API_KEY ||
  '';

const getSecret = () =>
  process.env.DADATA_SECRET ||
  process.env.DADATA_SECRET_KEY ||
  '';

export default async function postSuggest(
  request: Request,
  response: Response
) {
  try {
    const token = getToken();
    if (!token) {
      response.statusCode = 500;
      response.$body = {
        success: false,
        message: 'DaData token is not configured'
      };
      return;
    }

    const body = request.body || {};
    const query = typeof body.query === 'string' ? body.query.trim() : '';
    if (!query) {
      response.statusCode = 400;
      response.$body = {
        success: false,
        message: 'Query is required'
      };
      return;
    }

    const count = Math.min(
      Math.max(parseInt(String(body.count || '5'), 10) || 5, 1),
      20
    );

    const payload: Record<string, unknown> = {
      query,
      count
    };

    if (Array.isArray(body.locations)) {
      payload.locations = body.locations;
    }
    if (body.from_bound || body.to_bound) {
      payload.from_bound = body.from_bound;
      payload.to_bound = body.to_bound;
    }
    if (typeof body.restrict_value === 'boolean') {
      payload.restrict_value = body.restrict_value;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Token ${token}`
    };
    const secret = getSecret();
    if (secret) {
      headers['X-Secret'] = secret;
    }

    const dadataResponse = await fetch(DADATA_SUGGEST_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    const data = await dadataResponse.json().catch(() => null);

    if (!dadataResponse.ok) {
      response.statusCode = dadataResponse.status;
      response.$body = {
        success: false,
        message:
          data?.message ||
          data?.error ||
          'Failed to fetch address suggestions'
      };
      return;
    }

    response.$body = {
      success: true,
      data: {
        suggestions: (Array.isArray(data?.suggestions) ? data.suggestions : []).filter(
          (suggestion: any) => {
            const payload = suggestion?.data || {};
            if (!payload.postal_code) {
              return false;
            }
            return true;
          }
        )
      }
    };
  } catch (error: any) {
    console.error('[deliveryCourierSuggest] Error:', error);
    response.statusCode = 500;
    response.$body = {
      success: false,
      message: 'Failed to fetch address suggestions',
      error: error.message
    };
  }
}
