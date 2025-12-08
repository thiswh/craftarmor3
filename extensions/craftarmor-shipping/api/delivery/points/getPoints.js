/**
 * GET /api/delivery/points
 *
 * Query params:
 * - bounds=minLat,minLng,maxLat,maxLng (required)
 * - services=cdek,boxberry,russianpost (optional, defaults to all)
 * - zoom=number (optional, for future tuning)
 *
 * TODO: implement DB query with bounding-box and service filter.
 */
export default async function getDeliveryPoints(request, response, delegate) {
  response.status(501).json({
    success: false,
    message: 'Not implemented yet: delivery points endpoint'
  });
  return delegate;
}
