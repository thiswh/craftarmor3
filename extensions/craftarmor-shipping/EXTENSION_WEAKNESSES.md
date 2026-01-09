# Craftarmor Shipping - Remaining Weak Points

Status: noted for future work (no changes applied yet)

## High Priority (Security)

1) deliverySync endpoint is open
- Risk: anyone can trigger sync and burn external API limits
- File: extensions/craftarmor-shipping/src/api/deliverySync/[bodyParser]postSync.ts
- Suggested fix: require admin auth or a secret token (env)

2) deliveryCalculate accepts body fallback without cart/sid
- Risk: client can spoof weight/dimensions and get cheaper delivery
- File: extensions/craftarmor-shipping/src/api/deliveryCalculate/[bodyParser]postCalculate.ts
- Suggested fix: require cart/sid or validate body against DB

## Low Priority (Quality / UX)

3) box size algorithm is not good for soft items (clothes)
- Risk: unrealistic dimensions (tall narrow boxes), higher delivery cost
- File: extensions/craftarmor-shipping/src/services/registerCartDimensionsFields.ts
- Suggested fix: switch to soft-items formula or add compression factor

4) Boxberry service not implemented
- Risk: user can select Boxberry and calculation will error
- File: extensions/craftarmor-shipping/src/services/boxberry/BoxberryService.ts
- Suggested fix: hide service until implemented or add proper API integration
