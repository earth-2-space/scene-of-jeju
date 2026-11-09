import { ADD_ONS, PICKUP, PRICE, type AddOns, type Pickup } from "@/lib/rituals";

type Priced = { privateClass: boolean; people: number; addOns: AddOns; pickup: Pickup };

/** 네이버에서 미리 결제하는 금액(할인가 기준). 아이템값은 빠져 있어요. */
export function prepaidAmount(r: Priced) {
  const base = r.privateClass ? PRICE.privateClass : PRICE.naver * r.people;
  const addOns = (Object.keys(r.addOns) as (keyof AddOns)[]).reduce(
    (sum, id) => sum + (ADD_ONS[id].price ?? 0) * r.addOns[id],
    0,
  );
  return base + addOns + PICKUP[r.pickup].price * r.people;
}

/** 현장에서 받을 아이템값 범위(1인 1개 기준) */
export function onsiteItemRange(people: number) {
  return [PRICE.itemMin * people, PRICE.itemMax * people] as const;
}
