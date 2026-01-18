Postman checks for delivery changes

1) Delivery calculate (requires session cookie, no body dimensions)
Method: POST
URL: http://localhost:3000/api/delivery/calculate
Headers:
  Content-Type: application/json
Cookies:
  sid=YOUR_SID_VALUE
Body (raw JSON):
{
  "pointId": 419,
  "serviceCode": "cdek",
  "pointData": {
    "postal_code": "109202",
    "city": "Moscow",
    "address": "Pervoskoye sh., 16/2",
    "region": "Moscow",
    "service_code": "cdek"
  }
}

Expected:
- 200 with success:true if cart has total_weight/total_length/total_width/total_height.
- 400 with a clear error message if cookie or cart data is missing.

2) Shipping calculate via calculate_api (returns success:false + invalid_items)
Method: GET
URL: http://localhost:3000/api/shipping/calculate/{cart_uuid}/{shipping_method_uuid}
Example:
  http://localhost:3000/api/shipping/calculate/66db29e2-71e1-4871-a418-a2d660bdf081/d3d16c61-5acf-4cf7-93d9-258e753cd58b

Expected:
- 200 with success:true when cart + address + destination are valid.
- 200 with success:false + invalid_items when items are missing or have zero weight.
- 200 with success:false when cart/address/destination/weight is missing.
