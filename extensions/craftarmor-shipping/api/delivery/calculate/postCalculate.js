/**
 * POST /api/delivery/calculate
 *
 * Body shape (draft):
 * {
 *   pointId: number,
 *   serviceCode: 'cdek' | 'boxberry' | 'russianpost',
 *   cart: { items: [...], weight: number, dimensions: { width, height, depth }, orderSum: number },
 *   sender: { city, postalCode } // from shop settings typically
 * }
 *
 * TODO: dispatch to proper service calculator; return { cost, days, currency }.
 */
export default async function postCalculate(request, response, delegate) {
  response.status(501).json({
    success: false,
    message: 'Not implemented yet: delivery calculate endpoint'
  });
  return delegate;
}
