import { Card } from '@components/admin/Card.js';
import { InputField } from '@components/common/form/InputField.js';
import { ToggleField } from '@components/common/form/ToggleField.js';
import React from 'react';

export default function YookassaSbpSetting({
  setting: {
    yookassaSbpStatus,
    yookassaSbpDisplayName,
    yookassaShopId,
    yookassaSecretKey
  }
}: {
  setting: {
    yookassaSbpStatus: true | false | 0 | 1;
    yookassaSbpDisplayName: string;
    yookassaShopId: string;
    yookassaSecretKey: string;
  };
}) {
  return (
    <Card title="YooKassa SBP">
      <Card.Session>
        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-1 items-center flex">
            <h4>Enable?</h4>
          </div>
          <div className="col-span-2">
            <ToggleField
              name="yookassaSbpStatus"
              defaultValue={yookassaSbpStatus}
              trueValue={1}
              falseValue={0}
            />
          </div>
        </div>
      </Card.Session>

      <Card.Session>
        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-1 items-center flex">
            <h4>Display Name</h4>
          </div>
          <div className="col-span-2">
            <InputField
              name="yookassaSbpDisplayName"
              placeholder="SBP (YooKassa)"
              defaultValue={yookassaSbpDisplayName}
            />
          </div>
        </div>
      </Card.Session>

      <Card.Session>
        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-1 items-center flex">
            <h4>Shop ID</h4>
          </div>
          <div className="col-span-2">
            <InputField
              name="yookassaShopId"
              placeholder="YooKassa Shop ID"
              defaultValue={yookassaShopId}
            />
          </div>
        </div>
      </Card.Session>

      <Card.Session>
        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-1 items-center flex">
            <h4>Secret Key</h4>
          </div>
          <div className="col-span-2">
            <InputField
              name="yookassaSecretKey"
              type="password"
              placeholder="YooKassa Secret Key"
              defaultValue={yookassaSecretKey}
            />
          </div>
        </div>
      </Card.Session>
    </Card>
  );
}

export const layout = {
  areaId: 'paymentSetting',
  sortOrder: 24
};

export const query = `
  query Query {
    setting {
      yookassaSbpStatus
      yookassaSbpDisplayName
      yookassaShopId
      yookassaSecretKey
    }
  }
`;

