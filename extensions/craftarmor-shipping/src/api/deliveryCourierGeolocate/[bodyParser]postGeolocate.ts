import { Request, Response } from 'express';

const DADATA_GEOLOCATE_URL =
  'https://suggestions.dadata.ru/suggestions/api/4_1/rs/geolocate/address';

const getToken = () =>
  process.env.DADATA_API_TOKEN ||
  process.env.DADATA_TOKEN ||
  process.env.DADATA_API_KEY ||
  '';

const getSecret = () =>
  process.env.DADATA_SECRET ||
  process.env.DADATA_SECRET_KEY ||
  '';

export default async function postGeolocate(
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
    const lat = parseFloat(String(body.lat || ''));
    const lon = parseFloat(String(body.lon || ''));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      response.statusCode = 400;
      response.$body = {
        success: false,
        message: 'lat and lon are required'
      };
      return;
    }

    const count = Math.min(
      Math.max(parseInt(String(body.count || '1'), 10) || 1, 1),
      10
    );

    const payload: Record<string, unknown> = {
      lat,
      lon,
      count
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Token ${token}`
    };
    const secret = getSecret();
    if (secret) {
      headers['X-Secret'] = secret;
    }

    const dadataResponse = await fetch(DADATA_GEOLOCATE_URL, {
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
          'Failed to geolocate address'
      };
      return;
    }

    response.$body = {
      success: true,
      data: {
        suggestions: Array.isArray(data?.suggestions) ? data.suggestions : []
      }
    };
  } catch (error: any) {
    console.error('[deliveryCourierGeolocate] Error:', error);
    response.statusCode = 500;
    response.$body = {
      success: false,
      message: 'Failed to geolocate address',
      error: error.message
    };
  }
}
